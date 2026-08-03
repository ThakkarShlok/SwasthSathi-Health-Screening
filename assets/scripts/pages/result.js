/**
 * ============================================
 * RESULT PAGE LOGIC
 * Data retrieval, risk calculation, UI rendering
 * ============================================
 */

// ==========================================
// INITIALIZATION
// ==========================================

document.addEventListener('DOMContentLoaded', function() {
    console.log('=== SwasthSathi Results Page ===');
    
    // Simulate loading delay for better UX
    setTimeout(() => {
        initializeResultsPage();
    }, 800);
});

// ==========================================
// DATA RETRIEVAL - SUPABASE VERSION
// ==========================================

/**
 * ============================================
 * MODIFIED FETCH USER DATA FUNCTION
 * Supports viewing from dashboard history
 * ============================================
 */

async function fetchUserData() {
    try {
        console.log('📄 Fetching screening data...');

        // Check if viewing from dashboard (specific screening)
        const selectedIndex = sessionStorage.getItem('selectedScreeningIndex');
        
        if (selectedIndex !== null) {
            // Fetch all user screenings
            const result = await window.supabaseClient.getUserScreenings();
            
            if (result.success && result.screenings.length > selectedIndex) {
                const screening = result.screenings[parseInt(selectedIndex)];
                console.log('✅ Loaded screening from history');
                sessionStorage.removeItem('selectedScreeningIndex'); // Clear after use
                return screening;
            }
        }

        // Otherwise, get latest screening (existing behavior)
        const result = await window.supabaseClient.getLatestScreening();
        
        if (!result.success || !result.data) {
            console.warn('❌ No screening data found');
            return null;
        }

        console.log(`✅ Latest screening loaded`);
        return result.data;
        
    } catch (error) {
        console.error('❌ Error fetching data:', error);
        return null;
    }
}

// Update initialization to be async
async function initializeResultsPage() {
    try {
        console.log('🔧 Initializing results page...');
        
        // Fetch patient data from Supabase (with localStorage fallback)
        const patientData = await fetchUserData();
        
        if (!patientData) {
            console.error('❌ No patient data available');
            showErrorState();
            return;
        }

        console.log('✅ Patient data loaded successfully');

        // Calculate risk assessment (needed for topFactors, recommendations, guidelines)
        const assessment = window.RiskCalculator.assessHealthRisk(patientData);

        // Prefer stored snapshot scores when available (prevents score drift between saves)
        if (patientData.computedRiskScore !== null && patientData.computedRiskScore !== undefined) {
            assessment.combined.score = patientData.computedRiskScore;
            if (patientData.riskCategory) assessment.combined.category = patientData.riskCategory;
            if (patientData.diabetesRiskScore !== null && patientData.diabetesRiskScore !== undefined) {
                assessment.diabetes.score = patientData.diabetesRiskScore;
            }
            if (patientData.hypertensionRiskScore !== null && patientData.hypertensionRiskScore !== undefined) {
                assessment.hypertension.score = patientData.hypertensionRiskScore;
            }
        }
        
        // Render UI (pass patientData for completeness panel)
        renderResultsUI(assessment, patientData);

        // Publish the already-computed result for the guideline chat panel
        // (Phase 4). Read-only handoff — the chat never recomputes risk.
        window.SwasthResult = { assessment, patientData };
        document.dispatchEvent(new CustomEvent('swasth:result-ready'));

        // Hide loading, show results
        document.getElementById('loadingState').style.display = 'none';
        document.getElementById('resultsContainer').style.display = 'block';

        // Fire-and-forget: augment with AI recommendation (non-blocking)
        loadAIRecommendation(assessment, patientData);

        // Show share button if logged in (non-blocking)
        initShareButton(patientData);
        initWhatsAppButton(patientData, assessment);

        console.log('✅ Results page rendered successfully');
        
    } catch (error) {
        console.error('❌ Error initializing results:', error);
        console.error('Error stack:', error.stack);
        showErrorState();
    }
}

