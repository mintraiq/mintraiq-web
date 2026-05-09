import { LogtoClient } from '../auth.js';
import { CONFIG } from './config.js';
import { clearLegalContentState } from './legal-store.js';

let sharedClient = null;
const SENSITIVE_SESSION_PREFIXES = ['mintraiq_settings_workflow_draft_v1', 'mintraiq_settings_workflow_mode_v1'];

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
    clearClientSessionArtifacts();
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
