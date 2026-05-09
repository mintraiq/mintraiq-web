/**
 * Public SPA config (safe to commit). Never put Logto client_secret in the browser.
 *
 * financeApiResource MUST match `settings.api_identifier` in your FastAPI `config`:
 * finance_api.validate_token() decodes JWT with audience=API_IDENTIFIER (Logto API resource).
 *
 * Override for local dev (before module scripts):
 *   <script>window.__MINTRAIQ_ENV__ = {
 *     financeApiBase: "http://127.0.0.1:5000/api",
 *     financeApiResource: "https://your-api-resource-id-in-logto",
 *     logtoRegisterUrl: "https://your-tenant.logto.app/register?app_id=..." // optional; else PUBLIC_LOGTO_REGISTER_URL at build
 *   };</script>
 */
const defaults = {
    logtoEndpoint: 'https://ufq3nf.logto.app',
    /** Logto Application (SPA) App ID from Logto Console — override in portal/env.js per environment. */
    logtoAppId: 'jj76jvuz39xoys68ys7ly',
    /**
     * Hosted Logto sign-up URL (new users). Override via PUBLIC_LOGTO_REGISTER_URL or window.__MINTRAIQ_ENV__.
     * May be a full URL with ?app_id=… or a base path; missing app_id is appended from logtoAppId.
     * If unset entirely, derived as `${logtoEndpoint}/register?app_id=${logtoAppId}`.
     */
    logtoRegisterUrl: '',
    financeApiBase: 'https://api-dev.mintraiq.com/api',
    /** Required for Bearer tokens accepted by finance_api.validate_token (JWT aud = API_IDENTIFIER). */
    financeApiResource: '',
    /**
     * Optional. If set, signIn() uses this exact URL — it must match a Redirect URI in Logto Console.
     * If unset, uses `${getPortalBase()}/callback.html` (e.g. https://mintraiq.com/portal/callback.html).
     */
    signInRedirectUri: ''
};

/** Skip empty strings from generated runtime-env so local defaults still work when build omits tenant IDs. */
function mergePublicEnv(base, env) {
    const out = { ...base };
    if (!env || typeof env !== 'object') return out;
    for (const [k, v] of Object.entries(env)) {
        if (v == null) continue;
        if (typeof v === 'string' && v.trim() === '') continue;
        out[k] = v;
    }
    return out;
}

export const CONFIG = mergePublicEnv(defaults, window.__MINTRAIQ_ENV__);

/**
 * Builds a hosted `/register?app_id=…` URL (e.g. for docs or emails).
 * The portal join page uses `LogtoClient.signIn({ interactionMode: 'signUp' })` instead of navigating here directly, so OIDC state exists and Logto does not show `/unknown-session`.
 * @returns {string} HTTPS URL or empty if configuration is incomplete
 */
export function resolveLogtoRegisterUrl() {
    const id = CONFIG.logtoAppId && String(CONFIG.logtoAppId).trim();
    const explicit = CONFIG.logtoRegisterUrl && String(CONFIG.logtoRegisterUrl).trim();

    if (explicit) {
        try {
            const u = new URL(explicit);
            if (id && !u.searchParams.has('app_id')) {
                u.searchParams.set('app_id', id);
            }
            return u.toString();
        } catch {
            if (id && !/[?&]app_id=/.test(explicit)) {
                const sep = explicit.includes('?') ? '&' : '?';
                return `${explicit}${sep}app_id=${encodeURIComponent(id)}`;
            }
            return explicit;
        }
    }

    const base = CONFIG.logtoEndpoint && String(CONFIG.logtoEndpoint).replace(/\/$/, '');
    if (base && id) {
        return `${base}/register?app_id=${encodeURIComponent(id)}`;
    }
    return '';
}

/** Base URL for this portal (handles hosting under a subpath, e.g. /myapp/portal/). */
export function getPortalBase() {
    const path = location.pathname;
    const m = path.match(/^(.*\/portal)(?:\/|$)/);
    if (m) return location.origin + m[1];
    return location.origin + '/portal';
}

/**
 * Map finance_api POST /api/bootstrap JSON to a static HTML entry.
 *
 * Backend shape (finance_api.py):
 *   { status, is_new_user, routing: { dashboard_type, redirect_to_license }, profile: { name, tier } }
 *   dashboard_type: "landing" | "lite" | "full"
 */
export function resolveDashboardEntry(bootstrap) {
    if (!bootstrap || typeof bootstrap !== 'object') return './dashboard.html';

    // Only incomplete onboarding routes here. `is_new_user` often stays true forever and caused
    // callback → onboarding → dashboard → onboarding loops after the user had already finished setup.
    if (bootstrap.onboarding_complete !== true) {
        return './onboarding.html';
    }

    if (bootstrap.routing && bootstrap.routing.redirect_to_license === true) {
        return '../coming-soon.html?from=license';
    }

    const dash = bootstrap.routing && bootstrap.routing.dashboard_type;
    const map = {
        landing: './dashboard.html',
        lite: './dashboard.html',
        full: './dashboard.html'
    };
    return map[dash] || './dashboard.html';
}
