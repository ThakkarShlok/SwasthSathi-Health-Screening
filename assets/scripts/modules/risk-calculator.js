/**
 * ============================================
 * SWASTHSATHI RISK CALCULATOR
 * Evidence-based diabetes & hypertension screening
 * Based on NFHS-5 data and clinical guidelines
 * ============================================
 */

const ALGORITHM_VERSION = 'rule-v1.4';

// ==========================================
// DIABETES RISK CALCULATION
// ==========================================

/**
 * Calculate Diabetes Risk Score (0-100)
 * Based on NFHS-5 data (OR: Odds Ratios from research)
 */
function calculateDiabetesRisk(patientData) {
    let score = 0;
    let factors = [];
    let factorContributions = [];
    let confidence = 'Medium';

    // ===== AGE FACTOR (Max 30 points) =====
    // Evidence: OR 14.46 for age >50
    if (patientData.age >= 50) {
        score += 30;
        factors.push({ factor: 'Age ≥50 years', points: 30, severity: 'high' });
        factorContributions.push({ id: 'age_50_plus', label: 'Age ≥50 years', points: 30, category: 'non_modifiable', direction: 'positive' });
    } else if (patientData.age >= 45) {
        score += 25;
        factors.push({ factor: 'Age 45-49 years', points: 25, severity: 'high' });
        factorContributions.push({ id: 'age_45_49', label: 'Age 45-49 years', points: 25, category: 'non_modifiable', direction: 'positive' });
    } else if (patientData.age >= 40) {
        score += 20;
        factors.push({ factor: 'Age 40-44 years', points: 20, severity: 'medium' });
        factorContributions.push({ id: 'age_40_44', label: 'Age 40-44 years', points: 20, category: 'non_modifiable', direction: 'positive' });
    } else if (patientData.age >= 35) {
        score += 12;
        factors.push({ factor: 'Age 35-39 years', points: 12, severity: 'medium' });
        factorContributions.push({ id: 'age_35_39', label: 'Age 35-39 years', points: 12, category: 'non_modifiable', direction: 'positive' });
    } else if (patientData.age >= 30) {
        score += 6;
        factors.push({ factor: 'Age 30-34 years', points: 6, severity: 'low' });
        factorContributions.push({ id: 'age_30_34', label: 'Age 30-34 years', points: 6, category: 'non_modifiable', direction: 'positive' });
    }

    // ===== BMI FACTOR (Max 25 points) =====
    // Evidence: OR 12.39 for BMI >30
    if (patientData.bmi >= 30) {
        score += 25;
        factors.push({ factor: 'Obesity (BMI ≥30)', points: 25, severity: 'high' });
        factorContributions.push({ id: 'bmi_obese', label: 'Obesity (BMI ≥30)', points: 25, category: 'modifiable', direction: 'positive' });
    } else if (patientData.bmi >= 27.5) {
        score += 20;
        factors.push({ factor: 'Overweight Class II (BMI 27.5-29.9)', points: 20, severity: 'high' });
        factorContributions.push({ id: 'bmi_overweight_class_ii', label: 'Overweight Class II (BMI 27.5-29.9)', points: 20, category: 'modifiable', direction: 'positive' });
    } else if (patientData.bmi >= 25) {
        score += 15;
        factors.push({ factor: 'Overweight Class I (BMI 25-27.4)', points: 15, severity: 'medium' });
        factorContributions.push({ id: 'bmi_overweight_class_i', label: 'Overweight Class I (BMI 25-27.4)', points: 15, category: 'modifiable', direction: 'positive' });
    } else if (patientData.bmi >= 23) {
        score += 8;
        factors.push({ factor: 'Overweight (Asian cutoff, BMI 23-24.9)', points: 8, severity: 'medium' });
        factorContributions.push({ id: 'bmi_overweight_asian', label: 'Overweight (Asian cutoff, BMI 23-24.9)', points: 8, category: 'modifiable', direction: 'positive' });
    }

    // ===== WAIST CIRCUMFERENCE (Max 15 points) =====
    // Evidence: 60.5% co-occurrence with abdominal obesity
    if (patientData.waistCircumference) {
        const waistThreshold = patientData.gender === 'Male' ? 90 : 80;
        if (patientData.waistCircumference >= waistThreshold) {
            score += 15;
            factors.push({ factor: 'Abdominal obesity', points: 15, severity: 'high' });
            factorContributions.push({ id: 'abdominal_obesity', label: 'Abdominal obesity', points: 15, category: 'modifiable', direction: 'positive' });
        }
    }

    // ===== GLYCEMIC MARKER: HbA1c or BLOOD SUGAR (Max 40 points) =====
    // HbA1c is a 3-month average and takes priority over a single blood sugar
    // reading when both are present, to avoid double-counting the same signal.
    let bloodSugarPoints = 0;
    let bloodSugarFactor = null;
    if (patientData.readings.bloodSugar) {
        const sugar = parseFloat(patientData.readings.bloodSugar);
        if (sugar >= 200) {
            bloodSugarPoints = 40;
            bloodSugarFactor = { factor: 'Very high blood sugar (≥200 mg/dL)', points: 40, severity: 'critical', id: 'blood_sugar_very_high' };
        } else if (sugar >= 126) {
            bloodSugarPoints = 35;
            bloodSugarFactor = { factor: 'High blood sugar (≥126 mg/dL)', points: 35, severity: 'high', id: 'blood_sugar_high' };
        } else if (sugar >= 100) {
            bloodSugarPoints = 15;
            bloodSugarFactor = { factor: 'Pre-diabetes range (100-125 mg/dL)', points: 15, severity: 'medium', id: 'blood_sugar_prediabetes' };
        }
    }

    let hba1cPoints = 0;
    let hba1cFactor = null;
    if (patientData.readings?.hba1c) {
        const hba1c = parseFloat(patientData.readings.hba1c);
        if (hba1c >= 6.5) {
            hba1cPoints = 35;
            hba1cFactor = { factor: 'HbA1c ≥6.5% (diabetes range)', points: 35, severity: 'high', id: 'hba1c_diabetes' };
        } else if (hba1c >= 5.7 && hba1c <= 6.4) {
            hba1cPoints = 18;
            hba1cFactor = { factor: 'HbA1c 5.7-6.4% (prediabetes)', points: 18, severity: 'medium', id: 'hba1c_prediabetes' };
        }
    }

    const glycemicFactor = hba1cPoints > 0 ? hba1cFactor : bloodSugarFactor;
    const glycemicPoints = hba1cPoints > 0 ? hba1cPoints : bloodSugarPoints;

    if (glycemicFactor) {
        score += glycemicPoints;
        factors.push({ factor: glycemicFactor.factor, points: glycemicFactor.points, severity: glycemicFactor.severity });
        factorContributions.push({ id: glycemicFactor.id, label: glycemicFactor.factor, points: glycemicFactor.points, category: 'clinical', direction: 'positive' });
        if (glycemicFactor.severity === 'critical' || glycemicFactor.severity === 'high') confidence = 'High';
    }

    // ===== PRIOR DIAGNOSIS (Max 50 points) =====
    if (patientData.diagnosed.diabetes === 'Yes') {
        score += 50;
        factors.push({ factor: 'Previously diagnosed with diabetes', points: 50, severity: 'critical' });
        factorContributions.push({ id: 'diagnosed_diabetes', label: 'Previously diagnosed with diabetes', points: 50, category: 'non_modifiable', direction: 'positive' });
        confidence = 'High';
    }

    // ===== SYMPTOMS CLUSTER (Max 20 points) =====
    let symptomCount = 0;
    const diabetesSymptoms = patientData.symptoms.diabetes;

    if (diabetesSymptoms.frequentUrination) { symptomCount++; score += 4; }
    if (diabetesSymptoms.nocturia) { symptomCount++; score += 5; }
    if (diabetesSymptoms.excessiveThirst) { symptomCount++; score += 4; }
    if (diabetesSymptoms.weightLoss) { symptomCount++; score += 5; }
    if (diabetesSymptoms.fatigue) { symptomCount++; score += 3; }
    if (diabetesSymptoms.blurredVision) { symptomCount++; score += 4; }

    if (symptomCount >= 3) {
        factors.push({ factor: `${symptomCount} diabetes symptoms present`, points: symptomCount * 4, severity: 'high' });
        factorContributions.push({ id: 'diabetes_symptoms', label: `${symptomCount} diabetes symptoms present`, points: symptomCount * 4, category: 'clinical', direction: 'positive' });
    } else if (symptomCount > 0) {
        factors.push({ factor: `${symptomCount} diabetes symptom(s)`, points: symptomCount * 4, severity: 'medium' });
        factorContributions.push({ id: 'diabetes_symptoms', label: `${symptomCount} diabetes symptom(s)`, points: symptomCount * 4, category: 'clinical', direction: 'positive' });
    }

    // ===== FAMILY HISTORY (Max 12 points) =====
    if (patientData.lifestyle.familyHistory === 'Yes') {
        score += 12;
        factors.push({ factor: 'Family history of diabetes/hypertension', points: 12, severity: 'medium' });
        factorContributions.push({ id: 'family_history', label: 'Family history of diabetes/hypertension', points: 12, category: 'non_modifiable', direction: 'positive' });
    }

    // ===== LIFESTYLE FACTORS (Max 15 points) =====
    if (patientData.lifestyle.physicalActivity === 'Sedentary (office work, minimal activity)') {
        score += 8;
        factors.push({ factor: 'Sedentary lifestyle', points: 8, severity: 'medium' });
        factorContributions.push({ id: 'sedentary', label: 'Sedentary lifestyle', points: 8, category: 'modifiable', direction: 'positive' });
    }

    if (patientData.lifestyle.dietPattern === 'High fat diet (fried foods, processed foods, sweets)') {
        score += 7;
        factors.push({ factor: 'High fat diet', points: 7, severity: 'medium' });
        factorContributions.push({ id: 'high_fat_diet', label: 'High fat diet', points: 7, category: 'modifiable', direction: 'positive' });
    }

    if (patientData.lifestyle.smoking === 'Yes') {
        score += 5;
        factors.push({ factor: 'Smoking', points: 5, severity: 'medium' });
        factorContributions.push({ id: 'smoking', label: 'Smoking', points: 5, category: 'modifiable', direction: 'positive' });
    }

    if (patientData.lifestyle.alcohol === 'Frequently') {
        score += 5;
        factors.push({ factor: 'Frequent alcohol consumption', points: 5, severity: 'medium' });
        factorContributions.push({ id: 'frequent_alcohol', label: 'Frequent alcohol consumption', points: 5, category: 'modifiable', direction: 'positive' });
    }

    // ===== GENDER ADJUSTMENT =====
    // Not added to `factors`/topFactors (preserves v1.3 topFactors output exactly);
    // recorded only in factorContributions since it does contribute score points.
    if (patientData.gender === 'Male') {
        score += 3;
        factorContributions.push({ id: 'gender_male', label: 'Male gender', points: 3, category: 'non_modifiable', direction: 'positive' });
    }

    // Cap score at 100
    score = Math.min(score, 100);

    // Sort factors by points and take top 3
    const topFactors = factors
        .sort((a, b) => b.points - a.points)
        .slice(0, 3)
        .map(f => f.factor);

    // Determine risk category
    let category, color, urgency;
    if (score >= 70) {
        category = 'Critical Risk';
        color = 'danger';
        urgency = 'urgent';
    } else if (score >= 45) {
        category = 'High Risk';
        color = 'danger';
        urgency = 'high';
    } else if (score >= 25) {
        category = 'Moderate Risk';
        color = 'warning';
        urgency = 'medium';
    } else {
        category = 'Low Risk';
        color = 'success';
        urgency = 'low';
    }

    return {
        score: Math.round(score),
        category,
        risk: category,
        color,
        urgency,
        topFactors,
        confidence,
        allFactors: factors,
        factorContributions
    };
}

