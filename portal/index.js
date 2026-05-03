import { createLogtoClient } from './js/logto-client.js';
import { CONFIG, getPortalBase, resolveDashboardEntry } from './js/config.js';
import { bootstrapSession } from './js/bootstrap.js';

const statusEl = document.getElementById('status');

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
    window.location.replace(resolveDashboardEntry(data));
}

async function main() {
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

    document.getElementById('signIn').addEventListener('click', () => {
        if (statusEl) statusEl.textContent = 'Redirecting to Logto…';
        const redirectUri =
            (CONFIG.signInRedirectUri && String(CONFIG.signInRedirectUri).trim()) ||
            `${getPortalBase()}/callback.html`;
        client.signIn(redirectUri);
    });
}

main();