// ==========================================
// UI RENDERING
// ==========================================

/**
 * Render the complete results UI
 */
function renderResultsUI(assessment, patientData) {
    renderPatientInfo(assessment.patientInfo, assessment.timestamp);
    renderCombinedRisk(assessment.combined);
    renderRiskGauge(assessment.combined.score, assessment.combined.color);
    renderDiabetesRisk(assessment.diabetes, assessment.assessmentTier);
    renderHypertensionRisk(assessment.hypertension, assessment.assessmentTier);
    renderFactorCards(assessment.diabetes, assessment.hypertension);
    if (patientData) renderCompletenessPanel(patientData);
    renderRecommendations(assessment.recommendations, assessment.combined.urgency);
    renderGuidelines(assessment.guidelines);
}

/**
 * Render patient information header
 */
function renderPatientInfo(patientInfo, timestamp) {
    document.getElementById('patientName').textContent = patientInfo.name;
    document.getElementById('patientAge').textContent = patientInfo.age;
    document.getElementById('patientGender').textContent = patientInfo.gender;
    document.getElementById('patientBMI').textContent = patientInfo.bmi ? patientInfo.bmi.toFixed(1) : 'N/A';
    
    // Format date
    const date = new Date(timestamp);
    const formattedDate = date.toLocaleDateString('en-IN', { 
        day: 'numeric', 
        month: 'short', 
        year: 'numeric' 
    });
    document.getElementById('assessmentDate').textContent = formattedDate;
}

/**
 * Render combined risk score (hero section)
 */
function renderCombinedRisk(combinedRisk) {
    const card = document.getElementById('combinedRiskCard');
    const scoreCircle = document.getElementById('combinedScoreCircle');
    const scoreNumber = document.getElementById('combinedScore');
    const category = document.getElementById('combinedCategory');
    const message = document.getElementById('combinedMessage');

    // Set score with animation
    animateScore(scoreNumber, 0, combinedRisk.score, 1500);
    
    // Set category
    category.textContent = combinedRisk.category;
    category.className = `risk-category mt-3 mb-2 text-${combinedRisk.color}`;
    
    // Set message based on urgency
    const messages = {
        urgent: window.translator.t('risk_message_urgent', 'Immediate medical attention recommended. Please consult a doctor as soon as possible.'),
        high: window.translator.t('risk_message_high', 'High risk detected. Schedule a doctor appointment within 1-2 weeks.'),
        medium: window.translator.t('risk_message_medium', 'Moderate risk. Lifestyle changes and regular monitoring recommended.'),
        low: window.translator.t('risk_message_low', 'Low risk. Maintain healthy lifestyle and annual checkups.')
    };
    message.textContent = messages[combinedRisk.urgency];
    
    // Update card styling
    card.classList.add(`risk-${combinedRisk.color}`);
    scoreCircle.classList.add(`border-${combinedRisk.color}`);
    scoreNumber.classList.add(`text-${combinedRisk.color}`);
}

/**
 * Render diabetes risk
 */
function renderDiabetesRisk(diabetesRisk, assessmentTier) {
    const card = document.getElementById('diabetesRiskCard');
    const score = document.getElementById('diabetesScore');
    const badge = document.getElementById('diabetesBadge');
    const factorsList = document.getElementById('diabetesFactors');

    // Set score
    animateScore(score, 0, diabetesRisk.score, 1200);

    // Set badge
    badge.textContent = diabetesRisk.category;
    badge.className = `badge bg-${diabetesRisk.color}-custom`;

    // Set factors
    factorsList.innerHTML = '';
    diabetesRisk.topFactors.forEach(factor => {
        const li = document.createElement('li');
        li.textContent = factor;
        factorsList.appendChild(li);
    });

    // Replace confidence with tier badge
    const tierEl = document.getElementById('diabetesConfidence');
    if (tierEl && assessmentTier) {
        const tierLabels = {
            baseline: window.translator.t('tier_baseline', 'Baseline assessment'),
            partial: window.translator.t('tier_partial', 'Partial lab data'),
            enhanced: window.translator.t('tier_enhanced', 'Enhanced with lab data')
        };
        const tierColors = {
            baseline: 'text-muted',
            partial: 'text-info',
            enhanced: 'text-success fw-bold'
        };
        tierEl.textContent = tierLabels[assessmentTier] || tierLabels.baseline;
        tierEl.className = tierColors[assessmentTier] || tierColors.baseline;
    }

    // Add border color
    card.style.borderLeft = `5px solid var(--color-${diabetesRisk.color})`;
}

