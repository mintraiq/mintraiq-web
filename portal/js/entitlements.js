/**
 * Client-side entitlement helpers — mirrors tier_definitions.features[] from GET /users/me.
 */

const FEAT_3M_DASHBOARD = '3m_dashboard';
const FEAT_BASIC_PLANNERS = 'basic_planners';
const FEAT_UNLIMITED_PLANNERS = 'unlimited_planners';
const FEAT_LSTM_FORECAST = 'lstm_forecast';
const FEAT_EMAIL_CONNECTOR = 'email_connector';
const FEAT_PRODUCT_ANALYTICS = 'product_analytics';

/** Nav item id → required feature(s) or limit key on profile.limits */
const NAV_ENTITLEMENTS = {
    dashboard: { anyFeature: [FEAT_3M_DASHBOARD] },
    transactions: { anyFeature: [FEAT_3M_DASHBOARD] },
    'product-analytics': { anyFeature: [FEAT_PRODUCT_ANALYTICS] },
    'upload-statement': { limitKey: 'statement_uploads_per_month' },
    'receipt-scanner': { limitKey: 'receipt_scans_per_month' },
    'budget-planner': { anyFeature: [FEAT_BASIC_PLANNERS, FEAT_UNLIMITED_PLANNERS] },
    'weekly-planner': { anyFeature: [FEAT_BASIC_PLANNERS, FEAT_UNLIMITED_PLANNERS] },
    forecast: { anyFeature: [FEAT_LSTM_FORECAST] },
    'settings-email': { anyFeature: [FEAT_EMAIL_CONNECTOR] },
};

let cachedProfile = null;

export function setEntitlementProfile(profile) {
    cachedProfile = profile || null;
}

export function getEntitlementProfile() {
    return cachedProfile;
}

function featureSet(profile) {
    return new Set(Array.isArray(profile?.features) ? profile.features : []);
}

export function hasFeature(profile, featureName) {
    return featureSet(profile).has(featureName);
}

export function hasAnyFeature(profile, featureNames) {
    const set = featureSet(profile);
    return featureNames.some((name) => set.has(name));
}

export function limitRemaining(profile, limitKey) {
    const limits = profile?.limits || {};
    const usage = profile?.usage || {};
    const limitMap = {
        receipt_scans_per_month: 'receipts_scanned',
        statement_uploads_per_month: 'statements_uploaded',
        chat_messages_per_month: 'chat_messages',
    };
    const max = Number(limits[limitKey] ?? 0);
    const usedField = limitMap[limitKey];
    const used = usedField ? Number(usage[usedField] ?? 0) : 0;
    return Math.max(0, max - used);
}

export function navItemAllowed(profile, navId) {
    const rule = NAV_ENTITLEMENTS[navId];
    if (!rule) return true;
    if (rule.anyFeature?.length) {
        return hasAnyFeature(profile, rule.anyFeature);
    }
    if (rule.limitKey) {
        return Number(profile?.limits?.[rule.limitKey] ?? 0) > 0;
    }
    return true;
}

export function filterWorkspaceNav(profile, items) {
    return items.filter((item) => navItemAllowed(profile, item.id));
}

export async function loadEntitlementProfile(client, financeApiFetch) {
    const res = await financeApiFetch(client, '/users/me', {
        method: 'GET',
        headers: { Accept: 'application/json' },
    });
    const profile = await res.json();
    if (!res.ok) {
        throw new Error(profile?.detail || 'Could not load profile');
    }
    setEntitlementProfile(profile);
    return profile;
}

export {
    FEAT_3M_DASHBOARD,
    FEAT_BASIC_PLANNERS,
    FEAT_UNLIMITED_PLANNERS,
    FEAT_LSTM_FORECAST,
    FEAT_EMAIL_CONNECTOR,
    FEAT_PRODUCT_ANALYTICS,
    NAV_ENTITLEMENTS,
};
