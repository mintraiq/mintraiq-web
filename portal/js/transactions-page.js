import { createLogtoClient } from './logto-client.js';
import { guardSession } from './guard-session.js';
import { financeApiFetch } from './api.js';

/** @typedef {{ id: string, date: string, amount: number, description: string, category: string, needs_review: boolean, flag: string, type: string }} TxRow */

let /** @type {TxRow[]} */ allRows = [];
let /** @type {TxRow | null} */ selected = null;
let currentClient = null;
let sortKey = 'date';
let sortDir = 'desc';

/** When "Needs review only" is on: map every row id → canonical (first-in-sort) id for that similarity group. */
let reviewIdToCanonicalId = new Map();
/** Canonical id → number of rows in group (≥1). */
let reviewGroupSizeByCanonicalId = new Map();

function toIsoDate(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function monthStart(isoDate) {
    if (!isoDate || isoDate.length < 7) return '';
    return `${isoDate.slice(0, 7)}-01`;
}

function setDefaultDateRange() {
    const fromEl = document.getElementById('txDateFrom');
    const toEl = document.getElementById('txDateTo');
    if (!(fromEl instanceof HTMLInputElement) || !(toEl instanceof HTMLInputElement)) return;
    if (fromEl.value && toEl.value) return;
    const now = new Date();
    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
    fromEl.value = toIsoDate(threeMonthsAgo);
    toEl.value = toIsoDate(now);
}

function normalizeDateRange(applyToInputs = false) {
    const fromEl = document.getElementById('txDateFrom');
    const toEl = document.getElementById('txDateTo');
    let from = fromEl?.value || '';
    let to = toEl?.value || '';
    if (to && !from) {
        from = monthStart(to);
        if (applyToInputs && fromEl) fromEl.value = from;
    }
    return { from, to };
}

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

function confidenceScore(row) {
    if (row.flag === '✅') return 0.96;
    if (row.flag === '⚠️') return 0.72;
    if (row.flag === '❌') return 0.55;
    return row.needs_review ? 0.68 : 0.84;
}

function compareRows(a, b, key) {
    if (key === 'amount') return Number(a.amount || 0) - Number(b.amount || 0);
    if (key === 'needs_review') return Number(Boolean(a.needs_review)) - Number(Boolean(b.needs_review));
    const av = String(a[key] ?? '').toLowerCase();
    const bv = String(b[key] ?? '').toLowerCase();
    return av.localeCompare(bv);
}

function updateSortIndicators() {
    document.querySelectorAll('[data-sort-indicator]').forEach((el) => {
        const key = el.getAttribute('data-sort-indicator');
        if (key !== sortKey) {
            el.textContent = '';
            return;
        }
        el.textContent = sortDir === 'asc' ? '▲' : '▼';
    });
}

function normalizeDescriptionForGrouping(s) {
    return String(s || '')
        .trim()
        .replace(/\s+/g, ' ')
        .toLowerCase();
}

/** Same visible line ⇒ one row in "Needs review" triage (matches bulk update by description on the API). */
function reviewSimilarFingerprint(r) {
    const amt = Number(r.amount);
    const amtKey = Number.isFinite(amt) ? amt.toFixed(2) : String(r.amount ?? '');
    return `${String(r.date || '')}|${amtKey}|${normalizeDescriptionForGrouping(r.description)}|${String(r.category || '')}|${String(r.type || '')}`;
}

function dedupeReviewRows(sortedFiltered) {
    reviewIdToCanonicalId = new Map();
    reviewGroupSizeByCanonicalId = new Map();
    const fpToCanonicalId = new Map();
    const fpCount = new Map();
    for (const r of sortedFiltered) {
        const fp = reviewSimilarFingerprint(r);
        fpCount.set(fp, (fpCount.get(fp) || 0) + 1);
        if (!fpToCanonicalId.has(fp)) fpToCanonicalId.set(fp, r.id);
        reviewIdToCanonicalId.set(r.id, fpToCanonicalId.get(fp));
    }
    for (const [fp, canonId] of fpToCanonicalId) {
        reviewGroupSizeByCanonicalId.set(canonId, fpCount.get(fp) || 1);
    }
    const seenFp = new Set();
    const out = [];
    for (const r of sortedFiltered) {
        const fp = reviewSimilarFingerprint(r);
        if (seenFp.has(fp)) continue;
        seenFp.add(fp);
        out.push(r);
    }
    return out;
}

function canonicalReviewRowId(id) {
    if (!id) return id;
    return reviewIdToCanonicalId.get(id) || id;
}

/** Filled by {@link filteredRows} for table header counts (one filter pass). */
let lastTxFilterStats = { rawMatch: 0, uniqueBeforePage: 0, reviewOnly: false };

function filteredRows() {
    const q = (document.getElementById('txSearch')?.value || '').trim().toLowerCase();
    const descQ = (document.getElementById('txDescription')?.value || '').trim().toLowerCase();
    const cat = document.getElementById('txCategory')?.value || '';
    const reviewOnly = Boolean(document.getElementById('txReviewOnly')?.checked);
    const { from, to } = normalizeDateRange(false);
    const pageSize = Number(document.getElementById('txPageSize')?.value || 50);

    const sortedFiltered = allRows
        .slice()
        .sort((a, b) => {
            const r = compareRows(a, b, sortKey);
            return sortDir === 'asc' ? r : -r;
        })
        .filter((r) => {
            if (from && String(r.date) < from) return false;
            if (to && String(r.date) > to) return false;
            if (reviewOnly && !r.needs_review) return false;
            if (cat && r.category !== cat) return false;
            if (descQ && !String(r.description || '').toLowerCase().includes(descQ)) return false;
            if (!q) return true;
            const blob = `${r.description} ${r.category} ${r.date} ${r.type} ${r.flag}`.toLowerCase();
            return blob.includes(q);
        });

    lastTxFilterStats.reviewOnly = reviewOnly;
    lastTxFilterStats.rawMatch = sortedFiltered.length;

    let pool = sortedFiltered;
    if (reviewOnly) {
        pool = dedupeReviewRows(sortedFiltered);
    } else {
        reviewIdToCanonicalId = new Map();
        reviewGroupSizeByCanonicalId = new Map();
    }
    lastTxFilterStats.uniqueBeforePage = pool.length;

    if (!Number.isFinite(pageSize) || pageSize <= 0) return pool;
    return pool.slice(0, pageSize);
}

function selectedInlinePanelId() {
    return selected ? `txInlinePanel-${selected.id}` : '';
}

function renderExpandedRow(r) {
    const score = confidenceScore(r);
    return (
        `<tr class="tx-expanded-row" data-expand-row="1">` +
        `<td colspan="7">` +
        `<div class="tx-expand-wrap tx-expand-enter" data-expand-id="${escapeHtml(r.id)}">` +
        '<div class="tx-expand-header">' +
        '<span class="card-title">Transaction detail</span>' +
        '<button type="button" class="tx-expand-close" id="txExpandClose" aria-label="Close detail"><i class="fas fa-xmark"></i></button>' +
        '</div>' +
        '<div class="tx-detail-actions">' +
        '<button type="button" class="btn-primary" id="txReviewBtn"><i class="fas fa-check-circle"></i> Review</button>' +
        '<button type="button" class="btn-primary" id="txEnquireBtn" style="background:linear-gradient(135deg,#bb6bd9,#2f80ed);color:#fff"><i class="fas fa-magnifying-glass"></i> Enquire</button>' +
        '</div>' +
        '<dl class="tx-detail-dl">' +
        `<dt>Description</dt><dd>${escapeHtml(r.description || '—')}</dd>` +
        `<dt>Category</dt><dd>${escapeHtml(r.category || '—')}</dd>` +
        (() => {
            const n = reviewGroupSizeByCanonicalId.get(r.id) || 0;
            if (n <= 1) return '';
            return `<dt>Similar in list</dt><dd>${n} rows match this line (Review updates all with the same description on the server).</dd>`;
        })() +
        `<dt>Needs review</dt><dd>${r.needs_review ? 'Yes' : 'No'}</dd>` +
        `<dt>Confidence</dt><dd>${(score * 100).toFixed(0)}%</dd>` +
        `<dt>Id</dt><dd><code style="font-size:0.85rem">${escapeHtml(r.id)}</code></dd>` +
        '</dl>' +
        `<div id="${selectedInlinePanelId()}" class="tx-inline-panel" style="display:none"></div>` +
        '</div>' +
        '</td>' +
        '</tr>'
    );
}

function renderTable() {
    const tbody = document.querySelector('#txTable tbody');
    if (!tbody) return;
    const rows = filteredRows();
    const { rawMatch, uniqueBeforePage, reviewOnly } = lastTxFilterStats;
    tbody.textContent = '';
    const countEl = document.getElementById('txCount');
    const subEl = document.getElementById('txCountSub');
    if (countEl) {
        if (reviewOnly && rawMatch > uniqueBeforePage) {
            countEl.textContent = `${rows.length} shown · ${uniqueBeforePage} unique · ${rawMatch} need review · ${allRows.length} total`;
        } else if (reviewOnly) {
            countEl.textContent = `${rows.length} shown · ${rawMatch} need review · ${allRows.length} total`;
        } else {
            countEl.textContent = `${rows.length} shown · ${allRows.length} total`;
        }
    }
    if (subEl) {
        subEl.textContent =
            reviewOnly && rawMatch > uniqueBeforePage
                ? 'Similar rows are grouped. Open a row and use Review — updates still apply to every matching transaction (same as before).'
                : '';
    }

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
        if (selected && canonicalReviewRowId(selected.id) === r.id) tr.classList.add('tx-row-selected');
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
            if (i === 2 && reviewOnly) {
                const grp = reviewGroupSizeByCanonicalId.get(r.id) || 1;
                td.textContent = '';
                const main = document.createElement('span');
                main.textContent = c;
                td.appendChild(main);
                if (grp > 1) {
                    const badge = document.createElement('span');
                    badge.className = 'tx-similar-badge';
                    badge.textContent = `×${grp} similar`;
                    badge.title = `${grp} transactions share this line; one review updates the group.`;
                    td.appendChild(badge);
                }
            } else {
                td.textContent = c;
            }
            if (i === 1) td.className = 'align-right';
            tr.appendChild(td);
        });
        tbody.appendChild(tr);

        if (selected && canonicalReviewRowId(selected.id) === r.id) {
            const wrap = document.createElement('tbody');
            wrap.innerHTML = renderExpandedRow(r);
            tbody.appendChild(wrap.firstElementChild);
        }
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
    const text = await res.text();
    if (!text.trim()) return { success: false, items: [] };
    try {
        return JSON.parse(text);
    } catch {
        return { success: false, items: [] };
    }
}

