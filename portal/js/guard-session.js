import { isBootstrapOnboardingComplete } from './config.js';
import { createLogtoClient } from './logto-client.js';
import { getLegalContent, loadLegalContent, userStatusFromBootstrapPayload } from './legal-store.js';
import { bootstrapSession } from './bootstrap.js';

function readBootstrap() {
    const raw = sessionStorage.getItem('mintraiq_bootstrap');
    if (!raw) return null;
    try {
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

function isOnboardingAllowedPath() {
    const path = window.location.pathname;
    const setup = new URLSearchParams(window.location.search).get('setup') === '1';
    if (path.endsWith('/onboarding.html') || path.endsWith('/onboarding')) return true;
    if (setup && /\/settings-(profile|billing|security|banks|goals|categories|ai|notifications)\.html$/.test(path)) {
        return true;
    }
    return false;
}

function hasLegalAgreementSignal(bootstrap) {
    if (userStatusFromBootstrapPayload(bootstrap)?.has_agreed === true) return true;
    if (getLegalContent()?.user_status?.has_agreed === true) return true;
    return false;
}

/** Terms must be accepted before any setup / data steps (chapter flow). Legal page is allowed without it. */
function mustRedirectToOnboardingForLegal(bootstrap) {
    if (!bootstrap || isBootstrapOnboardingComplete(bootstrap)) return false;
    const path = window.location.pathname || '';
    if (path.endsWith('/onboarding.html') || path.endsWith('/onboarding')) return false;
    if (path.includes('settings-legal.html')) return false;
    if (!/\/settings-[^.]+\.html$/.test(path)) return false;
    return !hasLegalAgreementSignal(bootstrap);
}

async function ensureBootstrap(client) {
    let bootstrap = readBootstrap();
    if (bootstrap && bootstrap.status === 'success') return bootstrap;
    bootstrap = await bootstrapSession(client);
    sessionStorage.setItem('mintraiq_bootstrap', JSON.stringify({ ...bootstrap, at: Date.now() }));
    return bootstrap;
}

/** Redirect to sign-in if not authenticated. Call at top of each protected page module. */
export async function guardSession() {
    const client = createLogtoClient();
    if (!(await client.isAuthenticated())) {
        window.location.replace(new URL('../index.html', import.meta.url).href);
        return false;
    }
    const bootstrap = await ensureBootstrap(client);
    if (mustRedirectToOnboardingForLegal(bootstrap)) {
        window.location.replace(new URL('../onboarding.html', import.meta.url).href);
        return false;
    }
    if (!isBootstrapOnboardingComplete(bootstrap) && !isOnboardingAllowedPath()) {
        window.location.replace(new URL('../onboarding.html', import.meta.url).href);
        return false;
    }

    loadLegalContent(client).catch(() => {
        // Avoid blocking page UX on legal-content fetch issues.
    });
    return true;
}
