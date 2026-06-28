-- ============================================
-- 002_phase_2a_cost_protection.sql
-- Phase 2A: api_usage_log, ocr_cache, doctor_search_cache
-- Rate limits: OCR 10/hr, LLM 5/hr, Places 5/hr per user
-- ============================================

-- ----------------------------------------
-- API USAGE LOG (rate-limiting)
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS public.api_usage_log (
    id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    api_name    TEXT        NOT NULL CHECK (api_name IN ('ocr', 'llm', 'places')),
    called_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status_code INTEGER,
    cost_units  INTEGER     NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_api_usage_user_api_time
    ON public.api_usage_log (user_id, api_name, called_at DESC);

ALTER TABLE public.api_usage_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own api usage"
    ON public.api_usage_log FOR SELECT
    USING (auth.uid() = user_id);

-- Edge Functions run as service role — no user RLS restriction on insert
CREATE POLICY "Service role inserts api usage"
    ON public.api_usage_log FOR INSERT
    WITH CHECK (TRUE);

-- ----------------------------------------
-- OCR CACHE (image hash → extracted fields)
-- 24-hour TTL; deduplicates identical uploads
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS public.ocr_cache (
    id             UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
    image_hash     TEXT        NOT NULL UNIQUE,   -- SHA-256 hex of image bytes
    extracted_json JSONB       NOT NULL,           -- {blood_sugar, blood_pressure, hba1c, …}
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at     TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours')
);

CREATE INDEX IF NOT EXISTS idx_ocr_cache_hash    ON public.ocr_cache (image_hash);
CREATE INDEX IF NOT EXISTS idx_ocr_cache_expires ON public.ocr_cache (expires_at);

ALTER TABLE public.ocr_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read ocr cache"
    ON public.ocr_cache FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "Service role insert ocr cache"
    ON public.ocr_cache FOR INSERT
    WITH CHECK (TRUE);

-- ----------------------------------------
-- DOCTOR SEARCH CACHE (Google Places results)
-- 24-hour TTL; key = lat:lng:type (3 d.p.)
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS public.doctor_search_cache (
    id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
    cache_key    TEXT        NOT NULL UNIQUE,  -- e.g. "19.076:72.877:endocrinologist"
    results_json JSONB       NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at   TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours')
);

CREATE INDEX IF NOT EXISTS idx_doctor_cache_key     ON public.doctor_search_cache (cache_key);
CREATE INDEX IF NOT EXISTS idx_doctor_cache_expires ON public.doctor_search_cache (expires_at);

ALTER TABLE public.doctor_search_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read doctor cache"
    ON public.doctor_search_cache FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "Service role insert doctor cache"
    ON public.doctor_search_cache FOR INSERT
    WITH CHECK (TRUE);