// ==========================================
// HYPERTENSION RISK CALCULATION
// ==========================================

/**
 * Calculate Hypertension Risk Score (0-100)
 * Based on JNC-8/ESC guidelines and NFHS-5 data
 */
function calculateHypertensionRisk(patientData) {
    let score = 0;
    let factors = [];
    let factorContributions = [];
    let confidence = 'Medium';

    // ===== AGE FACTOR (Max 30 points) =====
    // Evidence: OR 16.65 for age >50
    if (patientData.age >= 50) {
        score += 30;
        factors.push({ factor: 'Age ≥50 years', points: 30, severity: 'high' });
        factorContributions.push({ id: 'age_50_plus', label: 'Age ≥50 years', points: 30, category: 'non_modifiable', direction: 'positive' });
    } else if (patientData.age >= 45) {
        score += 25;
        factors.push({ factor: 'Age 45-49 years', points: 25, severity: 'high' });
        factorContributions.push({ id: 'age_45_49', label: 'Age 45-49 years', points: 25, category: 'non_modifiable', direction: 'positive' });
    } else if (patientData.age >= 40) {
        score += 18;
        factors.push({ factor: 'Age 40-44 years', points: 18, severity: 'medium' });
        factorContributions.push({ id: 'age_40_44', label: 'Age 40-44 years', points: 18, category: 'non_modifiable', direction: 'positive' });
    } else if (patientData.age >= 35) {
        score += 10;
        factors.push({ factor: 'Age 35-39 years', points: 10, severity: 'medium' });
        factorContributions.push({ id: 'age_35_39', label: 'Age 35-39 years', points: 10, category: 'non_modifiable', direction: 'positive' });
    } else if (patientData.age >= 30) {
        score += 5;
        factors.push({ factor: 'Age 30-34 years', points: 5, severity: 'low' });
        factorContributions.push({ id: 'age_30_34', label: 'Age 30-34 years', points: 5, category: 'non_modifiable', direction: 'positive' });
    }

    // ===== BMI FACTOR (Max 20 points) =====
    // Evidence: OR 7.36 for BMI >30
    if (patientData.bmi >= 30) {
        score += 20;
        factors.push({ factor: 'Obesity (BMI ≥30)', points: 20, severity: 'high' });
        factorContributions.push({ id: 'bmi_obese', label: 'Obesity (BMI ≥30)', points: 20, category: 'modifiable', direction: 'positive' });
    } else if (patientData.bmi >= 27.5) {
        score += 16;
        factors.push({ factor: 'Overweight Class II', points: 16, severity: 'high' });
        factorContributions.push({ id: 'bmi_overweight_class_ii', label: 'Overweight Class II', points: 16, category: 'modifiable', direction: 'positive' });
    } else if (patientData.bmi >= 25) {
        score += 12;
        factors.push({ factor: 'Overweight Class I', points: 12, severity: 'medium' });
        factorContributions.push({ id: 'bmi_overweight_class_i', label: 'Overweight Class I', points: 12, category: 'modifiable', direction: 'positive' });
    } else if (patientData.bmi >= 23) {
        score += 6;
        factors.push({ factor: 'Overweight (Asian cutoff)', points: 6, severity: 'medium' });
        factorContributions.push({ id: 'bmi_overweight_asian', label: 'Overweight (Asian cutoff)', points: 6, category: 'modifiable', direction: 'positive' });
    }

    // ===== BLOOD PRESSURE READING (Max 45 points) =====
    if (patientData.readings.bloodPressure) {
        const [systolic, diastolic] = patientData.readings.bloodPressure
            .split('/')
            .map(v => parseInt(v.trim()));

        if (systolic >= 180 || diastolic >= 120) {
            score += 45;
            factors.push({ factor: 'Hypertensive Crisis (≥180/120)', points: 45, severity: 'critical' });
            factorContributions.push({ id: 'bp_crisis', label: 'Hypertensive Crisis (≥180/120)', points: 45, category: 'clinical', direction: 'positive' });
            confidence = 'High';
        } else if (systolic >= 160 || diastolic >= 100) {
            score += 40;
            factors.push({ factor: 'Stage 2 Hypertension (160-179/100-119)', points: 40, severity: 'critical' });
            factorContributions.push({ id: 'bp_stage_2', label: 'Stage 2 Hypertension (160-179/100-119)', points: 40, category: 'clinical', direction: 'positive' });
            confidence = 'High';
        } else if (systolic >= 140 || diastolic >= 90) {
            score += 35;
            factors.push({ factor: 'Stage 1 Hypertension (140-159/90-99)', points: 35, severity: 'high' });
            factorContributions.push({ id: 'bp_stage_1', label: 'Stage 1 Hypertension (140-159/90-99)', points: 35, category: 'clinical', direction: 'positive' });
            confidence = 'High';
        } else if (systolic >= 130 || diastolic >= 80) {
            score += 20;
            factors.push({ factor: 'Elevated BP (130-139/80-89)', points: 20, severity: 'medium' });
            factorContributions.push({ id: 'bp_elevated', label: 'Elevated BP (130-139/80-89)', points: 20, category: 'clinical', direction: 'positive' });
        } else if (systolic >= 120) {
            score += 10;
            factors.push({ factor: 'Pre-hypertension (120-129/<80)', points: 10, severity: 'low' });
            factorContributions.push({ id: 'bp_prehypertension', label: 'Pre-hypertension (120-129/<80)', points: 10, category: 'clinical', direction: 'positive' });
        }
    }

    // ===== PRIOR DIAGNOSIS (Max 50 points) =====
    if (patientData.diagnosed.hypertension === 'Yes') {
        score += 50;
        factors.push({ factor: 'Previously diagnosed with hypertension', points: 50, severity: 'critical' });
        factorContributions.push({ id: 'diagnosed_hypertension', label: 'Previously diagnosed with hypertension', points: 50, category: 'non_modifiable', direction: 'positive' });
        confidence = 'High';
    }

    // ===== SYMPTOMS CLUSTER (Max 15 points) =====
    let symptomCount = 0;
    const htnSymptoms = patientData.symptoms.hypertension;

    if (htnSymptoms.headache) { symptomCount++; score += 3; }
    if (htnSymptoms.dizziness) { symptomCount++; score += 4; }
    if (htnSymptoms.palpitations) { symptomCount++; score += 4; }
    if (htnSymptoms.chestPain) { symptomCount++; score += 5; }
    if (htnSymptoms.breathlessness) { symptomCount++; score += 4; }

    if (symptomCount >= 2) {
        factors.push({ factor: `${symptomCount} hypertension symptoms`, points: Math.round(symptomCount * 3.5), severity: 'high' });
        factorContributions.push({ id: 'hypertension_symptoms', label: `${symptomCount} hypertension symptoms`, points: Math.round(symptomCount * 3.5), category: 'clinical', direction: 'positive' });
    } else if (symptomCount > 0) {
        factors.push({ factor: `${symptomCount} hypertension symptom(s)`, points: Math.round(symptomCount * 3.5), severity: 'medium' });
        factorContributions.push({ id: 'hypertension_symptoms', label: `${symptomCount} hypertension symptom(s)`, points: Math.round(symptomCount * 3.5), category: 'clinical', direction: 'positive' });
    }

    // ===== FAMILY HISTORY (Max 10 points) =====
    if (patientData.lifestyle.familyHistory === 'Yes') {
        score += 10;
        factors.push({ factor: 'Family history', points: 10, severity: 'medium' });
        factorContributions.push({ id: 'family_history', label: 'Family history', points: 10, category: 'non_modifiable', direction: 'positive' });
    }

    // ===== LIFESTYLE FACTORS (Max 18 points) =====
    if (patientData.lifestyle.physicalActivity === 'Sedentary (office work, minimal activity)') {
        score += 6;
        factors.push({ factor: 'Sedentary lifestyle', points: 6, severity: 'medium' });
        factorContributions.push({ id: 'sedentary', label: 'Sedentary lifestyle', points: 6, category: 'modifiable', direction: 'positive' });
    }

    if (patientData.lifestyle.smoking === 'Yes') {
        score += 8;
        factors.push({ factor: 'Smoking', points: 8, severity: 'high' });
        factorContributions.push({ id: 'smoking', label: 'Smoking', points: 8, category: 'modifiable', direction: 'positive' });
    }

    if (patientData.lifestyle.alcohol === 'Frequently') {
        score += 7;
        factors.push({ factor: 'Frequent alcohol consumption', points: 7, severity: 'high' });
        factorContributions.push({ id: 'frequent_alcohol', label: 'Frequent alcohol consumption', points: 7, category: 'modifiable', direction: 'positive' });
    }

    if (patientData.lifestyle.dietPattern === 'High fat diet (fried foods, processed foods, sweets)') {
        score += 5;
        factors.push({ factor: 'High fat/salt diet', points: 5, severity: 'medium' });
        factorContributions.push({ id: 'high_fat_diet', label: 'High fat/salt diet', points: 5, category: 'modifiable', direction: 'positive' });
    }

    // ===== GENDER ADJUSTMENT =====
    // Not added to `factors`/topFactors (preserves v1.3 topFactors output exactly);
    // recorded only in factorContributions since it does contribute score points.
    if (patientData.gender === 'Male') {
        score += 5;
        factorContributions.push({ id: 'gender_male', label: 'Male gender', points: 5, category: 'non_modifiable', direction: 'positive' });
    }

    // Cap score at 100
    score = Math.min(score, 100);

    // Sort factors and take top 3
    const topFactors = factors
        .sort((a, b) => b.points - a.points)
        .slice(0, 3)
        .map(f => f.factor);

    // Determine risk category
    let category, color, urgency;
    if (score >= 70) {
        category = 'Critical Risk';
        color = 'danger';
        urgency = 'urgent';
    } else if (score >= 45) {
        category = 'High Risk';
        color = 'danger';
        urgency = 'high';
    } else if (score >= 25) {
        category = 'Moderate Risk';
        color = 'warning';
        urgency = 'medium';
    } else {
        category = 'Low Risk';
        color = 'success';
        urgency = 'low';
    }

    return {
        score: Math.round(score),
        category,
        risk: category,
        color,
        urgency,
        topFactors,
        confidence,
        allFactors: factors,
        factorContributions
    };
}

