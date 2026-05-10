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

function wirePurgeRetryButton() {
    document.getElementById('mintClearStuckOAuth')?.addEventListener('click', () => {
        purgeAuthForRelogin();
        window.location.replace('./index.html');
    });
}

/**
 * Logto sometimes redirects here with ?error=invalid_grant (no `code`) when the grant/PKCE step fails on their side
 * or the browser reuses an old callback URL. Do not call handleSignInCallback — it cannot recover from this.
 */
function showOAuthRedirectError(params) {
    const err = params.get('error') || 'unknown_error';
    const rawDesc = params.get('error_description') || '';
    const errSafe = escapeHtml(err);
    const descSafe = escapeHtml(rawDesc.replace(/\+/g, ' '));
    const grantHint =
        err === 'invalid_grant' || rawDesc.toLowerCase().includes('grant')
            ? '<p style="color:#9ca3af;font-size:0.9rem;line-height:1.55;margin-top:14px;text-align:left">This usually means the sign-in flow was interrupted or reused: do not refresh this page, do not use the browser Back button after Logto, avoid two sign-in tabs at once, and click Sign in only once. If it keeps happening, clear saved site data for mintraiq.com or use the button below, then try again in one tab.</p>'
            : '';
    const recoverBtn =
        '<p style="margin-top:16px"><button type="button" id="mintClearStuckOAuth" style="padding:10px 16px;border-radius:10px;border:1px solid rgba(126,232,255,0.4);background:#111827;color:#7ee8ff;font-weight:700;cursor:pointer">Clear saved login &amp; try again</button></p>';
    statusEl.innerHTML = `<strong>Sign-in could not complete</strong><p style="margin-top:10px"><code>${errSafe}</code></p><p style="margin-top:8px">${descSafe}</p>${grantHint}${recoverBtn}<p style="margin-top:12px"><a href="./index.html" style="color:#7ee8ff">Back to sign-in</a> · <a href="./join.html" style="color:#7ee8ff">Join</a></p>`;
    wirePurgeRetryButton();
}

async function main() {
    if (!claimPageScript('portal-callback-main')) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('error')) {
        showOAuthRedirectError(params);
        return;
    }
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
        wirePurgeRetryButton();
    }
}

main();
