import { isBootstrapOnboardingComplete } from './config.js';
import { createLogtoClient } from './logto-client.js';
import { financeApiFetch } from './api.js';
import { mountBillingPlanCompare, normalizeBillingTierValue } from './billing-plan-compare.js';
import { visitWithTurbo } from './turbo-visit.js';
import { resolveDisplayName } from './user-display.js';

/**
 * Order must match finance_api bootstrap REQUIRED / save_workflow next_step:
 * profile → billing → security → banks → goals → categories → ai → notifications
 * Backend CORS must include PUT in allow_methods or browser preflight fails (OPTIONS 400) and nothing persists.
 */
const DEFAULT_FLOW_STEPS = [
    { id: 'profile', href: './settings-profile.html', label: 'Personal profile', chapter: 'The Essentials' },
    { id: 'billing', href: './settings-billing.html', label: 'Plan & billing', chapter: 'The Essentials' },
    { id: 'security', href: './settings-security.html', label: 'Security', chapter: 'The Essentials' },
    { id: 'banks', href: './settings-banks.html', label: 'Banks & income', chapter: 'The Data' },
    { id: 'goals', href: './settings-goals.html', label: 'Savings goals', chapter: 'The Game Plan' },
    { id: 'categories', href: './settings-categories.html', label: 'Custom categories', chapter: 'The Game Plan' },
    { id: 'ai', href: './settings-ai.html', label: 'AI tuning', chapter: 'The Game Plan' },
    { id: 'notifications', href: './settings-notifications.html', label: 'Notifications', chapter: 'The Game Plan' }
];

const OPTIONAL_STEPS = new Set(['goals', 'notifications', 'categories', 'ai']);
const STEP_INTERSTITIAL = {
    banks: 'Saving your bank preferences…',
    billing: 'Saving your plan choice…',
    goals: 'Saving your goals…',
    categories: 'Saving your category picks…',
    ai: 'Saving how you like to be coached…'
};
/** One-line hint when revisiting Settings outside guided onboarding (?setup=1). */
const STEP_BENEFIT_COPY = {
    profile:
        'A name and currency help us frame numbers in a way that makes sense to you. This is a small step — and it goes a long way toward useful guidance.',
    security:
        'A quick safety check so you feel confident before anything sensitive connects. You can tighten this further whenever you like.',
    banks:
        'Tell us whether you prefer a bank link or uploading statements on your own schedule. Either way helps us spot patterns and traps — no wrong answer.',
    billing:
        "MintrAIQ works hard so you don't have to, but we're not high-maintenance. Stay on Free for as long as you like. We're just happy to be here.",
    goals:
        'Goals are not a test. A rough direction helps us align with what matters; skip or guess and refine whenever you like.',
    categories:
        'Telling us what categories matter helps the coach speak your language. No need to get exhaustive; a few taps is enough, or skip and we will learn as you go.',
    ai:
        'Choose a tone that feels supportive, not stressful. This only changes how we talk — you are always in control.',
    notifications:
        'Optional nudges when something drifts. Defaults are gentle; turn things off if you prefer a quieter experience.'
};

/**
 * Mintr voice for guided onboarding only (no API changes).
 * `dialogue` receives `{ displayName }` — use textContent when rendering; personalize on profile step.
 */
const MINTR_COACH_COPY = {
    profile: {
        dialogue: ({ displayName }) =>
            `Nice to meet you, ${displayName}! To build a Game Plan that actually fits your life, I just need a few basic details. I promise to keep the paperwork light.`,
        tip: 'We personalize everything from here — and we keep the paperwork light.'
    },
    billing: {
        dialogue: () =>
            'Here is the meaty part. Stay on the Free tier as long as you like! If you want me to do the heavy lifting with premium AI features, pick a plan that fits your comfort level.',
        tip: 'No pressure to upgrade. Free is real — upgrade only when it feels right.'
    },
    security: {
        dialogue: () =>
            "Let's lock the vault. Think of this as putting a digital guard dog at your door. He doesn't bark; he just checks IDs to keep the bad guys out.",
        tip: 'MFA is worth the extra tap — it keeps strangers out of your financial life.'
    },
    banks: {
        dialogue: () =>
            'Time to connect the dots. Linking your bank gives me the read-only data I need to find your hidden savings and spot trends. It is fast, secure, and fully under your control.',
        tip: 'This is the highest-friction step — and the one that unlocks the clearest picture of your money.'
    },
    goals: {
        dialogue: () =>
            'What are we aiming for? A rainy-day fund? A new car? Tell me your target, and I will build the roadmap to get us there.',
        tip: 'We are shifting from tracking what happened to steering where you want to go.'
    },
    categories: {
        dialogue: () =>
            "I am pretty smart, but I am not a mind reader! Tell me if that 'Midnight Snack' should be 'Groceries' or 'Regret.' It helps me learn your style.",
        tip: 'You are training your coach — a few picks now saves corrections later.'
    },
    ai: {
        dialogue: () =>
            "How should I talk to you? Choose Strict Coach if you need a kick in the pants, or Chill Friend if you just want the facts with zero judgment.",
        tip: 'You are always in control of tone — nothing bossy unless you ask for it.'
    },
    notifications: {
        dialogue: () =>
            'How should I nudge you? I can be a silent observer or a helpful chime when you are doing great. I promise never to spam you with nonsense.',
        tip: 'We respect your attention — opt in to what actually helps.'
    }
};
const FLOW_PAUSE_COPY =
    'Pausing is fine — pick up anytime from Settings. Nothing here locks you in.';

