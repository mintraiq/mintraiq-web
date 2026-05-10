import { createLogtoClient, purgeAuthForRelogin } from './js/logto-client.js';
import { bootstrapSession } from './js/bootstrap.js';
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
        // Full navigation after OAuth — avoids Turbo/cache edge cases where the callback query must match the stored redirect_uri session.
        window.location.replace(new URL(next, window.location.href).href);
    } catch (e) {
        const dev =
            typeof location !== 'undefined' &&
            (location.hostname === 'localhost' || location.hostname === '127.0.0.1');
        if (dev) console.error(e);
        const extra = e.body ? `\n\n${JSON.stringify(e.body, null, 2)}` : '';
        const msg = escapeHtml(String(e.message || e));
        const extraSafe = escapeHtml(extra);
        const hint =
            '<p style="font-size:0.88rem;margin-top:12px;color:#9ca3af">If this keeps happening in your normal browser but works in a private window, saved login data is likely out of sync. Clear it and try again.</p>';
        const recoverBtn =
            '<p style="margin-top:14px"><button type="button" id="mintClearStuckOAuth" style="padding:10px 16px;border-radius:10px;border:1px solid rgba(126,232,255,0.4);background:#111827;color:#7ee8ff;font-weight:700;cursor:pointer">Clear saved login &amp; try again</button></p>';
        statusEl.innerHTML = `<strong>Something went wrong</strong><pre>${msg}${extraSafe}</pre>${hint}${recoverBtn}<p><a href="./index.html" style="color:#7ee8ff">Back to sign-in</a></p>`;
        document.getElementById('mintClearStuckOAuth')?.addEventListener('click', () => {
            purgeAuthForRelogin();
            window.location.replace('./index.html');
        });
    }
}

main();
