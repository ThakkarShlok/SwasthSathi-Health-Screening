/**
 * ============================================
 * OCR MEDICAL REPORT PARSER
 * Client-side text extraction and parsing
 * ============================================
 */

// ==========================================
// CONSTANTS & CONFIGURATION
// ==========================================

const OCR_CONFIG = {
    // Tesseract.js language (English for medical reports)
    language: 'eng',
    
    // File upload limits
    maxFileSize: 10 * 1024 * 1024, // 10MB
    allowedTypes: ['image/jpeg', 'image/png', 'image/jpg'],
    
    // OCR confidence threshold (0-1)
    confidenceThreshold: 0.6
};

// ==========================================
// REGEX PATTERNS FOR VALUE EXTRACTION
// ==========================================

/**
 * Medical value patterns
 * These patterns detect common formats in Indian medical reports
 */
const PATTERNS = {
    // Blood Sugar Patterns
    // Matches: "Blood Sugar: 120", "Glucose 105 mg/dl", "FBS: 95", etc.
    bloodSugar: [
        /(?:blood\s*sugar|glucose|fbs|fasting\s*blood\s*sugar|ppbs|random\s*blood\s*sugar|rbs)[\s:]*(\d{2,3})\s*(?:mg\/dl)?/gi,
        /(?:sugar|glucose)[\s:]*(\d{2,3})/gi
    ],
    
    // Blood Pressure Patterns
    // Matches: "BP: 120/80", "Blood Pressure 130/85 mmHg", "BP:140/90", etc.
    bloodPressure: [
        /(?:blood\s*pressure|bp)[\s:]*(\d{2,3})\s*[\/\-]\s*(\d{2,3})\s*(?:mmhg)?/gi,
        /(\d{2,3})\s*[\/\-]\s*(\d{2,3})\s*(?:mmhg|mm\s*hg)/gi
    ],
    
    // HbA1c Pattern
    hba1c: [
        /(?:hba1c|hb\s*a1c|glycosylated\s*hemoglobin)[\s:]*(\d{1,2}\.?\d?)\s*%?/gi
    ],
    
    // Cholesterol (bonus - can be useful)
    cholesterol: [
        /(?:cholesterol|total\s*cholesterol)[\s:]*(\d{2,3})\s*(?:mg\/dl)?/gi
    ]
};

// ==========================================
// MAIN OCR PROCESSING FUNCTION
// ==========================================

/**
 * Process uploaded image with Tesseract.js
 * @param {File} imageFile - The uploaded image file
 * @param {Function} progressCallback - Callback for progress updates
 * @returns {Promise<Object>} - OCR results
 */
