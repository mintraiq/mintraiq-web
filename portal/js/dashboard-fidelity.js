/**
 * Fidelity-aware dashboard view router.
 */

const FULL_MODES = new Set([
    'NORMAL',
    'HYBRID_STANDARD',
    'LSTM_FULL',
    undefined,
    null,
]);

/**
 * @param {string} mode
 * @returns {'full'|'lite'|'receipt'|'cold'}
 */
export function resolveFidelityView(mode) {
    if (mode === 'LITE_MINIMUM') return 'lite';
    if (mode === 'RECEIPT_ONLY_INSIGHTS') return 'receipt';
    if (mode === 'COLD_START_ONBOARDING') return 'cold';
    if (FULL_MODES.has(mode) || !mode) return 'full';
    return 'full';
}

/**
 * @param {HTMLElement|null} grid
 * @param {'full'|'lite'|'receipt'|'cold'} view
 */
export function setDashboardLayoutVisibility(root, view) {
    const scope = root || document.querySelector('.main-content') || document;
    scope.querySelectorAll('[data-fidelity-view]').forEach((el) => {
        const allowed = (el.getAttribute('data-fidelity-view') || 'full').split(/\s+/);
        el.hidden = !allowed.includes(view);
    });
}

/**
 * @param {Record<string, unknown>} data
 * @param {typeof import('./dashboard-render.js')} render
 */
export function renderFidelityDashboard(data, render) {
    const mode = data?.fidelity_mode;
    const view = resolveFidelityView(mode);

    const main = document.querySelector('.main-content');
    setDashboardLayoutVisibility(main, view);

    if (data?.ai_status === 'DATA_MISSING') {
        render.showDataMissingState();
        return;
    }

    if (data?.ai_status === 'INSUFFICIENT_HISTORY') {
        const txnMonths = data?.coverage?.txn_months ?? 0;
        if (txnMonths > 1 && txnMonths < 12) {
            import('./dashboard-lite.js').then((lite) => lite.renderLiteMinimum(data, render));
            setDashboardLayoutVisibility(main, 'lite');
            return;
        }
        render.showLoadError(
            data?.message || 'Not enough transaction history for a full forecast yet.'
        );
        return;
    }

    if (view === 'lite') {
        import('./dashboard-lite.js').then((lite) => lite.renderLiteMinimum(data, render));
        return;
    }
    if (view === 'receipt') {
        import('./dashboard-receipt.js').then((rcpt) => rcpt.renderReceiptOnly(data, render));
        return;
    }
    if (view === 'cold') {
        import('./dashboard-receipt.js').then((rcpt) => rcpt.renderColdStart(data));
        return;
    }

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
}
