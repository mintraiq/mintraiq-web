/**
 * Public SPA config (safe to commit). Client secret is never used in the browser.
 *
 * Optional override without editing this file:
 *   <script>window.__MINTRAIQ_ENV__ = { financeApiBase: "http://127.0.0.1:5000/api" };</script>
 *   <script type="module" src="./js/config.js"></script>
 *
 * For API JWT audience (Logto API Resource), set financeApiResource to that resource indicator.
 */
const defaults = {
    logtoEndpoint: 'https://ufq3nf.logto.app',
    logtoAppId: 'hixnqc71c0wz1a48awme4',
    financeApiBase: 'http://192.168.68.66:5000/api',
    /** e.g. "https://api.mintraiq.com" — leave empty to use default access token from Logto */
    financeApiResource: ''
};

export const CONFIG = { ...defaults, ...(window.__MINTRAIQ_ENV__ || {}) };

/** Base URL for this portal (handles hosting under a subpath, e.g. /myapp/portal/). */
export function getPortalBase() {
    const path = location.pathname;
    const m = path.match(/^(.*\/portal)(?:\/|$)/);
    if (m) return location.origin + m[1];
    return location.origin + '/portal';
}

/** Map FastAPI bootstrap route to a static page until real screens exist. */
export function resolvePostBootstrapRoute(route) {
    if (!route || typeof route !== 'string') return '../mock-dashboard.html';
    if (route.startsWith('http://') || route.startsWith('https://')) {
        try {
            return route;
        } catch {
            return '../mock-dashboard.html';
        }
    }
    const map = {
        '/lite-dashboard': '../mock-dashboard.html',
        '/dashboard': '../mock-dashboard.html',
        '/home': '../mock-dashboard.html',
        '/': '../mock-dashboard.html'
    };
    return map[route] || '../mock-dashboard.html';
}
