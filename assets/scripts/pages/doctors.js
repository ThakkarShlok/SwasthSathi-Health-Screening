/**
 * doctors.js — Phase 2A live doctor search via Google Places Edge Function
 * Falls back to a short embedded list if the user is not logged in or the search fails.
 */

const FALLBACK_DOCTORS = {
    diabetes: [
        { name: 'Dr. Rajesh Sharma', vicinity: 'Ashram Road, Ahmedabad', rating: 4.5, reviewCount: 127, mapsUrl: null },
        { name: 'Dr. Priya Mehta', vicinity: 'Satellite, Ahmedabad', rating: 4.3, reviewCount: 89, mapsUrl: null },
        { name: 'Dr. Suresh Patel', vicinity: 'Vastrapur, Ahmedabad', rating: 4.6, reviewCount: 204, mapsUrl: null },
    ],
    hypertension: [
        { name: 'Dr. Anita Gupta', vicinity: 'CG Road, Ahmedabad', rating: 4.4, reviewCount: 156, mapsUrl: null },
        { name: 'Dr. Vikram Desai', vicinity: 'Navrangpura, Ahmedabad', rating: 4.2, reviewCount: 93, mapsUrl: null },
        { name: 'Dr. Neha Singh', vicinity: 'Paldi, Ahmedabad', rating: 4.7, reviewCount: 312, mapsUrl: null },
    ],
};

document.addEventListener('DOMContentLoaded', () => {
    const isLoggedIn = !!(window.supabaseClient && window.supabaseClient.getAccessToken());
    const locationCard = document.getElementById('locationSearchCard');
    const loginCard = document.getElementById('loginPromptCard');
    const findBtn = document.getElementById('findNearbyBtn');
    const searchingEl = document.getElementById('locationSearching');

    if (isLoggedIn) {
        if (locationCard) locationCard.style.display = 'block';
        if (findBtn) findBtn.addEventListener('click', handleFindNearby);

        let savedCoords = null;
        try {
            const raw = sessionStorage.getItem('doctorsLastCoords');
            if (raw) savedCoords = JSON.parse(raw);
        } catch { /* ignore corrupt entry */ }

        if (savedCoords) {
            autoFindNearby(savedCoords);
        } else {
            showFallback('notice');
        }
    } else {
        if (loginCard) loginCard.style.display = 'block';
        showFallback('static');
    }

    async function handleFindNearby() {
        if (window.InFlightTracker && !window.InFlightTracker.start('places')) return;
        if (findBtn) findBtn.disabled = true;
        if (searchingEl) searchingEl.style.display = 'block';

        try {
            const coords = await getLocation();
            sessionStorage.setItem('doctorsLastCoords', JSON.stringify({ latitude: coords.latitude, longitude: coords.longitude }));
            await renderSearchResults(coords);
            if (locationCard) locationCard.style.display = 'none';
        } catch (e) {
            if (e.code === 1 /* PERMISSION_DENIED */) {
                setNotice('warning', window.translator.t('doctors_location_denied', 'Location access denied. Showing sample doctors.'));
            } else if (e.message === 'RATE_LIMIT') {
                setNotice('warning', window.translator.t('doctors_places_limit', 'Search limit reached. Showing sample doctors.'));
            } else {
                setNotice('secondary', window.translator.t('doctors_no_results', 'No nearby results. Showing sample doctors.'));
            }
            showFallback('static');
        } finally {
            if (findBtn) findBtn.disabled = false;
            if (searchingEl) searchingEl.style.display = 'none';
            if (window.InFlightTracker) window.InFlightTracker.end('places');
        }
    }

    async function autoFindNearby(coords) {
        if (window.InFlightTracker && !window.InFlightTracker.start('places')) return;
        if (searchingEl) searchingEl.style.display = 'block';
        try {
            await renderSearchResults(coords);
            if (locationCard) locationCard.style.display = 'none';
        } catch {
            showFallback('notice');
        } finally {
            if (searchingEl) searchingEl.style.display = 'none';
            if (window.InFlightTracker) window.InFlightTracker.end('places');
        }
    }

    async function renderSearchResults(coords) {
        const [diabetesPlaces, hypertensionPlaces] = await Promise.all([
            searchDoctors(coords.latitude, coords.longitude, 'diabetes'),
            searchDoctors(coords.latitude, coords.longitude, 'hypertension'),
        ]);

        if (diabetesPlaces && diabetesPlaces.length > 0) {
            renderPlaces('diabetesDoctors', diabetesPlaces, 'success');
        } else {
            renderFallbackSection('diabetesDoctors', 'diabetes', 'success');
        }

        if (hypertensionPlaces && hypertensionPlaces.length > 0) {
            renderPlaces('hypertensionDoctors', hypertensionPlaces, 'danger');
        } else {
            renderFallbackSection('hypertensionDoctors', 'hypertension', 'danger');
        }

        setNotice('success', window.translator.t('doctors_live_results', 'Showing doctors near your location'));
    }

    function getLocation() {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('Geolocation not supported'));
                return;
            }
            navigator.geolocation.getCurrentPosition(
                (pos) => resolve(pos.coords),
                (err) => reject(err),
                { timeout: 10000 },
            );
        });
    }

    async function searchDoctors(lat, lng, type) {
        const token = window.supabaseClient.getAccessToken();
        if (!token) return null;

        const controller = new AbortController();
        const tid = setTimeout(() => controller.abort(), 10000);

        try {
            const url = `${window.supabaseClient.supabaseUrl}/functions/v1/doctor-search`;
            const resp = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ lat, lng, type }),
                signal: controller.signal,
            });
            clearTimeout(tid);

            if (resp.status === 429) throw Object.assign(new Error('RATE_LIMIT'), { message: 'RATE_LIMIT' });
            if (!resp.ok) return null;

            const data = await resp.json();
            return data.places ?? null;
        } catch (e) {
            clearTimeout(tid);
            if (e.message === 'RATE_LIMIT') throw e;
            return null;
        }
    }
});

