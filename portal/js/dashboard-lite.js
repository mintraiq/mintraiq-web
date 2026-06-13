/**
 * LITE_MINIMUM — blurred forecast lock + influence_hooks CTA.
 */
import { shouldShowHungryMintrBucket } from './data-level-progress.js';
import { mountHungryMintrBucket } from './hungry-mintr-bucket.js';

/**
 * @param {Record<string, unknown>} data
 * @param {typeof import('./dashboard-render.js')} render
 */
export function renderLiteMinimum(data, render) {
    const hooks = data?.influence_hooks || {};
    const monthly = data?.monthly || {};
    const pct = hooks.unlock_percentage ?? 0;
    const message =
        hooks.message ||
        `Unlock your 12-month forecast. You have completed ${pct}% of your profile history tracker.`;

    const lock = document.getElementById('liteForecastLock');
    const msgEl = document.getElementById('liteUnlockMessage');
    const pctEl = document.getElementById('liteUnlockPct');
    const cta = document.getElementById('liteUnlockCta');
    const avgExp = document.getElementById('liteAvgExpense');
    const avgInc = document.getElementById('liteAvgIncome');
    const cats = document.getElementById('liteTopCategories');

    if (lock) lock.hidden = false;
    const bucketHost = lock?.querySelector('[data-hungry-mintr-host]');
    const txnMonths = Number(data?.coverage?.txn_months ?? 0);
    if (bucketHost instanceof HTMLElement) {
        if (shouldShowHungryMintrBucket(txnMonths)) {
            mountHungryMintrBucket(bucketHost, { fillPercent: pct, txnMonths, variant: 'compact' });
        } else {
            bucketHost.innerHTML = '';
            bucketHost.hidden = true;
        }
    }
    if (msgEl) msgEl.textContent = message;
    if (pctEl) pctEl.textContent = `${pct}%`;
    if (cta) {
        cta.textContent = hooks.cta_label || 'Drop Statement PDF or Connect Akahu Feed.';
        if (hooks.cta_href) cta.setAttribute('href', hooks.cta_href);
    }
    if (avgExp) {
        avgExp.textContent = formatMoney(monthly.historical_avg_expense);
    }
    if (avgInc) {
        avgInc.textContent = formatMoney(monthly.historical_avg_income);
    }
    if (cats) {
        cats.innerHTML = '';
        (monthly.top_categories || []).forEach((row) => {
            const li = document.createElement('li');
            li.textContent = `${row.category}: ${formatMoney(row.amount)}`;
            cats.appendChild(li);
        });
    }

    if ((data.recommendations || []).length) {
        render.renderRecommendations(data);
    }
}

function formatMoney(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return '—';
    return '$' + n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}
