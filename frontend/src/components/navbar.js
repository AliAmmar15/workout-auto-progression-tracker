export function renderNavbar() {
    const nav = document.createElement('nav');
    nav.className = 'navbar';

    nav.innerHTML = `
        <div class="navbar-content">
            <a href="#/dashboard" class="nav-brand">
                <i class="fas fa-dumbbell"></i> Levitate
            </a>
            
            <div class="nav-links">
                <a href="#/dashboard" class="nav-link" id="nav-dashboard">
                    <i class="fas fa-chart-line"></i> Dashboard
                </a>
                <a href="#/log" class="nav-link" id="nav-log">
                    <i class="fas fa-plus-circle"></i> Log Workout
                </a>
                <a href="#/history" class="nav-link" id="nav-history">
                    <i class="fas fa-history"></i> History
                </a>
            </div>
        </div>
    `;

    // Active state highlighting
    const currentHash = window.location.hash || '#/dashboard';
    const activeLink = nav.querySelector(`a[href="${currentHash}"]`);
    if (activeLink) {
        activeLink.classList.add('active');
        activeLink.style.color = 'var(--color-primary)';
    }

    return nav;
}
