import { createLogtoClient } from './logto-client.js';
import { loadLegalContent } from './legal-store.js';
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
    if (bootstrap?.onboarding_complete === false && !isOnboardingAllowedPath()) {
        window.location.replace(new URL('../onboarding.html', import.meta.url).href);
        return false;
    }

    loadLegalContent(client).catch(() => {
        // Avoid blocking page UX on legal-content fetch issues.
    });
    return true;
}
