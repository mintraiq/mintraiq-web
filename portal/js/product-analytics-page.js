import { financeApiFetch } from './api.js';
import { createLogtoClient } from './logto-client.js';
import { guardSession } from './guard-session.js';
import {
    FEAT_PRODUCT_ANALYTICS,
    hasFeature,
    loadEntitlementProfile,
} from './entitlements.js';

const DEBOUNCE_MS = 300;
const DAYS_3M = 90;
const DAYS_6M = 180;
const SUGGESTIONS = ['milk', 'bread', 'eggs', 'butter', 'bananas'];
const STORE_COLORS = ['#00ff9d', '#ff4757', '#f1c40f', '#2f80ed', '#bb6bd9', '#ffb142'];
const CPI_COLOR = '#a0a0a0';

let chartInstance = null;
let debounceTimer = 0;
let searchAbort = null;
let selectedDaysWindow = DAYS_3M;

function escapeHtml(s) {
    return String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/"/g, '&quot;');
}

function storeColor(merchant, index) {
    const lower = String(merchant || '').toLowerCase();
    if (lower.includes('pak')) return '#00ff9d';
    if (lower.includes('countdown') || lower.includes('woolworths')) return '#ff4757';
    if (lower.includes('new world')) return '#f1c40f';
    return STORE_COLORS[index % STORE_COLORS.length];
}

function formatLabel(dateStr) {
    const d = new Date(`${dateStr}T00:00:00`);
    if (Number.isNaN(d.getTime())) return dateStr.slice(5);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function monthKey(dateStr) {
    return String(dateStr || '').slice(0, 7);
}

function setStatus(text) {
    const el = document.getElementById('pptStatus');
    if (el) el.textContent = text || '';
}

function setLoading(on) {
    const spinner = document.getElementById('pptSpinner');
    if (spinner) spinner.hidden = !on;
}

function syncWindowToggleButtons() {
    document.querySelectorAll('.ppt-window-btn').forEach((btn) => {
        const days = Number(btn.getAttribute('data-days'));
        btn.classList.toggle('is-active', days === selectedDaysWindow);
    });
}

function updateWindowToggle(data) {
    const root = document.getElementById('pptWindowToggle');
    if (!root) return;
    const show = data?.show_window_toggle !== false;
    root.hidden = !show;
    if (!show && selectedDaysWindow !== DAYS_3M) {
        selectedDaysWindow = DAYS_3M;
        syncWindowToggleButtons();
    }
}

function showPaywall(message) {
    hideAllResults();
    const paywall = document.getElementById('pptPaywall');
    const helper = document.getElementById('pptHelper');
    const searchWrap = document.querySelector('.ppt-search-wrap');
    const suggestions = document.getElementById('pptSuggestions');
    if (helper) helper.hidden = true;
    if (searchWrap) searchWrap.hidden = true;
    if (suggestions) suggestions.hidden = true;
    if (paywall) {
        if (message) {
            const p = paywall.querySelector('p');
            if (p) p.textContent = message;
        }
        paywall.hidden = false;
    }
    setStatus('');
}

function hidePaywall() {
    const paywall = document.getElementById('pptPaywall');
    const searchWrap = document.querySelector('.ppt-search-wrap');
    const suggestions = document.getElementById('pptSuggestions');
    if (paywall) paywall.hidden = true;
    if (searchWrap) searchWrap.hidden = false;
    if (suggestions) suggestions.hidden = false;
}

function hideAllResults() {
    ['pptEmpty', 'pptSingle', 'pptChartCard'].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.hidden = true;
    });
    if (chartInstance) {
        chartInstance.destroy();
        chartInstance = null;
    }
}

