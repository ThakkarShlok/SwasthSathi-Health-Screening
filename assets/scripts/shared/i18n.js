/**
 * ============================================
 * TRANSLATION ENGINE v2 — Static JSON Mode
 * Replaces MyMemory API with local JSON files.
 * Public API:
 *   t(key, fallback?, subs?)  → translated string
 *   setLanguage(lang)         → async, loads dict + re-renders page
 *   translatePage()           → sync render from loaded dict
 *   applyTranslations()       → alias for translatePage() (compat)
 *   updateLanguageDropdown()  → sync, refreshes navbar UI
 * ============================================
 */

class TranslationEngine {
    constructor() {
        this.currentLang = localStorage.getItem('selectedLanguage') || 'en';
        this._dicts = {};        // { lang: { key: value } }
        this._pending = {};      // { lang: Promise }

        // Begin loading the current language dict immediately so it is
        // ready (or nearly so) by the time DOMContentLoaded handlers run.
        if (this.currentLang !== 'en') {
            this.loadDictionary(this.currentLang);
        }
    }

    // ------------------------------------------------------------------
    // t(key, fallback?, substitutions?)
    //   Returns the translated value for key, with optional {name} subs.
    //   Resolution order:
    //     1. loaded dictionary for currentLang
    //     2. window.TRANSLATION_KEYS (sync English fallback, Option B)
    //     3. explicit fallback argument
    //     4. key itself
    // ------------------------------------------------------------------
    t(key, fallback, substitutions) {
        const dict = this._dicts[this.currentLang];
        let value = (dict && dict[key])
            || (window.TRANSLATION_KEYS && window.TRANSLATION_KEYS[key])
            || fallback
            || key;

        if (substitutions && typeof value === 'string') {
            Object.entries(substitutions).forEach(([k, v]) => {
                value = value.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
            });
        }
        return value;
    }

    // ------------------------------------------------------------------
    // setLanguage(langCode) — async
    // ------------------------------------------------------------------
    async setLanguage(langCode) {
        if (!window.LANGUAGES || !window.LANGUAGES[langCode]) {
            console.error(`i18n: language "${langCode}" not in LANGUAGES registry`);
            return;
        }

        localStorage.setItem('selectedLanguage', langCode);
        this.currentLang = langCode;

        if (langCode !== 'en') {
            await this.loadDictionary(langCode);
        }

        this.translatePage();
        this.updateLanguageDropdown();
    }

    // ------------------------------------------------------------------
    // translatePage() — synchronous render from the loaded dictionary.
    // Falls back to TRANSLATION_KEYS so English always works immediately
    // even before any JSON file has been fetched.
    // ------------------------------------------------------------------
    translatePage() {
        const dict = this._dicts[this.currentLang] || {};
        const fallbackDict = window.TRANSLATION_KEYS || {};

        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            const value = dict[key] || fallbackDict[key];
            if (!value) return;

            if ((el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') && el.hasAttribute('placeholder')) {
                el.placeholder = value;
            } else {
                el.textContent = value;
            }
        });
    }

    // Alias — footer.js calls applyTranslations() after injecting HTML.
    applyTranslations() {
        this.translatePage();
    }

    // ------------------------------------------------------------------
    // updateLanguageDropdown() — updates navbar button + active state
    // ------------------------------------------------------------------
    updateLanguageDropdown() {
        const btn = document.getElementById('languageDropdownBtn');
        if (btn && window.LANGUAGES) {
            const lang = window.LANGUAGES[this.currentLang];
            if (lang) {
                btn.innerHTML = `<span class="me-2">${lang.flag}</span><span>${lang.nativeName}</span>`;
            }
        }

        document.querySelectorAll('.language-option').forEach(opt => {
            opt.classList.toggle('active', opt.dataset.lang === this.currentLang);
        });
    }

    // ------------------------------------------------------------------
    // loadDictionary(lang) — fetch + memory-cache a JSON file.
    // Returns the dict object (or {} on failure).
    // Multiple callers for the same lang share the same Promise.
    // ------------------------------------------------------------------
    loadDictionary(lang) {
        if (this._dicts[lang]) return Promise.resolve(this._dicts[lang]);
        if (this._pending[lang]) return this._pending[lang];

        const promise = fetch(`assets/i18n/${lang}.json`)
            .then(res => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return res.json();
            })
            .then(dict => {
                this._dicts[lang] = dict;
                delete this._pending[lang];
                console.log(`✅ i18n: ${lang}.json loaded (${Object.keys(dict).length} keys)`);
                return dict;
            })
            .catch(err => {
                console.warn(`⚠️ i18n: could not load ${lang}.json — using TRANSLATION_KEYS fallback`, err.message);
                this._dicts[lang] = {};
                delete this._pending[lang];
                return {};
            });

        this._pending[lang] = promise;
        return promise;
    }
}

// ---------------------------------------------------------------------------
// Initialise global instance
// ---------------------------------------------------------------------------
window.translator = new TranslationEngine();

document.addEventListener('DOMContentLoaded', async () => {
    // If a non-English language is active, ensure its dictionary is loaded
    // (the constructor kicked off the fetch; this await just waits for it).
    if (window.translator.currentLang !== 'en') {
        await window.translator.loadDictionary(window.translator.currentLang);
    }

    // Render all [data-i18n] elements with the active language.
    // English pages resolve instantly from TRANSLATION_KEYS (no fetch needed).
    window.translator.translatePage();
    window.translator.updateLanguageDropdown();
});

console.log('✅ i18n engine v2 ready (static JSON mode)');
