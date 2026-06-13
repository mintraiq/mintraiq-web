import { createLogtoClient } from './logto-client.js';
import { guardSession } from './guard-session.js';
import { financeApiFetch } from './api.js';
import { renderReceiptLineItemsPanel } from './receipt-line-items.js';

/** @typedef {{ id: string, date: string, amount: number, description: string, category: string, needs_review: boolean, flag: string, type: string, receipt_id?: string | null }} TxRow */

let /** @type {TxRow[]} */ allRows = [];
let /** @type {TxRow | null} */ selected = null;
let /** @type {string[]} */ userCategoryVocabulary = [];
/** @type {Set<string>} */
let selectedReviewIds = new Set();
let currentClient = null;
let sortKey = 'date';
let sortDir = 'desc';
let currentPage = 1;
/** @type {'list' | 'categories'} */
let viewMode = 'list';
let expandedCategory = '';
let highlightedCategory = '';

const SPEND_EXCLUDE = new Set(['Income', 'Internal Transfers', 'Internal', 'Savings']);
const CATEGORY_COLORS = [
    '#00ff9d', '#2f80ed', '#bb6bd9', '#f2c94c', '#eb5757', '#56ccf2', '#6fcf97', '#9b51e0',
    '#f2994a', '#27ae60', '#e056fd', '#00d2ff', '#ff6b6b', '#4ecdc4', '#ffe66d'
];
const CATEGORY_ICONS = {
    Groceries: 'fa-basket-shopping',
    Dining: 'fa-utensils',
    'Dining Out': 'fa-utensils',
    Transport: 'fa-car',
    Rent: 'fa-house',
    Utilities: 'fa-bolt',
    'Mobile/Internet': 'fa-wifi',
    Fitness: 'fa-dumbbell',
    Entertainment: 'fa-film',
    Shopping: 'fa-bag-shopping',
    Health: 'fa-heart-pulse',
    Insurance: 'fa-shield-halved',
    Income: 'fa-arrow-trend-up',
    MISC: 'fa-ellipsis'
};

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

function formatMoney(n, { signed = false } = {}) {
    const val = Number(n);
    if (!Number.isFinite(val)) return '—';
    const fmt = new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(val));
    if (!signed) return `$${fmt}`;
    return val < 0 ? `−$${fmt}` : `+$${fmt}`;
}

function categoryColor(name, index = 0) {
    let hash = 0;
    for (let i = 0; i < String(name).length; i++) hash = (hash + String(name).charCodeAt(i) * (i + 1)) % CATEGORY_COLORS.length;
    return CATEGORY_COLORS[(hash + index) % CATEGORY_COLORS.length];
}

function categoryIcon(name) {
    if (CATEGORY_ICONS[name]) return CATEGORY_ICONS[name];
    const lower = String(name).toLowerCase();
    for (const [key, icon] of Object.entries(CATEGORY_ICONS)) {
        if (lower.includes(key.toLowerCase())) return icon;
    }
    return 'fa-tag';
}

function isSpendRow(r) {
    if (SPEND_EXCLUDE.has(r.category)) return false;
    return r.type !== 'credit';
}

