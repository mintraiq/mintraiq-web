import { createLogtoClient } from './logto-client.js';
import { financeApiFetch } from './api.js';
import { visitWithTurbo } from './turbo-visit.js';
import { hrefForStep } from './onboarding-steps.js';
import { FEAT_EMAIL_CONNECTOR, getEntitlementProfile, hasFeature, loadEntitlementProfile } from './entitlements.js';

/**
 * The connect step: the one ask that makes the product work.
 *
 * Soft-mandatory by design — always shown, always the last core step, but
 * satisfied by ANY path. The server derives `connect` from the data itself
 * (Akahu token, transactions, receipts, email credentials), so none of these
 * routes need to report back here; landing on the destination and doing the
 * thing is what completes the step.
 *
 * The escape hatch is real but quiet: it records skipped:true so the skip rate
 * is measurable, and it must mark the step complete or current_step would hand
 * the user straight back here.
 */
export const PATHS = [
    {
        id: 'bank_sync',
        href: './settings-banks.html?setup=1',
        icon: '🏦',
        label: 'Connect my bank',
        hint: 'Read-only via Akahu. ASB, ANZ, BNZ, Westpac, Kiwibank.'
    },
    {
        id: 'receipts',
        href: './receipt-scanner.html?setup=1',
        icon: '🧾',
        label: 'Scan a receipt',
        hint: 'Start with one. Good if you mostly pay cash.'
    },
    {
        id: 'manual',
        href: './upload-statement.html?setup=1',
        icon: '📄',
        label: 'Upload a statement',
        hint: 'A PDF or CSV export from your bank.'
    },
    {
        id: 'email',
        href: './settings-email.html?setup=1',
        icon: '📧',
        label: 'Connect my email',
        hint: 'We read bank statements only — nothing else.',
        feature: FEAT_EMAIL_CONNECTOR
    }
];

/** Quote the user's own goal back at them, so the ask is in their terms. */
const GOAL_FRAMING = {
    emergency_fund: 'Connect once and I can track your emergency fund without you lifting a finger.',
    debt_payoff: 'Connect once and I can watch your debt come down without you doing the maths.',
    big_purchase: 'Connect once and I can tell you when your big purchase is actually within reach.',
    retirement: 'Connect once and I can show you what today’s spending does to the long game.',
    just_visibility: 'Connect once and the whole picture shows up on its own — no spreadsheets.'
};

const DEFAULT_FRAMING = 'Pick whichever fits. You can add the others later.';

let client = null;

const $ = (id) => document.getElementById(id);

function setError(msg) {
    const node = $('connectError');
    if (node) node.textContent = msg || '';
}

/** The intake answers, if the user gave them. Absent is fine — this is optional. */
async function loadIntake() {
    try {
        const res = await financeApiFetch(client, '/settings/workflow/intake');
        if (!res.ok) return {};
        const body = await res.json();
        return body?.data || {};
    } catch {
        return {};
    }
}

async function visiblePaths() {
    let profile = getEntitlementProfile();
    if (!profile) {
        try {
            profile = await loadEntitlementProfile(client, financeApiFetch);
        } catch {
            profile = null;
        }
    }
    // Only hide a gated path when we know the entitlement is absent; if the
    // profile failed to load, show it rather than silently narrowing options.
    return PATHS.filter((p) => !p.feature || !profile || hasFeature(profile, p.feature));
}

/** Put the path matching their stated habit first — the rest keep their order. */
function orderPaths(paths, trackingStyle) {
    if (!trackingStyle || trackingStyle === 'not_sure') return paths;
    const preferred = paths.filter((p) => p.id === trackingStyle);
    return preferred.length ? [...preferred, ...paths.filter((p) => p.id !== trackingStyle)] : paths;
}

function renderPaths(paths) {
    const wrap = $('connectOptions');
    wrap.textContent = '';
    paths.forEach((path, i) => {
        const a = document.createElement('a');
        a.className = 'onb-card';
        a.href = path.href;
        if (i === 0) a.dataset.recommended = '1';

        const icon = document.createElement('span');
        icon.className = 'onb-card-icon';
        icon.setAttribute('aria-hidden', 'true');
        icon.textContent = path.icon;

        const body = document.createElement('span');
        body.className = 'onb-card-body';
        const label = document.createElement('span');
        label.className = 'onb-card-label';
        label.textContent = path.label;
        const hint = document.createElement('span');
        hint.className = 'onb-card-hint';
        hint.textContent = path.hint;
        body.append(label, hint);

        a.append(icon, body);
        wrap.append(a);
    });
}

async function skip() {
    const btn = $('connectSkip');
    if (btn) btn.disabled = true;
    setError('');
    try {
        const res = await financeApiFetch(client, '/settings/workflow/connect', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data: { skipped: true }, mark_complete: true })
        });
        if (!res.ok) throw new Error('Could not skip this step.');
        const body = await res.json().catch(() => null);
        const step = body?.next_step;
        if (!step || step === 'complete') {
            visitWithTurbo('./dashboard.html', { replace: true });
            return;
        }
        const href = hrefForStep(step, { setup: true });
        if (!href) {
            console.error(`[connect] server requested unknown step "${step}" — no page for it in this build`);
            visitWithTurbo('./dashboard.html', { replace: true });
            return;
        }
        visitWithTurbo(href, { replace: true });
    } catch (e) {
        if (btn) btn.disabled = false;
        setError(String(e?.message || 'Could not skip right now. Please try again.'));
    }
}

async function boot() {
    if (document.body?.dataset?.onboardingConnect !== '1') return;
    client = createLogtoClient();
    if (!(await client.isAuthenticated())) {
        window.location.replace('./index.html');
        return;
    }

    $('connectSkip')?.addEventListener('click', () => void skip());

    const intake = await loadIntake();
    const subtitle = $('connectSubtitle');
    if (subtitle) subtitle.textContent = GOAL_FRAMING[intake.primary_goal] || DEFAULT_FRAMING;

    renderPaths(orderPaths(await visiblePaths(), intake.tracking_style));
}

void boot().catch((e) => setError(String(e?.message || 'Could not open this step. Please refresh.')));
