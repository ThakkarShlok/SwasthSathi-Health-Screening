/**
 * ============================================
 * DOCTORS LIST PAGE LOGIC
 * ============================================
 */

document.addEventListener('DOMContentLoaded', function() {
    console.log('=== SwasthSathi Doctors List ===');
    renderDoctors();
});

function renderDoctors() {
    renderDiabetesDoctors();
    renderHypertensionDoctors();
}

function renderDiabetesDoctors() {
    const container = document.getElementById('diabetesDoctors');
    if (!container) return;
    container.innerHTML = '';
    window.DOCTORS_DATA.diabetes.forEach((doctor, index) => {
        const card = createDoctorCard(doctor, 'success');
        container.appendChild(card);
    });
}

function renderHypertensionDoctors() {
    const container = document.getElementById('hypertensionDoctors');
    if (!container) return;
    container.innerHTML = '';
    window.DOCTORS_DATA.hypertension.forEach((doctor, index) => {
        const card = createDoctorCard(doctor, 'danger');
        container.appendChild(card);
    });
}

function createDoctorCard(doctor, theme) {
    const col = document.createElement('div');
    col.className = 'col-md-6 col-lg-4';
    const stars = generateStars(doctor.rating);
    col.innerHTML = `
        <div class="doctor-card">
            <div class="doctor-card-header">
                <h5 class="doctor-name">${doctor.name}</h5>
                <div class="doctor-specialization">
                    <i class="bi bi-briefcase-fill"></i>
                    ${doctor.specialization}
                </div>
            </div>
            <div class="doctor-card-body">
                <div class="source-badge">
                    <i class="bi bi-info-circle-fill"></i>
                    Source: ${doctor.source}
                </div>
                <div class="rating-display">
                    <span class="rating-stars">${stars}</span>
                    <span class="rating-value">${doctor.rating}</span>
                    <span class="rating-source">${doctor.reviewCount}+ reviews</span>
                </div>
                <div class="doctor-info-item">
                    <i class="bi bi-hospital"></i>
                    <div>
                        <div class="info-label">Hospital:</div>
                        <div class="info-value">${doctor.hospital}</div>
                    </div>
                </div>
                <div class="doctor-info-item">
                    <i class="bi bi-geo-alt-fill"></i>
                    <div>
                        <div class="info-label">Location:</div>
                        <div class="info-value">${doctor.city}, ${doctor.state}</div>
                    </div>
                </div>
                <div class="doctor-info-item">
                    <i class="bi bi-award-fill"></i>
                    <div>
                        <div class="info-label">Experience:</div>
                        <div class="info-value">${doctor.experience}</div>
                    </div>
                </div>
                <div class="doctor-info-item">
                    <i class="bi bi-person-fill"></i>
                    <div>
                        <div class="info-value small">${doctor.about}</div>
                    </div>
                </div>
                <a href="${doctor.sourceUrl}" target="_blank" rel="noopener noreferrer" class="btn-external-link">
                    <i class="bi bi-box-arrow-up-right"></i>
                    View on ${doctor.source}
                </a>
            </div>
        </div>
    `;
    return col;
}

function generateStars(rating) {
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
    let stars = '';
    for (let i = 0; i < fullStars; i++) {
        stars += '<i class="bi bi-star-fill"></i>';
    }
    if (hasHalfStar) {
        stars += '<i class="bi bi-star-half"></i>';
    }
    for (let i = 0; i < emptyStars; i++) {
        stars += '<i class="bi bi-star"></i>';
    }
    return stars;
}

console.log('%c🏥 Doctors List Loaded', 'color: #10b981; font-size: 16px; font-weight: bold;');
console.log('%cPublic doctor information for patient awareness', 'color: #6b7280; font-size: 12px;');