function rowSpendAmount(r) {
    return Math.abs(Number(r.amount) || 0);
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

/** Filled by {@link buildFilteredPool} for table header counts (one filter pass). */
let lastTxFilterStats = { rawMatch: 0, uniqueBeforePage: 0, reviewOnly: false };

function getPageSize() {
    const n = Number(document.getElementById('txPageSize')?.value || 50);
    return Number.isFinite(n) && n > 0 ? n : 50;
}

function buildFilteredPool({ forDisplay = true } = {}) {
    const q = (document.getElementById('txSearch')?.value || '').trim().toLowerCase();
    const descQ = (document.getElementById('txDescription')?.value || '').trim().toLowerCase();
    const cat = document.getElementById('txCategory')?.value || '';
    const reviewOnly = Boolean(document.getElementById('txReviewOnly')?.checked);
    const { from, to } = normalizeDateRange(false);

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
    if (forDisplay && reviewOnly) {
        pool = dedupeReviewRows(sortedFiltered);
    } else if (!reviewOnly) {
        reviewIdToCanonicalId = new Map();
        reviewGroupSizeByCanonicalId = new Map();
    }
    lastTxFilterStats.uniqueBeforePage = pool.length;
    return pool;
}

function paginateRows(pool) {
    const pageSize = getPageSize();
    const totalPages = Math.max(1, Math.ceil(pool.length / pageSize));
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;
    const start = (currentPage - 1) * pageSize;
    return { rows: pool.slice(start, start + pageSize), totalPages, pageSize, total: pool.length, start };
}

function filteredRows() {
    return paginateRows(buildFilteredPool({ forDisplay: true })).rows;
}

function computeSpendSummary(pool) {
    let totalSpend = 0;
    let totalIncome = 0;
    let spendCount = 0;
    for (const r of pool) {
        const amt = rowSpendAmount(r);
        if (r.type === 'credit' || r.category === 'Income') {
            totalIncome += amt;
        } else if (isSpendRow(r)) {
            totalSpend += amt;
            spendCount += 1;
        }
    }
    return { totalSpend, totalIncome, spendCount, net: totalIncome - totalSpend };
}

function computeCategoryBreakdown(pool) {
    /** @type {Map<string, { total: number, count: number, rows: TxRow[] }>} */
    const map = new Map();
    for (const r of pool) {
        if (!isSpendRow(r)) continue;
        const cat = r.category || 'Uncategorized';
        const entry = map.get(cat) || { total: 0, count: 0, rows: [] };
        entry.total += rowSpendAmount(r);
        entry.count += 1;
        entry.rows.push(r);
        map.set(cat, entry);
    }
    const items = [...map.entries()]
        .map(([name, data]) => ({ name, ...data }))
        .sort((a, b) => b.total - a.total);
    const grandTotal = items.reduce((s, i) => s + i.total, 0);
    return { items, grandTotal };
}

function renderSpendHero() {
    const el = document.getElementById('txSpendHero');
    if (!el) return;
    const pool = buildFilteredPool({ forDisplay: false });
    const { totalSpend, totalIncome, spendCount, net } = computeSpendSummary(pool);
    const { items, grandTotal } = computeCategoryBreakdown(pool);
    const topCat = items[0];
    el.innerHTML =
        `<div class="tx-spend-stat" style="--tx-stat-accent:#00ff9d">` +
        `<div class="tx-spend-stat-label">Total spend</div>` +
        `<div class="tx-spend-stat-value">${formatMoney(totalSpend)}</div>` +
        `<div class="tx-spend-stat-sub">${spendCount} debit${spendCount === 1 ? '' : 's'} in range</div>` +
        `</div>` +
        `<div class="tx-spend-stat" style="--tx-stat-accent:#2f80ed">` +
        `<div class="tx-spend-stat-label">Income</div>` +
        `<div class="tx-spend-stat-value">${formatMoney(totalIncome)}</div>` +
        `<div class="tx-spend-stat-sub">Credits in filtered set</div>` +
        `</div>` +
        `<div class="tx-spend-stat" style="--tx-stat-accent:#bb6bd9">` +
        `<div class="tx-spend-stat-label">Net flow</div>` +
        `<div class="tx-spend-stat-value">${formatMoney(net, { signed: true })}</div>` +
        `<div class="tx-spend-stat-sub">${items.length} spending categor${items.length === 1 ? 'y' : 'ies'}</div>` +
        `</div>` +
        (topCat
            ? `<div class="tx-spend-stat" style="--tx-stat-accent:${categoryColor(topCat.name)}">` +
              `<div class="tx-spend-stat-label">Top category</div>` +
              `<div class="tx-spend-stat-value">${escapeHtml(topCat.name)}</div>` +
              `<div class="tx-spend-stat-sub">${formatMoney(topCat.total)} · ${grandTotal ? ((topCat.total / grandTotal) * 100).toFixed(1) : 0}% of spend</div>` +
              `</div>`
            : '');
}

function buildPageList(totalPages, page) {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages = new Set([1, totalPages, page, page - 1, page + 1, page - 2, page + 2]);
    const sorted = [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);
    const out = [];
    let prev = 0;
    for (const p of sorted) {
        if (p - prev > 1) out.push('…');
        out.push(p);
        prev = p;
    }
    return out;
}

function renderPagination(meta) {
    const nav = document.getElementById('txPagination');
    if (!nav) return;
    const { total, totalPages, pageSize, start } = meta;
    if (total === 0) {
        nav.innerHTML = '';
        return;
    }
    const end = Math.min(start + pageSize, total);
    const pages = buildPageList(totalPages, currentPage);
    const pageBtns = pages
        .map((p) => {
            if (p === '…') return '<span class="tx-page-ellipsis">…</span>';
            const active = p === currentPage ? ' is-active' : '';
            return `<button type="button" class="tx-page-btn${active}" data-page="${p}">${p}</button>`;
        })
        .join('');
    nav.innerHTML =
        `<span class="tx-pagination-info">Showing <strong>${start + 1}–${end}</strong> of <strong>${total}</strong> transaction${total === 1 ? '' : 's'}</span>` +
        `<div class="tx-pagination-controls">` +
        `<button type="button" class="tx-page-btn" data-page="first" ${currentPage <= 1 ? 'disabled' : ''} aria-label="First page"><i class="fas fa-angles-left"></i></button>` +
        `<button type="button" class="tx-page-btn" data-page="prev" ${currentPage <= 1 ? 'disabled' : ''} aria-label="Previous page"><i class="fas fa-angle-left"></i></button>` +
        pageBtns +
        `<button type="button" class="tx-page-btn" data-page="next" ${currentPage >= totalPages ? 'disabled' : ''} aria-label="Next page"><i class="fas fa-angle-right"></i></button>` +
        `<button type="button" class="tx-page-btn" data-page="last" ${currentPage >= totalPages ? 'disabled' : ''} aria-label="Last page"><i class="fas fa-angles-right"></i></button>` +
        `</div>`;
}

function renderDonut(items, grandTotal) {
    const panel = document.getElementById('txDonutPanel');
    if (!panel) return;
    if (!items.length || grandTotal <= 0) {
        panel.innerHTML = '<p style="color:var(--text-secondary);text-align:center;padding:24px">No spending data for current filters.</p>';
        return;
    }
    const radius = 82;
    const cx = 110;
    const cy = 110;
    const circumference = 2 * Math.PI * radius;
    let offset = 0;
    const segments = items.slice(0, 8).map((item, i) => {
        const pct = item.total / grandTotal;
        const len = pct * circumference;
        const color = categoryColor(item.name, i);
        const dash = `${len} ${circumference - len}`;
        const seg =
            `<circle class="tx-donut-segment${highlightedCategory === item.name ? ' is-highlight' : ''}" ` +
            `data-cat="${escapeHtml(item.name)}" cx="${cx}" cy="${cy}" r="${radius}" ` +
            `stroke="${color}" stroke-dasharray="${dash}" stroke-dashoffset="${-offset}" />`;
        offset += len;
        return seg;
    }).join('');
    const legend = items.slice(0, 8).map((item, i) => {
        const pct = ((item.total / grandTotal) * 100).toFixed(1);
        const active = highlightedCategory === item.name ? ' is-active' : '';
        return (
            `<button type="button" class="tx-donut-legend-item${active}" data-cat="${escapeHtml(item.name)}">` +
            `<span class="tx-donut-swatch" style="background:${categoryColor(item.name, i)}"></span>` +
            `<span style="flex:1">${escapeHtml(item.name)}</span>` +
            `<span>${pct}%</span>` +
            `</button>`
        );
    }).join('');
    panel.innerHTML =
        `<svg class="tx-donut-svg" viewBox="0 0 220 220" role="img" aria-label="Spend breakdown donut chart">` +
        `<circle cx="${cx}" cy="${cy}" r="${radius}" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="28" />` +
        segments +
        `<g class="tx-donut-center" transform="translate(${cx}, ${cy})">` +
        `<text class="tx-donut-center-label" y="-6">Total spend</text>` +
        `<text class="tx-donut-center-value" y="14">${formatMoney(grandTotal)}</text>` +
        `</g>` +
        `</svg>` +
        `<div class="tx-donut-legend">${legend}</div>`;
}

function renderCategoryGrid(items, grandTotal) {
    const grid = document.getElementById('txCategoryGrid');
    if (!grid) return;
    if (!items.length) {
        grid.innerHTML = '<p style="color:var(--text-secondary)">No categories to show.</p>';
        return;
    }
    grid.innerHTML = items.map((item, i) => {
        const pct = grandTotal ? (item.total / grandTotal) * 100 : 0;
        const color = categoryColor(item.name, i);
        const expanded = expandedCategory === item.name;
        return (
            `<article class="tx-cat-card${expanded ? ' is-expanded' : ''}" data-cat="${escapeHtml(item.name)}" tabindex="0" role="button" aria-expanded="${expanded}">` +
            `<div class="tx-cat-card-top">` +
            `<div class="tx-cat-card-left">` +
            `<span class="tx-cat-icon" style="background:${color}22;color:${color}"><i class="fas ${categoryIcon(item.name)}"></i></span>` +
            `<div><div class="tx-cat-name">${escapeHtml(item.name)}</div><div class="tx-cat-meta">${item.count} transaction${item.count === 1 ? '' : 's'}</div></div>` +
            `</div>` +
            `<span class="tx-cat-amount">${formatMoney(item.total)}</span>` +
            `</div>` +
            `<div class="tx-cat-bar-track"><div class="tx-cat-bar-fill" style="width:${pct.toFixed(1)}%;background:linear-gradient(90deg,${color},${color}99)"></div></div>` +
            `<div class="tx-cat-pct">${pct.toFixed(1)}% of filtered spend</div>` +
            `</article>`
        );
    }).join('');
}

function renderCategoryDrill(item) {
    const drill = document.getElementById('txCategoryDrill');
    if (!drill) return;
    if (!item) {
        drill.hidden = true;
        drill.innerHTML = '';
        return;
    }
    drill.hidden = false;
    const preview = item.rows.slice(0, 8);
    const rows = preview.map((r) =>
        `<div class="tx-drill-row" data-id="${escapeHtml(r.id)}" role="button" tabindex="0">` +
        `<span class="tx-drill-row-date">${escapeHtml(r.date)}</span>` +
        `<span class="tx-drill-row-desc">${escapeHtml(r.description)}</span>` +
        `<span class="tx-drill-row-amt">${formatAmount(r)}</span>` +
        `</div>`
    ).join('');
    drill.innerHTML =
        `<div class="tx-drill-head">` +
        `<span class="tx-drill-title">${escapeHtml(item.name)} · ${formatMoney(item.total)}</span>` +
        `<div class="tx-drill-actions">` +
        `<button type="button" class="tx-drill-btn" data-drill-action="list"><i class="fas fa-list"></i> View all in list</button>` +
        `<button type="button" class="tx-drill-btn" data-drill-action="close"><i class="fas fa-xmark"></i> Close</button>` +
        `</div>` +
        `</div>` +
        `<div class="tx-drill-list">${rows}</div>` +
        (item.rows.length > 8 ? `<p style="margin:10px 0 0;font-size:0.82rem;color:var(--text-secondary)">+ ${item.rows.length - 8} more — use “View all in list” for full pagination.</p>` : '');
}

function renderCategoryView() {
    const pool = buildFilteredPool({ forDisplay: false });
    const { items, grandTotal } = computeCategoryBreakdown(pool);
    renderDonut(items, grandTotal);
    renderCategoryGrid(items, grandTotal);
    const active = items.find((i) => i.name === expandedCategory);
    renderCategoryDrill(active || null);
}

function setViewMode(mode) {
    viewMode = mode;
    const listCard = document.getElementById('txListCard');
    const catPanel = document.getElementById('txCategoryPanel');
    document.querySelectorAll('.tx-view-tab').forEach((tab) => {
        const isActive = tab.getAttribute('data-view') === mode;
        tab.classList.toggle('is-active', isActive);
        tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });
    if (listCard) listCard.hidden = mode !== 'list';
    if (catPanel) catPanel.hidden = mode !== 'categories';
    renderSpendHero();
    if (mode === 'categories') renderCategoryView();
    else renderTable();
}

function drillToCategoryList(category) {
    const sel = document.getElementById('txCategory');
    if (sel) sel.value = category;
    expandedCategory = '';
    highlightedCategory = '';
    currentPage = 1;
    setViewMode('list');
    renderSpendHero();
}

function toggleCategoryDrill(name) {
    expandedCategory = expandedCategory === name ? '' : name;
    highlightedCategory = expandedCategory;
    renderCategoryView();
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
        (r.receipt_id
            ? '<button type="button" class="btn-primary" id="txReceiptBtn" style="background:rgba(0,255,157,0.15);color:var(--accent-green);border:1px solid rgba(0,255,157,0.35)"><i class="fas fa-receipt"></i> Receipt items</button>'
            : '') +
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
    const pool = buildFilteredPool({ forDisplay: true });
    const meta = paginateRows(pool);
    const rows = meta.rows;
    const { rawMatch, uniqueBeforePage, reviewOnly } = lastTxFilterStats;
    renderSpendHero();
    renderPagination(meta);
    tbody.textContent = '';
    const countEl = document.getElementById('txCount');
    const subEl = document.getElementById('txCountSub');
    if (countEl) {
        if (reviewOnly && rawMatch > uniqueBeforePage) {
            countEl.textContent = `Page ${currentPage} · ${uniqueBeforePage} unique · ${rawMatch} need review · ${allRows.length} loaded`;
        } else if (reviewOnly) {
            countEl.textContent = `Page ${currentPage} · ${rawMatch} need review · ${allRows.length} loaded`;
        } else {
            countEl.textContent = `Page ${currentPage} of ${meta.totalPages} · ${allRows.length} loaded`;
        }
    }
    if (subEl) {
        subEl.textContent = reviewOnly
            ? 'Select rows to mark correctly categorized items as reviewed (no training). Or open a row to change category.'
            : '';
    }

    syncReviewTableHeader(reviewOnly);
    updateBulkReviewBar(reviewOnly, rows);

    if (!rows.length) {
        const tr = document.createElement('tr');
        const td = document.createElement('td');
        td.colSpan = reviewOnly ? 8 : 7;
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

        if (reviewOnly) {
            const selectTd = document.createElement('td');
            selectTd.className = 'tx-select-col';
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.className = 'tx-row-check';
            cb.dataset.id = r.id;
            cb.checked = selectedReviewIds.has(r.id);
            cb.addEventListener('click', (ev) => ev.stopPropagation());
            cb.addEventListener('change', () => {
                if (cb.checked) selectedReviewIds.add(r.id);
                else selectedReviewIds.delete(r.id);
                updateBulkReviewBar(true, rows);
            });
            selectTd.appendChild(cb);
            tr.appendChild(selectTd);
        }

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

function allCategoryNames(current = '') {
    const set = new Set(userCategoryVocabulary);
    for (const r of allRows) if (r.category) set.add(r.category);
    if (current) set.add(current);
    return [...set].sort((a, b) => a.localeCompare(b));
}

function categoryOptionsHtml(current = '') {
    const sorted = allCategoryNames(current);
    const options = sorted
        .map((c) => `<option value="${escapeHtml(c)}"${c === current ? ' selected' : ''}>${escapeHtml(c)}</option>`)
        .join('');
    return options || `<option value="${escapeHtml(current || 'Uncategorized')}" selected>${escapeHtml(current || 'Uncategorized')}</option>`;
}

async function loadCategoryVocabulary(client) {
    try {
        const res = await financeApiFetch(client, '/users/category-vocabulary', { method: 'GET' });
        if (!res.ok) return;
        const data = await res.json();
        userCategoryVocabulary = Array.isArray(data.categories) ? data.categories : [];
    } catch {
        userCategoryVocabulary = [];
    }
}

function syncReviewTableHeader(reviewOnly) {
    const theadRow = document.querySelector('#txTable thead tr');
    if (!theadRow) return;
    let selectTh = theadRow.querySelector('.tx-select-col');
    if (reviewOnly && !selectTh) {
        selectTh = document.createElement('th');
        selectTh.className = 'tx-select-col';
        selectTh.innerHTML = '<input type="checkbox" class="tx-row-check" id="txHeaderSelectAll" title="Select all on this page">';
        theadRow.insertBefore(selectTh, theadRow.firstChild);
    } else if (!reviewOnly && selectTh) {
        selectTh.remove();
        selectedReviewIds.clear();
    }
}

/** @param {TxRow[]} pageRows */
function updateBulkReviewBar(reviewOnly, pageRows = []) {
    const bar = document.getElementById('txBulkReviewBar');
    const countEl = document.getElementById('txSelectedCount');
    const selectAll = /** @type {HTMLInputElement|null} */ (document.getElementById('txSelectAllReview'));
    const headerSelectAll = /** @type {HTMLInputElement|null} */ (document.getElementById('txHeaderSelectAll'));
    if (!bar) return;

    if (!reviewOnly) {
        bar.hidden = true;
        if (selectAll) selectAll.checked = false;
        if (headerSelectAll) headerSelectAll.checked = false;
        return;
    }

    bar.hidden = false;
    const pageIds = pageRows.map((r) => r.id);
    const selectedOnPage = pageIds.filter((id) => selectedReviewIds.has(id)).length;
    if (countEl) {
        countEl.textContent =
            selectedReviewIds.size === 0
                ? 'Select correctly categorized rows to clear review flags'
                : `${selectedReviewIds.size} selected${selectedOnPage < selectedReviewIds.size ? ` (${selectedOnPage} on this page)` : ''}`;
    }
    const allOnPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedReviewIds.has(id));
    if (selectAll) selectAll.checked = allOnPageSelected;
    if (headerSelectAll) headerSelectAll.checked = allOnPageSelected;
}

function setReviewSelectionForPage(pageRows, checked) {
    for (const r of pageRows) {
        if (checked) selectedReviewIds.add(r.id);
        else selectedReviewIds.delete(r.id);
    }
    updateBulkReviewBar(true, pageRows);
    renderTable();
}

async function bulkDismissSelected() {
    if (!currentClient || selectedReviewIds.size === 0) return;
    const btn = document.getElementById('txBulkDismiss');
    const count = selectedReviewIds.size;
    if (btn) btn.disabled = true;
    try {
        const res = await financeApiFetch(currentClient, '/transactions/review/dismiss', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                txn_ids: [...selectedReviewIds],
                update_similar: true,
                updated_by: 'portal-user'
            })
        });
        if (!res.ok) {
            const text = await res.text();
            throw new Error(text || `Bulk dismiss failed (${res.status})`);
        }
        selectedReviewIds.clear();
        await loadTransactions(currentClient, { reviewSaved: true });
        const status = document.getElementById('txStatus');
        if (status) status.textContent = `Cleared review flag on ${count} selection(s).`;
    } catch (e) {
        const status = document.getElementById('txStatus');
        if (status) status.textContent = String(e.message || e);
    } finally {
        if (btn) btn.disabled = false;
    }
}

