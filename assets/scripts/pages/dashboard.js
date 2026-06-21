/**
 * ============================================
 * DASHBOARD PAGE LOGIC
 * Shows user profile + screening history
 * ============================================
 */

document.addEventListener('DOMContentLoaded', async () => {
    await initializeDashboard();
});

async function initializeDashboard() {
    try {
        // Check if user is logged in
        const user = await window.supabaseClient.checkAuthState();
        
        if (!user) {
            // Redirect to login if not authenticated
            window.location.href = 'login.html';
            return;
        }

        // Fetch user profile
        const profile = await window.supabaseClient.getUserProfile();
        
        if (!profile) {
            console.error('Profile not found');
            showError('Profile not found. Please try logging in again.');
            return;
        }

        // Fetch screening history
        const historyResult = await window.supabaseClient.getUserScreenings();
        
        // Render dashboard
        renderUserInfo(profile);
        renderStats(historyResult.screenings);
        renderScreeningHistory(historyResult.screenings);

        // Show content
        document.getElementById('loadingState').style.display = 'none';
        document.getElementById('dashboardContent').style.display = 'block';

    } catch (error) {
        console.error('Dashboard initialization error:', error);
        showError('Failed to load dashboard. Please try again.');
    }
}

function renderUserInfo(profile) {
    const firstName = profile.full_name.split(' ')[0];
    document.getElementById('userName').textContent = firstName;
    
    const location = [profile.city, profile.state].filter(Boolean).join(', ') || 'India';
    document.getElementById('userLocation').textContent = location;
}

/**
 * Returns risk values for a screening record.
 * Uses stored snapshot when available (non-null computedRiskScore),
 * falls back to live recomputation via RiskCalculator.
 */
function getRiskValuesForScreening(screening) {
    if (screening.computedRiskScore !== null && screening.computedRiskScore !== undefined) {
        const catToColor = (cat) => {
            if (!cat) return 'secondary';
            if (cat.includes('Critical') || cat.includes('High')) return 'danger';
            if (cat.includes('Moderate')) return 'warning';
            return 'success';
        };
        const catToUrgency = (cat) => {
            if (!cat) return 'low';
            if (cat.includes('Critical')) return 'urgent';
            if (cat.includes('High')) return 'high';
            if (cat.includes('Moderate')) return 'medium';
            return 'low';
        };
        const scoreToColor = (score) => {
            if (score === null || score === undefined) return 'secondary';
            if (score >= 40) return 'danger';
            if (score >= 25) return 'warning';
            return 'success';
        };
        return {
            combined: {
                score: screening.computedRiskScore,
                category: screening.riskCategory || 'N/A',
                color: catToColor(screening.riskCategory),
                urgency: catToUrgency(screening.riskCategory)
            },
            diabetes: {
                score: screening.diabetesRiskScore ?? 0,
                color: scoreToColor(screening.diabetesRiskScore)
            },
            hypertension: {
                score: screening.hypertensionRiskScore ?? 0,
                color: scoreToColor(screening.hypertensionRiskScore)
            }
        };
    }
    if (window.RiskCalculator && typeof window.RiskCalculator.assessHealthRisk === 'function') {
        return window.RiskCalculator.assessHealthRisk(screening);
    }
    return null;
}

function renderStats(screenings) {
    // Total screenings
    document.getElementById('totalScreenings').textContent = screenings.length;

    if (screenings.length > 0) {
        // Last screening date
        const lastDate = new Date(screenings[0].timestamp);
        const formattedDate = lastDate.toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short'
        });
        document.getElementById('lastScreeningDate').textContent = formattedDate;

        const assessment = getRiskValuesForScreening(screenings[0]);

        if (assessment) {
            document.getElementById('riskStatus').textContent = assessment.combined.category;
            const riskEl = document.getElementById('riskStatus');
            riskEl.className = '';
            riskEl.classList.add(`text-${assessment.combined.color}`);
        } else {
            document.getElementById('riskStatus').textContent = 'N/A';
        }
    }
}

function renderScreeningHistory(screenings) {
    const container = document.getElementById('screeningHistoryContainer');

    if (screenings.length === 0) {
        container.innerHTML = `
            <div class="text-center py-5">
                <i class="bi bi-clipboard2-x" style="font-size: 4rem; color: #6b7280;"></i>
                <h5 class="mt-3">No Screenings Yet</h5>
                <p class="text-muted">Take your first health screening to see your results here.</p>
                <a href="screening.html" class="btn btn-success mt-2">
                    <i class="bi bi-plus-circle"></i> Start First Screening
                </a>
            </div>
        `;
        return;
    }

    let html = '<div class="table-responsive"><table class="table table-hover">';
    html += `
        <thead>
            <tr>
                <th>Date</th>
                <th>Diabetes Risk</th>
                <th>Hypertension Risk</th>
                <th>Combined Risk</th>
                <th>Action</th>
            </tr>
        </thead>
        <tbody>
    `;

    screenings.forEach((screening, index) => {
        const date = new Date(screening.timestamp);
        const formattedDate = date.toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        });

        const assessment = getRiskValuesForScreening(screening);

        if (assessment) {
            html += `
                <tr>
                    <td>
                        <i class="bi bi-calendar3"></i> ${formattedDate}
                        ${index === 0 ? '<span class="badge bg-success ms-2">Latest</span>' : ''}
                    </td>
                    <td>
                        <span class="badge bg-${assessment.diabetes.color}-custom">
                            ${assessment.diabetes.score}/100
                        </span>
                    </td>
                    <td>
                        <span class="badge bg-${assessment.hypertension.color}-custom">
                            ${assessment.hypertension.score}/100
                        </span>
                    </td>
                    <td>
                        <span class="badge bg-${assessment.combined.color}">
                            ${assessment.combined.category}
                        </span>
                    </td>
                    <td>
                        <button class="btn btn-sm btn-outline-primary" onclick="viewScreeningDetails(${index})">
                            <i class="bi bi-eye"></i> View
                        </button>
                    </td>
                </tr>
            `;
        } else {
            html += `
                <tr>
                    <td>
                        <i class="bi bi-calendar3"></i> ${formattedDate}
                        ${index === 0 ? '<span class="badge bg-success ms-2">Latest</span>' : ''}
                    </td>
                    <td colspan="3">
                        <span class="text-muted">Risk data unavailable</span>
                    </td>
                    <td>
                        <button class="btn btn-sm btn-outline-primary" onclick="viewScreeningDetails(${index})">
                            <i class="bi bi-eye"></i> View
                        </button>
                    </td>
                </tr>
            `;
        }
    });

    html += '</tbody></table></div>';
    container.innerHTML = html;
}

async function viewScreeningDetails(index) {
    // Store the selected screening index
    sessionStorage.setItem('selectedScreeningIndex', index);
    window.location.href = 'result.html';
}

function showError(message) {
    document.getElementById('loadingState').innerHTML = `
        <div class="alert alert-danger text-center">
            <i class="bi bi-exclamation-triangle-fill" style="font-size: 3rem;"></i>
            <h5 class="mt-3">${message}</h5>
        </div>
        <div class="text-center mt-3">
            <a href="login.html" class="btn btn-primary">Back to Login</a>
        </div>
    `;
}

// Make function available globally
window.viewScreeningDetails = viewScreeningDetails;

console.log('✅ Dashboard page ready');