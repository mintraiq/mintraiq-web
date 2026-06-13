/**
 * RECEIPT_ONLY_INSIGHTS + COLD_START onboarding layouts.
 */

/** Primary actions for new users (no duplicate bank-connect CTAs on dashboard). */
const COLD_START_ACTIONS = [
    {
        id: 'upload_statement',
        title: 'Upload statement',
        description: 'Import a PDF or CSV bank statement.',
        cta_href: './upload-statement.html',
        icon: 'fa-file-upload'
    },
    {
        id: 'scan_receipt',
        title: 'Scan a receipt',
        description: 'Snap a receipt photo for line-item detail.',
        cta_href: './receipt-scanner.html',
        icon: 'fa-camera'
    }
];

/**
 * @param {Record<string, unknown>} data
 * @param {typeof import('./dashboard-render.js')} render
 */
export function renderReceiptOnly(data, render) {
    const summary = data?.receipt_summary || {};
    const prompt = data?.expansion_prompt || {};
    const banner = document.getElementById('receiptBankBanner');

    setText('receiptScanCount', summary.scanned_count_previous_month);
    setText('receiptTotalSpend', formatMoney(summary.total_receipt_spend));
    setText('receiptTaxDeductions', formatMoney(summary.projected_tax_deductions));

    if (banner) {
        banner.hidden = false;
        const title = banner.querySelector('[data-receipt-banner-title]');
        const body = banner.querySelector('[data-receipt-banner-body]');
        const link = banner.querySelector('[data-receipt-banner-cta]');
        if (title) title.textContent = prompt.title || 'Connect your bank';
        if (body) body.textContent = prompt.message || '';
        if (link) {
            link.textContent = prompt.cta_label || 'Connect bank account';
            if (prompt.cta_href) link.setAttribute('href', prompt.cta_href);
        }
    }

    if ((data.recommendations || []).length) {
        render.renderRecommendations(data);
    }
}

/** @param {Record<string, unknown>} data */
export function renderColdStart(data) {
    const banner = document.getElementById('receiptBankBanner');
    if (banner) banner.hidden = true;

    const list = document.getElementById('coldStartFlows');
    if (!list) return;
    list.innerHTML = '';

    coldStartActionsFor(data).forEach((flow) => {
        const link = document.createElement('a');
        link.className = 'cold-start-flow-tile';
        link.href = flow.cta_href || './upload-statement.html';
        link.innerHTML = `
            <span class="cold-start-flow-tile__icon" aria-hidden="true"><i class="fas ${escapeHtml(flow.icon || 'fa-arrow-right')}"></i></span>
            <span class="cold-start-flow-tile__title">${escapeHtml(flow.title)}</span>
            <span class="cold-start-flow-tile__desc">${escapeHtml(flow.description || '')}</span>`;
        list.appendChild(link);
    });
}

/**
 * Always surface upload + scan for cold start; ignore API bank-connect duplicates.
 * @param {Record<string, unknown>} data
 */
function coldStartActionsFor(data) {
    const blocked = /settings-banks|connect.?bank/i;
    const fromApi = (data.onboarding_flows || []).filter(
        (f) =>
            f &&
            typeof f === 'object' &&
            f.id !== 'connect_bank' &&
            !blocked.test(String(f.cta_href || '')) &&
            !blocked.test(String(f.title || ''))
    );

    if (fromApi.length >= 2) {
        return fromApi.slice(0, 2).map((f, i) => ({
            ...COLD_START_ACTIONS[i],
            ...f,
            title: f.title || COLD_START_ACTIONS[i].title,
            cta_href: f.cta_href || COLD_START_ACTIONS[i].cta_href
        }));
    }

    return COLD_START_ACTIONS;
}

function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value ?? '—';
}

function formatMoney(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return '—';
    return '$' + n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function escapeHtml(s) {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
