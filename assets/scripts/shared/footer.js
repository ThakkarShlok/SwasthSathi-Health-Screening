/**
 * ============================================
 * SWASTHSATHI - SHARED FOOTER COMPONENT
 * Injects canonical footer into #footer-mount
 * ============================================
 */

(function () {
    function renderFooter() {
        const mount = document.getElementById('footer-mount');
        if (!mount) return;

        mount.innerHTML = `
<footer class="footer">
    <div class="container">
        <div class="row">
            <div class="col-lg-4 mb-4">
                <h5>
                    <img src="assets/logo/swasthsathi-icon.svg" alt="" class="footer-brand-icon me-2">SwasthSathi
                </h5>
                <p class="text-muted" data-i18n="footer_tagline">Your trusted companion for early health screening. Evidence-based, multilingual, and free for everyone.</p>
            </div>
            <div class="col-lg-4 mb-4">
                <h5 data-i18n="footer_quick_links">Quick Links</h5>
                <a href="index.html" data-i18n="nav_home">Home</a>
                <a href="about.html" data-i18n="nav_about">About Us</a>
                <a href="screening.html" data-i18n="nav_screening">Screening</a>
                <a href="doctors.html" data-i18n="nav_doctors">Find Doctors</a>
                <a href="contact.html" data-i18n="nav_contact">Contact Us</a>
                <a href="privacy.html" data-i18n="footer_privacy_policy">Privacy Policy</a>
            </div>
            <div class="col-lg-4 mb-4">
                <h5 data-i18n="footer_important">Important</h5>
                <p class="text-muted">
                    <small data-i18n="footer_disclaimer">This is a screening tool, not a diagnostic tool. Always consult a qualified healthcare professional for diagnosis and treatment.</small>
                </p>
            </div>
        </div>
        <hr class="border-secondary my-4">
        <div class="text-center text-muted">
            <p class="mb-0" data-i18n="footer_copyright">© 2026 SwasthSathi. An open health screening initiative.</p>
        </div>
    </div>
</footer>`;

        // Re-apply translations to newly injected footer if translator is already active
        if (window.translator && typeof window.translator.applyTranslations === 'function') {
            window.translator.applyTranslations();
        }
    }

    document.addEventListener('DOMContentLoaded', renderFooter);

    window.SwasthSathiFooter = { render: renderFooter };
})();
