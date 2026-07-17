import { createLogtoClient } from './logto-client.js';
import { financeApiFetch } from './api.js';
import { visitWithTurbo } from './turbo-visit.js';
import { hrefForStep } from './onboarding-steps.js';

/**
 * The intake step: three tap-card questions asked BEFORE any friction.
 *
 * The point is not the data alone — answering three cheap questions is itself
 * momentum, and it earns the right to ask for a bank connection on the next
 * screen. Each answer has a real consumer, so this is not a survey:
 *   motivation      -> Mintor's coaching tone
 *   primary_goal    -> seeds the goals step, and is quoted on the connect screen
 *   tracking_style  -> orders the connect screen's options
 *
 * Values MUST match finance_api IntakeStep exactly — it is extra="forbid" with
 * Literal fields, so any drift here is a 422 rather than a silent bad write.
 */
export const QUESTIONS = [
    {
        field: 'motivation',
        title: 'What brings you to Mintr?',
        subtitle: 'No wrong answer — it just sets how I talk to you.',
        options: [
            { value: 'save_more', icon: '🌱', label: 'Save more', hint: 'Build something up' },
            { value: 'stop_overspending', icon: '🛑', label: 'Stop overspending', hint: 'Plug the leaks' },
            { value: 'plan_ahead', icon: '🗺️', label: 'Plan ahead', hint: 'Know what is coming' },
            { value: 'understand_spending', icon: '🔍', label: 'Understand my spending', hint: 'See where it goes' },
            { value: 'other', icon: '💭', label: 'Something else', hint: 'I will figure it out with you' }
        ]
    },
    {
        field: 'primary_goal',
        title: "What's the main goal?",
        subtitle: 'Pick the closest one. You can change it any time.',
        options: [
            { value: 'emergency_fund', icon: '🛟', label: 'An emergency fund', hint: 'A buffer for surprises' },
            { value: 'debt_payoff', icon: '⛓️', label: 'Pay off debt', hint: 'Clear what I owe' },
            { value: 'big_purchase', icon: '🏡', label: 'A big purchase', hint: 'House, car, trip' },
            { value: 'retirement', icon: '🌅', label: 'Retirement', hint: 'The long game' },
            { value: 'just_visibility', icon: '👀', label: 'Just want visibility', hint: 'No target yet' }
        ]
    },
    {
        field: 'tracking_style',
        title: 'How do you track money today?',
        subtitle: 'This decides what I set up for you next.',
        options: [
            { value: 'bank_sync', icon: '🏦', label: 'My bank app', hint: 'I check balances there' },
            { value: 'receipts', icon: '🧾', label: 'Receipts', hint: 'I keep the paper' },
            { value: 'manual', icon: '📒', label: 'A spreadsheet', hint: 'By hand' },
            { value: 'not_sure', icon: '🤷', label: 'I do not, really', hint: 'That is why I am here' }
        ]
    }
];

const answers = {};
let index = 0;
let client = null;

const $ = (id) => document.getElementById(id);

function setError(msg) {
    const node = $('intakeError');
    if (node) node.textContent = msg || '';
}

function renderQuestion() {
    const q = QUESTIONS[index];
    if (!q) return;

    const fill = $('intakeProgressFill');
    if (fill) {
        // Endowed progress: the bar is never empty on question 1 — starting at a
        // third rather than zero reads as "already underway", which measurably
        // lifts completion. The aria value stays truthful (1..3).
        fill.style.width = `${Math.round(((index + 1) / QUESTIONS.length) * 100)}%`;
        fill.setAttribute('aria-valuenow', String(index + 1));
    }
    const caption = $('intakeProgressCaption');
    if (caption) caption.textContent = `Question ${index + 1} of ${QUESTIONS.length}`;

    $('intakeTitle').textContent = q.title;
    $('intakeSubtitle').textContent = q.subtitle;
    setError('');

    const wrap = $('intakeOptions');
    wrap.textContent = '';
    q.options.forEach((opt) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'onb-card';
        // Real radio semantics rather than a styled div, so the group is
        // navigable and announced correctly.
        btn.setAttribute('role', 'radio');
        btn.setAttribute('aria-checked', String(answers[q.field] === opt.value));
        btn.dataset.value = opt.value;

        const icon = document.createElement('span');
        icon.className = 'onb-card-icon';
        icon.setAttribute('aria-hidden', 'true');
        icon.textContent = opt.icon;

        const body = document.createElement('span');
        body.className = 'onb-card-body';
        const label = document.createElement('span');
        label.className = 'onb-card-label';
        label.textContent = opt.label;
        const hint = document.createElement('span');
        hint.className = 'onb-card-hint';
        hint.textContent = opt.hint;
        body.append(label, hint);

        btn.append(icon, body);
        btn.addEventListener('click', () => void choose(q.field, opt.value));
        wrap.append(btn);
    });

    // Move focus to the heading so the new question is announced.
    $('intakeTitle').focus();
}

async function choose(field, value) {
    answers[field] = value;
    // Auto-advance: selecting IS the answer. A second "Next" tap would just be
    // ceremony, and it is what makes a 3-question flow feel like 6.
    if (index < QUESTIONS.length - 1) {
        index += 1;
        renderQuestion();
        return;
    }
    await submit();
}

async function submit() {
    const wrap = $('intakeOptions');
    wrap.setAttribute('aria-busy', 'true');
    setError('');
    try {
        const res = await financeApiFetch(client, '/settings/workflow/intake', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data: answers, mark_complete: true })
        });
        if (!res.ok) {
            const body = await res.json().catch(() => null);
            const detail = body?.detail;
            throw new Error(
                typeof detail === 'string'
                    ? detail
                    : Array.isArray(detail)
                      ? detail.map((d) => d?.msg || JSON.stringify(d)).join('; ')
                      : 'Could not save your answers.'
            );
        }
        const body = await res.json();
        goNext(body?.next_step);
    } catch (e) {
        wrap.removeAttribute('aria-busy');
        setError(String(e?.message || 'Could not save your answers. Please try again.'));
    }
}

/**
 * Skip records the step as skipped rather than doing nothing: it has to mark
 * complete or current_step hands the user straight back here, and sending
 * skipped:true makes the skip rate measurable instead of guessed.
 */
async function skip() {
    try {
        const res = await financeApiFetch(client, '/settings/workflow/intake', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data: { skipped: true }, mark_complete: true })
        });
        const body = res.ok ? await res.json().catch(() => null) : null;
        goNext(body?.next_step);
    } catch {
        setError('Could not skip right now. Please try again.');
    }
}

function goNext(step) {
    if (!step || step === 'complete') {
        visitWithTurbo('./dashboard.html', { replace: true });
        return;
    }
    const href = hrefForStep(step, { setup: true });
    if (!href) {
        console.error(`[intake] server requested unknown step "${step}" — no page for it in this build`);
        setError('The next setup step is not available in this version. Please refresh.');
        return;
    }
    visitWithTurbo(href, { replace: true });
}

async function boot() {
    if (document.body?.dataset?.onboardingIntake !== '1') return;
    client = createLogtoClient();
    if (!(await client.isAuthenticated())) {
        window.location.replace('./index.html');
        return;
    }
    $('intakeSkip')?.addEventListener('click', () => void skip());
    renderQuestion();
}

void boot().catch((e) => setError(String(e?.message || 'Could not open this step. Please refresh.')));
