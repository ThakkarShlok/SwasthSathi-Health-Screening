#!/usr/bin/env node
/**
 * Phase C — embed the validated guideline corpus and load it into pgvector.
 *
 * One-off local script. Reads corpus.json, embeds each chunk with Google
 * gemini-embedding-001 (truncated to 768 dims), and upserts into
 * public.guideline_chunks.
 *
 * Run:
 *   node ingest.mjs
 *
 * Secrets come from .env sitting next to this file (gitignored). The parser
 * below is deliberately minimal so this script has zero npm dependencies.
 * Node 20.6+ also supports `node --env-file=.env ingest.mjs` if you prefer
 * the built-in loader; either works, since already-set vars are never
 * overwritten.
 *
 * Safe to re-run: writes are upserts keyed on id.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

// text-embedding-004 was retired from the Generative Language API (404
// NOT_FOUND). gemini-embedding-001 is the stable GA replacement.
const EMBED_MODEL = 'gemini-embedding-001';

// gemini-embedding-001 returns 3072 dims by default; we request 768 explicitly
// so the vector fits the vector(768) column defined in migration 007.
const EXPECTED_DIM = 768;
const OUTPUT_DIMENSIONALITY = EXPECTED_DIM;   // tied on purpose — cannot drift

// ---------------------------------------------------------------------------
// Phase D guideline-chat MUST use the same model (gemini-embedding-001), same
// outputDimensionality (768), same normalization, and taskType RETRIEVAL_QUERY.
// Any mismatch between how documents were embedded here and how queries are
// embedded in Phase D will silently degrade retrieval.
// ---------------------------------------------------------------------------
const TASK_TYPE = 'RETRIEVAL_DOCUMENT';
const TABLE = 'guideline_chunks';
const DELAY_MS = 250;              // politeness gap between Google calls
const MAX_ATTEMPTS = 3;            // 1 try + 2 retries, for 429/5xx only

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------- env

/** Minimal .env reader. Does not overwrite vars already in the environment. */
function loadEnv() {
  let raw;
  try {
    raw = readFileSync(join(HERE, '.env'), 'utf8');
  } catch {
    return; // absent is fine if the vars are exported or --env-file was used
  }
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    // strip one layer of matching quotes, if present
    if (val.length >= 2 && /^(".*"|'.*')$/s.test(val)) val = val.slice(1, -1);
    if (!(key in process.env)) process.env[key] = val;
  }
}

loadEnv();

const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || '';

function die(msg) {
  console.error('\nERROR: ' + msg + '\n');
  process.exit(1);
}

const missing = [
  ['SUPABASE_URL', SUPABASE_URL],
  ['SUPABASE_SERVICE_ROLE_KEY', SERVICE_KEY],
  ['GOOGLE_API_KEY', GOOGLE_API_KEY]
].filter(([, v]) => !v || v.endsWith('-here')).map(([k]) => k);

if (missing.length) {
  die(
    'Missing or placeholder env var(s): ' + missing.join(', ') +
    '\nCopy .env.example to .env and fill in real values.'
  );
}

// ---------------------------------------------------------------- corpus

let corpus;
try {
  corpus = JSON.parse(readFileSync(join(HERE, 'corpus.json'), 'utf8'));
} catch (e) {
  die('Could not read/parse corpus.json: ' + e.message);
}

if (!Array.isArray(corpus) || corpus.length === 0) die('corpus.json is not a non-empty array.');

const TOTAL = corpus.length;
const ids = corpus.map((c) => c.id);
if (new Set(ids).size !== ids.length) die('corpus.json contains duplicate ids.');

const malformed = corpus.filter(
  (c) => !c.id || !c.topic || !c.source || typeof c.text !== 'string' || !c.text.trim()
);
if (malformed.length) {
  die('Chunk(s) missing required fields: ' + malformed.map((c) => c.id || '<no-id>').join(', '));
}

// ---------------------------------------------------------------- google

/**
 * Scale a vector to unit length so cosine similarity via pgvector's <=>
 * operator is correct.
 *
 * Google does NOT auto-normalize gemini-embedding-001 output when
 * outputDimensionality is below the 3072 default — the truncated vector comes
 * back unnormalized, so we must do it here.
 *
 * A zero or non-finite magnitude cannot be scaled to unit length and would
 * poison similarity search, so it is rejected rather than passed through.
 */
function normalize(values) {
  let sumSq = 0;
  for (const v of values) {
    if (!Number.isFinite(v)) throw new Error('embedding contains a non-finite value');
    sumSq += v * v;
  }
  const magnitude = Math.sqrt(sumSq);
  if (!(magnitude > 0)) throw new Error('embedding has zero magnitude — cannot normalize');
  return values.map((v) => v / magnitude);
}

/**
 * Embed one chunk. Retries only on 429 / 5xx, which are transient.
 * Returns a unit-length number[] of length EXPECTED_DIM.
 *
 * Asymmetric retrieval: these are the DOCUMENT side. taskType
 * RETRIEVAL_DOCUMENT here MUST be paired with RETRIEVAL_QUERY in the
 * guideline-chat function (Phase D). Changing one side requires re-embedding.
 *
 * Phase D guideline-chat MUST use the same model (gemini-embedding-001), same
 * outputDimensionality (768), same normalization, and taskType RETRIEVAL_QUERY.
 * Any mismatch between how documents were embedded here and how queries are
 * embedded in Phase D will silently degrade retrieval.
 */
