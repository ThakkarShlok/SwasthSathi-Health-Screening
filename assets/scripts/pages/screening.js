/**
 * ============================================
 * SWASTHSATHI - COMPLETE SCREENING SYSTEM
 * Medical Report OCR + Smart Suggestions + Form Validation
 * Version: 1.3 - Fixed Flow & Single Submission Handler
 * ============================================
 */

// ==========================================
// GLOBAL STATE
// ==========================================

let uploadedImage = null;

// ==========================================
// DOM ELEMENTS - OCR SECTION
// ==========================================

const reportImageInput = document.getElementById('reportImage');
const uploadZone = document.getElementById('uploadZone');
const imagePreview = document.getElementById('imagePreview');
const previewImg = document.getElementById('previewImg');
const removeImageBtn = document.getElementById('removeImage');
const processOCRBtn = document.getElementById('processOCR');
const ocrProgress = document.getElementById('ocrProgress');
const ocrProgressBar = document.getElementById('ocrProgressBar');
const ocrStatus = document.getElementById('ocrStatus');
const ocrResults = document.getElementById('ocrResults');
const extractedTextEl = document.getElementById('extractedText');

// ==========================================
// DOM ELEMENTS - FORM SECTION
// ==========================================

const additionalSymptoms = document.getElementById('additionalSymptoms');
const charCount = document.getElementById('charCount');

// ==========================================
// EVENT LISTENERS - OCR
// ==========================================

if (reportImageInput) {
    reportImageInput.addEventListener('change', handleFileSelect);
}

if (uploadZone) {
    uploadZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadZone.classList.add('drag-over');
    });

    uploadZone.addEventListener('dragleave', () => {
        uploadZone.classList.remove('drag-over');
    });

    uploadZone.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadZone.classList.remove('drag-over');

        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFileSelect({ target: { files: [files[0]] } });
        }
    });
}

if (removeImageBtn) {
    removeImageBtn.addEventListener('click', resetOCR);
}

if (processOCRBtn) {
    processOCRBtn.addEventListener('click', handleOCRProcessing);
}

// ==========================================
// EVENT LISTENERS - FORM
// ==========================================

if (additionalSymptoms && charCount) {
    additionalSymptoms.addEventListener('input', function() {
        const currentLength = this.value.length;
        charCount.textContent = currentLength + ' / 500';

        if (currentLength > 450) {
            charCount.style.color = '#dc3545';
        } else if (currentLength > 400) {
            charCount.style.color = '#ffc107';
        } else {
            charCount.style.color = '#6c757d';
        }
    });
}

// ==========================================
// OCR FUNCTIONS
// ==========================================

function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (window.OCRProcessor && !window.OCRProcessor.validateFile(file)) {
        return;
    }

    uploadedImage = file;

    const reader = new FileReader();
    reader.onload = (e) => {
        previewImg.src = e.target.result;
        imagePreview.style.display = 'block';
        uploadZone.style.display = 'none';
    };
    reader.readAsDataURL(file);
}

function resetOCR() {
    uploadedImage = null;
    reportImageInput.value = '';
    imagePreview.style.display = 'none';
    uploadZone.style.display = 'block';
    ocrProgress.style.display = 'none';
    ocrResults.style.display = 'none';
}

