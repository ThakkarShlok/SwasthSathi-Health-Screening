/**
 * ============================================
 * FACTOR EXPLANATIONS
 * Maps risk factor strings (from risk-calculator.js topFactors)
 * to {title_key, context_key} pairs for i18n clinical context.
 * Used by result.js to render contributing factor cards.
 * ============================================
 */

const FACTOR_EXPLANATIONS = {
    // ===== AGE FACTORS =====
    'Age ≥50 years':     { title_key: 'factor_age_title', context_key: 'factor_age_context' },
    'Age 45-49 years':       { title_key: 'factor_age_title', context_key: 'factor_age_context' },
    'Age 40-44 years':       { title_key: 'factor_age_title', context_key: 'factor_age_context' },
    'Age 35-39 years':       { title_key: 'factor_age_title', context_key: 'factor_age_context' },
    'Age 30-34 years':       { title_key: 'factor_age_title', context_key: 'factor_age_context' },

    // ===== BMI FACTORS =====
    'Obesity (BMI ≥30)':                      { title_key: 'factor_obesity_title',    context_key: 'factor_obesity_context' },
    'Overweight Class II (BMI 27.5-29.9)':        { title_key: 'factor_overweight_title', context_key: 'factor_overweight_context' },
    'Overweight Class I (BMI 25-27.4)':           { title_key: 'factor_overweight_title', context_key: 'factor_overweight_context' },
    'Overweight (Asian cutoff, BMI 23-24.9)':     { title_key: 'factor_overweight_title', context_key: 'factor_overweight_context' },
    'Overweight Class II':                         { title_key: 'factor_overweight_title', context_key: 'factor_overweight_context' },
    'Overweight Class I':                          { title_key: 'factor_overweight_title', context_key: 'factor_overweight_context' },
    'Overweight (Asian cutoff)':                   { title_key: 'factor_overweight_title', context_key: 'factor_overweight_context' },

    // ===== ABDOMINAL OBESITY =====
    'Abdominal obesity': { title_key: 'factor_abdominal_obesity_title', context_key: 'factor_abdominal_obesity_context' },

    // ===== BLOOD SUGAR =====
    'Very high blood sugar (≥200 mg/dL)': { title_key: 'factor_blood_sugar_high_title',        context_key: 'factor_blood_sugar_high_context' },
    'High blood sugar (≥126 mg/dL)':      { title_key: 'factor_blood_sugar_high_title',        context_key: 'factor_blood_sugar_high_context' },
    'Pre-diabetes range (100-125 mg/dL)':      { title_key: 'factor_blood_sugar_prediabetes_title', context_key: 'factor_blood_sugar_prediabetes_context' },

    // ===== BLOOD PRESSURE =====
    'Hypertensive Crisis (≥180/120)':          { title_key: 'factor_blood_pressure_title', context_key: 'factor_blood_pressure_context' },
    'Stage 2 Hypertension (160-179/100-119)':      { title_key: 'factor_blood_pressure_title', context_key: 'factor_blood_pressure_context' },
    'Stage 1 Hypertension (140-159/90-99)':        { title_key: 'factor_blood_pressure_title', context_key: 'factor_blood_pressure_context' },
    'Elevated BP (130-139/80-89)':                 { title_key: 'factor_blood_pressure_title', context_key: 'factor_blood_pressure_context' },
    'Pre-hypertension (120-129/<80)':              { title_key: 'factor_blood_pressure_title', context_key: 'factor_blood_pressure_context' },

    // ===== PRIOR DIAGNOSIS =====
    'Previously diagnosed with diabetes':     { title_key: 'factor_diagnosed_diabetes_title',     context_key: 'factor_diagnosed_diabetes_context' },
    'Previously diagnosed with hypertension': { title_key: 'factor_diagnosed_hypertension_title', context_key: 'factor_diagnosed_hypertension_context' },

    // ===== FAMILY HISTORY =====
    'Family history of diabetes/hypertension': { title_key: 'factor_family_history_title', context_key: 'factor_family_history_context' },
    'Family history':                          { title_key: 'factor_family_history_title', context_key: 'factor_family_history_context' },

    // ===== LIFESTYLE =====
    'Sedentary lifestyle':          { title_key: 'factor_sedentary_title', context_key: 'factor_sedentary_context' },
    'High fat diet':                { title_key: 'factor_diet_title',      context_key: 'factor_diet_context' },
    'High fat/salt diet':           { title_key: 'factor_diet_title',      context_key: 'factor_diet_context' },
    'Smoking':                      { title_key: 'factor_smoking_title',   context_key: 'factor_smoking_context' },
    'Frequent alcohol consumption': { title_key: 'factor_alcohol_title',   context_key: 'factor_alcohol_context' },
};

// Pattern-based matching for dynamic factor strings (e.g., "3 diabetes symptoms present")
const FACTOR_PATTERNS = [
    {
        pattern: /diabetes symptoms?/i,
        title_key: 'factor_diabetes_symptoms_title',
        context_key: 'factor_diabetes_symptoms_context'
    },
    {
        pattern: /hypertension symptoms?/i,
        title_key: 'factor_htn_symptoms_title',
        context_key: 'factor_htn_symptoms_context'
    }
];

/**
 * Look up clinical explanation for a given factor string.
 * Tries exact match first, then pattern match.
 * @param {string} factorString - Factor string from risk-calculator topFactors
 * @returns {{ title_key: string, context_key: string } | null}
 */
function getFactorExplanation(factorString) {
    if (FACTOR_EXPLANATIONS[factorString]) {
        return FACTOR_EXPLANATIONS[factorString];
    }
    for (const p of FACTOR_PATTERNS) {
        if (p.pattern.test(factorString)) {
            return { title_key: p.title_key, context_key: p.context_key };
        }
    }
    return null;
}

window.FactorExplanations = { getFactorExplanation };

console.log('✓ Factor explanations loaded');
