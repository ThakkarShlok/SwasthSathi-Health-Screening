/**
 * ============================================
 * SWASTHSATHI - SHARED NAVBAR COMPONENT
 * Injects canonical navbar into #navbar-mount
 * ============================================
 */

(function () {
    function renderNavbar() {
        const mount = document.getElementById('navbar-mount');
        if (!mount) return;

        mount.innerHTML = `
<nav class="navbar navbar-expand-lg fixed-top" id="mainNav">
    <div class="container">
        <a class="navbar-brand" href="index.html" aria-label="SwasthSathi">
            <img src="assets/logo/swasthsathi-logo-horizontal.svg" alt="SwasthSathi" class="brand-logo-full">
            <img src="assets/logo/swasthsathi-icon.svg" alt="SwasthSathi" class="brand-logo-icon">
        </a>
        <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav">
            <span class="navbar-toggler-icon"></span>
        </button>
        <div class="collapse navbar-collapse" id="navbarNav">
            <ul class="navbar-nav ms-auto align-items-center">
                <li class="nav-item">
                    <a class="nav-link" href="index.html" data-i18n="nav_home">Home</a>
                </li>
                <li class="nav-item">
                    <a class="nav-link" href="about.html" data-i18n="nav_about">About Us</a>
                </li>
                <li class="nav-item">
                    <a class="nav-link" href="screening.html" data-i18n="nav_screening">Screening</a>
                </li>
                <li class="nav-item">
                    <a class="nav-link" href="doctors.html" data-i18n="nav_doctors">Find Doctors</a>
                </li>
                <li class="nav-item">
                    <a class="nav-link" href="contact.html" data-i18n="nav_contact">Contact Us</a>
                </li>

                <!-- Language Dropdown -->
                <li class="nav-item dropdown ms-lg-2">
                    <a class="nav-link dropdown-toggle d-flex align-items-center" href="#"
                       id="languageDropdownBtn" role="button"
                       data-bs-toggle="dropdown" aria-expanded="false">
                        <span class="me-2">🇬🇧</span>
                        <span>English</span>
                    </a>
                    <ul class="dropdown-menu dropdown-menu-end" aria-labelledby="languageDropdownBtn">
                        <li>
                            <a class="dropdown-item language-option active" href="#"
                               data-lang="en"
                               onclick="window.translator && window.translator.setLanguage('en'); return false;">
                                <span class="me-2">🇬🇧</span> English
                            </a>
                        </li>
                        <li>
                            <a class="dropdown-item language-option" href="#"
                               data-lang="hi"
                               onclick="window.translator && window.translator.setLanguage('hi'); return false;">
                                <span class="me-2">🇮🇳</span> हिंदी (Hindi)
                            </a>
                        </li>
                        <li>
                            <a class="dropdown-item language-option" href="#"
                               data-lang="gu"
                               onclick="window.translator && window.translator.setLanguage('gu'); return false;">
                                <span class="me-2">🇮🇳</span> ગુજરાતી (Gujarati)
                            </a>
                        </li>
                        <li>
                            <a class="dropdown-item language-option" href="#"
                               data-lang="mr"
                               onclick="window.translator && window.translator.setLanguage('mr'); return false;">
                                <span class="me-2">🇮🇳</span> मराठी (Marathi)
                            </a>
                        </li>
                    </ul>
                </li>

                <li class="nav-item ms-lg-3" id="navAuthSection">
                    <!-- Populated by nav-auth.js -->
                </li>
            </ul>
        </div>
    </div>
</nav>`;
    }

    document.addEventListener('DOMContentLoaded', renderNavbar);

    window.SwasthSathiNavbar = { render: renderNavbar };
})();