async function handleOCRProcessing() {
    if (!uploadedImage) {
        alert(window.translator.t('error_ocr_no_image', 'Please upload an image first'));
        return;
    }

    if (window.InFlightTracker && !window.InFlightTracker.start('ocr')) return;

    processOCRBtn.style.display = 'none';
    ocrProgress.style.display = 'block';
    ocrResults.style.display = 'none';

    const updateProgress = (percent, status) => {
        ocrProgressBar.style.width = percent + '%';
        ocrProgressBar.setAttribute('aria-valuenow', percent);
        ocrStatus.textContent = status;
    };

    try {
        // Attempt Cloud Vision Edge Function first (requires auth)
        const cloudValues = await tryCloudOCR(uploadedImage, updateProgress);
        if (cloudValues) {
            const statusEl = document.getElementById('ocrStatusMessage');
            if (statusEl) statusEl.textContent = window.translator.t('ocr_cloud_success', 'AI analysis complete');
            if (cloudValues.fullText) {
                extractedTextEl.textContent = cloudValues.fullText;
            } else {
                const parts = [];
                if (cloudValues.bloodSugar) parts.push(`Blood Sugar: ${cloudValues.bloodSugar} mg/dL`);
                if (cloudValues.hba1c) parts.push(`HbA1c: ${cloudValues.hba1c}%`);
                if (cloudValues.bloodPressure) parts.push(`Blood Pressure: ${cloudValues.bloodPressure}`);
                extractedTextEl.textContent = parts.join('\n');
            }
            autoFillFormFieldsWithSuggestions(cloudValues);
            ocrProgress.style.display = 'none';
            ocrResults.style.display = 'block';
            ocrResults.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            return;
        }

        // Fall back to on-device Tesseract OCR
        updateProgress(30, window.translator.t('ocr_fallback_local', 'Using device OCR...'));
        if (!window.OCRProcessor) {
            throw new Error('OCR module not loaded. Please refresh the page.');
        }

        const result = await window.OCRProcessor.processOCR(uploadedImage, updateProgress);
        if (!result.success) throw new Error(result.error);

        extractedTextEl.textContent = result.text || 'No text detected';
        const medicalValues = window.OCRProcessor.extractMedicalValues(result.text);
        window.OCRProcessor.displayExtractedValues(medicalValues);
        autoFillFormFieldsWithSuggestions(medicalValues);

        ocrProgress.style.display = 'none';
        ocrResults.style.display = 'block';
        ocrResults.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    } catch (error) {
        console.error('OCR processing failed:', error);
        alert(window.translator.t('error_ocr_processing_failed', 'OCR processing failed: {message}', { message: error.message }));
        ocrProgress.style.display = 'none';
        processOCRBtn.style.display = 'block';
    } finally {
        if (window.InFlightTracker) window.InFlightTracker.end('ocr');
    }
}

// Returns structured medical values from Cloud Vision, or null to trigger Tesseract fallback.
async function tryCloudOCR(file, updateProgress) {
    if (!window.supabaseClient) return null;
    const token = window.supabaseClient.getAccessToken();
    if (!token) return null; // not logged in — skip cloud path

    updateProgress(10, window.translator.t('ocr_upload_start', 'Preparing image...'));
    const base64 = await fileToBase64(file);

    updateProgress(20, window.translator.t('ocr_cloud_analyzing', 'Analyzing with AI...'));

    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), 10000);

    try {
        const url = `${window.supabaseClient.supabaseUrl}/functions/v1/ocr-extract`;
        const resp = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ image: base64, mimeType: file.type }),
            signal: controller.signal,
        });
        clearTimeout(tid);

        if (resp.status === 429) {
            showNotification('warning', window.translator.t('ocr_rate_limit_exceeded', 'Hourly OCR limit reached. Please try again later.'));
            return null; // fall through to Tesseract
        }
        if (!resp.ok) return null;

        const data = await resp.json();
        updateProgress(90, window.translator.t('ocr_cloud_success', 'AI analysis complete'));

        // Map Edge Function keys to the shape autoFillFormFieldsWithSuggestions expects
        return {
            bloodSugar: data.blood_sugar ?? null,
            bloodPressure: data.blood_pressure ?? null,
            hba1c: data.hba1c ?? null,
            fullText: data.full_text ?? null,
        };
    } catch (e) {
        clearTimeout(tid);
        if (e.name === 'AbortError') {
            updateProgress(25, window.translator.t('ocr_timeout', 'Timed out. Switching to device OCR...'));
        }
        return null; // fall through to Tesseract
    }
}

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function autoFillFormFieldsWithSuggestions(values) {
    const suggestions = [];

    if (values.bloodSugar) {
        if (window.MedicalValidator) {
            const validation = window.MedicalValidator.validateBloodSugar(values.bloodSugar);
            suggestions.push({
                fieldId: 'sugar',
                value: values.bloodSugar,
                validation: validation
            });
        } else {
            document.getElementById('sugar').value = values.bloodSugar;
        }
    }

    if (values.bloodPressure) {
        if (window.MedicalValidator) {
            const validation = window.MedicalValidator.validateBloodPressure(values.bloodPressure);
            suggestions.push({
                fieldId: 'bp',
                value: values.bloodPressure,
                validation: validation
            });
        } else {
            document.getElementById('bp').value = values.bloodPressure;
        }
    }

    if (suggestions.length > 0 && window.FormSuggester) {
        window.FormSuggester.suggestMultipleValues(suggestions);
        showNotification('info', window.translator.t('notification_ocr_values_found', 'Found {count} value(s) in your report. Review and accept/reject each suggestion below.', { count: suggestions.length }));
    } else if (suggestions.length > 0) {
        showNotification('success', window.translator.t('notification_ocr_values_autofilled', 'Values extracted from report and auto-filled.'));
    } else {
        showNotification('warning', window.translator.t('notification_ocr_no_values', 'Could not detect blood sugar or blood pressure values. Please enter manually.'));
    }

    if (values.hba1c && window.MedicalValidator) {
        const validation = window.MedicalValidator.validateHbA1c(values.hba1c);
        showContextAlert(
            window.translator.t('notification_hba1c_title', 'HbA1c detected'),
            window.translator.t('notification_hba1c_context', 'Your HbA1c is {value}% - {message}', { value: values.hba1c, message: validation.message }),
            validation.severity
        );
    }
}

