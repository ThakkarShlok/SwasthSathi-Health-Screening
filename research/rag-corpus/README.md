# SwasthSathi RAG Assistant — Guideline Corpus

Curated clinical guideline passages that ground the result-scoped health
assistant (Phase 4). The assistant answers ONLY from this corpus via
retrieval-augmented generation — never from unconstrained model memory.

## Files
- corpus-raw.md   : source corpus, human-readable, with provenance per chunk
- corpus.json     : (generated) validated, ingestion-ready format for embedding

## Provenance
- Diabetes chunks: WHO Diabetes Fact Sheet (who.int)
- Hypertension chunks: WHO Hypertension Fact Sheet (who.int)
- Numeric thresholds: taken from SwasthSathi risk-calculator.js so answers
  stay consistent with the tool's own scoring
- Tool-scope chunks: describe SwasthSathi's boundaries

## Verification requirement
Every chunk must be reviewed for clinical accuracy by a medically-aware
person before production use. Threshold chunks must match risk-calculator.js.
