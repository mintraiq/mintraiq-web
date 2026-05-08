import { createLogtoClient } from './logto-client.js';
import { guardSession } from './guard-session.js';
import { loadLegalContent, mergeUserStatuses, userStatusFromBootstrapPayload } from './legal-store.js';
import { claimPageScript } from './page-script-guard.js';
import { renderLegalFormatted } from './legal-format.js';

function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value || '';
}

function fmtDate(s) {
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
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

await guardSession();

if (claimPageScript('settings-legal')) {
    const client = createLogtoClient();
    setText('legalStatus', 'Loading legal content…');
    const tosEl = document.getElementById('legalTos');
    try {
        const fromBootstrap = userStatusFromBootstrapPayload(readBootstrap());
        const state = await loadLegalContent(client, { force: true });
        const content = state?.content || {};
        const userStatus = mergeUserStatuses(state?.user_status, fromBootstrap);
        renderLegalFormatted(tosEl, content?.tos, 'Terms are not available yet.');
        setText('legalDisclaimer', content?.disclaimer || 'Disclaimer is not available yet.');
        setText('legalInsightsFooter', content?.insights_footer || 'Insights footer is not available yet.');
        const agreedDate = fmtDate(userStatus?.agreed_at);
        if (userStatus?.has_agreed) {
            setText(
                'legalAgreementBadge',
                `✅ You agreed to Version ${userStatus?.agreed_version || content?.version || '—'}${
                    agreedDate ? ` on ${agreedDate}` : ''
                }`
            );
        } else {
            setText(
                'legalAgreementBadge',
                `No agreement on record for your account yet${
                    content?.version ? ` (current terms: Version ${content.version})` : ''
                }. You may be prompted during onboarding if required.`
            );
        }
        setText('legalStatus', '');
    } catch (e) {
        renderLegalFormatted(tosEl, '', 'Could not load terms from the server.');
        setText('legalDisclaimer', '');
        setText('legalInsightsFooter', '');
        setText('legalAgreementBadge', '');
        setText('legalStatus', String(e?.message || 'Could not load legal content.'));
    }
}
