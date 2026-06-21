-- ============================================================
-- SwasthSathi Phase 0 Migration
-- Applied: 2026-06-18
-- Status: ALREADY APPLIED to production Supabase project.
--         This file is DOCUMENTATION ONLY. Do NOT re-execute.
-- ============================================================

-- ----------------------------------------------------------------
-- 1. USER PROFILES TABLE
-- ----------------------------------------------------------------

CREATE TABLE IF NOT EXISTS user_profiles (
    id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name    TEXT,
    city         TEXT,
    state        TEXT,
    created_at   TIMESTAMPTZ DEFAULT now()
);

-- Row-Level Security: each user can only read/write their own profile
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
    ON user_profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
    ON user_profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
    ON user_profiles FOR UPDATE
    USING (auth.uid() = id);


-- ----------------------------------------------------------------
-- 2. HEALTH SCREENINGS TABLE (core + risk snapshot columns)
-- ----------------------------------------------------------------

CREATE TABLE IF NOT EXISTS health_screenings (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                 UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Patient basics
    patient_name            TEXT NOT NULL,
    age                     INTEGER NOT NULL,
    gender                  TEXT NOT NULL,
    height                  NUMERIC,
    weight                  NUMERIC,
    waist_circumference     NUMERIC,

    -- Known conditions
    diabetes                TEXT,
    hypertension            TEXT,

    -- Symptoms (diabetes-related)
    frequent_urination      BOOLEAN DEFAULT FALSE,
    nocturia                BOOLEAN DEFAULT FALSE,
    excessive_thirst        BOOLEAN DEFAULT FALSE,
    weight_loss             BOOLEAN DEFAULT FALSE,
    fatigue                 BOOLEAN DEFAULT FALSE,
    blurred_vision          BOOLEAN DEFAULT FALSE,

    -- Symptoms (hypertension-related)
    headache                BOOLEAN DEFAULT FALSE,
    dizziness               BOOLEAN DEFAULT FALSE,
    palpitations            BOOLEAN DEFAULT FALSE,
    chest_pain              BOOLEAN DEFAULT FALSE,
    breathlessness          BOOLEAN DEFAULT FALSE,

    -- Free-text symptoms
    additional_symptoms     TEXT,

    -- Lifestyle
    physical_activity       TEXT,
    diet_pattern            TEXT,
    smoking                 TEXT,
    alcohol                 TEXT,
    family_history          TEXT,

    -- Lab readings (optional, user-entered or OCR-extracted)
    blood_sugar             NUMERIC,
    blood_pressure          TEXT,

    -- ── Risk Snapshot (computed at submission time, Phase 0) ──
    -- Stores the algorithm output so dashboard/result.js can read
    -- stored values instead of recomputing on every page load.
    computed_risk_score     NUMERIC,           -- combined score 0-100
    diabetes_risk_score     NUMERIC,           -- diabetes sub-score 0-100
    hypertension_risk_score NUMERIC,           -- hypertension sub-score 0-100
    risk_category           TEXT,             -- 'Low' | 'Moderate' | 'High' | 'Very High'
    algorithm_version       TEXT,             -- e.g. 'rule-v1.3'
    language_at_screening   TEXT,             -- 'en' | 'hi' | 'gu' | 'mr'

    -- ── Phase 2 columns (reserved, nullable) ──
    result_short_code       TEXT,             -- QR-friendly short code (Phase 2)
    ai_recommendation_text  TEXT,             -- LLM-generated advice (Phase 2)

    -- Consent flag
    consent_to_research     BOOLEAN DEFAULT FALSE,

    -- Timestamps
    created_at              TIMESTAMPTZ DEFAULT now(),
    updated_at              TIMESTAMPTZ DEFAULT now()
);

-- Row-Level Security: users can only access their own screenings
ALTER TABLE health_screenings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own screenings"
    ON health_screenings FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own screenings"
    ON health_screenings FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own screenings"
    ON health_screenings FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own screenings"
    ON health_screenings FOR DELETE
    USING (auth.uid() = user_id);


-- ----------------------------------------------------------------
-- 3. UPDATED_AT TRIGGER
-- ----------------------------------------------------------------

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON health_screenings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


-- ----------------------------------------------------------------
-- 4. INDEXES
-- ----------------------------------------------------------------

-- Fast lookup of all screenings for a given user, newest first
CREATE INDEX IF NOT EXISTS idx_health_screenings_user_id_created
    ON health_screenings (user_id, created_at DESC);


-- ================================================================
-- END OF MIGRATION
-- Applied: 2026-06-18 | Do NOT re-execute against live database
-- ================================================================
