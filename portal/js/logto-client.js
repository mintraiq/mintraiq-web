import { LogtoClient } from '../auth.js';
import { CONFIG } from './config.js';

let sharedClient = null;

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
    sessionStorage.removeItem('mintraiq_bootstrap');
    const url = new URL('../index.html', import.meta.url);
    url.searchParams.set('reauth', '1');
    url.searchParams.set('reason', reason);
    window.location.replace(url.href);
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
