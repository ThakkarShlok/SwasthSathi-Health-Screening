-- ============================================
-- 008_phase_4_rag_guideline_chat_usage.sql
-- Phase 4: allow api_name = 'rag' in api_usage_log
--
-- Migration 002 defined CHECK (api_name IN ('ocr','llm','places')). The
-- guideline-chat Edge Function logs under 'rag', which that constraint
-- rejects. logUsage() does not inspect the insert result, so the failure is
-- silent: every RAG call would go unlogged, and because checkRateLimit()
-- counts rows in this table, the endpoint would be effectively unlimited.
-- Rate limiting for 'rag' does not work until this migration is applied.
-- ============================================

ALTER TABLE public.api_usage_log
    DROP CONSTRAINT IF EXISTS api_usage_log_api_name_check;

ALTER TABLE public.api_usage_log
    ADD CONSTRAINT api_usage_log_api_name_check
    CHECK (api_name IN ('ocr', 'llm', 'places', 'rag'));

COMMENT ON COLUMN public.api_usage_log.api_name IS
    'Paid API this call billed against: ocr (Google Vision), llm (Claude recommendations), places (Google Maps), rag (Claude guideline-chat + Google embeddings). Per-hour limits live in supabase/functions/_shared/rate-limit.ts.';