/** Former page-header intro (now shown inside the Mintr tip card; nav shows the step name). */
const MINTR_TIP_INTRO = {
    profile:
        'A few basics so Mintr can frame your Game Plan in the currency you think in. You can edit this anytime.',
    billing:
        'Choose your path — compare what each license includes. You can change later; Free stays on the table.',
    security: 'A calm checkpoint so your financial space stays yours. Adjust stricter controls whenever you like.',
    banks: 'This is the heart of clearer insights: with a bit of real context we can highlight behaviour and traps. Connect when it feels right — you can add more later.',
    goals: 'No perfect answer needed — even a rough aim helps us steer nudges toward what you care about. Skip or come back when you are ready.',
    categories:
        'Optional: tap what matters so coaching sounds like your life, not a spreadsheet. Fine to skip — we learn as you go.',
    ai: 'Choose a tone that feels supportive. This only changes how we talk — you stay in charge. Skip for now if you prefer the defaults.',
    notifications:
        'Gentle heads-ups when something drifts — or keep things quiet. You can tune this later; skipping is OK.'
};

/** Short Mintr Tip line per step (paired with intro above). */
const MINTR_TIP_LINE = {
    profile:
        'Setting your name and currency here helps me frame your numbers in a way that makes sense to you.',
    billing:
        'Stay on Free as long as you like — choose a paid plan only when you want premium AI features.',
    security: 'Multi-factor sign-in is the digital guard dog: quick for you, hard for strangers.',
    banks: 'Read-only bank links or uploads are how I spot trends and hidden savings — always your call.',
    goals: 'A concrete target turns tracking into a roadmap toward what you actually want.',
    categories: 'A few category hints teach me your vocabulary so corrections drop over time.',
    ai: 'Pick a tone that feels supportive — strict coach or chill friend, you stay in charge.',
    notifications: 'Choose nudges that respect your attention — helpful chimes, not spam.'
};

const DRAFT_KEY_BASE = 'mintraiq_settings_workflow_draft_v1';
const MODE_KEY_BASE = 'mintraiq_settings_workflow_mode_v1';

function patchSessionBootstrap(partial) {
    try {
        const raw = sessionStorage.getItem('mintraiq_bootstrap');
        const b = raw ? JSON.parse(raw) : {};
        if (!b || typeof b !== 'object') return;
        Object.assign(b, partial);
        sessionStorage.setItem('mintraiq_bootstrap', JSON.stringify({ ...b, at: Date.now() }));
        queueMicrotask(() => {
            if (typeof window !== 'undefined' && document.getElementById('settings-nav-root')) {
                window.dispatchEvent(new CustomEvent('mint:bootstrap-ready'));
            }
        });
    } catch {
        /* ignore */
    }
}

