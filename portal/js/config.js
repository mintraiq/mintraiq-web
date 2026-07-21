/**
 * Public SPA config (safe to commit). Never put Logto client_secret in the browser.
 *
 * financeApiResource MUST match `settings.api_identifier` in your FastAPI `config`:
 * finance_api.validate_token() decodes JWT with audience=API_IDENTIFIER (Logto API resource).
 *
 * Service URLs (custom domains): see portal/js/service-endpoints.js and PUBLIC_* in .env.vars.
 *
 * Override for local dev (before module scripts):
 *   <script>window.__MINTRAIQ_ENV__ = {
 *     financeApiBase: "http://localhost:5000/api",
 *     financeApiResource: "https://your-api-resource-id-in-logto",
 *     logtoRegisterUrl: "https://your-tenant.logto.app/register?app_id=...", // optional
 *     featureReceiptScanner: true, // optional; receipt scanner + sidebar link (default false)
 *     ocrScannerApiUrl: "https://ocr-dev.mintraiq.com/ocr/scanner", // optional; POST multipart `file`
 *     ocrScannerApiResource: "" // optional Logto API resource for OCR JWT; defaults to financeApiResource
 *   };</script>
 */
import { CUSTOM_DOMAINS } from './service-endpoints.js';
/**
 * Repo fallbacks when `config/runtime-env.js` is missing (e.g. fresh clone before `npm run build:env`).
 * Deployed builds should set PUBLIC_* on Vercel; those values win via `window.__MINTRAIQ_ENV__`.
 */
const defaults = {
    // --- Supabase Auth (active provider) ---
    // Public values, safe in the browser (the publishable key is meant to be public;
    // RLS / server-side JWT verification protect data). Override via PUBLIC_* / runtime-env.js.
    supabaseUrl: 'https://ebpplhhokqolooxpwtxw.supabase.co',
    supabaseAnonKey: 'sb_publishable_5sMWq9v0UyUb-_BrZxD7ZA_9zHvYEWl',
    /**
     * Email/password auth toggle — false = social-only (launch default).
     * Flip via PUBLIC_AUTH_EMAIL_PASSWORD_ENABLED / runtime-env, and enable the
     * Supabase email provider + HIBP/CAPTCHA/SMTP, to expose email sign-in.
     */
    authEmailPasswordEnabled: false,

    // --- Logto (legacy — retained for rollback) ---
    logtoEndpoint: 'https://ufq3nf.logto.app',
    /** Logto Application (SPA) App ID — override via PUBLIC_LOGTO_APP_ID / runtime-env.js. */
    logtoAppId: 'jj76jvuz39xoys68ys7ly',
    /**
     * Hosted Logto sign-up URL (new users). Override via PUBLIC_LOGTO_REGISTER_URL or window.__MINTRAIQ_ENV__.
     * May be a full URL with ?app_id=… or a base path; missing app_id is appended from logtoAppId.
     * If unset entirely, derived as `${logtoEndpoint}/register?app_id=${logtoAppId}`.
     */
    logtoRegisterUrl: '',
    financeApiBase: 'http://localhost:5000/api',
    financeApiBaseStaging: CUSTOM_DOMAINS.staging.appApi,
    financeApiBaseProd: CUSTOM_DOMAINS.production.appApi,
    forecastApiBaseStaging: CUSTOM_DOMAINS.staging.forecasting,
    forecastApiBaseProd: CUSTOM_DOMAINS.production.forecasting,
    agentApiBaseStaging: CUSTOM_DOMAINS.staging.agent,
    agentApiBaseProd: CUSTOM_DOMAINS.production.agent,
    surveyUrlStaging: CUSTOM_DOMAINS.staging.survey,
    surveyUrlProd: CUSTOM_DOMAINS.production.survey,
    legacyFlaskBase: 'http://127.0.0.1:5000',
    fastApiDocsUrl: 'http://localhost:5000/api/docs',
    /**
     * Optional explicit per-environment finance API bases for the admin
     * Config & Secrets console environment switcher. When unset, the console
     * falls back to `financeApiBase` (this deployment's own environment).
     * Set via PUBLIC_FINANCE_API_BASE_STAGING / _PROD at build time.
     */
    financeApiResource: 'https://api.finance-ai.suite.com',
    /**
     * Optional. If set, signIn() uses this exact URL — it must match a Redirect URI in Logto Console.
     * If unset, uses `${getPortalBase()}/callback.html` (e.g. https://mintraiq.com/portal/callback.html).
     */
    signInRedirectUri: '',
    /**
     * Receipt scanner (camera → POST multipart to ocrScannerApiUrl). Off until ready in your env.
     * Enable with window.__MINTRAIQ_ENV__.featureReceiptScanner = true or PUBLIC_FEATURE_RECEIPT_SCANNER=1 at build.
     */
    featureReceiptScanner: false,
    /** Full URL for dedicated OCR service (not financeApiBase). */
    ocrScannerApiUrl: CUSTOM_DOMAINS.staging.scannerOcr,
    ocrScannerApiUrlProd: CUSTOM_DOMAINS.production.scannerOcr,
    /** If set, Logto access token is requested for this API resource; otherwise financeApiResource is used. */
    ocrScannerApiResource: '',
    /**
     * Stripe publishable key (pk_… — public, safe in browser). Enables
     * stripe-js redirectToCheckout; without it billing falls back to the
     * hosted Checkout URL returned by the backend.
     */
    stripePublishableKey: '',
    /**
     * Billing kill switch (mirror of backend REQUIRE_BILLING_PAYWALL).
     * When false, upgrade buttons / pro-tier prompts are hidden and the UI
     * behaves as if the user is already premium. Default: paywall on.
     */
    requireBillingPaywall: true
};

