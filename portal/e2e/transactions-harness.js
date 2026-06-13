/**
 * Playwright harness — transaction rows + receipt drill-down without auth.
 * URL: transactions-harness.html?fixture=linked|empty|error
 */
import { renderReceiptLineItemsPanel } from '../js/receipt-line-items.js';

const FIXTURES = {
    linked: {
        list: '../../docs/samples/transactions-harness-linked.json',
        receipt: '../../docs/samples/receipt-detail-grocery.json'
    },
    empty: {
        list: '../../docs/samples/transactions-harness-empty.json'
    },
    error: null
};

const params = new URLSearchParams(window.location.search);
const fixture = params.get('fixture') || 'linked';
const modeEl = document.getElementById('harnessMode');
const errEl = document.getElementById('harnessError');
const txBody = document.getElementById('txBody');
const txExpanded = document.getElementById('txExpanded');
const txError = document.getElementById('txError');

/** @type {Array<Record<string, unknown>>} */
let rows = [];
/** @type {Record<string, unknown> | null} */
let receiptDetail = null;
let selectedId = '';

function escapeHtml(s) {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/"/g, '&quot;');
}

function renderRows() {
    if (!txBody) return;
    txBody.textContent = '';
    if (!rows.length) {
        const tr = document.createElement('tr');
        const td = document.createElement('td');
        td.colSpan = 4;
        td.setAttribute('data-testid', 'tx-empty-state');
        td.style.cssText = 'text-align:center;padding:24px;color:var(--text-secondary)';
        td.textContent = 'No transactions returned.';
        tr.appendChild(td);
        txBody.appendChild(tr);
        return;
    }
    for (const r of rows) {
        const tr = document.createElement('tr');
        tr.dataset.id = String(r.id);
        tr.style.cursor = 'pointer';
        tr.innerHTML =
            `<td>${escapeHtml(r.date)}</td>` +
            `<td>${Number(r.amount).toFixed(2)}</td>` +
            `<td>${escapeHtml(r.description)}</td>` +
            `<td>${r.receipt_id ? '<span data-testid="tx-receipt-badge">linked</span>' : '—'}</td>`;
        txBody.appendChild(tr);
    }
}

function renderExpanded() {
    if (!txExpanded) return;
    const row = rows.find((r) => String(r.id) === selectedId);
    if (!row) {
        txExpanded.hidden = true;
        return;
    }
    txExpanded.hidden = false;
    const hasReceipt = Boolean(row.receipt_id);
    txExpanded.innerHTML =
        '<div class="tx-expand-header"><span class="card-title">Transaction detail</span></div>' +
        '<div class="tx-detail-actions">' +
        '<button type="button" class="btn-primary" id="txReviewBtn" data-testid="tx-review-btn">Review</button>' +
        '<button type="button" class="btn-primary" id="txEnquireBtn" data-testid="tx-enquire-btn">Enquire</button>' +
        (hasReceipt
            ? '<button type="button" class="btn-primary" id="txReceiptBtn" data-testid="tx-receipt-btn">Receipt items</button>'
            : '') +
        '</div>' +
        `<dl class="tx-detail-dl"><dt>Description</dt><dd>${escapeHtml(row.description)}</dd></dl>` +
        '<div id="txInlinePanel" class="tx-inline-panel" data-testid="tx-inline-panel" style="display:none"></div>';
}

function showInlinePanel(html) {
    const panel = document.getElementById('txInlinePanel');
    if (!panel) return;
    panel.style.display = 'block';
    panel.innerHTML = html;
}

txBody?.addEventListener('click', (e) => {
    const tr = e.target instanceof Element ? e.target.closest('tr[data-id]') : null;
    if (!tr) return;
    selectedId = tr.getAttribute('data-id') || '';
    renderExpanded();
});

txExpanded?.addEventListener('click', (e) => {
    if (!(e.target instanceof Element)) return;
    if (e.target.closest('#txReviewBtn')) {
        showInlinePanel('<div class="tx-inline-title" data-testid="tx-review-panel">Review transaction</div><p>Category picker mock</p>');
        return;
    }
    if (e.target.closest('#txEnquireBtn')) {
        showInlinePanel('<div class="tx-inline-title" data-testid="tx-enquire-panel">Transaction enrichment</div><p>Enrichment mock</p>');
        return;
    }
    if (e.target.closest('#txReceiptBtn')) {
        const row = rows.find((r) => String(r.id) === selectedId);
        if (!row?.receipt_id) {
            showInlinePanel('<p data-testid="receipt-panel-error">No linked receipt.</p>');
            return;
        }
        if (!receiptDetail) {
            showInlinePanel('<p data-testid="receipt-panel-error">Receipt not found.</p>');
            return;
        }
        showInlinePanel(`<div class="tx-inline-title">Linked receipt</div>${renderReceiptLineItemsPanel(receiptDetail)}`);
    }
});

try {
    if (fixture === 'error') {
        throw new Error('Simulated API failure: transactions unavailable');
    }
    const spec = FIXTURES[fixture];
    if (!spec) {
        throw new Error(`Unknown fixture: ${fixture}`);
    }
    const listRes = await fetch(spec.list);
    if (!listRes.ok) throw new Error(`Failed to load ${spec.list}`);
    const listData = await listRes.json();
    rows = Array.isArray(listData.transactions) ? listData.transactions : [];
    if (spec.receipt) {
        const receiptRes = await fetch(spec.receipt);
        if (receiptRes.ok) receiptDetail = await receiptRes.json();
    }
    if (modeEl) modeEl.textContent = `fixture=${fixture} · rows=${rows.length}`;
    renderRows();
    document.body.dataset.harnessReady = 'true';
} catch (err) {
    if (errEl) {
        errEl.hidden = false;
        errEl.textContent = String(err?.message || err);
    }
    if (txError) {
        txError.hidden = false;
        txError.textContent = String(err?.message || err);
    }
    document.body.dataset.harnessReady = 'error';
    throw err;
}