async function embed(text) {
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL}:embedContent` +
    `?key=${encodeURIComponent(GOOGLE_API_KEY)}`;

  let lastErr;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let res;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: `models/${EMBED_MODEL}`,
          content: { parts: [{ text }] },
          taskType: TASK_TYPE,
          outputDimensionality: OUTPUT_DIMENSIONALITY
        })
      });
    } catch (e) {
      lastErr = new Error('network error: ' + e.message);
      if (attempt < MAX_ATTEMPTS) { await sleep(500 * attempt); continue; }
      throw lastErr;
    }

    if (res.status === 429 || res.status >= 500) {
      lastErr = new Error(`Google API ${res.status}: ${(await res.text()).slice(0, 300)}`);
      if (attempt < MAX_ATTEMPTS) { await sleep(1000 * attempt); continue; }
      throw lastErr;
    }
    if (!res.ok) {
      // 4xx other than 429 (bad key, bad request) — retrying will not help.
      throw new Error(`Google API ${res.status}: ${(await res.text()).slice(0, 300)}`);
    }

    const json = await res.json();
    const values = json?.embedding?.values;
    if (!Array.isArray(values)) {
      throw new Error('unexpected response shape: no embedding.values array');
    }
    // Normalize before the dimension check and before upsert.
    return normalize(values);
  }
  throw lastErr;
}

// ---------------------------------------------------------------- supabase

/**
 * Upsert one row via PostgREST using the service-role key (bypasses RLS).
 * on_conflict=id + resolution=merge-duplicates makes re-runs idempotent:
 * an existing id is UPDATEd, which also fires the set_updated_at trigger.
 */
async function upsert(row) {
  const url = `${SUPABASE_URL}/rest/v1/${TABLE}?on_conflict=id`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal'
    },
    body: JSON.stringify(row)
  });
  if (!res.ok) {
    throw new Error(`Supabase ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
}

// ---------------------------------------------------------------- run

console.log(`\nIngesting ${TOTAL} chunks -> ${SUPABASE_URL}/rest/v1/${TABLE}`);
console.log(`Model: ${EMBED_MODEL}, outputDimensionality=${OUTPUT_DIMENSIONALITY} (expecting ${EXPECTED_DIM} dims)`);
console.log('Normalizing to unit length (Google does not auto-normalize below 3072 dims)');
console.log(`taskType: ${TASK_TYPE} — Phase D must query with RETRIEVAL_QUERY\n`);

const failures = [];
let done = 0;

for (const [i, chunk] of corpus.entries()) {
  const label = `[${String(i + 1).padStart(2)}/${TOTAL}] ${chunk.id}`;

  let values;
  try {
    values = await embed(chunk.text);
  } catch (e) {
    console.log(`${label}  EMBED FAILED — ${e.message}`);
    failures.push({ id: chunk.id, stage: 'embed', error: e.message });
    await sleep(DELAY_MS);
    continue;
  }

  // Hard stop on a dimension mismatch. Unlike a network blip this is systemic
  // (outputDimensionality ignored, wrong model, or the API contract changed)
  // and would affect every remaining chunk, so it is not a soft failure.
  if (values.length !== EXPECTED_DIM) {
    console.error(
      `\n${label}  DIMENSION MISMATCH — got ${values.length}, expected ${EXPECTED_DIM}.`
    );
    console.error(`Aborting before insert. ${done} chunk(s) were already written.`);
    console.error(`The vector(${EXPECTED_DIM}) column would reject this row anyway.\n`);
    process.exit(1);
  }

  // pgvector accepts a bracketed, comma-separated literal: "[0.1,-0.2,...]".
  // JSON.stringify on a number[] produces exactly that. Scientific notation
  // (e.g. 1e-7) is fine — pgvector's parser handles exponents.
  const embedding = JSON.stringify(values);

  try {
    await upsert({
      id: chunk.id,
      topic: chunk.topic,
      subtopic: chunk.subtopic ?? null,
      source: chunk.source,
      question_hint: chunk.question_hint ?? null,
      chunk_text: chunk.text,   // corpus "text" -> column "chunk_text"
      embedding
    });
  } catch (e) {
    console.log(`${label}  INSERT FAILED — ${e.message}`);
    failures.push({ id: chunk.id, stage: 'insert', error: e.message });
    await sleep(DELAY_MS);
    continue;
  }

  done++;
  console.log(`${label}  embedded (${values.length}d) + upserted`);
  await sleep(DELAY_MS);
}

console.log(`\nEmbedded and inserted ${done}/${TOTAL} chunks.`);
if (failures.length === 0) {
  console.log('Failures: none\n');
} else {
  console.log(`Failures: [${failures.map((f) => f.id).join(', ')}]`);
  for (const f of failures) console.log(`  - ${f.id} (${f.stage}): ${f.error}`);
  console.log('\nRe-run the script to retry — upsert makes this safe.\n');
  process.exit(1);
}
