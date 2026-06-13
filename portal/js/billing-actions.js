/**
 * Stripe billing actions for settings-billing.html (billing-web.mdc).
 *
 * - "Upgrade to Pro": POST /v1/payments/create-checkout-session → redirect via
 *   @stripe/stripe-js `redirectToCheckout({ sessionId })` (hosted-URL fallback
 *   when no publishable key is configured).
 * - "Manage Billing & Invoices": POST /v1/payments/create-portal-session →
 *   Stripe Customer Portal (tax invoices, card updates, secure cancel).
 * - Handles ?payment=success|cancelled return params and refreshes entitlements.
 *
 * No card inputs are ever rendered here — PCI scope stays on Stripe.
 */

import { createLogtoClient } from './logto-client.js';
import { financeApiFetch } from './api.js';
import { CONFIG, isBillingPaywallRequired } from './config.js';
import { loadEntitlementProfile } from './entitlements.js';

const STRIPE_JS_SRC = 'https://js.stripe.com/v3/';
const PAID_PLAN_KEYS = new Set(['basic', 'premium']);

let stripeJsPromise = null;

function loadStripeJs() {
    if (window.Stripe) return Promise.resolve(window.Stripe);
    if (stripeJsPromise) return stripeJsPromise;
    stripeJsPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = STRIPE_JS_SRC;
        script.async = true;
        script.onload = () => resolve(window.Stripe || null);
        script.onerror = () => reject(new Error('Could not load Stripe.js'));
        document.head.appendChild(script);
    });
    return stripeJsPromise;
}

async function readJson(res) {
    try {
        return await res.json();
    } catch {
        return {};
    }
}

function statusNode() {
    return document.getElementById('billingActionsStatus');
}

function setStatus(message, tone = 'info') {
    const node = statusNode();
    if (!node) return;
    node.textContent = message || '';
    node.dataset.tone = tone;
}

function selectedPlanKey() {
    const select = document.getElementById('billingTier');
    return String(select?.value || '').trim().toLowerCase();
}

async function startCheckout(client) {
    const planKey = selectedPlanKey();
    if (!PAID_PLAN_KEYS.has(planKey)) {
        setStatus('Select a paid plan (Basic or Forecast Pro) to upgrade.', 'warn');
        return;
    }
    setStatus('Preparing secure Stripe checkout…');

    const res = await financeApiFetch(client, '/v1/payments/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan_key: planKey })
    });
    const data = await readJson(res);
    if (!res.ok) {
        const detail = data?.detail?.message || data?.detail || `Checkout failed (${res.status})`;
        throw new Error(String(detail));
    }

    const publishableKey = String(data.publishable_key || CONFIG.stripePublishableKey || '').trim();
    if (publishableKey && data.session_id) {
        try {
            const Stripe = await loadStripeJs();
            if (Stripe) {
                const result = await Stripe(publishableKey).redirectToCheckout({
                    sessionId: data.session_id
                });
                if (result?.error) throw new Error(result.error.message);
                return;
            }
        } catch (e) {
            console.warn('[billing] stripe-js redirect failed, falling back to hosted URL', e);
        }
    }
    if (data.url) {
        window.location.assign(data.url);
        return;
    }
    throw new Error('Checkout session did not return a redirect target.');
}

async function openCustomerPortal(client) {
    setStatus('Opening Stripe billing portal…');
    const res = await financeApiFetch(client, '/v1/payments/create-portal-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ return_path: 'settings-billing.html' })
    });
    const data = await readJson(res);
    if (res.status === 404) {
        setStatus('No billing profile yet — complete an upgrade first to manage invoices.', 'warn');
        return;
    }
    if (!res.ok || !data.url) {
        const detail = data?.detail?.message || data?.detail || `Portal unavailable (${res.status})`;
        throw new Error(String(detail));
    }
    window.location.assign(data.url);
}

async function handlePaymentReturn(client) {
    const params = new URLSearchParams(window.location.search);
    const payment = params.get('payment');
    if (!payment) return;

    const statusField = document.getElementById('paymentStatus');
    if (payment === 'success') {
        setStatus('Payment confirmed — your plan upgrade is being activated.', 'success');
        if (statusField) statusField.value = 'active';
        try {
            // Webhook-driven tier update; refresh the cached entitlement profile.
            await loadEntitlementProfile(client, financeApiFetch);
        } catch (e) {
            console.warn('[billing] entitlement refresh after payment failed', e);
        }
    } else if (payment === 'cancelled') {
        setStatus('Checkout cancelled — no charge was made.', 'warn');
    }
    // Strip the params so Turbo restores/refreshes don't replay the banner.
    params.delete('payment');
    params.delete('plan');
    params.delete('session_id');
    const qs = params.toString();
    window.history.replaceState({}, '', `${window.location.pathname}${qs ? `?${qs}` : ''}`);
}

function wireButton(button, handler) {
    if (!button || button.dataset.billingWired === 'true') return;
    button.dataset.billingWired = 'true';
    button.addEventListener('click', async (event) => {
        event.preventDefault();
        button.disabled = true;
        try {
            await handler();
        } catch (e) {
            console.error('[billing] action failed', e);
            setStatus(String(e?.message || 'Billing action failed.'), 'error');
        } finally {
            button.disabled = false;
        }
    });
}

export function bootBillingActions() {
    const upgradeBtn = document.getElementById('billingUpgradeBtn');
    const manageBtn = document.getElementById('billingManageBtn');
    if (!upgradeBtn && !manageBtn) return;

    // Billing kill switch: hide the upgrade CTA — UI behaves as premium.
    // Manage Billing stays visible so existing subscribers keep invoice access.
    if (!isBillingPaywallRequired() && upgradeBtn) {
        upgradeBtn.style.display = 'none';
    }

    const client = createLogtoClient();
    wireButton(upgradeBtn, () => startCheckout(client));
    wireButton(manageBtn, () => openCustomerPortal(client));
    handlePaymentReturn(client);
}

if (document.body?.dataset?.settingsNav === 'billing') {
    bootBillingActions();
}
document.addEventListener('turbo:load', () => {
    if (document.body?.dataset?.settingsNav === 'billing') {
        bootBillingActions();
    }
});
