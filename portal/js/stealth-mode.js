/**
 * Global Stealth Mode — masks sensitive currency values in the portal UI.
 * @see docs/stealth-mode-spec.md
 */

export const STEALTH_MODE_STORAGE_KEY = '@mintraiq/stealth_mode';

export const STEALTH_FIELD = {
    /** Salary / inflow totals on dashboard and transaction hero. */
    INCOME: 'income',
    /** Investment balances and net-worth style projections. */
    INVESTMENTS: 'investments',
    /** Per-row amounts when category/type is income. */
    INCOME_TRANSACTION: 'income_transaction',
    /** @deprecated broad mask — migrated to selective fields on load */
    SAFE_TO_SPEND: 'safe_to_spend',
    TRANSACTION_AMOUNT: 'transaction_amount',
    CHART_TOOLTIP: 'chart_tooltip',
};

export const STEALTH_MASK_TOKEN = '••••';

/** Selective stealth: hide inflows & investments; expenses and savings stay visible. */
export const DEFAULT_MASKED_FIELDS = [
    STEALTH_FIELD.INCOME,
    STEALTH_FIELD.INVESTMENTS,
    STEALTH_FIELD.INCOME_TRANSACTION,
];

const DEFAULT_STATE = {
    is_stealth_active: false,
    masked_fields: DEFAULT_MASKED_FIELDS,
};

/** @type {{ is_stealth_active: boolean, masked_fields: string[] }} */
let state = { ...DEFAULT_STATE, masked_fields: [...DEFAULT_MASKED_FIELDS] };
let hydrated = false;

const LEGACY_BROAD_FIELDS = new Set([
    STEALTH_FIELD.SAFE_TO_SPEND,
    STEALTH_FIELD.TRANSACTION_AMOUNT,
    STEALTH_FIELD.CHART_TOOLTIP,
]);

function normalizeMaskedFields(raw) {
    if (!Array.isArray(raw) || !raw.length) return [...DEFAULT_MASKED_FIELDS];
    const allowed = new Set(Object.values(STEALTH_FIELD));
    const filtered = raw.filter((f) => typeof f === 'string' && allowed.has(f));
    if (filtered.length) return filtered;
    if (raw.some((f) => LEGACY_BROAD_FIELDS.has(f))) return [...DEFAULT_MASKED_FIELDS];
    return [...DEFAULT_MASKED_FIELDS];
}

function normalizeState(raw) {
    if (!raw || typeof raw !== 'object') return { ...DEFAULT_STATE, masked_fields: [...DEFAULT_MASKED_FIELDS] };
    return {
        is_stealth_active: Boolean(raw.is_stealth_active),
        masked_fields: normalizeMaskedFields(raw.masked_fields),
    };
}

function loadFromStorage() {
    try {
        const raw = localStorage.getItem(STEALTH_MODE_STORAGE_KEY);
        if (!raw) return { ...DEFAULT_STATE, masked_fields: [...DEFAULT_MASKED_FIELDS] };
        return normalizeState(JSON.parse(raw));
    } catch {
        return { ...DEFAULT_STATE, masked_fields: [...DEFAULT_MASKED_FIELDS] };
    }
}

function persistState() {
    try {
        localStorage.setItem(
            STEALTH_MODE_STORAGE_KEY,
            JSON.stringify({
                is_stealth_active: state.is_stealth_active,
                masked_fields: state.masked_fields,
            })
        );
    } catch {
        /* ignore quota / private mode */
    }
}

function dispatchChange() {
    document.dispatchEvent(
        new CustomEvent('mint:stealth-mode-changed', {
            detail: {
                isStealthActive: state.is_stealth_active,
                maskedFields: [...state.masked_fields],
            },
        })
    );
}

export function hydrateStealthMode() {
    if (hydrated) return state;
    state = loadFromStorage();
    hydrated = true;
    return state;
}

export function isStealthActive() {
    hydrateStealthMode();
    return state.is_stealth_active;
}

export function getMaskedFields() {
    hydrateStealthMode();
    return [...state.masked_fields];
}

