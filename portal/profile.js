import { guardSession } from './js/guard-session.js';
import { createLogtoClient } from './js/logto-client.js';
import { claimPageScript } from './js/page-script-guard.js';
import { resolveDisplayName, resolveEmail } from './js/user-display.js';

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

if (claimPageScript('profile-account')) {
    const b = readBootstrap();
    const profile = b && b.profile;
    const claims = await createLogtoClient().getIdTokenClaims();
    const name = resolveDisplayName(profile, claims);
    const email = resolveEmail(profile, claims);

    const nameEl = document.getElementById('profileName');
    const emailEl = document.getElementById('profileEmail');
    if (nameEl) nameEl.value = name;
    if (emailEl) emailEl.value = email;

    const av = document.getElementById('userAvatar');
    if (av) {
        if (name && name.length) {
            av.textContent = String(name).trim().charAt(0).toUpperCase();
        } else if (email && email.length) {
            av.textContent = email.trim().charAt(0).toUpperCase();
        }
    }

    document.getElementById('profileForm')?.addEventListener('submit', (e) => {
        e.preventDefault();
    });
}
