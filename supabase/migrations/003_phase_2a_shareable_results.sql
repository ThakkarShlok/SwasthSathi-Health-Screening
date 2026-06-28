-- Phase 2A: Shareable result URLs
-- Adds result_short_code to health_screenings and allows public read of shared rows.

ALTER TABLE health_screenings
    ADD COLUMN IF NOT EXISTS result_short_code VARCHAR(8) UNIQUE;

CREATE INDEX IF NOT EXISTS idx_health_screenings_short_code
    ON health_screenings (result_short_code)
    WHERE result_short_code IS NOT NULL;

-- Allow anyone (unauthenticated) to read a screening row by its short code.
-- RLS must be enabled on health_screenings (it is, from Phase 1).
CREATE POLICY "public_read_by_short_code"
    ON health_screenings
    FOR SELECT
    TO anon
    USING (result_short_code IS NOT NULL);
