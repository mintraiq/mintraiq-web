import { createLogtoClient } from './logto-client.js';
import { guardSession } from './guard-session.js';
import { financeApiFetch } from './api.js';
import { CONFIG } from './config.js';
import { claimPageScript } from './page-script-guard.js';

/** @typedef {{ id: string, date: string, amount: number, description: string, category: string, needs_review: boolean, flag: string, type: string }} TxRow */

let /** @type {TxRow[]} */ allRows = [];
let /** @type {TxRow | null} */ selected = null;
let currentClient = null;

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

function categoryOptionsHtml(current = '') {
    const set = new Set();
    for (const r of allRows) if (r.category) set.add(r.category);
    const sorted = [...set].sort((a, b) => a.localeCompare(b));
    const options = sorted
        .map((c) => `<option value="${escapeHtml(c)}"${c === current ? ' selected' : ''}>${escapeHtml(c)}</option>`)
        .join('');
    return options || `<option value="${escapeHtml(current || 'Uncategorized')}" selected>${escapeHtml(current || 'Uncategorized')}</option>`;
}

async function readEnquireSample() {
    const res = await fetch('../docs/samples/enquire_transaction.json', { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to load enquire sample.');
    return res.json();
}

async function fetchEnrichment(tx) {
    if (!currentClient) throw new Error('Not authenticated.');
    const payload = { transaction_id: tx.id, source: 'ANZ', query: tx.description };
    const attempts = ['/akahu/enquire', '/akahu/enrich'];
    for (const path of attempts) {
        try {
            const res = await financeApiFetch(currentClient, path, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const text = await res.text();
            const data = text ? JSON.parse(text) : {};
            if (res.ok) return { data, fromSample: false };
        } catch {
            // continue to fallback
        }
    }
    const sample = await readEnquireSample();
    return { data: sample, fromSample: true };
}

function renderEnquireResult(data, fromSample) {
    const firstItem = Array.isArray(data.items) ? data.items[0] : null;
    const best = firstItem && Array.isArray(firstItem.results) ? firstItem.results[0] : null;
    if (!best) return '<p style="color:var(--text-secondary)">No enrichment data found.</p>';

    const merchant = best.merchant || {};
    const outlet = best.outlet || {};
    const loc = (outlet.location || merchant.location || {});
    const coords = loc.coordinates || {};
    const lat = Number(coords.lat);
    const lon = Number(coords.lon);
    const mapEmbed =
        Number.isFinite(lat) && Number.isFinite(lon)
            ? `<iframe title="Location map" class="tx-map" loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="https://www.openstreetmap.org/export/embed.html?bbox=${lon - 0.01}%2C${lat - 0.01}%2C${lon + 0.01}%2C${lat + 0.01}&layer=mapnik&marker=${lat}%2C${lon}"></iframe>`
            : '';

    return (
        `<div class="tx-enquire-head">` +
        `<div class="tx-enquire-brand">` +
        `${merchant.logo ? `<img src="${escapeHtml(merchant.logo)}" alt="" class="tx-enquire-logo">` : '<span class="tx-enquire-logo-fallback"><i class="fas fa-store"></i></span>'}` +
        `<div><h4>${escapeHtml(outlet.name || merchant.name || 'Merchant')}</h4><p>${escapeHtml(best.category?.name || 'Uncategorized')}</p></div>` +
        `</div>` +
        `<span class="tx-confidence">confidence ${(Number(best.confidence || 0) * 100).toFixed(0)}%</span>` +
        `</div>` +
        `<div class="tx-enquire-meta">` +
        `${merchant.website ? `<p><i class="fas fa-globe"></i> <a href="${escapeHtml(merchant.website)}" target="_blank" rel="noopener">${escapeHtml(merchant.website)}</a></p>` : ''}` +
        `${outlet.phone || merchant.phone ? `<p><i class="fas fa-phone"></i> ${escapeHtml(outlet.phone || merchant.phone)}</p>` : ''}` +
        `${loc.formatted ? `<p><i class="fas fa-location-dot"></i> ${escapeHtml(loc.formatted)}</p>` : ''}` +
        `</div>` +
        mapEmbed +
        `${fromSample ? '<p class="tx-sample-note">Showing sample Akahu response (API fallback).</p>' : ''}`
    );
}

function markReviewed(txId, nextCategory) {
    const idx = allRows.findIndex((r) => r.id === txId);
    if (idx === -1) return;
    allRows[idx].category = nextCategory;
    allRows[idx].needs_review = false;
    allRows[idx].flag = '✅';
    selected = allRows[idx];
    fillCategoryOptions();
    renderTable();
    renderDetail();
    const rowEl = document.querySelector(`#txTable tbody tr[data-id="${CSS.escape(txId)}"]`);
    if (rowEl) {
        rowEl.classList.add('tx-row-reviewed');
        window.setTimeout(() => rowEl.classList.remove('tx-row-reviewed'), 1800);
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
        '<div class="tx-detail-actions">' +
        '<button type="button" class="btn-primary" id="txReviewBtn"><i class="fas fa-check-circle"></i> Review</button>' +
        '<button type="button" class="btn-primary" id="txEnquireBtn" style="background:linear-gradient(135deg,#bb6bd9,#2f80ed);color:#fff"><i class="fas fa-magnifying-glass"></i> Enquire</button>' +
        '</div>' +
        '<dl class="tx-detail-dl">' +
        `<dt>Date</dt><dd>${escapeHtml(r.date)}</dd>` +
        `<dt>Amount</dt><dd>${escapeHtml(formatAmount(r))}</dd>` +
        `<dt>Type</dt><dd>${escapeHtml(r.type || '—')}</dd>` +
        `<dt>Category</dt><dd>${escapeHtml(r.category || '—')}</dd>` +
        `<dt>Description</dt><dd>${escapeHtml(r.description || '—')}</dd>` +
        `<dt>Flag</dt><dd>${escapeHtml(r.flag || '—')}</dd>` +
        `<dt>Needs review</dt><dd>${r.needs_review ? 'Yes' : 'No'}</dd>` +
        `<dt>Id</dt><dd><code style="font-size:0.85rem">${escapeHtml(r.id)}</code></dd>` +
        '</dl>' +
        '<div id="txInlinePanel" class="tx-inline-panel" style="display:none"></div>';

    const inlinePanel = document.getElementById('txInlinePanel');
    const enquireBtn = document.getElementById('txEnquireBtn');
    const reviewBtn = document.getElementById('txReviewBtn');

    enquireBtn?.addEventListener('click', async () => {
        if (!inlinePanel || !selected) return;
        inlinePanel.style.display = 'block';
        inlinePanel.innerHTML = '<p style="color:var(--text-secondary)">Fetching Akahu enrichment…</p>';
        try {
            const { data, fromSample } = await fetchEnrichment(selected);
            inlinePanel.innerHTML = `<div class="tx-inline-title">Transaction enrichment</div>${renderEnquireResult(data, fromSample)}`;
        } catch (e) {
            inlinePanel.innerHTML = `<p style="color:#ffb4b4">${escapeHtml(String(e.message || e))}</p>`;
        }
    });

    reviewBtn?.addEventListener('click', () => {
        if (!inlinePanel || !selected) return;
        inlinePanel.style.display = 'block';
        inlinePanel.innerHTML =
            '<div class="tx-inline-title">Review transaction</div>' +
            '<div class="tx-review-grid">' +
            `<label>Category<select id="txReviewCategory" class="form-control">${categoryOptionsHtml(selected.category)}</select></label>` +
            '<label style="display:flex;align-items:center;gap:8px;margin-top:22px"><input type="checkbox" id="txReviewTraining" checked> training_required</label>' +
            '</div>' +
            '<div class="tx-review-actions">' +
            '<button type="button" class="btn-primary" id="txReviewSave"><i class="fas fa-floppy-disk"></i> Update</button>' +
            '<span id="txReviewMsg" style="color:var(--text-secondary);font-size:0.88rem"></span>' +
            '</div>';

        document.getElementById('txReviewSave')?.addEventListener('click', async () => {
            const msg = document.getElementById('txReviewMsg');
            const category = /** @type {HTMLSelectElement|null} */ (document.getElementById('txReviewCategory'))?.value || selected.category;
            const trainingRequired = Boolean(document.getElementById('txReviewTraining')?.checked);
            const payload = {
                txn_id: selected.id,
                category_value: category,
                training_required: trainingRequired,
                updated_by: 'portal-user',
                updated_at: new Date().toISOString()
            };
            if (msg) msg.textContent = 'Updating…';
            try {
                const res = await financeApiFetch(currentClient, '/transactions/review', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                if (!res.ok) {
                    const text = await res.text();
                    throw new Error(text || `Review update failed (${res.status})`);
                }
                markReviewed(selected.id, category);
                if (msg) msg.textContent = 'Updated and marked reviewed.';
            } catch (e) {
                if (msg) msg.textContent = String(e.message || e);
            }
        });
    });
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
    if (!claimPageScript('transactions-main')) return;
    if (!(await guardSession())) return;
    const client = createLogtoClient();
    currentClient = client;

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
