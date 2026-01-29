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
// MAIN INITIALIZATION FUNCTION
// ==========================================

function initializeResultsPage() {
    try {
        // Fetch patient data from localStorage
        const patientData = fetchUserData();
        
        if (!patientData) {
            showErrorState();
            return;
        }

        // Calculate risk assessment
        const assessment = window.RiskCalculator.assessHealthRisk(patientData);
        
        // Render UI
        renderResultsUI(assessment);
        
        // Hide loading, show results
        document.getElementById('loadingState').style.display = 'none';
        document.getElementById('resultsContainer').style.display = 'block';
        
        console.log('✓ Results rendered successfully');
        
    } catch (error) {
        console.error('Error initializing results:', error);
        showErrorState();
    }
}

// ==========================================
// DATA RETRIEVAL
// ==========================================

/**
 * Fetch user data from localStorage
 * Returns the most recent screening data
 */
function fetchUserData() {
    try {
        const patientsData = localStorage.getItem('swasthsathi_patients');
        
        if (!patientsData) {
            console.warn('No patient data found in localStorage');
            return null;
        }

        const patients = JSON.parse(patientsData);
        
        if (!patients || patients.length === 0) {
            console.warn('Patient data array is empty');
            return null;
        }

        // Return the most recent patient (last in array)
        const latestPatient = patients[patients.length - 1];
        
        console.log('✓ Patient data retrieved:', latestPatient.name);
        return latestPatient;
        
    } catch (error) {
        console.error('Error fetching user data:', error);
        return null;
    }
}

// ==========================================
// UI RENDERING
// ==========================================

/**
 * Render the complete results UI
 */
function renderResultsUI(assessment) {
    // Render patient info
    renderPatientInfo(assessment.patientInfo, assessment.timestamp);
    
    // Render combined risk
    renderCombinedRisk(assessment.combined);
    
    // Render individual risks
    renderDiabetesRisk(assessment.diabetes);
    renderHypertensionRisk(assessment.hypertension);
    
    // Render recommendations
    renderRecommendations(assessment.recommendations, assessment.combined.urgency);
    
    // ⭐ NEW: Render guidelines
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
        urgent: 'Immediate medical attention recommended. Please consult a doctor as soon as possible.',
        high: 'High risk detected. Schedule a doctor appointment within 1-2 weeks.',
        medium: 'Moderate risk. Lifestyle changes and regular monitoring recommended.',
        low: 'Low risk. Maintain healthy lifestyle and annual checkups.'
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
function renderDiabetesRisk(diabetesRisk) {
    const card = document.getElementById('diabetesRiskCard');
    const score = document.getElementById('diabetesScore');
    const badge = document.getElementById('diabetesBadge');
    const factorsList = document.getElementById('diabetesFactors');
    const confidence = document.getElementById('diabetesConfidence');

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
    
    // Set confidence
    confidence.textContent = diabetesRisk.confidence;
    confidence.className = diabetesRisk.confidence === 'High' ? 'text-success fw-bold' : '';
    
    // Add border color
    card.style.borderLeft = `5px solid var(--color-${diabetesRisk.color})`;
}

/**
 * Render hypertension risk
 */
function renderHypertensionRisk(hypertensionRisk) {
    const card = document.getElementById('hypertensionRiskCard');
    const score = document.getElementById('hypertensionScore');
    const badge = document.getElementById('hypertensionBadge');
    const factorsList = document.getElementById('hypertensionFactors');
    const confidence = document.getElementById('hypertensionConfidence');

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
    
    // Set confidence
    confidence.textContent = hypertensionRisk.confidence;
    confidence.className = hypertensionRisk.confidence === 'High' ? 'text-success fw-bold' : '';
    
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
        const section = createRecommendationSection('Immediate Actions', recommendations.immediate, 'urgent');
        container.appendChild(section);
    }

    // Lifestyle changes
    if (recommendations.lifestyle.length > 0) {
        const section = createRecommendationSection('Lifestyle Changes', recommendations.lifestyle, 'lifestyle');
        container.appendChild(section);
    }

    // Follow-up
    if (recommendations.followUp.length > 0) {
        const section = createRecommendationSection('Follow-Up', recommendations.followUp, 'followup');
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

console.log('%c🩺 SwasthSathi Results', 'color: #10b981; font-size: 16px; font-weight: bold;');
console.log('%cEvidence-based health risk assessment', 'color: #6b7280; font-size: 12px;');
