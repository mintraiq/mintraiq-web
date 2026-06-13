import { createLogtoClient } from './logto-client.js';
import { guardSession } from './guard-session.js';
import { financeApiFetch } from './api.js';
import { getLegalContent } from './legal-store.js';
import {
    mountPlannerDataBasisModal,
    resolvePlannerDataBasis,
    setPlannerDataBasisEnabled,
    wirePlannerDataBasisButton
} from './planner-data-basis.js';

let lastPlanData = null;

/**
 * Weekly Planner page — calls authenticated GET {financeApiBase}/weekly-planner.
 * Shape matches docs/samples/weekly_plan.json (meta, user, summary, goal_progress,
 * categories, daily_planner, ai_coach, tips, fixed_costs, alert).
 */

function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}

function setStatus(text) {
    setText('wpStatus', text || '');
}

function setInsightsFooter(text) {
    const el = document.getElementById('weeklyInsightsFooter');
    if (!el) return;
    el.textContent = text || getLegalContent()?.content?.insights_footer || '';
}

function setError(message) {
    const errBox = document.getElementById('wpError');
    const msgEl = document.getElementById('wpErrorMsg');
    if (!errBox) return;
    if (!message) {
        errBox.classList.remove('is-visible');
        return;
    }
    if (msgEl) msgEl.textContent = String(message);
    errBox.classList.add('is-visible');
}

function friendlyErrorMessage(error) {
    const raw = String((error && (error.message || error)) || '').trim();
    if (!raw) return 'Something went wrong. Please try again in a moment.';
    if (/method not allowed/i.test(raw) || /\b405\b/.test(raw)) {
        return 'This planner is temporarily unavailable. Please try again shortly.';
    }
    if (/network|failed to fetch|load failed/i.test(raw)) {
        return 'We couldn\u2019t reach our servers. Check your connection and try again.';
    }
    if (/\b5\d{2}\b/.test(raw)) {
        return 'Our service is having a moment. Please try again shortly.';
    }
    if (/\b401\b/i.test(raw)) {
        return 'Your session has expired. Please sign in again.';
    }
    return raw.replace(/^\/[\w\-/]+:\s*/, '');
}

function escapeHtml(s) {
    return String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/"/g, '&quot;');
}

function statusToneClass(color) {
    switch (String(color || '').toLowerCase()) {
        case 'success':
            return 'is-success';
        case 'warning':
            return 'is-warning';
        case 'danger':
        case 'critical':
            return 'is-danger';
        default:
            return 'is-neutral';
    }
}

function renderMission(meta, goalProgress) {
    setText('wpWeekLabel', meta?.week_label || 'Week of —');
    const pill = document.getElementById('wpStatusPill');
    if (pill) {
        pill.textContent = goalProgress?.status_label || '—';
        pill.className = `wp-status-pill ${statusToneClass(goalProgress?.status_color)}`;
    }
}

function renderDayStrip(planner) {
    const strip = document.getElementById('wpDayStrip');
    if (!strip) return;
    const days = Array.isArray(planner) ? planner : [];
    strip.textContent = '';
    days.forEach((d) => {
        const item = document.createElement('div');
        const status = String(d?.status || '').toLowerCase();
        item.className = `wp-day ${status === 'today' || d?.is_today ? 'is-today' : ''} ${status === 'past' ? 'is-past' : ''}`.trim();
        const amount = typeof d?.daily_budget === 'number' ? `$${d.daily_budget.toFixed(2)}` : (d?.daily_budget ?? '');
        item.innerHTML =
            `<div class="wp-day-name">${escapeHtml(String(d?.day || '').toUpperCase())}</div>` +
            `<div class="wp-day-date">${escapeHtml(d?.date)}</div>` +
            `<div class="wp-day-amount">${escapeHtml(amount)}</div>` +
            (d?.is_today ? '<span class="wp-day-active">ACTIVE</span>' : '');
        strip.appendChild(item);
    });
}

function renderProgress(goalProgress, user) {
    const pct = Math.max(0, Math.min(100, Number(goalProgress?.percentage ?? 0)));
    setText('wpProgressPct', `${pct.toFixed(1)}%`);
    const target = Number(goalProgress?.target_monthly ?? user?.savings_goal_monthly ?? 0);
    const achieved = Number(goalProgress?.achieved_monthly ?? 0);
    setText('wpProgressTarget', `Target $${achieved.toFixed(2)} / $${target.toFixed(0)}`);
    const fill = document.getElementById('wpProgressFill');
    if (fill) fill.style.width = `${pct}%`;
}

function renderStat(prefix, summary) {
    if (!summary) return;
    setText(`wpStat${prefix}Label`, summary.label || '');
    setText(`wpStat${prefix}Value`, summary.value || '—');
    setText(`wpStat${prefix}Sub`, summary.sublabel || '');
}

function renderStats(summary) {
    renderStat('Budget', summary?.total_weekly_budget);
    renderStat('Daily', summary?.daily_allowance);
    renderStat('Save', summary?.weekly_saving);
    renderStat('Impact', summary?.monthly_saving);
}

function renderCoach(coach) {
    setText('wpCoachAvatar', coach?.avatar_emoji || '🤖');
    setText('wpCoachName', coach?.coach_name || 'FinBot');
    setText('wpCoachMsg', coach?.message || '—');
}