// ==========================================
// COMBINED RISK CALCULATION
// ==========================================

/**
 * Calculate Combined Metabolic Risk
 * Evidence: 60.5% co-occurrence rate
 */
function calculateCombinedRisk(diabetesResult, hypertensionResult) {
    // Weighted average with synergy bonus
    const baseScore = (diabetesResult.score * 0.5) + (hypertensionResult.score * 0.5);
    
    // Synergy bonus for metabolic syndrome
    let synergyBonus = 0;
    if (diabetesResult.score >= 45 && hypertensionResult.score >= 45) {
        synergyBonus = 15;
    } else if (diabetesResult.score >= 25 && hypertensionResult.score >= 25) {
        synergyBonus = 8;
    }

    const combinedScore = Math.min(baseScore + synergyBonus, 100);

    // Determine combined category
    let category, color, urgency;
    if (combinedScore >= 70) {
        category = 'Critical - Metabolic Syndrome Risk';
        color = 'danger';
        urgency = 'urgent';
    } else if (combinedScore >= 50) {
        category = 'High Combined Risk';
        color = 'danger';
        urgency = 'high';
    } else if (combinedScore >= 30) {
        category = 'Moderate Combined Risk';
        color = 'warning';
        urgency = 'medium';
    } else {
        category = 'Low Combined Risk';
        color = 'success';
        urgency = 'low';
    }

    return {
        score: Math.round(combinedScore),
        category,
        risk: category,
        color,
        urgency,
        diabetesScore: diabetesResult.score,
        hypertensionScore: hypertensionResult.score,
        synergyBonus
    };
}

