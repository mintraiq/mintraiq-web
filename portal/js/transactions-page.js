import { createLogtoClient } from './logto-client.js';
import { guardSession } from './guard-session.js';
import { financeApiFetch } from './api.js';
import { CONFIG } from './config.js';

/** @typedef {{ id: string, date: string, amount: number, description: string, category: string, needs_review: boolean, flag: string, type: string }} TxRow */

let /** @type {TxRow[]} */ allRows = [];
let /** @type {TxRow | null} */ selected = null;

function escapeHtml(s) {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/"/g, '&quot;');
}

function formatAmount(row) {
    const n = Number(row.amount);
    const abs = Math.abs(n);
    const fmt = new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(abs);
    const sign = row.type === 'credit' ? '+' : '−';
    return `${sign}${fmt}`;
}

function filteredRows() {
    const q = (document.getElementById('txSearch')?.value || '').trim().toLowerCase();
    const cat = document.getElementById('txCategory')?.value || '';
    const reviewOnly = document.getElementById('txReviewOnly')?.checked;

    return allRows.filter((r) => {
        if (reviewOnly && !r.needs_review) return false;
        if (cat && r.category !== cat) return false;
        if (!q) return true;
        const blob = `${r.description} ${r.category} ${r.date}`.toLowerCase();
        return blob.includes(q);
    });
}

function renderTable() {
    const tbody = document.querySelector('#txTable tbody');
    if (!tbody) return;
    const rows = filteredRows();
    tbody.textContent = '';
    const countEl = document.getElementById('txCount');
    if (countEl) countEl.textContent = `${rows.length} shown · ${allRows.length} total`;

    if (!rows.length) {
        const tr = document.createElement('tr');
        const td = document.createElement('td');
        td.colSpan = 7;
        td.style.cssText = 'text-align:center;padding:28px;color:var(--text-secondary)';
        td.textContent = allRows.length ? 'No rows match your filters.' : 'No transactions returned.';
        tr.appendChild(td);
        tbody.appendChild(tr);
        return;
    }

    for (const r of rows) {
        const tr = document.createElement('tr');
        tr.style.cursor = 'pointer';
        if (selected && selected.id === r.id) tr.classList.add('tx-row-selected');
        tr.dataset.id = r.id;
        const cells = [
            r.date,
            formatAmount(r),
            r.description,
            r.category,
            r.flag || '—',
            r.needs_review ? 'Yes' : 'No',
            r.type || '—'
        ];
        cells.forEach((c, i) => {
            const td = document.createElement('td');
            td.textContent = c;
            if (i === 1) td.className = 'align-right';
            tr.appendChild(td);
        });
        tr.addEventListener('click', () => {
            selected = r;
            document.querySelectorAll('#txTable tbody tr').forEach((el) => el.classList.remove('tx-row-selected'));
            tr.classList.add('tx-row-selected');
            renderDetail();
        });
        tbody.appendChild(tr);
    }
}

function renderDetail() {
    const panel = document.getElementById('txDetail');
    if (!panel) return;
    if (!selected) {
        panel.style.display = 'none';
        panel.innerHTML = '';
        return;
    }
    panel.style.display = 'block';
    const r = selected;
    panel.innerHTML =
        '<div class="card-header"><span class="card-title">Transaction detail</span></div>' +
        '<dl class="tx-detail-dl">' +
        `<dt>Date</dt><dd>${escapeHtml(r.date)}</dd>` +
        `<dt>Amount</dt><dd>${escapeHtml(formatAmount(r))}</dd>` +
        `<dt>Type</dt><dd>${escapeHtml(r.type || '—')}</dd>` +
        `<dt>Category</dt><dd>${escapeHtml(r.category || '—')}</dd>` +
        `<dt>Description</dt><dd>${escapeHtml(r.description || '—')}</dd>` +
        `<dt>Flag</dt><dd>${escapeHtml(r.flag || '—')}</dd>` +
        `<dt>Needs review</dt><dd>${r.needs_review ? 'Yes' : 'No'}</dd>` +
        `<dt>Id</dt><dd><code style="font-size:0.85rem">${escapeHtml(r.id)}</code></dd>` +
        '</dl>';
}