export function toggleStealthMode() {
    hydrateStealthMode();
    state = {
        ...state,
        is_stealth_active: !state.is_stealth_active,
        masked_fields: state.masked_fields.length ? state.masked_fields : [...DEFAULT_MASKED_FIELDS],
    };
    persistState();
    syncStealthToggleButtons();
    dispatchChange();
    return state.is_stealth_active;
}

export function shouldMaskField(fieldCategory) {
    hydrateStealthMode();
    const fields = state.masked_fields.length ? state.masked_fields : DEFAULT_MASKED_FIELDS;
    return state.is_stealth_active && fields.includes(fieldCategory);
}

/**
 * @param {number | string} value
 * @param {string} fieldCategory
 * @param {{ signed?: boolean }} [opts]
 */
export function maskCurrencyValue(value, fieldCategory, opts = {}) {
    hydrateStealthMode();
    const fields = state.masked_fields.length ? state.masked_fields : DEFAULT_MASKED_FIELDS;

    if (state.is_stealth_active && fields.includes(fieldCategory)) {
        return STEALTH_MASK_TOKEN;
    }

    if (typeof value === 'string') {
        const text = value.trim();
        return text || '—';
    }

    const val = Number(value);
    if (!Number.isFinite(val)) return '—';
    const fmt = new Intl.NumberFormat(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(Math.abs(val));
    if (!opts.signed) return `$${fmt}`;
    return val < 0 ? `−$${fmt}` : `+$${fmt}`;
}

/** Format currency without applying stealth (expenses, savings, spend charts). */
export function formatCurrencyPlain(value, opts = {}) {
    if (typeof value === 'string') {
        const text = value.trim();
        return text || '—';
    }
    const val = Number(value);
    if (!Number.isFinite(val)) return '—';
    const fmt = new Intl.NumberFormat(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(Math.abs(val));
    if (!opts.signed) return `$${fmt}`;
    return val < 0 ? `−$${fmt}` : `+$${fmt}`;
}

/** True when a transaction row represents income / credit inflow. */
export function isIncomeTransaction(row) {
    if (!row) return false;
    const type = String(row.type || '').toLowerCase();
    if (type === 'credit' || type === 'income') return true;
    return String(row.category || '').trim().toLowerCase() === 'income';
}

/** Chart.js tooltip — mask income series only; expenses stay readable. */
export function chartTooltipLabel(ctx) {
    const label = ctx.dataset?.label || '';
    const y = ctx.parsed?.y ?? ctx.raw;
    if (label === 'Income' && shouldMaskField(STEALTH_FIELD.INCOME)) {
        return `${label}: ${STEALTH_MASK_TOKEN}`;
    }
    const formatted = formatCurrencyPlain(y);
    return label ? `${label}: ${formatted}` : formatted;
}

/** Chart.js Y-axis — show real expense scale when stealth hides income. */
export function chartYAxisTick(value) {
    return formatCurrencyPlain(value);
}

export function onStealthModeChange(handler) {
    document.addEventListener('mint:stealth-mode-changed', handler);
    return () => document.removeEventListener('mint:stealth-mode-changed', handler);
}

export function syncStealthToggleButtons() {
    hydrateStealthMode();
    document.querySelectorAll('[data-stealth-toggle]').forEach((btn) => {
        const active = state.is_stealth_active;
        btn.setAttribute('aria-pressed', active ? 'true' : 'false');
        btn.setAttribute('title', active ? 'Show sensitive amounts' : 'Hide sensitive amounts');
        btn.setAttribute('aria-label', active ? 'Show sensitive amounts' : 'Hide sensitive amounts');
        btn.classList.toggle('portal-stealth-toggle--active', active);
        const icon = btn.querySelector('i');
        if (icon) {
            icon.className = active ? 'fas fa-eye-slash' : 'fas fa-eye';
        }
    });
}

if (typeof document !== 'undefined') {
    hydrateStealthMode();
    if (!window.__mintStealthToggleListener) {
        window.__mintStealthToggleListener = true;
        document.addEventListener('click', (e) => {
            const btn = e.target.closest?.('[data-stealth-toggle]');
            if (!btn) return;
            e.preventDefault();
            toggleStealthMode();
        });
    }
}
