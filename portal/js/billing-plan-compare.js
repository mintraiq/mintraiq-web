/**
 * Plan comparison UI for Settings → Billing (tier dropdown + detail card + mascot insight).
 */

function escapeHtml(s) {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/"/g, '&quot;');
}

/** Align API / legacy form values with select option values (free | basic | premium). */
export function normalizeBillingTierValue(raw) {
    const t = String(raw || 'free').toLowerCase().trim();
    if (t === 'basic') return 'basic';
    if (t === 'premium' || t === 'pro' || t === 'pro_trial' || t === 'business') return 'premium';
    return 'free';
}

const PLANS = {
    free: {
        key: 'free',
        title: 'Ninja Initiate',
        tagline: 'Free tier',
        price: '$0',
        period: '/mo',
        badge: null,
        featured: false,
        included: ['Basic Dashboard', '1 Month History'],
        excluded: ['Receipt Scanner', 'AI Forecasting', 'Nudges & Alerts'],
        insight:
            'Starting path: get oriented with your dashboard and a month of history — no spend pressure. Upgrade only when you want more.',
        ctaHint: 'Stay on Free as long as you like.'
    },
    basic: {
        key: 'basic',
        title: 'Ninja Warrior',
        tagline: 'Basic',
        price: '$4.99',
        period: '/mo',
        badge: null,
        featured: false,
        included: [
            '6 Months Transaction Storage',
            '10 Receipt Scans / mo',
            'Limited AI Forecasting',
            'Budget & Goal Setting'
        ],
        excluded: ['CPI Guru Inflation Tracker'],
        insight:
            'Balanced upgrade: more history, receipt scans, and lighter AI — great when you want help without the full Pro toolkit.',
        ctaHint: 'Choose Basic when you are ready for more automation.'
    },
    premium: {
        key: 'premium',
        title: 'Shadow Master',
        tagline: 'Pro',
        price: '$9.99',
        period: '/mo',
        badge: 'NINJA PRO',
        featured: true,
        included: [
            'Unlimited Everything',
            'CPI Guru Inflation Tracker',
            'Advanced AI Forecasting',
            'High Expense Alerts & Nudges',
            'Weekly / Monthly Planners'
        ],
        excluded: [],
        insight:
            'Full dojo: CPI Guru, advanced forecasts, alerts, and planners — for when you want the complete MintrAIQ experience.',
        ctaHint: 'Upgrade to Pro when you want everything unlocked.'
    }
};

function renderPlanCard(key) {
    const p = PLANS[key] || PLANS.free;
    const inc = p.included
        .map(
            (line) =>
                `<li class="plan-compare-feat plan-compare-feat--yes"><i class="fas fa-check" aria-hidden="true"></i><span>${escapeHtml(line)}</span></li>`
        )
        .join('');
    const exc = p.excluded
        .map(
            (line) =>
                `<li class="plan-compare-feat plan-compare-feat--no"><i class="fas fa-xmark" aria-hidden="true"></i><span>${escapeHtml(line)}</span></li>`
        )
        .join('');
    const ribbon = p.badge
        ? `<span class="plan-compare-ribbon" aria-label="${escapeHtml(p.badge)}">${escapeHtml(p.badge)}</span>`
        : '';
    const featClass = p.featured ? ' plan-compare-card--featured' : '';
    return (
        `<div class="plan-compare-card${featClass}">` +
        ribbon +
        `<h3 class="plan-compare-card__title">${escapeHtml(p.title)}</h3>` +
        `<p class="plan-compare-card__tagline">${escapeHtml(p.tagline)}</p>` +
        `<p class="plan-compare-card__price"><strong>${escapeHtml(p.price)}</strong><span>${escapeHtml(p.period)}</span></p>` +
        `<ul class="plan-compare-list" aria-label="Plan features">${inc}${exc}</ul>` +
        `<p class="plan-compare-card__hint">${escapeHtml(p.ctaHint)}</p>` +
        `</div>`
    );
}

function triggerBulbAnimation(bulbEl) {
    if (!bulbEl) return;
    bulbEl.classList.remove('plan-bulb--anim');
    void bulbEl.offsetWidth;
    bulbEl.classList.add('plan-bulb--anim');
}

/**
 * @param {HTMLFormElement | null} form
 */
export function mountBillingPlanCompare(form) {
    if (!form || form.getAttribute('data-settings-step') !== 'billing') return;

    const select = form.querySelector('#billingTier');
    const host = document.getElementById('planCompareHost');
    const insightEl = document.getElementById('planBulbInsight');
    const bulbEl = document.getElementById('planBulb');

    if (!(select instanceof HTMLSelectElement) || !host || !insightEl) return;

    const key = normalizeBillingTierValue(select.value);
    if (select.value !== key) select.value = key;

    host.innerHTML = renderPlanCard(key);
    const p = PLANS[key] || PLANS.free;
    insightEl.textContent = p.insight;

    triggerBulbAnimation(bulbEl);
}