function renderSuggestions(signal) {
    const root = document.getElementById('pptSuggestions');
    if (!root) return;
    root.innerHTML = SUGGESTIONS.map(
        (term) =>
            `<button type="button" class="ppt-chip" data-term="${escapeHtml(term)}">${escapeHtml(term)}</button>`
    ).join('');
    root.querySelectorAll('.ppt-chip').forEach((btn) => {
        btn.addEventListener(
            'click',
            () => {
                const input = document.getElementById('pptSearch');
                if (input) {
                    input.value = btn.getAttribute('data-term') || '';
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                }
            },
            { signal }
        );
    });
}

function renderEmpty() {
    hideAllResults();
    const el = document.getElementById('pptEmpty');
    if (el) el.hidden = false;
    setStatus('');
}

function renderComparison(data) {
    hideAllResults();
    const card = document.getElementById('pptSingle');
    if (!card) return;

    const rows = (data.store_series || []).flatMap((series) =>
        (series.points || []).map((point) => ({
            merchant: series.merchant_name,
            date: point.date,
            unitPrice: point.unit_price,
        }))
    );
    if (rows.length < 2) {
        renderSingle(data);
        return;
    }

    const cheapest = rows.reduce(
        (min, row) => (row.unitPrice < min.unitPrice ? row : min),
        rows[0]
    );

    card.hidden = false;
    card.innerHTML =
        '<div class="ppt-single-label"><i class="fas fa-balance-scale"></i> Store comparison</div>' +
        `<h3 class="ppt-single-title">${escapeHtml(data.canonical_name)}</h3>` +
        '<p class="ppt-single-hint">Not enough purchase history for a trend line yet. Here is what you paid at each store.</p>' +
        '<div class="ppt-compare-list">' +
        rows
            .map((row) => {
                const isBest =
                    row.merchant === cheapest.merchant && row.unitPrice === cheapest.unitPrice;
                return (
                    '<div class="ppt-compare-row">' +
                    `<div><strong>${escapeHtml(row.merchant)}</strong><div class="ppt-compare-date">${escapeHtml(row.date)}</div></div>` +
                    `<div class="ppt-price${isBest ? ' ppt-price--best' : ''}">$${Number(row.unitPrice).toFixed(2)}${isBest ? ' · lowest' : ''}</div>` +
                    '</div>'
                );
            })
            .join('') +
        '</div>' +
        '<p class="ppt-single-hint">Scan more receipts over the next few months to unlock a 3-month trend chart.</p>';

    setStatus(`${data.match_count} purchases · ${data.window_start} → ${data.window_end}`);
}

function renderSingle(data) {
    hideAllResults();
    const card = document.getElementById('pptSingle');
    const series = data.store_series?.[0];
    const point = series?.points?.[0];
    if (!card || !point) return;

    card.hidden = false;
    card.innerHTML =
        '<div class="ppt-single-label"><i class="fas fa-tag"></i> Single purchase detail</div>' +
        `<h3 class="ppt-single-title">${escapeHtml(data.canonical_name)}</h3>` +
        '<div class="ppt-metric-row"><span>Store</span><span>' +
        escapeHtml(series.merchant_name) +
        '</span></div>' +
        '<div class="ppt-metric-row"><span>Date</span><span>' +
        escapeHtml(point.date) +
        '</span></div>' +
        '<div class="ppt-metric-row"><span>Unit price paid</span><span class="ppt-price">$' +
        Number(point.unit_price).toFixed(2) +
        '</span></div>' +
        '<p class="ppt-single-hint">Scan or upload more receipts with this item to unlock a price trend chart.</p>';

    setStatus(`${data.match_count} match · ${data.window_start} → ${data.window_end}`);
}

function buildChartPayload(data) {
    const months = data.chart_months || [];
    const labels = data.chart_month_labels?.length
        ? data.chart_month_labels
        : months.map((m) => m.slice(5));
    if (!labels.length || !(data.monthly_series || []).length) return null;

    const cpiByMonth = new Map((data.cpi_baseline || []).map((row) => [row.month, row.unit_price]));

    const storeDatasets = (data.monthly_series || []).map((series, index) => ({
        label: series.merchant_name,
        color: storeColor(series.merchant_name, index),
        data: (series.points || []).map((point) =>
            point.unit_price == null ? null : point.unit_price
        ),
    }));

    const hasAnyStoreData = storeDatasets.some((ds) => ds.data.some((val) => val != null));
    if (!hasAnyStoreData) return null;

    const cpiData = months.map((month) => cpiByMonth.get(month) ?? null);

    return { labels, storeDatasets, cpiData, showCpi: data.show_cpi_overlay !== false };
}

