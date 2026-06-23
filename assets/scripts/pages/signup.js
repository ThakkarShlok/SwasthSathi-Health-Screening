/**
 * ============================================
 * SIGNUP PAGE - PRODUCTION READY
 * ============================================
 */

document.getElementById('signupForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const submitBtn = document.getElementById('submitBtn');
    const originalText = submitBtn.innerHTML;

    const fullName = document.getElementById('fullName').value.trim();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const city = document.getElementById('city').value.trim();
    const state = document.getElementById('state').value.trim();

    if (!fullName || !email || !password) {
        showAlert('danger', window.translator.t('error_required_fields', 'Please fill all required fields'));
        return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        showAlert('danger', window.translator.t('error_invalid_email', 'Please enter a valid email address'));
        return;
    }

    if (password.length < 8) {
        showAlert('danger', window.translator.t('error_password_too_short', 'Password must be at least 8 characters'));
        return;
    }

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>' + window.translator.t('btn_creating_account', 'Creating account...');

    try {
        const result = await window.supabaseClient.signUp(
            email,
            password,
            fullName,
            city,
            state
        );

        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;

        if (result.success) {
            showAlert('success', window.translator.t('notification_signup_success', 'Account created! Redirecting...'));

            document.getElementById('signupForm').reset();

            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 1500);
        } else {
            showAlert('danger', result.error || window.translator.t('error_signup_failed', 'Signup failed. Please try again.'));
        }
    } catch (error) {
        console.error('Signup error:', error);
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
        showAlert('danger', window.translator.t('error_generic', 'An error occurred. Please try again.'));
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

    const form = document.getElementById('signupForm');
    form.insertBefore(alert, form.firstChild);

    setTimeout(() => {
        if (alert.parentElement) {
            alert.remove();
        }
    }, 8000);
}

console.log('✅ Signup page ready (v3.0)');
