/**
 * "Your full access ends on X" banner for settings-billing.html.
 *
 * Reads `pilot_expires_at` from GET /users/me. The API sends the date because a
 * boolean cannot tell someone when their access runs out, and a pilot that ends
 * without notice reads as the app breaking.
 */

/** `5 November 2026` — a date someone can act on, not an ISO string. */
export function formatPilotEndDate(iso) {
    if (!iso) return null;
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleDateString('en-NZ', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    });
}

/** Whole days left, floored at 0 so a lapsed grant never reads negative. */
export function pilotDaysRemaining(iso, now = new Date()) {
    if (!iso) return null;
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return null;
    return Math.max(0, Math.ceil((date.getTime() - now.getTime()) / 86400000));
}

export function pilotBannerCopy(profile, now = new Date()) {
    const endDate = formatPilotEndDate(profile?.pilot_expires_at);
    if (!endDate) return null;
    const daysLeft = pilotDaysRemaining(profile.pilot_expires_at, now);
    return {
        title:
            daysLeft === 0
                ? 'Your full access ends today'
                : `Full access for ${daysLeft} more ${daysLeft === 1 ? 'day' : 'days'}`,
        body:
            `Every feature is unlocked until ${endDate}. After that your account moves ` +
            'to the free Insight Starter plan — your data stays, and nothing is charged.',
    };
}

export function renderPilotBanner(profile, host, now = new Date()) {
    if (!host) return false;
    const copy = pilotBannerCopy(profile, now);
    if (!copy) {
        host.hidden = true;
        host.innerHTML = '';
        return false;
    }
    host.hidden = false;
    host.innerHTML = `
        <div class="pilot-banner__icon" aria-hidden="true"><i class="fas fa-clock"></i></div>
        <div class="pilot-banner__copy">
            <p class="pilot-banner__title"></p>
            <p class="pilot-banner__body"></p>
        </div>`;
    // textContent, not template interpolation — the date is API-supplied.
    host.querySelector('.pilot-banner__title').textContent = copy.title;
    host.querySelector('.pilot-banner__body').textContent = copy.body;
    return true;
}
