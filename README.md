# 🩺 SwasthSathi - Healthcare Screening for Rural India

**AI-Powered Early Health Risk Assessment for Diabetes & Hypertension**

SwasthSathi is a comprehensive web-based health screening platform that helps users identify early risk of **Diabetes and Hypertension** through evidence-based algorithms. Built for **rural India** with multilingual support and OCR-powered medical report scanning.

> 🏆 **Built for ImpactThon @KSV 2025-2026**

---

## 🎯 Problem Statement

In rural India, **220M+ people have hypertension** and **77M+ have diabetes**, with a **60.5% co-occurrence rate**. Most chronic diseases are detected late due to:
- Limited access to healthcare facilities
- Lack of health awareness
- Language barriers in medical reports
- Overcrowded public hospitals

**SwasthSathi bridges this gap** by providing free, accessible, evidence-based health screening.

---

## ✨ Key Features

### 🔬 Evidence-Based Risk Assessment
- Rule-based scoring informed by published clinical guideline cutoffs and NFHS-5 population-level odds ratios
- Screens diabetes AND hypertension together (co-risk assessment)
- Note: the composite scoring system has not been clinically validated on patient data; this is a screening awareness tool, not a diagnostic instrument

### 📸 OCR Medical Report Scanning
- Upload photos of medical reports
- **Tesseract.js** powered text extraction
- Smart suggestions system (accept/reject extracted values)
- Validates blood sugar, blood pressure, HbA1c automatically

### 🌐 Multilingual Support
- Available in **4 Indian languages**: English, Hindi, Gujarati, Marathi
- MyMemory Translation API with client-side caching
- User-friendly interface for all literacy levels

### 🏥 Specialist Directory
- Curated list of **12 diabetes & hypertension specialists** sourced from publicly available platforms
- Public data from Google Maps, Practo; no endorsement or verification by SwasthSathi
- Ratings, experience, hospital details, contact information

### 📊 Comprehensive Results
- Animated risk score visualization (0-100)
- Top contributing factors analysis
- Personalized recommendations (Do's, Don'ts, Exercise)
- Culturally appropriate health guidelines (Indian foods, exercises)
- **Printable PDF results** to share with doctors

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | HTML5, CSS3, Vanilla JavaScript ES6+ |
| **UI Framework** | Bootstrap 5.3, Bootstrap Icons 1.11.3 |
| **OCR Engine** | Tesseract.js 5.x (WebAssembly) |
| **Translation** | MyMemory Translation API |
| **Storage** | Browser localStorage |
| **Architecture** | Modular JavaScript (11 core modules) |


## 📂 Project Structure

```
SwasthSathi/
├── index.html / about.html / screening.html / result.html
├── doctors.html / dashboard.html / login.html / signup.html / privacy.html
├── assets/
│   ├── styles/          base.css, home.css, screening.css, result.css, …
│   ├── scripts/
│   │   ├── shared/      supabase-client.js, nav-auth.js, i18n.js, main.js
│   │   ├── pages/       screening.js, result.js, dashboard.js, …
│   │   ├── modules/     risk-calculator.js, medical-validator.js, …
│   │   └── data/        language-data.js, doctors-data.js
│   └── i18n/            (Phase 1: pre-translated static dictionaries)
├── supabase/
│   └── migrations/      001_phase_0_rls_and_schema.sql (applied 2026-06-18)
└── docs/
    └── ARCHITECTURE.md
```


## 🚀 How to Run

### Option 1: Direct Browser
1. Download/clone the repository
2. Open `index.html` in any modern browser
3. Click **"Start Screening"**
4. Fill the form and get instant results

### Option 2: Live Server (VS Code)
1. Install "Live Server" extension
2. Right-click `index.html` → **Open with Live Server**
3. Access at `http://localhost:5500`

> ⚠️ **No installation or backend required** - runs completely in the browser!

---

## 📊 Risk Calculation Algorithm

### Evidence Base
- **NFHS-5 Study**: 636,699 households, 724,115+ participants
- **ADA Guidelines**: Blood sugar diagnostic criteria
- **JNC-8/AHA**: Blood pressure categories
- **WHO Standards**: Asian BMI cutoffs

