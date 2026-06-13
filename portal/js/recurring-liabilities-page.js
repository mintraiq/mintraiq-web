import { createLogtoClient } from './logto-client.js';
import { guardSession } from './guard-session.js';
import { financeApiFetch } from './api.js';

function escapeHtml(s) {
    return String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/"/g, '&quot;');
}

function setStatus(text) {
    const el = document.getElementById('rlStatus');
    if (el) el.textContent = text || '';
}

function urgencyTone(days) {
    if (days == null) return 'neutral';
    if (days < 0 || days <= 3) return 'critical';
    if (days <= 7) return 'warning';
    return 'neutral';
}

function renderHero(summary) {
    const hero = document.getElementById('rlHero');
    if (!hero) return;
    const total7 = Number(summary?.required_reserve_7d || 0);
    const urgent = Number(summary?.urgent_count_7d || 0);
    hero.hidden = false;
    hero.innerHTML =
        '<div class="ai-reserves-hero__label"><i class="fas fa-shield-halved"></i> 7-DAY REQUIRED RESERVE</div>' +
        `<div class="ai-reserves-hero__amount">$${total7.toFixed(2)}</div>` +
        `<p class="ai-reserves-hero__note">Keep this liquid for ${urgent} upcoming deduction${urgent === 1 ? '' : 's'}.</p>`;
}

function renderList(alerts) {
    const list = document.getElementById('rlList');
    if (!list) return;
    if (!alerts.length) {
        list.innerHTML =
            '<div class="portal-page-error is-visible" style="margin-top:12px">' +
            '<p>No recurring payments detected yet. Upload statements or connect email in Settings.</p>' +
            '<a class="portal-page-error-retry" href="./settings-email.html">Connect email</a>' +
            '</div>';
        return;
    }
    list.innerHTML = alerts
        .map((a) => {
            const tone = urgencyTone(a.days_until_due);
            const src = a.source === 'email' ? 'Email' : 'Bank';
            return (
                '<article class="ai-reserves-card ai-reserves-card--' + tone + '">' +
                `<div class="ai-reserves-card__days">${a.days_until_due ?? '—'}<span>days</span></div>` +
                '<div class="ai-reserves-card__body">' +
                `<div class="ai-reserves-card__cat">${escapeHtml(a.category || 'Bill')}</div>` +
                `<div class="ai-reserves-card__merchant">${escapeHtml(a.merchant)}</div>` +
                `<div class="ai-reserves-card__meta">Due ${escapeHtml(a.expected_next_date)} · ${escapeHtml(a.frequency)} · ${src}</div>` +
                '</div>' +
                `<div class="ai-reserves-card__amt">$${Number(a.recommended_reserve_amount || 0).toFixed(2)}</div>` +
                '</article>'
            );
        })
        .join('');
}

async function loadReserves(client, refresh = false) {
    setStatus(refresh ? 'Re-scanning bank patterns…' : 'Loading reserves…');
    const path = refresh ? '/ai-reserves?refresh=true' : '/ai-reserves';
    const res = await financeApiFetch(client, path, {
        method: 'GET',
        headers: { Accept: 'application/json' },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.detail || 'Could not load reserves');
    renderHero(data.summary || {});
    renderList(data.alerts || []);
    const sources = data?.meta?.sources || {};
    setStatus(
        `Updated ${data?.meta?.generated_at || 'now'} · Bank ${sources.bank_statement || 0} · Email ${sources.email || 0}`
    );
}

export async function bootRecurringLiabilitiesPage(opts = {}) {
    const { signal } = opts;
    if (signal?.aborted) return;
    if (!(await guardSession())) return;
    const client = createLogtoClient();

    const reload = async (refresh = false) => {
        try {
            await loadReserves(client, refresh);
        } catch (e) {
            if (signal?.aborted) return;
            setStatus('');
            console.error('recurring-liabilities', e);
        }
    };

    document.getElementById('rlRefresh')?.addEventListener('click', () => reload(true), { signal });
    await reload(false);
}
