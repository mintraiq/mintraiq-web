/**
 * The commercial-email preference on the notifications settings page.
 *
 * This is the user's Privacy Act 2020 route to the consent record we hold about
 * them: IPP6 to see it, IPP7 to correct it. It is also the "turn this off in
 * Settings" that the consent copy promises, so it is not optional decoration —
 * removing it would make that sentence a claim the product does not keep.
 *
 * Kept separate from the delivery-channel control on the same page. That one
 * routes alerts and nudges about the user's own money; this one governs
 * commercial email. Two switches that look alike is itself a Fair Trading Act
 * problem.
 */

import { createLogtoClient } from './logto-client.js';
import {
    MARKETING_CONSENT_SETTINGS_BODY,
    MARKETING_CONSENT_SETTINGS_LABEL,
    fetchMarketingConsent,
    saveMarketingConsent
} from './marketing-consent.js';

let booting = false;

async function bootMarketingConsent() {
    const section = document.getElementById('marketingConsentSection');
    const toggle = document.getElementById('marketingConsentToggle');
    const errorNode = document.getElementById('marketingConsentError');
    if (!section || !toggle || booting) return;
    booting = true;

    const labelNode = document.getElementById('marketingConsentLabel');
    const bodyNode = document.getElementById('marketingConsentBody');
    if (labelNode) labelNode.textContent = MARKETING_CONSENT_SETTINGS_LABEL;
    if (bodyNode) bodyNode.textContent = MARKETING_CONSENT_SETTINGS_BODY;

    try {
        const client = createLogtoClient();
        if (!(await client.isAuthenticated())) return;

        const token = await client.getAccessToken();
        const current = await fetchMarketingConsent(token);

        // null means we could not ask. The section stays hidden rather than
        // rendering an unchecked box: showing a stored yes as a visible no is a
        // false statement about the user's own record, and invites them to
        // "fix" something that was already right.
        if (current === null) return;

        toggle.checked = current;
        section.hidden = false;

        toggle.addEventListener('change', async () => {
            const wanted = toggle.checked;
            toggle.disabled = true;
            if (errorNode) errorNode.textContent = '';
            const fresh = await client.getAccessToken();
            const stored = await saveMarketingConsent({
                consented: wanted,
                source: 'settings',
                token: fresh
            });
            if (!stored) {
                // Put the switch back where the server actually has it. A
                // toggle left showing the user's intent rather than the stored
                // state is the silent-failure pattern this codebase keeps
                // paying for.
                const actual = await fetchMarketingConsent(fresh);
                toggle.checked = actual === null ? !wanted : actual;
                if (errorNode) {
                    errorNode.textContent =
                        "We couldn't save that change. Please try again.";
                }
            }
            toggle.disabled = false;
        });
    } finally {
        booting = false;
    }
}

void bootMarketingConsent();

if (!window.__mintMarketingConsentTurboLoad) {
    window.__mintMarketingConsentTurboLoad = true;
    document.addEventListener('turbo:load', () => {
        void bootMarketingConsent();
    });
}