### Point Allocation (Diabetes Risk)
```
Age ≥50 years:          30 points  (OR 14.46)
BMI ≥30:                25 points  (OR 12.39)
Blood Sugar ≥200:       40 points  (Direct measurement)
Prior Diagnosis:        50 points  (Confirmed case)
Symptoms (3+):          20 points  (Cluster significance)
Lifestyle factors:      15 points  (Modifiable risks)
```

### Risk Categories
- **Low Risk** (0-24): Maintain healthy lifestyle
- **Moderate Risk** (25-44): Lifestyle changes needed
- **High Risk** (45-69): Doctor visit within 1-2 weeks
- **Critical Risk** (70-100): Immediate medical attention

---

## 🎓 What I Learned

### Technical Skills
- Modular JavaScript architecture (11 modules, clear separation of concerns)
- Client-side OCR with Tesseract.js (WebAssembly)
- Medical data validation and clinical guideline implementation
- Translation system with caching strategy
- localStorage for persistent data management

### Domain Knowledge
- Evidence-based healthcare algorithm design
- NFHS-5 research paper analysis (Odds Ratios, statistical significance)
- ADA, JNC-8, WHO clinical guidelines
- Medical terminology and Indian healthcare context

### Product Design
- User-centric design (review/reject AI suggestions)
- Culturally appropriate health recommendations
- Accessibility for low-literacy users
- Ethical AI in healthcare (transparency, disclaimers)

---

## ⚠️ Important Disclaimers

### Medical Disclaimer
- ✅ **Screening tool** for early risk awareness
- ❌ **NOT a diagnostic tool** - cannot diagnose disease
- ⚠️ Algorithm uses rule-based scoring grounded in published guidelines (ADA, JNC-8, WHO, NFHS-5) but has **not been clinically validated** on patient data
- 🏥 **Always consult qualified healthcare professionals** for diagnosis and treatment

### Data Privacy
- Screening data is stored in Supabase Postgres, encrypted at rest, with Row-Level Security enforcing per-user isolation
- Only authenticated users can read or modify their own data (auth.uid() = user_id enforced at database level)
- Session tokens stored in browser localStorage; no advertising or third-party analytics cookies
- See [Privacy Policy](privacy.html) for full details

### Doctor Directory
- Information sourced from **publicly available platforms** (Google Maps)
- Platform **does not recommend, rank, or endorse** any doctor
- Ratings and reviews are from third-party platforms
- Users must **verify credentials independently**


## 👨‍💻 Developer

**Shlok Thakkar**  
2nd Year Computer Engineering Student  
Built for **ImpactThon 2025–26**

## 🔮 Future Enhancements

### Short-term (Hackathon to Production)
- [ ] Add Service Worker for true offline capability
- [ ] Pre-translate all content (eliminate API dependency)
- [ ] Implement data encryption (crypto-js)
- [ ] Add user authentication (Firebase)

### Long-term (Real-world Deployment)
- [ ] Backend API (Node.js + MongoDB)
- [ ] Medical professional validation of algorithm
- [ ] HIPAA/data protection compliance
- [ ] Mobile app (React Native)
- [ ] Historical trend graphs and progress tracking
- [ ] Integration with government health programs (Ayushman Bharat)

## 📄 License

This project is created for **educational purposes** as part of ImpactThon @KSV 2025-2026.

---

## 🙏 Acknowledgments

- **NFHS-5 Research Team** for comprehensive health data
- **ADA, JNC-8, WHO** for clinical guidelines
- **Tesseract.js** for open-source OCR
- **Bootstrap** for responsive UI framework
- **ImpactThon @KSV** for the opportunity to build solutions for social impact

---

## 📞 Contact

**Shlok Thakkar**  
2nd Year Computer Engineering  
📧 [Email](thakkarshlok2007@gmail.com)  
🔗 [LinkedIn Profile](https://www.linkedin.com/in/shlok-thakkar-58a033354?utm_source=share&utm_campaign=share_via&utm_content=profile&utm_medium=android_app)

---

<div align="center">

### ⭐ Star this repo if you found it helpful!

**Built with ❤️ for rural India**

</div>