/**
 * Render hypertension risk
 */
function renderHypertensionRisk(hypertensionRisk, assessmentTier) {
    const card = document.getElementById('hypertensionRiskCard');
    const score = document.getElementById('hypertensionScore');
    const badge = document.getElementById('hypertensionBadge');
    const factorsList = document.getElementById('hypertensionFactors');

    // Set score
    animateScore(score, 0, hypertensionRisk.score, 1200);

    // Set badge
    badge.textContent = hypertensionRisk.category;
    badge.className = `badge bg-${hypertensionRisk.color}-custom`;

    // Set factors
    factorsList.innerHTML = '';
    hypertensionRisk.topFactors.forEach(factor => {
        const li = document.createElement('li');
        li.textContent = factor;
        factorsList.appendChild(li);
    });

    // Replace confidence with tier badge
    const tierEl = document.getElementById('hypertensionConfidence');
    if (tierEl && assessmentTier) {
        const tierLabels = {
            baseline: window.translator.t('tier_baseline', 'Baseline assessment'),
            partial: window.translator.t('tier_partial', 'Partial lab data'),
            enhanced: window.translator.t('tier_enhanced', 'Enhanced with lab data')
        };
        const tierColors = {
            baseline: 'text-muted',
            partial: 'text-info',
            enhanced: 'text-success fw-bold'
        };
        tierEl.textContent = tierLabels[assessmentTier] || tierLabels.baseline;
        tierEl.className = tierColors[assessmentTier] || tierColors.baseline;
    }

    // Add border color
    card.style.borderLeft = `5px solid var(--color-${hypertensionRisk.color})`;
}

/**
 * Render recommendations
 */
function renderRecommendations(recommendations, urgency) {
    const container = document.getElementById('recommendationsContainer');
    container.innerHTML = '';

    // Immediate actions
    if (recommendations.immediate.length > 0) {
        const section = createRecommendationSection(window.translator.t('result_immediate', 'Immediate Actions'), recommendations.immediate, 'urgent');
        container.appendChild(section);
    }

    // Lifestyle changes
    if (recommendations.lifestyle.length > 0) {
        const section = createRecommendationSection(window.translator.t('result_lifestyle', 'Lifestyle Changes'), recommendations.lifestyle, 'lifestyle');
        container.appendChild(section);
    }

    // Follow-up
    if (recommendations.followUp.length > 0) {
        const section = createRecommendationSection(window.translator.t('result_followup', 'Follow-Up'), recommendations.followUp, 'followup');
        container.appendChild(section);
    }
}

/**
 * Create recommendation section
 */
function createRecommendationSection(title, items, type) {
    const section = document.createElement('div');
    section.className = 'recommendation-section';
    
    const heading = document.createElement('h6');
    heading.innerHTML = `<i class="bi bi-${type === 'urgent' ? 'exclamation-triangle-fill' : type === 'lifestyle' ? 'heart-fill' : 'calendar-check'}"></i> ${title}`;
    section.appendChild(heading);
    
    const list = document.createElement('ul');
    list.className = `recommendation-list ${type}`;
    
    items.forEach(item => {
        const li = document.createElement('li');
        li.textContent = item;
        list.appendChild(li);
    });
    
    section.appendChild(list);
    return section;
}

// ==========================================
// SHAREABLE RESULTS (TASK 6)
// ==========================================

