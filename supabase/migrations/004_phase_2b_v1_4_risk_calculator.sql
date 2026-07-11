-- ============================================
-- 004_phase_2b_v1_4_risk_calculator.sql
-- Phase 2B: Risk Calculator v1.4 columns
-- Adds: assessment_tier, factor_contributions, data_completeness_percentage, hba1c
-- Backfill: not required — 36 existing rows retain algorithm_version='rule-v1.3'
-- and NULL for new columns, which is correct semantics (legacy assessment).
-- ============================================

ALTER TABLE public.health_screenings
    ADD COLUMN IF NOT EXISTS assessment_tier VARCHAR(20)
        CHECK (assessment_tier IN ('baseline', 'partial', 'enhanced')),
    ADD COLUMN IF NOT EXISTS factor_contributions JSONB,
    ADD COLUMN IF NOT EXISTS data_completeness_percentage INTEGER
        CHECK (data_completeness_percentage BETWEEN 0 AND 100),
    ADD COLUMN IF NOT EXISTS hba1c NUMERIC(4,2)
        CHECK (hba1c BETWEEN 3.0 AND 20.0);

CREATE INDEX IF NOT EXISTS idx_health_screenings_algorithm_version
    ON public.health_screenings (algorithm_version)
    WHERE algorithm_version IS NOT NULL;

COMMENT ON COLUMN public.health_screenings.assessment_tier IS
    'baseline = no lab data, partial = some lab data, enhanced = full lab data (HbA1c + FBS + BP)';
COMMENT ON COLUMN public.health_screenings.factor_contributions IS
    'JSONB {diabetes: [...], hypertension: [...]} where each entry is {id, label, points, category, direction}. Category is modifiable|non_modifiable|clinical. Direction is positive|protective.';
COMMENT ON COLUMN public.health_screenings.hba1c IS
    'HbA1c percentage from lab report. Range 3.0-20.0. NULL means not provided.';
