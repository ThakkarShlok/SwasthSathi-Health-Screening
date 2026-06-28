/**
 * ============================================
 * FIRST-VISIT LANGUAGE SELECTION MODAL
 * Gate: only shown when localStorage.selectedLanguage is unset.
 * Injects overlay into DOM, sets language on selection,
 * and removes itself — never shown again.
 * ============================================
 */

(function () {
    // Already has a language preference — nothing to do.
    if (localStorage.getItem('selectedLanguage')) return;

    function injectModal() {
        const t = window.translator
            ? (key, fb) => window.translator.t(key, fb)
            : (key, fb) => fb;

        const overlay = document.createElement('div');
        overlay.id = 'langSelectModal';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-labelledby', 'langModalTitle');

        overlay.innerHTML = `
            <div class="lang-modal-card">
                <div class="lang-modal-logo">&#129514; SwasthSathi</div>
                <div class="lang-modal-multilang" id="langModalTitle" role="heading" aria-level="2">
                    <div class="lm-col" lang="en">Choose Your Language</div>
                    <div class="lm-col" lang="hi">अपनी भाषा चुनें</div>
                    <div class="lm-col" lang="gu">અપની ભાષા ચુનેં</div>
                    <div class="lm-col" lang="mr">तुमची भाषा निवडा</div>
                </div>
                <div class="lang-btn-grid">
                    <button class="lang-btn" data-lang="en" aria-label="English">
                        <span class="lang-btn-flag">&#127468;&#127463;</span>
                        <span class="lang-btn-native">English</span>
                        <span class="lang-btn-english">English</span>
                    </button>
                    <button class="lang-btn" data-lang="hi" aria-label="Hindi">
                        <span class="lang-btn-flag">&#127470;&#127475;</span>
                        <span class="lang-btn-native">&#2361;&#2367;&#2306;&#2342;&#2368;</span>
                        <span class="lang-btn-english">Hindi</span>
                    </button>
                    <button class="lang-btn" data-lang="gu" aria-label="Gujarati">
                        <span class="lang-btn-flag">&#127470;&#127475;</span>
                        <span class="lang-btn-native">&#2711;&#2753;&#2716;&#2736;&#2750;&#2724;&#2752;</span>
                        <span class="lang-btn-english">Gujarati</span>
                    </button>
                    <button class="lang-btn" data-lang="mr" aria-label="Marathi">
                        <span class="lang-btn-flag">&#127470;&#127475;</span>
                        <span class="lang-btn-native">&#2350;&#2352;&#2366;&#2336;&#2368;</span>
                        <span class="lang-btn-english">Marathi</span>
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        function closeModal(lang) {
            overlay.classList.add('hidden');
            setTimeout(() => overlay.remove(), 300);
            if (window.translator) {
                window.translator.setLanguage(lang);
            } else {
                localStorage.setItem('selectedLanguage', lang);
            }
        }

        // Language button clicks
        overlay.querySelectorAll('.lang-btn').forEach(btn => {
            btn.addEventListener('click', () => closeModal(btn.getAttribute('data-lang')));
        });

        // ESC key defaults to English
        overlay.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                closeModal('en');
                return;
            }
            // Basic focus trap inside modal
            if (e.key === 'Tab') {
                const buttons = overlay.querySelectorAll('.lang-btn');
                const first = buttons[0];
                const last = buttons[buttons.length - 1];
                if (e.shiftKey) {
                    if (document.activeElement === first) { e.preventDefault(); last.focus(); }
                } else {
                    if (document.activeElement === last) { e.preventDefault(); first.focus(); }
                }
            }
        });

        // Click outside card defaults to English
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeModal('en');
        });

        // Auto-focus first button after animation
        setTimeout(() => overlay.querySelector('.lang-btn').focus(), 50);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', injectModal);
    } else {
        injectModal();
    }
})();

console.log('✅ Language modal ready');
