/**
 * Admin-only Config & Secrets registry page (portal/admin-config.html).
 *
 * Security model (defence in depth):
 *   1. portal-page-boot.js -> guardSession() enforces an authenticated session.
 *   2. GET /v1/admin/access — MintrAdminAgent role gate (nav + page). Non-admins
 *      see "access denied".
 *   3. Email-OTP step-up: even admins must verify a one-time code emailed to
 *      their registered address before any console content is shown. A verified
 *      session yields a short-lived step-up token (sessionStorage, per env) that
 *      is required by the live inventory endpoint.
 *
 * Environment switcher: staging vs production. Each finance-api deployment only
 * knows its own environment, so the selected environment picks which API base
 * (financeApiBaseStaging / financeApiBaseProd, else financeApiBase) to query,
 * and OTP verification is performed against that environment.
 *
 * The static inventory below is a redacted reference snapshot (KEY NAMES only).
 * The "Live config" tab shows real per-environment key presence from the API.
 */
import { CONFIG } from './config.js';
import { createLogtoClient, getAccessTokenOrReauth } from './logto-client.js';
import { claimPageScript } from './page-script-guard.js';
import { MASTER_MATRIX } from './admin-config-master-matrix.js';

const NAV_ID = 'admin-config';
const STORAGE_KEY = 'mintraiq_prod_checklist_v1';
const STEPUP_KEY = 'mintraiq_admin_stepup_v1';
const TABS = [
    { id: 'master', label: 'Master matrix' },
    { id: 'live', label: 'Live config (dashboard API)' },
    { id: 'checklist', label: 'Production checklist' },
    { id: 'services', label: 'Service inventory' },
    { id: 'repos', label: 'Repos & config' },
    { id: 'security', label: 'Security risks' },
];

let activeTab = 'master';
let activeEnv = null; // resolved on first render from the current deployment
let lastAccess = null;
let verifyState = null; // { phase, emailHint, emailDelivery, message }
let lastLiveInventory = null;
let masterFilter = 'all'; // all | missing | manual | live

/* ------------------------------- data -------------------------------- */

const SERVICES = [
    { service: 'MongoDB / Atlas', repos: 'all 5 backends + internal-tools', keys: 'MONGO_URI, MONGO_DB_URL, MONGO_CLIENT_URL, MONGODB_URI, MONGO_DB_NAME, MARKETING_DB_NAME, STAGING_MONGO_URI', tone: 'neutral' },
    { service: 'GCP Cloud Run', repos: 'all 5 backends', keys: 'PORT, ENVIRONMENT, EXECUTION_MODE, {ENV}_GCP_PROJECT_ID', tone: 'neutral' },
    { service: 'GCP Secret Manager', repos: 'all 5 backends', keys: 'runtime secrets injected per repo', tone: 'neutral' },
    { service: 'GCP WIF (deploy auth)', repos: 'all 5 backends', keys: '{ENV}_WIF_PROVIDER, {ENV}_GCP_SERVICE_ACCOUNT', tone: 'neutral' },
    { service: 'Supabase Auth', repos: 'all backends + web + mobile', keys: 'SUPABASE_URL, SUPABASE_JWKS_URL, SUPABASE_JWT_AUD, SUPABASE_WEBHOOK_SECRET, (EXPO_)PUBLIC_SUPABASE_*', tone: 'warning' },
    { service: 'Logto (legacy OIDC)', repos: 'all backends + web + mobile', keys: 'LOGTO_ENDPOINT, OIDC_CLIENT_ID/SECRET, API_IDENTIFIER, JWKS_URL', tone: 'warning' },
    { service: 'Google Gemini / OpenAI-compat', repos: 'dashboard, forecasting, scanner, agent', keys: 'OPENAI_API_KEY, OPENAI_BASE_URL, OPENAI_MODEL, GOOGLE_API_KEY, GEMINI_MODEL, GOOGLE_APPLICATION_CREDENTIALS', tone: 'neutral' },
    { service: 'Groq', repos: 'dashboard, forecasting', keys: 'GROQ_API_KEY', tone: 'neutral' },
    { service: 'Google Gmail OAuth', repos: 'dashboard (backend), mobile', keys: 'GOOGLE_GMAIL_CLIENT_ID/SECRET/REDIRECT_URI, EXPO_PUBLIC_GOOGLE_GMAIL_{IOS,ANDROID,WEB}_CLIENT_ID', tone: 'warning' },
    { service: 'Microsoft / Azure OAuth (Graph)', repos: 'dashboard (backend), mobile', keys: 'MICROSOFT_CLIENT_ID/SECRET/REDIRECT_URI/TENANT, EXPO_PUBLIC_MICROSOFT_*', tone: 'warning' },
    { service: 'Azure Blob Storage', repos: 'dashboard, forecasting', keys: 'STORAGE_PROVIDER, AZURE_STORAGE_CONNECTION_STRING, AZURE_MODELS_CONTAINER', tone: 'neutral' },
    { service: 'Akahu (NZ banking)', repos: 'dashboard', keys: 'AKAHU_APP_TOKEN, AKAHU_APP_SECRET', tone: 'neutral' },
    { service: 'Stripe', repos: 'dashboard, web', keys: 'STRIPE_SECRET_KEY, STRIPE_PUBLISHABLE_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_*, *_TEST variants', tone: 'warning' },
    { service: 'RevenueCat', repos: 'dashboard, mobile', keys: 'REVENUECAT_WEBHOOK_AUTH, EXPO_PUBLIC_REVENUECAT_IOS/ANDROID_API_KEY', tone: 'neutral' },
    { service: 'Brevo (email)', repos: 'lead-agent (active), dashboard', keys: 'BREVO_API_KEY, BREVO_SENDER_EMAIL/NAME, BREVO_TEMPLATE_ID_*, BREVO_WAITLIST_ID', tone: 'neutral' },
    { service: 'Cloudflare Turnstile', repos: 'lead-agent', keys: 'CAPTCHA_SECRET_KEY, TURNSTILE_VERIFY_URL, VITE_TURNSTILE_SITE_KEY', tone: 'neutral' },
    { service: 'Firebase Hosting', repos: 'lead-agent (frontend)', keys: 'FIREBASE_HOSTING_TARGET, FIREBASE_HOSTING_SITE_ID, {ENV}_FIREBASE_SERVICE_ACCOUNT', tone: 'neutral' },
    { service: 'Grafana Cloud / Loki', repos: 'dashboard (observability)', keys: 'LOKI_URL, LOKI_USER, LOKI_API_KEY, OBS_ENVIRONMENT', tone: 'danger' },
    { service: 'Expo / EAS', repos: 'mobile', keys: 'EXPO_TOKEN, EXPO_PUBLIC_EAS_PROJECT_ID, APP_VARIANT, eas.json projectId/ascAppId', tone: 'neutral' },
    { service: 'Apple App Store Connect', repos: 'mobile', keys: 'ascAppId 6782332605 (prod) / 6782330914 (staging), bundle com.mintraiq.app', tone: 'neutral' },
    { service: 'Google Play', repos: 'mobile', keys: 'package com.mintraiq.app, track production', tone: 'neutral' },
    { service: 'Vercel', repos: 'web', keys: 'VERCEL_TOKEN, VERCEL_ORG_ID, VERCEL_PROJECT_ID, DEPLOY_TO_VERCEL', tone: 'neutral' },
    { service: 'Slack / Jira alerting', repos: 'forecasting, dashboard', keys: 'SLACK_WEBHOOK_URL, JIRA_WEBHOOK_URL, JIRA_API_TOKEN, ALERT_WEBHOOK_URL', tone: 'neutral' },
    { service: 'FRED / ABS / Stats NZ', repos: 'dashboard, forecasting', keys: 'FRED_API_KEY, ABS_API_KEY, STATS_NZ_KEY', tone: 'neutral' },
    { service: 'Field encryption', repos: 'dashboard, forecasting', keys: 'ENCRYPTION_KEY, ENCRYPTION_SALT, TOKEN_ENCRYPTION_KEY, FIELD_ENCRYPTION_ENABLED', tone: 'neutral' },
];