// Ambiguity-free alphabet: no 0/O/I/1/l
const SHORT_CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

function generateShortCode() {
    let code = '';
    const arr = crypto.getRandomValues(new Uint8Array(8));
    for (const byte of arr) {
        code += SHORT_CODE_ALPHABET[byte % SHORT_CODE_ALPHABET.length];
    }
    return code;
}

/**
 * Resolve this result's share short code, creating and persisting one lazily
 * on first use. Returns the code, or null if it could not be produced.
 * Single source of truth for Share, WhatsApp, and Email My Result.
 */
async function getOrCreateShareCode(patientData) {
    let code = patientData?.resultShortCode;
    const screeningId = patientData?.id;

    if (!code && screeningId) {
        code = generateShortCode();
        const saved = await window.supabaseClient.saveShortCode(screeningId, code);
        if (!saved.success) return null;
        if (patientData) patientData.resultShortCode = code;
    }
    return code || null;
}

/** Build the canonical share.html URL for a given short code. */
function buildShareUrl(code) {
    return `${location.origin}${location.pathname.replace('result.html', '')}share.html?code=${code}`;
}

// Exposed so the Email My Result module (email-result.js) reuses the exact
// same link generation rather than duplicating it.
window.SwasthShare = { getOrCreateShareCode, buildShareUrl };

async function initShareButton(patientData) {
    if (!window.supabaseClient) return;
    const token = await window.supabaseClient.getValidAccessToken();
    if (!token) return;

    const btn = document.getElementById('shareResultBtn');
    if (!btn) return;
    btn.style.display = 'inline-block';

    btn.addEventListener('click', async () => {
        btn.disabled = true;

        try {
            const code = await getOrCreateShareCode(patientData);
            if (!code) { btn.disabled = false; return; }

            const shareUrl = buildShareUrl(code);
            await navigator.clipboard.writeText(shareUrl).catch(() => {
                prompt(window.translator.t('share_copy_manually', 'Copy this link:'), shareUrl);
            });
            showShareToast(window.translator.t('share_link_copied', 'Link copied to clipboard!'));
        } finally {
            btn.disabled = false;
        }
    });
}

function showShareToast(message) {
    const toastEl = document.querySelector('#shareToast .toast');
    const body = document.getElementById('shareToastBody');
    if (!toastEl || !body) return;
    body.textContent = message;
    const bsToast = bootstrap.Toast.getOrCreateInstance(toastEl, { delay: 3000 });
    bsToast.show();
}

async function initWhatsAppButton(patientData, assessment) {
    if (!window.supabaseClient) return;
    const token = await window.supabaseClient.getValidAccessToken();
    if (!token) return;

    const btn = document.getElementById('whatsappShareBtn');
    if (!btn) return;
    btn.style.display = 'inline-block';

    btn.addEventListener('click', async () => {
        btn.disabled = true;
        try {
            const code = await getOrCreateShareCode(patientData);
            const shareUrl = code ? buildShareUrl(code) : location.href;

            const diabetesRisk = Math.round(assessment?.diabetes?.score ?? 0);
            const hypertensionRisk = Math.round(assessment?.hypertension?.score ?? 0);
            const score = Math.round(assessment?.combined?.score ?? 0);

            const template = window.translator.t(
                'whatsapp_share_template',
                '📊 My SwasthSathi Health Screening\n\nDiabetes Risk: {diabetes}\nHypertension Risk: {hypertension}\nOverall Score: {score}/100\n\nView result: {url}\n\n🏥 SwasthSathi — Free Health Screening',
                { diabetes: diabetesRisk, hypertension: hypertensionRisk, score, url: shareUrl },
            );

            const waUrl = `https://wa.me/?text=${encodeURIComponent(template)}`;
            window.open(waUrl, '_blank', 'noopener,noreferrer');
        } finally {
            btn.disabled = false;
        }
    });
}

