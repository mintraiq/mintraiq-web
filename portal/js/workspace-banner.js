/**
 * Global workspace top banner: page title + subtitle, settings / notifications / logout / avatar.
 * Injects once per header; keeps dashboard #welcomeLine / #tierPill markup intact.
 * Tier tint (free / basic / premium) from session `mintraiq_bootstrap` profile tier — see applyTierSkinToAllBanners.
 */

const TIER_SKIN_CLASSES = ['portal-banner--tier-free', 'portal-banner--tier-medium', 'portal-banner--tier-advanced'];

const PORTAL_PAGE_COPY = {
    dashboard: { title: 'Dashboard', subtitle: null },
    transactions: {
        title: 'Transactions',
        subtitle: 'Review your latest activity, sync your bank, and tag categories.'
    },
    'upload-statement': {
        title: 'Upload statement',
        subtitle: 'CSV, OFX, QFX, or PDF — we parse in your browser session.'
    },
    'receipt-scanner': {
        title: 'Receipt scanner',
        subtitle: 'Capture or upload a receipt, then run AI extraction.'
    },
    'budget-planner': {
        title: 'Monthly planner',
        subtitle: 'Budget view and month-to-month planning.'
    },
    'weekly-planner': {
        title: 'Weekly planner',
        subtitle: 'Week-at-a-glance cash flow and tasks.'
    },
    goals: { title: 'Goals', subtitle: 'Savings targets and progress.' },
    forecast: { title: 'Forecast', subtitle: 'Projections based on your latest activity.' },
    notifications: { title: 'Notifications', subtitle: 'Nudges and alerts from MintrAIQ.' },
    license: {
        title: 'License & tiers',
        subtitle: 'Choose the plan that matches your automation and data volume.'
    },
    profile: { title: 'Profile', subtitle: 'Your account in the MintrAIQ portal.' }
};

const SETTINGS_PAGE_COPY = {
    profile: {
        title: '',
        subtitle: ''
    },
    billing: { title: '', subtitle: '' },
    security: { title: '', subtitle: '' },
    goals: { title: '', subtitle: '' },
    banks: { title: '', subtitle: '' },
    categories: { title: '', subtitle: '' },
    ai: { title: '', subtitle: '' },
    notifications: { title: '', subtitle: '' },
    legal: { title: '', subtitle: '' }
};

