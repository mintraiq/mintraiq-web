import { guardSession } from './guard-session.js';

await guardSession();

document.getElementById('aiSettingsForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
});
