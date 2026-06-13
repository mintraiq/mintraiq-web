/**
 * Small explainer modal for monthly / weekly planner data basis.
 */

const MODAL_ID = 'plannerDataBasisModal';

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/"/g, '&quot;');
}

function formatDateRange(start, end) {
    if (!start && !end) return '—';
    if (start && end) return `${start} → ${end}`;
    return start || end || '—';
}

function row(label, value) {
    if (value === undefined || value === null || value === '') return '';
    return (
        `<div class="planner-basis-row">` +
        `<dt>${escapeHtml(label)}</dt>` +
        `<dd>${escapeHtml(String(value))}</dd>` +
        `</div>`
    );
}

function section(title, bodyHtml) {
    if (!bodyHtml) return '';
    return (
        `<section class="planner-basis-section">` +
        `<h4>${escapeHtml(title)}</h4>` +
        bodyHtml +
        `</section>`
    );
}

function parsePeriodDates(period) {
    const raw = String(period || '').trim();
    const match = raw.match(/^(\d{4}-\d{2}-\d{2})\s+to\s+(\d{4}-\d{2}-\d{2})$/i);
    if (match) {
        return { start_date: match[1], end_date: match[2] };
    }
    return { start_date: '', end_date: '' };
}

function buildMonthlyDataBasisFallback(planData) {
    const meta = planData?.meta || {};
    const summary = planData?.summary || {};
    const cuts = planData?.cuts || {};
    const periodDates = parsePeriodDates(meta.period);

    return {
        planner_type: 'monthly',
        engine: 'BudgetEngine',
        engine_version: meta.engine_version || '0.4',
        method: 'deterministic',
        is_simulation: false,
        currency: meta.currency || 'NZD',
        historic_window: {
            start_date: periodDates.start_date,
            end_date: periodDates.end_date,
            label: periodDates.start_date ? 'Previous calendar month' : 'Historic period',
            description: periodDates.start_date
                ? 'Actual bank transactions in this date range.'
                : meta.period
                  ? `Period label from plan: ${meta.period}`
                  : 'Based on your most recent uploaded statement window.',
        },
        transaction_count: null,
        category_count: Object.keys(cuts).length || null,
        savings_goal_monthly: summary.savings_goal,
        gentleness: null,
        current_label: 'Current spending',
        current_definition:
            'Sum of your categorized debit transactions per category in the historic window.',
        suggested_label: 'Suggested spending',
        suggested_definition:
            'Deterministic cuts from category max-cut rules × gentleness, applied until your savings goal is approached.',
        display_window: {
            label: 'Monthly plan',
            description: 'Recommendations apply to the month ahead based on last month’s habits.',
        },
    };
}

function buildWeeklyDataBasisFallback(planData) {
    const meta = planData?.meta || {};
    const user = planData?.user || {};
    const categories = Array.isArray(planData?.categories) ? planData.categories : [];
    const fixed = planData?.fixed_costs || {};

    return {
        planner_type: 'weekly',
        engine: 'WeeklyBudgetEngine',
        engine_version: '0.4',
        method: 'deterministic',
        is_simulation: false,
        currency: 'NZD',
        historic_window: {
            start_date: '',
            end_date: '',
            label: 'Previous Mon–Sun week (or prior month if sparse)',
            description:
                'Category totals from the historic window are converted to a weekly allowance (÷ 4.33 when sourced from a full month).',
        },
        transaction_count: null,
        category_count: categories.length || null,
        savings_goal_monthly: user.savings_goal_monthly,
        savings_goal_weekly: user.savings_goal_weekly,
        gentleness: null,
        excluded_fixed_categories: fixed.excluded_list || [],
        current_label: 'Historic category spend',
        current_definition:
            'Real transaction totals in the historic window, minus fixed bills for the weekly card.',
        suggested_label: 'Weekly allowance',
        suggested_definition:
            'Variable spend scaled to a weekly budget; monthly impact is projected (weekly cuts × 4.33), not money already saved.',
        display_window: {
            start_date: meta.week_start || '',
            end_date: meta.week_end || '',
            label: meta.week_label || 'Current calendar week',
            description: 'Daily allowance is spread across this week for tracking.',
        },
    };
}

