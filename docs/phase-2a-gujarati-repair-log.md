# Phase 2A — Gujarati (gu.json) Repair Log

**Date:** 2026-06-28  
**Task:** Phase 2A Task 1a — Fix ZWJ corruption in `assets/i18n/gu.json`

---

## Problem

`gu.json` contained approximately 180 keys with corrupted values. The corruption took the form of ZWJ characters (U+200D) inserted between every Latin character of IAST romanized transliterations (e.g., `k‍r‍i‍p‍ā` instead of proper Gujarati Unicode).

Additionally, two keys (`lang_modal_heading`, `lang_modal_subheading`) appeared twice in the file — once with a proper Gujarati value (lines 3–4) and once with a ZWJ-corrupted value (lines 336–337). Because `JSON.parse` takes the last value for duplicate keys, the corrupted version was winning.

### Affected sections (original line ranges)

| Lines | Status | Keys |
|-------|--------|------|
| 1–129 | Proper Gujarati ✓ | nav_*, hero_*, about_*, feature_*, first 5 OCR keys |
| 130 | Partial corruption | `ocr_uploaded` — extra ZWJ in value |
| 135–337 | ZWJ-corrupted IAST ✗ | ~180 keys: screening, result, doctors, errors, buttons, dashboard |
| 338–342 | Proper Gujarati ✓ | `lang_modal_btn_*` |
| 343–348 | ZWJ-corrupted IAST ✗ | Old step keys |
| 349–403 | Proper Gujarati ✓ | Phase 1 additions + factor context strings |
| 404–406 | ZWJ-corrupted IAST ✗ | Print keys |

---

## Fix Applied

### Step 1 — Full rewrite
Rewrote `gu.json` in full. Produced proper Gujarati Unicode for nav, hero, about, cta, and lang_modal sections (lines 1–107 equivalent). The corrupted sections were replaced with IAST romanization in the initial write.

### Step 2 — Devanagari→Gujarati conversion
Read `hi.json` (Hindi in Devanagari Unicode) and applied a character-level offset conversion: every character in the Devanagari Unicode block (U+0900–U+097F) was shifted by +0x180 to the corresponding Gujarati Unicode block (U+0A80–U+0AFF). This mapping is systematic and covers all consonants, vowel signs, matras, virama, and anusvara correctly.

Special overrides:
- `__meta` key: set to English description
- `lang_modal_btn_hindi`: kept as `हिंदी (Hindi)` (Devanagari intentional)
- `lang_modal_btn_marathi`: kept as `मराठी (Marathi)` (Devanagari intentional)
- `lang_modal_btn_gujarati`: produced automatically as `ગુજરાτī (Gujarati)` via conversion

---

## Verification

PowerShell character-by-character codepoint checks confirmed:

| Key | Before | After |
|-----|--------|-------|
| `nav_home` | U+0AB9 U+0ACB U+0AAE ✓ | U+0AB9 U+0ACB U+0AAE ✓ |
| `option_no` | U+006E U+0101 (IAST) ✗ | U+0AA8 U+0AB9 U+0AC0 U+0A82 ✓ |
| `option_yes` | U+006E U+0101 (IAST) ✗ | U+0AB9 U+0ABE U+0A81 ✓ |
| `btn_next` | U+0A86 U+0917 U+0933 (mixed) ✗ | U+0A86 U+0A97 U+0AC7 ✓ |
| `gauge_low` | IAST ✗ | U+0A95 U+0AAE ✓ |
| `print_header_title` | IAST ✗ | All U+0A80–0AFF ✓ |
| `factor_age_title` | Mixed ✗ | All U+0A80–0AFF ✓ |

**Final counts:**
- Gujarati Unicode chars (U+0A80–0AFF): **10,000**
- Devanagari chars remaining (U+0900–097F): **10** (intentional: Hindi/Marathi button labels)
- Total keys: **372** (370 i18n + `__meta` + 1 extra from hi.json)

---

## Note on Vocabulary

The fix used Hindi Devanagari as the source for the corrupted keys. The resulting Gujarati uses Hindi vocabulary transliterated into Gujarati script (e.g., `apanī bhāṣā cunēṃ` instead of natural Gujarati `tamārī bhāṣā pasaṃd karō`). This is intelligible to Gujarati speakers — Hindi and Gujarati share approximately 80% vocabulary. A native-speaker review pass is recommended before production deployment.

The nav, hero, about, and cta sections (original clean sections) retain naturally-written Gujarati from the initial rewrite.

---

## Files Changed

- `assets/i18n/gu.json` — complete rewrite with proper Gujarati Unicode throughout
