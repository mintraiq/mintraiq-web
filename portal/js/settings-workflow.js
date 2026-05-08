import { createLogtoClient } from './logto-client.js';
import { financeApiFetch } from './api.js';
import { visitWithTurbo } from './turbo-visit.js';

const FLOW_STEPS = [
    { id: 'profile', href: './settings-profile.html', label: 'Personal profile', chapter: 'Your identity' },
    { id: 'security', href: './settings-security.html', label: 'Security', chapter: 'Your identity' },
    { id: 'banks', href: './settings-banks.html', label: 'Banks & income', chapter: 'Your money' },
    { id: 'billing', href: './settings-billing.html', label: 'Billing & plan', chapter: 'Your money' },
    { id: 'goals', href: './settings-goals.html', label: 'Savings goals', chapter: 'Your strategy' },
    { id: 'categories', href: './settings-categories.html', label: 'Custom categories', chapter: 'Your strategy' },
    { id: 'ai', href: './settings-ai.html', label: 'AI advisor settings', chapter: 'Your strategy' },
    { id: 'notifications', href: './settings-notifications.html', label: 'Alerts & nudges', chapter: 'Your strategy' }
];

const OPTIONAL_STEPS = new Set(['goals', 'notifications']);
const STEP_INTERSTITIAL = {
    banks: 'Syncing with NZ banks... finding your hidden savings.',
    billing: 'Preparing secure checkout handoff...',
    goals: 'Calibrating your strategy engine...',
    categories: 'Learning your spending style...',
    ai: 'Training your advisor personality...'
};
const STEP_BENEFIT_COPY = {
    profile: 'Set your identity so we can personalize your financial insights.',
    security: 'Protect your account before connecting live bank data.',
    banks: 'Connect Akahu to unlock live balances and transactions.',
    billing: 'Select your plan to enable advanced automation limits.',
    goals: 'Tell us what success looks like, and we will optimize toward it.',
    categories: 'Pick what matters so categorization feels native to your life.',
    ai: 'Tune how strict or friendly the AI coach should be.',
    notifications: 'Choose when we should nudge you before spending drifts.'
};

const DRAFT_KEY = 'mintraiq_settings_workflow_draft_v1';
const MODE_KEY = 'mintraiq_settings_workflow_mode_v1';

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
    return FLOW_STEPS.findIndex((s) => s.id === stepId);
}

function getStepById(stepId) {
    return FLOW_STEPS.find((s) => s.id === stepId) || null;
}

function isWorkflowMode(stepId) {
    const bootstrap = readBootstrap();
    const setupParam = new URLSearchParams(window.location.search).get('setup') === '1';
    const fromSession = sessionStorage.getItem(MODE_KEY) === '1';
    const inFlow = bootstrap?.onboarding_complete === false || bootstrap?.is_new_user === true || setupParam || fromSession;
    if (inFlow && getStepIndex(stepId) >= 0) {
        sessionStorage.setItem(MODE_KEY, '1');
        return true;
    }
    sessionStorage.removeItem(MODE_KEY);
    return false;
}

function getWorkflowCompletion(stepId) {
    const idx = getStepIndex(stepId);
    if (idx < 0) return 25;
    const ratio = (idx + 1) / FLOW_STEPS.length;
    return Math.min(100, Math.round(25 + ratio * 75));
}

