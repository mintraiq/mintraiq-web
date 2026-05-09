import { createLogtoClient } from './js/logto-client.js';
import { CONFIG, getPortalBase, resolveDashboardEntry, resolveLogtoRegisterUrl } from './js/config.js';
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
    const client = createLogtoClient();
    try {
        if (await client.isAuthenticated()) {
            await openWorkspace(client);
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
        const registerUrl = resolveLogtoRegisterUrl();
        if (registerUrl) {
            if (statusEl) statusEl.textContent = 'Opening secure registration…';
            window.location.assign(registerUrl);
            return;
        }
        if (statusEl) statusEl.textContent = 'Redirecting to Logto…';
        const redirectUri =
            (CONFIG.signInRedirectUri && String(CONFIG.signInRedirectUri).trim()) ||
            `${getPortalBase()}/callback.html`;
        client.signIn(redirectUri);
    });
}

main();