const REPOS = [
    {
        name: 'finance-ai-dashboard', kind: 'Python · Cloud Run API + batch job',
        files: 'config.py, config.json(.example/.bak), .env.vars, .env.secrets, dev/prod_settings.py, observability/',
        groups: [
            { label: 'Auth', vars: 'SUPABASE_URL, SUPABASE_JWT_AUD, SUPABASE_WEBHOOK_SECRET, LOGTO_ENDPOINT, OIDC_CLIENT_ID/SECRET, API_IDENTIFIER, JWKS_URL' },
            { label: 'DB', vars: 'MONGO_URI, MONGO_DB_URL, MONGO_CLIENT_URL' },
            { label: 'Connectors', vars: 'GOOGLE_GMAIL_CLIENT_ID/SECRET/REDIRECT_URI, MICROSOFT_CLIENT_ID/SECRET/REDIRECT_URI/TENANT, AKAHU_APP_TOKEN/SECRET' },
            { label: 'Billing', vars: 'STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_*, REVENUECAT_WEBHOOK_AUTH, REQUIRE_BILLING_PAYWALL' },
            { label: 'AI', vars: 'OPENAI_API_KEY, OPENAI_MODEL, GROQ_API_KEY' },
            { label: 'Storage / crypto', vars: 'AZURE_STORAGE_CONNECTION_STRING, ENCRYPTION_KEY, ENCRYPTION_SALT, TOKEN_ENCRYPTION_KEY' },
            { label: 'Email / macro / alerts', vars: 'BREVO_API_KEY, BREVO_TEMPLATE_ID_*, FRED/ABS/STATS_NZ, ALERT_WEBHOOK_URL, CRON_SECRET_KEY' },
        ],
    },
    {
        name: 'ai-forecasting', kind: 'Python · Cloud Run API + job',
        files: 'config.py, config.json.example, .env.vars, .env.secrets',
        groups: [
            { label: 'Auth', vars: 'SUPABASE_URL, SUPABASE_JWT_AUD, LOGTO_ENDPOINT, OIDC_URL, API_IDENTIFIER, JWKS_URL' },
            { label: 'DB / AI', vars: 'MONGO_URI, OPENAI_API_KEY, OPENAI_BASE_URL, GROQ_API_KEY' },
            { label: 'Macro / storage', vars: 'FRED_API_KEY, ABS_API_KEY, STATS_NZ_KEY, AZURE_STORAGE_CONNECTION_STRING' },
            { label: 'Alerts / crypto', vars: 'SLACK_WEBHOOK_URL, JIRA_*, ENCRYPTION_*, TOKEN_ENCRYPTION_KEY, FORECASTING_CRON_SECRET_KEY' },
        ],
    },
    {
        name: 'receipt-scanner', kind: 'Python · Cloud Run',
        files: 'config.py, .env.example, .env.vars, .env.secrets, keys/receipt-ocr-sa.json',
        groups: [
            { label: 'Auth / DB', vars: 'SUPABASE_URL, SUPABASE_JWT_AUD, LOGTO_ENDPOINT_URI, JWKS_URL, API_IDENTIFIER, MONGO_URI' },
            { label: 'AI / GCP', vars: 'OPENAI_API_KEY, GOOGLE_API_KEY, OPENAI_MODEL, GOOGLE_APPLICATION_CREDENTIALS' },
            { label: 'Server', vars: 'FLASK_SECRET_KEY, AI_FORECAST_URL, CORS_ALLOW_ORIGINS' },
        ],
    },
    {
        name: 'mintraiq_agent_services', kind: 'Python · FastAPI + LangGraph',
        files: 'app/core/config.py, .env.example, .env.vars, .env.secrets',
        groups: [
            { label: 'Auth / AI', vars: 'SUPABASE_URL, SUPABASE_JWT_AUD, LOGTO_ENDPOINT, API_IDENTIFIER, GOOGLE_API_KEY, GEMINI_MODEL' },
            { label: 'Service mesh', vars: 'DASHBOARD_SERVICE_URL, FORECASTING_SERVICE_URL, RECEIPT_SERVICE_URL, MONGO_URI, MONGO_DB_NAME' },
        ],
    },
    {
        name: 'mintraiq_lead_agent', kind: 'Python · FastAPI + Firebase frontend',
        files: 'app/config.py, .env.example, frontend/.env.example, docs/specs/09-*',
        groups: [
            { label: 'DB (DMZ)', vars: 'MONGODB_URI, MARKETING_DB_NAME (mintraiq_marketing_db)' },
            { label: 'Anti-abuse', vars: 'CAPTCHA_SECRET_KEY, TURNSTILE_VERIFY_URL, RATE_LIMIT, CORS_ORIGINS' },
            { label: 'Email', vars: 'BREVO_API_KEY, BREVO_WAITLIST_ID, BREVO_SENDER_*, APP_STORE_LINK, GOOGLE_PLAY_LINK' },
            { label: 'Frontend', vars: 'VITE_TURNSTILE_SITE_KEY, VITE_NEXT_PUBLIC_API_URL, FIREBASE_HOSTING_SITE_ID' },
        ],
    },
    {
        name: 'mintraiq-web', kind: 'React embed + portal · Vercel',
        files: '.env.vars, env.public.example, portal/js/config.js, vercel.json',
        groups: [
            { label: 'Runtime (PUBLIC_*)', vars: 'PUBLIC_SUPABASE_URL/ANON_KEY (missing in CD), PUBLIC_LOGTO_*, PUBLIC_FINANCE_API_BASE/RESOURCE, PUBLIC_STRIPE_PUBLISHABLE_KEY' },
            { label: 'Deploy', vars: 'VERCEL_TOKEN, VERCEL_ORG_ID, VERCEL_PROJECT_ID, DEPLOY_TO_VERCEL' },
        ],
    },
    {
        name: 'finance-ai-mobile', kind: 'Expo React Native · EAS',
        files: 'app.json, app.config.js, eas.json, .env.production.vars.example',
        groups: [
            { label: 'Core (EXPO_PUBLIC_*)', vars: 'FINANCE_API_URL, FORECAST_API_URL, SCANNER_API_URL, CHAT_API_URL, SUPABASE_URL/ANON_KEY (missing in CD)' },
            { label: 'OAuth / billing', vars: 'GOOGLE_GMAIL_{IOS,ANDROID,WEB}_CLIENT_ID, MICROSOFT_CLIENT_ID/TENANT, REVENUECAT_IOS/ANDROID_API_KEY' },
            { label: 'EAS / stores', vars: 'EXPO_TOKEN, EAS projectId 1bbe8b26…, ascAppId 6782332605, com.mintraiq.app' },
        ],
    },
    {
        name: 'mintraiq-internal-tools', kind: 'Python CLI (mock data)',
        files: 'scripts/mock-data-generator/.env.example',
        groups: [{ label: 'DB', vars: 'STAGING_MONGO_URI, MONGO_DB_NAME' }],
    },
];

const RISKS = [
    { severity: 'CRITICAL', location: 'finance-ai-dashboard/config.json.bak', kind: 'Live Atlas URI, Logto secret, Akahu, OpenAI/Groq/Gemini, Azure key, encryption keys, cron secret', tone: 'danger' },
    { severity: 'CRITICAL', location: 'finance-ai-dashboard/app/appconfigs/prod_settings.py', kind: 'Hardcoded Atlas URI + FLASK_SECRET_KEY (deprecated file)', tone: 'danger' },
    { severity: 'HIGH', location: 'receipt-scanner/keys/receipt-ocr-sa.json', kind: 'Full GCP service account private key committed', tone: 'danger' },
    { severity: 'HIGH', location: 'receipt-scanner/google_check.py:5', kind: 'Hardcoded Google API key (AIza…)', tone: 'danger' },
    { severity: 'HIGH', location: 'finance-ai-dashboard/observability/env.example:8', kind: 'Real Grafana LOKI_API_KEY (glc_…) in example file', tone: 'danger' },
    { severity: 'MEDIUM', location: 'finance-ai-dashboard/app/appconfigs/dev_settings.py', kind: 'Local Mongo creds + FLASK_SECRET_KEY', tone: 'warning' },
    { severity: 'MEDIUM', location: 'mintraiq-web/portal/js/config.js:25-26', kind: 'Committed Supabase URL + anon key (couples all clones to one tenant)', tone: 'warning' },
    { severity: 'MEDIUM', location: 'mintraiq-web/.cursor/debug-6f70b8.log', kind: 'Debug log with Logto endpoint / JWT iss/aud', tone: 'warning' },
    { severity: 'LOW', location: 'finance-ai-dashboard/tests/e2e + tests/ui', kind: 'Test password committed in E2E scripts', tone: 'neutral' },
    { severity: 'LOW', location: 'finance-ai-mobile/app/(tabs)/upload.tsx:129', kind: "Akahu placeholder 'YOUR_AKAHU_APP_ID' + LAN IP chat fallback", tone: 'neutral' },
];

