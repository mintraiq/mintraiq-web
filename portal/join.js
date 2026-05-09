import { createLogtoClient, isInvalidGrantError, purgeAuthForRelogin, redirectToSignIn } from './js/logto-client.js';
import { getSignInRedirectUri, resolveDashboardEntry } from './js/config.js';
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
    if (!isBootstrapOk(data)) {
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

    joinBtn.addEventListener('click', () => {
        const redirectUri = getSignInRedirectUri();
        if (statusEl) statusEl.textContent = 'Opening secure registration…';
        // Same as returning-user flow: do not await — signIn navigates away; awaiting can race unload.
        // interactionMode 'signUp' shows register first; redirect_uri must match callback exactly (getSignInRedirectUri).
        void client.signIn({
            redirectUri,
            interactionMode: 'signUp'
        });
    });
}

main();
