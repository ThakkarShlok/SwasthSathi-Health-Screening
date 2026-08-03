/**
 * doctors.js — live specialist search via the Places-backed Edge Function.
 *
 * CHANGES FROM THE PREVIOUS VERSION
 * ---------------------------------
 * 1. The FALLBACK_DOCTORS array is gone. It contained six invented
 *    physicians with invented ratings and review counts, rendered on a
 *    page that tells the user doctor data is sourced from public
 *    platforms. A "Sample" badge does not make fabricated clinical-
 *    adjacent data acceptable. When we have no results, we now say so.
 *
 * 2. No automatic search on page load. The previous version replayed a
 *    cached coordinate from sessionStorage and fired two billable Places
 *    calls on every visit, without the user asking. Search is now always
 *    an explicit user action.
 *
 * 3. Every terminal state — signed out, permission denied, rate limited,
 *    network failure, zero results — renders a distinct empty state that
 *    says what happened and what to do next.
 */

(function () {
    'use strict';

    var SEARCH_TIMEOUT_MS = 10000;
    var SECTIONS = [
        { id: 'diabetesDoctors', type: 'diabetes', theme: 'success' },
        { id: 'hypertensionDoctors', type: 'hypertension', theme: 'danger' }
    ];

    document.addEventListener('DOMContentLoaded', async function () {
        var isLoggedIn = await resolveAuth();
        var locationCard = document.getElementById('locationSearchCard');
        var loginCard = document.getElementById('loginPromptCard');
        var findBtn = document.getElementById('findNearbyBtn');
        var searchingEl = document.getElementById('locationSearching');

        if (isLoggedIn) {
            if (locationCard) locationCard.style.display = 'block';
            if (findBtn) findBtn.addEventListener('click', handleFindNearby);
            SECTIONS.forEach(function (s) {
                renderEmptyState(s.id, 'idle');
            });
        } else {
            showSignedOut(t('doctors_signin_required',
                'Sign in to search for diabetes and hypertension specialists near your location.'));
        }

        function setBusy(busy) {
            if (findBtn) findBtn.disabled = busy;
            if (searchingEl) searchingEl.style.display = busy ? 'block' : 'none';
        }

        function showSignedOut(message) {
            if (locationCard) locationCard.style.display = 'none';
            if (loginCard) loginCard.style.display = 'block';
            SECTIONS.forEach(function (s) { renderEmptyState(s.id, 'signed_out'); });
            if (message) setNotice('warning', message);
        }

        async function handleFindNearby() {
            if (isBusy()) return;
            setBusy(true);
            clearNotice();

            try {
                var coords = await getLocation();
                await runSearch(coords);
            } catch (e) {
                handleSearchError(e);
            } finally {
                setBusy(false);
                if (window.InFlightTracker) window.InFlightTracker.end('places');
            }
        }

        async function runSearch(coords) {
            SECTIONS.forEach(function (s) { renderLoading(s.id, s.theme); });

            var results = await Promise.all(SECTIONS.map(function (s) {
                return searchDoctors(coords.latitude, coords.longitude, s.type);
            }));

            var total = 0;
            var failed = 0;

            SECTIONS.forEach(function (s, i) {
                var places = results[i];
                if (Array.isArray(places) && places.length > 0) {
                    renderPlaces(s.id, places, s.theme);
                    total += places.length;
                } else if (places === null) {
                    failed += 1;
                    renderEmptyState(s.id, 'failed');
                } else {
                    renderEmptyState(s.id, 'no_results');
                }
            });

            if (total === 0 && failed === SECTIONS.length) {
                // Every request failed. We never successfully asked, so we must
                // NOT tell the user there are no doctors near them.
                setNotice('warning', t('doctors_search_failed',
                    'The search did not complete, so we cannot say what is nearby. Check your connection and try again.'));
                return;
            }

            if (total > 0) {
                setNotice('success', t('doctors_live_results',
                    'Showing ' + total + ' listings near you, in the order the map data returned them.'));
                if (locationCard) locationCard.style.display = 'none';
            } else {
                setNotice('secondary', t('doctors_none_nearby',
                    'No specialists found within the search area. Try again from a larger town, or contact your nearest primary health centre.'));
            }
        }

        function handleSearchError(e) {
            if (e && e.message === 'SESSION_EXPIRED') {
                // The token we held was rejected. Do not blame the network or
                // imply there are no doctors nearby: say the session ended.
                showSignedOut(t('doctors_session_expired',
                    'Your session has ended. Please sign in again to search for doctors near you.'));
                return;
            }
            if (e && e.code === 1) {
                setNotice('warning', t('doctors_location_denied',
                    'Location permission was declined, so we cannot search near you. Enable location for this site and try again.'));
            } else if (e && e.code === 3) {
                setNotice('warning', t('doctors_location_timeout',
                    'Could not get your location in time. Move to an open area or check that location is switched on, then try again.'));
            } else if (e && e.message === 'RATE_LIMIT') {
                setNotice('warning', t('doctors_places_limit',
                    'Search limit reached for now. Please try again later.'));
            } else if (e && e.message === 'NO_GEOLOCATION') {
                setNotice('warning', t('doctors_no_geolocation',
                    'This browser cannot share your location. Try a different browser, or search for a nearby hospital on a map app.'));
            } else {
                setNotice('secondary', t('doctors_search_failed',
                    'The search did not complete. Check your connection and try again.'));
            }
            SECTIONS.forEach(function (s) { renderEmptyState(s.id, 'failed'); });
        }
    });

    /* ---------- data ---------- */

    /**
     * Treat only an explicit `false` as "a request is already in flight".
     * A tracker whose start() returns nothing must not dead-lock the button.
     */
    function isBusy() {
        var tr = window.InFlightTracker;
        if (!tr || typeof tr.start !== 'function') return false;
        return tr.start('places') === false;
    }

    /**
     * The Supabase client may hydrate its session asynchronously, so a
     * synchronous getAccessToken() can return null on first paint even for a
     * signed-in user. Ask again via checkAuthState() before gating anyone out.
     */
    async function resolveAuth() {
        var c = window.supabaseClient;
        if (!c) return false;
        if (typeof c.getValidAccessToken === 'function') {
            try { if (await c.getValidAccessToken()) return true; } catch (e) { /* fall through */ }
        } else if (typeof c.getAccessToken === 'function' && c.getAccessToken()) {
            return true;
        }
        if (typeof c.checkAuthState === 'function') {
            try { await c.checkAuthState(); } catch (e) { /* fall through */ }
        }
        return !!(typeof c.getAccessToken === 'function' && c.getAccessToken());
    }

    function getLocation() {
        return new Promise(function (resolve, reject) {
            if (!navigator.geolocation) {
                reject(new Error('NO_GEOLOCATION'));
                return;
            }
            navigator.geolocation.getCurrentPosition(
                function (pos) { resolve(pos.coords); },
                function (err) { reject(err); },
                { timeout: SEARCH_TIMEOUT_MS, maximumAge: 60000 }
            );
        });
    }

    /**
     * @returns {Promise<Array|null>} array of places on success (possibly
     *          empty), or null when the request itself failed. The caller
     *          distinguishes "nothing nearby" from "we could not ask".
     */
    async function searchDoctors(lat, lng, type) {
        var c = window.supabaseClient;
        var token = c && typeof c.getValidAccessToken === 'function'
            ? await c.getValidAccessToken()
            : (c && c.getAccessToken());
        if (!token) return null;

        var controller = new AbortController();
        var tid = setTimeout(function () { controller.abort(); }, SEARCH_TIMEOUT_MS);

        try {
            // NOTE: verify this path matches the deployed function name.
            var url = window.supabaseClient.supabaseUrl + '/functions/v1/doctor-search';
            var resp = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + token,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ lat: lat, lng: lng, type: type }),
                signal: controller.signal
            });

            if (resp.status === 401) throw new Error('SESSION_EXPIRED');
            if (resp.status === 429) throw new Error('RATE_LIMIT');
            if (!resp.ok) return null;

            var data = await resp.json();
            return Array.isArray(data.places) ? data.places : [];
        } catch (e) {
            if (e && (e.message === 'RATE_LIMIT' || e.message === 'SESSION_EXPIRED')) throw e;
            return null;
        } finally {
            clearTimeout(tid);
        }
    }

    /* ---------- rendering ---------- */

    function renderLoading(containerId, theme) {
        var container = document.getElementById(containerId);
        if (!container) return;
        container.innerHTML =
            '<div class="col-12 text-center py-4">' +
            '<div class="spinner-border text-' + theme + '" role="status">' +
            '<span class="visually-hidden">' + escapeHtml(t('loading', 'Loading…')) + '</span>' +
            '</div></div>';
    }

    var EMPTY_STATES = {
        idle: {
            icon: 'bi-crosshair',
            title: ['doctors_empty_idle_title', 'No search yet'],
            body: ['doctors_empty_idle_body', 'Use "Search near me" above and we will look for specialists around your current location.']
        },
        signed_out: {
            icon: 'bi-person-lock',
            title: ['doctors_empty_signedout_title', 'Sign in to search'],
            body: ['doctors_empty_signedout_body', 'Doctor search needs an account so we can keep the service free and prevent abuse. Your location is never stored.'],
            action: ['btn_sign_in', 'Sign in', 'login.html']
        },
        no_results: {
            icon: 'bi-search',
            title: ['doctors_empty_none_title', 'Nothing found nearby'],
            body: ['doctors_empty_none_body', 'No matching specialists were listed in your area. Your district hospital or primary health centre can still screen and refer you.']
        },
        failed: {
            icon: 'bi-cloud-slash',
            title: ['doctors_empty_failed_title', 'Search unavailable'],
            body: ['doctors_empty_failed_body', 'We could not reach the listing service. This does not mean there are no doctors near you — please try again shortly.']
        }
    };

    function renderEmptyState(containerId, state) {
        var container = document.getElementById(containerId);
        if (!container) return;
        var cfg = EMPTY_STATES[state] || EMPTY_STATES.failed;
        container.innerHTML =
            '<div class="col-12"><div class="ss-empty">' +
            '<i class="bi ' + cfg.icon + '"></i>' +
            '<h5>' + escapeHtml(t(cfg.title[0], cfg.title[1])) + '</h5>' +
            '<p>' + escapeHtml(t(cfg.body[0], cfg.body[1])) + '</p>' +
            (cfg.action
                ? '<a class="btn btn-primary mt-3" href="' + cfg.action[2] + '">' +
                  escapeHtml(t(cfg.action[0], cfg.action[1])) + '</a>'
                : '') +
            '</div></div>';
    }

    function renderPlaces(containerId, places, theme) {
        var container = document.getElementById(containerId);
        if (!container) return;
        container.innerHTML = '';
        places.forEach(function (p) {
            container.appendChild(createPlaceCard(p, theme));
        });
    }

    function createPlaceCard(place, theme) {
        var col = document.createElement('div');
        col.className = 'col-md-6 col-lg-4';

        var ratingHtml = '';
        if (typeof place.rating === 'number' && isFinite(place.rating)) {
            var reviews = typeof place.reviewCount === 'number'
                ? place.reviewCount + ' ' + t('label_reviews', 'public reviews')
                : t('label_reviews_unknown', 'public reviews');
            ratingHtml =
                '<div class="rating-display">' +
                '<span class="rating-stars" aria-hidden="true">' + generateStars(place.rating) + '</span>' +
                '<span class="rating-value">' + place.rating.toFixed(1) + '</span>' +
                '<span class="rating-source">' + escapeHtml(reviews) + '</span>' +
                '</div>';
        }

        var mapsBtn = '';
        if (typeof place.mapsUrl === 'string' && /^https?:\/\//i.test(place.mapsUrl)) {
            mapsBtn =
                '<a href="' + escapeAttr(place.mapsUrl) + '" target="_blank" rel="noopener noreferrer" class="btn-external-link">' +
                '<i class="bi bi-box-arrow-up-right"></i> ' + escapeHtml(t('btn_view_on_maps', 'Open in Maps')) +
                '</a>';
        }

        var address = place.vicinity
            ? '<div class="doctor-info-item">' +
              '<i class="bi bi-geo-alt-fill"></i><div>' +
              '<div class="info-label">' + escapeHtml(t('label_location', 'Address')) + '</div>' +
              '<div class="info-value">' + escapeHtml(place.vicinity) + '</div>' +
              '</div></div>'
            : '';

        col.innerHTML =
            '<div class="doctor-card">' +
            '<div class="doctor-card-header">' +
            '<h5 class="doctor-name">' + escapeHtml(place.name || t('label_unnamed', 'Unnamed listing')) + '</h5>' +
            '</div>' +
            '<div class="doctor-card-body">' +
            ratingHtml + address + mapsBtn +
            '</div></div>';

        return col;
    }

    /* ---------- helpers ---------- */

    function setNotice(type, message) {
        var el = document.getElementById('searchNotice');
        if (!el) return;
        el.className = 'alert alert-' + type + ' mb-3';
        el.textContent = message;
        el.style.display = 'block';
    }

    function clearNotice() {
        var el = document.getElementById('searchNotice');
        if (!el) return;
        el.style.display = 'none';
        el.textContent = '';
    }

    function generateStars(rating) {
        var full = Math.floor(rating);
        var half = (rating % 1) >= 0.5;
        var empty = Math.max(0, 5 - full - (half ? 1 : 0));
        return '<i class="bi bi-star-fill"></i>'.repeat(full)
            + (half ? '<i class="bi bi-star-half"></i>' : '')
            + '<i class="bi bi-star"></i>'.repeat(empty);
    }

    function t(key, fallback) {
        if (window.translator && typeof window.translator.t === 'function') {
            return window.translator.t(key, fallback);
        }
        return fallback;
    }

    function escapeHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function escapeAttr(str) {
        return escapeHtml(str);
    }
})();