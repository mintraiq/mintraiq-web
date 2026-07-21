import {
    clearPendingLogtoOAuthSession,
    createLogtoClient,
    isInvalidGrantError,
    purgeAuthForRelogin,
    redirectToSignIn,
    resetLogtoClient
} from './js/logto-client.js';
import { getSignInRedirectUri, isBootstrapOnboardingComplete, isEmailPasswordAuthEnabled, resolveDashboardEntry } from './js/config.js';
import { bootstrapSession } from './js/bootstrap.js';
import { visitWithTurbo } from './js/turbo-visit.js';
import { claimPageScript } from './js/page-script-guard.js';

const statusEl = document.getElementById('status');
const qs = new URLSearchParams(window.location.search);
if (statusEl && qs.get('reauth') === '1') {
    statusEl.textContent = 'Session expired. Please sign in again.';
}

function readBootstrap() {
    const raw = sessionStorage.getItem('mintraiq_bootstrap');
    if (!raw) return null;
    try {
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

function isBootstrapOk(b) {
    return b && typeof b === 'object' && b.status === 'success';
}

/** Authenticated users always enter the Logto portal workspace, never the marketing mock dashboard. */
async function openWorkspace(client) {
    if (statusEl) statusEl.textContent = 'Opening your workspace…';
    let data = readBootstrap();
    const needFresh = !isBootstrapOk(data) || (isBootstrapOk(data) && !isBootstrapOnboardingComplete(data));
    if (needFresh) {
        if (statusEl) statusEl.textContent = 'Connecting to finance API…';
        data = await bootstrapSession(client);
        sessionStorage.setItem('mintraiq_bootstrap', JSON.stringify({ ...data, at: Date.now() }));
    }
    visitWithTurbo(resolveDashboardEntry(data), { replace: true });
}

async function main() {
    if (!claimPageScript('portal-join-main')) return;
    if (qs.get('reauth') === '1') {
        purgeAuthForRelogin();
    }
    const client = createLogtoClient();
    try {
        if (await client.isAuthenticated()) {
            try {
                await openWorkspace(client);
            } catch (err) {
                if (isInvalidGrantError(err)) {
                    redirectToSignIn('invalid-grant');
                    return;
                }
                console.error(err);
                if (statusEl) statusEl.textContent = String(err.message || err);
                return;
            }
            return;
        }
        if (statusEl) statusEl.textContent = '';
    } catch (e) {
        console.error(e);
        if (statusEl) statusEl.textContent = String(e.message || e);
        return;
    }

    const joinBtn = document.getElementById('joinMintraiq');
    if (!joinBtn) return;

    let oauthNavLock = false;
    joinBtn.addEventListener('click', () => {
        if (oauthNavLock) return;
        oauthNavLock = true;
        joinBtn.disabled = true;
        const redirectUri = getSignInRedirectUri();
        if (statusEl) statusEl.textContent = 'Redirecting to Google…';
        clearPendingLogtoOAuthSession();
        resetLogtoClient();
        void createLogtoClient().signIn({
            redirectUri,
            interactionMode: 'signUp'
        });
    });

    // Passwordless email OTP (first-class — creates account if new).
    const otpEmailInput = document.getElementById('otpEmailInput');
    const otpSendBtn = document.getElementById('otpSendBtn');
    const otpCodeRow = document.getElementById('otpCodeRow');
    const otpCodeInput = document.getElementById('otpCodeInput');
    const otpVerifyBtn = document.getElementById('otpVerifyBtn');
    const otpResend = document.getElementById('otpResend');
    const otpChange = document.getElementById('otpChange');

    async function sendOtp() {
        const email = (otpEmailInput.value || '').trim().toLowerCase();
        if (!email) {
            if (statusEl) statusEl.textContent = 'Enter your email address.';
            return;
        }
        otpSendBtn.disabled = true;
        if (statusEl) statusEl.textContent = 'Sending your code…';
        try {
            await createLogtoClient().signInWithOtp(email);
            otpCodeRow.style.display = 'block';
            if (statusEl) statusEl.textContent = `We emailed a 6-digit code to ${email}. Enter it below.`;
        } catch (err) {
            if (statusEl) statusEl.textContent = String((err && err.message) || err);
        } finally {
            otpSendBtn.disabled = false;
        }
    }

    otpSendBtn?.addEventListener('click', sendOtp);
    otpResend?.addEventListener('click', (e) => {
        e.preventDefault();
        sendOtp();
    });
    otpChange?.addEventListener('click', (e) => {
        e.preventDefault();
        otpCodeRow.style.display = 'none';
        otpCodeInput.value = '';
        if (statusEl) statusEl.textContent = '';
    });

    otpVerifyBtn?.addEventListener('click', async () => {
        const email = (otpEmailInput.value || '').trim().toLowerCase();
        const token = (otpCodeInput.value || '').trim();
        if (token.length < 6) {
            if (statusEl) statusEl.textContent = 'Enter the 6-digit code from your email.';
            return;
        }
        otpVerifyBtn.disabled = true;
        if (statusEl) statusEl.textContent = 'Verifying…';
        try {
            const c = createLogtoClient();
            await c.verifyOtp(email, token);
            await openWorkspace(c);
        } catch (err) {
            if (statusEl) statusEl.textContent = String((err && err.message) || err);
            otpVerifyBtn.disabled = false;
        }
    });

    // Email/password sign-up (feature-flagged: social + OTP by default).
    if (isEmailPasswordAuthEnabled()) {
        const emailBlock = document.getElementById('emailAuthBlock');
        if (emailBlock) emailBlock.style.display = 'block';
        const emailSubmit = document.getElementById('emailSubmit');

        emailSubmit?.addEventListener('click', async () => {
            const email = document.getElementById('emailInput').value.trim();
            const password = document.getElementById('passwordInput').value;
            if (!email || !password) {
                if (statusEl) statusEl.textContent = 'Enter your email and password.';
                return;
            }
            emailSubmit.disabled = true;
            if (statusEl) statusEl.textContent = 'Creating your account…';
            try {
                const c = createLogtoClient();
                const data = await c.signUpWithPassword(email, password);
                if (!data.session) {
                    if (statusEl) statusEl.textContent = 'Check your email to confirm your account, then sign in.';
                    emailSubmit.disabled = false;
                    return;
                }
                await openWorkspace(c);
            } catch (err) {
                if (statusEl) statusEl.textContent = String((err && err.message) || err);
                emailSubmit.disabled = false;
            }
        });
    }
}

main();
