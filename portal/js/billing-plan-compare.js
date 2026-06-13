/**
 * Plan comparison UI for Settings → Billing (tier dropdown + detail card + mascot insight).
 * Tier copy mirrors finance-ai-dashboard `tier_definitions` (FREE, BASIC, PRO, PILOT_3MONTH).
 */

import { applyMascotTier, ensureMascotImg, pulseMascot } from './mascot-tier.js';

function escapeHtml(s) {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/"/g, '&quot;');
}

const FEATURE_LABELS = {
    '3m_dashboard': '3-month insight dashboard',
    basic_planners: 'Monthly & weekly planners',
    unlimited_planners: 'Unlimited planner depth',
    lstm_forecast: 'LSTM AI forecasting & CPI outlook',
    email_connector: 'Email bill connector',
    product_analytics: 'Product price analytics',
};

const LIMIT_LINES = {
    free: [
        '3 statement uploads / month',
        '0 receipt scans / month',
        '0 AI chat messages / month',
    ],
    basic: [
        '15 receipt scans / month',
        '2 statement uploads / month',
        '5 AI chat messages / month',
    ],
    premium: [
        'Generous receipt & statement limits',
        '150 AI chat messages / month',
    ],
    pilot: [
        '50 receipt scans / month',
        '5 statement uploads / month',
        '30 AI chat messages / month',
    ],
};

/** Align API / legacy form values with select option values. */
export function normalizeBillingTierValue(raw) {
    const t = String(raw || 'free').toLowerCase().trim();
    if (t === 'basic') return 'basic';
    if (t === 'pilot' || t === 'pilot_3month') return 'pilot';
    if (t === 'premium' || t === 'advanced' || t === 'pro' || t === 'pro_trial' || t === 'business') {
        return 'premium';
    }
    return 'free';
}

const PLANS = {
    free: {
        key: 'free',
        tierId: 'FREE',
        title: 'Insight Starter',
        tagline: 'Free · core visibility',
        price: '$0',
        period: '/mo',
        badge: null,
        featured: false,
        features: ['3m_dashboard'],
        limitsKey: 'free',
        insight:
            'Start with a rolling 3-month dashboard and transaction visibility — ideal while you connect your first statements.',
        ctaHint: 'Stay on Free as long as you like. Upgrade when you want planners or AI forecasting.',
    },
    basic: {
        key: 'basic',
        tierId: 'BASIC',
        title: 'Cashflow Essential',
        tagline: 'Basic · planners & scans',
        price: '$4.99',
        period: '/mo',
        badge: null,
        featured: false,
        features: ['3m_dashboard', 'basic_planners'],
        limitsKey: 'basic',
        insight:
            'Adds budget and weekly planners plus modest receipt and statement limits — built for steady cashflow habits.',
        ctaHint: 'Best when you want structure without the full forecast stack.',
    },
    premium: {
        key: 'premium',
        tierId: 'PRO',
        title: 'Forecast Pro',
        tagline: 'Pro · full AI stack',
        price: '$7.99',
        period: '/mo',
        badge: 'PRO',
        featured: true,
        features: [
            '3m_dashboard',
            'lstm_forecast',
            'basic_planners',
            'unlimited_planners',
            'email_connector',
            'product_analytics',
        ],
        limitsKey: 'premium',
        insight:
            'Unlock LSTM forecasting, CPI outlook, email connector, product price analytics, and unlimited planners.',
        ctaHint: 'For power users who want the complete MintrAIQ intelligence layer.',
    },
    pilot: {
        key: 'pilot',
        tierId: 'PILOT_3MONTH',
        title: 'Pilot Analyst',
        tagline: 'Promo · 90-day pilot',
        price: '$0',
        period: ' pilot',
        badge: 'PILOT',
        featured: false,
        features: ['3m_dashboard', 'lstm_forecast', 'basic_planners'],
        limitsKey: 'pilot',
        insight:
            'Limited-time pilot access: forecasting and planners with mid-tier usage caps. Redeem a promo code in billing settings.',
        ctaHint: 'Apply a pilot code under Payment details when checkout is connected.',
    },
};

function planIncludedLines(plan) {
    const lines = (plan.features || []).map((f) => FEATURE_LABELS[f] || f);
    lines.push(...(LIMIT_LINES[plan.limitsKey] || []));
    return lines;
}

function planExcludedLines(planKey) {
    const all = new Set(
        Object.values(PLANS).flatMap((p) => p.features || []),
    );
    const mine = new Set(PLANS[planKey]?.features || []);
    const excluded = [];
    if (!mine.has('lstm_forecast')) excluded.push('LSTM AI forecasting & CPI outlook');
    if (!mine.has('email_connector')) excluded.push('Email bill connector');
    if (!mine.has('product_analytics')) excluded.push('Product price analytics');
    if (!mine.has('basic_planners') && !mine.has('unlimited_planners')) {
        excluded.push('Budget & weekly planners');
    }
    if (planKey === 'free') {
        excluded.push('Receipt scanning & statement uploads');
    }
    return excluded.filter((line, i, arr) => arr.indexOf(line) === i);
}

function renderPlanCard(key) {
    const p = PLANS[key] || PLANS.free;
    const included = planIncludedLines(p);
    const excluded = planExcludedLines(key);
    const inc = included
        .map(
            (line) =>
                `<li class="plan-compare-feat plan-compare-feat--yes"><i class="fas fa-check" aria-hidden="true"></i><span>${escapeHtml(line)}</span></li>`,
        )
        .join('');
    const exc = excluded
        .map(
            (line) =>
                `<li class="plan-compare-feat plan-compare-feat--no"><i class="fas fa-xmark" aria-hidden="true"></i><span>${escapeHtml(line)}</span></li>`,
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

/**
 * @param {HTMLFormElement | null} form
 */
export function mountBillingPlanCompare(form) {
    if (!form || form.getAttribute('data-settings-step') !== 'billing') return;

    const select = form.querySelector('#billingTier');
    const host = document.getElementById('planCompareHost');
    const insightEl = document.getElementById('planMascotInsight');
    const mascotFrameEl = document.getElementById('planBillingMascot');

    if (!(select instanceof HTMLSelectElement) || !host || !insightEl) return;

    const key = normalizeBillingTierValue(select.value);
    if (select.value !== key) select.value = key;

    host.innerHTML = renderPlanCard(key);
    const p = PLANS[key] || PLANS.free;
    insightEl.textContent = p.insight;

    const imgEl = mascotFrameEl?.querySelector('img');
    ensureMascotImg(mascotFrameEl, imgEl);
    applyMascotTier(mascotFrameEl, key);
    pulseMascot(mascotFrameEl);
}

/** Wire select change → refresh card + mascot tier glow. */
export function wireBillingPlanCompare(form) {
    if (!form || form.getAttribute('data-settings-step') !== 'billing') return;
    const select = form.querySelector('#billingTier');
    if (!(select instanceof HTMLSelectElement) || select.dataset.mascotWired === '1') return;
    select.dataset.mascotWired = '1';
    select.addEventListener('change', () => mountBillingPlanCompare(form));
    mountBillingPlanCompare(form);
}
