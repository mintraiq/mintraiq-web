import { createLogtoClient } from './js/logto-client.js';
import { bootstrapSession } from './js/bootstrap.js';
import { visitWithTurbo } from './js/turbo-visit.js';
import { claimPageScript } from './js/page-script-guard.js';
import { agreeToLegalTerms, loadLegalContent } from './js/legal-store.js';

const statusEl = document.getElementById('status');

function escapeHtml(s) {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function shouldShowOnboardingLegal(bootstrap) {
    const isNewUser = bootstrap?.is_new_user === true;
    const hasAgreed = bootstrap?.user_status?.has_agreed === true;
    return isNewUser && !hasAgreed;
}

async function showWelcomeTermsModal(content, onContinue) {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.style.position = 'fixed';
        overlay.style.inset = '0';
        overlay.style.background = 'rgba(7, 12, 21, 0.94)';
        overlay.style.zIndex = '9999';
        overlay.style.display = 'flex';
        overlay.style.alignItems = 'center';
        overlay.style.justifyContent = 'center';
        overlay.style.padding = '24px';

        const panel = document.createElement('div');
        panel.style.width = 'min(820px, 100%)';
        panel.style.maxHeight = '90vh';
        panel.style.overflow = 'auto';
        panel.style.background = '#111827';
        panel.style.border = '1px solid rgba(255,255,255,0.12)';
        panel.style.borderRadius = '12px';
        panel.style.padding = '20px';
        panel.style.color = '#d7deea';

        const title = document.createElement('h2');
        title.textContent = 'Welcome to MintrAIQ';
        title.style.margin = '0 0 6px';

        const sub = document.createElement('p');
        sub.textContent = 'Please review and accept the legal terms to continue.';
        sub.style.color = '#a0a0a0';
        sub.style.margin = '0 0 16px';

        const tos = document.createElement('pre');
        tos.textContent = content?.tos || 'Terms are temporarily unavailable.';
        tos.style.whiteSpace = 'pre-wrap';
        tos.style.background = '#0b1220';
        tos.style.border = '1px solid rgba(255,255,255,0.1)';
        tos.style.padding = '12px';
        tos.style.borderRadius = '8px';

        const dis = document.createElement('p');
        dis.textContent = content?.disclaimer || '';
        dis.style.margin = '14px 0 10px';
        dis.style.color = '#9fb0c9';

        const consentWrap = document.createElement('label');
        consentWrap.style.display = 'flex';
        consentWrap.style.gap = '10px';
        consentWrap.style.alignItems = 'flex-start';
        consentWrap.style.marginTop = '8px';
        consentWrap.style.fontSize = '0.92rem';
        const consent = document.createElement('input');
        consent.type = 'checkbox';
        consent.style.marginTop = '2px';
        const consentText = document.createElement('span');
        consentText.textContent = 'I have read and agree to the Terms and Disclaimer.';
        consentWrap.appendChild(consent);
        consentWrap.appendChild(consentText);

        const error = document.createElement('p');
        error.style.color = '#ffb4b4';
        error.style.minHeight = '1.2em';
        error.style.margin = '10px 0 0';

        const actions = document.createElement('div');
        actions.style.display = 'flex';
        actions.style.justifyContent = 'flex-end';
        actions.style.marginTop = '14px';
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = 'Continue';
        btn.disabled = true;
        btn.style.padding = '10px 16px';
        btn.style.background = '#00ff9d';
        btn.style.color = '#0c1322';
        btn.style.border = 'none';
        btn.style.borderRadius = '8px';
        btn.style.fontWeight = '700';
        btn.style.cursor = 'pointer';
        btn.style.opacity = '0.55';
        actions.appendChild(btn);

        consent.addEventListener('change', () => {
            btn.disabled = !consent.checked;
            btn.style.opacity = consent.checked ? '1' : '0.55';
        });

        btn.addEventListener('click', async () => {
            btn.disabled = true;
            btn.textContent = 'Saving…';
            error.textContent = '';
            try {
                await onContinue();
                overlay.remove();
                resolve();
            } catch (e) {
                error.textContent = String(e?.message || 'Could not record agreement. Please try again.');
                btn.textContent = 'Continue';
                btn.disabled = !consent.checked;
            }
        });

        panel.append(title, sub, tos, dis, consentWrap, error, actions);
        overlay.appendChild(panel);
        document.body.appendChild(overlay);
    });
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
        let legalState = null;
        try {
            legalState = await loadLegalContent(client);
        } catch {
            // Keep onboarding flow resilient even if legal-content endpoint is temporarily unavailable.
        }

        if (shouldShowOnboardingLegal(data)) {
            statusEl.textContent = '';
            await showWelcomeTermsModal(legalState?.content, async () => {
                const version = legalState?.content?.version;
                await agreeToLegalTerms(client, version);
                data.user_status = { ...(data.user_status || {}), has_agreed: true };
            });
        }

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
