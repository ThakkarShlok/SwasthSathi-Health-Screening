-- ============================================
-- 006_phase_2b_add_updated_at_column.sql
-- Phase 2B: Add missing updated_at column
-- Root cause: Migration 001 defined updated_at + trigger, but production
-- table was created before migration 001 ran (CREATE TABLE IF NOT EXISTS
-- was a no-op). The trigger has been broken since Phase 0 — surfaced only
-- now that Task 4.2 introduced the first UPDATE code path.
-- ============================================

ALTER TABLE public.health_screenings
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Backfill existing rows with created_at value so they aren't NULL
UPDATE public.health_screenings
    SET updated_at = created_at
    WHERE updated_at IS NULL;

-- Ensure the trigger from migration 001 still exists and points to the
-- function correctly. Recreate defensively in case function definition drifted.
DROP TRIGGER IF EXISTS set_updated_at ON public.health_screenings;
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON public.health_screenings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
