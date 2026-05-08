import { createLogtoClient } from './js/logto-client.js';
import { fetchFinanceDashboardJson, monthRangeStrings } from './js/finance-dashboard.js';
import * as render from './js/dashboard-render.js';
import { claimPageScript } from './js/page-script-guard.js';
import { getLegalContent } from './js/legal-store.js';

function readBootstrap() {
    const raw = sessionStorage.getItem('mintraiq_bootstrap');
    if (!raw) return null;
    try {
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

function applyBootstrapHeader(bootstrap) {
    const profile = bootstrap && bootstrap.profile;
    const routing = bootstrap && bootstrap.routing;
    const name = (profile && profile.name) || 'there';
    const tier = (profile && profile.tier) || '—';
    const dash = (routing && routing.dashboard_type) || 'full';

    const welcome = document.getElementById('welcomeLine');
    if (welcome) {
        welcome.textContent = `Signed in as ${name} · ${dash} workspace`;
    }
    const pill = document.getElementById('tierPill');
    if (pill) {
        pill.textContent = String(tier);
        pill.style.display = 'inline-block';
    }
    const av = document.getElementById('userAvatar');
    if (av && name && name.length) {
        av.textContent = String(name).trim().charAt(0).toUpperCase();
    }
}

function setInsightsFooter(text) {
    const el = document.getElementById('dashboardInsightsFooter');
    if (!el) return;
    const fallback = getLegalContent()?.content?.insights_footer || 'This is AI-generated analysis and does not constitute financial advice under NZ law.';
    el.textContent = text || fallback;
}

async function main() {
    if (!claimPageScript('dashboard-main')) return;
    const bootstrap = readBootstrap();
    if (!bootstrap || typeof bootstrap !== 'object') {
        window.location.replace('./index.html');
        return;
    }
    if (bootstrap.status && bootstrap.status !== 'success') {
        window.location.replace('./index.html');
        return;
    }

    applyBootstrapHeader(bootstrap);

    const statusEl = document.getElementById('apiStatus');
    const client = createLogtoClient();

    if (!(await client.isAuthenticated())) {
        window.location.replace('./index.html');
        return;
    }

    const { start, end } = monthRangeStrings();
    if (statusEl) statusEl.textContent = 'Loading…';

    try {
        const data = await fetchFinanceDashboardJson(client, start, end);
        setInsightsFooter(data?.insights_footer || '');

        if (data.ai_status === 'DATA_MISSING') {
            if (statusEl) statusEl.textContent = '';
            render.showDataMissingState();
            return;
        }

        if (statusEl) statusEl.textContent = '';

        render.renderMetrics(data);
        render.renderTrendChart(data);
        render.renderBreakdownChart(data);

        if (data.ai_status === 'Offline') {
            render.showOfflineBanner('AI forecasting offline. Showing available historical data.');
        } else {
            render.renderForecastChart(data);
            render.renderRecommendations(data);
        }
        render.renderHighExpenseAlerts(data);
    } catch (e) {
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

main();
