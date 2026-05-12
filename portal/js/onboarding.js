import { createLogtoClient } from './logto-client.js';
import { bootstrapSession } from './bootstrap.js';
import { isBootstrapOnboardingComplete } from './config.js';
import { visitWithTurbo } from './turbo-visit.js';
import { claimPageScript } from './page-script-guard.js';
import {
    agreeToLegalTerms,
    clearLegalContentState,
    loadLegalContent,
    userStatusFromBootstrapPayload
} from './legal-store.js';

const STEP_TO_PAGE = {
    profile: './settings-profile.html?setup=1',
    billing: './settings-billing.html?setup=1',
    security: './settings-security.html?setup=1',
    banks: './settings-banks.html?setup=1',
    goals: './settings-goals.html?setup=1',
    categories: './settings-categories.html?setup=1',
    ai: './settings-ai.html?setup=1',
    notifications: './settings-notifications.html?setup=1'
};

function status(msg) {
    const node = document.getElementById('onboardingStatus');
    if (node) node.textContent = msg;
}

function readStoredBootstrap() {
    const raw = sessionStorage.getItem('mintraiq_bootstrap');
    if (!raw) return null;
    try {
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

/**
 * Reuse POST /bootstrap when user is already complete (short TTL).
 * While onboarding is still in progress, always refetch — a 120s cache of an *incomplete* snapshot
 * caused dashboard → onboarding → profile loops after the user finished steps on the server.
 */
async function loadBootstrapForOnboarding(client) {
    const stored = readStoredBootstrap();
    if (isBootstrapOnboardingComplete(stored)) {
        const freshEnough =
            stored &&
            stored.status === 'success' &&
            typeof stored.at === 'number' &&
            Date.now() - stored.at < 120_000;
        if (freshEnough) {
            const { at: _a, ...rest } = stored;
            return rest;
        }
    }
    return bootstrapSession(client);
}

function showTermsPhase(show) {
    const loading = document.getElementById('onboardingPhaseLoading');
    const terms = document.getElementById('onboardingPhaseTerms');
    if (loading) {
        loading.classList.toggle('onboarding-phase-hidden', show);
        loading.hidden = show;
    }
    if (terms) {
        terms.classList.toggle('onboarding-phase-hidden', !show);
        terms.hidden = !show;
    }
}

function mergeBootstrapUserStatus(bootstrap, version) {
    const v = String(version || '').trim();
    const now = new Date().toISOString();
    return {
        ...bootstrap,
        user_status: {
            ...(bootstrap.user_status && typeof bootstrap.user_status === 'object' ? bootstrap.user_status : {}),
            has_agreed: true,
            has_agreed_to_tos: true,
            agreed_version: v,
            tos_version: v,
            agreed_at: now,
            tos_agreed_at: now
        },
        profile: {
            ...(bootstrap.profile && typeof bootstrap.profile === 'object' ? bootstrap.profile : {}),
            has_agreed_to_tos: true,
            tos_version: v,
            tos_agreed_at: now
        }
    };
}

function goToNextSetupStep(bootstrap) {
    const step = bootstrap?.onboarding?.current_step || 'profile';
    if (step === 'complete' || isBootstrapOnboardingComplete(bootstrap)) {
        status('You are all set — opening your workspace…');
        visitWithTurbo('./dashboard.html', { replace: true });
        return;
    }
    const target = STEP_TO_PAGE[step] || STEP_TO_PAGE.profile;
    status('Onward — your next setup step is ready.');
    visitWithTurbo(target, { replace: true });
}

async function main() {
    if (!claimPageScript('portal-onboarding-main')) return;
    const client = createLogtoClient();
    if (!(await client.isAuthenticated())) {
        window.location.replace('./index.html');
        return;
    }

    showTermsPhase(false);
    status('Just a moment — I am finding where you left off…');

    const bootstrap = await loadBootstrapForOnboarding(client);
    let sessionBootstrap = { ...bootstrap, at: Date.now() };
    sessionStorage.setItem('mintraiq_bootstrap', JSON.stringify(sessionBootstrap));

    if (isBootstrapOnboardingComplete(bootstrap)) {
        visitWithTurbo('./dashboard.html', { replace: true });
        return;
    }

    let legalState;
    try {
        legalState = await loadLegalContent(client);
    } catch (e) {
        status(String(e?.message || 'Could not load legal content. Check your connection and refresh this page.'));
        return;
    }

    const fromLegal = legalState?.user_status?.has_agreed === true;
    const fromBootstrap = userStatusFromBootstrapPayload(sessionBootstrap)?.has_agreed === true;
    const agreed = fromLegal || fromBootstrap;

    if (agreed) {
        const merged = {
            ...sessionBootstrap,
            user_status: {
                ...(typeof sessionBootstrap.user_status === 'object' && sessionBootstrap.user_status
                    ? sessionBootstrap.user_status
                    : {}),
                ...(typeof legalState.user_status === 'object' && legalState.user_status ? legalState.user_status : {}),
                has_agreed: true,
                has_agreed_to_tos: true
            },
            profile: {
                ...(typeof sessionBootstrap.profile === 'object' && sessionBootstrap.profile ? sessionBootstrap.profile : {}),
                has_agreed_to_tos: true
            }
        };
        sessionStorage.setItem('mintraiq_bootstrap', JSON.stringify({ ...merged, at: Date.now() }));
        goToNextSetupStep(merged);
        return;
    }

    const content = legalState?.content;
    const version = String(content?.version || '').trim();
    if (!version) {
        status('Legal content is missing a version. Please contact support.');
        return;
    }

    showTermsPhase(true);

    const disEl = document.getElementById('onboardingDisclaimerBody');
    const tosEl = document.getElementById('onboardingTosBody');
    const footEl = document.getElementById('onboardingInsightsFoot');
    if (disEl) disEl.textContent = content?.disclaimer || 'Disclaimer is not available.';
    if (tosEl) tosEl.textContent = content?.tos || 'Terms are temporarily unavailable.';
    if (footEl) footEl.textContent = content?.insights_footer || '';

    const cb = document.getElementById('onboardingAgreeCheckbox');
    const btn = document.getElementById('onboardingAgreeContinue');
    const err = document.getElementById('onboardingTermsError');
    if (!cb || !btn) return;

    const syncBtn = () => {
        btn.disabled = !cb.checked;
        btn.style.opacity = cb.checked ? '1' : '0.55';
    };
    cb.addEventListener('change', syncBtn);
    syncBtn();

    btn.addEventListener('click', async () => {
        if (!cb.checked || err) err.textContent = '';
        btn.disabled = true;
        btn.textContent = 'Saving…';
        try {
            await agreeToLegalTerms(client, version);
            clearLegalContentState();
            try {
                await loadLegalContent(client, { force: true });
            } catch {
                /* session patch below is enough to proceed */
            }
            const merged = mergeBootstrapUserStatus(sessionBootstrap, version);
            sessionBootstrap = { ...merged, at: Date.now() };
            sessionStorage.setItem('mintraiq_bootstrap', JSON.stringify(sessionBootstrap));
            goToNextSetupStep(sessionBootstrap);
        } catch (e) {
            if (err) err.textContent = String(e?.message || 'Could not record agreement. Please try again.');
            btn.textContent = 'Agree and continue to setup';
            btn.disabled = !cb.checked;
            syncBtn();
        }
    });
}

main().catch((e) => {
    showTermsPhase(false);
    status(String(e?.message || 'Could not open onboarding. Please refresh and try again.'));
});