// ==========================================
// RECOMMENDATIONS GENERATOR
// ==========================================

/**
 * Generate personalized recommendations
 */
function generateRecommendations(diabetesRisk, hypertensionRisk, combinedRisk) {
    const recommendations = {
        immediate: [],
        lifestyle: [],
        followUp: []
    };

    // Immediate actions
    if (combinedRisk.urgency === 'urgent') {
        recommendations.immediate.push('🚨 URGENT: Visit a doctor immediately for comprehensive evaluation');
        recommendations.immediate.push('📋 Bring this screening report to your doctor');
    } else if (combinedRisk.urgency === 'high') {
        recommendations.immediate.push('⚠️ Schedule a doctor appointment within 1-2 weeks');
        recommendations.immediate.push('📊 Get fasting blood sugar and BP monitoring');
    }

    // Lifestyle modifications
    if (diabetesRisk.score >= 25 || hypertensionRisk.score >= 25) {
        recommendations.lifestyle.push('🥗 Reduce sugar, mithai, and fried foods');
        recommendations.lifestyle.push('🚶 Walk 30 minutes daily or practice yoga');
        recommendations.lifestyle.push('💧 Drink 8-10 glasses of water daily');
        recommendations.lifestyle.push('😴 Get 7-8 hours of quality sleep');
    }

    // Follow-up
    if (combinedRisk.score >= 30) {
        recommendations.followUp.push('📅 Rescreen in 3 months');
        recommendations.followUp.push('📝 Keep a health diary tracking BP and symptoms');
    } else {
        recommendations.followUp.push('📅 Annual health checkup recommended');
    }

    return recommendations;
}