// ==========================================
// AI RECOMMENDATION (TASK 4)
// ==========================================

async function loadAIRecommendation(assessment, patientData) {
    if (!window.supabaseClient) return;
    const token = await window.supabaseClient.getValidAccessToken();
    if (!token) return;
    if (window.InFlightTracker && !window.InFlightTracker.start('llm')) return;

    const container = document.getElementById('recommendationsContainer');
    if (!container) return;

    const aiSection = document.createElement('div');
    aiSection.id = 'aiRecommendationSection';
    aiSection.className = 'ai-rec-section';
    aiSection.innerHTML = `
        <div class="ai-rec-header">
            <span class="ai-rec-badge">✨ AI</span>
            <span data-i18n="ai_rec_title">Personalized AI Insights</span>
        </div>
        <div class="ai-rec-loading">
            <div class="spinner-border spinner-border-sm text-primary" role="status" aria-hidden="true"></div>
            <span data-i18n="ai_rec_loading">Generating personalized recommendation...</span>
        </div>`;
    container.appendChild(aiSection);
    if (window.translator) window.translator.applyTranslations();

    const lang = localStorage.getItem('selectedLanguage') || 'en';
    const topFactors = [];
    if (assessment.diabetes?.topFactors) topFactors.push(...assessment.diabetes.topFactors.slice(0, 2));
    if (assessment.hypertension?.topFactors) topFactors.push(...assessment.hypertension.topFactors.slice(0, 2));

    const riskData = {
        combined: {
            score: assessment.combined?.score,
            risk: assessment.combined?.risk || assessment.combined?.category,
            tier: assessment.assessmentTier
        },
        diabetes: {
            risk: assessment.diabetes?.risk || assessment.diabetes?.category,
            score: assessment.diabetes?.score
        },
        hypertension: {
            risk: assessment.hypertension?.risk || assessment.hypertension?.category,
            score: assessment.hypertension?.score
        },
        topFactors: [...new Set(topFactors)],
        topContributions: (assessment.diabetes?.factorContributions || [])
            .concat(assessment.hypertension?.factorContributions || [])
            .sort((a, b) => b.points - a.points)
            .slice(0, 3)
    };

    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), 15000);

    try {
        const url = `${window.supabaseClient.supabaseUrl}/functions/v1/generate-recommendation`;
        const resp = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                riskData,
                lang,
                patientAge: patientData?.age ?? null,
                patientGender: patientData?.gender ?? null,
                additionalSymptoms: patientData?.additionalSymptoms ?? null,
                symptomsConsent: patientData?.symptomsConsent ?? false,
            }),
            signal: controller.signal,
        });
        clearTimeout(tid);

        if (resp.status === 429 || !resp.ok) { aiSection.remove(); return; }

        const { recommendation } = await resp.json();
        if (!recommendation) { aiSection.remove(); return; }

        aiSection.innerHTML = `
            <div class="ai-rec-header">
                <span class="ai-rec-badge">✨ AI</span>
                <span data-i18n="ai_rec_title">Personalized AI Insights</span>
            </div>
            <div class="ai-rec-body">${recommendation.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')}</div>
            <div class="ai-rec-footer">
                <small data-i18n="ai_rec_disclaimer">AI-generated. Not a substitute for professional medical advice.</small>
            </div>`;
        if (window.translator) window.translator.applyTranslations();

    } catch {
        clearTimeout(tid);
        aiSection.remove();
    } finally {
        if (window.InFlightTracker) window.InFlightTracker.end('llm');
    }
}

// ==========================================
// UTILITY FUNCTIONS
// ==========================================

/**
 * Animate score counter
 */
function animateScore(element, start, end, duration) {
    const range = end - start;
    const increment = range / (duration / 16);
    let current = start;

    const timer = setInterval(() => {
        current += increment;
        if (current >= end) {
            current = end;
            clearInterval(timer);
        }
        element.textContent = Math.round(current);
    }, 16);
}

/**
 * Show error state
 */
