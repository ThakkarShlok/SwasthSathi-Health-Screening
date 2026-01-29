/**
 * ============================================
 * LANGUAGE CONFIGURATION - COMPREHENSIVE
 * All translation keys for entire website
 * ============================================
 */

const LANGUAGES = {
    en: {
        name: 'English',
        nativeName: 'English',
        flag: '🇬🇧',
        code: 'en'
    },
    hi: {
        name: 'Hindi',
        nativeName: 'हिंदी',
        flag: '🇮🇳',
        code: 'hi'
    },
    gu: {
        name: 'Gujarati',
        nativeName: 'ગુજરાતી',
        flag: '🇮🇳',
        code: 'gu'
    },
    mr: {
        name: 'Marathi',
        nativeName: 'मराठी',
        flag: '🇮🇳',
        code: 'mr'
    }
};

// COMPREHENSIVE TRANSLATION KEYS
const TRANSLATION_KEYS = {
    // ===== NAVBAR =====
    nav_home: 'Home',
    nav_about: 'About Us',
    nav_screening: 'Screening',
    nav_doctors: 'Find Doctors',
    nav_start: 'Start Now',
    
    // ===== COMMON =====
    loading: 'Loading...',
    error: 'Error',
    success: 'Success',
    warning: 'Warning',
    
    // ===== HOMEPAGE =====
    hero_title: 'Early Health Screening for Every Indian',
    hero_subtitle: 'AI-powered screening for diabetes and hypertension with medical report OCR. Get evidence-based risk assessment in your language, completely free.',
feature_ocr: 'OCR Report Scanning',
    feature_multilingual: 'Multilingual',
    feature_free: '100% Free',
    btn_start_screening: 'Start Screening',
    btn_learn_more: 'Learn More',
    takes_5min: 'Takes only 5 minutes • No registration needed',
    
    stats_hypertension: 'People with Hypertension',
    stats_diabetes: 'People with Diabetes',
    stats_cooccurrence: 'Co-occurrence Rate',
    stats_quick: 'Quick Screening',
    
    section_why_choose: 'Why Choose SwasthSathi?',
    section_subtitle_features: 'Comprehensive health screening designed for rural India',
    
    feature_evidence_title: 'Evidence-Based Algorithm',
feature_evidence_desc: 'Risk calculations grounded in NFHS-5 research, ADA guidelines, and JNC-8 standards used by medical professionals worldwide.',

feature_multilingual_title: 'Multilingual Support',
feature_multilingual_desc: 'Available in 4 Indian languages: English, Hindi, Gujarati, and Marathi. User-friendly interface for all literacy levels.',
    
    feature_ocr_title: 'AI-Powered OCR',
    feature_ocr_desc: 'Photograph your medical reports and our AI automatically extracts key health values - no typing needed!',
    
    feature_suggestions_title: 'Smart Suggestions',
feature_suggestions_desc: 'OCR-extracted values shown as suggestions you can review, accept, or reject. You stay in control of your data.',

feature_print_title: 'Printable Results',
feature_print_desc: 'Take your comprehensive risk assessment report to your doctor. Includes risk scores, contributing factors, and personalized recommendations.',

feature_doctors_title: 'Verified Specialist Directory',
feature_doctors_desc: 'Curated list of 12 diabetes and hypertension specialists across India with ratings, experience, and contact information.',
    
    feature_corisk_title: 'Co-Risk Screening',
    feature_corisk_desc: 'Unique system that screens for diabetes AND hypertension together, identifying combined health risks.',
    
    
    feature_advice_title: 'Personalized Advice',
    feature_advice_desc: "Culturally appropriate Do's & Don'ts in your language with local food examples and exercises.",
    
    how_it_works_title: 'How It Works',
    how_it_works_subtitle: 'Complete health screening in just 5 minutes',
    
    step1_title: 'Select Language',
    step1_desc: 'Choose from English, Hindi, Gujarati, or Marathi',
    step2_title: 'Basic Information',
    step2_desc: 'Age, gender, height, and weight',
    step3_title: 'Health Questions',
    step3_desc: 'Simple symptoms and lifestyle questions',
    step4_title: 'Get Results',
    step4_desc: 'Instant risk scores and personalized advice',
    
    impact_title_new: 'What We Offer',
impact_subtitle_new: 'Comprehensive screening designed for rural India',
impact_languages: 'Indian Languages',
impact_specialists: 'Verified Specialists',
impact_conditions: 'Conditions Screened',
impact_time: 'Quick Screening',
    
    cta_title: 'Take Control of Your Health Today',
    cta_subtitle: 'Early detection can prevent serious complications. Get your free screening in just 5 minutes.',
    cta_button: 'Start Free Screening',
    
    // ===== ABOUT PAGE =====
    about_hero_title: 'About Us',
    about_hero_subtitle: 'Building technology-driven solutions for early health risk awareness.',
    
    mission_title: 'Our Mission',
    mission_text1: 'SwasthSathi exists to bridge the gap between rural communities and early health awareness. In India, millions of people discover chronic conditions like diabetes and hypertension only after symptoms become severe—often too late for preventive care.',
    mission_text2: 'We believe that early screening should be accessible to everyone, regardless of location, literacy, or economic status. Our platform is designed to support timely medical consultation, not replace it. We use technology responsibly to empower individuals with awareness, helping them take the first step toward better health.',
    mission_highlight: 'Supporting doctors, not replacing them',
    
    problem_title: 'The Problem We Are Solving',
    problem_late_title: 'Late Diagnosis',
    problem_late_desc: 'Most chronic diseases are detected only after complications arise, when treatment becomes costly and complex.',
    problem_awareness_title: 'Lack of Awareness',
    problem_awareness_desc: 'Early symptoms of diabetes and hypertension often go unnoticed, especially in rural areas with limited health education.',
    problem_access_title: 'Accessibility Barriers',
    problem_access_desc: 'Rural India faces challenges like distance to clinics, lack of transport, and shortage of healthcare workers.',
    problem_overcrowded_title: 'Overcrowded Systems',
    problem_overcrowded_desc: 'Public hospitals are overwhelmed with patients, leaving little time for preventive care and early screening.',
    
    team_title: 'Meet Team COGNITEX',
    team_subtitle: 'A collaborative, interdisciplinary team of four tech enthusiasts united by a shared vision: making healthcare accessible through responsible technology.',
    team_responsibilities: 'Key Responsibilities:',
    team_connect: 'Connect',
    
    ethics_title: 'Our Ethical Commitment',
    ethics_not_diagnostic: 'Not a Diagnostic Tool',
    ethics_not_diagnostic_desc: 'SwasthSathi is a screening platform, not a medical diagnosis system.',
    ethics_awareness: 'Supporting Awareness',
    ethics_awareness_desc: 'We empower users with early risk awareness to seek timely medical consultation.',
    ethics_professional: 'Professional Guidance Required',
    ethics_professional_desc: 'Final medical decisions must always be taken by certified healthcare professionals.',
    ethics_footer: 'We are committed to using technology responsibly, transparently, and ethically in healthcare.',
    
    cta_about_title: 'Ready to Take Control of Your Health?',
    cta_about_subtitle: 'Experience early health screening designed for rural India—free, fast, and accessible.',
    cta_about_button: 'Start Free Screening',
    
    // ===== SCREENING PAGE =====
    screening_title: 'Patient Health Screening',
    demo_button: 'Load Sample Patient Data',
    demo_hint: 'Instantly fills the form with realistic data for demonstration',
    
    basic_info: 'Basic Information',
    label_name: 'Full Name',
    label_age: 'Age',
    label_gender: 'Gender',
    select_gender: 'Select',
    gender_male: 'Male',
    gender_female: 'Female',
    gender_other: 'Other',
    
    // ===== OCR SECTION (COMPLETE) =====
    ocr_title: 'Upload Medical Report (Optional)',
    ocr_subtitle: 'Upload a photo of your medical report. Our system will automatically extract blood sugar and blood pressure values.',
    ocr_upload_hint: 'Click to upload',
    ocr_file_types: 'PNG, JPG up to 10MB',
    ocr_uploaded: 'Uploaded Image',
    ocr_extract_btn: 'Extract Values from Report',
    ocr_processing: 'Processing Medical Report...',
    ocr_extracted_title: 'Extracted Text',
    ocr_raw_output: 'Raw OCR Output:',
    ocr_verify: 'Please verify: Auto-extracted values may not be 100% accurate. Review and edit before submitting.',
    ocr_no_values: 'No medical values detected. The image quality might be poor or values are not in a recognizable format. Please enter values manually below.',
    ocr_will_fill: 'Will be filled in form below',
    
    body_measurements: 'Body Measurements',
    label_height: 'Height (cm)',
    label_weight: 'Weight (kg)',
    label_waist: 'Waist Circumference (cm)',
    placeholder_height: 'e.g., 165',
    placeholder_weight: 'e.g., 70',
    waist_placeholder: 'Optional: Measure at belly button',
    waist_hint: 'Critical for metabolic risk assessment',
    
    medical_conditions: 'Known Medical Conditions',
    diagnosed_diabetes: 'Diagnosed Diabetes?',
    diagnosed_hypertension: 'Diagnosed Hypertension?',
    option_no: 'No',
    option_yes: 'Yes',
    
    symptoms_title: 'Symptoms (Last 2-4 Weeks)',
    diabetes_related: 'Diabetes Related',
    hypertension_related: 'Hypertension Related',
    
    symptom_freq_urination: 'Frequent urination during the day',
    symptom_nocturia: 'Waking up multiple times at night to urinate',
    symptom_thirst: 'Excessive thirst',
    symptom_weight_loss: 'Unexplained weight loss',
    symptom_fatigue: 'Frequent fatigue or tiredness',
    symptom_blurred_vision: 'Blurred vision',
    
    symptom_headache: 'Frequent headaches',
    symptom_dizziness: 'Dizziness or lightheadedness',
    symptom_palpitations: 'Heart palpitations or racing heartbeat',
    symptom_chest_pain: 'Chest pain or discomfort',
    symptom_breathlessness: 'Shortness of breath',
    
    additional_symptoms_title: 'Additional Symptoms or Notes',
    additional_symptoms_placeholder: 'Please describe any other symptoms, concerns, or relevant health information not covered above...',
    
    lifestyle_title: 'Lifestyle & Family History',
    label_activity: 'Physical Activity Level',
    activity_hint: 'Your typical daily activity level',
    activity_sedentary: 'Sedentary (office work, minimal activity)',
    activity_light: 'Light (walking 30 min/day)',
    activity_moderate: 'Moderate (regular exercise 3-4 days/week)',
    activity_active: 'Active (daily exercise or physical labor)',
    
    label_diet: 'Dietary Pattern',
    diet_hint: 'Your typical eating habits',
    diet_low_fat: 'Low fat diet (fruits, vegetables, whole grains)',
    diet_balanced: 'Balanced diet',
    diet_high_fat: 'High fat diet (fried foods, processed foods, sweets)',
    
    label_smoking: 'Smoking',
    label_alcohol: 'Alcohol Consumption',
    label_family_history: 'Family History (Diabetes / BP)',
    option_occasionally: 'Occasionally',
    option_frequently: 'Frequently',
    
    readings_title: 'Recent Readings (Optional)',
    label_blood_sugar: 'Blood Sugar (mg/dL)',
    label_blood_pressure: 'Blood Pressure (e.g. 120/80)',
    placeholder_sugar: 'e.g., 110',
    placeholder_bp: 'e.g., 120/80',
    
    btn_complete_screening: 'Complete Screening',
    data_secure: 'Your data is stored securely on your device only',
    
    btn_view_results: 'View My Results',
    btn_complete_above: 'Complete Screening Above',
    hint_fill_form: 'Fill the form above to get your health risk assessment',
    hint_last_screening: 'Last screening:',
    
    // ===== RESULT PAGE =====
    result_loading: 'Analyzing your health data...',
    result_no_data_title: 'No Screening Data Found',
    result_no_data_desc: 'Please complete the health screening first.',
    result_start_screening: 'Start Screening',
    
    result_overall_risk: 'Overall Health Risk',
    result_diabetes_risk: 'Diabetes Risk',
    result_hypertension_risk: 'Hypertension Risk',
    result_top_factors: 'Top Contributing Factors:',
    result_confidence: 'Confidence:',
    
    result_recommendations: 'Personalized Recommendations',
    result_immediate: 'Immediate Actions',
    result_lifestyle: 'Lifestyle Changes',
    result_followup: 'Follow-Up',
    
    result_dos: "Do's",
    result_donts: "Don'ts",
    result_exercise: 'Exercise',
    
    result_disclaimer_title: 'Important Medical Disclaimer',
    result_disclaimer_text: 'This is a preliminary screening tool, NOT a medical diagnosis. Results are based on self-reported data and established clinical guidelines (ADA, JNC-8, WHO, NFHS-5).',
    result_disclaimer_accuracy: 'Accuracy: 75-85% sensitivity (may miss 15-25% of at-risk individuals). Always consult a qualified healthcare provider for diagnosis confirmation, treatment planning, and medication management.',
    
    btn_back_screening: 'Back to Screening',
    btn_find_doctor: 'Find a Doctor',
    btn_print: 'Print Results',
    
    // ===== DOCTORS PAGE =====
    doctors_title: 'Consult a Qualified Doctor',
    doctors_subtitle: 'Based on your screening result, consulting a qualified medical specialist is advised for proper diagnosis and treatment planning.',
    doctors_info_notice: 'Information Purpose Only:',
    doctors_info_text: 'The doctors listed below are sourced from publicly available platforms. This platform does not recommend, rank, or endorse any doctor.',
    
    doctors_diabetes_title: 'Diabetes Specialists',
    doctors_diabetes_subtitle: 'Endocrinologists, Diabetologists, and MD Medicine doctors specializing in diabetes care',
    
    doctors_hypertension_title: 'Hypertension Specialists',
    doctors_hypertension_subtitle: 'Cardiologists and Internal Medicine specialists with expertise in hypertension management',
    
    doctors_disclaimer_title: 'Important Disclaimer',
    doctors_disclaimer_text: 'This platform does not recommend, rank, or endorse any doctor.',
    doctors_disclaimer_1: 'Doctor information is provided for awareness purposes only',
    doctors_disclaimer_2: 'Data is sourced from publicly available platforms (Google Maps, Practo, Hospital websites)',
    doctors_disclaimer_3: 'Ratings and reviews are from third-party platforms',
    doctors_disclaimer_4: 'Please verify credentials, availability, and fees independently before consultation',
    doctors_disclaimer_5: 'Always consult with a qualified healthcare provider for diagnosis and treatment',
    doctors_emergency: 'Emergency:',
    doctors_emergency_text: 'For medical emergencies, call 108 (National Ambulance Service) or visit the nearest hospital immediately.',
    
    btn_back_results: 'Back to Results',
    btn_back_home: 'Back to Home',
    
    // ===== FOOTER =====
    footer_tagline: 'Your trusted companion for early health screening. Offline-capable, multilingual, and free for everyone.',
    footer_quick_links: 'Quick Links',
    footer_important: 'Important',
    footer_disclaimer: 'This is a screening tool, not a diagnostic tool. Always consult a qualified healthcare professional for diagnosis and treatment.',
    footer_copyright: '© 2025 SwasthSathi. Built for ImpactThon @KSV 2025-2026'
};

// Export globally
window.LANGUAGES = LANGUAGES;
window.TRANSLATION_KEYS = TRANSLATION_KEYS;

console.log('✓ Language configuration loaded');
console.log('✓ Total translation keys:', Object.keys(TRANSLATION_KEYS).length);