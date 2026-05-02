/**
 * Workspace sidebar (MintrAIQ) — matches product shell: Dashboard, Transactions, Goals, etc.
 * Mounts into #portal-nav-root. Expects aside#app-sidebar + #sidebar-overlay + #nav-toggle for mobile.
 */
import { createLogtoClient } from './logto-client.js';

const WORKSPACE = [
    { id: 'dashboard', href: './dashboard.html', icon: 'fa-chart-line', label: 'Dashboard' },
    { id: 'transactions', href: './transactions.html', icon: 'fa-wallet', label: 'Transactions' },
    { id: 'goals', href: './goals.html', icon: 'fa-bullseye', label: 'Goals' },
    { id: 'forecast', href: './forecast.html', icon: 'fa-chart-area', label: 'Forecast' },
    { id: 'notifications', href: './notifications.html', icon: 'fa-bell', label: 'Notifications' },
    { id: 'settings', href: './settings-profile.html', icon: 'fa-sliders', label: 'Settings' },
    { id: 'license', href: './license.html', icon: 'fa-crown', label: 'License & tiers' },
    { id: 'profile', href: './profile.html', icon: 'fa-user', label: 'Profile' }
];

function escapeAttr(s) {
    return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

export function mountPortalNav() {
    const root = document.getElementById('portal-nav-root');
    if (!root) return;

    const active = document.body.getAttribute('data-portal-nav') || 'dashboard';

    const links = WORKSPACE.map((item) => {
        const cls = item.id === active ? 'menu-item active' : 'menu-item';
        return `<a href="${escapeAttr(item.href)}" class="${cls}"><i class="fas ${item.icon}"></i> ${item.label}</a>`;
    }).join('');

    root.innerHTML =
        '<div class="brand"><i class="fas fa-brain"></i> MintrAIQ</div>' +
        '<div class="menu-section">Workspace</div>' +
        links +
        '<div style="flex-grow:1"></div>' +
        '<div class="menu-section">Site</div>' +
        '<a href="../intro.html" class="menu-item"><i class="fas fa-arrow-left"></i> Marketing site</a>' +
        '<button type="button" class="menu-item" id="portalSignOut" style="border:none;width:100%;cursor:pointer;background:transparent;font:inherit;color:inherit;text-align:left">' +
        '<i class="fas fa-sign-out-alt"></i> Sign out</button>';

    const aside = document.getElementById('app-sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    const toggle = document.getElementById('nav-toggle');

    function close() {
        if (aside) aside.classList.remove('is-open');
        if (overlay) overlay.classList.remove('visible');
    }
    function open() {
        if (aside) aside.classList.add('is-open');
        if (overlay) overlay.classList.add('visible');
    }
    if (toggle && aside) {
        toggle.addEventListener('click', () => {
            if (aside.classList.contains('is-open')) close();
            else open();
        });
    }
    if (overlay) overlay.addEventListener('click', close);
    root.querySelectorAll('a.menu-item').forEach((a) => a.addEventListener('click', close));

    const btn = document.getElementById('portalSignOut');
    if (btn) {
        btn.addEventListener('click', async () => {
            const client = createLogtoClient();
            const postLogout = new URL('../intro.html', window.location.href).href;
            sessionStorage.removeItem('mintraiq_bootstrap');
            await client.signOut(postLogout);
        });
    }
}

mountPortalNav();
