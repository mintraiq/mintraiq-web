import { createLogtoClient } from './logto-client.js';
import { financeApiFetch } from './api.js';

const HOST_ID = 'aiReservesFabHost';

function escapeHtml(s) {
    return String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/"/g, '&quot;');
}

function formatDue(dateStr) {
    try {
        return new Date(dateStr).toLocaleDateString('en-NZ', { month: 'short', day: 'numeric' });
    } catch {
        return dateStr || '—';
    }
}

function ensureShell() {
    let host = document.getElementById(HOST_ID);
    if (host) return host;

    host = document.createElement('div');
    host.id = HOST_ID;
    host.className = 'ai-reserves-fab-host';
    host.hidden = true;
    host.innerHTML =
        '<div class="ai-reserves-fab" id="aiReservesFab">' +
        '<div class="ai-reserves-fab__card" id="aiReservesFabCard" role="dialog" aria-label="AI reserve alerts">' +
        '<div class="ai-reserves-fab__header">' +
        '<span><i class="fas fa-shield-halved" aria-hidden="true"></i> AI Reserve Alert</span>' +
        '<button type="button" class="ai-reserves-fab__close" id="aiReservesFabClose" aria-label="Close">' +
        '<i class="fas fa-xmark" aria-hidden="true"></i>' +
        '</button>' +
        '</div>' +
        '<div class="ai-reserves-fab__summary" id="aiReservesFabSummary"></div>' +
        '<div class="ai-reserves-fab__list" id="aiReservesFabList"></div>' +
        '<a class="ai-reserves-fab__link" href="./recurring-liabilities.html">View full timeline</a>' +
        '</div>' +
        '<button type="button" class="ai-reserves-fab__btn" id="aiReservesFabBtn" aria-label="Toggle reserve alerts">' +
        '<i class="fas fa-bolt" aria-hidden="true"></i>' +
        '<span class="ai-reserves-fab__badge" id="aiReservesFabBadge" hidden></span>' +
        '</button>' +
        '</div>';

    document.body.appendChild(host);

    const card = document.getElementById('aiReservesFabCard');
    const toggle = () => card?.classList.toggle('is-open');
    document.getElementById('aiReservesFabBtn')?.addEventListener('click', toggle);
    document.getElementById('aiReservesFabClose')?.addEventListener('click', () => {
        card?.classList.remove('is-open');
    });
    if (!window.__aiReservesFabTurboHook) {
        window.__aiReservesFabTurboHook = true;
        document.addEventListener('turbo:before-cache', () => {
            card?.classList.remove('is-open');
        });
    }

    return host;
}

function renderAlerts(data) {
    const list = document.getElementById('aiReservesFabList');
    const summary = document.getElementById('aiReservesFabSummary');
    const badge = document.getElementById('aiReservesFabBadge');
    if (!list || !summary) return;

    const alerts = Array.isArray(data?.alerts) ? data.alerts : [];
    const urgent = alerts.filter((a) => a.days_until_due != null && a.days_until_due >= 0 && a.days_until_due <= 7);
    const total7 = Number(data?.summary?.required_reserve_7d || 0);

    summary.innerHTML =
        `<strong>7-day reserve:</strong> $${total7.toFixed(2)}` +
        (urgent.length ? ` · ${urgent.length} due this week` : '');

    list.innerHTML = alerts
        .map((alert) => {
            const src = alert.source === 'email' ? ' · Email' : '';
            const days = alert.days_until_due != null ? `${alert.days_until_due}d` : '—';
            return (
                '<article class="ai-reserves-fab__item">' +
                `<div class="ai-reserves-fab__merchant">${escapeHtml(alert.merchant)}` +
                `<span class="ai-reserves-fab__amount">$${Number(alert.recommended_reserve_amount || 0).toFixed(2)}</span></div>` +
                `<div class="ai-reserves-fab__meta">${days} · Due ${formatDue(alert.expected_next_date)} (${escapeHtml(alert.frequency || '')})${src}</div>` +
                '</article>'
            );
        })
        .join('');

    if (badge) {
        if (urgent.length) {
            badge.hidden = false;
            badge.textContent = String(urgent.length);
        } else {
            badge.hidden = true;
        }
    }
}

export async function mountAiReservesFab(opts = {}) {
    const nav = document.body?.getAttribute('data-portal-nav');
    if (!nav) return;

    const host = ensureShell();
    try {
        const client = createLogtoClient();
        const res = await financeApiFetch(client, '/ai-reserves', {
            method: 'GET',
            headers: { Accept: 'application/json' },
            signal: opts.signal,
        });
        if (opts.signal?.aborted) return;
        if (res.status === 401) {
            host.hidden = true;
            return;
        }
        if (!res.ok) return;
        const data = await res.json();
        if (!data?.alerts?.length) {
            host.hidden = true;
            return;
        }
        renderAlerts(data);
        host.hidden = false;
    } catch (e) {
        if (e?.name === 'AbortError') return;
        console.warn('ai-reserves fab', e);
    }
}
