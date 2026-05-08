import { createLogtoClient } from './logto-client.js';
import { bootstrapSession } from './bootstrap.js';
import { visitWithTurbo } from './turbo-visit.js';
import { claimPageScript } from './page-script-guard.js';

const STEP_TO_PAGE = {
    profile: './settings-profile.html?setup=1',
    billing: './settings-billing.html?setup=1',
    security: './settings-security.html?setup=1',
    banks: './settings-banks.html?setup=1',
    goals: './settings-goals.html?setup=1',
    categories: './settings-categories.html?setup=1',
    ai: './settings-ai.html?setup=1',
    notifications: './settings-notifications.html?setup=1'
};

function status(msg) {
    const node = document.getElementById('onboardingStatus');
    if (node) node.textContent = msg;
}

async function main() {
    if (!claimPageScript('portal-onboarding-main')) return;
    const client = createLogtoClient();
    if (!(await client.isAuthenticated())) {
        window.location.replace('./index.html');
        return;
    }

    status('Loading onboarding status…');
    const bootstrap = await bootstrapSession(client);
    sessionStorage.setItem('mintraiq_bootstrap', JSON.stringify({ ...bootstrap, at: Date.now() }));

    if (bootstrap?.onboarding_complete) {
        visitWithTurbo('./dashboard.html', { replace: true });
        return;
    }

    const step = bootstrap?.onboarding?.current_step || 'profile';
    const target = STEP_TO_PAGE[step] || STEP_TO_PAGE.profile;
    status('Redirecting to setup step…');
    visitWithTurbo(target, { replace: true });
}

main().catch((e) => {
    status(String(e?.message || 'Could not open onboarding. Please refresh and try again.'));
});
