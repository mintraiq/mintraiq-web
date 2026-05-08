import { createLogtoClient } from './js/logto-client.js';
import { bootstrapSession } from './js/bootstrap.js';
import { visitWithTurbo } from './js/turbo-visit.js';
import { claimPageScript } from './js/page-script-guard.js';

const statusEl = document.getElementById('status');

function escapeHtml(s) {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

async function main() {
    if (!claimPageScript('portal-callback-main')) return;
    const client = createLogtoClient();
    try {
        await client.handleSignInCallback(window.location.href);
        if (!(await client.isAuthenticated())) {
            statusEl.textContent = 'Sign-in did not complete. Close this tab and try again from the portal.';
            return;
        }
        statusEl.textContent = 'Calling finance API bootstrap…';
        const data = await bootstrapSession(client);
        sessionStorage.setItem('mintraiq_bootstrap', JSON.stringify({ ...data, at: Date.now() }));
        statusEl.textContent = 'Success. Opening your workspace…';
        const { resolveDashboardEntry } = await import('./js/config.js');
        const next = resolveDashboardEntry(data);
        visitWithTurbo(next, { replace: true });
    } catch (e) {
        const dev =
            typeof location !== 'undefined' &&
            (location.hostname === 'localhost' || location.hostname === '127.0.0.1');
        if (dev) console.error(e);
        const extra = e.body ? `\n\n${JSON.stringify(e.body, null, 2)}` : '';
        const msg = escapeHtml(String(e.message || e));
        const extraSafe = escapeHtml(extra);
        statusEl.innerHTML = `<strong>Something went wrong</strong><pre>${msg}${extraSafe}</pre><p><a href="./index.html" style="color:#7ee8ff">Back to sign-in</a></p>`;
    }
}

main();
