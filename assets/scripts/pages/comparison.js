document.addEventListener('DOMContentLoaded', async () => {
    if (!window.supabaseClient) return;
    const user = await window.supabaseClient.checkAuthState();
    if (!user) { window.location.href = 'login.html'; return; }

    const result = await window.supabaseClient.getUserScreenings();
    if (!result.success || result.screenings.length < 2) {
        showEmpty();
        return;
    }

    const screenings = result.screenings.slice().reverse();
    renderSummary(screenings);
    renderTimeline(screenings);
    renderLatestVsPrevious(screenings);
    renderFactorEvolution(screenings);

    document.getElementById('comparisonLoading').style.display = 'none';
    document.getElementById('comparisonContent').style.display = 'block';
});

function showEmpty() {
    document.getElementById('comparisonLoading').style.display = 'none';
    document.getElementById('comparisonEmpty').style.display = 'block';
}

function renderSummary(screenings) {
    const counts = { enhanced: 0, partial: 0, baseline: 0, legacy: 0 };
    screenings.forEach(s => {
        if (s.algorithmVersion !== 'rule-v1.4') { counts.legacy++; return; }
        counts[s.assessmentTier || 'baseline']++;
    });
    const el = document.getElementById('comparisonSummary');
    if (!el) return;
    const t = (key, fb) => window.translator.t(key, fb);
    el.innerHTML = `
        <div class="row g-3">
            <div class="col"><div class="p-3 bg-light rounded text-center"><div class="fs-3 fw-bold">${screenings.length}</div><div class="small text-muted">${t('comparison_summary_total', 'Total screenings')}</div></div></div>
            <div class="col"><div class="p-3 bg-success-subtle rounded text-center"><div class="fs-3 fw-bold">${counts.enhanced}</div><div class="small text-muted">${t('comparison_summary_enhanced', 'Enhanced (v1.4)')}</div></div></div>
            <div class="col"><div class="p-3 bg-info-subtle rounded text-center"><div class="fs-3 fw-bold">${counts.partial}</div><div class="small text-muted">${t('comparison_summary_partial', 'Partial (v1.4)')}</div></div></div>
            <div class="col"><div class="p-3 bg-secondary-subtle rounded text-center"><div class="fs-3 fw-bold">${counts.baseline + counts.legacy}</div><div class="small text-muted">${t('comparison_summary_baseline', 'Baseline / Legacy')}</div></div></div>
        </div>
    `;
}

function renderTimeline(screenings) {
    const el = document.getElementById('comparisonTimeline');
    if (!el) return;
    el.innerHTML = screenings.map(s => {
        const date = new Date(s.timestamp).toLocaleDateString('en-IN', {day:'numeric', month:'short', year:'2-digit'});
        const score = Math.round(s.computedRiskScore || 0);
        const color = score >= 40 ? '#ef4444' : score >= 25 ? '#f59e0b' : '#10b981';
        const version = s.algorithmVersion === 'rule-v1.4' ? `v1.4 ${s.assessmentTier || ''}` : 'v1.3';
        return `
            <div class="col text-center">
                <div class="mb-2 small text-muted">${date}</div>
                <div class="rounded-circle mx-auto d-flex align-items-center justify-content-center" style="width:60px;height:60px;background:${color};color:white;font-weight:bold;">${score}</div>
                <div class="small mt-2">${version}</div>
            </div>
        `;
    }).join('');
}

function renderLatestVsPrevious(screenings) {
    if (screenings.length < 2) return;
    const latest = screenings[screenings.length - 1];
    const previous = screenings[screenings.length - 2];
    const delta = (latest.computedRiskScore || 0) - (previous.computedRiskScore || 0);
    const deltaText = delta > 0 ? `+${Math.round(delta)}` : Math.round(delta).toString();
    const deltaColor = delta > 0 ? 'text-danger' : delta < 0 ? 'text-success' : 'text-muted';
    const el = document.getElementById('comparisonLatestVsPrevious');
    if (!el) return;
    const t = (key, fb) => window.translator.t(key, fb);
    el.innerHTML = `
        <div class="row g-3 align-items-center">
            <div class="col-md-5">
                <div class="p-3 bg-light rounded text-center">
                    <div class="small text-muted">${t('comparison_previous', 'Previous')}</div>
                    <div class="fs-1 fw-bold">${Math.round(previous.computedRiskScore || 0)}</div>
                    <div class="small">${new Date(previous.timestamp).toLocaleDateString('en-IN')}</div>
                </div>
            </div>
            <div class="col-md-2 text-center">
                <div class="fs-3 fw-bold ${deltaColor}">${deltaText}</div>
                <div class="small text-muted">${t('comparison_change', 'change')}</div>
            </div>
            <div class="col-md-5">
                <div class="p-3 bg-success-subtle rounded text-center">
                    <div class="small text-muted">${t('comparison_latest', 'Latest')}</div>
                    <div class="fs-1 fw-bold">${Math.round(latest.computedRiskScore || 0)}</div>
                    <div class="small">${new Date(latest.timestamp).toLocaleDateString('en-IN')}</div>
                </div>
            </div>
        </div>
    `;
}

function renderFactorEvolution(screenings) {
    const v14Only = screenings.filter(s => s.algorithmVersion === 'rule-v1.4' && s.factorContributions);
    const el = document.getElementById('comparisonFactorEvolution');
    if (!el) return;
    const t = (key, fb) => window.translator.t(key, fb);

    if (v14Only.length < 2) {
        el.innerHTML = `<p class="text-muted">${t('comparison_need_v14', 'Factor evolution requires at least 2 v1.4 screenings.')}</p>`;
        return;
    }

    const factorMap = new Map();
    v14Only.forEach((s, i) => {
        const all = [
            ...(s.factorContributions?.diabetes || []),
            ...(s.factorContributions?.hypertension || [])
        ];
        all.forEach(f => {
            if (!factorMap.has(f.id)) factorMap.set(f.id, { label: f.label, category: f.category, points: [] });
            factorMap.get(f.id).points.push({ idx: i, points: f.points });
        });
    });

    el.innerHTML = Array.from(factorMap.entries()).slice(0, 8).map(([id, data]) => {
        const latest = data.points[data.points.length - 1]?.points || 0;
        const earliest = data.points[0]?.points || 0;
        const delta = latest - earliest;
        const deltaText = delta > 0 ? `+${delta}` : delta.toString();
        const deltaColor = delta > 0 ? 'text-danger' : delta < 0 ? 'text-success' : 'text-muted';
        return `
            <div class="d-flex justify-content-between align-items-center py-2 border-bottom">
                <div><strong>${data.label}</strong> <small class="text-muted">(${data.category})</small></div>
                <div><span class="text-muted small">${earliest} → ${latest}</span> <span class="ms-2 ${deltaColor} fw-bold">${deltaText}</span></div>
            </div>
        `;
    }).join('');
}