const CHECKLIST = [
    {
        id: 'sec', title: '1 · Security remediation (do first)', accent: true,
        items: [
            { id: 'sec-rotate-bak', label: 'Rotate every credential in config.json.bak (Atlas, Logto, Akahu, OpenAI/Groq/Gemini, Azure, encryption, cron)' },
            { id: 'sec-rm-bak', label: 'Delete config.json.bak, prod_settings.py, dev_settings.py; confirm .gitignore covers .env*, config.json, keys/' },
            { id: 'sec-sa-key', label: 'Rotate & remove receipt-ocr-sa.json; move OCR auth to WIF / Secret Manager' },
            { id: 'sec-google-check', label: 'Rotate hardcoded Google API key in google_check.py and remove the key' },
            { id: 'sec-loki', label: 'Rotate exposed Grafana LOKI_API_KEY and scrub observability/env.example' },
            { id: 'sec-weblog', label: 'Remove mintraiq-web/.cursor/debug-6f70b8.log from git history' },
            { id: 'sec-testpw', label: 'Move committed E2E test password to env / secret' },
        ],
    },
    {
        id: 'gcp', title: '2 · GCP (Cloud Run · Secret Manager · WIF)',
        items: [
            { id: 'gcp-wif', label: 'All 5 services deploy via WIF — no SA JSON keys in repos or CI' },
            { id: 'gcp-sm', label: 'Populate GCP Secret Manager per repo (MONGO_URI, OIDC_*, STRIPE_*, GROQ, OPENAI, GOOGLE_API_KEY, AZURE, FRED/ABS/STATS_NZ, ENCRYPTION_*)' },
            { id: 'gcp-port', label: 'Confirm PORT is NOT in env_vars (Cloud Run rule) — passed via deploy flag' },
            { id: 'gcp-mininst', label: 'Set MIN_INSTANCES for prod latency; region australia-southeast1 consistent' },
            { id: 'gcp-envsecrets', label: 'Per environment: {ENV}_WIF_PROVIDER, {ENV}_GCP_SERVICE_ACCOUNT, {ENV}_GCP_PROJECT_ID set' },
            { id: 'gcp-vpc', label: 'lead-agent VPC connector configured for Atlas peering ({ENV}_SERVERLESS_VPC_CONNECTOR)' },
        ],
    },
    {
        id: 'supabase', title: '3 · Supabase (auth migration)',
        items: [
            { id: 'sb-web', label: 'Add PUBLIC_SUPABASE_URL / PUBLIC_SUPABASE_ANON_KEY to mintraiq-web CD + .env.vars' },
            { id: 'sb-mobile', label: 'Add EXPO_PUBLIC_SUPABASE_URL / _ANON_KEY to mobile CD + EAS environment' },
            { id: 'sb-backend', label: 'Set SUPABASE_URL / JWT_AUD / JWKS_URL on all 5 backends (prod project)' },
            { id: 'sb-webhook', label: 'Configure SUPABASE_WEBHOOK_SECRET; fix duplicate mapping in dashboard cd.yml (lines 121/129)' },
            { id: 'sb-defaults', label: 'Remove committed Supabase defaults from portal/js/config.js' },
            { id: 'sb-oauth', label: 'Configure Supabase OAuth providers (Google, Apple) for prod redirect URLs' },
        ],
    },
    {
        id: 'logto', title: '4 · Logto (legacy decommission)',
        items: [
            { id: 'logto-decide', label: 'Decide keep-as-fallback vs remove; if removing, strip LOGTO_*/OIDC_* from code, CD, and Secret Manager across all repos' },
            { id: 'logto-mobile', label: 'Remove dead Logto EXPO_PUBLIC_CLIENT_ID / ENDPOINT from mobile CD + docs' },
        ],
    },
    {
        id: 'expo', title: '5 · Expo / EAS · App Store · Google Play',
        items: [
            { id: 'expo-token', label: 'EXPO_TOKEN set in GitHub; EAS projectId 1bbe8b26… confirmed' },
            { id: 'expo-push', label: 'APNs + FCM push credentials uploaded to EAS; EXPO_PUBLIC_EAS_PROJECT_ID set' },
            { id: 'expo-dist', label: 'Resolve eas.json distribution drift (store vs internal) vs ENVIRONMENT.md for staging' },
            { id: 'expo-unused', label: 'Remove unused EXPO_PUBLIC_API_URL / EXPO_PUBLIC_ENV_NAME from eas.json' },
            { id: 'asc', label: 'App Store Connect app (ascAppId 6782332605) + privacy nutrition labels (NZ Privacy Act 2020)' },
            { id: 'play', label: 'Google Play console app (com.mintraiq.app) + Data Safety form + production track' },
            { id: 'legal', label: 'EXPO_PUBLIC_TERMS_URL / EXPO_PUBLIC_PRIVACY_URL point to live pages' },
        ],
    },
    {
        id: 'oauth', title: '6 · Google & Microsoft/Azure OAuth (email connectors)',
        items: [
            { id: 'g-backend', label: 'GOOGLE_GMAIL_CLIENT_ID/SECRET/REDIRECT_URI set on dashboard (prod redirect URIs registered)' },
            { id: 'g-mobile', label: 'Add EXPO_PUBLIC_GOOGLE_GMAIL_{IOS,ANDROID,WEB}_CLIENT_ID to mobile CD/EAS' },
            { id: 'g-verify', label: 'Google OAuth consent screen verified/published for sensitive scope gmail.readonly' },
            { id: 'ms-backend', label: 'Add MICROSOFT_CLIENT_ID/SECRET/REDIRECT_URI/TENANT to dashboard CD (currently missing)' },
            { id: 'ms-mobile', label: 'Add EXPO_PUBLIC_MICROSOFT_CLIENT_ID / _TENANT to mobile CD/EAS' },
            { id: 'ms-consent', label: 'Azure app registration + Mail.Read admin consent granted' },
        ],
    },
    {
        id: 'azure', title: '7 · Azure Blob Storage',
        items: [
            { id: 'az-conn', label: 'AZURE_STORAGE_CONNECTION_STRING in Secret Manager (dashboard + forecasting)' },
            { id: 'az-container', label: 'AZURE_MODELS_CONTAINER exists; STORAGE_PROVIDER=azure in prod' },
        ],
    },
    {
        id: 'billing', title: '8 · Stripe & RevenueCat (billing)',
        items: [
            { id: 'stripe-live', label: 'Swap to LIVE Stripe keys (SECRET/PUBLISHABLE/WEBHOOK_SECRET); remove *_TEST fallbacks in finance_api.py' },
            { id: 'stripe-price', label: 'STRIPE_PRICE_BASIC / _ADVANCED point to live price IDs' },
            { id: 'stripe-hook', label: 'Stripe webhook endpoint registered for prod PORTAL_BASE_URL' },
            { id: 'rc-keys', label: 'RevenueCat iOS/Android API keys set (EXPO_PUBLIC_REVENUECAT_*) + REVENUECAT_WEBHOOK_AUTH live' },
            { id: 'paywall', label: 'REQUIRE_BILLING_PAYWALL consistent across dashboard / web / mobile' },
        ],
    },
    {
        id: 'brevo', title: '9 · Brevo (transactional & waitlist email)',
        items: [
            { id: 'brevo-key', label: 'BREVO_API_KEY in Secret Manager (lead-agent + dashboard — also powers admin OTP)' },
            { id: 'brevo-domain', label: 'BREVO_SENDER_EMAIL on verified domain with SPF/DKIM configured' },
            { id: 'brevo-templates', label: 'BREVO_TEMPLATE_ID_* created (dashboard) and BREVO_WAITLIST_ID set (lead)' },
            { id: 'brevo-links', label: 'APP_STORE_LINK / GOOGLE_PLAY_LINK in welcome email point to live listings' },
        ],
    },
    {
        id: 'cf-fb', title: '10 · Cloudflare & Firebase',
        items: [
            { id: 'cf-turnstile', label: 'Production Turnstile keys: VITE_TURNSTILE_SITE_KEY + CAPTCHA_SECRET_KEY (not test keys)' },
            { id: 'fb-hosting', label: 'Firebase Hosting configured: FIREBASE_HOSTING_TARGET/SITE_ID + {ENV}_FIREBASE_SERVICE_ACCOUNT' },
        ],
    },
    {
        id: 'data-obs', title: '11 · Data stores, observability & hardening',
        items: [
            { id: 'atlas-prod', label: 'Prod Atlas cluster: IP allowlist / VPC peering, backups, mintraiq_marketing_db isolated' },
            { id: 'grafana', label: 'Grafana/Loki prod endpoint + log shipping from Cloud Run (rotated LOKI_API_KEY)' },
            { id: 'alerts', label: 'ALERT_WEBHOOK_URL / SLACK_WEBHOOK_URL / JIRA_* wired for critical alerts' },
            { id: 'macro', label: 'FRED_API_KEY / ABS_API_KEY / STATS_NZ_KEY in Secret Manager' },
            { id: 'crypto', label: 'Prod-unique ENCRYPTION_KEY / SALT / TOKEN_ENCRYPTION_KEY; FIELD_ENCRYPTION_ENABLED=true' },
            { id: 'cors', label: 'CORS_ALLOW_ORIGINS restricted to prod domains (no *); rate limiting live on lead-agent public endpoints' },
            { id: 'cron', label: 'CRON_SECRET_KEY set for dashboard + forecasting batch jobs' },
        ],
    },
];

