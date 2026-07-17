/**
 * Onboarding harness — renders the real intake questions and connect paths with
 * no auth and no network.
 *
 * QUESTIONS and PATHS are imported from the production modules rather than
 * copied, so this harness cannot drift from what users actually see. Importing
 * those modules is safe: each one's boot() checks its own body dataset flag
 * first and returns early here.
 *
 * ?view=intake (default) | connect
 * ?q=0|1|2  — which intake question to render
 */
import { QUESTIONS } from '../js/onboarding-intake.js';
import { PATHS } from '../js/onboarding-connect.js';

const params = new URLSearchParams(window.location.search);
const view = params.get('view') || 'intake';
const $ = (id) => document.getElementById(id);

function card({ icon, label, hint, checked = false, href = null }) {
    const el = document.createElement(href ? 'a' : 'button');
    el.className = 'onb-card';
    if (href) {
        el.href = href;
    } else {
        el.type = 'button';
        el.setAttribute('role', 'radio');
        el.setAttribute('aria-checked', String(checked));
    }

    const i = document.createElement('span');
    i.className = 'onb-card-icon';
    i.setAttribute('aria-hidden', 'true');
    i.textContent = icon;

    const body = document.createElement('span');
    body.className = 'onb-card-body';
    const l = document.createElement('span');
    l.className = 'onb-card-label';
    l.textContent = label;
    const h = document.createElement('span');
    h.className = 'onb-card-hint';
    h.textContent = hint;
    body.append(l, h);

    el.append(i, body);
    return el;
}

function renderIntake() {
    const index = Number(params.get('q') || 0);
    const q = QUESTIONS[index] || QUESTIONS[0];

    $('harnessProgressFill').style.width = `${Math.round(((index + 1) / QUESTIONS.length) * 100)}%`;
    $('harnessProgressFill').setAttribute('aria-valuenow', String(index + 1));
    $('harnessProgressCaption').textContent = `Question ${index + 1} of ${QUESTIONS.length}`;
    $('harnessTitle').textContent = q.title;
    $('harnessSubtitle').textContent = q.subtitle;
    $('harnessSkip').textContent = 'Skip these questions';

    const wrap = $('harnessOptions');
    wrap.textContent = '';
    q.options.forEach((opt, i) => {
        const el = card({ ...opt, checked: i === 0 && params.get('checked') === '1' });
        el.addEventListener('click', () => {
            wrap.querySelectorAll('.onb-card').forEach((c) => c.setAttribute('aria-checked', 'false'));
            el.setAttribute('aria-checked', 'true');
        });
        wrap.append(el);
    });
}

function renderConnect() {
    $('harnessProgressFill').style.width = '100%';
    $('harnessProgressFill').setAttribute('aria-valuenow', '3');
    $('harnessProgressFill').setAttribute('aria-valuemin', '0');
    $('harnessProgressCaption').textContent = 'Step 3 of 3 — last one';
    $('harnessTitle').textContent = 'Connect your money';
    $('harnessSubtitle').textContent =
        'Connect once and I can track your emergency fund without you lifting a finger.';
    $('harnessSkip').textContent = "I'll do this later";

    const wrap = $('harnessOptions');
    wrap.removeAttribute('role');
    wrap.textContent = '';
    PATHS.forEach((p) => wrap.append(card(p)));
}

if (view === 'connect') renderConnect();
else renderIntake();
