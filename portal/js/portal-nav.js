/**
 * Workspace sidebar (MintrAIQ) — matches product shell: Dashboard, Transactions, Goals, etc.
 * Mounts into #portal-nav-root. Expects aside#app-sidebar + #sidebar-overlay + #nav-toggle for mobile.
 * With Turbo Drive + data-turbo-permanent on #portal-sidebar-region, the shell builds once and only
 * syncs the active nav item on each visit (avoids sidebar flicker).
 */
import { clearClientSessionArtifacts, createLogtoClient, purgeAuthForRelogin } from './logto-client.js';
import { installPortalTransitions } from './turbo-transitions.js';
import { loadLegalContent } from './legal-store.js';

const WORKSPACE = [
    { id: 'dashboard', href: './dashboard.html', icon: 'fa-chart-line', label: 'Dashboard' },
    { id: 'transactions', href: './transactions.html', icon: 'fa-wallet', label: 'Transactions' },
    { id: 'budget-planner', href: './budget-planner.html', icon: 'fa-calendar-check', label: 'Monthly planner' },
    { id: 'weekly-planner', href: './weekly-planner.html', icon: 'fa-calendar-week', label: 'Weekly planner' },
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

function closeSidebar() {
    const aside = document.getElementById('app-sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if (aside) aside.classList.remove('is-open');
    if (overlay) overlay.classList.remove('visible');
}

/**
 * Mobile menu uses a full-screen overlay (z-index 150). If it stays .visible across a Turbo Drive
 * visit (e.g. user follows a link in main content while the menu was open), clicks hit the overlay
 * instead of buttons — feels "dead" until a full reload. Reset on every navigation + bfcache.
 */
function installMobileShellTurboHygiene() {
    if (window.__mintMobileShellTurboHygiene) return;
    window.__mintMobileShellTurboHygiene = true;
    const reset = () => closeSidebar();
    document.addEventListener('turbo:visit', reset);
    document.addEventListener('turbo:load', reset);
    document.addEventListener('turbo:before-cache', () => {
        reset();
        document.querySelectorAll('.settings-stripe-modal').forEach((el) => el.remove());
    });
    window.addEventListener('pageshow', (ev) => {
        if (ev.persisted) reset();
    });
}

function syncActiveNav() {
    const root = document.getElementById('portal-nav-root');
    if (!root) return;
    const active = document.body.getAttribute('data-portal-nav') || 'dashboard';
    root.querySelectorAll('a.menu-item[data-nav-id]').forEach((a) => {
        const id = a.getAttribute('data-nav-id');
        a.classList.toggle('active', id === active);
    });
}

function ensureSidebarDelegation() {
    if (window.__portalNavSidebarDelegation) return;
    window.__portalNavSidebarDelegation = true;

    document.addEventListener('click', async (e) => {
        const t = e.target;
        if (!(t instanceof Element)) return;

        if (t.closest('#nav-toggle')) {
            const aside = document.getElementById('app-sidebar');
            const overlay = document.getElementById('sidebar-overlay');
            if (!aside) return;
            const isOpen = aside.classList.toggle('is-open');
            if (overlay) overlay.classList.toggle('visible', isOpen);
            return;
        }

        if (t.closest('#sidebar-overlay')) {
            closeSidebar();
            return;
        }

        if (t.closest('#portalSignOut')) {
            e.preventDefault();
            const postLogout = new URL('../intro.html', window.location.href).href;
            clearClientSessionArtifacts();
            try {
                const client = createLogtoClient();
                await client.signOut(postLogout);
            } catch (err) {
                console.error(err);
                purgeAuthForRelogin();
                window.location.replace(postLogout);
            }
            return;
        }

        if (t.closest('#portal-nav-root a.menu-item')) {
            closeSidebar();
        }
    });
}

function shouldPrefetchLegalForNav() {
    if (typeof document === 'undefined') return true;
    if (document.body?.dataset?.onboardingPage === '1') return false;
    const path = document.location.pathname || '';
    if (path.endsWith('/onboarding.html') || path.endsWith('/onboarding')) return false;
    return true;
}

export function mountPortalNav() {
    const root = document.getElementById('portal-nav-root');
    if (!root) return;

    closeSidebar();
    ensureSidebarDelegation();
    const client = createLogtoClient();
    if (client && shouldPrefetchLegalForNav()) {
        loadLegalContent(client).catch(() => {});
    }

    if (!root.dataset.portalNavBuilt) {
        const links = WORKSPACE.map((item) => {
            return `<a href="${escapeAttr(item.href)}" class="menu-item" data-nav-id="${escapeAttr(item.id)}"><i class="fas ${item.icon}"></i> ${item.label}</a>`;
        }).join('');

        root.innerHTML =
            '<div class="brand"><i class="fas fa-brain"></i> MintrAIQ</div>' +
            '<div class="menu-section">Workspace</div>' +
            links +
            '<div style="flex-grow:1"></div>' +
            '<div class="menu-section">Site</div>' +
            '<a href="../intro.html" class="menu-item" data-turbo="false"><i class="fas fa-arrow-left"></i> Marketing site</a>' +
            '<button type="button" class="menu-item" id="portalSignOut" data-turbo="false" style="border:none;width:100%;cursor:pointer;background:transparent;font:inherit;color:inherit;text-align:left">' +
            '<i class="fas fa-sign-out-alt"></i> Sign out</button>';

        root.dataset.portalNavBuilt = '1';
    }

    syncActiveNav();
}

installMobileShellTurboHygiene();
mountPortalNav();
if (!window.__mintPortalNavTurboLoad) {
    window.__mintPortalNavTurboLoad = true;
    document.addEventListener('turbo:load', mountPortalNav);
}
installPortalTransitions();
