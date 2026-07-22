# SwasthSathi RAG Assistant — Phase A: Corpus Assembly

**This phase is 80% manual content sourcing (you) + 20% structuring (Claude Code).**
**Do NOT let Claude Code generate medical guideline text. It will hallucinate clinical content. You source the real text; Claude Code only structures what you provide.**

---

## MASTER PROJECT CONTEXT BLOCK

(Reuse this verbatim at the top of every Claude Code prompt in the RAG build.)

```
## PROJECT CONTEXT

SwasthSathi is a multilingual health screening web app for rural India built with vanilla JS + Supabase. It performs rule-based risk assessment for diabetes and hypertension using published clinical guidelines (ADA, JNC-8, WHO, ICMR-INDIAB thresholds). Funded by a ₹10,000 ImpactThon Prototype Development Grant, hard deadline end of July 2026. Final report to Prof. Radhika Wala at MMPSRPC.

Repository: C:\SwasthSathi Website\
Branch for this work: create and use a new branch `phase-4-rag-assistant` off dev.
Remote: https://github.com/ThakkarShlok/SwasthSathi-Health-Screening
Production: https://swasthsathi.app
Supabase project ref: ersclejdrqnaxlhrfbhg

## TECH STACK (LOCKED — do not suggest alternatives)

- Frontend: Vanilla HTML/CSS/JavaScript ES6+, Bootstrap 5.3.2, Bootstrap Icons 1.11.3
- Backend: Supabase (Postgres + Auth + Deno Edge Functions)
- Hosting: GitHub Pages, custom domain
- Existing paid APIs via Edge Functions: Google Cloud Vision (OCR), Anthropic Claude Haiku 4.5 (recommendations), Google Maps Places API New (doctor discovery)
- Six-layer cost protection already exists (client dedup, SHA-256 image hashing, 24hr caching, per-user rate limits, Edge Function timeouts, CORS allowlist)

## WHAT WE ARE BUILDING (Phase 4)

A result-scoped, guideline-grounded RAG health assistant. After a screening, the user sees an inline expandable chat panel on the result page. They can ask questions about THEIR specific assessment. The bot answers grounded ONLY in a curated corpus of clinical guideline passages stored as embeddings in Supabase pgvector — never from the LLM's unconstrained memory. Answers cite their source and always defer to a doctor for personal medical decisions.

Architecture (all native to existing stack, NO LangChain/LangGraph/Python server):
- Guideline passages chunked and embedded via Google embedding API
- Stored in Supabase Postgres using the pgvector extension
- New Edge Function `guideline-chat`: embeds the user question, does pgvector similarity search for top-k relevant chunks, injects retrieved chunks + the user's screening context, calls Claude (Sonnet for generation quality) with strict grounding + safety guardrails, returns a cited answer
- Inline chat UI on result.html with seeded suggested questions derived from the user's result

## COMMIT ATTRIBUTION REQUIREMENT (applies to every commit)

Do not include any Claude co-author trailer, "Generated with Claude Code" line, or emoji attribution in any commit message. All commits must show only my identity (ThakkarShlok <thakkarshlok2007@gmail.com>) as author and committer. If default behavior adds attribution, disable it for this session.
```

---

## PART 1 — YOU SOURCE THE CORPUS (manual, do this first)

The bot answers ONLY from what's in this corpus. If a topic isn't in the corpus, the bot should say "I don't have guideline information on that, please ask your doctor" — which is correct and safe. So the corpus must cover the questions users will actually ask about their diabetes/hypertension screening results.

### Target: 40-60 chunks, each 100-250 words, each a self-contained answer to a likely question.

### Sourcing rules (non-negotiable for a health tool):
1. **Only use authoritative public sources.** WHO, ADA, ICMR, government health ministries, peer-reviewed summaries. Never blogs, forums, or AI-generated text.
2. **Copy real text, then lightly simplify for a 10th-standard reading level.** Do not invent facts. If you simplify, preserve the clinical meaning exactly.
3. **Every chunk records its source** so the bot can cite it.
4. **Stay in scope:** diabetes and hypertension screening, risk factors, lifestyle, when to see a doctor, understanding results. Do NOT include medication dosing, treatment protocols, or emergency management — those are out of scope and unsafe for this bot.