function showFallback(mode) {
    renderFallbackSection('diabetesDoctors', 'diabetes', 'success');
    renderFallbackSection('hypertensionDoctors', 'hypertension', 'danger');
    if (mode === 'notice') {
        setNotice('secondary', window.translator.t('doctors_fallback_notice', 'Sample doctors shown. Use location search for real nearby results.'));
    }
}

function renderFallbackSection(containerId, type, theme) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';
    FALLBACK_DOCTORS[type].forEach((doc) => {
        container.appendChild(createPlaceCard(doc, theme, true));
    });
}

function renderPlaces(containerId, places, theme) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';
    places.forEach((p) => container.appendChild(createPlaceCard(p, theme, false)));
}

function createPlaceCard(place, theme, isFallback) {
    const col = document.createElement('div');
    col.className = 'col-md-6 col-lg-4';

    const starsHtml = place.rating != null ? generateStars(place.rating) : '';
    const ratingHtml = place.rating != null
        ? `<div class="rating-display">
               <span class="rating-stars">${starsHtml}</span>
               <span class="rating-value">${place.rating.toFixed(1)}</span>
               <span class="rating-source">${place.reviewCount}+ ${window.translator.t('label_reviews', 'reviews')}</span>
           </div>`
        : '';

    const mapsBtn = place.mapsUrl
        ? `<a href="${encodeURI(place.mapsUrl)}" target="_blank" rel="noopener noreferrer" class="btn-external-link">
               <i class="bi bi-google"></i> ${window.translator.t('btn_view_on_maps', 'View on Google Maps')}
           </a>`
        : '';

    const fallbackBadge = isFallback
        ? `<span class="badge bg-secondary-subtle text-secondary ms-1" data-i18n="doctors_static_notice">Sample</span>`
        : `<span class="badge bg-success-subtle text-success ms-1"><i class="bi bi-geo-alt-fill"></i> Near you</span>`;

    col.innerHTML = `
        <div class="doctor-card">
            <div class="doctor-card-header">
                <h5 class="doctor-name">${escapeHtml(place.name)} ${fallbackBadge}</h5>
            </div>
            <div class="doctor-card-body">
                ${ratingHtml}
                ${place.vicinity ? `
                <div class="doctor-info-item">
                    <i class="bi bi-geo-alt-fill"></i>
                    <div>
                        <div class="info-label" data-i18n="label_location">Location:</div>
                        <div class="info-value">${escapeHtml(place.vicinity)}</div>
                    </div>
                </div>` : ''}
                ${mapsBtn}
            </div>
        </div>`;
    return col;
}

function setNotice(type, message) {
    const el = document.getElementById('searchNotice');
    if (!el) return;
    el.className = `alert alert-${type} mb-3`;
    el.textContent = message;
    el.style.display = 'block';
}

function generateStars(rating) {
    const full = Math.floor(rating);
    const half = rating % 1 >= 0.5;
    const empty = 5 - full - (half ? 1 : 0);
    return '<i class="bi bi-star-fill"></i>'.repeat(full)
        + (half ? '<i class="bi bi-star-half"></i>' : '')
        + '<i class="bi bi-star"></i>'.repeat(empty);
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
