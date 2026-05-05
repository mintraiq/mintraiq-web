import { claimPageScript } from './page-script-guard.js';

const STATE = 'is-turbo-transitioning';

function beginTransition() {
    document.documentElement.classList.add(STATE);
}

function endTransition() {
    requestAnimationFrame(() => {
        document.documentElement.classList.remove(STATE);
    });
}

export function installPortalTransitions() {
    if (!claimPageScript('portal-turbo-transitions')) return;
    document.addEventListener('turbo:visit', beginTransition);
    document.addEventListener('turbo:render', endTransition);
    document.addEventListener('turbo:load', endTransition);
}
