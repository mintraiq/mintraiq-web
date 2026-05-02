import { guardSession } from './js/guard-session.js';
import { createLogtoClient } from './js/logto-client.js';

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

const b = readBootstrap();
const profile = b && b.profile;
const claims = await createLogtoClient().getIdTokenClaims();
const name =
    (profile && profile.name) ||
    claims.name ||
    claims.username ||
    claims.preferred_username ||
    '';
const email = (profile && profile.email) || claims.email || '';

const nameEl = document.getElementById('profileName');
const emailEl = document.getElementById('profileEmail');
if (nameEl) nameEl.value = name;
if (emailEl) emailEl.value = email;

document.getElementById('profileForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
});
