import { AuthService } from '../services/auth-service.js';

export function renderLoginScreen(isRegistering = false) {
    const container = document.createElement('div');
    container.className = 'container fade-in';
    container.style.maxWidth = '400px';
    container.style.marginTop = '10vh';

    container.innerHTML = `
        <div class="glass-panel" style="text-align: center;">
            <div style="margin-bottom: 2rem;">
                <i class="fas fa-dumbbell" style="font-size: 3rem; color: var(--color-primary); margin-bottom: 1rem;"></i>
                <h2>${isRegistering ? 'Create Account' : 'Welcome Back'}</h2>
                <p style="color: var(--text-secondary);">${isRegistering ? 'Start tracking your progress.' : 'Log in to continue.'}</p>
            </div>

            <form id="auth-form">
                ${isRegistering ? `
                <div class="form-group" style="text-align: left;">
                    <label class="form-label">Username</label>
                    <input type="text" id="username" class="form-input" placeholder="e.g. FitUser99" required minlength="1" maxlength="50">
                </div>
                ` : ''}
                
                <div class="form-group" style="text-align: left;">
                    <label class="form-label">Email</label>
                    <input type="email" id="email" class="form-input" placeholder="you@example.com" required>
                </div>

                <div class="form-group" style="text-align: left;">
                    <label class="form-label">Password</label>
                    <input type="password" id="password" class="form-input" placeholder="••••••••" required minlength="6">
                </div>

                <button type="submit" class="btn btn-primary" style="width: 100%; margin-top: 1rem;">
                    ${isRegistering ? 'Register' : 'Login'} <i class="fas fa-arrow-right"></i>
                </button>
            </form>

            <div style="margin-top: 2rem; font-size: 0.9rem;">
                ${isRegistering
            ? `Already have an account? <a href="#/login">Log In</a>`
            : `Don't have an account? <a href="#/register">Register</a>`}
            </div>
        </div>
    `;

    // Handle Form Submit
    const form = container.querySelector('#auth-form');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = container.querySelector('#email').value;
        const password = container.querySelector('#password').value;
        const submitBtn = container.querySelector('button[type="submit"]');

        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';

        try {
            if (isRegistering) {
                const username = container.querySelector('#username').value;
                await AuthService.register(username, email, password);

                // After successful registration, auto-login
                await AuthService.login(email, password);

                // Show toast (requires global function implementation)
                if (window.showToast) window.showToast('Account created successfully!', 'success');
                window.location.hash = '/dashboard';
            } else {
                await AuthService.login(email, password);
                if (window.showToast) window.showToast('Logged in successfully!', 'success');
                window.location.hash = '/dashboard';
            }
        } catch (error) {
            if (window.showToast) window.showToast(error.message, 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = isRegistering ? 'Register <i class="fas fa-arrow-right"></i>' : 'Login <i class="fas fa-arrow-right"></i>';
        }
    });

    return container;
}
