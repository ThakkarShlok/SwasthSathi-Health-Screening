/**
 * ============================================
 * MEDICAL VALUE VALIDATOR
 * Validates and categorizes health metrics
 * ============================================
 */

const MedicalValidator = {
    /**
     * Validate blood sugar value
     * @param {number} value - Blood sugar in mg/dL
     * @returns {Object} - Validation result with category
     */
    validateBloodSugar(value) {
        const val = parseFloat(value);

        // Range validation
        if (isNaN(val) || val < 30 || val > 600) {
            return {
                valid: false,
                category: 'invalid',
                message: 'Blood sugar value seems incorrect. Please verify.',
                severity: 'danger'
            };
        }

        // Categorization (based on ADA guidelines)
        if (val < 70) {
            return {
                valid: true,
                category: 'low',
                message: 'Low blood sugar (Hypoglycemia). Immediate attention needed.',
                severity: 'danger',
                riskLevel: 'high'
            };
        } else if (val >= 70 && val <= 100) {
            return {
                valid: true,
                category: 'normal',
                message: 'Normal fasting blood sugar.',
                severity: 'success',
                riskLevel: 'low'
            };
        } else if (val >= 101 && val <= 125) {
            return {
                valid: true,
                category: 'prediabetes',
                message: 'Pre-diabetes range. Lifestyle changes recommended.',
                severity: 'warning',
                riskLevel: 'medium'
            };
        } else if (val >= 126 && val <= 200) {
            return {
                valid: true,
                category: 'diabetes',
                message: 'Diabetes range. Medical consultation advised.',
                severity: 'danger',
                riskLevel: 'high'
            };
        } else {
            return {
                valid: true,
                category: 'very_high',
                message: 'Very high blood sugar. Urgent medical attention needed.',
                severity: 'danger',
                riskLevel: 'critical'
            };
        }
    },

    /**
     * Validate blood pressure value
     * @param {string} value - BP in format "120/80"
     * @returns {Object} - Validation result with category
     */
    validateBloodPressure(value) {
        // Parse BP value
        const match = value.match(/(\d{2,3})\s*[\/\-]\s*(\d{2,3})/);
        
        if (!match) {
            return {
                valid: false,
                category: 'invalid',
                message: 'Blood pressure format should be like 120/80',
                severity: 'danger'
            };
        }

        const systolic = parseInt(match[1]);
        const diastolic = parseInt(match[2]);

        // Range validation
        if (systolic < 70 || systolic > 250 || diastolic < 40 || diastolic > 150) {
            return {
                valid: false,
                category: 'invalid',
                message: 'Blood pressure values seem incorrect. Please verify.',
                severity: 'danger'
            };
        }

        // Logical validation (systolic should be higher)
        if (systolic <= diastolic) {
            return {
                valid: false,
                category: 'invalid',
                message: 'Systolic (first number) should be higher than diastolic (second number).',
                severity: 'danger'
            };
        }

        // Categorization (based on AHA guidelines)
        if (systolic < 90 || diastolic < 60) {
            return {
                valid: true,
                category: 'low',
                message: 'Low blood pressure (Hypotension). May need attention.',
                severity: 'warning',
                riskLevel: 'medium',
                systolic,
                diastolic
            };
        } else if (systolic < 120 && diastolic < 80) {
            return {
                valid: true,
                category: 'normal',
                message: 'Normal blood pressure.',
                severity: 'success',
                riskLevel: 'low',
                systolic,
                diastolic
            };
        } else if (systolic >= 120 && systolic <= 129 && diastolic < 80) {
            return {
                valid: true,
                category: 'elevated',
                message: 'Elevated blood pressure. Monitor regularly.',
                severity: 'warning',
                riskLevel: 'medium',
                systolic,
                diastolic
            };
        } else if ((systolic >= 130 && systolic <= 139) || (diastolic >= 80 && diastolic <= 89)) {
            return {
                valid: true,
                category: 'stage1_hypertension',
                message: 'Stage 1 Hypertension. Lifestyle changes recommended.',
                severity: 'warning',
                riskLevel: 'high',
                systolic,
                diastolic
            };
        } else if ((systolic >= 140 && systolic <= 180) || (diastolic >= 90 && diastolic <= 120)) {
            return {
                valid: true,
                category: 'stage2_hypertension',
                message: 'Stage 2 Hypertension. Medical consultation advised.',
                severity: 'danger',
                riskLevel: 'high',
                systolic,
                diastolic
            };
        } else {
            return {
                valid: true,
                category: 'hypertensive_crisis',
                message: 'Hypertensive Crisis! Seek immediate medical attention.',
                severity: 'danger',
                riskLevel: 'critical',
                systolic,
                diastolic
            };
        }
    },

    /**
     * Validate HbA1c value
     * @param {number} value - HbA1c percentage
     * @returns {Object} - Validation result
     */
    validateHbA1c(value) {
        const val = parseFloat(value);

        if (isNaN(val) || val < 3 || val > 20) {
            return {
                valid: false,
                category: 'invalid',
                message: 'HbA1c value seems incorrect.',
                severity: 'danger'
            };
        }

        if (val < 5.7) {
            return {
                valid: true,
                category: 'normal',
                message: 'Normal HbA1c (No diabetes).',
                severity: 'success',
                riskLevel: 'low'
            };
        } else if (val >= 5.7 && val <= 6.4) {
            return {
                valid: true,
                category: 'prediabetes',
                message: 'Pre-diabetes range.',
                severity: 'warning',
                riskLevel: 'medium'
            };
        } else {
            return {
                valid: true,
                category: 'diabetes',
                message: 'Diabetes range.',
                severity: 'danger',
                riskLevel: 'high'
            };
        }
    },

    /**
     * Get BMI category
     * @param {number} bmi - Calculated BMI
     * @returns {Object} - BMI category info
     */
    getBMICategory(bmi) {
        if (bmi < 18.5) {
            return {
                category: 'underweight',
                message: 'Underweight',
                severity: 'warning',
                riskLevel: 'medium'
            };
        } else if (bmi >= 18.5 && bmi < 23) {
            // Using Asian BMI cutoffs
            return {
                category: 'normal',
                message: 'Normal weight',
                severity: 'success',
                riskLevel: 'low'
            };
        } else if (bmi >= 23 && bmi < 25) {
            return {
                category: 'overweight',
                message: 'Overweight',
                severity: 'warning',
                riskLevel: 'medium'
            };
        } else if (bmi >= 25 && bmi < 30) {
            return {
                category: 'obese_1',
                message: 'Obese (Class I)',
                severity: 'warning',
                riskLevel: 'high'
            };
        } else if (bmi >= 30 && bmi < 35) {
            return {
                category: 'obese_2',
                message: 'Obese (Class II)',
                severity: 'danger',
                riskLevel: 'high'
            };
        } else {
            return {
                category: 'obese_3',
                message: 'Obese (Class III) - Morbid Obesity',
                severity: 'danger',
                riskLevel: 'critical'
            };
        }
    }
};

// Export for use in other modules
window.MedicalValidator = MedicalValidator;