# Phase 2B Week 2 Completion Report

**Completed:** 2026-07-11
**Status:** SHIPPED — 10 planned tasks complete, plus 1 unplanned bonus fix (Migration 006)

---

## Summary

Week 2 rolled out Risk Calculator v1.4 across the full stack: HbA1c consumption per ADA guidelines with override logic over fasting blood sugar, per-factor point contributions with modifiable/non-modifiable/clinical categorization, assessment-tier computation (baseline/partial/enhanced), and a data-completeness percentage. Alongside the calculator change, the week closed a P0 privacy leak in the shared-result endpoint with a two-layer defense (field whitelist + a PII-safe database view), added a delta-aware Recalculate flow so legacy v1.3 users can re-run their existing data through v1.4, and shipped a new Comparison page showing screening progression over time. A schema-drift bug in the `updated_at` trigger — dormant since Phase 0 because no prior phase ever ran an UPDATE — surfaced during testing and was fixed the same week as Migration 006.

---

## Tasks Completed

### Task 1.1 — P0 privacy patch, calculator version, language typo
- Fixed `getByShortCode` field whitelist to prevent PII leak via anon RLS.
- Fixed `currentLanguage` → `currentLang` typo (`language_at_screening` was always `'en'` before this).
- This task originally intended to add a `CALCULATOR_VERSION` constant to `risk-calculator.js`, but Claude Code (VS Code extension) discovered the file already had an `ALGORITHM_VERSION` constant exported as `window.RiskCalculator.version` — the plumbing was already there. The value was bumped from `'rule-v1.3'` to `'rule-v1.4'` in Task 2.1 as part of the scoring logic changes, rather than duplicated into a second constant.
- Files touched: `assets/scripts/shared/supabase-client.js`, `assets/scripts/pages/screening.js`

### Task 1.2 — Migration 004 for v1.4 columns
- Added `assessment_tier`, `factor_contributions`, `data_completeness_percentage`, `hba1c` columns to `health_screenings`.
- CHECK constraints ensure tier is one of baseline/partial/enhanced, completeness is 0–100, HbA1c is 3.0–20.0.
- Index added on `algorithm_version` for comparison dashboard queries.

### Task 1.3 — Migration 005 for `shared_screening_results` view
- Created a PII-safe projection view for shared result URLs.
- Revoked anon `SELECT` on `health_screenings`, granted `SELECT` on the view instead.
- Client `getByShortCode` migrated to query the view.
- Defense-in-depth: even if the client-side whitelist is bypassed, the database view structurally cannot return PII.
- Claude Code proactively verified the `DROP POLICY` name matched migration 003's exact policy name string (`"public_read_by_short_code"`) before the migration would silently no-op.

### Task 2.1 — Risk calculator v1.4 core logic
- Bumped `ALGORITHM_VERSION` value from `'rule-v1.3'` to `'rule-v1.4'`.
- HbA1c consumption per ADA guidelines: ≥6.5% adds 35 pts, 5.7–6.4% adds 18 pts.
- HbA1c overrides blood sugar contribution when both are present (HbA1c is a superior 3-month marker).
- Per-factor contributions array emitted with `id`, `label`, `points`, `category` (modifiable/non_modifiable/clinical), `direction` (positive/protective).
- `assessment_tier` computed from lab data availability.
- `data_completeness_percentage` computed across 6 signal fields.
- Aliased `combined.risk = combined.category` (also on diabetes and hypertension) to fix a silent bug where the LLM Edge Function had been receiving "Overall risk: unknown" for weeks.
- The HbA1c override was verified empirically by Claude Code, not just by inspection: a test patient with HbA1c=6.8 **and** blood_sugar=180 produced a `factorContributions` array containing only `hba1c_diabetes` at 35 pts, with no blood-sugar factor present — confirming the override actually worked at runtime, not just in the code path logic.

### Task 2.2 — HbA1c wired end-to-end
- Added HbA1c input field to `screening.html`.
- `screening.js` captures `hba1c` into `patientData.readings.hba1c`.
- OCR flow auto-populates the HbA1c field when detected in a lab report.
- `supabase-client.js` `transformToSupabaseFormat`/`transformFromSupabaseFormat` extended for `hba1c`, `assessment_tier`, `data_completeness_percentage`, `factor_contributions`.
- `_omitRiskSnapshot` defensive fallback extended for the new v1.4 fields.

