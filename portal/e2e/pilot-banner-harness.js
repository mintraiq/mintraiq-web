/**
 * Playwright E2E harness — renders the production pilot banner against fixed
 * profile payloads and a frozen clock, so the countdown copy is deterministic.
 *
 * URL: pilot-banner-harness.html?case=midway|lastday|today|none|expired|bad
 */
import { renderPilotBanner } from '../js/pilot-banner.js';

const NOW = new Date('2026-08-12T09:00:00Z');

const CASES = {
    midway: { pilot_expires_at: '2026-11-10T00:00:00+00:00' },
    lastday: { pilot_expires_at: '2026-08-13T09:00:00+00:00' },
    today: { pilot_expires_at: '2026-08-12T09:00:00+00:00' },
    // Not on a pilot — the banner must stay hidden rather than render empty.
    none: { pilot_expires_at: null },
    // Lapsed but not yet cleared; must not read "-3 days".
    expired: { pilot_expires_at: '2026-08-09T09:00:00+00:00' },
    bad: { pilot_expires_at: 'not-a-date' },
};

const params = new URLSearchParams(window.location.search);
const key = params.get('case') || 'midway';
const profile = CASES[key] || {};

const host = document.getElementById('pilotWindowBanner');
const shown = renderPilotBanner(profile, host, NOW);

document.body.dataset.bannerShown = String(shown);
document.getElementById('harnessMode').textContent = `case=${key} · shown=${shown}`;
document.body.dataset.harnessReady = 'true';
