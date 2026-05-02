import { createLogtoClient } from './js/logto-client.js';

const pre = document.getElementById('payload');
const raw = sessionStorage.getItem('mintraiq_bootstrap');
if (!raw) {
    pre.textContent = 'No bootstrap data in sessionStorage. Sign in from portal/index.html.';
} else {
    try {
        pre.textContent = JSON.stringify(JSON.parse(raw), null, 2);
    } catch {
        pre.textContent = raw;
    }
}

document.getElementById('logout').addEventListener('click', async () => {
    const client = createLogtoClient();
    const postLogout = new URL('../intro.html', window.location.href).href;
    sessionStorage.removeItem('mintraiq_bootstrap');
    await client.signOut(postLogout);
});
