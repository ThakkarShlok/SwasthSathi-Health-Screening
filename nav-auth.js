/**
 * ============================================
 * NAVBAR AUTHENTICATION STATE HANDLER
 * Dynamically shows Login/Signup or User Menu
 * ============================================
 */

document.addEventListener('DOMContentLoaded', async () => {
    const navAuthSection = document.getElementById('navAuthSection');
    if (!navAuthSection) return;

    const user = await window.supabaseClient.checkAuthState();

    if (user) {
        // User is logged in - show user menu
        const profile = await window.supabaseClient.getUserProfile();
        const firstName = profile?.full_name?.split(' ')[0] || 'User';

        navAuthSection.innerHTML = `
            <div class="dropdown">
                <a class="nav-link dropdown-toggle d-flex align-items-center" href="#" 
                   id="userMenuDropdown" role="button" data-bs-toggle="dropdown">
                    <i class="bi bi-person-circle me-2"></i>
                    <span>${firstName}</span>
                </a>
                <ul class="dropdown-menu dropdown-menu-end">
                    <li><a class="dropdown-item" href="dashboard.html">
                        <i class="bi bi-speedometer2"></i> Dashboard
                    </a></li>
                    <li><a class="dropdown-item" href="screening.html">
                        <i class="bi bi-clipboard2-pulse"></i> New Screening
                    </a></li>
                    <li><hr class="dropdown-divider"></li>
                    <li><a class="dropdown-item text-danger" href="#" onclick="handleLogout()">
                        <i class="bi bi-box-arrow-right"></i> Logout
                    </a></li>
                </ul>
            </div>
        `;
    } else {
        // User is not logged in - show login/signup buttons
        navAuthSection.innerHTML = `
            <a href="login.html" class="btn btn-outline-primary me-2">Login</a>
            <a href="signup.html" class="btn btn-primary-custom">Sign Up</a>
        `;
    }
});

async function handleLogout() {
    if (confirm('Are you sure you want to logout?')) {
        await window.supabaseClient.logout();
        window.location.href = 'index.html';
    }
}

console.log('✅ Nav auth handler loaded');