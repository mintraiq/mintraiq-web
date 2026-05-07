import { createLogtoClient } from './logto-client.js';
import { guardSession } from './guard-session.js';
import { financeApiFetch } from './api.js';
import { CONFIG } from './config.js';
import { claimPageScript } from './page-script-guard.js';

/**
 * Budget Planner page — calls authenticated POST {financeApiBase}/budget-plan and renders the plan.
 * Shape matches docs/samples/budget_plan.json (meta, summary, cuts, coach_advice).
 */

let chartInstance = null;
const STATUS_LABELS = {
    GOAL_TOO_AGGRESSIVE: { text: 'GOAL_TOO_AGGRESSIVE', tone: 'critical' },
    GOAL_REACHABLE: { text: 'GOAL_REACHABLE', tone: 'positive' },
    GOAL_PARTIAL: { text: 'GOAL_PARTIAL', tone: 'warning' }
};

function formatCurrency(value, currency = 'NZD') {
    const n = Number(value || 0);
    try {
        return new Intl.NumberFormat(undefined, { style: 'currency', currency, minimumFractionDigits: 2 }).format(n);
    } catch {
        return `$${n.toFixed(2)}`;
    }
}

function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}

function setStatus(text) {
    setText('bpStatus', text || '');
}

function setError(message) {
    const errBox = document.getElementById('bpError');
    if (!errBox) return;
    if (!message) {
        errBox.style.display = 'none';
        errBox.textContent = '';
        return;
    }
    errBox.style.display = 'block';
    errBox.textContent = String(message);
}

function renderRiskBanner(summary) {
    const banner = document.getElementById('bpRiskBanner');
    if (!banner) return;
    const status = String(summary?.status || '').toUpperCase();
    const totalAfter = Number(summary?.total_savings_after_cuts ?? 0);
    if (status === 'GOAL_TOO_AGGRESSIVE' || totalAfter < 0) {
        banner.style.display = 'flex';
        banner.classList.add('is-critical');
        setText('bpRiskTitle', 'MISSION RISK: CRITICAL');
        setText(
            'bpRiskDesc',
            `Your current savings goal of ${formatCurrency(summary?.savings_goal)} is unsustainable. Even with maximum cuts, the projected deficit is ${formatCurrency(totalAfter)}.`
        );
    } else if (status === 'GOAL_PARTIAL') {
        banner.style.display = 'flex';
        banner.classList.remove('is-critical');
        banner.classList.add('is-warning');
        setText('bpRiskTitle', 'MISSION RISK: WARNING');
        setText(
            'bpRiskDesc',
            `Your goal is partially reachable (${formatCurrency(summary?.gap_to_close)} gap). Review suggested cuts.`
        );
    } else {
        banner.style.display = 'none';
        banner.classList.remove('is-critical', 'is-warning');
    }
}

function renderSummary(summary, currency) {
    const el = document.getElementById('bpSummary');
    if (!el) return;
    el.style.display = 'grid';
    setText('bpGap', formatCurrency(summary?.gap_to_close, currency));
    setText('bpIncome', formatCurrency(summary?.monthly_income, currency));
    setText('bpSavings', formatCurrency(summary?.current_savings, currency));

    const status = String(summary?.status || '—').toUpperCase();
    const statusEl = document.getElementById('bpStatusBadge');
    if (statusEl) {
        const tone = STATUS_LABELS[status]?.tone || 'neutral';
        statusEl.textContent = `STATUS: ${STATUS_LABELS[status]?.text || status}`;
        statusEl.dataset.tone = tone;
    }

    const savingsEl = document.getElementById('bpSavings');
    if (savingsEl) {
        savingsEl.classList.remove('bp-amount-green', 'bp-amount-red');
        if (Number(summary?.current_savings ?? 0) < 0) savingsEl.classList.add('bp-amount-red');
        else savingsEl.classList.add('bp-amount-green');
    }
}

function renderCoach(advice) {
    const card = document.getElementById('bpCoachCard');
    if (!card) return;
    if (!advice) {
        card.style.display = 'none';
        return;
    }
    card.style.display = 'flex';
    setText('bpCoachText', String(advice));
}

function impactBarColor(score) {
    if (score >= 0.2) return '#2f80ed';
    if (score >= 0.05) return '#7ee8ff';
    return 'rgba(0, 255, 157, 0.85)';
}

