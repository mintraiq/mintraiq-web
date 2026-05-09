import { createLogtoClient } from './logto-client.js';
import { financeApiFetch } from './api.js';
import { visitWithTurbo } from './turbo-visit.js';

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
const FLOW_PAUSE_COPY =
    'Pausing is fine — pick up anytime from Settings. Nothing here locks you in.';

const DRAFT_KEY = 'mintraiq_settings_workflow_draft_v1';
const MODE_KEY = 'mintraiq_settings_workflow_mode_v1';

function patchSessionBootstrap(partial) {
    try {
        const raw = sessionStorage.getItem('mintraiq_bootstrap');
        const b = raw ? JSON.parse(raw) : {};
        if (!b || typeof b !== 'object') return;
        Object.assign(b, partial);
        sessionStorage.setItem('mintraiq_bootstrap', JSON.stringify({ ...b, at: Date.now() }));
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
    return parseJsonSafe(sessionStorage.getItem(DRAFT_KEY)) || {};
}

function writeDraft(stepId, payload) {
    const current = readDraft();
    current[stepId] = payload;
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(current));
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
    if (bootstrap?.onboarding_complete === true) {
        sessionStorage.removeItem(MODE_KEY);
        return false;
    }
    const setupParam = new URLSearchParams(window.location.search).get('setup') === '1';
    const fromSession = sessionStorage.getItem(MODE_KEY) === '1';
    const incomplete = bootstrap?.onboarding_complete !== true;
    const inFlow = (incomplete || setupParam || fromSession) && getStepIndex(stepId) >= 0;
    if (inFlow) {
        sessionStorage.setItem(MODE_KEY, '1');
        return true;
    }
    sessionStorage.removeItem(MODE_KEY);
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
    if (body) body.prepend(node);
    return node;
}

function setStatus(msg, tone = 'neutral') {
    const node = ensureStatusNode();
    node.textContent = msg || '';
    node.dataset.tone = tone;
}

function buildFlowBanner(stepId, isWorkflow) {
    const body = document.querySelector('.portal-settings-body');
    if (!body) return;
    let banner = document.getElementById('settingsFlowBanner');
    if (!banner) {
        banner = document.createElement('div');
        banner.id = 'settingsFlowBanner';
        banner.className = 'settings-flow-banner card';
        body.prepend(banner);
    }
    const idx = getStepIndex(stepId);
    const flowSteps = activeFlowSteps();
    const total = flowSteps.length;
    const step = getStepById(stepId);
    const stepLabel = idx >= 0 ? `${idx + 1}/${total} · ${flowSteps[idx].label}` : '';
    const percent = getWorkflowCompletion(stepId);
    banner.innerHTML =
        '<div class="settings-flow-head">' +
        `<strong>${isWorkflow ? `${step?.chapter || 'Setup'}` : 'Settings'}</strong>` +
        `<span>${stepLabel}</span>` +
        '</div>' +
        `<p class="settings-flow-benefit">${STEP_BENEFIT_COPY[stepId] || 'Update your preferences and save changes when needed.'}</p>` +
        (isWorkflow
            ? `<p class="settings-flow-pause" style="color:var(--text-secondary);font-size:0.9rem;margin:10px 0 0">${FLOW_PAUSE_COPY}</p>` +
              `<div class="settings-progress-wrap"><div class="settings-progress-bar"><span style="width:${percent}%"></span></div><small>Step ${idx >= 0 ? idx + 1 : 1} of ${total} — small steps, no rush</small></div>`
            : '');
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
    const isWorkflow = isWorkflowMode(stepId);
    buildFlowBanner(stepId, isWorkflow);

    const fromApi = await loadStepData(client, stepId);
    applyToForm(form, fromApi);
    hydrateLowFrictionWidgets(stepId, form, fromApi);

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
            sessionStorage.removeItem(MODE_KEY);
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
                        setStatus(
                            tier === 'free'
                                ? 'You are on the free plan. Upgrade only if you want to, anytime in Settings.'
                                : 'Plan preference saved. You can complete payment whenever you are ready under Settings → Billing.',
                            'positive'
                        );
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
