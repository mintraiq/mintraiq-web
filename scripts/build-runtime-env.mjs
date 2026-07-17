/**
 * Generates a single config/runtime-env.js for the browser (no separate defaults file).
 * Sources:
 *   1) Built-in defaults (non-secret public endpoints — same keys as portal/js/config.js)
 *   2) process.env PUBLIC_* (Vercel build)
 *   3) env.public in repo root (optional local file, gitignored)
 *
 * Run: npm run build:env
 *
 * Note: any value shipped to the browser is visible to users (DevTools). Never put API keys
 * or Logto client secrets here — only public IDs and HTTPS URLs.
 */
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const outFile = join(root, 'config', 'runtime-env.js');

/**
 * Default public browser config (overridable via PUBLIC_* / env.public).
 * Logto endpoint + SPA app id are not secrets (OIDC), but real tenant values should
 * come from env / Vercel — do not rely on baked-in defaults in the repo.
 */
const DEFAULT_PUBLIC_ENV = {
    // Supabase (active auth). Real per-env values come from PUBLIC_* — never bake prod here.
    supabaseUrl: '',
    supabaseAnonKey: '',
    logtoEndpoint: '',
    logtoAppId: '',
    logtoRegisterUrl: '',
    financeApiBase: 'http://localhost:5000/api',
    financeApiBaseStaging: 'https://staging-app.mintraiq.com/api',
    financeApiBaseProd: 'https://app.mintraiq.com/api',
    forecastApiBaseStaging: 'https://staging-forecasting.mintraiq.com',
    forecastApiBaseProd: 'https://forecasting.mintraiq.com',
    agentApiBaseStaging: 'https://staging-agent.mintraiq.com',
    agentApiBaseProd: 'https://agent.mintraiq.com',
    surveyUrlStaging: 'https://staging-survey.mintraiq.com',
    surveyUrlProd: 'https://survey.mintraiq.com',
    financeApiResource: 'https://api.finance-ai.suite.com',
    signInRedirectUri: '',
    legacyFlaskBase: 'http://127.0.0.1:5000',
    fastApiDocsUrl: 'http://localhost:5000/api/docs',
    /** "0" / "false" until receipt OCR backend is ready; set "1" or "true" to enable. */
    featureReceiptScanner: false,
    ocrScannerApiUrl: 'https://staging-scanner.mintraiq.com/ocr/scanner',
    ocrScannerApiUrlProd: 'https://scanner.mintraiq.com/ocr/scanner',
    ocrScannerApiResource: '',
    /** Stripe publishable key (pk_… — browser-safe). Enables stripe-js redirectToCheckout. */
    stripePublishableKey: '',
    /** Billing kill switch mirror — "0"/"false" hides upgrade CTAs (UI renders as premium). */
    requireBillingPaywall: true
};

const PUBLIC_TO_ENV = {
    PUBLIC_SUPABASE_URL: 'supabaseUrl',
    PUBLIC_SUPABASE_ANON_KEY: 'supabaseAnonKey',
    PUBLIC_LOGTO_ENDPOINT: 'logtoEndpoint',
    PUBLIC_LOGTO_APP_ID: 'logtoAppId',
    PUBLIC_LOGTO_REGISTER_URL: 'logtoRegisterUrl',
    PUBLIC_FINANCE_API_BASE: 'financeApiBase',
    PUBLIC_FINANCE_API_BASE_STAGING: 'financeApiBaseStaging',
    PUBLIC_FINANCE_API_BASE_PROD: 'financeApiBaseProd',
    PUBLIC_FORECAST_API_BASE_STAGING: 'forecastApiBaseStaging',
    PUBLIC_FORECAST_API_BASE_PROD: 'forecastApiBaseProd',
    PUBLIC_AGENT_API_BASE_STAGING: 'agentApiBaseStaging',
    PUBLIC_AGENT_API_BASE_PROD: 'agentApiBaseProd',
    PUBLIC_SURVEY_URL_STAGING: 'surveyUrlStaging',
    PUBLIC_SURVEY_URL_PROD: 'surveyUrlProd',
    PUBLIC_FINANCE_API_RESOURCE: 'financeApiResource',
    PUBLIC_SIGN_IN_REDIRECT_URI: 'signInRedirectUri',
    PUBLIC_LEGACY_FLASK_BASE: 'legacyFlaskBase',
    PUBLIC_FASTAPI_DOCS_URL: 'fastApiDocsUrl',
    PUBLIC_FEATURE_RECEIPT_SCANNER: 'featureReceiptScanner',
    PUBLIC_OCR_SCANNER_API_URL: 'ocrScannerApiUrl',
    PUBLIC_OCR_SCANNER_API_URL_PROD: 'ocrScannerApiUrlProd',
    PUBLIC_OCR_SCANNER_API_RESOURCE: 'ocrScannerApiResource',
    PUBLIC_STRIPE_PUBLISHABLE_KEY: 'stripePublishableKey',
    PUBLIC_REQUIRE_BILLING_PAYWALL: 'requireBillingPaywall'
};

const ENV_KEYS = Object.keys(PUBLIC_TO_ENV);

function parseEnvPublic() {
    const p = join(root, 'env.public');
    if (!existsSync(p)) return {};
    const text = readFileSync(p, 'utf8');
    const out = {};
    for (const line of text.split('\n')) {
        const t = line.trim();
        if (!t || t.startsWith('#')) continue;
        const eq = t.indexOf('=');
        if (eq === -1) continue;
        const key = t.slice(0, eq).trim();
        let val = t.slice(eq + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
        }
        if (PUBLIC_TO_ENV[key]) {
            out[key] = val;
        }
    }
    return out;
}

function collectOverrides() {
    const merged = {};
    const fromFile = parseEnvPublic();
    for (const k of ENV_KEYS) {
        const v = process.env[k] ?? fromFile[k];
        if (v != null && String(v).trim() !== '') {
            merged[PUBLIC_TO_ENV[k]] = String(v).trim();
        }
    }
    return merged;
}

const merged = { ...DEFAULT_PUBLIC_ENV, ...collectOverrides() };
const json = JSON.stringify(merged);

const banner = '/** Auto-generated by npm run build:env — do not edit by hand */\n';

const body =
    banner +
    '(function (w) {\n' +
    "  'use strict';\n" +
    '  w.__MINTRAIQ_ENV__ = ' +
    json +
    ';\n' +
    "})(typeof window !== 'undefined' ? window : this);\n";

mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(outFile, body, 'utf8');
console.log('Wrote', outFile, `(${Object.keys(merged).length} keys)`);
