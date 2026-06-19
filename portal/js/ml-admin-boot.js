/**
 * Auth bridge for ML admin React embed (MintrAdminAgent only).
 */
import { CONFIG } from './config.js';
import { createLogtoClient, getAccessTokenOrReauth } from './logto-client.js';
import { claimPageScript } from './page-script-guard.js';

if (claimPageScript('ml-admin-boot')) {
    const logtoClient = createLogtoClient();
    window.__MINTRAIQ_ML_ADMIN_BRIDGE__ = {
        financeApiBase: CONFIG.financeApiBase,
        getAccessToken: () => getAccessTokenOrReauth(logtoClient, CONFIG.financeApiResource)
    };
}
