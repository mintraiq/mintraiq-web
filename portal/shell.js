import { createLogtoClient, purgeAuthForRelogin } from './js/logto-client.js';

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
    const postLogout = new URL('../intro.html', window.location.href).href;
    sessionStorage.removeItem('mintraiq_bootstrap');
    try {
        const client = createLogtoClient();
        await client.signOut(postLogout);
    } catch (err) {
        console.error(err);
        purgeAuthForRelogin();
        window.location.replace(postLogout);
    }
});
