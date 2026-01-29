/**
 * ============================================
 * TRANSLATION ENGINE
 * MyMemory API integration + caching
 * ============================================
 */

class TranslationEngine {
    constructor() {
        this.apiUrl = 'https://api.mymemory.translated.net/get';
        this.currentLang = this.getStoredLanguage();
        this.cache = this.loadCache();
        this.translating = false;
    }

    /**
     * Get stored language preference
     */
    getStoredLanguage() {
        return localStorage.getItem('selectedLanguage') || 'en';
    }

    /**
     * Set language preference
     */
    setLanguage(langCode) {
        if (!window.LANGUAGES[langCode]) {
            console.error(`Language ${langCode} not supported`);
            return;
        }

        localStorage.setItem('selectedLanguage', langCode);
        this.currentLang = langCode;
        
        // Update dropdown UI
        this.updateLanguageDropdown();
        
        // Translate page
        this.translatePage();
    }

    /**
     * Load translation cache from localStorage
     */
    loadCache() {
        try {
            const cached = localStorage.getItem('translationCache');
            return cached ? JSON.parse(cached) : {};
        } catch (e) {
            return {};
        }
    }

    /**
     * Save cache to localStorage
     */
    saveCache() {
        try {
            localStorage.setItem('translationCache', JSON.stringify(this.cache));
        } catch (e) {
            console.warn('Cache save failed:', e);
        }
    }

    /**
     * Get cached translation
     */
    getCached(text, targetLang) {
        if (!this.cache[targetLang]) return null;
        return this.cache[targetLang][text] || null;
    }

    /**
     * Set cached translation
     */
    setCached(text, targetLang, translation) {
        if (!this.cache[targetLang]) {
            this.cache[targetLang] = {};
        }
        this.cache[targetLang][text] = translation;
        this.saveCache();
    }

    /**
     * Translate single text using MyMemory API
     */
    async translateText(text, targetLang) {
        // Return original if English
        if (targetLang === 'en') return text;

        // Check cache first
        const cached = this.getCached(text, targetLang);
        if (cached) return cached;

        // Clean text
        const cleanText = text.trim();
        if (!cleanText) return text;

        try {
            const url = `${this.apiUrl}?q=${encodeURIComponent(cleanText)}&langpair=en|${targetLang}`;
            
            const response = await fetch(url);
            const data = await response.json();

            if (data.responseStatus === 200 && data.responseData?.translatedText) {
                const translation = data.responseData.translatedText;
                
                // Cache it
                this.setCached(cleanText, targetLang, translation);
                
                return translation;
            } else {
                console.warn('Translation failed:', data);
                return text; // Fallback to original
            }
        } catch (error) {
            console.error('Translation API error:', error);
            return text; // Fallback to original
        }
    }

    /**
     * Translate entire page
     */
    async translatePage() {
        if (this.currentLang === 'en') {
            // Reset to original English
            this.resetToEnglish();
            return;
        }

        if (this.translating) {
            console.log('Translation already in progress...');
            return;
        }

        this.translating = true;
        this.showTranslationProgress();

        // Find all elements with data-i18n attribute
        const elements = document.querySelectorAll('[data-i18n]');
        const total = elements.length;
        let completed = 0;

        // Batch translate (5 at a time to avoid rate limits)
        const batchSize = 5;
        for (let i = 0; i < elements.length; i += batchSize) {
            const batch = Array.from(elements).slice(i, i + batchSize);
            
            await Promise.all(batch.map(async (element) => {
                const key = element.getAttribute('data-i18n');
                const originalText = window.TRANSLATION_KEYS[key] || element.textContent;
                
                // Translate
                const translated = await this.translateText(originalText, this.currentLang);
                
                // Update element
                if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
                    if (element.placeholder) {
                        element.placeholder = translated;
                    }
                } else {
                    element.textContent = translated;
                }

                completed++;
                this.updateTranslationProgress(completed, total);
            }));

            // Small delay between batches
            await new Promise(resolve => setTimeout(resolve, 200));
        }

        this.hideTranslationProgress();
        this.translating = false;
    }

    /**
     * Reset to English (original text)
     */
    resetToEnglish() {
        const elements = document.querySelectorAll('[data-i18n]');
        
        elements.forEach(element => {
            const key = element.getAttribute('data-i18n');
            const originalText = window.TRANSLATION_KEYS[key];
            
            if (originalText) {
                if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
                    if (element.placeholder) {
                        element.placeholder = originalText;
                    }
                } else {
                    element.textContent = originalText;
                }
            }
        });
    }

    /**
     * Update language dropdown to show current selection
     */
    updateLanguageDropdown() {
        const dropdownBtn = document.getElementById('languageDropdownBtn');
        if (dropdownBtn) {
            const lang = window.LANGUAGES[this.currentLang];
            dropdownBtn.innerHTML = `
                <span class="me-2">${lang.flag}</span>
                <span>${lang.nativeName}</span>
            `;
        }

        // Update active state
        document.querySelectorAll('.language-option').forEach(option => {
            option.classList.remove('active');
            if (option.dataset.lang === this.currentLang) {
                option.classList.add('active');
            }
        });
    }

    /**
     * Show translation progress indicator
     */
    showTranslationProgress() {
        let indicator = document.getElementById('translationProgress');
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'translationProgress';
            indicator.innerHTML = `
                <div style="position: fixed; top: 70px; right: 20px; background: white; 
                            padding: 15px 20px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                            z-index: 9999; display: flex; align-items: center; gap: 10px;">
                    <div class="spinner-border spinner-border-sm text-primary" role="status"></div>
                    <span style="font-size: 14px; color: #1f2937;">Translating page...</span>
                    <span id="progressText" style="font-size: 12px; color: #6b7280;"></span>
                </div>
            `;
            document.body.appendChild(indicator);
        }
        indicator.style.display = 'block';
    }

    /**
     * Update translation progress
     */
    updateTranslationProgress(completed, total) {
        const progressText = document.getElementById('progressText');
        if (progressText) {
            progressText.textContent = `${completed}/${total}`;
        }
    }

    /**
     * Hide translation progress indicator
     */
    hideTranslationProgress() {
        const indicator = document.getElementById('translationProgress');
        if (indicator) {
            indicator.style.display = 'none';
        }
    }

    /**
     * Clear all cached translations
     */
    clearCache() {
        this.cache = {};
        localStorage.removeItem('translationCache');
        console.log('Translation cache cleared');
    }
}

// Initialize global translation engine
window.translator = new TranslationEngine();

// Auto-translate on page load
document.addEventListener('DOMContentLoaded', () => {
    if (window.translator.currentLang !== 'en') {
        window.translator.translatePage();
    }
    window.translator.updateLanguageDropdown();
});

console.log('✓ Translation engine initialized');
console.log('Current language:', window.translator.currentLang);