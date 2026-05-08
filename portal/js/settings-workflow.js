import { createLogtoClient } from './logto-client.js';
import { financeApiFetch } from './api.js';
import { visitWithTurbo } from './turbo-visit.js';

const FLOW_STEPS = [
    { id: 'profile', href: './settings-profile.html', label: 'Personal profile' },
    { id: 'billing', href: './settings-billing.html', label: 'Billing & plan' },
    { id: 'security', href: './settings-security.html', label: 'Security' },
    { id: 'banks', href: './settings-banks.html', label: 'Banks & income' },
    { id: 'goals', href: './settings-goals.html', label: 'Savings goals' },
    { id: 'categories', href: './settings-categories.html', label: 'Custom categories' },
    { id: 'ai', href: './settings-ai.html', label: 'AI advisor settings' },
    { id: 'notifications', href: './settings-notifications.html', label: 'Alerts & nudges' }
];

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
    const stepLabel = idx >= 0 ? `${idx + 1}/${total} · ${FLOW_STEPS[idx].label}` : '';
    banner.innerHTML =
        '<div class="settings-flow-head">' +
        `<strong>${isWorkflow ? 'New workspace setup' : 'Settings'}</strong>` +
        `<span>${stepLabel}</span>` +
        '</div>' +
        `<p>${isWorkflow ? 'Complete each step to finish your initial setup. Your data syncs to your API as you proceed.' : 'Update your preferences and save changes when needed.'}</p>`;
}

function buildActionBar({ stepId, isWorkflow, onSave, onCancel, onNext, isDirty }) {
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
        '<button type="button" class="btn-save" id="settingsFlowSave">Save</button>' +
        (isWorkflow ? `<button type="button" class="btn-save" id="settingsFlowNext">${nextLabel}</button>` : '') +
        '</div>';

    const cancelBtn = actions.querySelector('#settingsFlowCancel');
    const saveBtn = actions.querySelector('#settingsFlowSave');
    const nextBtn = actions.querySelector('#settingsFlowNext');

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

    let initialSnapshot = JSON.stringify(serializeForm(form));
    let dirty = false;

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
                const doNavigate = () => {
                    const href = nextHref(stepId);
                    visitWithTurbo(href);
                };
                const payload = serializeForm(form);
                if (stepId === 'billing') {
                    openStripeMock(async () => {
                        payload.stripe_payment_status = 'paid';
                        const saveRes = await saveStepData(client, stepId, payload, true);
                        if (saveRes?.next_step === 'complete' || stepId === FLOW_STEPS[FLOW_STEPS.length - 1].id) {
                            const finalRes = await completeOnboarding(client);
                            visitWithTurbo(resolveFinalRedirect(finalRes));
                            return;
                        }
                        visitWithTurbo(`./settings-${saveRes?.next_step || FLOW_STEPS[getStepIndex(stepId) + 1].id}.html?setup=1`);
                    });
                    return;
                }
                const saveRes = await saveStepData(client, stepId, payload, true);
                if (saveRes?.next_step === 'complete' || stepId === FLOW_STEPS[FLOW_STEPS.length - 1].id) {
                    const finalRes = await completeOnboarding(client);
                    visitWithTurbo(resolveFinalRedirect(finalRes));
                    return;
                }
                if (saveRes?.next_step) {
                    visitWithTurbo(`./settings-${saveRes.next_step}.html?setup=1`);
                    return;
                }
                doNavigate();
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

    syncActions();
}

mountSettingsWorkflow();
if (!window.__mintSettingsWorkflowTurboLoad) {
    window.__mintSettingsWorkflowTurboLoad = true;
    document.addEventListener('turbo:load', () => {
        void mountSettingsWorkflow();
    });
}