// ==========================================
// DATA COMPLETENESS
// ==========================================

/**
 * Percentage (0-100) of six optional signal fields present.
 * Drives assessmentTier alongside the hasHba1c/hasBloodSugar/hasBloodPressure checks.
 */
function calculateDataCompleteness(patientData) {
    const checks = [
        patientData.readings?.bloodSugar != null,
        !!patientData.readings?.bloodPressure,
        !!patientData.readings?.hba1c,
        !!patientData.waistCircumference,
        Object.values(patientData.symptoms?.diabetes || {}).some(Boolean) ||
            Object.values(patientData.symptoms?.hypertension || {}).some(Boolean),
        !!(patientData.lifestyle?.physicalActivity && patientData.lifestyle?.dietPattern)
    ];
    const present = checks.filter(Boolean).length;
    return Math.round((present / checks.length) * 100);
}

// ==========================================
// MAIN ASSESSMENT FUNCTION
// ==========================================

/**
 * Main risk assessment function
 */
function assessHealthRisk(patientData) {
    const diabetesRisk = calculateDiabetesRisk(patientData);
    const hypertensionRisk = calculateHypertensionRisk(patientData);
    const combinedRisk = calculateCombinedRisk(diabetesRisk, hypertensionRisk);
    const recommendations = generateRecommendations(diabetesRisk, hypertensionRisk, combinedRisk);
    const guidelines = generateHealthGuidelines(combinedRisk, diabetesRisk, hypertensionRisk);

    const hasHba1c = !!patientData.readings?.hba1c;
    const hasBloodSugar = patientData.readings?.bloodSugar != null;
    const hasBloodPressure = !!patientData.readings?.bloodPressure;

    let assessmentTier = 'baseline';
    if (hasHba1c && hasBloodSugar && hasBloodPressure) {
        assessmentTier = 'enhanced';
    } else if (hasHba1c || hasBloodSugar || hasBloodPressure) {
        assessmentTier = 'partial';
    }

    return {
        diabetes: diabetesRisk,
        hypertension: hypertensionRisk,
        combined: combinedRisk,
        recommendations,
        guidelines,  // ⭐ NEW
        assessmentTier,
        dataCompletenessPercentage: calculateDataCompleteness(patientData),
        timestamp: new Date().toISOString(),
        patientInfo: {
            name: patientData.name,
            age: patientData.age,
            gender: patientData.gender,
            bmi: patientData.bmi
        }
    };
}