### Task 3.1 — Result page v1.4 refactor
- Removed broken `confidence` field references (the calculator never emitted `confidence` — it was rendering as `undefined`).
- Added tier badges showing baseline/partial/enhanced with color coding.
- New `renderFactorCardsV14` function renders point magnitudes and category tags (modifiable/non-modifiable/clinical).
- Preserved the `topFactors` fallback path for v1.3 legacy screenings.
- Extended the completeness panel to 6 fields including HbA1c.
- Consolidated duplicate `initializeResultsPage` function declarations (the second, async, definition had been silently shadowing the first).
- Extended the LLM prompt payload with tier and top 3 factor contributions.
- Claude Code proactively added HbA1c routing to `factor-explanations.js` in the same commit — the original task prompt had missed this, and without it HbA1c cards would have rendered with a generic fallback icon and an empty clinical-context body.

### Task 4.1 — LLM Edge Function tier-aware + opt-in symptoms consent
- Edge Function `generate-recommendation` extended to receive `tier`, `topContributions`, `additionalSymptoms`, `symptomsConsent`.
- System prompt varies guidance by tier (enhanced tier references magnitudes with confidence; baseline tier emphasizes that a lab workup would improve accuracy).
- User prompt includes the top 3 factor contributions with magnitudes.
- `additionalSymptoms` text is sent to the Anthropic API **only if** `symptomsConsent === true` (strict equality check, Edge Function line 61).
- Opt-in checkbox added to `screening.html` after the `additional_symptoms` textarea.
- Repurposed the Phase 0 reserved `consent_to_research` column for symptoms consent (documented in the commit message as a deliberate, semantically-compatible reuse).
- Claude Code proactively verified the consent gate end-to-end: unconsented users' free-text symptom notes never leave Supabase's boundary into the Anthropic API payload.
- End-to-end tested in production with matching symptom text across both consent-checked and consent-unchecked screenings.

### Task 4.2 — Dashboard v1.4 badges + Recalculate CTA + `patchScreening`
- Assessment column added to the screening history table.
- `renderTierBadge` shows "v1.3 Legacy" for `algorithmVersion === 'rule-v1.3'`, "v1.4 [tier]" for `rule-v1.4`, and a dash placeholder for undefined `algorithmVersion` — a deliberate diagnostic surfacing of data anomalies rather than silently coercing unknown versions to legacy.
- Recalculate v1.4 button appears on non-v1.4 rows that have any lab data (blood sugar OR blood pressure OR HbA1c); condition uses `!== 'rule-v1.4'` rather than `=== 'rule-v1.3'`, so it stays correct against future algorithm versions.
- Recalculate re-runs the v1.4 algorithm against the existing patient record and PATCHes only the risk-snapshot fields via a new `patchScreening` method.
- `patchScreening` uses `Prefer: return=minimal`.
- Claude Code proactively mirrored the changes into the fallback row-rendering branch to preserve table column integrity — the original task prompt only specified the primary ("assessment available") branch, and the fallback ("risk data unavailable") branch would otherwise have rendered 5 cells against a 6-column header.
- Claude Code extracted a `renderActionCell(screening, index)` helper to avoid duplicating the conditional Recalculate-button markup across the two row branches.

### Migration 006 — Missing `updated_at` column (bonus fix)
- Not in the original Week 2 plan; discovered during Task 4.2 testing when the Recalculate button failed with Postgres error `42703`: `record "new" has no field "updated_at"`.
- Root cause: Migration 001 declared an `updated_at` column and a `BEFORE UPDATE` trigger, but the production table was created before migration 001 ever ran through the CLI. `CREATE TABLE IF NOT EXISTS` was a no-op against the pre-existing table, so the column was never added — while the trigger and its function *did* get created, since those statements weren't gated on the table's existence. The trigger has been silently broken since Phase 0, invisible until now because no prior phase ever exercised an UPDATE code path against `health_screenings`.
- Migration 006 adds `updated_at`, backfills existing rows from `created_at`, and defensively recreates the trigger.

