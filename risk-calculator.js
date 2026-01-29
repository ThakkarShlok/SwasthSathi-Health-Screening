/**
 * ============================================
 * SWASTHSATHI RISK CALCULATOR
 * Evidence-based diabetes & hypertension screening
 * Based on NFHS-5 data and clinical guidelines
 * ============================================
 */

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
    let confidence = 'Medium';

    // ===== AGE FACTOR (Max 30 points) =====
    // Evidence: OR 14.46 for age >50
    if (patientData.age >= 50) {
        score += 30;
        factors.push({ factor: 'Age ≥50 years', points: 30, severity: 'high' });
    } else if (patientData.age >= 45) {
        score += 25;
        factors.push({ factor: 'Age 45-49 years', points: 25, severity: 'high' });
    } else if (patientData.age >= 40) {
        score += 20;
        factors.push({ factor: 'Age 40-44 years', points: 20, severity: 'medium' });
    } else if (patientData.age >= 35) {
        score += 12;
        factors.push({ factor: 'Age 35-39 years', points: 12, severity: 'medium' });
    } else if (patientData.age >= 30) {
        score += 6;
        factors.push({ factor: 'Age 30-34 years', points: 6, severity: 'low' });
    }

    // ===== BMI FACTOR (Max 25 points) =====
    // Evidence: OR 12.39 for BMI >30
    if (patientData.bmi >= 30) {
        score += 25;
        factors.push({ factor: 'Obesity (BMI ≥30)', points: 25, severity: 'high' });
    } else if (patientData.bmi >= 27.5) {
        score += 20;
        factors.push({ factor: 'Overweight Class II (BMI 27.5-29.9)', points: 20, severity: 'high' });
    } else if (patientData.bmi >= 25) {
        score += 15;
        factors.push({ factor: 'Overweight Class I (BMI 25-27.4)', points: 15, severity: 'medium' });
    } else if (patientData.bmi >= 23) {
        score += 8;
        factors.push({ factor: 'Overweight (Asian cutoff, BMI 23-24.9)', points: 8, severity: 'medium' });
    }

    // ===== WAIST CIRCUMFERENCE (Max 15 points) =====
    // Evidence: 60.5% co-occurrence with abdominal obesity
    if (patientData.waistCircumference) {
        const waistThreshold = patientData.gender === 'Male' ? 90 : 80;
        if (patientData.waistCircumference >= waistThreshold) {
            score += 15;
            factors.push({ factor: 'Abdominal obesity', points: 15, severity: 'high' });
        }
    }

    // ===== BLOOD SUGAR READING (Max 40 points) =====
    if (patientData.readings.bloodSugar) {
        const sugar = parseFloat(patientData.readings.bloodSugar);
        if (sugar >= 200) {
            score += 40;
            factors.push({ factor: 'Very high blood sugar (≥200 mg/dL)', points: 40, severity: 'critical' });
            confidence = 'High';
        } else if (sugar >= 126) {
            score += 35;
            factors.push({ factor: 'High blood sugar (≥126 mg/dL)', points: 35, severity: 'high' });
            confidence = 'High';
        } else if (sugar >= 100) {
            score += 15;
            factors.push({ factor: 'Pre-diabetes range (100-125 mg/dL)', points: 15, severity: 'medium' });
        }
    }

    // ===== PRIOR DIAGNOSIS (Max 50 points) =====
    if (patientData.diagnosed.diabetes === 'Yes') {
        score += 50;
        factors.push({ factor: 'Previously diagnosed with diabetes', points: 50, severity: 'critical' });
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
    } else if (symptomCount > 0) {
        factors.push({ factor: `${symptomCount} diabetes symptom(s)`, points: symptomCount * 4, severity: 'medium' });
    }

    // ===== FAMILY HISTORY (Max 12 points) =====
    if (patientData.lifestyle.familyHistory === 'Yes') {
        score += 12;
        factors.push({ factor: 'Family history of diabetes/hypertension', points: 12, severity: 'medium' });
    }

    // ===== LIFESTYLE FACTORS (Max 15 points) =====
    if (patientData.lifestyle.physicalActivity === 'Sedentary (office work, minimal activity)') {
        score += 8;
        factors.push({ factor: 'Sedentary lifestyle', points: 8, severity: 'medium' });
    }

    if (patientData.lifestyle.dietPattern === 'High fat diet (fried foods, processed foods, sweets)') {
        score += 7;
        factors.push({ factor: 'High fat diet', points: 7, severity: 'medium' });
    }

    if (patientData.lifestyle.smoking === 'Yes') {
        score += 5;
        factors.push({ factor: 'Smoking', points: 5, severity: 'medium' });
    }

    if (patientData.lifestyle.alcohol === 'Frequently') {
        score += 5;
        factors.push({ factor: 'Frequent alcohol consumption', points: 5, severity: 'medium' });
    }

    // ===== GENDER ADJUSTMENT =====
    if (patientData.gender === 'Male') {
        score += 3;
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
        color,
        urgency,
        topFactors,
        confidence,
        allFactors: factors
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
    let confidence = 'Medium';

    // ===== AGE FACTOR (Max 30 points) =====
    // Evidence: OR 16.65 for age >50
    if (patientData.age >= 50) {
        score += 30;
        factors.push({ factor: 'Age ≥50 years', points: 30, severity: 'high' });
    } else if (patientData.age >= 45) {
        score += 25;
        factors.push({ factor: 'Age 45-49 years', points: 25, severity: 'high' });
    } else if (patientData.age >= 40) {
        score += 18;
        factors.push({ factor: 'Age 40-44 years', points: 18, severity: 'medium' });
    } else if (patientData.age >= 35) {
        score += 10;
        factors.push({ factor: 'Age 35-39 years', points: 10, severity: 'medium' });
    } else if (patientData.age >= 30) {
        score += 5;
        factors.push({ factor: 'Age 30-34 years', points: 5, severity: 'low' });
    }

    // ===== BMI FACTOR (Max 20 points) =====
    // Evidence: OR 7.36 for BMI >30
    if (patientData.bmi >= 30) {
        score += 20;
        factors.push({ factor: 'Obesity (BMI ≥30)', points: 20, severity: 'high' });
    } else if (patientData.bmi >= 27.5) {
        score += 16;
        factors.push({ factor: 'Overweight Class II', points: 16, severity: 'high' });
    } else if (patientData.bmi >= 25) {
        score += 12;
        factors.push({ factor: 'Overweight Class I', points: 12, severity: 'medium' });
    } else if (patientData.bmi >= 23) {
        score += 6;
        factors.push({ factor: 'Overweight (Asian cutoff)', points: 6, severity: 'medium' });
    }

    // ===== BLOOD PRESSURE READING (Max 45 points) =====
    if (patientData.readings.bloodPressure) {
        const [systolic, diastolic] = patientData.readings.bloodPressure
            .split('/')
            .map(v => parseInt(v.trim()));

        if (systolic >= 180 || diastolic >= 120) {
            score += 45;
            factors.push({ factor: 'Hypertensive Crisis (≥180/120)', points: 45, severity: 'critical' });
            confidence = 'High';
        } else if (systolic >= 160 || diastolic >= 100) {
            score += 40;
            factors.push({ factor: 'Stage 2 Hypertension (160-179/100-119)', points: 40, severity: 'critical' });
            confidence = 'High';
        } else if (systolic >= 140 || diastolic >= 90) {
            score += 35;
            factors.push({ factor: 'Stage 1 Hypertension (140-159/90-99)', points: 35, severity: 'high' });
            confidence = 'High';
        } else if (systolic >= 130 || diastolic >= 80) {
            score += 20;
            factors.push({ factor: 'Elevated BP (130-139/80-89)', points: 20, severity: 'medium' });
        } else if (systolic >= 120) {
            score += 10;
            factors.push({ factor: 'Pre-hypertension (120-129/<80)', points: 10, severity: 'low' });
        }
    }

    // ===== PRIOR DIAGNOSIS (Max 50 points) =====
    if (patientData.diagnosed.hypertension === 'Yes') {
        score += 50;
        factors.push({ factor: 'Previously diagnosed with hypertension', points: 50, severity: 'critical' });
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
    } else if (symptomCount > 0) {
        factors.push({ factor: `${symptomCount} hypertension symptom(s)`, points: Math.round(symptomCount * 3.5), severity: 'medium' });
    }

    // ===== FAMILY HISTORY (Max 10 points) =====
    if (patientData.lifestyle.familyHistory === 'Yes') {
        score += 10;
        factors.push({ factor: 'Family history', points: 10, severity: 'medium' });
    }

    // ===== LIFESTYLE FACTORS (Max 18 points) =====
    if (patientData.lifestyle.physicalActivity === 'Sedentary (office work, minimal activity)') {
        score += 6;
        factors.push({ factor: 'Sedentary lifestyle', points: 6, severity: 'medium' });
    }

    if (patientData.lifestyle.smoking === 'Yes') {
        score += 8;
        factors.push({ factor: 'Smoking', points: 8, severity: 'high' });
    }

    if (patientData.lifestyle.alcohol === 'Frequently') {
        score += 7;
        factors.push({ factor: 'Frequent alcohol consumption', points: 7, severity: 'high' });
    }

    if (patientData.lifestyle.dietPattern === 'High fat diet (fried foods, processed foods, sweets)') {
        score += 5;
        factors.push({ factor: 'High fat/salt diet', points: 5, severity: 'medium' });
    }

    // ===== GENDER ADJUSTMENT =====
    if (patientData.gender === 'Male') {
        score += 5;
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
        color,
        urgency,
        topFactors,
        confidence,
        allFactors: factors
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

    return {
        diabetes: diabetesRisk,
        hypertension: hypertensionRisk,
        combined: combinedRisk,
        recommendations,
        guidelines,  // ⭐ NEW
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
    calculateCombinedRisk
};

console.log('✓ Risk Calculator module loaded successfully');