// ==========================================
// NOTIFICATION FUNCTIONS
// ==========================================

function showNotification(type, message) {
    const alert = document.createElement('div');
    alert.className = `alert alert-${type} alert-dismissible fade show mt-3`;
    alert.style.animation = 'slideIn 0.3s ease-out';
    alert.innerHTML = `
        <i class="bi bi-${type === 'success' ? 'check-circle-fill' :
                          type === 'warning' ? 'exclamation-triangle' :
                          type === 'danger' ? 'x-circle-fill' :
                          'info-circle-fill'}"></i>
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;

    const form = document.getElementById('screeningForm');
    if (form) {
        form.insertBefore(alert, form.firstChild);
        setTimeout(() => alert.remove(), 5000);
    }
}

function showContextAlert(title, message, type) {
    const alert = document.createElement('div');
    alert.className = `alert alert-${type} mt-3`;
    alert.innerHTML = `
        <strong><i class="bi bi-lightbulb-fill"></i> ${title}:</strong> ${message}
    `;

    const resultsDiv = document.getElementById('ocrResults');
    if (resultsDiv) {
        resultsDiv.appendChild(alert);
    }
}

// ==========================================
// FORM VALIDATION FUNCTIONS
// ==========================================

function calculateBMI(weight, height) {
    if (!weight || !height || weight <= 0 || height <= 0) return null;
    const heightInMeters = height / 100;
    return parseFloat((weight / (heightInMeters * heightInMeters)).toFixed(1));
}

function validateFormData(data) {
    if (data.age < 15 || data.age > 120) {
        showNotification('danger', window.translator.t('error_invalid_age', 'Please enter a valid age (15-120 years)'));
        return false;
    }

    if (data.bmi && (data.bmi < 10 || data.bmi > 60)) {
        showNotification('danger', window.translator.t('error_invalid_bmi', 'Please check height and weight values. BMI seems incorrect.'));
        return false;
    }

    if (data.readings.bloodPressure) {
        const bpPattern = /^\d{2,3}\/\d{2,3}$/;
        if (!bpPattern.test(data.readings.bloodPressure)) {
            showNotification('danger', window.translator.t('error_invalid_bp_format', 'Blood pressure format should be like 120/80'));
            return false;
        }

        const [systolic, diastolic] = data.readings.bloodPressure.split('/').map(Number);
        if (systolic <= diastolic) {
            showNotification('danger', window.translator.t('error_invalid_bp_systolic', 'Systolic pressure (first number) must be higher than diastolic (second number)'));
            return false;
        }
    }

    if (data.readings.bloodSugar) {
        const sugar = parseFloat(data.readings.bloodSugar);
        if (sugar < 30 || sugar > 600) {
            showNotification('danger', window.translator.t('error_invalid_blood_sugar', 'Blood sugar value seems incorrect. Please verify.'));
            return false;
        }
    }

    return true;
}

// ==========================================
// MULTI-STEP FORM NAVIGATION
// ==========================================

let currentStep = 1;
const TOTAL_STEPS = 4;

function goToStep(step) {
    const oldEl = document.getElementById('formStep' + currentStep);
    const newEl = document.getElementById('formStep' + step);
    if (!oldEl || !newEl) return;

    oldEl.classList.remove('active');
    newEl.classList.add('active');

    for (let i = 1; i <= TOTAL_STEPS; i++) {
        const bubble = document.getElementById('bubble-' + i);
        const line   = document.getElementById('line-' + i + '-' + (i + 1));
        if (bubble) {
            bubble.classList.toggle('active', i === step);
            bubble.classList.toggle('completed', i < step);
        }
        if (line) line.classList.toggle('completed', i < step);
    }

    const progressEl = document.getElementById('stepProgressText');
    if (progressEl) {
        progressEl.textContent = window.translator
            ? window.translator.t('step_progress', 'Step {step} of {total}', { step, total: TOTAL_STEPS })
            : 'Step ' + step + ' of ' + TOTAL_STEPS;
    }

    currentStep = step;
    const card = document.querySelector('.screening-card');
    if (card) card.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function nextStep() {
    const stepEl = document.getElementById('formStep' + currentStep);
    const check = validateStep(stepEl);
    if (!check.valid) { focusInvalid(check.firstInvalid); return; }
    if (currentStep < TOTAL_STEPS) goToStep(currentStep + 1);
}

function prevStep() {
    if (currentStep > 1) goToStep(currentStep - 1);
}

/**
 * Validates all required inputs/selects/textareas inside a given container.
 * Returns { valid: bool, firstInvalid: HTMLElement|null }.
 * Adds .is-invalid class to failing fields, removes it from passing ones.
 * Works on hidden containers (checkValidity does not require visibility).
 */
function validateStep(containerEl) {
    if (!containerEl) return { valid: true, firstInvalid: null };
    const fields = containerEl.querySelectorAll(
        'input[required], select[required], textarea[required]'
    );
    let firstInvalid = null;
    fields.forEach(el => {
        const ok = el.checkValidity();
        if (!ok) {
            el.classList.add('is-invalid');
            if (!firstInvalid) firstInvalid = el;
        } else {
            el.classList.remove('is-invalid');
        }
    });
    return { valid: !firstInvalid, firstInvalid };
}

/**
 * Scrolls to and focuses an invalid field after a short delay
 * to allow step-navigation animation to complete.
 */
function focusInvalid(el) {
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => el.focus({ preventScroll: true }), 250);
}

window.nextStep = nextStep;
window.prevStep = prevStep;

// ==========================================
// ⭐ SINGLE FORM SUBMISSION HANDLER - SUPABASE VERSION
// ==========================================

document.getElementById("screeningForm").addEventListener("submit", async function(e) {
    e.preventDefault();

    // Validate all steps before collecting data (handles hidden-step fields)
    const allSteps = document.querySelectorAll('.form-step');
    let firstInvalidStep = null;
    let firstInvalidEl = null;
    let allValid = true;

    allSteps.forEach(stepEl => {
        const result = validateStep(stepEl);
        if (!result.valid) {
            allValid = false;
            if (!firstInvalidStep) {
                firstInvalidStep = stepEl;
                firstInvalidEl = result.firstInvalid;
            }
        }
    });

    if (!allValid) {
        const targetStepNum = parseInt(firstInvalidStep.id.replace('formStep', ''), 10);
        goToStep(targetStepNum);
        setTimeout(() => focusInvalid(firstInvalidEl), 300);
        return;
    }

    console.log('📋 Form submission started...');

    // ===== STEP 1: Collect Form Data =====
    const patientData = {
        name: document.getElementById('name').value,
        age: parseInt(document.getElementById('age').value),
        gender: document.getElementById('gender').value,
        height: parseFloat(document.getElementById('height').value),
        weight: parseFloat(document.getElementById('weight').value),
        bmi: calculateBMI(
            parseFloat(document.getElementById('weight').value),
            parseFloat(document.getElementById('height').value)
        ),
        waistCircumference: document.getElementById('waistCircumference').value ?
                           parseFloat(document.getElementById('waistCircumference').value) : null,
        diagnosed: {
            diabetes: document.getElementById('diabetes').value,
            hypertension: document.getElementById('hypertension').value
        },
        symptoms: {
            diabetes: {
                frequentUrination: document.getElementById('frequentUrination').checked,
                nocturia: document.getElementById('nocturia').checked,
                excessiveThirst: document.getElementById('excessiveThirst').checked,
                weightLoss: document.getElementById('weightLoss').checked,
                fatigue: document.getElementById('fatigue').checked,
                blurredVision: document.getElementById('blurredVision').checked
            },
            hypertension: {
                headache: document.getElementById('headache').checked,
                dizziness: document.getElementById('dizziness').checked,
                palpitations: document.getElementById('palpitations').checked,
                chestPain: document.getElementById('chestPain').checked,
                breathlessness: document.getElementById('breathlessness').checked
            }
        },
        additionalSymptoms: document.getElementById('additionalSymptoms').value,
        lifestyle: {
            physicalActivity: document.getElementById('physicalActivity').value,
            dietPattern: document.getElementById('dietPattern').value,
            smoking: document.getElementById('smoking').value,
            alcohol: document.getElementById('alcohol').value,
            familyHistory: document.getElementById('familyHistory').value
        },
        readings: {
            bloodSugar: document.getElementById('sugar').value ?
                        parseFloat(document.getElementById('sugar').value) : null,
            bloodPressure: document.getElementById('bp').value || null
        }
    };

    console.log('📊 Collected patient data:', patientData);

    // ===== STEP 2: Validate Form Data =====
    if (!validateFormData(patientData)) {
        console.error('❌ Validation failed');
        return;
    }

    console.log('✅ Validation passed');

    // ===== STEP 3: Show Saving Indicator =====
    const submitBtn = this.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>' + window.translator.t('btn_saving', 'Saving...');

    try {
        // ===== STEP 4: Compute risk snapshot before saving =====
        if (window.RiskCalculator) {
            const riskResult = window.RiskCalculator.assessHealthRisk(patientData);
            patientData.computedRiskScore = riskResult.combined?.score ?? null;
            patientData.diabetesRiskScore = riskResult.diabetes?.score ?? null;
            patientData.hypertensionRiskScore = riskResult.hypertension?.score ?? null;
            patientData.riskCategory = riskResult.combined?.category ?? null;
            patientData.algorithmVersion = window.RiskCalculator.version ?? null;
            patientData.languageAtScreening = (window.translator && window.translator.currentLang) || 'en';
        }

        // ===== STEP 5: Save to Supabase =====
        console.log('☁️ Saving to Supabase...');
        const result = await window.supabaseClient.saveScreening(patientData);

        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnText;

        if (result.success) {
            const source = result.source === 'supabase' ? '☁️ Cloud' : '💾 Local';
            console.log(`✅ Data saved successfully! Source: ${result.source}`);
            showNotification('success', window.translator.t('notification_screening_saved', 'Screening saved successfully! ({source})', { source }));

            // ===== STEP 5: Update Results Button =====
            await updateResultsButtonText();

            // ===== STEP 6: Reset Form After Delay =====
            setTimeout(() => {
                this.reset();

                if (charCount) {
                    charCount.textContent = '0 / 500';
                    charCount.style.color = '#6c757d';
                }

                const resultsBtn = document.getElementById('viewResultsBtn');
                if (resultsBtn) {
                    resultsBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }, 1500);
        } else {
            throw new Error(result.error || 'Save failed — please try again.');
        }
    } catch (error) {
        console.error('❌ Form submission error:', error);
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnText;
        showNotification('danger', window.translator.t('error_save_failed', 'Could not save screening. Please check your connection and try again.'));
    }
});

// ==========================================
// VIEW RESULTS NAVIGATION
// ==========================================

async function viewResults() {
    try {
        console.log('🔍 Checking for screening data...');

        const result = await window.supabaseClient.getLatestScreening();

        if (!result.success || !result.data) {
            showNotification('warning', window.translator.t('notification_no_screening_data', 'No screening data found. Please complete the health screening first.'));
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
        }

        console.log(`✅ Found screening data. Source: ${result.source}`);
        console.log('➡️ Navigating to results page...');
        window.location.href = 'result.html';

    } catch (error) {
        console.error('❌ Error checking patient data:', error);
        showNotification('danger', window.translator.t('error_loading_data', 'Error loading data. Please try again.'));
    }
}

window.viewResults = viewResults;

// ==========================================
// DYNAMIC BUTTON TEXT - SUPABASE VERSION
// ==========================================

async function updateResultsButtonText() {
    try {
        const result = await window.supabaseClient.getLatestScreening();

        const hintText = document.getElementById('resultsHintText');
        const btnText = document.getElementById('viewResultsBtnText');
        const hint = document.getElementById('viewResultsHint');
        const btn = document.getElementById('viewResultsBtn');

        if (!hintText || !btnText || !hint || !btn) return;

        if (result.success && result.data) {
            const date = new Date(result.data.timestamp).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric'
            });

            const sourceIcon = result.source === 'supabase' ? '☁️' : '💾';

            hintText.textContent = window.translator.t('hint_already_screened', 'Already screened?');
            btnText.textContent = window.translator.t('btn_view_results', 'View My Results');
            hint.innerHTML = `<i class="bi bi-clock-history"></i> ${window.translator.t('hint_last_screening', 'Last screening:')} ${date} ${sourceIcon}`;
            btn.classList.remove('btn-outline-info');
            btn.classList.add('btn-info', 'text-white');
            btn.disabled = false;
            btn.style.opacity = '1';
            btn.style.cursor = 'pointer';

            console.log('✅ Results button updated - screening available');
        } else {
            hintText.textContent = window.translator.t('hint_new_user', 'New to SwasthSathi?');
            btnText.textContent = window.translator.t('btn_complete_above', 'Complete Screening Above');
            hint.innerHTML = `<i class="bi bi-arrow-up-circle"></i> ${window.translator.t('hint_fill_form', 'Fill the form above to get your health risk assessment')}`;
            btn.classList.add('btn-outline-info');
            btn.classList.remove('btn-info', 'text-white');
            btn.disabled = true;
            btn.style.opacity = '0.6';
            btn.style.cursor = 'not-allowed';

            console.log('ℹ️ Results button updated - no screening data');
        }

    } catch (error) {
        console.error('Error updating button text:', error);
    }
}

// Call on page load
document.addEventListener('DOMContentLoaded', async () => {
    // Auth guard — screening requires a logged-in user
    if (window.supabaseClient) {
        const user = await window.supabaseClient.checkAuthState();
        if (!user) {
            window.location.href = 'login.html';
            return;
        }
    }
    updateResultsButtonText();
});

// ==========================================
// INITIALIZATION
// ==========================================

console.log('=== SwasthSathi Screening System ===');
console.log('Version: 1.3 - Fixed Flow & Single Handler');
console.log('OCR Processor:', window.OCRProcessor ? '✅ Loaded' : '❌ Not Found');
console.log('Medical Validator:', window.MedicalValidator ? '✅ Loaded' : '❌ Not Found');
console.log('Form Suggester:', window.FormSuggester ? '✅ Loaded' : '❌ Not Found');
console.log('Supabase Client:', window.supabaseClient ? '✅ Loaded' : '❌ Not Found');
console.log('=====================================');

console.log('%c🩺 SwasthSathi Screening Ready!', 'color: #10b981; font-size: 16px; font-weight: bold;');