/**
 * Prefer API `data_basis`; build a readable fallback from the loaded plan payload.
 * @param {object | null | undefined} planData
 * @param {'monthly' | 'weekly'} [plannerType]
 */
export function resolvePlannerDataBasis(planData, plannerType = 'monthly') {
    if (!planData || typeof planData !== 'object') return null;
    if (planData.data_basis && typeof planData.data_basis === 'object') {
        return planData.data_basis;
    }
    return plannerType === 'weekly'
        ? buildWeeklyDataBasisFallback(planData)
        : buildMonthlyDataBasisFallback(planData);
}

function renderBasisBody(basis) {
    if (!basis || typeof basis !== 'object') {
        return '<p class="planner-basis-lead">Load a plan first to see how numbers are calculated.</p>';
    }

    const plannerLabel = basis.planner_type === 'weekly' ? 'Weekly planner' : 'Monthly planner';
    const simulationNote = basis.is_simulation
        ? 'Projected simulation'
        : 'Based on your real bank transactions';

    const historic = basis.historic_window || {};
    const display = basis.display_window || {};

    let overview = '<dl class="planner-basis-dl">';
    overview += row('Planner', plannerLabel);
    overview += row('Method', basis.method === 'deterministic' ? 'Deterministic rule-based optimizer' : basis.method);
    overview += row('Engine', basis.engine ? `${basis.engine} v${basis.engine_version || '—'}` : '');
    overview += row('Currency', basis.currency || 'NZD');
    overview += row('Data type', simulationNote);
    overview += '</dl>';

    let historicBlock = '<dl class="planner-basis-dl">';
    historicBlock += row('Window', historic.label || 'Historic period');
    historicBlock += row('Dates', formatDateRange(historic.start_date, historic.end_date));
    if (historic.description) {
        historicBlock += `<p class="planner-basis-note">${escapeHtml(historic.description)}</p>`;
    }
    if (basis.transaction_count != null) {
        historicBlock += row('Transactions used', basis.transaction_count);
    }
    if (basis.category_count != null) {
        historicBlock += row('Categories', basis.category_count);
    }
    historicBlock += '</dl>';

    let goalsBlock = '<dl class="planner-basis-dl">';
    if (basis.savings_goal_monthly != null) {
        goalsBlock += row('Monthly savings goal', `$${Number(basis.savings_goal_monthly).toFixed(2)}`);
    }
    if (basis.savings_goal_weekly != null) {
        goalsBlock += row('Weekly savings goal', `$${Number(basis.savings_goal_weekly).toFixed(2)}`);
    }
    if (basis.gentleness != null) {
        goalsBlock += row('Cut gentleness', `${Math.round(Number(basis.gentleness) * 100)}%`);
    }
    goalsBlock += '</dl>';
    if (!goalsBlock.includes('planner-basis-row')) {
        goalsBlock = '';
    }

    let columnsBlock = '';
    if (basis.current_label || basis.suggested_label) {
        columnsBlock = '<div class="planner-basis-columns">';
        if (basis.current_label) {
            columnsBlock +=
                '<div class="planner-basis-col">' +
                `<strong>${escapeHtml(basis.current_label)}</strong>` +
                `<p>${escapeHtml(basis.current_definition || '')}</p>` +
                '</div>';
        }
        if (basis.suggested_label) {
            columnsBlock +=
                '<div class="planner-basis-col">' +
                `<strong>${escapeHtml(basis.suggested_label)}</strong>` +
                `<p>${escapeHtml(basis.suggested_definition || '')}</p>` +
                '</div>';
        }
        columnsBlock += '</div>';
    }

    let displayBlock = '';
    if (display.label || display.start_date) {
        displayBlock = '<dl class="planner-basis-dl">';
        displayBlock += row('Plan window', display.label || 'Current period');
        if (display.start_date || display.end_date) {
            displayBlock += row('Dates', formatDateRange(display.start_date, display.end_date));
        }
        if (display.description) {
            displayBlock += `<p class="planner-basis-note">${escapeHtml(display.description)}</p>`;
        }
        displayBlock += '</dl>';
    }

    let weeklyExtras = '';
    if (Array.isArray(basis.excluded_fixed_categories) && basis.excluded_fixed_categories.length) {
        weeklyExtras =
            '<p class="planner-basis-note">' +
            '<strong>Fixed costs excluded from weekly card:</strong> ' +
            escapeHtml(basis.excluded_fixed_categories.join(', ')) +
            '</p>';
    }
    if (basis.goal_achievable === false) {
        weeklyExtras +=
            '<p class="planner-basis-warn">Your savings goal may not be fully reachable with available variable cuts.</p>';
    }

    return (
        `<p class="planner-basis-lead">This plan uses historic spending — not a forecast simulation — then applies transparent cut rules toward your savings goal.</p>` +
        section('Overview', overview) +
        section('Historic data', historicBlock) +
        (goalsBlock ? section('Goals & settings', goalsBlock) : '') +
        section('What the columns mean', columnsBlock) +
        (displayBlock ? section('Plan window', displayBlock) : '') +
        weeklyExtras
    );
}

