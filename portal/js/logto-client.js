import { LogtoClient } from '../auth.js';
import { CONFIG } from './config.js';

export function createLogtoClient() {
    const opts = {
        endpoint: CONFIG.logtoEndpoint,
        appId: CONFIG.logtoAppId,
        scopes: ['openid', 'profile', 'offline_access', 'email']
    };
    if (CONFIG.financeApiResource) {
        opts.resources = [CONFIG.financeApiResource];
    }
    return new LogtoClient(opts);
}