function fillCategoryOptions() {
    const sel = document.getElementById('txCategory');
    if (!sel) return;
    const cur = sel.value;
    const set = new Set();
    for (const r of allRows) {
        if (r.category) set.add(r.category);
    }
    const sorted = [...set].sort((a, b) => a.localeCompare(b));
    sel.innerHTML = '<option value="">All categories</option>';
    for (const c of sorted) {
        const opt = document.createElement('option');
        opt.value = c;
        opt.textContent = c;
        sel.appendChild(opt);
    }
    if ([...sel.options].some((o) => o.value === cur)) sel.value = cur;
}

async function loadTransactions(client) {
    const status = document.getElementById('txStatus');
    const errBox = document.getElementById('txError');
    if (errBox) {
        errBox.style.display = 'none';
        errBox.textContent = '';
    }
    if (status) status.textContent = 'Loading transactions…';

    const res = await financeApiFetch(client, '/transactions', { method: 'GET' });
    const text = await res.text();
    let data;
    try {
        data = text ? JSON.parse(text) : {};
    } catch {
        throw new Error(`Non-JSON response (${res.status}): ${text.slice(0, 200)}`);
    }

    if (!res.ok) {
        if (res.status === 401) {
            window.location.replace('./index.html');
            return;
        }
        const detail = data.detail;
        const msg =
            typeof detail === 'string'
                ? detail
                : Array.isArray(detail)
                  ? detail.map((d) => d.msg || JSON.stringify(d)).join('; ')
                  : data.message || `Request failed (${res.status})`;
        throw new Error(msg);
    }

    const list = data.transactions;
    allRows = Array.isArray(list) ? list : [];
    selected = null;
    fillCategoryOptions();
    renderTable();
    renderDetail();
    if (status) {
        const base = CONFIG.financeApiBase.replace(/\/$/, '');
        status.textContent = `Loaded from ${base}/transactions`;
    }
}

async function syncAkahu(client) {
    const btn = document.getElementById('txSyncAkahu');
    const hint = document.getElementById('txSyncHint');
    if (btn) btn.disabled = true;
    if (hint) hint.textContent = 'Syncing…';
    try {
        const res = await financeApiFetch(client, '/akahu/sync', { method: 'POST' });
        const text = await res.text();
        let data;
        try {
            data = text ? JSON.parse(text) : {};
        } catch {
            data = {};
        }
        if (!res.ok) {
            const detail = data.detail;
            const msg =
                typeof detail === 'string'
                    ? detail
                    : Array.isArray(detail)
                      ? detail.map((d) => d.msg || JSON.stringify(d)).join('; ')
                      : data.message || `Sync failed (${res.status})`;
            throw new Error(msg);
        }
        const msg = data.message || `OK (${data.count ?? 0} items)`;
        if (hint) hint.textContent = msg;
        await loadTransactions(client);
    } catch (e) {
        if (hint) hint.textContent = String(e.message || e);
    } finally {
        if (btn) btn.disabled = false;
    }
}

function wireFilters() {
    const rerender = () => {
        renderTable();
        if (selected && !filteredRows().some((r) => r.id === selected.id)) {
            selected = null;
            renderDetail();
        }
    };
    document.getElementById('txSearch')?.addEventListener('input', rerender);
    document.getElementById('txCategory')?.addEventListener('change', rerender);
    document.getElementById('txReviewOnly')?.addEventListener('change', rerender);
}

async function main() {
    if (!(await guardSession())) return;
    const client = createLogtoClient();

    document.getElementById('txReload')?.addEventListener('click', () => loadTransactions(client));
    document.getElementById('txSyncAkahu')?.addEventListener('click', () => syncAkahu(client));
    wireFilters();

    try {
        await loadTransactions(client);
    } catch (e) {
        console.error(e);
        const errBox = document.getElementById('txError');
        if (errBox) {
            errBox.style.display = 'block';
            errBox.textContent = String(e.message || e);
        }
        const status = document.getElementById('txStatus');
        if (status) status.textContent = '';
    }
}

main();
