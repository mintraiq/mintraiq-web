import { createLogtoClient } from './logto-client.js';
import { guardSession } from './guard-session.js';
import { loadLegalContent } from './legal-store.js';
import { claimPageScript } from './page-script-guard.js';

function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value || '';
}

function fmtDate(s) {
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

await guardSession();

if (claimPageScript('settings-legal')) {
    const client = createLogtoClient();
    setText('legalStatus', 'Loading legal content…');
    try {
        const state = await loadLegalContent(client);
        const content = state?.content || {};
        const userStatus = state?.user_status || {};
        setText('legalTos', content?.tos || 'Terms are not available yet.');
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
                `Pending agreement${
                    content?.version ? ` for Version ${content.version}` : ''
                }. You will be prompted during onboarding if required.`
            );
        }
        setText('legalStatus', '');
    } catch (e) {
        setText('legalStatus', String(e?.message || 'Could not load legal content.'));
    }
}
