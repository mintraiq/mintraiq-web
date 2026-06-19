import { bootstrapSession } from './bootstrap.js';
import { isBootstrapOnboardingComplete } from './config.js';
import { createLogtoClient } from './logto-client.js';
import { fetchFinanceDashboardJson, monthRangeStrings } from './finance-dashboard.js';
import * as render from './dashboard-render.js';
import { renderFidelityDashboard } from './dashboard-fidelity.js';
import { getLegalContent } from './legal-store.js';
import { onStealthModeChange } from './stealth-mode.js';
import { resolveDisplayName, resolveEmail } from './user-display.js';

/** @type {Record<string, unknown> | null} */
let lastDashboardPayload = null;

function readBootstrap() {
    const raw = sessionStorage.getItem('mintraiq_bootstrap');
    if (!raw) return null;
    try {
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

/**
 * Match profile.html: prefer bootstrap profile, then OIDC claims (avoids "there" + wrong "T" avatar when API name lags).
 * @param {unknown} bootstrap
 * @param {unknown} claims — Logto `getIdTokenClaims()`
 */
function applyBootstrapHeader(bootstrap, claims) {
    const profile = bootstrap && bootstrap.profile;
    const routing = bootstrap && bootstrap.routing;
    const name = resolveDisplayName(profile, claims);
    const tier = (profile && profile.tier) || '—';
    const dash = (routing && routing.dashboard_type) || 'full';

    const welcome = document.getElementById('welcomeLine');
    if (welcome) {
        welcome.textContent = name
            ? `Signed in as ${name} · ${dash} workspace`
            : `Signed in · ${dash} workspace`;
    }
    const pill = document.getElementById('tierPill');
    if (pill) {
        pill.textContent = String(tier);
        pill.style.display = 'inline-block';
    }
    const av = document.getElementById('userAvatar');
    if (av) {
        if (name && name.length) {
            av.textContent = String(name).trim().charAt(0).toUpperCase();
        } else {
            const em = resolveEmail(profile, claims);
            av.textContent = em && em.length ? em.trim().charAt(0).toUpperCase() : '?';
        }
    }
}

function setInsightsFooter(text) {
    const el = document.getElementById('dashboardInsightsFooter');
    if (!el) return;
    const fallback =
        getLegalContent()?.content?.insights_footer ||
        'This is AI-generated analysis and does not constitute financial advice under NZ law.';
    el.textContent = text || fallback;
}

/**
 * Runs on every Turbo visit — ES module top-level runs only once, so this must be called from turbo-workspace-boot.
 * @param {{ signal?: AbortSignal }} [opts]
 */
export async function bootDashboardPage(opts = {}) {
    const { signal } = opts;
    if (signal?.aborted) return;

    let bootstrap = readBootstrap();
    if (!bootstrap || typeof bootstrap !== 'object') {
        window.location.replace('./index.html');
        return;
    }
    if (bootstrap.status && bootstrap.status !== 'success') {
        window.location.replace('./index.html');
        return;
    }

    const client = createLogtoClient();
    if (!isBootstrapOnboardingComplete(bootstrap)) {
        try {
            if (await client.isAuthenticated()) {
                const fresh = await bootstrapSession(client);
                sessionStorage.setItem('mintraiq_bootstrap', JSON.stringify({ ...fresh, at: Date.now() }));
                bootstrap = fresh;
            }
        } catch {
            /* fall through to onboarding redirect */
        }
    }
    if (!isBootstrapOnboardingComplete(bootstrap)) {
        window.location.replace('./onboarding.html');
        return;
    }

    const statusEl = document.getElementById('apiStatus');

    if (!(await client.isAuthenticated())) {
        window.location.replace('./index.html');
        return;
    }

    const claims = await client.getIdTokenClaims();
    applyBootstrapHeader(bootstrap, claims);

    if (signal?.aborted) return;

    const { start, end } = monthRangeStrings();
    if (statusEl) statusEl.textContent = 'Loading…';

    try {
        const data = await fetchFinanceDashboardJson(client, start, end);
        if (signal?.aborted) return;

        setInsightsFooter(data?.insights_footer || '');

        if (statusEl) statusEl.textContent = '';
        lastDashboardPayload = data;
        renderFidelityDashboard(data, render);
    } catch (e) {
        if (signal?.aborted) return;
        console.error(e);
        setInsightsFooter('');
        if (statusEl) statusEl.textContent = '';
        if (e.status === 401) {
            window.location.replace('./index.html');
            return;
        }
        render.showLoadError(e.message || e);
    }
}

if (!window.__mintDashboardStealthListener) {
    window.__mintDashboardStealthListener = true;
    onStealthModeChange(() => {
        if (document.body?.getAttribute('data-portal-nav') !== 'dashboard' || !lastDashboardPayload) return;
        renderFidelityDashboard(lastDashboardPayload, render);
    });
}