function showErrorState() {
    document.getElementById('loadingState').style.display = 'none';
    document.getElementById('errorState').style.display = 'block';
}

// ==========================================
// CONSOLE WELCOME
// ==========================================

/**
 * Render health guidelines (Do's, Don'ts, Exercise)
 */
function renderGuidelines(guidelines) {
    // Render Do's
    const dosList = document.getElementById('dosList');
    if (dosList) {
        dosList.innerHTML = '';
        guidelines.dos.forEach(item => {
            const li = document.createElement('li');
            li.textContent = item;
            dosList.appendChild(li);
        });
    }

    // Render Don'ts
    const dontsList = document.getElementById('dontsList');
    if (dontsList) {
        dontsList.innerHTML = '';
        guidelines.donts.forEach(item => {
            const li = document.createElement('li');
            li.textContent = item;
            dontsList.appendChild(li);
        });
    }

    // Render Exercise
    const exerciseList = document.getElementById('exerciseList');
    if (exerciseList) {
        exerciseList.innerHTML = '';
        guidelines.exercises.forEach(item => {
            const li = document.createElement('li');
            li.textContent = item;
            exerciseList.appendChild(li);
        });
    }
}

// ==========================================
// RISK GAUGE
// ==========================================

function renderRiskGauge(score, color) {
    const pointer = document.getElementById('gaugePointer');
    if (!pointer) return;

    // Position: score 0-100 maps to 0%-100% of the track width
    // Clamp slightly from edges so pointer stays visible
    const pct = Math.min(Math.max(score, 1), 99);
    setTimeout(() => { pointer.style.left = pct + '%'; }, 100);

    // Color the pointer to match risk level
    const colorMap = { success: '#10b981', warning: '#f59e0b', danger: '#ef4444' };
    pointer.style.color = colorMap[color] || '#111827';
}

// ==========================================
// CONTRIBUTING FACTOR CARDS
// ==========================================

function renderFactorCards(diabetesRisk, hypertensionRisk) {
    const container = document.getElementById('factorCardsContainer');
    if (!container) return;

    // v1.4 path: use factorContributions if available
    const hasContributions = (diabetesRisk.factorContributions?.length || 0) > 0
                          || (hypertensionRisk.factorContributions?.length || 0) > 0;
    if (hasContributions) {
        renderFactorCardsV14(container, diabetesRisk, hypertensionRisk);
        return;
    }

    // v1.3 fallback: collect unique top factors across both conditions (max 6 cards)
    const seen = new Set();
    const allFactors = [
        ...diabetesRisk.topFactors.map(f => ({ factor: f, source: 'diabetes' })),
        ...hypertensionRisk.topFactors.map(f => ({ factor: f, source: 'hypertension' }))
    ].filter(item => {
        if (seen.has(item.factor)) return false;
        seen.add(item.factor);
        return true;
    }).slice(0, 6);

    const iconMap = {
        factor_age_title:                     'bi-calendar-heart',
        factor_obesity_title:                 'bi-person-fill',
        factor_overweight_title:              'bi-arrow-up-circle-fill',
        factor_abdominal_obesity_title:       'bi-rulers',
        factor_blood_sugar_high_title:        'bi-droplet-fill',
        factor_blood_sugar_prediabetes_title: 'bi-droplet-half',
        factor_blood_pressure_title:          'bi-heart-pulse-fill',
        factor_diagnosed_diabetes_title:      'bi-clipboard2-pulse-fill',
        factor_diagnosed_hypertension_title:  'bi-clipboard2-heart-fill',
        factor_diabetes_symptoms_title:       'bi-activity',
        factor_htn_symptoms_title:            'bi-broadcast',
        factor_family_history_title:          'bi-people-fill',
        factor_sedentary_title:               'bi-tv-fill',
        factor_diet_title:                    'bi-egg-fried',
        factor_smoking_title:                 'bi-wind',
        factor_alcohol_title:                 'bi-cup-fill',
    };

    container.innerHTML = allFactors.map(({ factor, source }) => {
        const expl = window.FactorExplanations
            ? window.FactorExplanations.getFactorExplanation(factor)
            : null;

        const title = expl
            ? window.translator.t(expl.title_key, factor)
            : factor;
        const context = expl
            ? window.translator.t(expl.context_key, '')
            : '';
        const icon = expl ? (iconMap[expl.title_key] || 'bi-exclamation-circle') : 'bi-exclamation-circle';
        const sourceColor = source === 'diabetes' ? 'text-success' : 'text-danger';
        const sourceBadge = source === 'diabetes' ? '🩸' : '❤️';

        return `
            <div class="col-md-6 col-lg-4">
                <div class="factor-context-card">
                    <div class="factor-context-icon ${sourceColor}">
                        <i class="bi ${icon}"></i> ${sourceBadge}
                    </div>
                    <div class="factor-context-title">${title}</div>
                    <div class="factor-context-raw">${factor}</div>
                    ${context ? `<div class="factor-context-body">${context}</div>` : ''}
                </div>
            </div>
        `;
    }).join('');

    if (allFactors.length === 0) {
        container.innerHTML = '<p class="text-muted small">No significant factors detected.</p>';
    }
}