/** Build-time env from `config/runtime-env.js` (Vercel PUBLIC_* at deploy). */
function getWindowPublicEnv() {
    if (typeof window === 'undefined') return {};
    const env = window.__MINTRAIQ_ENV__;
    return env && typeof env === 'object' ? env : {};
}

function isEnvValueSet(v) {
    if (v == null) return false;
    if (typeof v === 'string') return v.trim() !== '';
    return true;
}

/**
 * Merge config: `window.__MINTRAIQ_ENV__` (Vercel / build) overrides repo defaults.
 * Empty strings in runtime-env are ignored so defaults still apply for optional keys.
 */
export function getConfig() {
    const out = { ...defaults };
    const env = getWindowPublicEnv();
    for (const [k, v] of Object.entries(env)) {
        if (!isEnvValueSet(v)) continue;
        out[k] = v;
    }
    return out;
}

/** Frozen at first module import; use getConfig() if env may change after load (rare). */
export const CONFIG = getConfig();

/**
 * Billing kill switch. Accepts boolean or string from runtime env.
 * @returns {boolean} true when the paywall (upgrade prompts) must be shown
 */
export function isBillingPaywallRequired() {
    const v = CONFIG.requireBillingPaywall;
    if (v === false) return false;
    if (typeof v === 'string') {
        const s = v.trim().toLowerCase();
        if (s === '0' || s === 'false' || s === 'no' || s === 'off') return false;
    }
    return true;
}

/**
 * Email/password auth toggle (default off → social-only).
 * Accepts boolean or string from runtime env ("1", "true", "0", "false").
 * @returns {boolean}
 */
export function isEmailPasswordAuthEnabled() {
    const v = CONFIG.authEmailPasswordEnabled;
    if (v === true) return true;
    if (v === false || v == null) return false;
    if (typeof v === 'string') {
        const s = v.trim().toLowerCase();
        return s === '1' || s === 'true' || s === 'yes' || s === 'on';
    }
    return Boolean(v);
}

/**
 * Receipt scanner UI + sidebar entry (requires working /receipt-scanner).
 * Accepts boolean or string from runtime env ("1", "true", "0", "false").
 * @returns {boolean}
 */
export function isFeatureReceiptScannerEnabled() {
    const v = CONFIG.featureReceiptScanner;
    if (v === true) return true;
    if (v === false || v == null) return false;
    if (typeof v === 'string') {
        const s = v.trim().toLowerCase();
        if (s === '' || s === '0' || s === 'false' || s === 'no' || s === 'off') return false;
        return s === '1' || s === 'true' || s === 'yes' || s === 'on';
    }
    return Boolean(v);
}

/**
 * True when the user may use the main workspace (dashboard first).
 * Backend can expose `onboarding.current_step === "complete"` while `onboarding_complete` is still false
 * if the DB flag lagged; treat both as finished so we never send them to profile with ?setup=1 again.
 * @param {unknown} bootstrap
 * @returns {boolean}
 */
export function isBootstrapOnboardingComplete(bootstrap) {
    if (!bootstrap || typeof bootstrap !== 'object') return false;
    if (bootstrap.onboarding_complete === true) return true;
    const on = bootstrap.onboarding;
    if (!on || typeof on !== 'object') return false;
    if (on.current_step === 'complete') return true;
    const required = on.required_steps;
    const completed = on.completed_steps;
    if (Array.isArray(required) && required.length && Array.isArray(completed)) {
        const done = new Set(completed.map((s) => String(s)));
        if (required.every((s) => done.has(String(s)))) return true;
    }
    return false;
}

/**
 * Builds a hosted `/register?app_id=…` URL (e.g. for docs or emails).
 * The portal join page (`join.html`) is the marketing sign-up entry. Google OAuth is opt-in via
 * “Continue with Google”; email OTP (and flagged email/password) stay on-page. Do not auto-start OAuth on load.
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
 * Canonical OAuth redirect_uri for Logto (signIn + handleSignInCallback).
 * Resolves relative CONFIG.signInRedirectUri against the current page so it always matches the browser location Logto redirects to.
 * Must match an entry in Logto Console → Application → Redirect URIs exactly (scheme + host + path).
 */
export function getSignInRedirectUri() {
    const raw =
        (CONFIG.signInRedirectUri && String(CONFIG.signInRedirectUri).trim()) ||
        `${getPortalBase()}/callback.html`;
    try {
        return new URL(raw, window.location.href).href;
    } catch {
        return raw;
    }
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
    if (!isBootstrapOnboardingComplete(bootstrap)) {
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
