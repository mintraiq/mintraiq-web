import { guardSession } from './guard-session.js';
import { claimPageScript } from './page-script-guard.js';

await guardSession();

if (claimPageScript('settings-ai-form')) {
    document.getElementById('aiSettingsForm')?.addEventListener('submit', (e) => {
        e.preventDefault();
    });
}