function parseJsonSafe(raw) {
    if (!raw) return null;
    try {
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

function readBootstrap() {
    return parseJsonSafe(sessionStorage.getItem('mintraiq_bootstrap'));
}

function scopedStorageKey(base) {
    const b = readBootstrap();
    const uid = String(b?.profile?.user_id || b?.profile?.email || 'anon').trim();
    return `${base}:${uid}`;
}

function titleFromStep(stepId) {
    const byId = {
        profile: 'Personal profile',
        security: 'Security',
        billing: 'Plan & billing',
        banks: 'Banks & income',
        goals: 'Savings goals',
        categories: 'Custom categories',
        ai: 'AI advisor settings',
        notifications: 'Alerts & nudges'
    };
    return byId[stepId] || String(stepId || '');
}

function deriveFlowSteps(bootstrap) {
    const chapters = bootstrap?.onboarding?.chapters;
    if (!Array.isArray(chapters) || !chapters.length) return DEFAULT_FLOW_STEPS;
    const out = [];
    chapters.forEach((chapter) => {
        const chapterTitle = String(chapter?.title || chapter?.id || 'Setup');
        const steps = Array.isArray(chapter?.steps) ? chapter.steps : [];
        steps.forEach((stepIdRaw) => {
            const stepId = String(stepIdRaw || '').trim();
            if (!stepId) return;
            out.push({
                id: stepId,
                href: `./settings-${stepId}.html`,
                label: titleFromStep(stepId),
                chapter: chapterTitle
            });
        });
    });
    return out.length ? out : DEFAULT_FLOW_STEPS;
}

function activeFlowSteps() {
    return deriveFlowSteps(readBootstrap());
}

function readDraft() {
    return parseJsonSafe(sessionStorage.getItem(scopedStorageKey(DRAFT_KEY_BASE))) || {};
}

function writeDraft(stepId, payload) {
    const current = readDraft();
    current[stepId] = payload;
    sessionStorage.setItem(scopedStorageKey(DRAFT_KEY_BASE), JSON.stringify(current));
}

function getStepId() {
    return document.body?.getAttribute('data-settings-nav') || 'profile';
}

function getStepIndex(stepId) {
    return activeFlowSteps().findIndex((s) => s.id === stepId);
}

function getStepById(stepId) {
    return activeFlowSteps().find((s) => s.id === stepId) || null;
}

function isWorkflowMode(stepId) {
    const bootstrap = readBootstrap();
    /** After full onboarding, chapters are free navigation — never force the guided strip (?setup=1 ignored). */
    if (isBootstrapOnboardingComplete(bootstrap)) {
        sessionStorage.removeItem(scopedStorageKey(MODE_KEY_BASE));
        return false;
    }
    const setupParam = new URLSearchParams(window.location.search).get('setup') === '1';
    const fromSession = sessionStorage.getItem(scopedStorageKey(MODE_KEY_BASE)) === '1';
    const incomplete = !isBootstrapOnboardingComplete(bootstrap);
    const inFlow = (incomplete || setupParam || fromSession) && getStepIndex(stepId) >= 0;
    if (inFlow) {
        sessionStorage.setItem(scopedStorageKey(MODE_KEY_BASE), '1');
        return true;
    }
    sessionStorage.removeItem(scopedStorageKey(MODE_KEY_BASE));
    return false;
}

function getWorkflowCompletion(stepId) {
    const idx = getStepIndex(stepId);
    if (idx < 0) return 25;
    const ratio = (idx + 1) / Math.max(1, activeFlowSteps().length);
    return Math.min(100, Math.round(25 + ratio * 75));
}

function sanitizeInput(v) {
    return String(v ?? '').trim().slice(0, 512);
}

function syncBanksStatementPanels(form) {
    if (!form) return;
    const hidden = form.querySelector('input[name="statement_source"]');
    const raw = String(hidden?.value || '').trim();
    const mode = raw === 'connector' ? 'connector' : 'manual_upload';
    if (hidden) hidden.value = mode;
    const connectorSec = form.querySelector('#banksConnectorSection');
    const manualSec = form.querySelector('#banksManualSection');
    if (connectorSec) connectorSec.hidden = mode !== 'connector';
    if (manualSec) manualSec.hidden = mode !== 'manual_upload';
    form.querySelectorAll('[data-banks-connector-field]').forEach((el) => {
        el.disabled = mode !== 'connector';
    });
    form.querySelectorAll('[data-statement-source]').forEach((btn) => {
        const v = String(btn.getAttribute('data-statement-source') || '');
        btn.classList.toggle('is-selected', v === mode);
        btn.setAttribute('aria-pressed', v === mode ? 'true' : 'false');
    });
}

function serializeForm(form) {
    const payload = {};
    if (!form) return payload;
    const controls = form.querySelectorAll('input, select, textarea');
    controls.forEach((el) => {
        if (!el.name || el.disabled) return;
        if (el instanceof HTMLInputElement && el.type === 'checkbox') {
            payload[el.name] = Boolean(el.checked);
            return;
        }
        payload[el.name] = sanitizeInput(el.value);
    });
    return payload;
}

function applyToForm(form, data) {
    if (!form || !data || typeof data !== 'object') return;
    const controls = form.querySelectorAll('input, select, textarea');
    controls.forEach((el) => {
        if (!el.name || !(el.name in data)) return;
        if (el instanceof HTMLInputElement && el.type === 'checkbox') {
            el.checked = Boolean(data[el.name]);
            return;
        }
        el.value = String(data[el.name] ?? '');
    });
}

function hydrateLowFrictionWidgets(stepId, form, data) {
    if (!form) return;
    if (stepId === 'categories') {
        const selected = new Set(String(data?.preferred_categories || '').split(',').map((x) => x.trim()).filter(Boolean));
        form.querySelectorAll('[data-category-chip]').forEach((btn) => {
            const v = String(btn.getAttribute('data-category-chip') || '');
            const on = selected.has(v);
            btn.classList.toggle('is-selected', on);
            btn.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
    }
    if (stepId === 'ai') {
        const slider = form.querySelector('#aiToneSlider');
        const hidden = form.querySelector('input[name="ai_tone"]');
        const label = form.querySelector('#aiToneSliderLabel');
        if (slider && hidden && label) {
            const map = hidden.value || 'balanced';
            const value = map === 'strict' ? '0' : map === 'casual' ? '100' : '50';
            slider.value = value;
            label.textContent = map === 'strict' ? 'Strict / Disciplined' : map === 'casual' ? 'Casual / Friendly' : 'Balanced';
        }
    }
    if (stepId === 'banks') {
        syncBanksStatementPanels(form);
    }
    if (stepId === 'billing') {
        const tierEl = form.querySelector('#billingTier');
        if (tierEl instanceof HTMLSelectElement && data && typeof data === 'object' && 'billing_tier' in data) {
            tierEl.value = normalizeBillingTierValue(data.billing_tier);
        }
        mountBillingPlanCompare(form);
    }
}

function wireLowFrictionWidgets(stepId, form, onDirty) {
    if (!form) return;
    if (stepId === 'categories') {
        const hidden = form.querySelector('input[name="preferred_categories"]');
        const chips = [...form.querySelectorAll('[data-category-chip]')];
        const sync = () => {
            const selected = chips
                .filter((c) => c.classList.contains('is-selected'))
                .map((c) => c.getAttribute('data-category-chip'))
                .filter(Boolean);
            if (hidden) hidden.value = selected.join(', ');
        };
        chips.forEach((chip) => {
            chip.addEventListener('click', () => {
                chip.classList.toggle('is-selected');
                chip.setAttribute('aria-pressed', chip.classList.contains('is-selected') ? 'true' : 'false');
                sync();
                onDirty();
            });
        });
        sync();
    }
    if (stepId === 'goals') {
        const hidden = form.querySelector('input[name="goals_package"]');
        const goalInput = form.querySelector('input[name="monthly_savings_goal"]');
        const emergencyInput = form.querySelector('input[name="emergency_fund_target"]');
        const buttons = [...form.querySelectorAll('[data-goal-preset]')];
        buttons.forEach((btn) => {
            btn.addEventListener('click', () => {
                buttons.forEach((b) => b.classList.remove('is-selected'));
                btn.classList.add('is-selected');
                const preset = btn.getAttribute('data-goal-preset') || '';
                if (hidden) hidden.value = preset;
                if (preset === 'home') {
                    if (goalInput) goalInput.value = '2500';
                    if (emergencyInput) emergencyInput.value = '12000';
                } else if (preset === 'debt') {
                    if (goalInput) goalInput.value = '1800';
                    if (emergencyInput) emergencyInput.value = '6000';
                } else if (preset === 'wealth') {
                    if (goalInput) goalInput.value = '3200';
                    if (emergencyInput) emergencyInput.value = '15000';
                }
                onDirty();
            });
        });
    }
    if (stepId === 'ai') {
        const slider = form.querySelector('#aiToneSlider');
        const hidden = form.querySelector('input[name="ai_tone"]');
        const label = form.querySelector('#aiToneSliderLabel');
        if (slider && hidden && label) {
            slider.addEventListener('input', () => {
                const v = Number(slider.value || 50);
                if (v <= 33) {
                    hidden.value = 'strict';
                    label.textContent = 'Strict / Disciplined';
                } else if (v >= 67) {
                    hidden.value = 'casual';
                    label.textContent = 'Casual / Friendly';
                } else {
                    hidden.value = 'balanced';
                    label.textContent = 'Balanced';
                }
                onDirty();
            });
        }
    }
    if (stepId === 'banks') {
        const hidden = form.querySelector('input[name="statement_source"]');
        const buttons = [...form.querySelectorAll('[data-statement-source]')];
        buttons.forEach((btn) => {
            btn.addEventListener('click', () => {
                const v = String(btn.getAttribute('data-statement-source') || 'manual_upload');
                if (hidden) hidden.value = v === 'connector' ? 'connector' : 'manual_upload';
                syncBanksStatementPanels(form);
                onDirty();
            });
        });
        syncBanksStatementPanels(form);
    }
}

function getFormForStep(stepId) {
    return document.querySelector(`form[data-settings-step="${stepId}"]`) || document.querySelector('.portal-settings-body form');
}

async function readJsonResponse(res) {
    const text = await res.text();
    if (!text) return {};
    try {
        return JSON.parse(text);
    } catch {
        return {};
    }
}

async function loadStepData(client, stepId) {
    /** One aggregate GET avoids per-step 404s when a step has not been saved yet. */
    try {
        const res = await financeApiFetch(client, '/settings/workflow', { method: 'GET' });
        if (res.ok) {
            const data = await readJsonResponse(res);
            if (data && typeof data === 'object' && data.steps && typeof data.steps === 'object') {
                const stepData = data.steps[stepId];
                if (stepData && typeof stepData === 'object') return stepData;
            }
        }
    } catch {
        // fallback below
    }
    const draft = readDraft();
    return draft[stepId] || {};
}

async function loadWorkflowState(client) {
    try {
        const res = await financeApiFetch(client, '/settings/workflow', { method: 'GET' });
        if (!res.ok) return null;
        const data = await readJsonResponse(res);
        return data && typeof data === 'object' ? data : null;
    } catch {
        return null;
    }
}

async function saveStepData(client, stepId, payload, markComplete = false) {
    writeDraft(stepId, payload);
    try {
        const res = await financeApiFetch(client, `/settings/workflow/${stepId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data: payload, mark_complete: markComplete })
        });
        const data = await readJsonResponse(res);
        if (res.ok) return { ok: true, ...data };
        const detail = data?.detail ?? data?.message;
        const msg =
            typeof detail === 'string'
                ? detail
                : Array.isArray(detail)
                  ? detail.map((d) => d?.msg || JSON.stringify(d)).join('; ')
                  : res.statusText || 'Save rejected';
        return { ok: false, status: res.status, error: msg };
    } catch (e) {
        const net = String(e?.message || '');
        return {
            ok: false,
            status: 0,
            error:
                net ||
                'Network error. If OPTIONS /settings/workflow/... returns 400, the API CORS allow_methods list must include PUT.'
        };
    }
}

async function completeOnboarding(client) {
    try {
        const res = await financeApiFetch(client, '/onboarding/complete', { method: 'POST' });
        const data = await readJsonResponse(res);
        if (res.ok) return { ok: true, ...data };
        const detail = data?.detail ?? data?.message;
        const msg =
            typeof detail === 'string'
                ? detail
                : Array.isArray(detail)
                  ? detail.map((d) => d?.msg || JSON.stringify(d)).join('; ')
                  : res.statusText || 'Complete failed';
        return { ok: false, status: res.status, error: msg };
    } catch (e) {
        return { ok: false, status: 0, error: String(e?.message || 'Could not complete onboarding') };
    }
}

async function startBillingCheckoutOrTrial(client, tier) {
    const res = await financeApiFetch(client, '/payments/web/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier })
    });
    const text = await res.text();
    let data = {};
    try {
        data = text ? JSON.parse(text) : {};
    } catch {
        throw new Error(`Unexpected payment response (${res.status}).`);
    }
    if (!res.ok) {
        const detail = data?.detail || data?.message || `Checkout failed (${res.status})`;
        throw new Error(String(detail));
    }
    return data;
}

function resolveFinalRedirect(result) {
    const target = String(result?.redirect_target || '').trim();
    if (target === '/transactions') return './transactions.html';
    if (target === '/dashboard') return './dashboard.html';
    if (target.startsWith('/portal/')) return `.${target.slice('/portal'.length)}`;
    if (target.startsWith('./') || target.endsWith('.html')) return target;
    return './dashboard.html';
}

function ensureStatusNode() {
    let node = document.getElementById('settingsFlowStatus');
    if (node) return node;
    node = document.createElement('p');
    node.id = 'settingsFlowStatus';
    node.className = 'settings-flow-status';
    const body = document.querySelector('.portal-settings-body');
    if (!body) return node;
    const banner = document.getElementById('settingsFlowBanner');
    if (banner) {
        banner.insertAdjacentElement('afterend', node);
    } else {
        const header = body.querySelector('.page-header');
        if (header) header.insertAdjacentElement('afterend', node);
        else body.prepend(node);
    }
    return node;
}

function positionFlowBannerInBody(banner) {
    const body = document.querySelector('.portal-settings-body');
    if (!body || !banner) return;
    const header = body.querySelector('.page-header');
    if (header) {
        if (banner.previousElementSibling !== header) {
            header.insertAdjacentElement('afterend', banner);
        }
        return;
    }
    body.prepend(banner);
}

function getMintrTipParts(stepId, profile, claims, displayNameOverride) {
    const intro = MINTR_TIP_INTRO[stepId] || '';
    const line = MINTR_TIP_LINE[stepId] || '';
    let tipLine = line;
    if (stepId === 'profile' && tipLine) {
        const name =
            displayNameOverride != null && String(displayNameOverride).trim()
                ? sanitizeInput(displayNameOverride)
                : coachPreferredName(profile, claims);
        if (name && name !== 'there') {
            tipLine = `Nice to meet you, ${name}! ${tipLine}`;
        }
    }
    const tip = tipLine ? `Mintr Tip: ${tipLine}` : '';
    return { intro, tip };
}

function setStatus(msg, tone = 'neutral') {
    const node = ensureStatusNode();
    node.textContent = msg || '';
    node.dataset.tone = tone;
}

function coachPreferredName(profile, claims) {
    const p = profile && typeof profile === 'object' ? profile : null;
    const direct =
        (p?.display_name != null && String(p.display_name).trim()) ||
        (p?.name != null && String(p.name).trim()) ||
        '';
    const resolved = direct || resolveDisplayName(profile, claims).trim();
    const label = resolved || 'there';
    return label.length > 56 ? `${label.slice(0, 53)}…` : label;
}

function buildFlowBanner(stepId, isWorkflow, coachCtx) {
    const body = document.querySelector('.portal-settings-body');
    if (!body) return;
    let banner = document.getElementById('settingsFlowBanner');
    if (!banner) {
        banner = document.createElement('div');
        banner.id = 'settingsFlowBanner';
        body.appendChild(banner);
    }
    banner.className = 'settings-flow-banner card mintr-tip-card';

    const idx = getStepIndex(stepId);
    const flowSteps = activeFlowSteps();
    const total = flowSteps.length;
    const step = getStepById(stepId);
    const percent = getWorkflowCompletion(stepId);
    const profile = coachCtx?.profile;
    const claims = coachCtx?.claims;
    const coach = MINTR_COACH_COPY[stepId];
    const benefitFallback = STEP_BENEFIT_COPY[stepId] || 'Update your preferences and save changes when needed.';
    const tipParts = getMintrTipParts(stepId, profile, claims, null);
    const hasMintrTipContent = Boolean(tipParts.intro || tipParts.tip);

    const setupMeta =
        isWorkflow && idx >= 0
            ? `<p class="mintr-setup-meta">${escapeBannerHtml(step?.chapter || 'Setup')} · Step ${idx + 1} of ${total}</p>`
            : '';

    const extras =
        isWorkflow && coach
            ? '<details class="mintr-coach-tip">' +
              '<summary><i class="fas fa-lightbulb" aria-hidden="true"></i> Why this step?</summary>' +
              `<p class="mintr-coach-tip-body">${escapeBannerHtml(coach.tip)}</p>` +
              '</details>' +
              `<p class="settings-flow-pause mintr-coach-pause">${escapeBannerHtml(FLOW_PAUSE_COPY)}</p>` +
              `<div class="settings-progress-wrap"><div class="settings-progress-bar"><span style="width:${percent}%"></span></div><small>Step ${idx >= 0 ? idx + 1 : 1} of ${total} — small steps, no rush</small></div>`
            : '';

    if (hasMintrTipContent) {
        banner.innerHTML =
            setupMeta +
            '<div class="mintr-tip-banner" role="status">' +
            '<div class="mintr-avatar" aria-hidden="true"><i class="fas fa-robot"></i></div>' +
            '<div class="mintr-message-stack">' +
            '<p class="mintr-message mintr-message--intro" id="mintrCoachTipIntro"></p>' +
            '<p class="mintr-message mintr-message--tip" id="mintrCoachTipText"></p>' +
            '</div>' +
            '</div>' +
            extras;
        const introEl = banner.querySelector('#mintrCoachTipIntro');
        const tipEl = banner.querySelector('#mintrCoachTipText');
        if (introEl) {
            introEl.textContent = tipParts.intro;
            introEl.hidden = !tipParts.intro;
        }
        if (tipEl) {
            tipEl.textContent = tipParts.tip;
            tipEl.hidden = !tipParts.tip;
        }
    } else {
        banner.innerHTML =
            setupMeta +
            `<p class="settings-flow-benefit">${escapeBannerHtml(benefitFallback)}</p>` +
            extras;
    }

    positionFlowBannerInBody(banner);
}

function escapeBannerHtml(s) {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function buildActionBar({ stepId, isWorkflow, onSave, onCancel, onNext, onSkip, isDirty }) {
    const body = document.querySelector('.portal-settings-body');
    if (!body) return;
    let actions = document.getElementById('settingsFlowActions');
    if (!actions) {
        actions = document.createElement('div');
        actions.id = 'settingsFlowActions';
        actions.className = 'settings-flow-actions';
        body.appendChild(actions);
    }

    const flowSteps = activeFlowSteps();
    const idx = getStepIndex(stepId);
    const hasNext = idx >= 0 && idx < flowSteps.length - 1;
    const nextLabel = hasNext ? 'Save & continue' : 'Save & finish';

    actions.innerHTML =
        '<div class="settings-flow-actions-left">' +
        '<button type="button" class="settings-ghost-btn" id="settingsFlowCancel">Cancel</button>' +
        '</div>' +
        '<div class="settings-flow-actions-right">' +
        (isWorkflow && OPTIONAL_STEPS.has(stepId)
            ? '<button type="button" class="settings-ghost-btn" id="settingsFlowSkip">I\'ll do this later</button>'
            : '') +
        '<button type="button" class="btn-save" id="settingsFlowSave">Save</button>' +
        (isWorkflow ? `<button type="button" class="btn-save" id="settingsFlowNext">${nextLabel}</button>` : '') +
        '</div>';

    const cancelBtn = actions.querySelector('#settingsFlowCancel');
    const saveBtn = actions.querySelector('#settingsFlowSave');
    const nextBtn = actions.querySelector('#settingsFlowNext');
    const skipBtn = actions.querySelector('#settingsFlowSkip');

    if (cancelBtn) {
        cancelBtn.style.display = isDirty ? '' : 'none';
        cancelBtn.addEventListener('click', onCancel);
    }
    if (saveBtn) {
        saveBtn.disabled = !isDirty;
        saveBtn.addEventListener('click', onSave);
    }
    if (nextBtn) {
        nextBtn.addEventListener('click', onNext);
    }
    if (skipBtn) {
        skipBtn.addEventListener('click', onSkip);
    }
}

function nextHref(stepId) {
    const flowSteps = activeFlowSteps();
    const idx = getStepIndex(stepId);
    if (idx < 0 || idx >= flowSteps.length - 1) return './dashboard.html';
    return `${flowSteps[idx + 1].href}?setup=1`;
}

async function mountSettingsWorkflow() {
    if (!document.body?.matches('[data-portal-nav="settings"]')) return;
    const stepId = getStepId();
    if (getStepIndex(stepId) < 0) return;
    const form = getFormForStep(stepId);
    const client = createLogtoClient();
    if (!(await client.isAuthenticated())) return;
    const workflowState = await loadWorkflowState(client);
    if (workflowState?.onboarding_complete === true || isBootstrapOnboardingComplete(readBootstrap())) {
        patchSessionBootstrap({ onboarding_complete: true });
    }
    const isWorkflow = isWorkflowMode(stepId);
    const claims = await client.getIdTokenClaims();
    const profile = readBootstrap()?.profile;
    buildFlowBanner(stepId, isWorkflow, { profile, claims });

    const fromApi =
        workflowState?.steps && typeof workflowState.steps === 'object' && workflowState.steps[stepId]
            ? workflowState.steps[stepId]
            : await loadStepData(client, stepId);
    applyToForm(form, fromApi);
    hydrateLowFrictionWidgets(stepId, form, fromApi);

    if (stepId === 'profile' && form) {
        const applyProfileMintrTip = () => {
            const tipEl = document.getElementById('mintrCoachTipText');
            const nameInput = form.querySelector('input[name="display_name"]');
            if (!tipEl || !nameInput) return;
            const parts = getMintrTipParts('profile', profile, claims, nameInput.value);
            const introEl = document.getElementById('mintrCoachTipIntro');
            if (introEl) {
                introEl.textContent = parts.intro;
                introEl.hidden = !parts.intro;
            }
            tipEl.textContent = parts.tip;
            tipEl.hidden = !parts.tip;
        };
        applyProfileMintrTip();
        if (!form.dataset.mintrCoachProfileListen) {
            form.dataset.mintrCoachProfileListen = '1';
            form.addEventListener('input', (e) => {
                const t = e.target;
                if (t && 'name' in t && t.name === 'display_name') applyProfileMintrTip();
            });
        }
    }

    let initialSnapshot = JSON.stringify(serializeForm(form));
    let dirty = false;

    const showInterstitial = (message, cb) => {
        if (!message) {
            cb();
            return;
        }
        const modal = document.createElement('div');
        modal.className = 'settings-stripe-modal';
        modal.innerHTML =
            '<div class="settings-stripe-dialog">' +
            `<h3>${message}</h3>` +
            '<p>Please wait a moment…</p>' +
            '</div>';
        document.body.appendChild(modal);
        window.setTimeout(() => {
            modal.remove();
            cb();
        }, 750);
    };

    const navigateNext = async (saveRes) => {
        if (!saveRes?.ok) {
            const hint =
                saveRes?.status === 0
                    ? ' Save did not reach the server — often CORS: add PUT (and OPTIONS) to allow_methods on the API.'
                    : '';
            setStatus(`Could not save this step.${hint} ${saveRes?.error || ''}`.trim(), 'warning');
            return;
        }
        const flowSteps = activeFlowSteps();
        const isLast = stepId === flowSteps[flowSteps.length - 1].id;
        if (saveRes.next_step === 'complete' || isLast) {
            if (saveRes.onboarding_complete === true) {
                patchSessionBootstrap({ onboarding_complete: true });
            }
            const finalRes = await completeOnboarding(client);
            if (!finalRes?.ok) {
                setStatus(
                    `Onboarding could not be finalized (${finalRes?.status || ''}). ${finalRes?.error || ''}`.trim(),
                    'warning'
                );
                return;
            }
            patchSessionBootstrap({ onboarding_complete: true });
            sessionStorage.removeItem(scopedStorageKey(MODE_KEY_BASE));
            visitWithTurbo(resolveFinalRedirect(finalRes));
            return;
        }
        if (saveRes.next_step) {
            const nextMsg = STEP_INTERSTITIAL[saveRes.next_step];
            showInterstitial(nextMsg, () => visitWithTurbo(`./settings-${saveRes.next_step}.html?setup=1`));
            return;
        }
        const nextMsg = STEP_INTERSTITIAL[flowSteps[getStepIndex(stepId) + 1]?.id];
        showInterstitial(nextMsg, () => visitWithTurbo(nextHref(stepId)));
    };

    const syncActions = () =>
        buildActionBar({
            stepId,
            isWorkflow,
            isDirty: dirty,
            onCancel: () => {
                applyToForm(form, JSON.parse(initialSnapshot));
                if (stepId === 'billing') mountBillingPlanCompare(form);
                dirty = false;
                setStatus('Reverted unsaved changes.');
                syncActions();
            },
            onSave: async () => {
                const payload = serializeForm(form);
                if (stepId === 'billing' && payload.billing_tier && !payload.stripe_payment_status) {
                    payload.stripe_payment_status = 'pending';
                }
                const saveRes = await saveStepData(client, stepId, payload, false);
                if (saveRes?.ok) {
                    initialSnapshot = JSON.stringify(payload);
                    dirty = false;
                    setStatus('Saved successfully.', 'positive');
                } else {
                    setStatus(
                        saveRes?.status === 0
                            ? `Not saved — ${saveRes.error || 'Request blocked (check API CORS allows PUT).'}`
                            : `Not saved (${saveRes?.status}): ${saveRes?.error || 'Unknown error'}`,
                        'warning'
                    );
                }
                syncActions();
            },
            onNext: async () => {
                const payload = serializeForm(form);
                if (stepId === 'billing') {
                    const tier = String(payload.billing_tier || 'free').toLowerCase();
                    if (tier === 'free') {
                        payload.stripe_payment_status = 'not_required';
                    } else if (!payload.stripe_payment_status || payload.stripe_payment_status === 'pending') {
                        payload.stripe_payment_status = 'pending';
                    }
                    const saveRes = await saveStepData(client, stepId, payload, true);
                    if (saveRes?.ok) {
                        if (tier === 'free') {
                            setStatus('You are on the free plan. Upgrade only if you want to, anytime in Settings.', 'positive');
                        } else {
                            try {
                                const pay = await startBillingCheckoutOrTrial(client, tier);
                                if (pay?.checkout_enabled && pay?.url) {
                                    setStatus('Redirecting to secure checkout…', 'positive');
                                    window.location.assign(String(pay.url));
                                    return;
                                }
                                if (pay?.status === 'trial_started') {
                                    const days = Number(pay?.trial_days || 0);
                                    const msg = days > 0 ? `${days}-day trial started.` : 'Trial started.';
                                    setStatus(`${msg} You can continue setup now.`, 'positive');
                                } else if (pay?.status === 'trial_active') {
                                    const left = Number(pay?.trial_days_left || 0);
                                    const msg = left > 0 ? `Trial active (${left} day${left === 1 ? '' : 's'} left).` : 'Trial active.';
                                    setStatus(`${msg} Checkout will unlock when trial ends.`, 'positive');
                                } else {
                                    setStatus('Plan preference saved. You can complete payment whenever you are ready under Settings → Billing.', 'positive');
                                }
                            } catch (err) {
                                const msg = err instanceof Error ? err.message : 'Could not start trial / checkout.';
                                setStatus(msg, 'warning');
                            }
                        }
                    }
                    await navigateNext(saveRes);
                    return;
                }
                const saveRes = await saveStepData(client, stepId, payload, true);
                await navigateNext(saveRes);
            },
            onSkip: async () => {
                const payload = { ...serializeForm(form), skipped_for_now: true };
                const saveRes = await saveStepData(client, stepId, payload, true);
                await navigateNext(saveRes);
            }
        });

    form?.addEventListener('input', () => {
        dirty = JSON.stringify(serializeForm(form)) !== initialSnapshot;
        syncActions();
    });
    form?.addEventListener('change', () => {
        if (stepId === 'billing') mountBillingPlanCompare(form);
        dirty = JSON.stringify(serializeForm(form)) !== initialSnapshot;
        syncActions();
    });
    form?.addEventListener('submit', (e) => e.preventDefault());
    wireLowFrictionWidgets(stepId, form, () => {
        dirty = JSON.stringify(serializeForm(form)) !== initialSnapshot;
        syncActions();
    });

    syncActions();
}

mountSettingsWorkflow();
if (!window.__mintSettingsWorkflowTurboLoad) {
    window.__mintSettingsWorkflowTurboLoad = true;
    document.addEventListener('turbo:load', () => {
        void mountSettingsWorkflow();
    });
}
