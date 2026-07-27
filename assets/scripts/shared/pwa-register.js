/**
 * ============================================
 * PWA REGISTRATION + UPDATE PROMPT (Phase 4)
 *
 * Registers sw.js only in production over HTTPS (localhost/file:// are skipped
 * so the service worker never interferes with local dev or the auth/Edge
 * Function flows during testing).
 *
 * Update flow: when a new service worker has installed and is waiting, we show
 * a dismissible "new version — refresh" toast instead of silently serving old
 * code. Refresh activates the waiting worker and reloads once.
 * ============================================
 */

(function () {
    'use strict';

    if (!('serviceWorker' in navigator)) return;

    // Only register on a secure production origin. Skip localhost/127.0.0.1 and
    // file:// so local development is unaffected. (HTTPS is required for SW; the
    // one allowed exception, localhost, is deliberately excluded here.)
    const host = location.hostname;
    const isLocal = host === 'localhost' || host === '127.0.0.1' || host === '' || host.endsWith('.local');
    const isSecure = location.protocol === 'https:';
    if (isLocal || !isSecure) {
        console.log('[pwa] Service worker registration skipped (non-production origin).');
        return;
    }

    let refreshing = false;

    function showUpdateToast(worker) {
        if (document.getElementById('pwaUpdateToast')) return;

        const toast = document.createElement('div');
        toast.className = 'pwa-update-toast';
        toast.id = 'pwaUpdateToast';
        toast.setAttribute('role', 'status');
        toast.innerHTML =
            '<span>A new version is available.</span>' +
            '<button type="button" class="pwa-update-refresh">Refresh</button>' +
            '<button type="button" class="pwa-update-dismiss" aria-label="Dismiss">✕</button>';
        document.body.appendChild(toast);
        requestAnimationFrame(() => toast.classList.add('pwa-update-show'));

        toast.querySelector('.pwa-update-refresh').addEventListener('click', () => {
            // Tell the waiting worker to take over; controllerchange reloads.
            worker.postMessage({ type: 'SKIP_WAITING' });
        });
        toast.querySelector('.pwa-update-dismiss').addEventListener('click', () => {
            toast.classList.remove('pwa-update-show');
            setTimeout(() => toast.remove(), 300);
        });
    }

    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').then((reg) => {
            // A worker is already waiting (installed on a previous visit).
            if (reg.waiting) showUpdateToast(reg.waiting);

            // A new worker started installing — watch for it to finish.
            reg.addEventListener('updatefound', () => {
                const installing = reg.installing;
                if (!installing) return;
                installing.addEventListener('statechange', () => {
                    // "installed" + an existing controller = an update (not first install).
                    if (installing.state === 'installed' && navigator.serviceWorker.controller) {
                        showUpdateToast(installing);
                    }
                });
            });
        }).catch((err) => {
            console.warn('[pwa] Service worker registration failed:', err);
        });

        // When the new worker takes control, reload once to pick up new assets.
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (refreshing) return;
            refreshing = true;
            location.reload();
        });
    });
})();
