import {
    buildTwelveMonthReminderNudge,
    needsTwelveMonthReminder,
    txnMonthsFromBootstrap
} from './data-level-progress.js';

const DISMISS_KEY = 'mintraiq_dismissed_twelve_month_reminder';

function readBootstrap() {
    try {
        const raw = sessionStorage.getItem('mintraiq_bootstrap');
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

function isDismissed() {
    return sessionStorage.getItem(DISMISS_KEY) === '1';
}

export function dismissTwelveMonthReminder() {
    sessionStorage.setItem(DISMISS_KEY, '1');
    syncDataLevelNotificationBell();
}

/**
 * Updates workspace notification bell → bulb when 6–11 months of history.
 */
export function syncDataLevelNotificationBell() {
    const bootstrap = readBootstrap();
    const txnMonths = txnMonthsFromBootstrap(bootstrap);
    const active = needsTwelveMonthReminder(txnMonths) && !isDismissed();

    document.querySelectorAll('.portal-banner-icon--notify').forEach((el) => {
        if (!(el instanceof HTMLElement)) return;
        el.classList.toggle('portal-banner-icon--bulb-reminder', active);
        el.title = active
            ? 'Upload more statement history for full 12-month forecast'
            : 'Notifications';
        const icon = el.querySelector('i');
        if (icon) {
            icon.className = active ? 'fas fa-lightbulb' : 'fas fa-bell';
        }
        const badge = el.querySelector('.portal-banner-badge');
        if (badge instanceof HTMLElement) {
            badge.textContent = active ? '!' : badge.dataset.baseCount || '3';
            badge.hidden = !active && badge.dataset.baseCount === '0';
            badge.classList.toggle('portal-banner-badge--bulb', active);
        }
    });
}

/**
 * Inject 12-month reminder card on notifications page when applicable.
 */
export function mountTwelveMonthReminderOnNotificationsPage() {
    if (document.body?.getAttribute('data-portal-nav') !== 'notifications') return;

    const bootstrap = readBootstrap();
    const txnMonths = txnMonthsFromBootstrap(bootstrap);
    if (!needsTwelveMonthReminder(txnMonths) || isDismissed()) return;

    const list = document.querySelector('main.main-content ul');
    if (!list || list.querySelector('[data-twelve-month-reminder]')) return;

    const nudge = buildTwelveMonthReminderNudge(txnMonths);
    const li = document.createElement('li');
    li.className = 'card';
    li.dataset.twelveMonthReminder = '1';
    li.style.cssText =
        'margin-bottom:12px;padding:16px;display:flex;gap:14px;align-items:flex-start;border-color:rgba(241,196,15,0.35)';
    li.innerHTML =
        `<i class="fas fa-lightbulb" style="color:var(--accent-yellow,#f1c40f);margin-top:4px;font-size:1.1rem" aria-hidden="true"></i>` +
        `<div style="flex:1">` +
        `<strong>${nudge.title}</strong>` +
        `<p style="color:var(--text-secondary);font-size:0.9rem;margin:6px 0 10px">${nudge.message}</p>` +
        `<a href="${nudge.href}" class="btn-primary" style="display:inline-flex;font-size:0.88rem;padding:8px 14px">Upload more history</a> ` +
        `<button type="button" class="statement-upload-file-remove" data-dismiss-twelve-month style="margin-left:8px;vertical-align:middle" aria-label="Dismiss reminder">Dismiss</button>` +
        `</div>`;

    list.insertBefore(li, list.firstChild);
    li.querySelector('[data-dismiss-twelve-month]')?.addEventListener('click', () => {
        dismissTwelveMonthReminder();
        li.remove();
    });
}
