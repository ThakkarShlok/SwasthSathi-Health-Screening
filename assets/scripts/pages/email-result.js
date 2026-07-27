/**
 * ============================================
 * EMAIL MY RESULT (Phase 4 add-on)
 * Lets a logged-in user email THEIR OWN screening result to THEIR OWN address
 * via EmailJS. The email carries a link to the shared result — never any
 * clinical data.
 *
 * Abuse guards:
 *  - Recipient is taken ONLY from the Supabase auth session (user.email).
 *    There is no recipient input field; a user cannot email anyone else.
 *  - Button shows only for logged-in users (mirrors shareResultBtn).
 *  - Client-side cooldown blocks repeat sends of the same result.
 *
 * Link generation is reused from result.js (window.SwasthShare) — not
 * reimplemented here.
 * ============================================
 */

(function () {
    'use strict';

    // ---------------------------------------------------------------- config
    // EmailJS credentials. The PUBLIC KEY below is a browser-side identifier by
    // design — EmailJS intends it to ship in client code, and sends are
    // constrained by the allowed-origins / template settings in the EmailJS
    // dashboard. It is NOT a secret and must not be treated as a leaked key.
    // Service ID and Template ID are likewise non-secret client identifiers.
    const EMAILJS_CONFIG = {
        publicKey: 'lwyK-YEDoTpImVrqy',   // EmailJS Public Key (client-side by design)
        serviceId: 'service_jbqex8w',     // EmailJS Service ID
        templateId: 'template_dp286gc',   // EmailJS Template ID
    };

    // Repeat-send guard: same result cannot be re-emailed within this window.
    const COOLDOWN_MS = 3 * 60 * 1000; // 3 minutes
    const COOLDOWN_PREFIX = 'swasth_email_sent_';

    const t = (key, fallback) =>
        (window.translator ? window.translator.t(key, fallback) : fallback);

    function configured() {
        return !Object.values(EMAILJS_CONFIG).some(
            (v) => !v || v.startsWith('YOUR_'),
        );
    }

    // ---------------------------------------------------------------- cooldown

    function cooldownKey(patientData) {
        // Key by screening id when available so different results are tracked
        // independently; fall back to short code, then a generic key.
        const id = patientData?.id || patientData?.resultShortCode || 'current';
        return `${COOLDOWN_PREFIX}${id}`;
    }

    function remainingCooldownMs(patientData) {
        try {
            const raw = localStorage.getItem(cooldownKey(patientData));
            if (!raw) return 0;
            const elapsed = Date.now() - parseInt(raw, 10);
            return elapsed >= 0 && elapsed < COOLDOWN_MS ? COOLDOWN_MS - elapsed : 0;
        } catch {
            return 0; // storage unavailable — do not block the send
        }
    }

    function markSent(patientData) {
        try {
            localStorage.setItem(cooldownKey(patientData), String(Date.now()));
        } catch {
            /* ignore storage failures */
        }
    }

    // ---------------------------------------------------------------- send

    async function sendEmail(btn, patientData) {
        if (!window.emailjs || !configured()) {
            // Make the reason explicit for debugging — the user-facing toast
            // stays generic, but the console says which precondition failed.
            if (!window.emailjs) {
                console.warn('[email-result] EmailJS SDK not loaded (window.emailjs undefined).');
            } else {
                console.warn('[email-result] EmailJS credentials not set — still placeholders in EMAILJS_CONFIG.');
            }
            showShareToastSafe(t('email_err_unavailable',
                'Email is not available right now. Please try the Share button instead.'));
            return;
        }

        // Cooldown check (repeat-send guard).
        const remaining = remainingCooldownMs(patientData);
        if (remaining > 0) {
            const mins = Math.ceil(remaining / 60000);
            showShareToastSafe(t('email_cooldown',
                'You already emailed this result. Please wait a few minutes before sending again.')
                .replace('{mins}', String(mins)));
            return;
        }

        btn.disabled = true;
        try {
            // Recipient comes ONLY from the authenticated session.
            const user = await window.supabaseClient.checkAuthState();
            if (!user || !user.email) {
                showShareToastSafe(t('email_err_auth', 'Please log in again to email your result.'));
                return;
            }

            // Reuse the existing share-link generation from result.js.
            const share = window.SwasthShare;
            if (!share) {
                showShareToastSafe(t('email_err_unavailable',
                    'Email is not available right now. Please try the Share button instead.'));
                return;
            }
            const code = await share.getOrCreateShareCode(patientData);
            if (!code) {
                showShareToastSafe(t('email_err_link',
                    'Could not prepare your result link. Please try again.'));
                return;
            }
            const resultLink = share.buildShareUrl(code);

            // Name for the greeting — profile first, then auth metadata, then a
            // safe generic. Never clinical data.
            let userName = '';
            try {
                const profile = await window.supabaseClient.getUserProfile();
                userName = profile?.full_name || '';
            } catch { /* profile optional */ }
            if (!userName) userName = user.user_metadata?.full_name || user.email.split('@')[0] || 'there';

            // Template variables: to_email, user_name, result_link. No scores,
            // no risk levels, no readings — a link only.
            await window.emailjs.send(EMAILJS_CONFIG.serviceId, EMAILJS_CONFIG.templateId, {
                to_email: user.email,
                user_name: userName,
                result_link: resultLink,
            });

            markSent(patientData);
            showShareToastSafe(t('email_sent', 'Result emailed to your address.'));
        } catch (err) {
            // Never surface a raw EmailJS error to the user.
            showShareToastSafe(t('email_err_generic',
                'Could not send the email right now. Please try again in a moment.'));
        } finally {
            btn.disabled = false;
        }
    }

    /** Use result.js's toast if present; degrade to a minimal fallback. */
    function showShareToastSafe(message) {
        if (typeof window.showShareToast === 'function') {
            window.showShareToast(message);
            return;
        }
        const body = document.getElementById('shareToastBody');
        const toastEl = document.querySelector('#shareToast .toast');
        if (body && toastEl && window.bootstrap) {
            body.textContent = message;
            window.bootstrap.Toast.getOrCreateInstance(toastEl, { delay: 3000 }).show();
        }
    }

    // ---------------------------------------------------------------- init

    function wire(patientData) {
        const btn = document.getElementById('emailResultBtn');
        if (!btn) return;

        // Mirror shareResultBtn: only for logged-in users.
        if (!window.supabaseClient || !window.supabaseClient.getAccessToken()) return;

        // Initialise EmailJS once (public key is client-side by design).
        if (window.emailjs && configured()) {
            try { window.emailjs.init({ publicKey: EMAILJS_CONFIG.publicKey }); } catch { /* no-op */ }
        }

        btn.style.display = 'inline-block';
        btn.addEventListener('click', () => sendEmail(btn, patientData));
    }

    // result.js publishes the computed result (Phase E handoff). We only need
    // patientData for the link + cooldown key; risk is never recomputed here.
    document.addEventListener('swasth:result-ready', () => {
        const bundle = window.SwasthResult;
        wire(bundle?.patientData || null);
    });
})();
