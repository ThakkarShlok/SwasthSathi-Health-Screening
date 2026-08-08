# SwasthSathi — System Architecture

**Version:** Phase 0 (Foundation)  
**Last Updated:** June 2026  
**Team:** COGNITEX, KSV University  

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Technology Choices & Rationale](#2-technology-choices--rationale)
3. [Directory Structure](#3-directory-structure)
4. [Data Flow](#4-data-flow)
5. [Security Model](#5-security-model)
6. [Risk Assessment Algorithm](#6-risk-assessment-algorithm)
7. [Component Architecture](#7-component-architecture)
8. [Phased Implementation Plan](#8-phased-implementation-plan)

---

## 1. System Overview

SwasthSathi is a multilingual, browser-based health screening web app targeting rural India. It screens for Type 2 Diabetes and Hypertension risk using a rule-based scoring algorithm grounded in published clinical guidelines (ADA, JNC-8, WHO, NFHS-5).

```
┌──────────────────────────────────────────────────────────────┐
│                        BROWSER (Client)                       │
│                                                              │
│  ┌────────────┐   ┌────────────┐   ┌──────────────────────┐ │
│  │ HTML Pages │──▶│ JS Modules │──▶│ Supabase REST Client │ │
│  │ (8 pages)  │   │ (shared +  │   │  (supabase-client.js)│ │
│  │            │   │  pages)    │   └──────────┬───────────┘ │
│  └────────────┘   └────────────┘              │              │
│                         │                     │              │
│                   ┌─────▼──────┐              │              │
│                   │ OCR Engine  │              │              │
│                   │(Tesseract.js│              │              │
│                   │ in-browser) │              │              │
│                   └────────────┘              │              │
└───────────────────────────────────────────────┼──────────────┘
                                                │ HTTPS
                                    ┌───────────▼───────────┐
                                    │    SUPABASE (Cloud)    │
                                    │                        │
                                    │  ┌──────────────────┐ │
                                    │  │   Auth (JWT)     │ │
                                    │  └──────────────────┘ │
                                    │  ┌──────────────────┐ │
                                    │  │  PostgreSQL DB   │ │
                                    │  │  + Row-Level     │ │
                                    │  │    Security      │ │
                                    │  └──────────────────┘ │
                                    └───────────────────────┘
```

**Key design decisions:**
- No backend server — the app is fully static HTML/CSS/JS served from any web host.
- All health computation happens in the browser; no patient data is sent to third-party analytics services.
- OCR image processing is 100% client-side (Tesseract.js WASM); medical report photos never leave the device.

---

## 2. Technology Choices & Rationale

| Technology | Version | Why |
|---|---|---|
| HTML5 / CSS3 / Vanilla JS (ES6+) | — | No build step, no framework churn, deployable anywhere |
| Bootstrap | 5.3.2 (CDN) | Mature responsive grid; saves significant CSS authoring time |
| Bootstrap Icons | 1.11.3 (CDN) | Consistent SVG icon set matching Bootstrap's visual language |
| Supabase | Managed cloud | Provides Auth + Postgres + REST API without server management; free tier adequate for Phase 0 |
| Tesseract.js | 5.x (CDN) | Runs OCR in WebAssembly, fully offline after first load; no image uploads |
| MyMemory Translation API | — | Phase 0 placeholder; will be replaced by static dictionaries in Phase 1 |

**Why no React / Vue / Angular?**  
Rural target users often access the app on low-end devices. A pure HTML/JS app loads and runs faster, and the codebase remains accessible to contributors without a JS ecosystem toolchain.

**Why Supabase over Firebase?**  
Supabase offers native PostgreSQL with row-level security enforced at the database engine level — not just application middleware. The SQL migration approach also provides version-controlled schema history.

---

## 3. Directory Structure

```
SwasthSathi Website Demo/
├── index.html              # Homepage
├── about.html              # Team & mission
├── screening.html          # Health screening form
├── result.html             # Risk assessment results
├── doctors.html            # Specialist directory
├── dashboard.html          # User screening history
├── login.html              # Authentication
├── signup.html             # Registration
├── privacy.html            # Privacy policy (DPDP Act 2023)
│
├── assets/
│   ├── styles/
│   │   ├── base.css        # Design system tokens (DO NOT MODIFY)
│   │   ├── style.css       # Homepage & About shared styles
│   │   ├── screening.css   # Screening form + result pages
│   │   ├── result.css      # Results-specific styles
│   │   ├── about.css       # About page styles
│   │   ├── doctors.css     # Doctors directory styles
│   │   ├── dashboard.css   # Dashboard styles
│   │   └── auth.css        # Login / Signup styles
│   │
│   └── scripts/
│       ├── shared/
│       │   ├── main.js             # Global scroll/animation init
│       │   ├── navbar.js           # Shared navbar component (DOMContentLoaded inject)
│       │   ├── footer.js           # Shared footer component (DOMContentLoaded inject)
│       │   ├── i18n.js             # Translation engine
│       │   ├── nav-auth.js         # Auth state → navbar CTA button
│       │   └── supabase-client.js  # Supabase REST wrapper + data transforms
│       │
│       ├── pages/
│       │   ├── screening.js        # Form collection + OCR suggestions + save
│       │   ├── result.js           # Risk display + guidelines rendering
│       │   ├── dashboard.js        # Screening history + stats
│       │   ├── login.js            # Auth login flow
│       │   ├── signup.js           # Auth signup + profile creation
│       │   └── doctors.js          # Doctor card rendering
│       │
│       ├── modules/
│       │   ├── risk-calculator.js  # Core algorithm (FROZEN — do not modify logic)
│       │   ├── medical-validator.js # Input validation (FROZEN)
│       │   ├── form-suggester.js   # OCR value → form field suggestion UI
│       │   └── ocr-parser.js       # Tesseract.js orchestration
│       │
│       └── data/
│           ├── language-data.js    # All UI strings in 4 languages
│           └── doctors-data.js     # Static specialist directory
│
├── supabase/
│   └── migrations/
│       └── 001_phase_0_rls_and_schema.sql  # Schema reference (applied 2026-06-18)
│
├── docs/
│   └── ARCHITECTURE.md     # This file
│
└── Images/                 # Team member photos
```

---

## 4. Data Flow

### 4.1 Screening Submission

```
User fills form
      │
      ▼
screening.js: collectFormData()
      │
      ▼
medical-validator.js: validateFormData()       ← rejects invalid input
      │
      ▼
risk-calculator.js: assessHealthRisk()         ← computes risk snapshot
 Returns: { combined, diabetes, hypertension,
            recommendations, guidelines }
      │
      ▼
Attach snapshot to patientData:
 computedRiskScore, diabetesRiskScore,
 hypertensionRiskScore, riskCategory,
 algorithmVersion, languageAtScreening
      │
      ▼
supabase-client.js: saveScreening()
 → transformToSupabaseFormat()                 ← maps camelCase → snake_case
 → POST /rest/v1/health_screenings             ← requires valid JWT (RLS)
      │
      ▼
Supabase: inserts row; RLS verifies user_id = auth.uid()
      │
      ▼
result.html                                    ← displays stored snapshot + recomputed details
```

### 4.2 Results Display

```
result.html loads
      │
      ▼
result.js: fetchUserData()
  → getLatestScreening() or getUserScreenings()[index]
  → transformFromSupabaseFormat()              ← maps snake_case → camelCase
      │
      ▼
window.RiskCalculator.assessHealthRisk(patientData)  ← recompute for factors/guidelines
      │
      ▼
Override scores with stored snapshot           ← prevents drift if algorithm updates
(computedRiskScore, diabetesRiskScore,
 hypertensionRiskScore, riskCategory)
      │
      ▼
renderResultsUI(assessment)                    ← DOM population
```

### 4.3 Language / i18n Flow

```
Page loads → i18n.js initialises translator
           → reads localStorage for saved language
           → applies data-i18n attributes from language-data.js
           → navbar.js / footer.js inject HTML → translator.applyTranslations()
User switches language → translator.setLanguage(code)
                       → re-applies all data-i18n bindings
                       → updates language dropdown flag + label
```

---

## 5. Security Model

### Authentication

- Supabase Auth issues JWTs on login/signup.
- JWTs are stored in `localStorage` (browser only). No server-side session state.
- Token is included as `Authorization: Bearer <token>` on every Supabase REST call.

### Database Row-Level Security (RLS)

Every table enforces RLS at the PostgreSQL engine level:

```sql
-- health_screenings: enforced on SELECT, INSERT, UPDATE, DELETE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id)
```

This means:
- A user with a valid JWT cannot read another user's rows, even if they forge the URL.
- The anon key (exposed in `supabase-client.js`) can only perform operations that pass RLS — it cannot bypass it.

### Anonymous Public Key Exposure

The `supabaseKey` in `supabase-client.js` is the **anon public key**, designed to be exposed in client code. It grants only what RLS allows. The service role key (which bypasses RLS) is never exposed to the client.

### Removed Anonymous Session Flow (Phase 0)

Prior to Phase 0, the app used a `session_fingerprint` (localStorage UUID) to support unauthenticated screenings. This was removed because:
1. RLS `WITH CHECK (auth.uid() = user_id)` rejects rows with null `user_id`.
2. Anonymous data pollutes the database and cannot be attributed or deleted per DPDP Act rights.

### OCR Data

Medical report images selected by the user are processed locally by Tesseract.js (WebAssembly). They are never uploaded to any server.

---

## 6. Risk Assessment Algorithm

**File:** `assets/scripts/modules/risk-calculator.js`  
**Version constant:** `ALGORITHM_VERSION = 'rule-v1.3'`  
**Status:** FROZEN — no weight, threshold, or formula changes without a version bump.

### Scoring Overview

The algorithm computes three scores (0–100):

| Score | Inputs | Clinical Basis |
|---|---|---|
| `diabetesRisk` | Age, BMI, waist, family history, symptoms, blood sugar, lifestyle | ADA risk factors, NFHS-5 OR weights |
| `hypertensionRisk` | Age, BMI, smoking, alcohol, symptoms, blood pressure, lifestyle | JNC-8 risk factors, WHO guidelines |
| `combinedRisk` | Weighted average of above with metabolic syndrome bonus | NFHS-5 co-morbidity data |

### Category Thresholds

| Score | Category | Color | Urgency |
|---|---|---|---|
| ≥ 50 | Critical Risk | danger (red) | urgent |
| ≥ 40 | High Risk | danger (red) | high |
| ≥ 25 | Moderate Risk | warning (yellow) | medium |
| < 25 | Low Risk | success (green) | low |

### Important Limitations

- The algorithm is **not clinically validated** on patient outcome data.
- Scores are grounded in published guidelines but have not been tested against real diagnostic outcomes.
- This tool raises awareness; it does not diagnose.

---

## 7. Component Architecture

### Shared Components (navbar.js / footer.js)

Every page has two mount points:

```html
<body>
  <div id="navbar-mount"></div>
  <!-- page content -->
  <div id="footer-mount"></div>
</body>
```

`navbar.js` and `footer.js` inject their HTML on `DOMContentLoaded`. The footer calls `window.translator.applyTranslations()` after injection so `data-i18n` attributes in the injected HTML are translated.

### Script Load Order (all pages)

```
bootstrap.bundle.min.js   ← Bootstrap dropdowns (needed by navbar)
language-data.js          ← Translation strings (needed by i18n.js)
i18n.js                   ← Translator init (needed by navbar/footer)
supabase-client.js        ← Auth client (needed by nav-auth.js)
navbar.js                 ← Injects nav HTML + triggers i18n
footer.js                 ← Injects footer HTML + triggers i18n
nav-auth.js               ← Populates #navAuthSection based on auth state
[page-specific scripts]   ← e.g. screening.js, result.js, dashboard.js
```

### i18n Architecture

`language-data.js` exports all UI strings as a JS object keyed by language code (`en`, `hi`, `gu`, `mr`). `i18n.js` reads `data-i18n` attributes from the DOM and replaces `textContent`. The translator is exposed as `window.translator`.

---

## 8. Phased Implementation Plan

### Phase 0 — Foundation (Complete, June 2026)
- File restructure into `assets/`, `supabase/`, `docs/`
- Remove fake accuracy claims and hackathon branding
- Remove anonymous screening flow; enforce auth gate on screening page
- Shared navbar/footer components (single source of truth)
- Privacy policy (DPDP Act 2023)
- Algorithm version constant (`rule-v1.3`)
- Risk snapshot stored at submission time (prevents score drift)
- Migration SQL documented in `supabase/migrations/`

### Phase 1 — Language & Translation (Planned, July–August 2026)
- Replace MyMemory API with offline static translation dictionaries
- Expand `language-data.js` to cover all UI strings in Hindi, Gujarati, Marathi
- RTL consideration for future Urdu support
- Translated PDF result report generation

### Phase 2 — AI Recommendations (Planned, Q4 2026)
- Populate `ai_recommendation_text` column using Claude API via Supabase Edge Function
- Replace Tesseract.js OCR with Google Cloud Vision for improved accuracy
- Populate `result_short_code` for QR-based result sharing
- Consent gate (`consent_to_research` checkbox) on screening form

### Phase 3 — Scale & Validation (2027)
- Clinical validation partnership with a healthcare institution
- Offline Progressive Web App (PWA) support for low-connectivity areas
- Aggregated (de-identified) dashboard for public health researchers
- Edge case handling: pregnancy, paediatric screening variants

---

*Architecture decisions owned by Team COGNITEX. Questions: support.swasthsathi@gmail.com*