function badgeToneClass(color) {
    switch (String(color || '').toLowerCase()) {
        case 'success':
            return 'is-success';
        case 'warning':
            return 'is-warning';
        case 'danger':
            return 'is-danger';
        default:
            return 'is-neutral';
    }
}

function renderSectors(categories) {
    const card = document.getElementById('wpSectorCard');
    const tbody = document.querySelector('#wpSectorTable tbody');
    if (!card || !tbody) return;
    const rows = Array.isArray(categories) ? categories : [];
    if (!rows.length) {
        card.style.display = 'none';
        return;
    }
    card.style.display = 'block';
    tbody.textContent = '';
    rows.forEach((c) => {
        const tr = document.createElement('tr');
        const badgeLabel = c?.badge?.label;
        const badgeClass = badgeToneClass(c?.badge?.color);
        const savedClass = c?.has_cut ? 'wp-saving wp-saving--win' : 'wp-saving';
        tr.innerHTML =
            `<td>` +
            `<div class="wp-cat"><span class="wp-cat-emoji">${escapeHtml(c?.emoji || '📌')}</span>` +
            `<strong>${escapeHtml(c?.name || c?.id || '')}</strong>` +
            (badgeLabel ? `<span class="wp-badge ${badgeClass}">${escapeHtml(badgeLabel)}</span>` : '') +
            `</div></td>` +
            `<td>${escapeHtml(c?.weekly_budget || '—')}</td>` +
            `<td>${escapeHtml(c?.daily_allowance || '—')}</td>` +
            `<td><span class="${savedClass}">${escapeHtml(c?.monthly_saving || '$0.00/month saved')}</span></td>` +
            `<td><em class="wp-tip">${escapeHtml(c?.tip || 'Track this carefully')}</em></td>`;
        tbody.appendChild(tr);
    });
}

function renderFixedNote(fixed) {
    if (!fixed) {
        setText('wpFixedNote', '');
        return;
    }
    const list = Array.isArray(fixed.excluded_list) ? fixed.excluded_list.join(', ') : '';
    const note = fixed.note ? String(fixed.note) : '';
    setText('wpFixedNote', list ? `${note} (${list})` : note);
}

function renderAlert(alert) {
    const box = document.getElementById('wpAlert');
    if (!box) return;
    if (!alert?.show) {
        box.style.display = 'none';
        return;
    }
    box.style.display = 'flex';
    box.dataset.tone = String(alert?.type || 'warning');
    setText('wpAlertIcon', alert?.icon || '⚠️');
    setText('wpAlertMsg', alert?.message || '');
}

function showSections() {
    const ids = ['wpTopGrid', 'wpMidGrid', 'wpStats'];
    ids.forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.style.display = '';
    });
}

async function loadPlan(client, signal) {
    setError('');
    setStatus('Loading plan…');

    const path = '/weekly-planner';

    try {
        const res = await financeApiFetch(client, path, {
            method: 'GET',
            headers: { Accept: 'application/json' }
        });
        if (signal?.aborted) return;
        const text = await res.text();
        let data;
        try {
            data = text ? JSON.parse(text) : {};
        } catch {
            throw new Error(`Non-JSON response (${res.status}): ${text.slice(0, 200)}`);
        }
        if (res.status === 401) {
            window.location.replace('./index.html');
            return;
        }
        if (!res.ok) {
            const detail = data?.detail;
            const msg =
                typeof detail === 'string'
                    ? detail
                    : Array.isArray(detail)
                      ? detail.map((d) => d.msg || JSON.stringify(d)).join('; ')
                      : data?.message || `Request failed (${res.status})`;
            throw new Error(`${path}: ${msg}`);
        }

        if (signal?.aborted) return;

        renderAlert(data?.alert);
        renderMission(data?.meta || {}, data?.goal_progress || {});
        renderDayStrip(data?.daily_planner || []);
        renderProgress(data?.goal_progress || {}, data?.user || {});
        renderStats(data?.summary || {});
        renderCoach(data?.ai_coach || {});
        renderSectors(data?.categories || []);
        renderFixedNote(data?.fixed_costs);
        setInsightsFooter(data?.insights_footer || '');
        showSections();
        lastPlanData = data;
        setPlannerDataBasisEnabled('wpDataBasis', true);
        setStatus(data?.meta?.generated_at ? `Updated ${data.meta.generated_at}` : '');
    } catch (e) {
        if (signal?.aborted) return;
        console.error('weekly-planner', e);
        setInsightsFooter('');
        setPlannerDataBasisEnabled('wpDataBasis', false);
        setStatus('');
        throw e;
    }
}

/**
 * @param {{ signal?: AbortSignal }} [opts]
 */
export async function bootWeeklyPlannerPage(opts = {}) {
    const { signal } = opts;
    if (signal?.aborted) return;
    if (!(await guardSession())) return;
    if (signal?.aborted) return;
    const client = createLogtoClient();
    mountPlannerDataBasisModal();
    wirePlannerDataBasisButton(
        'wpDataBasis',
        () => resolvePlannerDataBasis(lastPlanData, 'weekly'),
        { signal }
    );

    const reload = async () => {
        try {
            await loadPlan(client, signal);
        } catch (e) {
            if (signal?.aborted) return;
            setError(friendlyErrorMessage(e));
        }
    };

    document.getElementById('wpReload')?.addEventListener('click', reload, { signal });
    document.getElementById('wpErrorRetry')?.addEventListener('click', reload, { signal });

    await reload();
}
