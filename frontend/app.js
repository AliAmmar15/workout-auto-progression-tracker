
import { renderNavbar } from './src/components/navbar.js';

// Simple global State
export const state = {
    user: null,
    token: localStorage.getItem('access_token') || null
};

// Toast Notification Engine
export function showToast(message, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    let icon = 'info-circle';
    if (type === 'error') icon = 'exclamation-circle';
    if (type === 'success') icon = 'check-circle';

    toast.innerHTML = `<i class="fas fa-${icon}"></i> <span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function renderNavbarIfMissing(appElement) {
    if (!appElement.querySelector('.navbar')) {
        appElement.appendChild(renderNavbar());
    }
}

import { renderWorkoutLogScreen } from './src/screens/WorkoutLogScreen.js';
import { renderWorkoutHistoryScreen } from './src/screens/WorkoutHistoryScreen.js';
import { renderProgressionDashboard } from './src/screens/ProgressionDashboard.js';

// Simple Hash Router
async function router() {
    let hash = window.location.hash.slice(1) || '/';
    const appElement = document.getElementById('app');

    // Remove Auth guard entirely
    if (hash === '/login' || hash === '/register') {
        window.location.hash = '/dashboard';
        return;
    }

    // Protected Routes - ensure navbar exists, then clear main content area
    appElement.innerHTML = '';
    renderNavbarIfMissing(appElement);

    const contentArea = document.createElement('div');
    contentArea.id = 'main-content';
    contentArea.className = 'fade-in';
    appElement.appendChild(contentArea);

    switch (hash) {
        case '/':
        case '/dashboard':
            contentArea.appendChild(await renderProgressionDashboard());
            break;
        case '/log':
            contentArea.appendChild(await renderWorkoutLogScreen());
            break;
        case '/history':
            contentArea.appendChild(await renderWorkoutHistoryScreen());
            break;
        default:
            contentArea.innerHTML = `<h1 style="padding: 100px; text-align: center;">404 - Page Not Found</h1>`;
    }
}

// Listen for hash changes
window.addEventListener('hashchange', router);

// Initialize application
document.addEventListener('DOMContentLoaded', () => {
    router();
});