async function persistCustomCategory(client, name) {
    const trimmed = (name || '').trim();
    if (!trimmed) return trimmed;
    try {
        const res = await financeApiFetch(client, '/users/category-vocabulary', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: trimmed })
        });
        if (res.ok) {
            const data = await res.json();
            userCategoryVocabulary = Array.isArray(data.categories) ? data.categories : userCategoryVocabulary;
        } else if (!userCategoryVocabulary.includes(trimmed)) {
            userCategoryVocabulary = [...userCategoryVocabulary, trimmed].sort((a, b) => a.localeCompare(b));
        }
    } catch {
        if (!userCategoryVocabulary.includes(trimmed)) {
            userCategoryVocabulary = [...userCategoryVocabulary, trimmed].sort((a, b) => a.localeCompare(b));
        }
    }
    return trimmed;
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

async function openReceiptPanel() {
    const inlinePanel = getInlinePanel();
    if (!inlinePanel || !selected?.receipt_id) return;
    inlinePanel.style.display = 'block';
    inlinePanel.innerHTML = '<p style="color:var(--text-secondary)">Loading receipt items…</p>';
    try {
        const res = await financeApiFetch(currentClient, `/v1/receipts/${encodeURIComponent(selected.receipt_id)}`, {
            method: 'GET'
        });
        const text = await res.text();
        let data = {};
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
                    : data.message || `Receipt fetch failed (${res.status})`;
            throw new Error(msg);
        }
        inlinePanel.innerHTML = `<div class="tx-inline-title">Linked receipt</div>${renderReceiptLineItemsPanel(data)}`;
    } catch (e) {
        inlinePanel.innerHTML = `<p style="color:#ffb4b4" data-testid="receipt-panel-error">${escapeHtml(String(e.message || e))}</p>`;
    }
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
    const datalist = allCategoryNames(selected.category)
        .map((c) => `<option value="${escapeHtml(c)}"></option>`)
        .join('');
    inlinePanel.innerHTML =
        '<div class="tx-inline-title">Review transaction</div>' +
        '<div class="tx-review-grid">' +
        `<label>Category<select id="txReviewCategory" class="form-control">${categoryOptionsHtml(selected.category)}</select></label>` +
        '<label>Or add new category<input type="text" id="txReviewNewCategory" class="form-control" placeholder="e.g. Subscriptions" list="txCategoryDatalist" autocomplete="off"></label>' +
        `<datalist id="txCategoryDatalist">${datalist}</datalist>` +
        '<label style="display:flex;align-items:center;gap:8px;margin-top:8px"><input type="checkbox" id="txReviewTraining" checked> Include in AI training</label>' +
        '</div>' +
        '<div class="tx-review-actions">' +
        '<button type="button" class="btn-primary" id="txReviewSave"><i class="fas fa-floppy-disk"></i> Update</button>' +
        '<span id="txReviewMsg" style="color:var(--text-secondary);font-size:0.88rem"></span>' +
        '</div>';
}