function renderFactorCardsV14(container, diabetesRisk, hypertensionRisk) {
    const merged = new Map();
    const all = [
        ...(diabetesRisk.factorContributions || []).map(f => ({...f, source: 'diabetes'})),
        ...(hypertensionRisk.factorContributions || []).map(f => ({...f, source: 'hypertension'}))
    ];
    all.forEach(f => {
        const existing = merged.get(f.id);
        if (!existing || f.points > existing.points) merged.set(f.id, f);
    });
    const top = Array.from(merged.values())
        .sort((a, b) => b.points - a.points)
        .slice(0, 6);

    const iconMap = {
        factor_age_title: 'bi-calendar-heart',
        factor_obesity_title: 'bi-person-fill',
        factor_overweight_title: 'bi-arrow-up-circle-fill',
        factor_abdominal_obesity_title: 'bi-rulers',
        factor_blood_sugar_high_title: 'bi-droplet-fill',
        factor_blood_sugar_prediabetes_title: 'bi-droplet-half',
        factor_hba1c_title: 'bi-droplet-fill',
        factor_blood_pressure_title: 'bi-heart-pulse-fill',
        factor_diagnosed_diabetes_title: 'bi-clipboard2-pulse-fill',
        factor_diagnosed_hypertension_title: 'bi-clipboard2-heart-fill',
        factor_diabetes_symptoms_title: 'bi-activity',
        factor_htn_symptoms_title: 'bi-broadcast',
        factor_family_history_title: 'bi-people-fill',
        factor_sedentary_title: 'bi-tv-fill',
        factor_diet_title: 'bi-egg-fried',
        factor_smoking_title: 'bi-wind',
        factor_alcohol_title: 'bi-cup-fill'
    };

    const categoryLabels = {
        modifiable: window.translator.t('factor_cat_modifiable', 'You can change this'),
        non_modifiable: window.translator.t('factor_cat_non_modifiable', 'Cannot be changed'),
        clinical: window.translator.t('factor_cat_clinical', 'Clinical measurement')
    };
    const categoryColors = {
        modifiable: 'text-success',
        non_modifiable: 'text-muted',
        clinical: 'text-primary'
    };

    container.innerHTML = top.map(f => {
        const expl = window.FactorExplanations
            ? window.FactorExplanations.getFactorExplanation(f.label)
            : null;
        const title = expl ? window.translator.t(expl.title_key, f.label) : f.label;
        const context = expl ? window.translator.t(expl.context_key, '') : '';
        const icon = expl ? (iconMap[expl.title_key] || 'bi-exclamation-circle') : 'bi-exclamation-circle';
        const catLabel = categoryLabels[f.category] || '';
        const catColor = categoryColors[f.category] || 'text-muted';

        return `
            <div class="col-md-6 col-lg-4">
                <div class="factor-context-card">
                    <div class="factor-context-icon ${f.source === 'diabetes' ? 'text-success' : 'text-danger'}">
                        <i class="bi ${icon}"></i>
                    </div>
                    <div class="factor-context-title">${title}</div>
                    <div class="d-flex justify-content-between align-items-center mb-2">
                        <span class="badge bg-secondary-subtle text-dark">${f.points} pts</span>
                        <small class="${catColor}"><i class="bi bi-tag-fill"></i> ${catLabel}</small>
                    </div>
                    ${context ? `<div class="factor-context-body">${context}</div>` : ''}
                </div>
            </div>
        `;
    }).join('');

    if (top.length === 0) {
        container.innerHTML = `<p class="text-muted small">${window.translator.t('factor_none_detected', 'No significant risk factors detected.')}</p>`;
    }
}

