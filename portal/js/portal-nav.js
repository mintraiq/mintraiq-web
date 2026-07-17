/**
 * Workspace sidebar (MintrAIQ) — matches product shell: Dashboard, Transactions, Goals, etc.
 * Mounts into #portal-nav-root. Expects aside#app-sidebar + #sidebar-overlay + #nav-toggle for mobile.
 * With Turbo Drive + data-turbo-permanent on #portal-sidebar-region, the shell builds once and only
 * syncs the active nav item on each visit (avoids sidebar flicker).
 */
import { isFeatureReceiptScannerEnabled } from './config.js';
import { CONFIG } from './config.js';
import { financeApiFetch } from './api.js';
import { filterWorkspaceNav, loadEntitlementProfile } from './entitlements.js';
import { clearClientSessionArtifacts, createLogtoClient, getAccessTokenOrReauth, purgeAuthForRelogin } from './logto-client.js';
import { installPortalTransitions } from './turbo-transitions.js';
import { loadLegalContent } from './legal-store.js';
import { syncWorkspaceBanner } from './workspace-banner.js';

const BRAND_LEAF_MARKUP = '<img src="../assets/mintr-leaf-mark.png" alt="" aria-hidden="true" class="brand-leaf" width="16" height="24">';
const BRAND_TEXT_MARKUP = BRAND_LEAF_MARKUP + '<span>Mintr<span class="gradient-text">AIQ</span></span>';

const WORKSPACE = [
    { id: 'dashboard', href: './dashboard.html', icon: 'fa-chart-line', label: 'Dashboard' },
    { id: 'transactions', href: './transactions.html', icon: 'fa-wallet', label: 'Transactions' },
    { id: 'product-analytics', href: './product-analytics.html', icon: 'fa-tags', label: 'Product prices' },
    { id: 'upload-statement', href: './upload-statement.html', icon: 'fa-file-import', label: 'Upload statement' },
    { id: 'receipt-scanner', href: './receipt-scanner.html', icon: 'fa-receipt', label: 'Receipt scanner' },
    { id: 'budget-planner', href: './budget-planner.html', icon: 'fa-calendar-check', label: 'Monthly planner' },
    { id: 'weekly-planner', href: './weekly-planner.html', icon: 'fa-calendar-week', label: 'Weekly planner' },
    { id: 'recurring-liabilities', href: './recurring-liabilities.html', icon: 'fa-repeat', label: 'Recurring bills' },
    { id: 'goals', href: './goals.html', icon: 'fa-bullseye', label: 'Goals' },
    { id: 'forecast', href: './forecast.html', icon: 'fa-chart-area', label: 'Forecast' },
    { id: 'dashboard-analytics', href: './dashboard-analytics.html', icon: 'fa-wand-magic-sparkles', label: 'Analytics' },
    { id: 'license', href: './license.html', icon: 'fa-crown', label: 'License & tiers' },
    { id: 'profile', href: './profile.html', icon: 'fa-user', label: 'Profile' }
];