async function saveReviewFromPanel() {
    if (!selected || !currentClient) return;
    const msg = document.getElementById('txReviewMsg');
    const newCategoryInput = /** @type {HTMLInputElement|null} */ (document.getElementById('txReviewNewCategory'));
    const newCategoryRaw = (newCategoryInput?.value || '').trim();
    const selectCategory = /** @type {HTMLSelectElement|null} */ (document.getElementById('txReviewCategory'))?.value || '';
    let category = newCategoryRaw || selectCategory || selected.category;
    if (newCategoryRaw) {
        category = await persistCustomCategory(currentClient, newCategoryRaw);
    }
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
    const sorted = allCategoryNames(cur);
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
    currentPage = 1;
    expandedCategory = '';
    highlightedCategory = '';
    updateSortIndicators();
    normalizeDateRange(true);
    if (viewMode === 'categories') renderCategoryView();
    else renderTable();
    renderSpendHero();
    if (selected && !buildFilteredPool().some((r) => r.id === canonicalReviewRowId(selected.id))) {
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
    currentPage = 1;
    renderSpendHero();
    if (viewMode === 'categories') renderCategoryView();
    else renderTable();
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
        currentPage = 1;
        renderSpendHero();
        if (viewMode === 'categories') renderCategoryView();
        else renderTable();
        updateSortIndicators();
        if (selected && !buildFilteredPool().some((r) => r.id === canonicalReviewRowId(selected.id))) {
            selected = null;
        }
    };
    document.getElementById('txSearch')?.addEventListener('input', rerender, { signal });
    document.getElementById('txDescription')?.addEventListener('input', rerender, { signal });
    document.getElementById('txCategory')?.addEventListener('change', rerender, { signal });
    document.getElementById('txReviewOnly')?.addEventListener('change', () => {
        if (!document.getElementById('txReviewOnly')?.checked) selectedReviewIds.clear();
        rerender();
    }, { signal });
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
function wirePagination(signal) {
    document.getElementById('txPagination')?.addEventListener('click', (e) => {
        const btn = e.target instanceof Element ? e.target.closest('[data-page]') : null;
        if (!btn || btn.disabled) return;
        const pool = buildFilteredPool({ forDisplay: true });
        const { totalPages } = paginateRows(pool);
        const action = btn.getAttribute('data-page');
        if (action === 'first') currentPage = 1;
        else if (action === 'prev') currentPage = Math.max(1, currentPage - 1);
        else if (action === 'next') currentPage = Math.min(totalPages, currentPage + 1);
        else if (action === 'last') currentPage = totalPages;
        else currentPage = Number(action) || 1;
        selected = null;
        renderTable();
    }, { signal });
}

/**
 * @param {AbortSignal} [signal]
 */
function wireCategoryView(signal) {
    document.getElementById('txViewList')?.addEventListener('click', () => setViewMode('list'), { signal });
    document.getElementById('txViewCategories')?.addEventListener('click', () => setViewMode('categories'), { signal });

    const onCategoryPick = (target) => {
        const el = target instanceof Element ? target.closest('[data-cat]') : null;
        if (!el) return;
        const cat = el.getAttribute('data-cat');
        if (!cat) return;
        toggleCategoryDrill(cat);
    };

    document.getElementById('txDonutPanel')?.addEventListener('click', (e) => onCategoryPick(e.target), { signal });
    document.getElementById('txCategoryGrid')?.addEventListener('click', (e) => onCategoryPick(e.target), { signal });
    document.getElementById('txCategoryGrid')?.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        const card = e.target instanceof Element ? e.target.closest('.tx-cat-card') : null;
        if (!card) return;
        e.preventDefault();
        onCategoryPick(card);
    }, { signal });

    document.getElementById('txCategoryDrill')?.addEventListener('click', (e) => {
        const t = e.target;
        if (!(t instanceof Element)) return;
        if (t.closest('[data-drill-action="close"]')) {
            expandedCategory = '';
            highlightedCategory = '';
            renderCategoryView();
            return;
        }
        if (t.closest('[data-drill-action="list"]')) {
            drillToCategoryList(expandedCategory);
            return;
        }
        const row = t.closest('.tx-drill-row[data-id]');
        if (!row) return;
        const id = row.getAttribute('data-id');
        selected = allRows.find((r) => r.id === id) || null;
        drillToCategoryList(expandedCategory);
        renderTable();
    }, { signal });
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
        if (t.closest('#txReceiptBtn')) {
            e.preventDefault();
            await openReceiptPanel();
            return;
        }
        if (t.closest('#txReviewSave')) {
            e.preventDefault();
            await saveReviewFromPanel();
            return;
        }
        if (t.closest('.tx-row-check') || t.closest('#txHeaderSelectAll')) return;
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
 * @param {AbortSignal} [signal]
 */
function wireBulkReviewActions(signal) {
    const onSelectAll = (checked) => {
        const pool = buildFilteredPool({ forDisplay: true });
        const { rows } = paginateRows(pool);
        setReviewSelectionForPage(rows, checked);
    };

    document.getElementById('txBulkDismiss')?.addEventListener('click', () => void bulkDismissSelected(), { signal });
    document.getElementById('txSelectAllReview')?.addEventListener('change', (e) => {
        onSelectAll(/** @type {HTMLInputElement} */ (e.target).checked);
    }, { signal });

    document.querySelector('#txTable thead')?.addEventListener('change', (e) => {
        const t = e.target;
        if (!(t instanceof HTMLInputElement) || t.id !== 'txHeaderSelectAll') return;
        onSelectAll(t.checked);
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
    wirePagination(signal);
    wireCategoryView(signal);
    wireTableInteractions(signal);
    wireBulkReviewActions(signal);

    try {
        await loadCategoryVocabulary(client);
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
