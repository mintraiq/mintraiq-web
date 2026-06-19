/**
 * Installs the auth bridge consumed by the React embed's forecast API module
 * (apps/ninja-react/src/api/forecasts.ts). Must load BEFORE ninja-ui.js.
 * The portal owns the Logto session; the embed only receives a token getter.
 */
import { CONFIG } from './config.js';
import { createLogtoClient, getAccessTokenOrReauth } from './logto-client.js';
import { claimPageScript } from './page-script-guard.js';

if (claimPageScript('forecast-analytics-boot')) {
    const logtoClient = createLogtoClient();
    window.__MINTRAIQ_FORECAST_BRIDGE__ = {
        financeApiBase: CONFIG.financeApiBase,
        getAccessToken: () => getAccessTokenOrReauth(logtoClient, CONFIG.financeApiResource)
    };
}
