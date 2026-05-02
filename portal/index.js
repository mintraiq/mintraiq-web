import { createLogtoClient } from './js/logto-client.js';
import { CONFIG, getPortalBase } from './js/config.js';

const statusEl = document.getElementById('status');

async function main() {
    const client = createLogtoClient();
    try {
        if (await client.isAuthenticated()) {
            window.location.replace('../mock-dashboard.html');
            return;
        }
        statusEl.textContent = '';
    } catch (e) {
        statusEl.textContent = String(e.message || e);
        return;
    }

    document.getElementById('signIn').addEventListener('click', () => {
        statusEl.textContent = 'Redirecting to Logto…';
        const redirectUri =
            (CONFIG.signInRedirectUri && String(CONFIG.signInRedirectUri).trim()) ||
            `${getPortalBase()}/callback.html`;
        client.signIn(redirectUri);
    });
}

main();
