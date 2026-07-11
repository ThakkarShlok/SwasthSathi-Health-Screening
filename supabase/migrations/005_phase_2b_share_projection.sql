-- ============================================
-- 005_phase_2b_share_projection.sql
-- Phase 2B: Defense-in-depth for shared results
-- Creates a view that projects only PII-safe fields
-- Migrates anon SELECT policy from table to view
-- Depends on migration 004 (needs assessment_tier, data_completeness_percentage)
-- ============================================

CREATE OR REPLACE VIEW public.shared_screening_results AS
SELECT
    id,
    result_short_code,
    computed_risk_score,
    diabetes_risk_score,
    hypertension_risk_score,
    risk_category,
    algorithm_version,
    assessment_tier,
    data_completeness_percentage,
    created_at
FROM public.health_screenings
WHERE result_short_code IS NOT NULL;

-- Grant anon SELECT on the view (safe: view only projects non-PII columns)
GRANT SELECT ON public.shared_screening_results TO anon;

-- Revoke the old direct-table anon policy from migration 003
DROP POLICY IF EXISTS "public_read_by_short_code" ON public.health_screenings;

COMMENT ON VIEW public.shared_screening_results IS
    'PII-safe projection for shareable result URLs. Anon role has SELECT here instead of on health_screenings.';
