/**
 * Deploy-time config (no client_secret). Loaded before ES modules; merged into CONFIG in portal/js/config.js
 *
 * Same information as LogtoClient({ endpoint, appId, resources }) — see portal/js/logto-client.js
 */
window.__MINTRAIQ_ENV__ = Object.assign({}, window.__MINTRAIQ_ENV__ || {}, {
    logtoEndpoint: 'https://ufq3nf.logto.app',
    logtoAppId: 'jj76jvuz39xoys68ys7ly',
    financeApiBase: 'http://192.168.68.66:5000/api',
    financeApiResource: 'https://api.finance-ai.suite.com'
    // If Logto redirect URI is exactly https://mintraiq.com/callback.html (page at site root), uncomment:
    // signInRedirectUri: 'https://mintraiq.com/callback.html',
    // Otherwise register https://YOUR_DOMAIN/portal/callback.html in Logto and leave this unset.
});
