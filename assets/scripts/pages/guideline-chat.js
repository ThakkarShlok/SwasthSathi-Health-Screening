/**
 * ============================================
 * GUIDELINE CHAT (Phase 4)
 * Result-scoped assistant panel on result.html.
 *
 * Reads the assessment result.js already computed and published on
 * window.SwasthResult. It NEVER recomputes risk — it only reads, normalises
 * field names for the Edge Function, and renders.
 *
 * Each call is independent (no server-side memory); the running conversation
 * lives only in this panel for the session.
 * ============================================
 */

(function () {
    'use strict';

    const FUNCTION_NAME = 'guideline-chat';
    const MAX_CHARS = 1000;        // must match the Edge Function's cap
    const TIMEOUT_MS = 25000;      // embedding + retrieval + generation
    const INFLIGHT_KEY = 'rag';    // distinct from 'llm' (recommendations)

    let contextReady = false;
    let screeningContext = null;
    let busy = false;

    const t = (key, fallback) =>
        (window.translator ? window.translator.t(key, fallback) : fallback);

    /** Escape before inserting any model- or user-supplied text into the DOM. */
    function esc(s) {
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    // ---------------------------------------------------------------- context

    /**
     * risk-calculator returns category strings ('Low Risk', 'Moderate Risk',
     * 'High Risk', 'Critical Risk'). The Edge Function expects
     * low | moderate | high. Critical maps to high — the function's enum has
     * no higher band. This is a rename, not a re-scoring.
     */
    function toLevel(category) {
        if (typeof category !== 'string') return null;
        const c = category.toLowerCase();
        if (c.includes('critical') || c.includes('high')) return 'high';
        if (c.includes('moderate')) return 'moderate';
        if (c.includes('low')) return 'low';
        return null;
    }

    /**
     * Merge the two factorContributions arrays, tagging which condition each
     * came from. A factor present in both (e.g. age, BMI) becomes 'both'.
     * Points/labels are copied verbatim from the calculator's output.
     */
    function buildFactors(assessment) {
        const out = new Map();

        const add = (list, condition) => {
            (list || []).forEach((f) => {
                if (!f || typeof f.label !== 'string') return;
                const existing = out.get(f.id || f.label);
                if (existing) {
                    if (existing.condition !== condition) existing.condition = 'both';
                    return;
                }
                out.set(f.id || f.label, {
                    label: f.label,
                    category: f.category || 'unknown',
                    points: typeof f.points === 'number' ? f.points : 0,
                    condition: condition,
                });
            });
        };

        add(assessment.diabetes && assessment.diabetes.factorContributions, 'diabetes');
        add(assessment.hypertension && assessment.hypertension.factorContributions, 'hypertension');

        return [...out.values()].sort((a, b) => b.points - a.points);
    }

    function buildContext(assessment, patientData) {
        if (!assessment) return null;
        const readings = (patientData && patientData.readings) || {};

        return {
            diabetesRisk: {
                level: toLevel(assessment.diabetes && assessment.diabetes.category),
                score: (assessment.diabetes && assessment.diabetes.score) ?? null,
            },
            hypertensionRisk: {
                level: toLevel(assessment.hypertension && assessment.hypertension.category),
                score: (assessment.hypertension && assessment.hypertension.score) ?? null,
            },
            assessmentTier: assessment.assessmentTier || null,
            // result.js/risk-calculator name this dataCompletenessPercentage
            dataCompleteness: assessment.dataCompletenessPercentage ?? null,
            factors: buildFactors(assessment),
            providedReadings: {
                hba1c: !!readings.hba1c,
                bloodSugar: !!readings.bloodSugar,
                bloodPressure: !!readings.bloodPressure,
            },
        };
    }

    // ---------------------------------------------------------------- chips

    const GENERIC_CHIPS = [
        ['gc_chip_lifestyle', 'What lifestyle changes help most?'],
        ['gc_chip_next', 'What should I do next?'],
        ['gc_chip_screening_vs_diagnosis', 'What is the difference between screening and diagnosis?'],
    ];

    function chipsFor(ctx) {
        if (!ctx) return GENERIC_CHIPS.slice(0, 3);

        const chips = [];
        const elevated = (lvl) => lvl === 'moderate' || lvl === 'high';

        if (elevated(ctx.diabetesRisk.level)) {
            chips.push(['gc_chip_diabetes', 'Why is my diabetes risk elevated?']);
        }
        if (elevated(ctx.hypertensionRisk.level)) {
            chips.push(['gc_chip_hypertension', 'Why is my blood pressure risk elevated?']);
        }
        if (ctx.providedReadings.hba1c) {
            chips.push(['gc_chip_hba1c', 'What does my HbA1c mean?']);
        }

        // Always-available chips, filling up to 4.
        chips.push(['gc_chip_lifestyle', 'What lifestyle changes help most?']);
        chips.push(['gc_chip_next', 'What should I do next?']);

        return chips.slice(0, 4);
    }

    function renderChips(ctx) {
        const wrap = document.getElementById('gcChips');
        if (!wrap) return;
        wrap.innerHTML = '';
        chipsFor(ctx).forEach(([key, fallback]) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'gc-chip';
            btn.setAttribute('data-i18n', key);
            btn.textContent = t(key, fallback);
            btn.addEventListener('click', () => {
                if (busy) return;
                send(btn.textContent.trim());
            });
            wrap.appendChild(btn);
        });
    }

    // ---------------------------------------------------------------- render

    function logEl() {
        return document.getElementById('gcLog');
    }

    function scrollLog() {
        const log = logEl();
        if (log) log.scrollTop = log.scrollHeight;
    }

    function addUserTurn(text) {
        const log = logEl();
        if (!log) return;
        const row = document.createElement('div');
        row.className = 'gc-turn gc-turn-user';
        row.innerHTML = `<div class="gc-bubble gc-bubble-user">${esc(text)}</div>`;
        log.appendChild(row);
        scrollLog();
    }

    function addTyping() {
        const log = logEl();
        if (!log) return null;
        const row = document.createElement('div');
        row.className = 'gc-turn';
        row.id = 'gcTyping';
        row.innerHTML =
            `<div class="gc-bubble gc-bubble-bot">
                <span class="gc-typing" role="status"
                      aria-label="${esc(t('gc_thinking', 'Thinking'))}">
                    <span></span><span></span><span></span>
                </span>
            </div>`;
        log.appendChild(row);
        scrollLog();
        return row;
    }

    /** payload: { answer, sources, grounded, refusalType, disclaimer } */
    function addBotTurn(payload) {
        const log = logEl();
        if (!log) return;

        const refusal = payload.refusalType;
        let bubbleClass = 'gc-bubble-bot';
        let head = '';

        if (refusal === 'emergency') {
            bubbleClass = 'gc-bubble-emergency';
            head =
                `<div class="gc-refusal-head">
                    <i class="bi bi-exclamation-triangle-fill"></i>
                    <span data-i18n="gc_urgent_title">${esc(t('gc_urgent_title', 'Seek medical care now'))}</span>
                </div>`;
        } else if (refusal === 'medication' || refusal === 'out_of_scope') {
            bubbleClass = 'gc-bubble-declined';
            const key = refusal === 'medication' ? 'gc_declined_medication' : 'gc_declined_scope';
            const fb = refusal === 'medication'
                ? 'I can’t advise on medicines'
                : 'Outside what I can help with';
            head =
                `<div class="gc-refusal-head">
                    <i class="bi bi-info-circle-fill"></i>
                    <span data-i18n="${key}">${esc(t(key, fb))}</span>
                </div>`;
        }

        const answerHtml = esc(payload.answer).replace(/\n/g, '<br>');

        const sources = Array.isArray(payload.sources) ? payload.sources : [];
        const sourcesHtml = sources.length
            ? `<div class="gc-sources">
                   <span data-i18n="gc_based_on">${esc(t('gc_based_on', 'Based on:'))}</span>
                   ${esc(sources.join(' · '))}
               </div>`
            : '';

        const disclaimerHtml = payload.disclaimer
            ? `<div class="gc-disclaimer">${esc(payload.disclaimer)}</div>`
            : '';

        const row = document.createElement('div');
        row.className = 'gc-turn';
        row.innerHTML =
            `<div class="gc-bubble ${bubbleClass}">
                ${head}
                <div>${answerHtml}</div>
                ${sourcesHtml}
                ${disclaimerHtml}
            </div>`;
        log.appendChild(row);
        scrollLog();
    }

    function addErrorTurn(messageKey, fallback) {
        addBotTurn({
            answer: t(messageKey, fallback),
            sources: [],
            grounded: false,
            refusalType: null,
            disclaimer: '',
        });
    }

    // ---------------------------------------------------------------- send

    async function send(question) {
        const q = String(question || '').trim();
        if (!q || busy) return;

        if (q.length > MAX_CHARS) {
            addUserTurn(q.slice(0, MAX_CHARS));
            addErrorTurn('gc_err_too_long',
                'That question is too long. Please shorten it and try again.');
            return;
        }

        if (!window.supabaseClient) {
            addUserTurn(q);
            addErrorTurn('gc_err_generic',
                'I’m having trouble right now, please try again in a moment.');
            return;
        }

        const token = window.supabaseClient.getAccessToken();
        if (!token) {
            addUserTurn(q);
            addErrorTurn('gc_err_auth', 'Please log in again to use the assistant.');
            return;
        }

        // Client-side dedup — layer 1 of the existing cost protection.
        if (window.InFlightTracker && !window.InFlightTracker.start(INFLIGHT_KEY)) return;

        busy = true;
        setBusy(true);
        addUserTurn(q);
        const typing = addTyping();

        const controller = new AbortController();
        const tid = setTimeout(() => controller.abort(), TIMEOUT_MS);

        try {
            const url = `${window.supabaseClient.supabaseUrl}/functions/v1/${FUNCTION_NAME}`;
            const resp = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    question: q,
                    // Optional on the function side — omitted entirely if unavailable.
                    ...(screeningContext ? { screeningContext } : {}),
                }),
                signal: controller.signal,
            });
            clearTimeout(tid);

            if (typing) typing.remove();

            if (resp.status === 429) {
                addErrorTurn('gc_err_rate',
                    'You’ve asked a lot of questions in a short time. Please wait a little and try again.');
                return;
            }
            if (!resp.ok) {
                addErrorTurn('gc_err_generic',
                    'I’m having trouble right now, please try again in a moment.');
                return;
            }

            const data = await resp.json();
            if (!data || typeof data.answer !== 'string' || !data.answer.trim()) {
                addErrorTurn('gc_err_generic',
                    'I’m having trouble right now, please try again in a moment.');
                return;
            }

            addBotTurn(data);
            if (window.translator) window.translator.applyTranslations();

        } catch (err) {
            clearTimeout(tid);
            if (typing) typing.remove();
            addErrorTurn('gc_err_generic',
                'I’m having trouble right now, please try again in a moment.');
        } finally {
            if (window.InFlightTracker) window.InFlightTracker.end(INFLIGHT_KEY);
            busy = false;
            setBusy(false);
        }
    }

    function setBusy(on) {
        const input = document.getElementById('gcInput');
        const btn = document.getElementById('gcSend');
        if (input) input.disabled = on;
        if (btn) btn.disabled = on;
        document.querySelectorAll('.gc-chip').forEach((c) => { c.disabled = on; });
        if (!on && input) input.focus();
    }

    // ---------------------------------------------------------------- wire up

    function updateCounter() {
        const input = document.getElementById('gcInput');
        const counter = document.getElementById('gcCounter');
        if (!input || !counter) return;
        const n = input.value.length;
        counter.textContent = n > MAX_CHARS - 100 ? `${n} / ${MAX_CHARS}` : '';
        counter.classList.toggle('gc-counter-warn', n > MAX_CHARS);
    }

    function init() {
        const card = document.getElementById('guidelineChatCard');
        if (!card) return;

        const input = document.getElementById('gcInput');
        const btn = document.getElementById('gcSend');

        if (input) {
            input.setAttribute('maxlength', String(MAX_CHARS));
            input.addEventListener('input', updateCounter);
            // Enter sends; Shift+Enter is left alone for future multiline.
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    const v = input.value;
                    input.value = '';
                    updateCounter();
                    send(v);
                }
            });
        }

        if (btn) {
            btn.addEventListener('click', () => {
                if (!input) return;
                const v = input.value;
                input.value = '';
                updateCounter();
                send(v);
            });
        }

        // Chips render immediately (generic), then upgrade once the result lands.
        renderChips(null);
    }

    function applyResult() {
        const bundle = window.SwasthResult;
        if (!bundle || !bundle.assessment) return;
        screeningContext = buildContext(bundle.assessment, bundle.patientData);
        contextReady = !!screeningContext;
        renderChips(screeningContext);
        if (window.translator) window.translator.applyTranslations();
    }

    document.addEventListener('DOMContentLoaded', init);
    // result.js publishes the computed assessment asynchronously.
    document.addEventListener('swasth:result-ready', applyResult);

    // Expose for debugging / manual verification only.
    window.GuidelineChat = {
        get contextReady() { return contextReady; },
        get context() { return screeningContext; },
        send,
    };
})();