### Task 5.1 — Comparison page + delta-aware Recalculate dialog
- Two related UX improvements shipped in one commit.
- Delta-aware dialog on Recalculate: captures old scores *before* the `assessHealthRisk` call, computes deltas after, and shows either Scenario A (unchanged — "HbA1c was not provided, so nothing changed") or Scenario B (changed — "score updated from X to Y, delta of Z, reflects the HbA1c data v1.4 now consumes") depending on whether any of the three deltas is non-zero.
- New `comparison.html` page with Summary, Timeline, Latest vs Previous, and Factor Evolution sections.
- Empty state renders when the user has fewer than 2 screenings.
- Factor Evolution requires at least 2 v1.4 screenings to render (v1.3 rows don't carry `factorContributions`).
- Entry points added: Compare button on the dashboard header, nav dropdown menu item.
- Testing surfaced that legacy rows without HbA1c produce identical v1.3 and v1.4 scores — this confirmed the calculator is behaving correctly (v1.4 differs from v1.3 *only* in HbA1c consumption) rather than indicating a bug; the delta dialog exists specifically to explain this to users instead of leaving them with a silent, confusing no-op reload.

### Task 5.2 — English i18n keys batch
- 39 English keys added to `en.json` and `TRANSLATION_KEYS` in `language-data.js` (verified programmatically against the itemized category list; the original task brief undercounted this as 38).
- Categories: HbA1c form field, assessment tier, factor categorization, HbA1c factor cards, symptoms consent, dashboard v1.4 elements, delta-dialog scenarios, navigation, comparison page structure and section headers.
- Hindi/Gujarati/Marathi fall back to English via the `TRANSLATION_KEYS` chain in the interim.
- Native translations for hi/gu/mr deferred to Week 3.

### Task 6.1 — End-to-end test matrix (manual)
- Privacy contract verified via DevTools inspection of `shared_screening_results` API responses (only the whitelisted fields present, no PII).
- v1.4 enhanced tier happy path: HbA1c + BP + blood sugar produces the enhanced badge, 6/6 completeness, and a tier-aware AI recommendation.
- v1.4 partial tier: a single lab reading produces the partial badge and correct completeness.
- v1.4 baseline tier: no lab data produces the baseline badge and the AI recommendation suggests a lab workup.
- Legacy v1.3 recalculation: verified both the score-changed path (HbA1c injected via the Supabase table editor) and the score-unchanged path (no HbA1c present) render the correct delta dialog.
- Comparison page: all four sections render correctly against a mix of v1.3 and v1.4 screenings.
- i18n verified across all four languages — no raw keys visible anywhere in the UI.
- Consent gate verified end-to-end in production with matching symptom text across both consent states.

---

## New Files

| File | Purpose |
|------|---------|
| `comparison.html` | Screening-progression comparison page |
| `assets/scripts/pages/comparison.js` | Comparison page logic — summary, timeline, latest-vs-previous, factor evolution |
| `supabase/migrations/004_phase_2b_v1_4_risk_calculator.sql` | Adds `assessment_tier`, `factor_contributions`, `data_completeness_percentage`, `hba1c` columns |
| `supabase/migrations/005_phase_2b_share_projection.sql` | `shared_screening_results` PII-safe view + anon policy migration |
| `supabase/migrations/006_phase_2b_add_updated_at_column.sql` | Fixes schema drift on `updated_at` column and its trigger |

---

## Modified Files

| File | Change |
|------|--------|
| `assets/scripts/shared/supabase-client.js` | `getByShortCode` privacy fix + view migration, new `patchScreening` method, transform extensions for v1.4 snapshot fields and symptoms consent |
| `assets/scripts/pages/screening.js` | `currentLang` typo fix, HbA1c capture, risk-snapshot v1.4 fields, symptoms consent capture, OCR HbA1c autofill |
| `assets/scripts/modules/risk-calculator.js` | v1.4 scoring logic — HbA1c consumption/override, factor contributions, assessment tier, data completeness, `risk` alias |
| `assets/scripts/modules/factor-explanations.js` | HbA1c factor label routing to title/context keys |
| `assets/scripts/pages/result.js` | Tier badges replacing broken confidence field, `renderFactorCardsV14`, HbA1c in completeness panel, tier-aware LLM prompt payload, duplicate-function consolidation |
| `assets/scripts/pages/dashboard.js` | Tier badges, Recalculate CTA, delta-aware recalc dialog, `renderActionCell`/`renderTierBadge` helpers |
| `assets/scripts/shared/nav-auth.js` | Compare Screenings menu item |
| `screening.html` | HbA1c input field, symptoms consent checkbox |
| `dashboard.html` | Compare button, Assessment column header |
| `supabase/functions/generate-recommendation/index.ts` | Tier-aware system/user prompts, top-contributions payload, opt-in consent gate for symptom text |
| `assets/i18n/en.json` | +39 keys for v1.4 UI (authoritative English source) |
| `assets/scripts/data/language-data.js` | `TRANSLATION_KEYS` fallback mirror of the same 39 keys |

---

## Migrations Applied

| # | File | What it did |
|---|------|-------------|
| 004 | `004_phase_2b_v1_4_risk_calculator.sql` | Adds the four v1.4 columns (`assessment_tier`, `factor_contributions`, `data_completeness_percentage`, `hba1c`) with CHECK constraints, plus an index on `algorithm_version`. |
| 005 | `005_phase_2b_share_projection.sql` | Creates `shared_screening_results` view, moves anon read access from the base table to the view (defense-in-depth for shared result URLs). |
| 006 | `006_phase_2b_add_updated_at_column.sql` | Adds the `updated_at` column that migration 001's trigger had always referenced but that was never actually created on the production table; backfills from `created_at`; recreates the trigger. |

---

## Deployment Checklist

Steps actually executed to ship Week 2 to production:

1. **Migrations applied via `supabase db push`** — run manually by Shlok after reviewing each migration file's diff; 004 and 005 were applied together, 006 was applied separately after it was discovered mid-week during Task 4.2 testing.
2. **Edge Function `generate-recommendation` redeployed** after Task 4.1's tier-aware prompt and consent-gate changes — deployed manually, not via CI.
3. **Client-side changes (HTML/JS)** pushed to the `dev` branch as a batch of 11 commits at the end of the week rather than pushed incrementally per task, per Shlok's preference for batching pushes.
4. **Manual verification in production** (Task 6.1) — privacy contract, all three assessment tiers, legacy recalculation (both delta scenarios), comparison page, i18n coverage across all 4 languages, and the consent gate, all exercised against the live Supabase project (`ersclejdrqnaxlhrfbhg`) and `https://swasthsathi.app`.

---

## Protected Files Unchanged

- `assets/styles/base.css` ✓ Not touched
- `assets/scripts/modules/medical-validator.js` ✓ Not touched
- `assets/scripts/modules/ocr-parser.js` ✓ Not touched
- Resilient two-attempt POST block in `supabase-client.js` (lines 341–383) ✓ Not touched — confirmed still at the same line range after all of Week 2's additions, since every new method was appended below it
- `result.html` ✓ Not touched — all Task 3.1 changes went into `result.js` only, per explicit instruction
- `hi.json`, `gu.json`, `mr.json` ✓ Not touched — native translations deferred to Week 3, English-only in Task 5.2

Note: unlike Phase 2A, `assets/scripts/modules/risk-calculator.js` was an explicit, planned target this phase (Task 2.1) rather than a protected file.

---

## Bugs Discovered and Fixed

**Bug 1 (P0 privacy leak).** `getByShortCode` returned the entire screening row, including PII, via `select=*`. The anon RLS policy granted row-level access to anyone with an 8-character short code; the client had been mitigating this only by choosing not to *display* the extra fields, but any DevTools Network-tab inspection would reveal all PII in the raw response. Fixed via a field whitelist (Task 1.1) and, as a second layer, a database view that structurally cannot return PII regardless of client behavior (Task 1.3).

**Bug 2 (silent LLM prompt degradation).** `combined.risk` was `undefined` in every LLM call because the calculator emitted `category`, not `risk`. The LLM had been receiving "Overall risk: unknown" in every prompt for weeks, silently degrading the quality of AI-generated recommendations with no visible error anywhere. Fixed via a `risk = category` alias added to the calculator's output (Task 2.1).

**Bug 3 (language capture silently defaulted to English).** A `currentLanguage` vs `currentLang` property-name typo caused `language_at_screening` to always save `'en'` regardless of the user's actual selected language. Any analytics built on language usage prior to this fix would have been entirely wrong. Fixed in Task 1.1.

**Bug 4 (broken confidence field on the result page).** The calculator never emitted a `confidence` field, but `result.js` referenced `diabetesRisk.confidence` and `hypertensionRisk.confidence`, both of which rendered as the literal string `"undefined"` in the UI. Replaced with assessment-tier badges as part of Task 3.1 — a semantically stronger concept than statistical confidence for this use case, since it communicates *why* the assessment is more or less complete rather than a vague confidence label.

**Bug 5 (schema drift on `updated_at`).** Migration 001 declared `updated_at` and its trigger, but the production table pre-existed the migration file, so `CREATE TABLE IF NOT EXISTS` was a no-op and the column was never actually added — while the trigger *was* created, since it wasn't gated on table existence. The mismatch was silently broken since Phase 0 and only surfaced when Task 4.2's Recalculate button became the app's first UPDATE code path. Fixed via Migration 006.

---

## Engineering Process Observations

- Each task was scoped as a self-contained prompt with full project context, explicit file listings, a protected-file list, execution steps, and verification questions — no task assumed context carried over implicitly from a prior session.
- Each task ended with an explicit verification checkpoint requiring Shlok's sign-off before any commit was made.
- Claude Code (VS Code extension) proactively surfaced observations at multiple tasks that led to plan adjustments — see the per-task notes above (Task 1.1's already-existing `ALGORITHM_VERSION` constant, Task 1.3's policy-name verification, Task 2.1's empirical HbA1c-override test, Task 3.1's `factor-explanations.js` routing gap, Task 4.1's consent-gate verification, Task 4.2's fallback-branch mirroring and helper extraction, Task 5.2's key-count correction).
- Every commit was manually reviewed via `git diff` before approval; several diffs were requested a second time in a specific order for final sign-off before committing.
- Commit authorship was strictly maintained as `Shlok Thakkar <thakkarshlok2007@gmail.com>` for both author and committer on every commit — no AI attribution, co-author trailer, or "Generated with" line in any commit message, verified via `git log` after each commit.
- Commits were made locally throughout the week and batched for a single push at the end of Week 2, per Shlok's stated preference.
- Migration files were created but never auto-applied; `supabase db push` was run manually by Shlok after reviewing each migration's contents.
- End-to-end testing in production used a mix of new v1.4 screenings taken through the live form and Supabase Table Editor manual data injection to force specific test scenarios (e.g., backfilling HbA1c onto an existing row to test the Recalculate delta path).

---

## Known Limitations / Deferred Work

- Hindi/Gujarati/Marathi translations for the 39 new v1.4 keys are currently English fallbacks; native review is scheduled for Week 3, with Gujarati prioritized given LDRP's Ahmedabad location and Prof. Wala's likely native fluency.
- README undersells the project by roughly 2× (missing Supabase/Vision/Haiku/Places mentions) — Week 3.
- ML validation artifact (baseline logistic regression on INDIAB features) — go/no-go decision at the July 13 checkpoint based on remaining timeline.
- `consent_to_research` column repurposed for symptoms consent — semantically compatible (documented in the Task 4.1 commit), but a dedicated `symptoms_consent` column may be added later for clarity.
- Cache cleanup for `ocr_cache` and `doctor_search_cache` — no immediate impact, Phase 2C item.
- HbA1c severity gradation is currently flat at "high" for all values ≥6.5%; a future refinement could distinguish ≥9% as "critical" (Phase 2C or later).
- The symptoms-consent gate uses a strict `=== true` equality check; if the checkbox value were ever to arrive as the string `"on"` instead of a boolean `true`, the gate would fail closed (secure default) rather than leak. Documented for awareness, not currently a bug.
- Auto-refresh of Supabase auth tokens (P2C-1 backlog item) has not been audited yet — a session expiring mid-demo during the grant presentation would be embarrassing.
- P2C-cosmetic-1: "AI analysis complete" placement not addressed.
- HbA1c can currently override blood sugar even when blood sugar is significantly higher; this is by design (HbA1c is the superior 3-month marker), but a future v1.5 could consider a "concerning divergence" flag when both are measured and disagree substantially.

---

## Metrics

- **Total tasks completed:** 10 planned tasks (1.1, 1.2, 1.3, 2.1, 2.2, 3.1, 4.1, 4.2, 5.1, 5.2) + 1 unplanned bonus fix (Migration 006), plus a manual verification pass (Task 6.1, no separate commit).
- **Total commits pushed:** 11 — verified via `git log` (one per planned task, plus one for Migration 006).
- **Total migrations applied to production:** 3 (004, 005, 006).
- **Total production screenings in DB before Week 2:** 36 legacy rows, all `algorithm_version = 'rule-v1.3'`.
- **Total production screenings in DB after Week 2:** not stated here — should be verified via `SELECT COUNT(*) FROM health_screenings;` and a breakdown by `algorithm_version` before relying on this number in the final grant report.
- **Total i18n keys added:** 39 English (verified programmatically; corrected from an initial estimate of 38).
- **Days of work:** executed within the Week 2 timebox of the Phase 2B sprint plan as a sequence of scoped, single-session tasks; exact calendar start date not tracked in this report — completion recorded 2026-07-11.
- **Grant deadline remaining:** 20 days (2026-07-11 → 2026-07-31 grant deadline).