export function mountPlannerDataBasisModal() {
    if (document.getElementById(MODAL_ID)) return;

    const root = document.createElement('div');
    root.id = MODAL_ID;
    root.className = 'planner-basis-modal';
    root.hidden = true;
    root.setAttribute('aria-hidden', 'true');
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-labelledby', 'plannerDataBasisTitle');
    root.innerHTML =
        '<div class="planner-basis-dialog">' +
        '<header class="planner-basis-header">' +
        '<h3 id="plannerDataBasisTitle"><i class="fas fa-database" aria-hidden="true"></i> Data basis</h3>' +
        '<button type="button" class="planner-basis-close" id="plannerDataBasisClose" aria-label="Close">' +
        '<i class="fas fa-xmark" aria-hidden="true"></i>' +
        '</button>' +
        '</header>' +
        '<div class="planner-basis-body" id="plannerDataBasisBody"></div>' +
        '<footer class="planner-basis-footer">' +
        '<button type="button" class="btn-primary" id="plannerDataBasisOk">Got it</button>' +
        '</footer>' +
        '</div>';

    document.body.appendChild(root);

    const close = () => closePlannerDataBasisModal();
    root.addEventListener('click', (event) => {
        if (event.target === root) close();
    });
    document.getElementById('plannerDataBasisClose')?.addEventListener('click', close);
    document.getElementById('plannerDataBasisOk')?.addEventListener('click', close);
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && root.classList.contains('is-visible')) close();
    });
}

export function openPlannerDataBasisModal(basis) {
    mountPlannerDataBasisModal();
    const modal = document.getElementById(MODAL_ID);
    const body = document.getElementById('plannerDataBasisBody');
    if (!modal || !body) return;
    body.innerHTML = renderBasisBody(basis);
    modal.hidden = false;
    modal.classList.add('is-visible');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('planner-basis-open');
    document.getElementById('plannerDataBasisClose')?.focus();
}

export function closePlannerDataBasisModal() {
    const modal = document.getElementById(MODAL_ID);
    if (!modal) return;
    modal.hidden = true;
    modal.classList.remove('is-visible');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('planner-basis-open');
}

/**
 * @param {string} buttonId
 * @param {() => object | null | undefined} getBasis
 * @param {{ signal?: AbortSignal }} [opts]
 */
export function wirePlannerDataBasisButton(buttonId, getBasis, opts = {}) {
    const btn = document.getElementById(buttonId);
    if (!btn) return;
    const handler = (event) => {
        event.preventDefault();
        event.stopPropagation();
        openPlannerDataBasisModal(getBasis?.());
    };
    btn.addEventListener('click', handler, { signal: opts.signal });
}

export function setPlannerDataBasisEnabled(buttonId, enabled) {
    const btn = document.getElementById(buttonId);
    if (!btn) return;
    if (enabled) btn.removeAttribute('disabled');
    else btn.setAttribute('disabled', 'disabled');
}