### Recommended sources (all public, free):

**WHO — highest priority, cleanest patient-facing language:**
- WHO Diabetes fact sheet (who.int/news-room/fact-sheets/detail/diabetes)
- WHO Hypertension fact sheet (who.int/news-room/fact-sheets/detail/hypertension)
- WHO Healthy diet fact sheet
- WHO Physical activity fact sheet

**ADA (American Diabetes Association) — public summary content:**
- Diagnosis thresholds (HbA1c, fasting glucose, random glucose ranges)
- Prediabetes explanation
- Lifestyle management basics

**ICMR / Indian sources — India-specific, matches your population:**
- ICMR guidelines for management of type 2 diabetes (public summary)
- India Ministry of Health hypertension / NCD patient material
- Indian dietary guidance (relevant foods: rice, wheat, millets, dal, oils)

**Your own calculator's clinical basis:**
- The exact thresholds your risk-calculator.js uses (so the bot is consistent with your scoring). Asian BMI cutoffs (23/25/27.5/30), BP stages (JNC-8/AHA), HbA1c bands.

### The topics your 40-60 chunks MUST cover (checklist):

Diabetes basics:
- [ ] What is diabetes / type 2 diabetes (plain language)
- [ ] What is prediabetes and why it matters
- [ ] What HbA1c means and the ranges (normal <5.7, prediabetes 5.7-6.4, diabetes ≥6.5)
- [ ] What fasting blood sugar ranges mean
- [ ] What random blood sugar ≥200 indicates
- [ ] Symptoms of high blood sugar
- [ ] Why early detection matters

Hypertension basics:
- [ ] What is blood pressure / hypertension (plain language)
- [ ] BP categories (normal, elevated, stage 1, stage 2)
- [ ] Why high BP is dangerous (silent risk)
- [ ] Symptoms (or lack of symptoms) of high BP