async function fetchEnrichment(tx) {
    if (!currentClient) throw new Error('Not authenticated.');
    const payload = { transaction_id: tx.id, source: 'ANZ', query: tx.description };
    const attempts = ['/transactions/enquiry', '/transactions/enquiry'];
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

function collapseSelectedRow() {
    if (!selected) return;
    const wrap = document.querySelector('.tx-expand-wrap');
    if (!wrap) {
        selected = null;
        renderTable();
        return;
    }
    wrap.classList.add('is-closing');
    window.setTimeout(() => {
        selected = null;
        renderTable();
    }, 170);
}

function getInlinePanel() {
    const panelId = selectedInlinePanelId();
    return panelId ? document.getElementById(panelId) : null;
}

async function openEnquirePanel() {
    const inlinePanel = getInlinePanel();
    if (!inlinePanel || !selected) return;
    inlinePanel.style.display = 'block';
    inlinePanel.innerHTML = '<p style="color:var(--text-secondary)">Fetching Akahu enrichment…</p>';
    try {
        const { data, fromSample } = await fetchEnrichment(selected);
        inlinePanel.innerHTML = `<div class="tx-inline-title">Transaction enrichment</div>${renderEnquireResult(data, fromSample)}`;
    } catch (e) {
        inlinePanel.innerHTML = `<p style="color:#ffb4b4">${escapeHtml(String(e.message || e))}</p>`;
    }
}

function openReviewPanel() {
    const inlinePanel = getInlinePanel();
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
}

async function saveReviewFromPanel() {
    if (!selected) return;
    const msg = document.getElementById('txReviewMsg');
    const category = /** @type {HTMLSelectElement|null} */ (document.getElementById('txReviewCategory'))?.value || selected.category;
    const trainingRequired = Boolean(document.getElementById('txReviewTraining')?.checked);
    const payload = {
        txn_id: selected.id,
        category_value: category,
        training_required: trainingRequired,
        update_similar: true,
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
        await loadTransactions(currentClient, { reviewSaved: true });
    } catch (e) {
        if (msg) msg.textContent = String(e.message || e);
    }
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

function clearFiltersToDefault() {
    const setValue = (id, value) => {
        const el = document.getElementById(id);
        if (el && 'value' in el) el.value = value;
    };
    setValue('txSearch', '');
    setValue('txDescription', '');
    setValue('txCategory', '');
    setValue('txPageSize', '50');
    const reviewEl = document.getElementById('txReviewOnly');
    if (reviewEl instanceof HTMLInputElement) reviewEl.checked = false;
    const now = new Date();
    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
    setValue('txDateFrom', toIsoDate(threeMonthsAgo));
    setValue('txDateTo', toIsoDate(now));
    sortKey = 'date';
    sortDir = 'desc';
    updateSortIndicators();
    normalizeDateRange(true);
    renderTable();
    if (selected && !filteredRows().some((r) => r.id === canonicalReviewRowId(selected.id))) {
        selected = null;
    }
}

/** @param {{ reviewSaved?: boolean }} [opts] */
async function loadTransactions(client, opts = {}) {
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
    if (status) {
        const count = allRows.length;
        let t = count ? `${count} transaction${count === 1 ? '' : 's'} loaded` : '';
        if (opts.reviewSaved) t = t ? `${t} · Review saved` : 'Review saved';
        status.textContent = t;
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

/**
 * @param {AbortSignal} [signal]
 */
function wireFilters(signal) {
    const rerender = () => {
        normalizeDateRange(true);
        renderTable();
        updateSortIndicators();
        if (selected && !filteredRows().some((r) => r.id === canonicalReviewRowId(selected.id))) {
            selected = null;
        }
    };
    document.getElementById('txSearch')?.addEventListener('input', rerender, { signal });
    document.getElementById('txDescription')?.addEventListener('input', rerender, { signal });
    document.getElementById('txCategory')?.addEventListener('change', rerender, { signal });
    document.getElementById('txReviewOnly')?.addEventListener('change', rerender, { signal });
    document.getElementById('txDateFrom')?.addEventListener('change', rerender, { signal });
    document.getElementById('txDateTo')?.addEventListener(
        'change',
        () => {
            normalizeDateRange(true);
            rerender();
        },
        { signal }
    );
    document.getElementById('txPageSize')?.addEventListener('change', rerender, { signal });
    document.getElementById('txClearFilters')?.addEventListener('click', clearFiltersToDefault, { signal });
    document.querySelectorAll('.tx-sort-btn[data-sort-key]').forEach((btn) => {
        btn.addEventListener(
            'click',
            () => {
                const key = btn.getAttribute('data-sort-key') || 'date';
                if (sortKey === key) sortDir = sortDir === 'asc' ? 'desc' : 'asc';
                else {
                    sortKey = key;
                    sortDir = key === 'date' ? 'desc' : 'asc';
                }
                rerender();
            },
            { signal }
        );
    });
    updateSortIndicators();
}

/**
 * @param {AbortSignal} [signal]
 */
function wireTableInteractions(signal) {
    const tbody = document.querySelector('#txTable tbody');
    if (!tbody) return;
    tbody.addEventListener('click', async (e) => {
        const t = e.target;
        if (!(t instanceof Element)) return;

        if (t.closest('#txExpandClose')) {
            e.preventDefault();
            collapseSelectedRow();
            return;
        }
        if (t.closest('#txReviewBtn')) {
            e.preventDefault();
            openReviewPanel();
            return;
        }
        if (t.closest('#txEnquireBtn')) {
            e.preventDefault();
            await openEnquirePanel();
            return;
        }
        if (t.closest('#txReviewSave')) {
            e.preventDefault();
            await saveReviewFromPanel();
            return;
        }
        if (t.closest('tr[data-expand-row="1"]')) return;
        const tr = t.closest('tr[data-id]');
        if (!tr) return;
        const id = tr.getAttribute('data-id');
        if (!id) return;
        if (selected && canonicalReviewRowId(selected.id) === id) {
            collapseSelectedRow();
            return;
        }
        selected = allRows.find((r) => r.id === id) || null;
        renderTable();
    }, { signal });
}

/**
 * @param {{ signal?: AbortSignal }} [opts]
 */
export async function bootTransactionsPage(opts = {}) {
    const { signal } = opts;
    if (signal?.aborted) return;
    if (!(await guardSession())) return;
    if (signal?.aborted) return;
    const client = createLogtoClient();
    currentClient = client;

    document.getElementById('txReload')?.addEventListener('click', () => void loadTransactions(client), { signal });
    document.getElementById('txSyncAkahu')?.addEventListener('click', () => void syncAkahu(client), { signal });
    setDefaultDateRange();
    wireFilters(signal);
    wireTableInteractions(signal);

    try {
        await loadTransactions(client);
        if (signal?.aborted) return;
    } catch (e) {
        if (signal?.aborted) return;
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