function renderLegend(storeDatasets, showCpi = true, unitLabel = '$/unit') {
    const root = document.getElementById('pptLegend');
    if (!root) return;
    const items = [
        ...storeDatasets.map((ds) => ({
            label: ds.label,
            color: ds.color,
            dashed: false,
        })),
        ...(showCpi
            ? [
                  {
                      label: `National CPI (${unitLabel})`,
                      color: CPI_COLOR,
                      dashed: true,
                  },
              ]
            : []),
    ];
    root.innerHTML = items
        .map(
            (item) =>
                '<span class="ppt-legend-item">' +
                `<span class="ppt-legend-swatch${item.dashed ? ' ppt-legend-swatch--cpi' : ''}"` +
                (item.dashed ? '' : ` style="background:${item.color}"`) +
                '></span>' +
                escapeHtml(item.label) +
                '</span>'
        )
        .join('');
}

function renderChart(data) {
    hideAllResults();
    const card = document.getElementById('pptChartCard');
    const canvas = document.getElementById('pptChart');
    const subtitle = document.getElementById('pptChartSubtitle');
    if (!card || !canvas || !window.Chart) return;

    const payload = buildChartPayload(data);
    if (!payload) {
        renderSingle(data);
        return;
    }

    const unitLabel = data.price_unit_label || '$/unit';
    card.hidden = false;
    if (subtitle) {
        subtitle.textContent =
            (data.canonical_name || data.query_string) +
            ` · ${data.days_window}-day window · ${unitLabel}`;
        if (payload.showCpi && data.cpi_product_name) {
            subtitle.textContent += ` · CPI: ${data.cpi_product_name}`;
        }
    }

    const displayLabels = payload.labels;

    const datasets = [
        ...payload.storeDatasets.map((ds) => ({
            label: ds.label,
            data: ds.data,
            borderColor: ds.color,
            backgroundColor: ds.color,
            borderWidth: 2,
            pointRadius: 4,
            tension: 0,
            spanGaps: false,
        })),
        ...(payload.showCpi
            ? [
                  {
                      label: `National CPI (${unitLabel})`,
                      data: payload.cpiData,
                      borderColor: CPI_COLOR,
                      backgroundColor: CPI_COLOR,
                      borderWidth: 2,
                      borderDash: [6, 4],
                      pointRadius: 0,
                      tension: 0,
                      spanGaps: false,
                  },
              ]
            : []),
    ];

    if (chartInstance) {
        chartInstance.destroy();
        chartInstance = null;
    }

    chartInstance = new window.Chart(canvas.getContext('2d'), {
        type: 'line',
        data: { labels: displayLabels, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (ctx) => {
                            const val = ctx.parsed.y;
                            if (val == null) return `${ctx.dataset.label}: —`;
                            return `${ctx.dataset.label}: $${Number(val).toFixed(2)}`;
                        },
                    },
                },
            },
            scales: {
                x: {
                    ticks: { color: '#a0a0a0', maxRotation: 45, minRotation: 0 },
                    grid: { color: 'rgba(255,255,255,0.05)' },
                },
                y: {
                    ticks: {
                        color: '#a0a0a0',
                        callback: (v) => `$${v}`,
                    },
                    grid: { color: 'rgba(255,255,255,0.05)' },
                },
            },
        },
    });

    renderLegend(payload.storeDatasets, payload.showCpi, unitLabel);
    setStatus(`${data.match_count} purchases · ${data.window_start} → ${data.window_end}`);
}