function renderCuts(cuts, currency) {
    const card = document.getElementById('bpCutsCard');
    const tbody = document.querySelector('#bpCutsTable tbody');
    if (!card || !tbody) return;
    const entries = Object.entries(cuts || {});
    if (!entries.length) {
        card.style.display = 'none';
        return;
    }
    card.style.display = 'block';
    tbody.textContent = '';
    entries
        .sort((a, b) => Number(b[1]?.impact_score || 0) - Number(a[1]?.impact_score || 0))
        .forEach(([category, c]) => {
            const tr = document.createElement('tr');
            const impactPct = Math.min(100, Math.round(Number(c?.impact_score || 0) * 100 * 4));
            const color = impactBarColor(Number(c?.impact_score || 0));
            tr.innerHTML =
                `<td><strong>${escapeHtml(category)}</strong></td>` +
                `<td class="align-right">${formatCurrency(c?.original, currency)}</td>` +
                `<td class="align-right" style="color:var(--accent-green)">${formatCurrency(c?.suggested, currency)}</td>` +
                `<td class="align-right" style="color:var(--accent-red)">-${formatCurrency(c?.cut_amount, currency)}</td>` +
                `<td><div class="bp-impact-bar"><span style="width:${impactPct}%;background:${color}"></span></div></td>`;
            tbody.appendChild(tr);
        });
}

function escapeHtml(s) {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/"/g, '&quot;');
}

function renderChart(cuts) {
    const card = document.getElementById('bpChartCard');
    const canvas = document.getElementById('bpChart');
    if (!card || !canvas || !window.Chart) return;
    const entries = Object.entries(cuts || {});
    if (!entries.length) {
        card.style.display = 'none';
        return;
    }
    card.style.display = 'block';
    const labels = entries.map(([k]) => k);
    const original = entries.map(([, v]) => Number(v?.original || 0));
    const suggested = entries.map(([, v]) => Number(v?.suggested || 0));

    if (chartInstance) {
        chartInstance.destroy();
        chartInstance = null;
    }

    chartInstance = new window.Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: {
            labels,
            datasets: [
                {
                    label: 'Current Spending',
                    data: original,
                    backgroundColor: 'rgba(255,255,255,0.18)',
                    borderColor: 'rgba(255,255,255,0.32)',
                    borderWidth: 1
                },
                {
                    label: 'Ninja Suggested',
                    data: suggested,
                    backgroundColor: 'rgba(0,255,157,0.85)',
                    borderColor: 'rgba(0,255,157,1)',
                    borderWidth: 1
                }
            ]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'top', labels: { color: '#cfd6e4' } },
                tooltip: {
                    callbacks: {
                        label: (ctx) => `${ctx.dataset.label}: ${formatCurrency(ctx.parsed.x)}`
                    }
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    ticks: { color: '#a0a0a0', callback: (v) => `$${v}` },
                    grid: { color: 'rgba(255,255,255,0.05)' }
                },
                y: {
                    ticks: { color: '#cfd6e4' },
                    grid: { color: 'rgba(255,255,255,0.04)' }
                }
            }
        }
    });
}

function renderPeriod(meta) {
    const period = meta?.period ? `Period: ${meta.period}` : '';
    const ver = meta?.engine_version ? ` · engine ${meta.engine_version}` : '';
    setText('bpPeriod', period + ver);
}

function readGoal() {
    const el = document.getElementById('bpGoal');
    const v = el && 'value' in el ? Number(el.value) : 0;
    return Number.isFinite(v) && v > 0 ? v : 1000;
}

async function loadPlan(client) {
    setError('');
    setStatus('Loading plan…');

    const goal = readGoal();
    const candidatePaths = ['/budget-planner', 'budget-planner'];
    const payload = { savings_goal: goal };
    let lastErr = null;

    for (const path of candidatePaths) {
        try {
            const res = await financeApiFetch(client, path, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
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
                lastErr = new Error(`${path}: ${msg}`);
                if (res.status === 404) continue;
                throw lastErr;
            }

            const currency = data?.meta?.currency || 'NZD';
            renderRiskBanner(data?.summary || {});
            renderChart(data?.cuts || {});
            renderSummary(data?.summary || {}, currency);
            renderCoach(data?.coach_advice || '');
            renderPeriod(data?.meta || {});
            renderCuts(data?.cuts || {}, currency);

            const base = CONFIG.financeApiBase.replace(/\/$/, '');
            setStatus(`Loaded from ${base}${path} · goal ${formatCurrency(goal, currency)}`);
            return;
        } catch (e) {
            lastErr = e;
            console.error('budget-planner', path, e);
        }
    }
    setStatus('');
    throw lastErr || new Error('Budget plan endpoint not available.');
}

async function main() {
    if (!claimPageScript('budget-planner-main')) return;
    if (!(await guardSession())) return;
    const client = createLogtoClient();

    document.getElementById('bpReload')?.addEventListener('click', async () => {
        try {
            await loadPlan(client);
        } catch (e) {
            console.error(e);
            setError(String(e.message || e));
        }
    });

    document.getElementById('bpGoal')?.addEventListener('change', async () => {
        try {
            await loadPlan(client);
        } catch (e) {
            setError(String(e.message || e));
        }
    });

    try {
        await loadPlan(client);
    } catch (e) {
        console.error(e);
        setError(String(e.message || e));
    }
}

main();
