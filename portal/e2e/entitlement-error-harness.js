/**
 * Playwright E2E harness — drives the production error path of the dashboard
 * fetch against a stubbed API response, so the entitlement states can be
 * asserted without a signed-in session or a live backend.
 *
 * URL: entitlement-error-harness.html?case=upgrade|limit|plain|server
 */
import { fetchFinanceDashboardJson } from '../js/finance-dashboard.js';
import * as render from '../js/dashboard-render.js';

const CASES = {
    // Shape sent by require_feature() in app/security/entitlements.py.
    upgrade: {
        status: 403,
        body: {
            detail: {
                error_code: 'UPGRADE_REQUIRED',
                message: 'Feature not available on current plan.',
                feature: '3m_dashboard',
            },
        },
    },
    // Shape sent by check_limit().
    limit: {
        status: 403,
        body: {
            detail: {
                error_code: 'LIMIT_EXCEEDED',
                limit_key: 'statement_uploads',
                limit: 3,
                usage: 3,
            },
        },
    },
    // FastAPI's plain string detail — must still read through unchanged.
    plain: { status: 400, body: { detail: 'start_date must precede end_date' } },
    // No detail at all — falls back to the status line.
    server: { status: 500, body: {} },
};

const params = new URLSearchParams(window.location.search);
const key = params.get('case') || 'upgrade';
const scenario = CASES[key];

const modeEl = document.getElementById('harnessMode');
const errEl = document.getElementById('harnessError');

// Stub the network and the token so the production module runs untouched.
window.fetch = async () =>
    new Response(JSON.stringify(scenario.body), {
        status: scenario.status,
        headers: { 'Content-Type': 'application/json' },
    });
const fakeClient = { getAccessToken: async () => 'harness-token' };

try {
    if (!scenario) throw new Error(`Unknown case: ${key}`);

    await fetchFinanceDashboardJson(fakeClient, '2026-08-01', '2026-08-31');
    throw new Error('Expected the request to reject, but it resolved.');
} catch (e) {
    document.body.dataset.errorCode = e.errorCode || '';
    document.body.dataset.errorMessage = e.message || '';
    document.body.dataset.errorStatus = String(e.status ?? '');
    if (modeEl) {
        modeEl.textContent = `case=${key} · status=${e.status} · error_code=${e.errorCode || '—'}`;
    }

    if (e.errorCode === 'UPGRADE_REQUIRED') {
        render.showUpgradeRequired(e.message);
    } else if (e.errorCode === 'LIMIT_EXCEEDED') {
        render.showLimitReached({ limitKey: e.limitKey, limit: e.limit, usage: e.usage });
    } else {
        render.showLoadError(e.message || e);
    }
    document.body.dataset.harnessReady = 'true';
    if (errEl && key === 'unexpected') {
        errEl.hidden = false;
        errEl.textContent = String(e);
    }
}
