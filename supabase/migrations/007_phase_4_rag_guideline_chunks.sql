-- ============================================
-- 007_phase_4_rag_guideline_chunks.sql
-- Phase 4: Guideline-grounded RAG assistant
-- Stores curated clinical guideline chunks + their embeddings (Google text-embedding-004, dim 768)
-- Enables cosine-similarity retrieval for the result-scoped health assistant.
-- ============================================

-- Enable pgvector (safe if already enabled)
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS public.guideline_chunks (
    id TEXT PRIMARY KEY,
    topic TEXT NOT NULL,
    subtopic TEXT,
    source TEXT NOT NULL,
    question_hint TEXT,
    chunk_text TEXT NOT NULL,
    embedding vector(768),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Cosine-distance index for fast similarity search.
-- ivfflat needs rows present to build well; with only ~31 rows it is fine to create now,
-- lists=1 is appropriate for a tiny table (a single list; exact search in practice).
CREATE INDEX IF NOT EXISTS idx_guideline_chunks_embedding
    ON public.guideline_chunks
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 1);

CREATE INDEX IF NOT EXISTS idx_guideline_chunks_topic
    ON public.guideline_chunks (topic);

COMMENT ON TABLE public.guideline_chunks IS
    'Curated clinical guideline passages + Google text-embedding-004 (dim 768) embeddings for the result-scoped RAG health assistant. Content sourced from WHO factsheets and matched to risk-calculator.js thresholds.';

-- Row Level Security: chunks are non-sensitive public health guidance, but writes must be locked down.
ALTER TABLE public.guideline_chunks ENABLE ROW LEVEL SECURITY;

-- Allow anon + authenticated to READ chunks (needed by the Edge Function retrieval).
-- No PII here — this is public guideline text.
-- DROP first: CREATE POLICY has no IF NOT EXISTS form, so without this the
-- migration errors on any re-run. Matches the defensive trigger pattern in 006.
DROP POLICY IF EXISTS "guideline_chunks_read" ON public.guideline_chunks;
CREATE POLICY "guideline_chunks_read" ON public.guideline_chunks
    FOR SELECT TO anon, authenticated USING (true);

-- No INSERT/UPDATE/DELETE policy for anon/authenticated — ingestion happens via service role only.

-- Keep updated_at honest on re-ingestion. Reuses update_updated_at_column()
-- defined in migration 001; without this trigger the column would only ever
-- hold its INSERT-time default.
DROP TRIGGER IF EXISTS set_updated_at ON public.guideline_chunks;
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON public.guideline_chunks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


-- ============================================
-- Similarity search function
-- ============================================

CREATE OR REPLACE FUNCTION public.match_guideline_chunks(
    query_embedding vector(768),
    match_count int DEFAULT 5
)
RETURNS TABLE (
    id TEXT,
    topic TEXT,
    source TEXT,
    question_hint TEXT,
    chunk_text TEXT,
    similarity float
)
-- search_path is pinned so the Supabase linter's function_search_path_mutable
-- check passes. 'extensions' is included because Supabase installs pgvector
-- there by default — without it the <=> operator would not resolve at runtime.
LANGUAGE sql STABLE
SET search_path = public, extensions
AS $$
    SELECT
        gc.id,
        gc.topic,
        gc.source,
        gc.question_hint,
        gc.chunk_text,
        1 - (gc.embedding <=> query_embedding) AS similarity
    FROM public.guideline_chunks gc
    WHERE gc.embedding IS NOT NULL
    ORDER BY gc.embedding <=> query_embedding
    LIMIT match_count;
$$;

COMMENT ON FUNCTION public.match_guideline_chunks IS
    'Returns the match_count guideline chunks most similar (cosine) to query_embedding. Used by the guideline-chat Edge Function for retrieval.';
