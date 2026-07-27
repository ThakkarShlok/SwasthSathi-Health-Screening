/**
 * ============================================
 * CONTACT FORM (Phase 4)
 * Public contact page — sends a message to the SwasthSathi support inbox
 * via EmailJS.
 *
 * The support recipient is hardcoded in the EmailJS template, NOT here.
 * This code sends only { from_name, from_email, subject, message } and never
 * a "to" address — a public page must not be able to choose the recipient.
 *
 * Anti-abuse (a public form with a client-visible key is a spam target):
 *   1. Honeypot field — bots fill it, humans don't → silently drop.
 *   2. Client-side rate limit — one send per minute + a per-session cap.
 *   3. Validation — email format, required fields, max message length.
 * If spam gets through these, the next layer is reCAPTCHA (EmailJS supports
 * an integration) — but honeypot + rate limit is the right starting point.
 * ============================================
 */

(function () {
    'use strict';

    // ---------------------------------------------------------------- config
    // Same EmailJS account as the "Email My Result" feature. The PUBLIC KEY is
    // client-side by design — EmailJS ships it in browser code and constrains
    // sends via the dashboard allowed-origins list. It is NOT a secret.
    // The contact template's recipient is fixed inside the EmailJS template;
    // we deliberately pass no "to" address.
    const EMAILJS_CONFIG = {
        publicKey: 'lwyK-YEDoTpImVrqy',
        serviceId: 'service_jbqex8w',
        templateId: 'template_ddjr4th', // contact-form template
    };

    const MAX_MESSAGE = 2000;
    const MAX_NAME = 100;
    const MAX_SUBJECT = 150;
    const RATE_LIMIT_MS = 60 * 1000;   // one send per minute
    const SESSION_CAP = 5;             // max sends per browser session
    const LS_LAST_SENT = 'swasth_contact_last_sent';
    const SS_COUNT = 'swasth_contact_session_count';

    // Simple, permissive email shape check — real validation is the delivery.
    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    const t = (key, fallback) =>
        (window.translator ? window.translator.t(key, fallback) : fallback);

    const $ = (id) => document.getElementById(id);

    function configured() {
        return !Object.values(EMAILJS_CONFIG).some((v) => !v || v.startsWith('YOUR_'));
    }

    // ---------------------------------------------------------------- status

    function setStatus(message, kind) {
        const el = $('cfStatus');
        if (!el) return;
        el.textContent = message || '';
        el.classList.remove('cf-status-error', 'cf-status-ok');
        if (kind === 'error') el.classList.add('cf-status-error');
        else if (kind === 'ok') el.classList.add('cf-status-ok');
    }

    function showToast() {
        const toastEl = $('contactToast');
        if (toastEl && window.bootstrap) {
            window.bootstrap.Toast.getOrCreateInstance(toastEl, { delay: 4000 }).show();
        }
    }

    // ---------------------------------------------------------------- limits

    /** Returns remaining ms until the next send is allowed, or 0 if allowed. */
    function rateLimitRemaining() {
        try {
            const raw = localStorage.getItem(LS_LAST_SENT);
            if (!raw) return 0;
            const elapsed = Date.now() - parseInt(raw, 10);
            return elapsed >= 0 && elapsed < RATE_LIMIT_MS ? RATE_LIMIT_MS - elapsed : 0;
        } catch {
            return 0; // storage blocked — do not hard-block a genuine user
        }
    }

    function sessionCountReached() {
        try {
            return parseInt(sessionStorage.getItem(SS_COUNT) || '0', 10) >= SESSION_CAP;
        } catch {
            return false;
        }
    }

    function recordSend() {
        try { localStorage.setItem(LS_LAST_SENT, String(Date.now())); } catch { /* ignore */ }
        try {
            const n = parseInt(sessionStorage.getItem(SS_COUNT) || '0', 10) + 1;
            sessionStorage.setItem(SS_COUNT, String(n));
        } catch { /* ignore */ }
    }

    // ---------------------------------------------------------------- submit

    async function submit(btn) {
        setStatus('', null);

        const name = ($('cfName').value || '').trim();
        const email = ($('cfEmail').value || '').trim();
        const subject = ($('cfSubject').value || '').trim();
        const message = ($('cfMessage').value || '').trim();
        const honeypot = ($('cfWebsite').value || '').trim();

        // 1. Honeypot — a filled hidden field means a bot. Fake success, send
        //    nothing. Never reveal that it was detected.
        if (honeypot) {
            resetForm();
            showToast();
            setStatus(t('contact_success', 'Thanks — we have received your message.'), 'ok');
            return;
        }

        // 3. Validation.
        if (!name || !email || !subject || !message) {
            setStatus(t('contact_err_required', 'Please fill in all fields.'), 'error');
            return;
        }
        if (!EMAIL_RE.test(email)) {
            setStatus(t('contact_err_email', 'Please enter a valid email address.'), 'error');
            return;
        }
        if (message.length > MAX_MESSAGE) {
            setStatus(t('contact_err_long', 'Your message is too long. Please shorten it.'), 'error');
            return;
        }

        // 2. Rate limit + session cap.
        if (sessionCountReached()) {
            setStatus(t('contact_err_session', 'You have sent several messages already. Please try again later.'), 'error');
            return;
        }
        const wait = rateLimitRemaining();
        if (wait > 0) {
            setStatus(t('contact_err_rate', 'Please wait a moment before sending another message.'), 'error');
            return;
        }

        if (!window.emailjs || !configured()) {
            setStatus(t('contact_err_generic', 'Could not send your message right now. Please try again later.'), 'error');
            return;
        }

        btn.disabled = true;
        setStatus(t('contact_sending', 'Sending...'), null);

        try {
            // Only these four vars. No recipient — the template fixes it.
            await window.emailjs.send(EMAILJS_CONFIG.serviceId, EMAILJS_CONFIG.templateId, {
                from_name: name.slice(0, MAX_NAME),
                from_email: email,
                subject: subject.slice(0, MAX_SUBJECT),
                message: message.slice(0, MAX_MESSAGE),
            });

            recordSend();
            resetForm();
            showToast();
            setStatus(t('contact_success', 'Thanks — we have received your message.'), 'ok');
        } catch (err) {
            // Never surface a raw EmailJS error.
            setStatus(t('contact_err_generic', 'Could not send your message right now. Please try again later.'), 'error');
        } finally {
            btn.disabled = false;
        }
    }

    function resetForm() {
        ['cfName', 'cfEmail', 'cfSubject', 'cfMessage', 'cfWebsite'].forEach((id) => {
            const el = $(id);
            if (el) el.value = '';
        });
        updateCounter();
    }

    function updateCounter() {
        const msg = $('cfMessage');
        const counter = $('cfCounter');
        if (!msg || !counter) return;
        const n = msg.value.length;
        counter.textContent = n > MAX_MESSAGE - 200 ? `${n} / ${MAX_MESSAGE}` : '';
        counter.classList.toggle('cf-counter-warn', n > MAX_MESSAGE);
    }

    // ---------------------------------------------------------------- init

    function init() {
        const btn = $('cfSend');
        if (!btn) return;

        if (window.emailjs && configured()) {
            try { window.emailjs.init({ publicKey: EMAILJS_CONFIG.publicKey }); } catch { /* no-op */ }
        }

        btn.addEventListener('click', () => submit(btn));

        const msg = $('cfMessage');
        if (msg) msg.addEventListener('input', updateCounter);

        // Enter in a single-line field submits; Enter in the textarea is a newline.
        ['cfName', 'cfEmail', 'cfSubject'].forEach((id) => {
            const el = $(id);
            if (!el) return;
            el.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') { e.preventDefault(); submit(btn); }
            });
        });
    }

    document.addEventListener('DOMContentLoaded', init);
})();