function escapeAttr(s) {
    return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

function readRawTierFromBootstrap() {
    try {
        const raw = sessionStorage.getItem('mintraiq_bootstrap');
        if (!raw) return 'free';
        const b = JSON.parse(raw);
        const t =
            (b.profile && b.profile.tier) ||
            (b.profile && b.profile.billing_tier) ||
            b.billing_tier ||
            b.tier;
        return String(t || 'free')
            .toLowerCase()
            .trim();
    } catch {
        return 'free';
    }
}

/**
 * Maps product tiers to three banner treatments: lite (free), medium (basic / pro), lite-dark (premium+).
 */
function resolveTierSkinClass() {
    const t = readRawTierFromBootstrap();
    if (
        t === 'premium' ||
        t === 'pro' ||
        t === 'pro_trial' ||
        t === 'business' ||
        t === 'advanced' ||
        t === 'shadow' ||
        t === 'vip' ||
        t === 'enterprise'
    ) {
        return 'portal-banner--tier-advanced';
    }
    if (t === 'basic' || t === 'warrior' || t === 'standard' || t === 'lite_plus') {
        return 'portal-banner--tier-medium';
    }
    return 'portal-banner--tier-free';
}

function applyTierSkinToAllBanners() {
    if (typeof document === 'undefined') return;
    const tierClass = resolveTierSkinClass();
    const headers = new Set();

    const byId = document.getElementById('portal-workspace-banner');
    if (byId) headers.add(byId);

    const mainStd = document.querySelector('main.main-content:not(.main-content--settings)');
    if (mainStd) {
        const first = mainStd.querySelector(':scope > header.top-header');
        if (first) headers.add(first);
    }

    const mainSettings = document.querySelector('main.main-content--settings');
    if (mainSettings) {
        const sb = mainSettings.querySelector('#portal-workspace-banner');
        if (sb) headers.add(sb);
    }

    headers.forEach((header) => {
        header.classList.add('portal-workspace-banner');
        TIER_SKIN_CLASSES.forEach((c) => header.classList.remove(c));
        header.classList.add(tierClass);
        header.dataset.portalTierSkin = tierClass.replace('portal-banner--tier-', '');
    });
}

function wireTierSkinReactivity() {
    if (typeof window === 'undefined' || window.__mintWorkspaceBannerTierListener) return;
    window.__mintWorkspaceBannerTierListener = true;
    document.addEventListener('mint:bootstrap-ready', () => applyTierSkinToAllBanners());
}
wireTierSkinReactivity();

function injectHeaderRightGlobalActions(header) {
    let right = header.querySelector('.header-right');
    if (!right) {
        right = document.createElement('div');
        right.className = 'header-right';
        header.appendChild(right);
    }
    if (right.querySelector('.portal-banner-global-stack')) return;

    const stack = document.createElement('div');
    stack.className = 'portal-banner-global-stack';
    stack.innerHTML =
        `<a href="${escapeAttr('./settings-profile.html')}" class="portal-banner-icon" title="Settings" aria-label="Settings"><i class="fas fa-cog" aria-hidden="true"></i></a>` +
        `<a href="${escapeAttr('./notifications.html')}" class="portal-banner-icon portal-banner-icon--notify" title="Notifications" aria-label="Notifications">` +
        `<span class="portal-banner-badge" aria-hidden="true">3</span><i class="fas fa-bell" aria-hidden="true"></i></a>` +
        `<button type="button" class="portal-banner-logout" id="portalSignOut" data-turbo="false" title="Sign out" aria-label="Sign out">` +
        `<i class="fas fa-sign-out-alt" aria-hidden="true"></i><span class="portal-banner-logout-label">Logout</span></button>`;

    const avatar = right.querySelector('#userAvatar');
    if (avatar) right.insertBefore(stack, avatar);
    else {
        right.appendChild(stack);
        const av = document.createElement('a');
        av.href = './profile.html';
        av.className = 'user-avatar';
        av.id = 'userAvatar';
        av.title = 'Profile';
        av.textContent = '?';
        right.appendChild(av);
    }
}

function resolveWorkspaceCopy(nav, settingsNav) {
    if (nav === 'settings' && settingsNav) {
        return SETTINGS_PAGE_COPY[settingsNav] || { title: 'Settings', subtitle: '' };
    }
    return PORTAL_PAGE_COPY[nav] || { title: 'MintrAIQ', subtitle: '' };
}

function applyTitleSubtitle(header, nav, settingsNav) {
    const left = header.querySelector('.header-left');
    if (!left) return;
    const h2 = left.querySelector('h2');
    const copy = resolveWorkspaceCopy(nav, settingsNav);
    if (h2 && copy.title) h2.textContent = copy.title;

    if (nav === 'dashboard' && document.getElementById('welcomeLine')) {
        return;
    }
    const subP = left.querySelector('p');
    if (subP && copy.subtitle != null && copy.subtitle !== '') {
        subP.textContent = copy.subtitle;
    }
}

function getOrCreatePrimaryWorkspaceHeader(main) {
    let h = main.querySelector(':scope > header.top-header');
    if (h) return h;
    h = main.querySelector('#portal-workspace-banner');
    if (h) return h;
    h = document.createElement('header');
    h.id = 'portal-workspace-banner';
    h.className = 'top-header portal-workspace-banner';
    h.innerHTML =
        '<div class="header-left"><h2 style="margin:0;font-size:1.75rem"></h2><p style="margin:6px 0 0;color:var(--text-secondary);font-size:0.95rem"></p></div><div class="header-right"></div>';
    main.insertBefore(h, main.firstChild);
    return h;
}

function ensureSettingsWorkspaceBanner() {
    const main = document.querySelector('main.main-content--settings');
    if (!main) return;
    let banner = main.querySelector('#portal-workspace-banner');
    if (!banner) {
        banner = document.createElement('header');
        banner.id = 'portal-workspace-banner';
        banner.className = 'top-header portal-workspace-banner portal-workspace-banner--settings';
        banner.innerHTML =
            '<div class="header-left portal-workspace-banner__settings-spacer" aria-hidden="true"></div>' +
            '<div class="header-right"></div>';
        const shell = main.querySelector('.portal-settings-shell');
        if (shell) main.insertBefore(banner, shell);
        else main.insertBefore(banner, main.firstChild);
    }
    banner.classList.add('portal-workspace-banner--settings');
    injectHeaderRightGlobalActions(banner);
}

function ensureOnboardingWorkspaceBanner() {
    const main = document.querySelector('main.onboarding-entry-main');
    if (!main) return;
    let banner = main.querySelector('#portal-workspace-banner');
    if (!banner) {
        banner = document.createElement('header');
        banner.id = 'portal-workspace-banner';
        banner.className = 'top-header portal-workspace-banner';
        banner.innerHTML =
            '<div class="header-left">' +
            '<h2 style="margin:0;font-size:1.75rem">Onboarding</h2>' +
            '<p style="margin:6px 0 0;color:var(--text-secondary);font-size:0.95rem">Get set up safely — agree to terms, then finish your profile.</p>' +
            '</div><div class="header-right"></div>';
        main.insertBefore(banner, main.firstChild);
    }
    injectHeaderRightGlobalActions(banner);
}

/**
 * Call on each Turbo visit after shell is present (from portal-nav).
 */
export function syncWorkspaceBanner() {
    if (typeof document === 'undefined') return;

    try {
        if (document.body?.getAttribute('data-onboarding-page') === '1') {
            ensureOnboardingWorkspaceBanner();
            return;
        }

        if (document.querySelector('main.main-content--settings')) {
            ensureSettingsWorkspaceBanner();
            return;
        }

        const main = document.querySelector('main.main-content');
        if (!main) return;

        const nav = document.body?.getAttribute('data-portal-nav') || 'dashboard';
        const settingsNav = document.body?.getAttribute('data-settings-nav') || '';

        const header = getOrCreatePrimaryWorkspaceHeader(main);
        injectHeaderRightGlobalActions(header);
        applyTitleSubtitle(header, nav, settingsNav);
    } finally {
        applyTierSkinToAllBanners();
    }
}