async function processOCR(imageFile, progressCallback) {
    try {
        // Validate file
        if (!validateFile(imageFile)) {
            throw new Error('Invalid file type or size');
        }

        // Initialize Tesseract worker
        const worker = await Tesseract.createWorker(OCR_CONFIG.language, 1, {
            logger: (m) => {
                // Update progress based on Tesseract status
                if (m.status === 'recognizing text') {
                    const progress = Math.round(m.progress * 100);
                    progressCallback(progress, 'Recognizing text...');
                } else if (m.status === 'loading tesseract core') {
                    progressCallback(10, 'Loading OCR engine...');
                } else if (m.status === 'initializing tesseract') {
                    progressCallback(20, 'Initializing...');
                } else if (m.status === 'loading language traineddata') {
                    progressCallback(30, 'Loading language data...');
                } else if (m.status === 'initializing api') {
                    progressCallback(40, 'Preparing OCR...');
                }
            }
        });

        // Process the image
        progressCallback(50, 'Processing image...');
        const { data } = await worker.recognize(imageFile);
        
        // Cleanup
        await worker.terminate();
        
        progressCallback(100, 'Complete!');

        return {
            success: true,
            text: data.text,
            confidence: data.confidence,
            lines: data.lines
        };

    } catch (error) {
        console.error('OCR Error:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// ==========================================
// FILE VALIDATION
// ==========================================

/**
 * Validate uploaded file
 * @param {File} file - File to validate
 * @returns {boolean}
 */
function validateFile(file) {
    // Check file size
    if (file.size > OCR_CONFIG.maxFileSize) {
        alert(`File too large. Maximum size is ${OCR_CONFIG.maxFileSize / 1024 / 1024}MB`);
        return false;
    }

    // Check file type
    if (!OCR_CONFIG.allowedTypes.includes(file.type)) {
        alert('Please upload a JPG or PNG image');
        return false;
    }

    return true;
}

// ==========================================
// MEDICAL VALUE EXTRACTION
// ==========================================

/**
 * Extract medical values from OCR text
 * @param {string} text - Extracted text from OCR
 * @returns {Object} - Parsed medical values
 */
function extractMedicalValues(text) {
    const results = {
        bloodSugar: null,
        bloodPressure: null,
        hba1c: null,
        cholesterol: null,
        rawMatches: []
    };

    // Clean the text (remove extra spaces, normalize)
    const cleanText = text.replace(/\s+/g, ' ').trim();

    // ===== Extract Blood Sugar =====
    for (const pattern of PATTERNS.bloodSugar) {
        const match = pattern.exec(cleanText);
        if (match && match[1]) {
            const value = parseInt(match[1]);
            // Sanity check (blood sugar typically 50-400 mg/dL)
            if (value >= 50 && value <= 400) {
                results.bloodSugar = value;
                results.rawMatches.push({
                    type: 'Blood Sugar',
                    value: value,
                    unit: 'mg/dL',
                    original: match[0]
                });
                break; // Take first valid match
            }
        }
    }

    // ===== Extract Blood Pressure =====
    for (const pattern of PATTERNS.bloodPressure) {
        const match = pattern.exec(cleanText);
        if (match && match[1] && match[2]) {
            const systolic = parseInt(match[1]);
            const diastolic = parseInt(match[2]);
            
            // Sanity check (typical ranges: 90-200 / 60-120)
            if (systolic >= 90 && systolic <= 200 && 
                diastolic >= 60 && diastolic <= 120) {
                results.bloodPressure = `${systolic}/${diastolic}`;
                results.rawMatches.push({
                    type: 'Blood Pressure',
                    value: `${systolic}/${diastolic}`,
                    unit: 'mmHg',
                    original: match[0]
                });
                break;
            }
        }
    }

    // ===== Extract HbA1c (Bonus) =====
    for (const pattern of PATTERNS.hba1c) {
        const match = pattern.exec(cleanText);
        if (match && match[1]) {
            const value = parseFloat(match[1]);
            // Sanity check (HbA1c typically 4-14%)
            if (value >= 4 && value <= 14) {
                results.hba1c = value;
                results.rawMatches.push({
                    type: 'HbA1c',
                    value: value,
                    unit: '%',
                    original: match[0]
                });
                break;
            }
        }
    }

    // ===== Extract Cholesterol (Bonus) =====
    for (const pattern of PATTERNS.cholesterol) {
        const match = pattern.exec(cleanText);
        if (match && match[1]) {
            const value = parseInt(match[1]);
            // Sanity check (cholesterol typically 100-400 mg/dL)
            if (value >= 100 && value <= 400) {
                results.cholesterol = value;
                results.rawMatches.push({
                    type: 'Cholesterol',
                    value: value,
                    unit: 'mg/dL',
                    original: match[0]
                });
                break;
            }
        }
    }

    return results;
}

// ==========================================
// UI HELPER FUNCTIONS
// ==========================================

/**
 * Display extracted values in UI
 * @param {Object} values - Extracted medical values
 */
function displayExtractedValues(values) {
    const container = document.getElementById('detectedValues');
    if (!container) return;

    let html = '';

    if (values.rawMatches.length === 0) {
        html = `
            <div class="alert alert-warning">
                <i class="bi bi-exclamation-triangle"></i>
                <strong>No medical values detected.</strong> 
                The image quality might be poor or values are not in a recognizable format.
                Please enter values manually below.
            </div>
        `;
    } else {
        html = '<div class="row g-3">';
        
        values.rawMatches.forEach(match => {
            html += `
                <div class="col-md-6">
                    <div class="detected-value-item">
                        <div class="value-label">${match.type}</div>
                        <div class="value-data">
                            <i class="bi bi-check-circle-fill"></i>
                            <span>${match.value} ${match.unit}</span>
                        </div>
                        <div class="value-action">
                            <small class="text-muted">
                                <i class="bi bi-arrow-down-circle"></i> 
                                Will be filled in form below
                            </small>
                        </div>
                    </div>
                </div>
            `;
        });
        
        html += '</div>';
    }

    container.innerHTML = html;
}

/**
 * Auto-fill form fields with SMART suggestions
 * @param {Object} values - Extracted medical values
 */
function autoFillFormFields(values) {
    const suggestions = [];

    // === Blood Sugar Suggestion ===
    if (values.bloodSugar) {
        const validation = window.MedicalValidator.validateBloodSugar(values.bloodSugar);
        
        suggestions.push({
            fieldId: 'sugar',
            value: values.bloodSugar,
            validation: validation
        });
    }

    // === Blood Pressure Suggestion ===
    if (values.bloodPressure) {
        const validation = window.MedicalValidator.validateBloodPressure(values.bloodPressure);
        
        suggestions.push({
            fieldId: 'bp',
            value: values.bloodPressure,
            validation: validation
        });
    }

    // === Batch suggest all values ===
    if (suggestions.length > 0) {
        window.FormSuggester.suggestMultipleValues(suggestions);
        
        // Show summary notification
        showNotification(
            'info',
            `Found ${suggestions.length} value(s) in your report. Review and accept/reject each suggestion below.`
        );
    } else {
        showNotification(
            'warning',
            'Could not detect blood sugar or blood pressure values. Please enter manually.'
        );
    }

    // === Additional context for HbA1c ===
    if (values.hba1c) {
        const validation = window.MedicalValidator.validateHbA1c(values.hba1c);
        showContextAlert('HbA1c detected', `Your HbA1c is ${values.hba1c}% - ${validation.message}`, validation.severity);
    }
}

/**
 * Show contextual alert
 */
function showContextAlert(title, message, type) {
    const alert = document.createElement('div');
    alert.className = `alert alert-${type} mt-3`;
    alert.innerHTML = `
        <strong><i class="bi bi-lightbulb-fill"></i> ${title}:</strong> ${message}
    `;
    
    document.getElementById('ocrResults').appendChild(alert);
}

/**
 * Show notification (helper function)
 */
function showNotification(type, message) {
    // This function should be defined in screening.js
    // Adding fallback here for safety
    if (typeof window.showNotification === 'function') {
        window.showNotification(type, message);
    } else {
        console.log(`[${type.toUpperCase()}] ${message}`);
    }
}

// ==========================================
// EXPORT FUNCTIONS
// ==========================================

// Make functions available globally
window.OCRProcessor = {
    processOCR,
    extractMedicalValues,
    displayExtractedValues,
    validateFile,
    autoFillFormFields
};

console.log('✓ OCR Parser module loaded successfully');