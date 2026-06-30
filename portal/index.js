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
    if (!claimPageScript('portal-index-main')) return;
    /** Stale refresh token + valid-looking id token causes isAuthenticated→bootstrap→invalid_grant→reauth loop without clearing Logto storage. */
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

    const signInBtn = document.getElementById('signIn');
    let oauthNavLock = false;
    signInBtn.addEventListener('click', () => {
        if (oauthNavLock) return;
        oauthNavLock = true;
        signInBtn.disabled = true;
        if (statusEl) statusEl.textContent = 'Redirecting to secure sign-in…';
        clearPendingLogtoOAuthSession();
        resetLogtoClient();
        createLogtoClient().signIn(getSignInRedirectUri());
    });

    // Email/password (feature-flagged: social-only by default).
    if (isEmailPasswordAuthEnabled()) {
        const emailBlock = document.getElementById('emailAuthBlock');
        if (emailBlock) emailBlock.style.display = 'block';
        const emailSubmit = document.getElementById('emailSubmit');
        const emailModeToggle = document.getElementById('emailModeToggle');
        let isSignUp = false;

        emailModeToggle?.addEventListener('click', (e) => {
            e.preventDefault();
            isSignUp = !isSignUp;
            emailSubmit.textContent = isSignUp ? 'Create account' : 'Sign in';
            emailModeToggle.textContent = isSignUp ? 'Have an account? Sign in' : 'New here? Create an account';
            if (statusEl) statusEl.textContent = '';
        });

        emailSubmit?.addEventListener('click', async () => {
            const email = document.getElementById('emailInput').value.trim();
            const password = document.getElementById('passwordInput').value;
            if (!email || !password) {
                if (statusEl) statusEl.textContent = 'Enter your email and password.';
                return;
            }
            emailSubmit.disabled = true;
            if (statusEl) statusEl.textContent = isSignUp ? 'Creating your account…' : 'Signing in…';
            try {
                const c = createLogtoClient();
                if (isSignUp) {
                    const data = await c.signUpWithPassword(email, password);
                    if (!data.session) {
                        // Email confirmation required (no session yet).
                        if (statusEl) statusEl.textContent = 'Check your email to confirm your account, then sign in.';
                        isSignUp = false;
                        emailSubmit.textContent = 'Sign in';
                        emailModeToggle.textContent = 'New here? Create an account';
                        emailSubmit.disabled = false;
                        return;
                    }
                } else {
                    await c.signInWithPassword(email, password);
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