// ==========================================
// DO'S, DON'TS & EXERCISE RECOMMENDATIONS
// ==========================================

/**
 * Generate culturally appropriate Do's, Don'ts, and Exercise recommendations
 */
function generateHealthGuidelines(combinedRisk, diabetesRisk, hypertensionRisk) {
    const guidelines = {
        dos: [],
        donts: [],
        exercises: []
    };

    // ===== BASED ON COMBINED RISK LEVEL =====
    
    if (combinedRisk.urgency === 'urgent' || combinedRisk.urgency === 'high') {
        // HIGH/CRITICAL RISK
        guidelines.dos = [
            '🏥 Visit a doctor within 1-2 weeks for complete checkup',
            '📊 Monitor blood pressure and blood sugar daily at home or nearby clinic',
            '💊 Take prescribed medicines on time (if already prescribed)',
            '🥗 Eat small, frequent meals - avoid heavy dinners',
            '💧 Drink 8-10 glasses of water daily'
        ];
        
        guidelines.donts = [
            '🚫 Skip meals or eat irregularly',
            '🚫 Eat fried foods, sweets, or processed snacks',
            '🚫 Ignore symptoms like dizziness, chest pain, or extreme fatigue',
            '🚫 Stay up late - maintain regular sleep schedule',
            '🚫 Smoke or consume alcohol'
        ];
        
        guidelines.exercises = [
            '🚶 Walk slowly for 15-20 minutes after breakfast and dinner',
            '🧘 Practice simple breathing exercises (pranayama) for 10 minutes',
            '💺 Avoid heavy lifting or intense exercise until doctor approves',
            '⚠️ Stop immediately if you feel chest pain, dizziness, or breathlessness'
        ];
        
    } else if (combinedRisk.urgency === 'medium') {
        // MODERATE RISK
        guidelines.dos = [
            '👨‍⚕️ Schedule health checkup within 3-4 weeks',
            '🥗 Eat more vegetables, fruits, and whole grains (brown rice, ragi, jowar)',
            '💧 Drink water before feeling thirsty - keep a bottle with you',
            '😴 Sleep 7-8 hours daily - wake up and sleep at same time',
            '🧘 Practice stress management - meditation or yoga for 15 minutes'
        ];
        
        guidelines.donts = [
            '🚫 Eat too much salt, oil, or sugar',
            '🚫 Sit continuously for more than 2 hours - take short walking breaks',
            '🚫 Skip breakfast or dinner',
            '🚫 Drink sugary drinks like cold drinks, packaged juices',
            '🚫 Ignore warning signs like frequent headaches or tiredness'
        ];
        
        guidelines.exercises = [
            '🚶 Walk 30-40 minutes daily (morning or evening)',
            '🧘 Simple yoga asanas like Tadasana, Vrikshasana (5-10 minutes)',
            '🏃 Light jogging or cycling 3-4 times per week',
            '💪 Bodyweight exercises - 10 squats, 5 push-ups (against wall)',
            '🎯 Gradually increase activity - listen to your body'
        ];
        
    } else {
        // LOW RISK
        guidelines.dos = [
            '✅ Continue healthy habits - you are doing well!',
            '🥗 Keep eating balanced meals with vegetables and fruits',
            '💧 Stay hydrated throughout the day',
            '😴 Maintain good sleep routine',
            '📅 Get annual health checkup to monitor your health'
        ];
        
        guidelines.donts = [
            '🚫 Become careless about diet and exercise',
            '🚫 Skip regular health checkups',
            '🚫 Eat too much junk food or sweets regularly',
            '🚫 Sit idle for long hours - stay active',
            '🚫 Ignore family history of diabetes or BP'
        ];
        
        guidelines.exercises = [
            '🏃 Regular exercise 5 days a week - walking, jogging, cycling',
            '🧘 Yoga or gym workout for 30-45 minutes',
            '🏋️ Strength training 2-3 times per week',
            '🏊 Try swimming, dancing, or any sport you enjoy',
            '🎯 Challenge yourself - gradually increase intensity'
        ];
    }

    // ===== SPECIFIC ADDITIONS BASED ON INDIVIDUAL RISKS =====
    
    // Diabetes-specific
    if (diabetesRisk.score >= 45) {
        guidelines.donts.unshift('🚫 Eat white rice, maida, or sugary foods');
        guidelines.dos.push('🍽️ Choose whole grains - brown rice, ragi, oats, daliya');
    }
    
    // Hypertension-specific
    if (hypertensionRisk.score >= 45) {
        guidelines.donts.unshift('🚫 Add extra salt to food or eat pickles, papad');
        guidelines.dos.push('🧂 Reduce salt intake - use lemon, herbs for taste');
    }

    return guidelines;
}

// Export globally
window.RiskCalculator = {
    assessHealthRisk,
    calculateDiabetesRisk,
    calculateHypertensionRisk,
    calculateCombinedRisk,
    version: ALGORITHM_VERSION
};

console.log('✓ Risk Calculator module loaded successfully');