const TOTAL_ITEMS = CHECKLIST.reduce((n, g) => n + g.items.length, 0);
const MASTER_TOTAL = MASTER_MATRIX.length;

/* ----------------------------- helpers ------------------------------- */

function escapeHtml(s) {
    return String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function loadChecklistState() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch {
        return {};
    }
}

function saveChecklistState(state) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
        /* storage may be unavailable; UI still works in-memory */
    }
}

function normalizeEnv(raw) {
    const v = String(raw || '').trim().toLowerCase();
    if (v === 'prod' || v === 'production') return 'production';
    if (v === 'staging' || v === 'stage') return 'staging';
    if (v === 'dev' || v === 'development' || v === 'local') return 'staging';
    return v || 'staging';
}

function apiBaseFor(env) {
    const raw = env === 'production' ? CONFIG.financeApiBaseProd : env === 'staging' ? CONFIG.financeApiBaseStaging : '';
    const chosen = raw && String(raw).trim() ? String(raw).trim() : CONFIG.financeApiBase;
    return String(chosen || '').replace(/\/$/, '');
}

/* --- step-up token store (sessionStorage, per env) --- */

function readStepUpMap() {
    try {
        const raw = sessionStorage.getItem(STEPUP_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch {
        return {};
    }
}

function getStepUp(env) {
    const map = readStepUpMap();
    const entry = map[env];
    if (entry && typeof entry.exp === 'number' && entry.exp > Date.now() + 5000 && entry.token) {
        return entry;
    }
    return null;
}

function setStepUp(env, token, expiresInSeconds) {
    const map = readStepUpMap();
    map[env] = { token, exp: Date.now() + (Number(expiresInSeconds) || 0) * 1000 };
    try {
        sessionStorage.setItem(STEPUP_KEY, JSON.stringify(map));
    } catch {
        /* ignore */
    }
}

function clearStepUp(env) {
    const map = readStepUpMap();
    delete map[env];
    try {
        sessionStorage.setItem(STEPUP_KEY, JSON.stringify(map));
    } catch {
        /* ignore */
    }
}

/* --- authenticated fetch --- */

async function authHeaders(extra) {
    const client = createLogtoClient();
    const token = await getAccessTokenOrReauth(client, CONFIG.financeApiResource);
    return {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(extra || {}),
    };
}

async function apiRequest(base, path, { method = 'GET', body, headers } = {}) {
    const init = { method, headers: await authHeaders(headers) };
    if (body !== undefined) init.body = JSON.stringify(body);
    const res = await fetch(`${base}${path}`, init);
    if (!res.ok) {
        let detail = '';
        try {
            const data = await res.json();
            detail = data.detail || data.message || '';
        } catch {
            detail = await res.text().catch(() => '');
        }
        const err = new Error(detail || `Request failed (${res.status})`);
        err.status = res.status;
        throw err;
    }
    return res.json();
}

async function fetchAccess(base) {
    try {
        return await apiRequest(base, '/v1/admin/access');
    } catch {
        return { allowed: false, required_roles: [] };
    }
}

/* ------------------------------ views -------------------------------- */

function envLabel(env) {
    return env === 'production' ? 'Production' : 'Staging';
}

function renderToolbar(access, verified) {
    const env = activeEnv || 'staging';
    const hint = access && access.email_hint ? ` · code sent to <strong>${escapeHtml(access.email_hint)}</strong>` : '';
    return `
        <div class="ac-toolbar">
            <div class="ac-env">
                <label for="acEnvSelect">Environment</label>
                <select id="acEnvSelect" data-ac-env>
                    <option value="staging" ${env === 'staging' ? 'selected' : ''}>Staging</option>
                    <option value="production" ${env === 'production' ? 'selected' : ''}>Production</option>
                </select>
            </div>
            <span class="ac-env-note">Live config reflects the ${escapeHtml(envLabel(env))} API${verified ? hint : ''}.</span>
            <span class="ac-spacer"></span>
            ${verified
                ? '<span class="ac-verified"><i class="fas fa-lock-open"></i> Verified</span><button type="button" class="ac-lock" data-ac-lock>Lock console</button>'
                : ''}
        </div>`;
}

function renderVerifyInner() {
    const st = verifyState || { phase: 'idle' };
    const hintLine = st.emailHint
        ? `<p class="ac-muted">A one-time code will be sent to <strong>${escapeHtml(st.emailHint)}</strong>.</p>`
        : '<p class="ac-muted">A one-time code will be sent to your registered admin email.</p>';

    const emailWarn = st.emailDelivery === false
        ? '<div class="ac-callout is-warning"><strong>Email delivery not configured</strong>Set BREVO_API_KEY for this environment. In local dev the code is written to the server logs.</div>'
        : '';

    const errorLine = st.message
        ? `<p class="ac-otp-error">${escapeHtml(st.message)}</p>`
        : '';

    if (st.phase === 'sent' || st.phase === 'verifying') {
        const busy = st.phase === 'verifying';
        const sentLine = st.deliveryMode === 'log_only'
            ? `<div class="ac-callout is-warning"><strong>No email was sent</strong>Brevo is not configured for this API (<code>BREVO_API_KEY</code>). The OTP was written to the finance-api server log — search for <code>ADMIN OTP (dev</code>.</div>`
            : `<p class="ac-muted">We emailed a 6-digit code to <strong>${escapeHtml(st.emailHint || 'your admin email')}</strong>. It expires shortly.</p>`;
        return `
            <div class="ac-verify-card">
                <div class="ac-verify-icon"><i class="fas fa-shield-halved"></i></div>
                <h3>Enter your verification code</h3>
                ${sentLine}
                ${errorLine}
                <div class="ac-otp-row">
                    <input type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6"
                        class="ac-otp-input" data-ac-otp-input placeholder="000000" ${busy ? 'disabled' : ''} />
                    <button type="button" class="ac-btn ac-btn-primary" data-ac-verify-otp ${busy ? 'disabled' : ''}>
                        ${busy ? 'Verifying…' : 'Verify & unlock'}
                    </button>
                </div>
                <button type="button" class="ac-btn ac-btn-ghost" data-ac-resend ${busy ? 'disabled' : ''}>Resend code</button>
            </div>`;
    }

    const sending = st.phase === 'sending';
    return `
        <div class="ac-verify-card">
            <div class="ac-verify-icon"><i class="fas fa-shield-halved"></i></div>
            <h3>Verify it's you</h3>
            <p class="ac-muted">This console holds sensitive configuration. Confirm your identity with an emailed one-time code to continue (${escapeHtml(envLabel(activeEnv || 'staging'))}).</p>
            ${hintLine}
            ${emailWarn}
            ${errorLine}
            <button type="button" class="ac-btn ac-btn-primary" data-ac-send-otp ${sending ? 'disabled' : ''}>
                ${sending ? 'Sending…' : 'Email me a code'}
            </button>
        </div>`;
}

function liveInventoryMap(data) {
    const map = Object.create(null);
    if (!data || !Array.isArray(data.variables)) return map;
    for (const v of data.variables) {
        if (v && v.name) map[v.name] = v;
    }
    return map;
}

function normSecretKey(name) {
    return String(name || '').toUpperCase().replace(/[^A-Z0-9]/g, '_');
}

const GCP_SECRET_ALIASES = {
    SUPABASE_WEBHOOK_SECRET: ['supabase-webhook-secret', 'SUPABASE_WEBHOOK_SECRET'],
    LOGTO_ENDPOINT: ['OIDC_URL', 'LOGTO_ENDPOINT'],
    LOGTO_CLIENT_ID: ['OIDC_CLIENT_ID', 'LOGTO_CLIENT_ID'],
    LOGTO_CLIENT_SECRET: ['OIDC_CLIENT_SECRET', 'LOGTO_CLIENT_SECRET'],
    LOGTO_ISSUER_URL: ['OIDC_ISSUER_URL', 'LOGTO_ISSUER_URL'],
    MONGO_URI: ['MONGO_URI', 'MONGO_DB_URL'],
};

function gcpSecretPopulated(matrixName, secretIds) {
    const normalized = new Set((secretIds || []).map(normSecretKey));
    const candidates = [normSecretKey(matrixName)];
    for (const alias of GCP_SECRET_ALIASES[matrixName] || []) {
        candidates.push(normSecretKey(alias));
    }
    return candidates.some((c) => normalized.has(c));
}

function githubNameCandidates(matrixName, ghEnv) {
    const names = [matrixName];
    const prefixed = `${ghEnv}_${matrixName}`;
    if (!names.includes(prefixed)) names.push(prefixed);
    return names;
}

/** @returns {{ source: string, populated: boolean|null, detail: string }} */
function resolveMatrixStatus(row, data) {
    const sources = (data && data.platform_sources) || {};
    const liveMap = liveInventoryMap(data);
    const platform = String(row.platform || '').toLowerCase();
    const dashPop = row.live === 'dashboard' ? Boolean(liveMap[row.name]?.populated) : null;

    if (platform.includes('cloud run env') || platform.startsWith('cloud run')) {
        if (dashPop !== null) {
            return { source: 'dashboard', populated: dashPop, detail: 'Loaded on finance-ai-dashboard Cloud Run' };
        }
        return { source: 'manual', populated: null, detail: 'Verify Cloud Run env' };
    }

    if (platform.includes('gcp secret manager')) {
        const gcp = sources.gcp_secret_manager || {};
        if (!gcp.enabled) {
            return { source: 'gcp', populated: null, detail: gcp.error || 'GCP Secret Manager unavailable' };
        }
        const ok = gcpSecretPopulated(row.name, gcp.secret_ids);
        return { source: 'gcp', populated: ok, detail: `project ${gcp.project_id || ''}` };
    }

    if (platform.includes('github variables')) {
        const gh = sources.github || {};
        if (!gh.enabled) {
            return { source: 'github', populated: null, detail: gh.error || 'GitHub not configured' };
        }
        const ghEnv = gh.environment || 'STAGING';
        for (const candidate of githubNameCandidates(row.name, ghEnv)) {
            const hit = (gh.variables || {})[candidate];
            if (hit) {
                return { source: 'github', populated: true, detail: `${ghEnv} · ${(hit.repos || []).join(', ')}` };
            }
        }
        return { source: 'github', populated: false, detail: `${ghEnv} · not in scanned repos` };
    }

    if (platform.includes('github secrets')) {
        const gh = sources.github || {};
        if (!gh.enabled) {
            return { source: 'github', populated: null, detail: gh.error || 'GitHub not configured' };
        }
        const ghEnv = gh.environment || 'STAGING';
        for (const candidate of githubNameCandidates(row.name, ghEnv)) {
            const hit = (gh.secrets || {})[candidate];
            if (hit) {
                return { source: 'github', populated: true, detail: `${ghEnv} · ${(hit.repos || []).join(', ')}` };
            }
        }
        return { source: 'github', populated: false, detail: `${ghEnv} · not in scanned repos` };
    }

    if (dashPop !== null) {
        return { source: 'dashboard', populated: dashPop, detail: 'finance-ai-dashboard loaded config' };
    }

    return { source: 'manual', populated: null, detail: 'Verify manually' };
}

function matrixStatusCell(status) {
    if (status.populated === true) {
        return `<span class="ac-status-ok" title="${escapeHtml(status.detail)}"><span class="ac-dot is-success"></span>configured</span>`;
    }
    if (status.populated === false) {
        return `<span class="ac-status-miss" title="${escapeHtml(status.detail)}"><span class="ac-dot is-danger"></span>missing</span>`;
    }
    return `<span class="ac-status-manual" title="${escapeHtml(status.detail)}"><span class="ac-dot is-warning"></span>verify manually</span>`;
}

function renderStats(done) {
    const pct = Math.round((done / TOTAL_ITEMS) * 100);
    const readyTone = pct === 100 ? 'is-success' : pct >= 50 ? 'is-warning' : 'is-danger';
    const liveMap = liveInventoryMap(lastLiveInventory);
    const liveTracked = MASTER_MATRIX.filter((r) => r.live === 'dashboard').length;
    const liveMissing = MASTER_MATRIX.filter((r) => {
        if (r.live !== 'dashboard') return false;
        const hit = liveMap[r.name];
        return !hit || !hit.populated;
    }).length;
    const stat = (value, label, cls = '') =>
        `<div class="ac-stat"><div class="ac-stat-value ${cls}">${value}</div><div class="ac-stat-label">${label}</div></div>`;
    return `
        <div class="ac-stats">
            ${stat(String(MASTER_TOTAL), 'Master vars (Bible §20)')}
            ${stat(String(liveTracked), 'Live-tracked (dashboard)')}
            ${stat(String(liveMissing), 'Dashboard missing', liveMissing ? 'is-danger' : 'is-success')}
            ${stat(String(TOTAL_ITEMS), 'Checklist items')}
            ${stat(`${pct}%`, 'Checklist ready', readyTone)}
        </div>`;
}

function renderTabs() {
    return `<div class="ac-tabs">${TABS.map((t) =>
        `<button type="button" class="ac-tab ${t.id === activeTab ? 'is-active' : ''}" data-ac-tab="${t.id}">${escapeHtml(t.label)}</button>`,
    ).join('')}</div>`;
}

function renderLivePanel() {
    const ps = lastLiveInventory && lastLiveInventory.platform_sources;
    const gcp = ps && ps.gcp_secret_manager;
    const gh = ps && ps.github;
    const platformNote = gcp && gcp.enabled
        ? `GCP Secret Manager: <strong>${escapeHtml(gcp.project_id || '')}</strong> (${(gcp.secret_ids || []).length} secrets). `
        : `GCP: ${escapeHtml((gcp && gcp.error) || 'unavailable')}. `;
    const ghNote = gh && gh.enabled
        ? `GitHub <strong>${escapeHtml(gh.environment || '')}</strong> env on ${(gh.repos_scanned || []).length} repos.`
        : `GitHub: ${escapeHtml((gh && gh.error) || 'not configured')}.`;
    return `
        <div class="ac-panel" data-ac-panel="live" ${activeTab === 'live' ? '' : 'hidden'}>
            <div class="ac-callout">
                <strong>Live configuration — ${escapeHtml(envLabel(activeEnv || 'staging'))}</strong>
                Loaded keys for <strong>finance-ai-dashboard</strong> on this Cloud Run deployment.
                ${platformNote}${ghNote}
                Master matrix merges dashboard + GCP + GitHub for Bible §20 rows.
            </div>
            <div data-live-body><div class="ac-loading"><i class="fas fa-spinner fa-spin"></i> Loading live config…</div></div>
        </div>`;
}

function renderMasterPanel() {
    const rows = MASTER_MATRIX.filter((row) => {
        const status = resolveMatrixStatus(row, lastLiveInventory);
        const isMissing = status.populated === false;
        if (masterFilter === 'missing') return isMissing;
        if (masterFilter === 'manual') return status.populated === null;
        if (masterFilter === 'live') return status.populated !== null;
        return true;
    });

    const liveMissingCount = MASTER_MATRIX.filter((r) => resolveMatrixStatus(r, lastLiveInventory).populated === false).length;
    const manualCount = MASTER_MATRIX.filter((r) => resolveMatrixStatus(r, lastLiveInventory).populated === null).length;
    const liveTrackedCount = MASTER_TOTAL - manualCount;

    const tableRows = rows.map((row) => {
        const status = resolveMatrixStatus(row, lastLiveInventory);
        const sourceTag = status.source === 'manual'
            ? ''
            : `<span class="ac-tag ac-tag--muted">${escapeHtml(status.source)}</span>`;
        return `
        <tr data-ac-master-row="${escapeHtml(row.name)}">
            <td><span class="ac-code">${escapeHtml(row.name)}</span></td>
            <td class="ac-muted">${escapeHtml(row.section)}</td>
            <td class="ac-muted">${escapeHtml(row.repos)}</td>
            <td>${escapeHtml(row.platform)}</td>
            <td>${row.secret ? '<span class="ac-tag">secret</span>' : '<span class="ac-tag">public</span>'}</td>
            <td>${matrixStatusCell(status)} ${sourceTag}</td>
        </tr>`;
    }).join('');

    return `
        <div class="ac-panel" data-ac-panel="master" ${activeTab === 'master' ? '' : 'hidden'}>
            <div class="ac-callout">
                <strong>Production Bible master list (§20)</strong>
                Live status from the selected environment's API: finance-ai-dashboard loaded config,
                GCP Secret Manager (<code>mintraiq-staging</code> / <code>mintraiq-production</code>),
                and GitHub Environment vars/secrets (names only for secrets).
                Vercel, EAS, Supabase, and Atlas rows still require manual verification.
            </div>
            <div class="ac-master-toolbar">
                <label for="acMasterFilter">Filter</label>
                <select id="acMasterFilter" data-ac-master-filter>
                    <option value="all" ${masterFilter === 'all' ? 'selected' : ''}>All (${MASTER_TOTAL})</option>
                    <option value="missing" ${masterFilter === 'missing' ? 'selected' : ''}>Missing / not found (${liveMissingCount})</option>
                    <option value="live" ${masterFilter === 'live' ? 'selected' : ''}>Auto-tracked (${liveTrackedCount})</option>
                    <option value="manual" ${masterFilter === 'manual' ? 'selected' : ''}>Manual only (${manualCount})</option>
                </select>
            </div>
            <div class="ac-stats" style="grid-template-columns:repeat(3,minmax(0,1fr));margin-bottom:14px">
                <div class="ac-stat"><div class="ac-stat-value">${MASTER_TOTAL}</div><div class="ac-stat-label">Total vars</div></div>
                <div class="ac-stat"><div class="ac-stat-value is-danger">${liveMissingCount}</div><div class="ac-stat-label">Missing (live)</div></div>
                <div class="ac-stat"><div class="ac-stat-value is-warning">${manualCount}</div><div class="ac-stat-label">Manual verification</div></div>
            </div>
            <table class="ac-table ac-table--master">
                <thead><tr><th>Variable</th><th>Section</th><th>Repos</th><th>Set at (platform)</th><th>Type</th><th>Status</th></tr></thead>
                <tbody>${tableRows || '<tr><td colspan="6" class="ac-muted">No rows match this filter.</td></tr>'}</tbody>
            </table>
        </div>`;
}

function renderInventory(data) {
    const summary = data.summary || {};
    const vars = Array.isArray(data.variables) ? data.variables : [];
    const stat = (value, label, cls = '') =>
        `<div class="ac-stat"><div class="ac-stat-value ${cls}">${value}</div><div class="ac-stat-label">${label}</div></div>`;
    const rows = vars.map((v) => {
        const name = String(v.name || '');
        const canReveal = Boolean(v.populated);
        return `
        <tr data-ac-row="${escapeHtml(name)}">
            <td><span class="ac-code">${escapeHtml(name)}</span></td>
            <td>${v.secret ? '<span class="ac-tag">secret</span>' : '<span class="ac-tag">public</span>'}</td>
            <td>${v.populated
                ? '<span class="ac-status-ok"><span class="ac-dot is-success"></span>configured</span>'
                : '<span class="ac-status-miss"><span class="ac-dot is-danger"></span>missing</span>'}</td>
            <td class="ac-value-cell">
                <span class="ac-value-mask" data-ac-value-mask="${escapeHtml(name)}">${v.secret ? '••••••••' : '—'}</span>
                <code class="ac-value-plain" data-ac-value-plain="${escapeHtml(name)}" hidden></code>
            </td>
            <td class="ac-actions-cell">
                ${canReveal
                    ? `<button type="button" class="ac-btn ac-btn-ghost ac-reveal-btn" data-ac-reveal="${escapeHtml(name)}" title="Reveal value">Reveal</button>`
                    : '<span class="ac-muted">—</span>'}
            </td>
        </tr>`;
    }).join('');
    return `
        <div class="ac-stats" style="grid-template-columns:repeat(3,minmax(0,1fr))">
            ${stat(String(summary.total ?? vars.length), 'Tracked keys')}
            ${stat(String(summary.configured ?? 0), 'Configured', 'is-success')}
            ${stat(String(summary.missing ?? 0), 'Missing', (summary.missing ? 'is-danger' : 'is-success'))}
        </div>
        <div class="ac-live-actions">
            <button type="button" class="ac-btn ac-btn-ghost" data-ac-reveal-all>Reveal all</button>
            <button type="button" class="ac-btn ac-btn-ghost" data-ac-hide-all>Hide all</button>
        </div>
        <table class="ac-table">
            <thead><tr><th>Key</th><th>Type</th><th>Status</th><th>Value</th><th></th></tr></thead>
            <tbody>${rows}</tbody>
        </table>`;
}

function renderChecklistPanel(state) {
    const done = CHECKLIST.reduce((n, g) => n + g.items.filter((i) => state[i.id]).length, 0);
    const pct = Math.round((done / TOTAL_ITEMS) * 100);

    const groups = CHECKLIST.map((group) => {
        const gDone = group.items.filter((i) => state[i.id]).length;
        const rows = group.items.map((item) => {
            const on = Boolean(state[item.id]);
            return `
                <label class="ac-check ${on ? 'is-done' : ''}">
                    <input type="checkbox" data-ac-check="${item.id}" ${on ? 'checked' : ''} />
                    <span class="ac-check-label">${escapeHtml(item.label)}</span>
                </label>`;
        }).join('');
        return `
            <div class="ac-group-block">
                <div class="ac-group-head">
                    <h4 class="ac-group-title ${group.accent && gDone < group.items.length ? 'is-accent' : ''}">${escapeHtml(group.title)}</h4>
                    <span class="ac-group-progress" data-group-progress="${group.id}">${gDone}/${group.items.length}</span>
                </div>
                ${rows}
            </div>`;
    }).join('');

    return `
        <div class="ac-panel" data-ac-panel="checklist" ${activeTab === 'checklist' ? '' : 'hidden'}>
            <div class="ac-progress-card">
                <div class="ac-progress-top">
                    <strong>Overall production readiness</strong>
                    <span class="ac-progress-count" data-total-count>${done} / ${TOTAL_ITEMS} done · ${pct}%</span>
                </div>
                <div class="ac-progress-track"><div class="ac-progress-fill" data-progress-fill style="width:${pct}%"></div></div>
                <button type="button" class="ac-reset" data-ac-reset>Reset checklist</button>
            </div>
            ${groups}
        </div>`;
}

function renderServicesPanel() {
    const rows = SERVICES.map((s) => `
        <tr>
            <td><span class="ac-dot is-${s.tone}"></span><strong>${escapeHtml(s.service)}</strong></td>
            <td class="ac-muted">${escapeHtml(s.repos)}</td>
            <td><span class="ac-code">${escapeHtml(s.keys)}</span></td>
        </tr>`).join('');
    return `
        <div class="ac-panel" data-ac-panel="services" ${activeTab === 'services' ? '' : 'hidden'}>
            <div class="ac-callout is-warning">
                <strong>Amber-dot rows need action before prod</strong>
                Supabase &amp; OAuth vars are missing from web/mobile CI; Logto is a half-migrated legacy path; Stripe still uses test-key fallbacks; the Grafana Loki key is exposed. Values are redacted — key names only.
            </div>
            <table class="ac-table">
                <thead><tr><th>Service</th><th>Used by</th><th>Key names</th></tr></thead>
                <tbody>${rows}</tbody>
            </table>
        </div>`;
}

function renderReposPanel() {
    const cards = REPOS.map((r) => {
        const groups = r.groups.map((g) => `
            <div class="ac-group">
                <div class="ac-group-label"><span class="ac-tag">${escapeHtml(g.label)}</span></div>
                <div><span class="ac-code">${escapeHtml(g.vars)}</span></div>
            </div>`).join('');
        return `
            <div class="ac-card">
                <div class="ac-card-head">
                    <h3>${escapeHtml(r.name)}</h3>
                    <span class="ac-card-kind">${escapeHtml(r.kind)}</span>
                </div>
                <div class="ac-files">Config files: <span class="ac-code">${escapeHtml(r.files)}</span></div>
                ${groups}
            </div>`;
    }).join('');
    return `<div class="ac-panel" data-ac-panel="repos" ${activeTab === 'repos' ? '' : 'hidden'}>${cards}</div>`;
}

function renderSecurityPanel() {
    const rows = RISKS.map((r) => `
        <tr>
            <td><span class="ac-sev is-${r.severity.toLowerCase()}">${escapeHtml(r.severity)}</span></td>
            <td><span class="ac-code">${escapeHtml(r.location)}</span></td>
            <td class="ac-muted">${escapeHtml(r.kind)}</td>
        </tr>`).join('');
    return `
        <div class="ac-panel" data-ac-panel="security" ${activeTab === 'security' ? '' : 'hidden'}>
            <div class="ac-callout is-danger">
                <strong>Committed / hardcoded secrets found</strong>
                Rotate everything below and purge from git history. Several are live credentials currently on disk.
            </div>
            <table class="ac-table">
                <thead><tr><th>Severity</th><th>Location</th><th>What's exposed</th></tr></thead>
                <tbody>${rows}</tbody>
            </table>
        </div>`;
}

function renderConsole(state) {
    const done = CHECKLIST.reduce((n, g) => n + g.items.filter((i) => state[i.id]).length, 0);
    return `
        ${renderStats(done)}
        ${renderTabs()}
        ${renderMasterPanel()}
        ${renderLivePanel()}
        ${renderChecklistPanel(state)}
        ${renderServicesPanel()}
        ${renderReposPanel()}
        ${renderSecurityPanel()}`;
}

function renderAccessDenied(roles) {
    const roleText = (roles && roles.length ? roles.join(', ') : 'MintrAdminAgent');
    return `
        <div class="ac-denied">
            <strong>Access denied</strong>
            <p style="margin-top:8px">
                This console is restricted to administrators. It requires the role
                <code>${escapeHtml(roleText)}</code>. Assign it to your user in the auth console
                (Roles), then sign out and back in.
            </p>
        </div>`;
}

/* --------------------------- interactions ---------------------------- */

function patchVerifyPanel() {
    const region = document.getElementById('acVerify');
    if (region) region.innerHTML = renderVerifyInner();
}

async function sendOtp() {
    verifyState = { ...(verifyState || {}), phase: 'sending', message: '' };
    patchVerifyPanel();
    try {
        const base = apiBaseFor(activeEnv);
        const data = await apiRequest(base, '/v1/admin/step-up/request', { method: 'POST', body: {} });
        verifyState = {
            phase: 'sent',
            emailHint: data.email_hint,
            deliveryMode: data.delivery_mode || 'email',
            expiresIn: data.expires_in,
            message: '',
        };
    } catch (e) {
        verifyState = {
            ...(verifyState || {}),
            phase: verifyState && verifyState.phase === 'sending' && verifyState.emailHint ? 'sent' : 'idle',
            message: e.message || 'Could not send the code. Try again.',
        };
    }
    patchVerifyPanel();
}

async function verifyOtp() {
    const input = document.querySelector('[data-ac-otp-input]');
    const code = input ? String(input.value || '').trim() : '';
    if (!/^\d{4,8}$/.test(code)) {
        verifyState = { ...(verifyState || {}), phase: 'sent', message: 'Enter the numeric code from your email.' };
        patchVerifyPanel();
        return;
    }
    verifyState = { ...(verifyState || {}), phase: 'verifying', message: '' };
    patchVerifyPanel();
    try {
        const base = apiBaseFor(activeEnv);
        const data = await apiRequest(base, '/v1/admin/step-up/verify', { method: 'POST', body: { code } });
        setStepUp(activeEnv, data.step_up_token, data.expires_in);
        verifyState = null;
        await render();
    } catch (e) {
        verifyState = { ...(verifyState || {}), phase: 'sent', message: e.message || 'Invalid or expired code.' };
        patchVerifyPanel();
    }
}

async function loadLiveInventory(base, token) {
    const panel = document.querySelector('[data-ac-panel="live"] [data-live-body]');
    if (!panel) return;
    try {
        const headers = token ? { 'X-Admin-Step-Up': token } : undefined;
        const data = await apiRequest(base, '/v1/admin/config/inventory', { headers });
        lastLiveInventory = data;
        panel.innerHTML = renderInventory(data);
        panel.dataset.liveBase = base;
        panel.dataset.liveToken = token || '';
        const masterPanel = document.querySelector('[data-ac-panel="master"]');
        if (masterPanel) {
            masterPanel.outerHTML = renderMasterPanel();
            if (activeTab === 'master') {
                const root = document.getElementById('acBody');
                if (root) switchTab(root, 'master');
            }
        }
        const statsEl = document.querySelector('[data-admin-config-root] .ac-stats');
        if (statsEl) {
            const state = loadChecklistState();
            const done = CHECKLIST.reduce((n, g) => n + g.items.filter((i) => state[i.id]).length, 0);
            statsEl.outerHTML = renderStats(done);
        }
    } catch (e) {
        if (e.status === 401) {
            clearStepUp(activeEnv);
            await render();
            return;
        }
        panel.innerHTML =
            `<div class="ac-callout is-warning"><strong>Couldn't load live config</strong>${escapeHtml(e.message || '')}. ` +
            `If you're viewing a different environment, ensure its API base is configured and its CORS_ALLOW_ORIGINS permits this portal.</div>`;
    }
}

async function revealConfigValue(name) {
    const panel = document.querySelector('[data-ac-panel="live"] [data-live-body]');
    if (!panel || !name) return;
    const base = panel.dataset.liveBase || apiBaseFor(activeEnv);
    const token = panel.dataset.liveToken || (getStepUp(activeEnv) && getStepUp(activeEnv).token) || '';
    const btn = document.querySelector(`[data-ac-reveal="${CSS.escape(name)}"]`);
    if (btn) {
        btn.disabled = true;
        btn.textContent = 'Loading…';
    }
    try {
        const headers = token ? { 'X-Admin-Step-Up': token } : undefined;
        const data = await apiRequest(
            base,
            `/v1/admin/config/value/${encodeURIComponent(name)}`,
            { headers },
        );
        const mask = document.querySelector(`[data-ac-value-mask="${CSS.escape(name)}"]`);
        const plain = document.querySelector(`[data-ac-value-plain="${CSS.escape(name)}"]`);
        if (plain) {
            const lenHint = data.masked && data.value_length ? ` · ${data.value_length} chars` : '';
            plain.textContent = `${data.value || ''}${lenHint}`;
            plain.hidden = false;
        }
        if (mask) mask.hidden = true;
        if (btn) {
            btn.textContent = 'Hide';
            btn.disabled = false;
            btn.dataset.acHide = name;
            btn.removeAttribute('data-ac-reveal');
        }
    } catch (e) {
        if (btn) {
            btn.disabled = false;
            btn.textContent = 'Reveal';
        }
        const row = document.querySelector(`[data-ac-row="${CSS.escape(name)}"] .ac-value-cell`);
        if (row) {
            row.insertAdjacentHTML(
                'beforeend',
                `<div class="ac-reveal-error">${escapeHtml(e.message || 'Could not reveal value.')}</div>`,
            );
        }
    }
}

function hideConfigValue(name) {
    const mask = document.querySelector(`[data-ac-value-mask="${CSS.escape(name)}"]`);
    const plain = document.querySelector(`[data-ac-value-plain="${CSS.escape(name)}"]`);
    if (plain) {
        plain.textContent = '';
        plain.hidden = true;
    }
    if (mask) mask.hidden = false;
    const btn = document.querySelector(`[data-ac-hide="${CSS.escape(name)}"]`);
    if (btn) {
        btn.textContent = 'Reveal';
        btn.dataset.acReveal = name;
        btn.removeAttribute('data-ac-hide');
    }
    document.querySelectorAll(`[data-ac-row="${CSS.escape(name)}"] .ac-reveal-error`).forEach((el) => el.remove());
}

async function revealAllConfigValues() {
    const buttons = [...document.querySelectorAll('[data-ac-reveal]')];
    await Promise.all(buttons.map((btn) => revealConfigValue(btn.getAttribute('data-ac-reveal'))));
}

function hideAllConfigValues() {
    [...document.querySelectorAll('[data-ac-hide]')].forEach((btn) => {
        hideConfigValue(btn.getAttribute('data-ac-hide'));
    });
}

function updateProgressUi(root, state) {
    const done = CHECKLIST.reduce((n, g) => n + g.items.filter((i) => state[i.id]).length, 0);
    const pct = Math.round((done / TOTAL_ITEMS) * 100);
    const fill = root.querySelector('[data-progress-fill]');
    if (fill) fill.style.width = `${pct}%`;
    const count = root.querySelector('[data-total-count]');
    if (count) count.textContent = `${done} / ${TOTAL_ITEMS} done · ${pct}%`;
    CHECKLIST.forEach((group) => {
        const gDone = group.items.filter((i) => state[i.id]).length;
        const el = root.querySelector(`[data-group-progress="${group.id}"]`);
        if (el) el.textContent = `${gDone}/${group.items.length}`;
    });
    const stats = root.querySelectorAll('.ac-stat');
    const readyValue = stats.length ? stats[stats.length - 1].querySelector('.ac-stat-value') : null;
    if (readyValue) {
        readyValue.textContent = `${pct}%`;
        readyValue.classList.remove('is-success', 'is-warning', 'is-danger');
        readyValue.classList.add(pct === 100 ? 'is-success' : pct >= 50 ? 'is-warning' : 'is-danger');
    }
}

function switchTab(root, tabId) {
    activeTab = tabId;
    root.querySelectorAll('.ac-tab').forEach((btn) => {
        btn.classList.toggle('is-active', btn.getAttribute('data-ac-tab') === tabId);
    });
    root.querySelectorAll('.ac-panel').forEach((panel) => {
        panel.hidden = panel.getAttribute('data-ac-panel') !== tabId;
    });
}

function ensureDelegation() {
    if (window.__mintAdminConfigDelegation) return;
    window.__mintAdminConfigDelegation = true;

    document.addEventListener('click', (e) => {
        const root = document.querySelector('[data-admin-config-root]');
        if (!root) return;
        const target = e.target;
        if (!target || !target.closest) return;

        if (target.closest('[data-ac-send-otp]')) { void sendOtp(); return; }
        if (target.closest('[data-ac-resend]')) { void sendOtp(); return; }
        if (target.closest('[data-ac-verify-otp]')) { void verifyOtp(); return; }
        if (target.closest('[data-ac-lock]')) { clearStepUp(activeEnv); void render(); return; }

        const revealBtn = target.closest('[data-ac-reveal]');
        if (revealBtn && root.contains(revealBtn)) {
            void revealConfigValue(revealBtn.getAttribute('data-ac-reveal'));
            return;
        }
        const hideBtn = target.closest('[data-ac-hide]');
        if (hideBtn && root.contains(hideBtn)) {
            hideConfigValue(hideBtn.getAttribute('data-ac-hide'));
            return;
        }
        if (target.closest('[data-ac-reveal-all]') && root.contains(target.closest('[data-ac-reveal-all]'))) {
            void revealAllConfigValues();
            return;
        }
        if (target.closest('[data-ac-hide-all]') && root.contains(target.closest('[data-ac-hide-all]'))) {
            hideAllConfigValues();
            return;
        }

        const tabBtn = target.closest('[data-ac-tab]');
        if (tabBtn && root.contains(tabBtn)) { switchTab(root, tabBtn.getAttribute('data-ac-tab')); return; }

        const resetBtn = target.closest('[data-ac-reset]');
        if (resetBtn && root.contains(resetBtn)) {
            saveChecklistState({});
            root.querySelectorAll('[data-ac-check]').forEach((cb) => { cb.checked = false; });
            root.querySelectorAll('.ac-check').forEach((rowEl) => rowEl.classList.remove('is-done'));
            updateProgressUi(root, {});
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter') return;
        const input = e.target;
        if (input && input.closest && input.closest('[data-ac-otp-input]')) {
            e.preventDefault();
            void verifyOtp();
        }
    });

    document.addEventListener('change', (e) => {
        const root = document.querySelector('[data-admin-config-root]');
        if (!root) return;
        const target = e.target;
        if (!target || !target.closest) return;

        const envSel = target.closest('[data-ac-env]');
        if (envSel && root.contains(envSel)) {
            activeEnv = normalizeEnv(envSel.value);
            verifyState = null;
            lastLiveInventory = null;
            void render();
            return;
        }

        const masterSel = target.closest('[data-ac-master-filter]');
        if (masterSel && root.contains(masterSel)) {
            masterFilter = masterSel.value || 'all';
            const masterPanel = document.querySelector('[data-ac-panel="master"]');
            if (masterPanel) masterPanel.outerHTML = renderMasterPanel();
            return;
        }

        const cb = target.closest('[data-ac-check]');
        if (cb && root.contains(cb)) {
            const state = loadChecklistState();
            const id = cb.getAttribute('data-ac-check');
            state[id] = cb.checked;
            saveChecklistState(state);
            const rowEl = cb.closest('.ac-check');
            if (rowEl) rowEl.classList.toggle('is-done', cb.checked);
            updateProgressUi(root, state);
        }
    });
}

/* ------------------------------- boot -------------------------------- */

async function render() {
    const root = document.getElementById('adminConfigRoot');
    if (!root) return;

    root.innerHTML = '<div class="ac-loading"><i class="fas fa-spinner fa-spin"></i> Checking admin access…</div>';

    // First load: default the environment switcher to this deployment's environment.
    if (!activeEnv) {
        const boot = await fetchAccess(CONFIG.financeApiBase.replace(/\/$/, ''));
        activeEnv = normalizeEnv(boot && boot.environment);
        if (activeEnv !== 'staging' && activeEnv !== 'production') activeEnv = 'staging';
    }

    const base = apiBaseFor(activeEnv);
    const access = await fetchAccess(base);
    lastAccess = access;

    const su = getStepUp(activeEnv);
    const stepUpRequired = Boolean(access && access.step_up_required);
    const verified = Boolean(access && access.allowed && (!stepUpRequired || su));

    root.innerHTML = renderToolbar(access, verified) + '<div id="acBody"></div>';
    const body = document.getElementById('acBody');
    if (!body) return;

    if (!access || !access.allowed) {
        body.innerHTML = renderAccessDenied(access && access.required_roles);
        return;
    }

    if (stepUpRequired && !su) {
        verifyState = {
            phase: (verifyState && verifyState.phase) || 'idle',
            emailHint: access.email_hint,
            emailDelivery: access.email_delivery_configured,
            message: verifyState && verifyState.message,
        };
        body.innerHTML = `<div id="acVerify">${renderVerifyInner()}</div>`;
        return;
    }

    const state = loadChecklistState();
    body.innerHTML = renderConsole(state);
    void loadLiveInventory(base, stepUpRequired ? su && su.token : null);
}

function isAdminConfigPage() {
    return document.body?.getAttribute('data-portal-nav') === NAV_ID;
}

export async function bootAdminConfigPage() {
    ensureDelegation();
    await render();
}

if (claimPageScript('admin-config-boot')) {
    if (!window.__mintAdminConfigTurboLoad) {
        window.__mintAdminConfigTurboLoad = true;
        document.addEventListener('turbo:load', () => {
            if (isAdminConfigPage()) void bootAdminConfigPage();
        });
    }
    if (isAdminConfigPage()) void bootAdminConfigPage();
}