function sanitizeInput(v) {
    return String(v ?? '').trim().slice(0, 512);
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
    try {
        const res = await financeApiFetch(client, `/settings/workflow/${stepId}`, { method: 'GET' });
        if (res.ok) {
            const data = await readJsonResponse(res);
            if (data && typeof data === 'object' && data.data && typeof data.data === 'object') return data.data;
        }
    } catch {
        // fallback below
    }
    try {
        const res = await financeApiFetch(client, '/settings/workflow', { method: 'GET' });
        if (!res.ok) throw new Error('workflow read failed');
        const data = await readJsonResponse(res);
        if (data && typeof data === 'object' && data.steps && typeof data.steps === 'object') {
            const stepData = data.steps[stepId];
            if (stepData && typeof stepData === 'object') return stepData;
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
        if (res.ok) return await readJsonResponse(res);
    } catch {
        // fallback below
    }
    return null;
}

async function completeOnboarding(client) {
    try {
        const res = await financeApiFetch(client, '/onboarding/complete', { method: 'POST' });
        if (!res.ok) return null;
        return await readJsonResponse(res);
    } catch {
        return null;
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

function openStripeMock(onDone) {
    const modal = document.createElement('div');
    modal.className = 'settings-stripe-modal';
    modal.innerHTML =
        '<div class="settings-stripe-dialog">' +
        '<h3>Stripe Checkout (Mock)</h3>' +
        '<p>You will be redirected to Stripe-hosted checkout in production.</p>' +
        '<div class="settings-stripe-actions">' +
        '<button type="button" class="btn-save" id="stripeMockConfirm">Simulate successful payment</button>' +
        '<button type="button" class="settings-ghost-btn" id="stripeMockCancel">Cancel</button>' +
        '</div></div>';
    document.body.appendChild(modal);
    const close = () => modal.remove();
    modal.querySelector('#stripeMockCancel')?.addEventListener('click', close);
    modal.querySelector('#stripeMockConfirm')?.addEventListener('click', () => {
        close();
        onDone();
    });
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
    const total = FLOW_STEPS.length;
    const step = getStepById(stepId);
    const stepLabel = idx >= 0 ? `${idx + 1}/${total} · ${FLOW_STEPS[idx].label}` : '';
    const percent = getWorkflowCompletion(stepId);
    banner.innerHTML =
        '<div class="settings-flow-head">' +
        `<strong>${isWorkflow ? `Chapter: ${step?.chapter || 'Setup'}` : 'Settings'}</strong>` +
        `<span>${stepLabel}</span>` +
        '</div>' +
        `<p>${STEP_BENEFIT_COPY[stepId] || 'Update your preferences and save changes when needed.'}</p>` +
        (isWorkflow
            ? `<div class="settings-progress-wrap"><div class="settings-progress-bar"><span style="width:${percent}%"></span></div><small>${percent}% complete</small></div>`
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

    const idx = getStepIndex(stepId);
    const hasNext = idx >= 0 && idx < FLOW_STEPS.length - 1;
    const nextLabel = hasNext ? 'Save & Next' : 'Finish setup';

    actions.innerHTML =
        '<div class="settings-flow-actions-left">' +
        '<button type="button" class="settings-ghost-btn" id="settingsFlowCancel">Cancel</button>' +
        '</div>' +
        '<div class="settings-flow-actions-right">' +
        (isWorkflow && OPTIONAL_STEPS.has(stepId)
            ? '<button type="button" class="settings-ghost-btn" id="settingsFlowSkip">Skip for now</button>'
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
    const idx = getStepIndex(stepId);
    if (idx < 0 || idx >= FLOW_STEPS.length - 1) return './dashboard.html';
    return `${FLOW_STEPS[idx + 1].href}?setup=1`;
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
        if (saveRes?.next_step === 'complete' || stepId === FLOW_STEPS[FLOW_STEPS.length - 1].id) {
            const finalRes = await completeOnboarding(client);
            visitWithTurbo(resolveFinalRedirect(finalRes));
            return;
        }
        if (saveRes?.next_step) {
            const nextMsg = STEP_INTERSTITIAL[saveRes.next_step];
            showInterstitial(nextMsg, () => visitWithTurbo(`./settings-${saveRes.next_step}.html?setup=1`));
            return;
        }
        const nextMsg = STEP_INTERSTITIAL[FLOW_STEPS[getStepIndex(stepId) + 1]?.id];
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
                initialSnapshot = JSON.stringify(payload);
                dirty = false;
                setStatus(saveRes?.ok ? 'Saved successfully.' : 'Saved locally. API endpoint unavailable.', saveRes?.ok ? 'positive' : 'warning');
                syncActions();
            },
            onNext: async () => {
                const payload = serializeForm(form);
                if (stepId === 'billing') {
                    openStripeMock(async () => {
                        payload.stripe_payment_status = 'paid';
                        const saveRes = await saveStepData(client, stepId, payload, true);
                        await navigateNext(saveRes);
                    });
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
