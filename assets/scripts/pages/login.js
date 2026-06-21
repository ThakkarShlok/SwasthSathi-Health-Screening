/**
 * ============================================
 * LOGIN PAGE LOGIC - FIXED VERSION
 * ============================================
 */

document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const submitBtn = document.getElementById('submitBtn');
    const originalText = submitBtn.innerHTML;

    const email = document.getElementById('email').value.trim().toLowerCase(); // ⭐ Convert to lowercase
    const password = document.getElementById('password').value;

    // ⭐ Enhanced validation
    if (!email || !password) {
        showAlert('danger', 'Please enter both email and password');
        return;
    }

    // ⭐ Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        showAlert('danger', 'Please enter a valid email address');
        return;
    }

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Logging in...';

    try {
        console.log('🔐 Attempting login with:', email);
        
        const result = await window.supabaseClient.login(email, password);

        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;

        if (result.success) {
            showAlert('success', '✅ Login successful! Redirecting...');
            
            // ⭐ Clear password field for security
            document.getElementById('password').value = '';
            
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 1500);
        } else {
            console.error('❌ Login failed:', result.error);
            
            // ⭐ Enhanced error messages
            if (result.error.includes('Invalid login credentials')) {
                showAlert('danger', '❌ Invalid email or password. Please try again.');
            } else if (result.error.includes('Email not confirmed')) {
                showAlert('warning', '📧 Please check your email and confirm your account first.');
            } else if (result.error.includes('rate limit')) {
                showAlert('warning', '⏳ Too many login attempts. Please wait 5 minutes.');
            } else {
                showAlert('danger', `❌ Login failed: ${result.error || 'Please check your credentials'}`);
            }
        }
    } catch (error) {
        console.error('❌ Login exception:', error);
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
        
        showAlert('danger', '⚠️ Network error. Please check your connection and try again.');
    }
});

function togglePassword() {
    const passwordInput = document.getElementById('password');
    const icon = document.getElementById('toggleIcon');
    
    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        icon.classList.remove('bi-eye');
        icon.classList.add('bi-eye-slash');
    } else {
        passwordInput.type = 'password';
        icon.classList.remove('bi-eye-slash');
        icon.classList.add('bi-eye');
    }
}

function showAlert(type, message) {
    const existingAlert = document.querySelector('.alert-notification');
    if (existingAlert) existingAlert.remove();

    const alert = document.createElement('div');
    alert.className = `alert alert-${type} alert-notification alert-dismissible fade show`;
    alert.innerHTML = `
        <i class="bi bi-${type === 'success' ? 'check-circle-fill' : 
                          type === 'info' ? 'info-circle-fill' :
                          type === 'warning' ? 'exclamation-triangle-fill' : 
                          'x-circle-fill'}"></i>
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;

    const form = document.getElementById('loginForm');
    form.insertBefore(alert, form.firstChild);

    setTimeout(() => {
        if (alert.parentElement) {
            alert.remove();
        }
    }, 6000);
}

console.log('✅ Login page ready (Enhanced version)');