// ==========================================
// DATA COMPLETENESS PANEL
// ==========================================

function renderCompletenessPanel(patientData) {
    const container = document.getElementById('completenessContainer');
    if (!container) return;

    const t = (key, fb) => window.translator.t(key, fb);

    const fields = [
        {
            key: 'blood_sugar',
            label: t('completeness_blood_sugar', 'Blood Sugar'),
            present: !!(patientData.readings && patientData.readings.bloodSugar)
        },
        {
            key: 'blood_pressure',
            label: t('completeness_blood_pressure', 'Blood Pressure'),
            present: !!(patientData.readings && patientData.readings.bloodPressure)
        },
        {
            key: 'hba1c',
            label: t('completeness_hba1c', 'HbA1c (3-month sugar)'),
            present: !!(patientData.readings && patientData.readings.hba1c)
        },
        {
            key: 'waist',
            label: t('completeness_waist', 'Waist Measurement'),
            present: !!(patientData.waistCircumference)
        },
        {
            key: 'symptoms',
            label: t('completeness_symptoms', 'Symptoms'),
            present: !!(patientData.symptoms && (
                Object.values(patientData.symptoms.diabetes || {}).some(Boolean) ||
                Object.values(patientData.symptoms.hypertension || {}).some(Boolean)
            ))
        },
        {
            key: 'lifestyle',
            label: t('completeness_lifestyle', 'Lifestyle Data'),
            present: !!(patientData.lifestyle && patientData.lifestyle.physicalActivity)
        }
    ];

    const presentCount = fields.filter(f => f.present).length;
    const pct = Math.round((presentCount / fields.length) * 100);

    container.innerHTML = `
        <div class="completeness-grid">
            ${fields.map(f => `
                <div class="completeness-item ${f.present ? 'present' : 'missing'}">
                    <i class="bi ${f.present ? 'bi-check-circle-fill' : 'bi-dash-circle'} completeness-icon"></i>
                    <span>${f.label}</span>
                </div>
            `).join('')}
        </div>
        <div class="completeness-bar-track">
            <div class="completeness-bar-fill" style="width: ${pct}%"></div>
        </div>
        <div class="completeness-pct">${presentCount}/${fields.length} fields — ${pct}% complete</div>
    `;
}

// ==========================================
// PRINT SUPPORT
// ==========================================

window.addEventListener('beforeprint', () => {
    const el = document.getElementById('printDate');
    if (el) {
        const localeMap = { en: 'en-IN', hi: 'hi-IN', gu: 'gu-IN', mr: 'mr-IN' };
        const lang = localStorage.getItem('selectedLanguage') || 'en';
        el.textContent = new Date().toLocaleDateString(localeMap[lang] || 'en-IN', {
            day: 'numeric', month: 'long', year: 'numeric'
        });
    }
});

console.log('%c🩺 SwasthSathi Results', 'color: #10b981; font-size: 16px; font-weight: bold;');
console.log('%cEvidence-based health risk assessment', 'color: #6b7280; font-size: 12px;');