import { LogtoClient } from '../auth.js';
import { CONFIG } from './config.js';
import { clearLegalContentState } from './legal-store.js';

let sharedClient = null;
const SENSITIVE_SESSION_PREFIXES = ['mintraiq_settings_workflow_draft_v1', 'mintraiq_settings_workflow_mode_v1'];

/** Logto Browser SDK persists under `logto:${appId}` (see @logto/browser BrowserStorage). */
export function resetLogtoClient() {
    sharedClient = null;
}

/**
 * Remove Logto OIDC tokens and sign-in session from localStorage/sessionStorage.
 * Required after invalid_grant or before a clean re-login; otherwise isAuthenticated() stays true on a dead refresh token and the app loops.
 */
export function clearLogtoBrowserStorage() {
    if (typeof window === 'undefined') return;
    const id = CONFIG.logtoAppId && String(CONFIG.logtoAppId).trim();
    const prefix = id ? `logto:${id}` : '';
    for (const store of [localStorage, sessionStorage]) {
        for (let i = store.length - 1; i >= 0; i -= 1) {
            const k = store.key(i);
            if (!k || !k.startsWith('logto:')) continue;
            if (id) {
                if (k === prefix || k.startsWith(`${prefix}:`)) store.removeItem(k);
            } else {
                store.removeItem(k);
            }
        }
    }
}

/**
 * Clears only the in-flight OIDC sign-in session (sessionStorage).
 * Stale values here cause "Error found in the callback URI" in normal browsers after interrupted flows; incognito works because storage is empty.
 * @see @logto/browser BrowserStorage — keys `logto:${appId}:signInSession` and legacy `logto:${appId}`
 */
export function clearPendingLogtoOAuthSession() {
    if (typeof sessionStorage === 'undefined') return;
    const id = CONFIG.logtoAppId && String(CONFIG.logtoAppId).trim();
    if (id) {
        sessionStorage.removeItem(`logto:${id}:signInSession`);
        sessionStorage.removeItem(`logto:${id}`);
        return;
    }
    /** Config app id missing (e.g. empty build env): drop any Logto pending keys in sessionStorage only. */
    for (let i = sessionStorage.length - 1; i >= 0; i -= 1) {
        const k = sessionStorage.key(i);
        if (k && k.startsWith('logto:')) sessionStorage.removeItem(k);
    }
}

/** Full client-side auth wipe for re-login / recovery (Logto keys + MintrAIQ session + singleton). */
export function purgeAuthForRelogin() {
    clearLogtoBrowserStorage();
    resetLogtoClient();
    clearClientSessionArtifacts();
}

export function createLogtoClient() {
    if (sharedClient) return sharedClient;
    const opts = {
        endpoint: CONFIG.logtoEndpoint,
        appId: CONFIG.logtoAppId,
        scopes: ['openid', 'profile', 'offline_access', 'email']
    };
    if (CONFIG.financeApiResource) {
        opts.resources = [CONFIG.financeApiResource];
    }
    sharedClient = new LogtoClient(opts);
    return sharedClient;
}

export function isInvalidGrantError(error) {
    const s = String((error && (error.message || error.error || error.code)) || '').toLowerCase();
    return s.includes('invalid grant') || s.includes('grant request is invalid') || s.includes('invalid_grant');
}

export function redirectToSignIn(reason = 'invalid-grant') {
    purgeAuthForRelogin();
    const url = new URL('../index.html', import.meta.url);
    url.searchParams.set('reauth', '1');
    url.searchParams.set('reason', reason);
    window.location.replace(url.href);
}

export function clearClientSessionArtifacts() {
    sessionStorage.removeItem('mintraiq_bootstrap');
    clearLegalContentState();
    for (let i = sessionStorage.length - 1; i >= 0; i -= 1) {
        const key = sessionStorage.key(i);
        if (!key) continue;
        if (SENSITIVE_SESSION_PREFIXES.some((prefix) => key.startsWith(prefix))) {
            sessionStorage.removeItem(key);
        }
    }
}

export async function getAccessTokenOrReauth(logtoClient, resource) {
    try {
        return await logtoClient.getAccessToken(resource);
    } catch (e) {
        if (isInvalidGrantError(e)) {
            redirectToSignIn('invalid-grant');
        }
        throw e;
    }
}
