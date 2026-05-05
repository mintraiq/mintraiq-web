import { createLogtoClient } from './js/logto-client.js';
import { bootstrapSession } from './js/bootstrap.js';
import { visitWithTurbo } from './js/turbo-visit.js';
import { claimPageScript } from './js/page-script-guard.js';

const statusEl = document.getElementById('status');

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
        console.error(e);
        const extra = e.body ? `\n\n${JSON.stringify(e.body, null, 2)}` : '';
        statusEl.innerHTML = `<strong>Something went wrong</strong><pre>${String(e.message || e)}${extra}</pre><p><a href="./index.html" style="color:#7ee8ff">Back to sign-in</a></p>`;
    }
}

main();