function parseApiError(data) {
    const detail = data?.detail;
    if (typeof detail === 'object' && detail !== null) {
        return detail;
    }
    if (typeof detail === 'string') {
        return { message: detail };
    }
    return { message: data?.message || 'Product search failed' };
}

async function fetchAnalytics(client, queryString) {
    const params = new URLSearchParams({
        query_string: queryString,
        days_window: String(selectedDaysWindow),
    });
    const res = await financeApiFetch(client, `/v1/products/analytics?${params.toString()}`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: searchAbort?.signal,
    });
    const data = await res.json();
    if (!res.ok) {
        const err = parseApiError(data);
        if (res.status === 403 && err.error_code === 'UPGRADE_REQUIRED') {
            const upgradeErr = new Error(err.message || 'Upgrade required');
            upgradeErr.code = 'UPGRADE_REQUIRED';
            upgradeErr.feature = err.feature;
            throw upgradeErr;
        }
        throw new Error(err.message || 'Product search failed');
    }
    return data;
}

async function ensureProductAnalyticsAccess(client) {
    const profile = await loadEntitlementProfile(client, financeApiFetch);
    if (!hasFeature(profile, FEAT_PRODUCT_ANALYTICS)) {
        showPaywall('Upgrade to Pro to unlock Product Price Tracker.');
        return false;
    }
    hidePaywall();
    return true;
}

function renderResults(data) {
    const helper = document.getElementById('pptHelper');
    if (helper) helper.hidden = true;

    if (!data.match_count) {
        renderEmpty();
        return;
    }
    if (data.is_single_purchase) {
        renderSingle(data);
        return;
    }
    if (data.show_trend_chart === false) {
        renderComparison(data);
        return;
    }
    renderChart(data);
}

async function runSearch(client, queryString, signal) {
    if (queryString.length < 2) {
        hideAllResults();
        const helper = document.getElementById('pptHelper');
        if (helper) helper.hidden = false;
        setStatus('');
        return;
    }

    searchAbort?.abort();
    searchAbort = new AbortController();

    setLoading(true);
    setStatus('Searching receipt line items…');
    try {
        const data = await fetchAnalytics(client, queryString);
        if (signal?.aborted || searchAbort.signal.aborted) return;
        updateWindowToggle(data);
        renderResults(data);
    } catch (e) {
        if (e?.name === 'AbortError') return;
        if (e?.code === 'UPGRADE_REQUIRED') {
            showPaywall(e.message || 'Upgrade to Pro to unlock Product Price Tracker.');
            return;
        }
        hideAllResults();
        setStatus(e?.message || 'Search failed');
        console.error('product-analytics', e);
    } finally {
        setLoading(false);
    }
}

export async function bootProductAnalyticsPage(opts = {}) {
    const { signal } = opts;
    if (signal?.aborted) return;
    if (!(await guardSession())) return;

    const client = createLogtoClient();
    if (!(await ensureProductAnalyticsAccess(client))) return;

    const input = document.getElementById('pptSearch');
    if (!input) return;

    renderSuggestions(signal);
    syncWindowToggleButtons();
    const toggleRoot = document.getElementById('pptWindowToggle');
    if (toggleRoot) toggleRoot.hidden = false;
    toggleRoot?.querySelectorAll('.ppt-window-btn').forEach((btn) => {
        btn.addEventListener(
            'click',
            () => {
                selectedDaysWindow = Number(btn.getAttribute('data-days')) || DAYS_3M;
                syncWindowToggleButtons();
                if (input.value.trim().length >= 2) {
                    void runSearch(client, input.value.trim(), signal);
                }
            },
            { signal }
        );
    });

    const onInput = () => {
        clearTimeout(debounceTimer);
        debounceTimer = window.setTimeout(() => {
            void runSearch(client, input.value.trim(), signal);
        }, DEBOUNCE_MS);
    };

    input.addEventListener('input', onInput, { signal });
    if (input.value.trim().length >= 2) {
        void runSearch(client, input.value.trim(), signal);
    }
}
