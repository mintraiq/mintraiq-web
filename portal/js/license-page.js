import { financeApiFetch } from './api.js';
import { createLogtoClient } from './logto-client.js';
import { guardSession } from './guard-session.js';
import { loadEntitlementProfile } from './entitlements.js';
import {
    applyMascotTier,
    ensureMascotImg,
    mascotTierKeyFromProfile,
    MASCOT_IMG_SRC,
    pulseMascot,
} from './mascot-tier.js';

const TIER_LABELS = {
    free: 'Insight Starter',
    basic: 'Cashflow Essential',
    premium: 'Forecast Pro',
    pilot: 'Pilot Analyst',
};

export async function bootLicensePage() {
    if (!(await guardSession())) return;

    const frame = document.getElementById('licenseMascot');
    const labelEl = document.getElementById('licenseMascotTierLabel');
    const img = frame?.querySelector('img');
    if (!frame || !img) return;

    img.src = MASCOT_IMG_SRC;
    ensureMascotImg(frame, img);

    try {
        const client = createLogtoClient();
        const profile = await loadEntitlementProfile(client, financeApiFetch);
        const tierKey = mascotTierKeyFromProfile(profile);
        applyMascotTier(frame, tierKey);
        pulseMascot(frame);
        if (labelEl) {
            labelEl.textContent = `Your plan: ${TIER_LABELS[tierKey] || 'Insight Starter'}`;
        }
        document.querySelectorAll('.license-tier-card').forEach((card) => {
            card.classList.toggle('license-tier-card--active', card.dataset.tier === tierKey);
        });
    } catch {
        applyMascotTier(frame, 'free');
        if (labelEl) labelEl.textContent = 'Your plan: Insight Starter';
    }
}

if (document.body?.dataset?.portalNav === 'license') {
    bootLicensePage();
}
