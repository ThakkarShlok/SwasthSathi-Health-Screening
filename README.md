<div align="center">

<img src="assets/logo/swasthsathi-logo-horizontal.svg" alt="SwasthSathi" width="380">

### Guideline-grounded health screening for rural India

**A retrieval-augmented clinical assistant, a tiered risk-assessment engine, and a serverless backend — delivering free diabetes and hypertension screening in four languages.**

[![Live](https://img.shields.io/badge/live-swasthsathi.app-10b981?style=flat-square)](https://swasthsathi.app)
[![PWA](https://img.shields.io/badge/PWA-installable-3b82f6?style=flat-square)](https://swasthsathi.app)
[![Backend](https://img.shields.io/badge/backend-Deno%20%2B%20TypeScript-000000?style=flat-square)](#backend-engineering)
[![Vector](https://img.shields.io/badge/vector%20store-pgvector-336791?style=flat-square)](#retrieval-layer)
[![Languages](https://img.shields.io/badge/i18n-EN%20%7C%20HI%20%7C%20GU%20%7C%20MR-f59e0b?style=flat-square)](#internationalization)

**[Try it live →](https://swasthsathi.app)**

</div>

---

## Contents

**Engineering**
- [System architecture](#system-architecture)
- [The guideline assistant — RAG pipeline](#the-guideline-assistant--rag-pipeline)
- [Backend engineering](#backend-engineering)
- [Data layer](#data-layer)
- [Risk assessment engine](#risk-assessment-engine)
- [Cost and abuse protection](#cost-and-abuse-protection)

**Product**
- [The problem](#the-problem)
- [Capabilities](#capabilities)
- [Client application](#client-application)
- [Tech stack](#tech-stack)

**Project**
- [Running locally](#running-locally)
- [Repository structure](#repository-structure)
- [Team](#team)
- [Recognition](#recognition)
- [Disclaimers](#disclaimers)

---

# System architecture

SwasthSathi is a distributed application: a modular client that performs real clinical computation in-browser, a serverless TypeScript backend that brokers every privileged operation, and a Postgres database that doubles as a vector store.

```
┌─────────────────────────────────────────────────────────────────────────┐
│  CLIENT — modular ES6, 20+ interdependent modules                       │
│                                                                          │
│  ┌────────────────┐  ┌──────────────┐  ┌────────────────┐              │
│  │ risk-calculator│  │ ocr-parser   │  │ guideline-chat │              │
│  │ (v1.4 engine,  │  │ (column-scan │  │ (context       │              │
│  │  runs offline) │  │  extraction) │  │  assembly, UI) │              │
│  └────────────────┘  └──────────────┘  └────────────────┘              │
│  ┌────────────────┐  ┌──────────────┐  ┌────────────────┐              │
│  │ medical-       │  │ i18n runtime │  │ service worker │              │
│  │ validator      │  │ (4 locales)  │  │ (offline shell)│              │
│  └────────────────┘  └──────────────┘  └────────────────┘              │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │ HTTPS · JWT-authenticated
┌───────────────────────────────▼─────────────────────────────────────────┐
│  EDGE RUNTIME — Deno / TypeScript, deployed serverless                  │
│                                                                          │
│   guideline-chat ──┬─→ embed query (768-d, normalized, RETRIEVAL_QUERY) │
│                    ├─→ pgvector cosine search → top-k passages          │
│                    ├─→ relevance gate → short-circuit if unsupported    │
│                    ├─→ grounded generation (Claude, schema-enforced)    │
│                    └─→ server-side validation → citations, flags        │
│                                                                          │
│   ocr-extract ─────→ Google Cloud Vision → structured value parsing     │
│   recommendations ─→ Claude, tier-aware prompting                       │
│   doctor-discovery ─→ Google Places API (New)                           │
│                                                                          │
│   Shared: CORS allowlist · JWT verification · per-API rate limiting     │
│           · request timeouts · usage logging · input caps               │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
┌───────────────────────────────▼─────────────────────────────────────────┐
│  POSTGRES — Supabase managed                                            │
│                                                                          │
│   Row-Level Security ── auth.uid() = user_id enforced at DB layer       │
│   pgvector extension ── vector(768), ivfflat cosine index               │
│   SQL functions ────── match_guideline_chunks(query_embedding, k)       │
│   Versioned migrations ── 8 sequential, idempotent, re-runnable         │
│   Triggers ─────────── updated_at maintenance, usage-log constraints    │
└─────────────────────────────────────────────────────────────────────────┘
```

**Design principle: no privileged operation reaches the browser.** Every third-party API key lives in Edge Function secrets. The client holds only a public anon key scoped by Row-Level Security. A compromised browser session cannot read another user's data or spend a rupee of API budget outside its rate limit.

**Design principle: the core function survives connectivity loss.** The risk-assessment engine is pure client-side computation, so a user with no signal can still complete a screening and receive a scored result. Network-dependent enrichment degrades gracefully around it.

---

# The guideline assistant — RAG pipeline

The most involved subsystem in the project. After completing a screening, users can interrogate their own result in natural language and receive answers **grounded exclusively in a curated corpus of published clinical guidance** — never from a language model's unconstrained parametric memory.

## Why retrieval-augmented, and not the alternatives

| Approach | Why rejected |
|---|---|
| **Unconstrained LLM** | Will fabricate thresholds, statistics, and clinical claims with total fluency. On a health tool consumed by users who may act instead of seeing a doctor, this is the primary harm vector. |
| **Fine-tuning** | Bakes claims into weights with no provenance and no ability to cite. Cannot be audited or corrected without retraining. |
| **Static FAQ** | Cannot answer questions phrased outside the anticipated set, and cannot contextualize to an individual's result. |
| **Retrieval-augmented generation** | Every claim traces to a retrievable source passage. The corpus is auditable, correctable, and citable. Answers are contextualized to the user's own assessment. **Selected.** |

## Corpus construction

The corpus is 31 curated passages under a strict provenance discipline: **no clinical text was authored by a language model.**

- **Narrative clinical content** is sourced from WHO fact sheets on diabetes and hypertension, lightly simplified for a 10th-standard reading level with clinical meaning preserved.
- **Every numeric threshold** — HbA1c bands, fasting and random glucose cutoffs, blood-pressure staging, Asian BMI cutoffs, waist-circumference thresholds — is extracted directly from this project's own `risk-calculator.js`. The assistant therefore cannot contradict the tool's own scoring, because both read from the same source of truth.
- **Scope-boundary passages** describing what the tool is and is not are authored deliberately, as they describe the product rather than making clinical claims.

Each passage carries structured frontmatter — `id`, `topic`, `subtopic`, `source`, `question_hint` — and the ingestion pipeline validates schema completeness, id uniqueness, length bounds, and topic-vocabulary conformance before a single embedding call is made.

## Embedding pipeline

Ingestion runs as a controlled, idempotent one-off rather than a deployed service, since the corpus changes rarely and writes require elevated credentials that should never live in production.

Three properties are enforced, and **all three must hold simultaneously or retrieval degrades silently** — the worst failure class, because it presents as "mediocre answers" rather than an error:

**1 · Dimensional contract.** `gemini-embedding-001` returns 3072 dimensions by default. The schema declares `vector(768)`. The ingestion request explicitly sets `outputDimensionality: 768`, and the script asserts the returned length before insert. The database column then acts as a second enforcement boundary — a wrong-width vector is rejected by Postgres rather than silently producing garbage similarity scores.

**2 · Unit normalization.** At reduced dimensionality the model does not return normalized vectors. Cosine similarity is only meaningful between unit vectors, so the pipeline computes the magnitude and scales each component, rejecting zero-magnitude and non-finite vectors outright. An unnormalized vector inserted into pgvector would make its cosine distance undefined — the row would appear healthy in the table while being permanently unretrievable. A silent grounding hole in a health assistant.

**3 · Task-type symmetry.** Corpus passages are embedded with `taskType: RETRIEVAL_DOCUMENT`; user questions at query time with `RETRIEVAL_QUERY`. This asymmetric pairing is what the model is trained for — short queries searching longer documents — and materially improves retrieval quality. It is also a trap: if one side is changed without the other, similarity scores degrade in a way that looks like weak retrieval rather than an obvious bug. The constraint is documented at three points in the codebase, including inline at both call sites.

Ingestion upserts on primary key, making re-runs idempotent; a partial failure followed by a re-run converges to a correct state.

## Retrieval layer

Stored in Postgres via the `pgvector` extension, with an `ivfflat` index over cosine distance. At current corpus scale a single list yields exact rather than approximate recall — the index is structured to remain correct as the corpus grows, with HNSW as the documented migration path at an order-of-magnitude increase.

Retrieval executes as a SQL function rather than application-layer logic:

```sql
CREATE FUNCTION match_guideline_chunks(query_embedding vector(768), match_count int)
RETURNS TABLE (id text, topic text, source text, chunk_text text, similarity float)
LANGUAGE sql STABLE SET search_path = public
AS $$
  SELECT gc.id, gc.topic, gc.source, gc.chunk_text,
         1 - (gc.embedding <=> query_embedding) AS similarity
  FROM public.guideline_chunks gc
  WHERE gc.embedding IS NOT NULL
  ORDER BY gc.embedding <=> query_embedding
  LIMIT match_count;
$$;
```

Invoker-rights rather than `SECURITY DEFINER`, so Row-Level Security continues to apply to anonymous callers.

**Relevance gate.** If the top result falls below a similarity threshold, the request is marked weakly-supported and the model is instructed to decline rather than stretch unrelated passages into an answer. When retrieval returns nothing, the function short-circuits to a canned decline **before the generation model is ever invoked** — correct behaviour and zero spend on an unanswerable question.

## Grounded generation

Retrieved passages, the user's screening context, and the question are assembled into a prompt under a safety-first system instruction.

**Grounding rules.** Answer only from the supplied passages. Never state a number the passages do not contain. Cite sources naturally in prose. *Declining is always a correct outcome, never a failure* — an explicit instruction, because models resist refusing and will otherwise reach for parametric knowledge to seem helpful.

**Contextualization without recomputation.** The assistant receives the user's risk levels, scores, assessment tier, data completeness, and per-factor contributions, and is instructed to explain them — but is explicitly forbidden from recalculating, re-scoring, contradicting, or producing any risk figure of its own. The screening engine remains the single source of truth. The context is flattened to descriptive statements before injection, so the model receives *"Diabetes risk: high (score 72/100)"* as a stated fact rather than raw fields it might treat as inputs to re-derive.

**Refusal taxonomy, with explicit precedence.** Medication questions — which drug, what dose, whether to start, stop, or change — are refused and redirected to a doctor or pharmacist. Acute presentations are refused and redirected to immediate care, with no attempt at triage. Out-of-scope questions are declined politely. Critically, **emergency handling outranks every other rule**: a question that is simultaneously a medication question and an emergency ("chest pain, should I take my BP tablet?") must return the emergency response, or the model will answer the medication half and bury the urgency. Jailbreak framings — hypotheticals, third-party framing, role-play, instruction-override — are named explicitly, since unnamed refusals are trivially bypassed.

## Defense in depth

The prompt is one layer. It is deliberately not the only one — the server does not trust the model's output.

| Guard | Mechanism |
|---|---|
| **Citation integrity** | Claimed source ids are intersected against passages actually retrieved. Fabricated citations are dropped before response assembly — a citation can never reference a passage the system did not retrieve. |
| **Groundedness** | Recomputed server-side as `claimed_grounded AND no_refusal AND surviving_sources > 0`. A refusal can never be marked grounded; a groundedness claim with zero surviving citations is downgraded. |
| **Disclaimer** | A server constant appended outside model control. It cannot be omitted, reworded, or argued away. |
| **Schema enforcement** | Structured outputs constrain the refusal-type enum and groundedness flag at the API boundary rather than parsing free text. |
| **Fail closed** | A parsing failure returns an error, never unvalidated model text presented as a health answer. |

---

# Backend engineering

The backend is **TypeScript on Deno**, deployed as serverless Edge Functions. Four functions, each owning one privileged capability, sharing a common middleware layer.

| Function | Responsibility | External dependency |
|---|---|---|
| `guideline-chat` | Query embedding, vector retrieval, grounded generation, response validation | Google embeddings, Anthropic |
| `ocr-extract` | Medical report text extraction and structured value parsing | Google Cloud Vision |
| `recommendations` | Tier-aware personalized health guidance | Anthropic |
| `doctor-discovery` | Location-based specialist search | Google Places API (New) |

**Shared middleware**, applied uniformly: CORS origin allowlist, JWT verification rejecting unauthenticated requests *before* any billable call, per-API rate limiting, `AbortSignal` request timeouts, input size caps, and usage logging on every exit path including failures.

**Type safety across the boundary.** Request and response shapes are typed, and the screening-context payload the client assembles is validated against the expected structure server-side rather than trusted.

**Secrets isolation.** Each capability reads a dedicated environment secret. The guideline assistant uses a separate Anthropic credential from the recommendations engine — not redundancy, but deliberate cost attribution: per-feature spend is measurable at the provider, and a rotation on one capability does not disturb the other.

---

# Data layer

**Postgres, evolved through eight sequential migrations.** Every migration is idempotent and re-runnable — guarded object creation, `DROP ... IF EXISTS` before policy and trigger creation (neither supports `IF NOT EXISTS` in Postgres), so a partially-applied migration ledger can be reconciled without manual surgery.

**Row-Level Security as the isolation boundary.** Policies enforce `auth.uid() = user_id` at the database layer. Application code cannot bypass it, so an application-layer bug cannot expose another user's screening history. Guideline passages are readable by all roles — public clinical guidance carries no PII — but writes are restricted to the service role, so corpus mutation is impossible from a browser session.

**Projection views for sharing.** Public result-sharing reads from a restricted view rather than the base table, so a shared link exposes exactly the intended columns and nothing adjacent.

**Constraint-level correctness.** Check constraints govern API-name vocabularies in the usage log; triggers maintain `updated_at` on mutation. Both exist because their absence previously produced silent failures — a usage-log insert rejected by an unlisted enum value, swallowed by a fire-and-forget write, would have left a paid endpoint with no rate limiting at all. Caught during implementation, fixed at the schema level.

---

# Risk assessment engine

A transparent rule-based scoring system, deliberately not a black box: every point assigned is traceable to a named factor and surfaced back to the user.

**Tiered assessment.** The engine adapts to available data rather than demanding a fixed input set.

| Tier | Inputs | Output |
|---|---|---|
| Baseline | Demographics, lifestyle, symptoms | Questionnaire-derived estimate |
| Partial | Above + some clinical readings | Refined estimate |
| Enhanced | Above + HbA1c or complete readings | Highest-confidence estimate |

Each result reports its tier and a **data-completeness percentage**, so users can judge how much the estimate rests on.

**Measurement precedence.** Where multiple glycaemic measures are present, HbA1c overrides point-in-time blood glucose — it reflects two to three months of glycaemic control rather than a single moment, and is the more reliable signal.

**Clinical basis and implemented thresholds.**

| Measure | Bands |
|---|---|
| HbA1c | < 5.7 normal · 5.7–6.4 prediabetes · ≥ 6.5 diabetes range |
| Fasting glucose | < 100 normal · 100–125 prediabetes · ≥ 126 diabetes range |
| Random glucose | ≥ 200 with symptoms suggests diabetes |
| BMI (Asian cutoffs) | ≥ 23 overweight · ≥ 25 class I · ≥ 27.5 class II · ≥ 30 obese |
| Waist circumference | ≥ 90 cm male · ≥ 80 cm female |
| Blood pressure | ≥ 180/120 crisis · 160–179 stage 2 · 140–159 stage 1 · 130–139 elevated · 120–129 pre-hypertension |

Glycaemic criteria follow ADA; blood-pressure staging follows WHO/JNC-8, under which hypertension begins at 140/90. **Asian BMI and South Asian waist cutoffs are used in place of Western defaults** — South Asian populations develop metabolic risk at materially lower body mass, and applying Western thresholds would systematically under-flag the exact population this tool serves. Population-level effect sizes are informed by NFHS-5.

**Output.** A 0–100 score per condition mapped to Low / Moderate / High / Critical bands, with per-factor contributions classified as modifiable, non-modifiable, or clinical — so users can distinguish what they can act on from what they cannot.

> **Not clinically validated.** The composite scoring system applies published guideline cutoffs but has not been validated against patient outcome data. It is a screening-awareness instrument, not a diagnostic one.

---

# Cost and abuse protection

A student-funded project on a public domain calling four paid APIs cannot afford an uncapped bill. Six layers, applied across every billable path:

1. **Client-side request deduplication** — in-flight tracking prevents duplicate concurrent calls, with separate keys per capability so one feature's request cannot block another's
2. **Content hashing** — identical OCR uploads resolve from cache rather than re-billing
3. **Response caching** where inputs have naturally repeating keys
4. **Per-user rate limiting** with an independent bucket per API, so chat questions cannot consume the recommendation budget
5. **Request timeouts** via `AbortSignal` on every outbound call
6. **CORS allowlist and authentication** — unauthenticated and off-origin requests are rejected before any billable operation

The rate limiter is designed to **fail closed**: an unrecognized API key raises rather than silently permitting unlimited calls.

---

# The problem

India carries one of the world's largest chronic-disease burdens, and much of it goes undetected until complications begin. In rural areas the barriers compound: distance and cost put routine screening out of reach; low awareness means early signs go unrecognised, and both type 2 diabetes and hypertension are frequently silent for years; language barriers make medical reports unreadable; and overburdened public facilities necessarily ration attention toward acute presentations.

Screening is the intervention that fits these constraints — cheap, fast, and capable of identifying who needs clinical attention before damage accumulates. SwasthSathi exists to make that first step free, comprehensible, and available on any phone.

---

# Capabilities

**Co-risk screening.** Diabetes and hypertension share risk factors and frequently co-occur, so both are assessed from a single questionnaire with a shared factor analysis rather than as separate exercises.

**Medical report ingestion.** Users photograph a lab report instead of transcribing it. Cloud Vision extracts the text; a parsing layer identifies HbA1c, fasting and random glucose, and blood-pressure readings. Every extracted value is surfaced as a *suggestion* the user explicitly accepts or rejects — the system never silently writes a number into a health assessment.

**Guideline assistant.** Result-scoped question answering grounded in published clinical guidance, with citations and enforced clinical boundaries. [Detailed above.](#the-guideline-assistant--rag-pipeline)

**Personalized guidance.** Claude-generated recommendations keyed to the user's specific risk factors, alongside curated do's, don'ts, and activity guidance framed around Indian diets and everyday movement rather than gym-centric advice.

**Care pathways.** Live location-aware specialist search, so a high-risk result terminates in a concrete next step rather than a dead end.

**Result portability.** Printable clinical summaries formatted for a consultation, shareable links backed by a restricted projection view, email delivery, and a comparison view for tracking change across screenings.

**Offline capability.** Installable as a Progressive Web App. The questionnaire and risk computation function without connectivity, since scoring runs entirely client-side. Network-dependent features degrade with explicit messaging rather than serving stale health data — a deliberate caching constraint, since a cached result page presented as current would be a correctness failure.

---

# Client application

Not a static page set. The client is a modular ES6 application with 20+ interdependent modules performing real clinical computation, structured state management, and runtime internationalization.

**Computation in the browser.** `risk-calculator.js` implements the complete scoring engine — threshold evaluation, factor contribution analysis, tier determination, completeness calculation. `medical-validator.js` enforces physiological plausibility bounds on every input. `ocr-parser.js` performs column-aware extraction from Vision output. None of this is a thin view layer.

**Internationalization.** Four locales — English, Hindi, Gujarati, Marathi — served from pre-built static dictionaries resolved at runtime with graceful key fallback. Chosen over a live translation API for latency, offline capability, and elimination of a per-request cost and third-party dependency.

**Progressive Web App.** Service worker with versioned cache naming and activate-time cleanup, so deployments cannot strand users on stale assets. Caching is deliberately asymmetric: cache-first for static assets, **network-only with no cache fallback for every API, Edge Function, and authentication path.** Both standard and maskable icon sets are shipped, so Android adaptive icon cropping renders correctly rather than letterboxing the mark.

**Design system.** Centralized CSS custom properties governing color, typography, spacing, radii, shadows, and transitions, consumed by every page stylesheet — so the brand palette is defined once and inherited everywhere.

---

# Tech stack

| Layer | Technology |
|---|---|
| **Client** | ES6+ modular JavaScript, Bootstrap 5.3.2, Bootstrap Icons 1.11.3 |
| **App shell** | Progressive Web App — service worker, web manifest, installable |
| **Backend runtime** | Deno · TypeScript · Supabase Edge Functions |
| **Database** | Supabase Postgres · Row-Level Security · versioned SQL migrations |
| **Vector store** | pgvector — `vector(768)`, ivfflat cosine index, SQL retrieval functions |
| **Embeddings** | Google `gemini-embedding-001` — 768-d, unit-normalized, task-typed |
| **Generation** | Anthropic Claude — schema-enforced structured outputs |
| **OCR** | Google Cloud Vision API |
| **Places** | Google Places API (New) |
| **Auth** | Supabase Auth — JWT, verified at the Edge |
| **Email** | EmailJS |
| **i18n** | Static pre-built dictionaries (EN / HI / GU / MR) |
| **Hosting** | GitHub Pages, custom domain, HTTPS |

---

# Running locally

```bash
git clone https://github.com/ThakkarShlok/SwasthSathi-Health-Screening.git
cd SwasthSathi-Health-Screening
```

Serve over HTTP — a service worker will not register from `file://`:

```bash
python -m http.server 5500
```

Open `http://localhost:5500`.

**Without credentials.** The screening questionnaire and client-side risk computation run with no backend at all. OCR, the guideline assistant, recommendations, doctor discovery, and persistence require configured Supabase Edge Functions with their associated provider keys.

**Backend development.** Edge Functions live under `supabase/functions/`, deployed via the Supabase CLI. Schema changes are authored as sequential migrations under `supabase/migrations/` and applied through the migration pipeline — never as ad-hoc production edits.

---

# Repository structure

```
SwasthSathi/
├── index.html · about.html · screening.html · result.html
├── doctors.html · dashboard.html · comparison.html · contact.html
├── login.html · signup.html · privacy.html · share.html
├── manifest.json · sw.js
│
├── assets/
│   ├── icons/               PWA icon set — standard + maskable, favicons
│   ├── logo/                brand SVGs
│   ├── styles/              base.css (design tokens) + per-page stylesheets
│   ├── i18n/                static locale dictionaries
│   └── scripts/
│       ├── shared/          supabase-client.js · i18n.js · nav-auth.js
│       ├── pages/           screening.js · result.js · guideline-chat.js · …
│       ├── modules/         risk-calculator.js · medical-validator.js · ocr-parser.js
│       └── data/            language-data.js
│
├── supabase/
│   ├── functions/           Deno/TypeScript Edge Functions
│   │   ├── guideline-chat/  RAG: embed → retrieve → ground → validate
│   │   └── _shared/         CORS · rate limiting · usage logging
│   └── migrations/          8 sequential idempotent SQL migrations
│
├── research/
│   └── rag-corpus/          corpus source · provenance · ingestion pipeline
│
└── docs/                    architecture and phase documentation
```

---

# Team

**Team COGNITEX** — LDRP Institute of Technology and Research, KSV University, Gandhinagar.

### Shlok Thakkar — Team Lead & Principal Developer

Owned the technical architecture and delivery of the platform end to end.

Designed and implemented the **retrieval-augmented guideline assistant** — corpus construction under provenance discipline, the embedding pipeline with its dimensional, normalization, and task-type contracts, the pgvector retrieval layer and SQL search functions, grounded generation with the refusal taxonomy and emergency-precedence rule, and the server-side validation layer that constrains model output independently of the prompt.

Built the **serverless backend** in TypeScript on Deno — four Edge Functions, shared authentication and CORS middleware, and the six-layer cost-protection architecture. Designed the **Postgres schema** and its migration pipeline, including Row-Level Security isolation, pgvector integration, projection views for safe sharing, and the constraint and trigger layer.

Developed the **risk-assessment engine** through to v1.4 — tiered assessment, per-factor contribution analysis, measurement precedence, and data-completeness reporting — along with the OCR extraction and parsing pipeline, the four-locale internationalization system, the Progressive Web App layer, and the UI/UX and design system across every surface.

[LinkedIn](https://www.linkedin.com/in/thakkar-shlok)

### Dhrupalsinh Solanki — Feature Design: Guidance & Result Delivery

Conceptualized the personalized health-recommendation experience on the result page and designed the exercise-suggestion logic keyed to risk level. Proposed the printable result report for patient documentation, establishing the result-portability direction that shaped how screening outcomes reach a clinical consultation.

[LinkedIn](https://www.linkedin.com/in/dhrupalsinh-solanki-662442332)

### Aryan Thakkar — Feature Design: Care Pathways

Proposed the doctor-discovery capability that converts a high-risk screening into a concrete next step, and designed the flow and surfacing logic for connecting users to qualified specialists using publicly available information.

[LinkedIn](https://www.linkedin.com/in/aryan-thakkar-126a76345)

### Akshay Somani — Feature Design: Health Education & Localization

Conceptualized the outcome-specific do's and don'ts, contributed the lifestyle-guidance and patient-education direction, and drove the emphasis on culturally appropriate recommendations grounded in Indian diets and everyday activity.

[LinkedIn](https://www.linkedin.com/in/akshay-somani-881622383)

---

# Recognition

**ImpactThon @ KSV 2025–26** — Grand Finalist among 170+ participating teams, awarded a **₹10,000 Prototype Development Grant** to advance the prototype toward deployment.

---

# Disclaimers

> ### Medical
>
> SwasthSathi is a **screening and health-education tool**. It is **not a diagnostic instrument** and cannot diagnose any condition.
>
> The risk algorithm applies published clinical guideline cutoffs (ADA, WHO, JNC-8) and population-level evidence, but the composite scoring system has **not been clinically validated** against patient outcome data.
>
> The guideline assistant answers only from a curated corpus of published clinical guidance. It does not provide medication advice, does not handle emergencies, and does not diagnose.
>
> **Always consult a qualified healthcare professional for diagnosis and treatment.** If you are experiencing severe symptoms, seek medical care immediately rather than relying on any application.

> ### Doctor directory
>
> Listings are drawn from publicly available sources. SwasthSathi does **not** recommend, rank, endorse, or verify any practitioner. Verify credentials independently.

> ### Data
>
> Screening data is stored in Supabase Postgres, encrypted at rest, with Row-Level Security enforcing per-user isolation at the database layer. Session tokens are held in browser storage. No advertising or third-party analytics cookies are used. See the [Privacy Policy](privacy.html).

---

# Acknowledgments

**WHO**, **ADA**, **JNC-8/AHA**, and **ICMR** for the published clinical guidance this tool is grounded in · the **NFHS-5** programme for population health evidence · **Supabase**, **Deno**, **pgvector**, and **Bootstrap** · **ImpactThon @ KSV** and **MMPSRPC** for backing a student team building for social impact.

---

# License

Created for educational purposes as part of ImpactThon @ KSV 2025–26.

---

<div align="center">

**Built for rural India.**

[swasthsathi.app](https://swasthsathi.app)

</div>
