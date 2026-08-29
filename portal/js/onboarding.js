import { createLogtoClient } from './logto-client.js';
import { bootstrapSession } from './bootstrap.js';
import { isBootstrapOnboardingComplete } from './config.js';
import { visitWithTurbo } from './turbo-visit.js';
import { hrefForStep, isKnownStep } from './onboarding-steps.js';
import {
    MARKETING_CONSENT_BODY,
    MARKETING_CONSENT_DECLINE_NOTE,
    MARKETING_CONSENT_LABEL,
    MARKETING_CONSENT_SAVE_FAILED,
    saveMarketingConsent
} from './marketing-consent.js';
import {
    agreeToLegalTerms,
    clearLegalContentState,
    loadLegalContent,
    userStatusFromBootstrapPayload
} from './legal-store.js';

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

    // An unrecognised step means the server is ahead of this build (a step was
    // added before the page shipped). This used to fall back to profile, which
    // silently dropped the user on the wrong screen with no error — the failure
    // looked identical to working software. Say so instead.
    const target = hrefForStep(step, { setup: true });
    if (!target) {
        console.error(`[onboarding] server requested unknown step "${step}" — no page for it in this build`);
        status('This setup step is not available in this version. Please refresh, or contact support if it persists.');
        return;
    }

    status('Onward — your next setup step is ready.');
    visitWithTurbo(target, { replace: true });
}

let onboardingAbort = null;

async function bootOnboardingPage() {
    if (document.body?.dataset?.onboardingPage !== '1') return;
    onboardingAbort?.abort();
    const ac = new AbortController();
    onboardingAbort = ac;
    const { signal } = ac;

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

    // Rendered from the shared constants rather than written into the markup,
    // so the wording has exactly one source per repo and the guard test has
    // something to assert against.
    const marketingCb = document.getElementById('onboardingMarketingCheckbox');
    const marketingErr = document.getElementById('onboardingMarketingError');
    const setText = (id, text) => {
        const node = document.getElementById(id);
        if (node) node.textContent = text;
    };
    setText('onboardingMarketingLabel', MARKETING_CONSENT_LABEL);
    setText('onboardingMarketingBody', MARKETING_CONSENT_BODY);
    setText('onboardingMarketingDecline', MARKETING_CONSENT_DECLINE_NOTE);
    // Never carried over from a previous visit or a restored form state. A
    // pre-ticked box is not consent under the Unsolicited Electronic Messages
    // Act 2007, and bfcache restores a checked box on a back-navigation.
    if (marketingCb) marketingCb.checked = false;

    const syncBtn = () => {
        btn.disabled = !cb.checked;
        btn.style.opacity = cb.checked ? '1' : '0.55';
    };
    cb.addEventListener('change', syncBtn, { signal });
    syncBtn();

    btn.addEventListener('click', async () => {
        if (!cb.checked || err) err.textContent = '';
        btn.disabled = true;
        btn.textContent = 'Saving…';
        if (marketingErr) marketingErr.textContent = '';
        try {
            // Saved before the agreement, and a failure unticks the box and
            // stops this press rather than continuing. The alternative is
            // navigating away while showing a notice nobody can read, which is
            // how a dropped consent comes to look exactly like a recorded one.
            // It cannot lock anyone out: the box is unticked now, so the next
            // press attempts nothing and proceeds.
            if (marketingCb && marketingCb.checked) {
                const token = await client.getAccessToken();
                const stored = await saveMarketingConsent({
                    consented: true,
                    source: 'onboarding_legal',
                    token,
                    // The version the user was actually shown, not a guess.
                    policyVersion: version
                });
                if (!stored) {
                    marketingCb.checked = false;
                    if (marketingErr) marketingErr.textContent = MARKETING_CONSENT_SAVE_FAILED;
                    btn.textContent = 'Agree and continue to setup';
                    syncBtn();
                    return;
                }
            }

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
    }, { signal });
}

void bootOnboardingPage().catch((e) => {
    showTermsPhase(false);
    status(String(e?.message || 'Could not open onboarding. Please refresh and try again.'));
});

if (!window.__mintOnboardingTurboLoad) {
    window.__mintOnboardingTurboLoad = true;
    document.addEventListener('turbo:load', () => {
        void bootOnboardingPage().catch((e) => {
            showTermsPhase(false);
            status(String(e?.message || 'Could not open onboarding. Please refresh and try again.'));
        });
    });
}