Risk factors (map to your calculator's factors):
- [ ] Age and diabetes/hypertension risk
- [ ] BMI / overweight / Asian BMI cutoffs and why they're lower for South Asians
- [ ] Waist circumference / abdominal obesity
- [ ] Family history
- [ ] Physical inactivity
- [ ] Tobacco use
- [ ] Alcohol
- [ ] Diet (high fat, high salt, high sugar)

Lifestyle guidance (modifiable factors — the actionable content):
- [ ] Diet changes for diabetes prevention (Indian foods context)
- [ ] Diet changes for BP (salt reduction, DASH-style, Indian context)
- [ ] Physical activity recommendations (150 min/week, practical for rural setting)
- [ ] Weight management basics
- [ ] Quitting tobacco
- [ ] Reducing alcohol

Understanding results & next steps:
- [ ] What a "high risk" screening result means (and doesn't mean — it's not a diagnosis)
- [ ] Why to see a doctor after a high-risk screening
- [ ] What tests a doctor might order
- [ ] How often to get screened
- [ ] The difference between screening and diagnosis

Safety / scope boundaries (these become the bot's refusal grounding):
- [ ] When to seek immediate/emergency care (very high readings, severe symptoms) — framed as "see a doctor urgently," NOT as self-management
- [ ] Statement that this tool is a screening aid, not a diagnosis, not a substitute for a doctor

### The format you deliver (create this file yourself):

Create a file `research/rag-corpus/corpus-raw.md` (yes, reuse the research/ folder pattern, or make a new `rag-corpus/` folder). Structure EACH chunk exactly like this:

```
---
id: dm-hba1c-ranges
topic: diabetes
subtopic: hba1c
source: WHO Diabetes Fact Sheet 2023 / ADA Standards of Care
question_hint: What does my HbA1c number mean?
---
HbA1c is a blood test that shows your average blood sugar over the past two to three months. An HbA1c below 5.7% is considered normal. A result between 5.7% and 6.4% indicates prediabetes, meaning your blood sugar is higher than normal and you are at increased risk of developing diabetes. An HbA1c of 6.5% or higher on two tests indicates diabetes. Because HbA1c reflects a longer period than a single blood sugar reading, it is one of the most reliable ways to assess diabetes risk.
```

- `id`: unique, kebab-case, prefixed by topic (dm- for diabetes, htn- for hypertension, rf- for risk factor, ls- for lifestyle, res- for results/next-steps, safe- for safety)
- `topic`: diabetes | hypertension | risk_factor | lifestyle | results | safety
- `source`: the real authoritative source you took it from
- `question_hint`: the user question this chunk answers (helps retrieval later)
- Body: 100-250 words, plain language, clinically accurate, no invented facts

**Aim for 40-60 of these. Cover every checklist item above at least once.** This is the single most important artifact in the whole feature. Spend real time on it. Have your medically-aware teammate sanity-check the clinical accuracy — this is a legitimate checkpoint.

---

## PART 2 — CLAUDE CODE STRUCTURES YOUR CORPUS

Once your `corpus-raw.md` exists with 40-60 chunks, THEN use Claude Code to validate and convert it to the ingestion format. Paste this into a fresh Claude Code chat:

```
[PASTE THE MASTER PROJECT CONTEXT BLOCK FROM THE TOP OF THIS FILE HERE]

## THIS TASK

I have manually assembled a corpus of clinical guideline passages at research/rag-corpus/corpus-raw.md. Each chunk has YAML-style frontmatter (id, topic, subtopic, source, question_hint) followed by a body of 100-250 words. Do NOT write, invent, or modify any medical content — the clinical text is authoritative and must stay exactly as I wrote it. Your job is validation and format conversion only.

TASK 1 — Validate the corpus:
Read research/rag-corpus/corpus-raw.md. Parse every chunk. Report:
- Total chunk count
- Any chunk missing a required frontmatter field (id, topic, source, question_hint)
- Any duplicate ids
- Any chunk whose body is under 50 words or over 300 words (flag for my review — too short may lack context, too long hurts retrieval)
- Any chunk with an invalid topic (must be one of: diabetes, hypertension, risk_factor, lifestyle, results, safety)
- A coverage summary: how many chunks per topic
Show me this report. Do NOT fix anything yet — I will decide what to fix.

TASK 2 — After I approve, convert to a JSON ingestion file:
Create research/rag-corpus/corpus.json — an array of objects, each:
{
  "id": "dm-hba1c-ranges",
  "topic": "diabetes",
  "subtopic": "hba1c",
  "source": "WHO Diabetes Fact Sheet 2023",
  "question_hint": "What does my HbA1c number mean?",
  "text": "<the exact body text, unchanged>"
}
Preserve the body text EXACTLY — no rewording, no summarizing, no cleaning beyond trimming leading/trailing whitespace. This text will be embedded and shown to users as grounding; altering it alters the medical meaning.

Validate the JSON is well-formed. Show me the first 3 objects and the total count.

Do NOT commit yet. After I verify, commit with message:
    feat(rag): add curated guideline corpus (N chunks) for grounded assistant

I will handle the git add/commit. Show me the diff first.
```

---

## VERIFICATION CHECKPOINT (Phase A)

Before moving to Phase B:
- [ ] corpus-raw.md has 40-60 chunks covering every checklist topic
- [ ] Your medically-aware teammate has sanity-checked clinical accuracy of the content
- [ ] Claude Code's validation report shows no missing fields, no duplicate ids, sensible per-topic coverage
- [ ] corpus.json is well-formed and preserves text exactly
- [ ] Committed to the phase-4-rag-assistant branch with clean authorship

**Do not proceed to pgvector setup until the corpus is solid. Everything downstream grounds on this.**

---

## WHY THIS PHASE IS STRUCTURED THIS WAY

The single biggest risk in a health RAG bot is grounding on wrong content. If Claude Code generates the corpus, it produces plausible-sounding medical text that may be subtly wrong — wrong thresholds, outdated guidance, invented statistics. A user asks about their HbA1c, the bot confidently cites a fabricated range, and someone makes a health decision on it. Unacceptable.

By making YOU source real text from WHO/ADA/ICMR and restricting Claude Code to validation/formatting only, the clinical content is always traceable to a real authority. The bot can cite its source because the source is real. This is the difference between a defensible health tool and a liability.

It's slower. It's correct. On a tool that screens real people, correct wins.