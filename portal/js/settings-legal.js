import { createLogtoClient } from './logto-client.js';
import { guardSession } from './guard-session.js';
import { loadLegalContent } from './legal-store.js';
import { claimPageScript } from './page-script-guard.js';

function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value || '';
}

await guardSession();

if (claimPageScript('settings-legal')) {
    const client = createLogtoClient();
    setText('legalStatus', 'Loading legal content…');
    try {
        const content = await loadLegalContent(client);
        setText('legalTos', content?.tos || 'Terms are not available yet.');
        setText('legalDisclaimer', content?.disclaimer || 'Disclaimer is not available yet.');
        setText('legalInsightsFooter', content?.insights_footer || 'Insights footer is not available yet.');
        setText('legalStatus', '');
    } catch (e) {
        setText('legalStatus', String(e?.message || 'Could not load legal content.'));
    }
}
