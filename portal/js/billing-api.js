/**
 * Billing v1 — persist plan selection to user_subscriptions (not just workflow draft).
 */

import { financeApiFetch } from './api.js';
import { normalizeBillingTierValue } from './billing-plan-compare.js';
import { setEntitlementProfile } from './entitlements.js';

export async function selectSubscriptionPlan(client, rawTier) {
    const planKey = normalizeBillingTierValue(rawTier);
    const res = await financeApiFetch(client, '/v1/billing/select-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ plan_key: planKey }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        const detail = data?.detail;
        const msg =
            typeof detail === 'string'
                ? detail
                : detail?.message || data?.message || `Plan save failed (${res.status})`;
        throw new Error(msg);
    }
    if (data?.features) {
        setEntitlementProfile({
            effective_tier_id: data.effective_tier_id,
            tier: data.tier,
            features: data.features,
            limits: data.limits,
            usage: data.usage,
        });
    }
    return data;
}