function escapeAttr(s) {
    return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

async function resolveAdminNavVisible(client) {
    if (!client) return false;
    try {
        const token = await getAccessTokenOrReauth(client, CONFIG.financeApiResource);
        const base = CONFIG.financeApiBase.replace(/\/$/, '');
        const res = await fetch(`${base}/v1/admin/ml/access`, {
            headers: { Accept: 'application/json', Authorization: `Bearer ${token}` }
        });
        if (!res.ok) return false;
        const data = await res.json();
        return Boolean(data.allowed);
    } catch {
        return false;
    }
}

async function resolveSecurityNavVisible(client) {
    if (!client) return false;
    try {
        const token = await getAccessTokenOrReauth(client, CONFIG.financeApiResource);
        const base = CONFIG.financeApiBase.replace(/\/$/, '');
        const res = await fetch(`${base}/v1/security/findings/access`, {
            headers: { Accept: 'application/json', Authorization: `Bearer ${token}` }
        });
        if (!res.ok) return false;
        const data = await res.json();
        return Boolean(data.allowed);
    } catch {
        return false;
    }
}

function workspaceNavItems(profile = null, adminVisible = false, securityVisible = false) {
    let items = WORKSPACE.filter(
        (item) => item.id !== 'receipt-scanner' || isFeatureReceiptScannerEnabled(),
    );
    if (profile) {
        items = filterWorkspaceNav(profile, items);
    }
    if (adminVisible) {
        items = [
            ...items,
            { id: 'ml-admin', href: './ml-admin.html', icon: 'fa-microchip', label: 'ML admin' },
            { id: 'admin-config', href: './admin-config.html', icon: 'fa-shield-halved', label: 'Config & secrets' }
        ];
    }
    if (securityVisible) {
        items = [
            ...items,
            { id: 'security-findings', href: './security-findings.html', icon: 'fa-shield-virus', label: 'Security findings' }
        ];
    }
    return items;
}

/** Rebuild sidebar when feature toggles (e.g. receipt scanner) change between Turbo visits. */
function portalNavSignature() {
    return `v1|rs:${isFeatureReceiptScannerEnabled() ? '1' : '0'}`;
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
    const settingsNav = document.body.getAttribute('data-settings-nav') || '';
    root.querySelectorAll('a.menu-item[data-nav-id]').forEach((a) => {
        const id = a.getAttribute('data-nav-id');
        const legalOn = id === 'legal-terms' && active === 'settings' && settingsNav === 'legal';
        a.classList.toggle('active', legalOn || id === active);
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

async function resolveEntitlementProfile(client) {
    try {
        return await loadEntitlementProfile(client, financeApiFetch);
    } catch (err) {
        console.warn('portal-nav: could not load entitlement profile', err);
        return null;
    }
}

export async function mountPortalNav() {
    const root = document.getElementById('portal-nav-root');
    if (!root) return;

    closeSidebar();
    ensureSidebarDelegation();
    const client = createLogtoClient();
    if (client && shouldPrefetchLegalForNav()) {
        loadLegalContent(client).catch(() => {});
    }

    const profile = client ? await resolveEntitlementProfile(client) : null;
    const [adminVisible, securityVisible] = client
        ? await Promise.all([resolveAdminNavVisible(client), resolveSecurityNavVisible(client)])
        : [false, false];
    const sig = `${portalNavSignature()}|tier:${profile?.effective_tier_id || 'unknown'}|admin:${adminVisible ? '1' : '0'}|sec:${securityVisible ? '1' : '0'}`;
    if (root.dataset.portalNavSig !== sig) {
        root.dataset.portalNavSig = sig;
        const links = workspaceNavItems(profile, adminVisible, securityVisible)
            .map((item) => {
                return `<a href="${escapeAttr(item.href)}" class="menu-item" data-nav-id="${escapeAttr(item.id)}"><i class="fas ${item.icon}"></i> ${item.label}</a>`;
            })
            .join('');

        root.innerHTML =
            '<a href="./dashboard.html" class="brand">' + BRAND_TEXT_MARKUP + '</a>' +
            '<div class="menu-section">Workspace</div>' +
            links +
            '<div style="flex-grow:1"></div>' +
            '<a href="./settings-legal.html" class="menu-item menu-item--legal" data-nav-id="legal-terms"><i class="fas fa-scale-balanced"></i> Legal &amp; Terms</a>' +
            '<div class="menu-section">Site</div>' +
            '<a href="../intro.html" class="menu-item" data-turbo="false"><i class="fas fa-arrow-left"></i> Marketing site</a>';
    }

    syncActiveNav();
    syncWorkspaceBanner();
    syncMobileBarBrand();
}

function syncMobileBarBrand() {
    document.querySelectorAll('.mobile-bar').forEach((bar) => {
        const existing = bar.querySelector('.mobile-bar-brand');
        if (existing) {
            if (!existing.querySelector('.brand-leaf')) {
                existing.innerHTML = BRAND_TEXT_MARKUP;
            }
            return;
        }
        const label = bar.querySelector('span');
        if (!label) return;
        const link = document.createElement('a');
        link.href = './dashboard.html';
        link.className = 'mobile-bar-brand';
        link.innerHTML = BRAND_TEXT_MARKUP;
        label.replaceWith(link);
    });
}

async function mountGlobalAiReservesFab() {
    const nav = document.body?.getAttribute('data-portal-nav');
    if (!nav) return;
    try {
        const mod = await import('./ai-reserves-fab.js');
        await mod.mountAiReservesFab();
    } catch (e) {
        console.warn('ai-reserves fab mount', e);
    }
}

function onPortalTurboLoad() {
    mountPortalNav();
    void mountGlobalAiReservesFab();
}

installMobileShellTurboHygiene();
mountPortalNav();
void mountGlobalAiReservesFab();
if (!window.__mintPortalNavTurboLoad) {
    window.__mintPortalNavTurboLoad = true;
    document.addEventListener('turbo:load', onPortalTurboLoad);
}
installPortalTransitions();
