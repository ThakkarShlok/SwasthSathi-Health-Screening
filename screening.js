/**
 * ============================================
 * SWASTHSATHI - COMPLETE SCREENING SYSTEM
 * Medical Report OCR + Smart Suggestions + Form Validation
 * Version: 1.2 - Fixed Dynamic Button Update
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
        alert('Please upload an image first');
        return;
    }

    processOCRBtn.style.display = 'none';
    ocrProgress.style.display = 'block';
    ocrResults.style.display = 'none';

    const updateProgress = (percent, status) => {
        ocrProgressBar.style.width = percent + '%';
        ocrProgressBar.setAttribute('aria-valuenow', percent);
        ocrStatus.textContent = status;
    };

    try {
        if (!window.OCRProcessor) {
            throw new Error('OCR module not loaded. Please refresh the page.');
        }

        const result = await window.OCRProcessor.processOCR(uploadedImage, updateProgress);

        if (!result.success) {
            throw new Error(result.error);
        }

        extractedTextEl.textContent = result.text || 'No text detected';
        const medicalValues = window.OCRProcessor.extractMedicalValues(result.text);
        window.OCRProcessor.displayExtractedValues(medicalValues);
        autoFillFormFieldsWithSuggestions(medicalValues);

        ocrProgress.style.display = 'none';
        ocrResults.style.display = 'block';
        ocrResults.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    } catch (error) {
        console.error('OCR processing failed:', error);
        alert('OCR processing failed: ' + error.message);
        ocrProgress.style.display = 'none';
        processOCRBtn.style.display = 'block';
    }
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
        showNotification('info', `Found ${suggestions.length} value(s) in your report. Review and accept/reject each suggestion below.`);
    } else if (suggestions.length > 0) {
        showNotification('success', 'Values extracted from report and auto-filled.');
    } else {
        showNotification('warning', 'Could not detect blood sugar or blood pressure values. Please enter manually.');
    }

    if (values.hba1c && window.MedicalValidator) {
        const validation = window.MedicalValidator.validateHbA1c(values.hba1c);
        showContextAlert('HbA1c detected', `Your HbA1c is ${values.hba1c}% - ${validation.message}`, validation.severity);
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
        showNotification('danger', 'Please enter a valid age (15-120 years)');
        return false;
    }

    if (data.bmi && (data.bmi < 10 || data.bmi > 60)) {
        showNotification('danger', 'Please check height and weight values. BMI seems incorrect.');
        return false;
    }

    if (data.readings.bloodPressure) {
        const bpPattern = /^\d{2,3}\/\d{2,3}$/;
        if (!bpPattern.test(data.readings.bloodPressure)) {
            showNotification('danger', 'Blood pressure format should be like 120/80');
            return false;
        }

        const [systolic, diastolic] = data.readings.bloodPressure.split('/').map(Number);
        if (systolic <= diastolic) {
            showNotification('danger', 'Systolic pressure (first number) must be higher than diastolic (second number)');
            return false;
        }
    }

    if (data.readings.bloodSugar) {
        const sugar = parseFloat(data.readings.bloodSugar);
        if (sugar < 30 || sugar > 600) {
            showNotification('danger', 'Blood sugar value seems incorrect. Please verify.');
            return false;
        }
    }

    return true;
}

function savePatientData(data) {
    try {
        let patients = JSON.parse(localStorage.getItem("swasthsathi_patients")) || [];
        data.id = Date.now();
        data.timestamp = new Date().toISOString();
        patients.push(data);
        localStorage.setItem("swasthsathi_patients", JSON.stringify(patients));
        console.log('Patient data saved successfully:', data.id);
        return true;
    } catch (error) {
        console.error('Error saving patient data:', error);
        showNotification('danger', 'Failed to save data. Please try again.');
        return false;
    }
}

function getAllPatients() {
    try {
        return JSON.parse(localStorage.getItem("swasthsathi_patients")) || [];
    } catch (error) {
        console.error('Error retrieving patient data:', error);
        return [];
    }
}

function getPatientById(id) {
    const patients = getAllPatients();
    return patients.find(p => p.id === id);
}

// ==========================================
// FORM SUBMISSION HANDLER - FIXED
// ==========================================

document.getElementById("screeningForm").addEventListener("submit", function(e) {
    e.preventDefault();

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

    if (!validateFormData(patientData)) {
        return;
    }

    const saved = savePatientData(patientData);

    if (saved) {
        showNotification('success', 'Patient screening saved successfully!');

        // ⭐ KEY FIX: Update button immediately
        updateResultsButtonText();

        setTimeout(() => {
            this.reset();
            
            if (charCount) {
                charCount.textContent = '0 / 500';
                charCount.style.color = '#6c757d';
            }
            
            // Scroll to results button
            const resultsBtn = document.getElementById('viewResultsBtn');
            if (resultsBtn) {
                resultsBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }, 1500);
    }
});

// ==========================================
// VIEW RESULTS NAVIGATION
// ==========================================

function viewResults() {
    try {
        const patientsData = localStorage.getItem('swasthsathi_patients');
        
        if (!patientsData) {
            showNotification('warning', 'No screening data found. Please complete the health screening first.');
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
        }

        const patients = JSON.parse(patientsData);
        
        if (!patients || patients.length === 0) {
            showNotification('warning', 'No screening data found. Please complete the health screening first.');
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
        }

        console.log(`✓ Navigating to results (${patients.length} screening(s) found)`);
        window.location.href = 'result.html';
        
    } catch (error) {
        console.error('Error checking patient data:', error);
        showNotification('danger', 'Error loading data. Please try again.');
    }
}

window.viewResults = viewResults;

// ==========================================
// DYNAMIC BUTTON TEXT
// ==========================================

function updateResultsButtonText() {
    try {
        const patientsData = localStorage.getItem('swasthsathi_patients');
        const patients = patientsData ? JSON.parse(patientsData) : [];
        
        const hintText = document.getElementById('resultsHintText');
        const btnText = document.getElementById('viewResultsBtnText');
        const hint = document.getElementById('viewResultsHint');
        const btn = document.getElementById('viewResultsBtn');
        
        if (!hintText || !btnText || !hint || !btn) return;
        
        if (patients.length > 0) {
            const lastPatient = patients[patients.length - 1];
            const date = new Date(lastPatient.timestamp).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric'
            });
            
            hintText.textContent = 'Already screened?';
            btnText.textContent = 'View My Results';
            hint.innerHTML = `<i class="bi bi-clock-history"></i> Last screening: ${date}`;
            btn.classList.remove('btn-outline-info');
            btn.classList.add('btn-info', 'text-white');
            btn.disabled = false;
            btn.style.opacity = '1';
            btn.style.cursor = 'pointer';
        } else {
            hintText.textContent = 'New to SwasthSathi?';
            btnText.textContent = 'Complete Screening Above';
            hint.innerHTML = `<i class="bi bi-arrow-up-circle"></i> Fill the form above to get your health risk assessment`;
            btn.classList.add('btn-outline-info');
            btn.classList.remove('btn-info', 'text-white');
            btn.disabled = true;
            btn.style.opacity = '0.6';
            btn.style.cursor = 'not-allowed';
        }
        
    } catch (error) {
        console.error('Error updating button text:', error);
    }
}

// Run on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', updateResultsButtonText);
} else {
    updateResultsButtonText();
}

// ==========================================
// KEYBOARD SHORTCUTS
// ==========================================

document.addEventListener('keydown', function(e) {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        const patients = getAllPatients();
        console.log('Stored Patient Data:', patients);
        console.log(`Total patients: ${patients.length}`);
    }
    
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'C') {
        e.preventDefault();
        if (confirm('Clear all patient data? This cannot be undone.')) {
            localStorage.removeItem('swasthsathi_patients');
            console.log('All patient data cleared');
            showNotification('info', 'All patient data has been cleared');
            updateResultsButtonText();
        }
    }
});

// ==========================================
// DEMO DATA FUNCTION (FOR JUDGES)
// ==========================================

function fillDemoData() {
    // Basic Info
    document.getElementById('name').value = 'Ramesh Kumar';
    document.getElementById('age').value = '22';
    document.getElementById('gender').value = 'Male';
    document.getElementById('height').value = '170';
    document.getElementById('weight').value = '65';
    
    // Waist Circumference
    document.getElementById('waistCircumference').value = '55';
    
    // Medical History
    document.getElementById('diabetes').value = 'No';
    document.getElementById('hypertension').value = 'No';
    
    // Diabetes Symptoms
    document.getElementById('frequentUrination').checked = true;
    document.getElementById('nocturia').checked = true;
    document.getElementById('fatigue').checked = true;
    
    // Hypertension Symptoms
    document.getElementById('headache').checked = true;
    document.getElementById('dizziness').checked = true;
    
    // Lifestyle
    document.getElementById('physicalActivity').value = 'Sedentary (office work, minimal activity)';
    document.getElementById('dietPattern').value = 'High fat diet (fried foods, processed foods, sweets)';
    document.getElementById('smoking').value = 'Yes';
    document.getElementById('alcohol').value = 'Occasionally';
    document.getElementById('familyHistory').value = 'Yes';
    
    // Readings
    document.getElementById('sugar').value = '92';
    document.getElementById('bp').value = '110/64';
    
    // Additional Symptoms
    document.getElementById('additionalSymptoms').value = 'Experiencing occasional chest discomfort and shortness of breath during physical activity. Also noticing increased thirst and frequent urination at night.';
    
    // Update character count
    const charCount = document.getElementById('charCount');
    if (charCount) {
        charCount.textContent = '198 / 500';
    }
    
    // Show success notification
    showNotification('success', '✓ Demo data loaded! Scroll down and click "Complete Screening"');
    
    // Scroll to submit button smoothly
    setTimeout(() => {
        document.querySelector('button[type="submit"]').scrollIntoView({ 
            behavior: 'smooth', 
            block: 'center' 
        });
    }, 500);
}

// Make function globally available
window.fillDemoData = fillDemoData;

console.log('✓ View Results function registered');
console.log('✓ Dynamic button text function registered');
console.log('✓ Demo data function registered'); // ADD THIS LINE

// ==========================================
// INITIALIZATION
// ==========================================

console.log('=== SwasthSathi Screening System ===');
console.log('Version: 1.2 - Fixed Dynamic Button');
console.log('OCR Processor:', window.OCRProcessor ? '✓ Loaded' : '✗ Not Found');
console.log('Medical Validator:', window.MedicalValidator ? '✓ Loaded' : '✗ Not Found');
console.log('Form Suggester:', window.FormSuggester ? '✓ Loaded' : '✗ Not Found');
console.log('=====================================');

console.log('%c🩺 Welcome to SwasthSathi!', 'color: #10b981; font-size: 16px; font-weight: bold;');
console.log('%cHealthcare screening made accessible for rural India', 'color: #6b7280; font-size: 12px;');
console.log('✓ View Results function registered');
console.log('✓ Dynamic button text function registered');