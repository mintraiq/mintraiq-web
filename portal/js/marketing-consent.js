/**
 * The signup consent for commercial email, and the words that ask for it.
 *
 * A "few times a year" email about the user's account is a **commercial
 * electronic message** under the Unsolicited Electronic Messages Act 2007,
 * which requires consent, accurate sender identification and a working
 * unsubscribe. This module is the consent half, on web.
 *
 * **These strings must stay identical to `finance-ai-mobile`
 * `lib/marketingConsent.ts`.** Describing the same thing two ways across repos
 * is itself a Fair Trading Act problem — the impression created is the test,
 * and two different accounts of what we send is two different impressions.
 * `scripts/marketing-consent-copy.test.mjs` asserts the claims each string must
 * and must not make; the same assertions exist in the mobile guard test, so a
 * claim cannot drift on one platform without failing on that platform.
 *
 * NOT YET CLEARED BY COUNSEL. See
 * `mintraiq-workspace/docs/features/signup-email-consent/03-legal.md`.
 *
 * Deliberately absent, each absence load-bearing: no number or score about the
 * user; no mention of banks, connecting or syncing (there are five known
 * bank-aggregation surfaces already and this does not add a sixth); no third
 * party named that the Privacy Policy has not named; no frequency promise
 * tighter than the programme can keep.
 */

import { CONFIG } from './config.js';

export const MARKETING_CONSENT_LABEL = 'Email me occasionally about my MintrAIQ account';

export const MARKETING_CONSENT_BODY =
    'Product updates, tips and the occasional question about how MintrAIQ is working for you. A few times a year at most. You can unsubscribe from any email, or turn this off in Settings.';

export const MARKETING_CONSENT_DECLINE_NOTE =
    "Leaving this unticked won't affect your account — you'll still get essential emails about security, billing and your account.";

export const MARKETING_CONSENT_SAVE_FAILED =
    "We couldn't save your email preference. You can turn it on any time in Settings.";

export const MARKETING_CONSENT_SETTINGS_LABEL = 'Occasional MintrAIQ emails';

export const MARKETING_CONSENT_SETTINGS_BODY =
    'Product updates, tips and the occasional question about how MintrAIQ is working for you. Turning this off stops those emails. It does not affect emails about security, billing or your account.';

const CONSENT_PATH = '/consent/marketing-email';
const TIMEOUT_MS = 8000;

/**
 * Lead-capture API base, or '' when unset.
 *
 * Unset is a supported state, not a misconfiguration: the endpoint sits behind
 * a server flag and the URL may not be set in every deployment. The caller
 * shows the inline notice rather than throwing into an onboarding flow the user
 * is part-way through.
 */
export function getLeadApiBase() {
    const base = String(CONFIG.leadApiBase || '').trim();
    return base ? base.replace(/\/$/, '') : '';
}

async function callConsentApi(method, token, body) {
    const base = getLeadApiBase();
    if (!base) return null;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
        return await fetch(`${base}${CONSENT_PATH}`, {
            method,
            headers: {
                Authorization: `Bearer ${token}`,
                ...(body ? { 'Content-Type': 'application/json' } : {})
            },
            body,
            signal: controller.signal
        });
    } catch {
        return null;
    } finally {
        clearTimeout(timer);
    }
}

/**
 * Record the user's answer. Resolves true only when the server confirmed it.
 *
 * Retries once, because the common failure is a cold Cloud Run instance rather
 * than a real rejection. A 4xx is not retried — the same request fails the same
 * way, and pretending otherwise just doubles the delay before the user is told.
 */
export async function saveMarketingConsent({ consented, source, token, policyVersion }) {
    const body = JSON.stringify({
        consented: Boolean(consented),
        source,
        policy_version: policyVersion || null
    });

    for (let attempt = 0; attempt < 2; attempt += 1) {
        const response = await callConsentApi('POST', token, body);
        if (response && response.ok) return true;
        if (response && response.status < 500) return false;
    }
    return false;
}

/**
 * Read the stored answer. Resolves null when we could not ask.
 *
 * The caller must render null as "unavailable" and never as "off": showing a
 * stored yes as a visible no is a false statement about the user's own record.
 */
export async function fetchMarketingConsent(token) {
    const response = await callConsentApi('GET', token);
    if (!response || !response.ok) return null;
    try {
        const payload = await response.json();
        return Boolean(payload && payload.consented);
    } catch {
        return null;
    }
}
