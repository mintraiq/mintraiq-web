import { financeApiFetch } from './api.js';

const LEGAL_SESSION_KEY = 'mintraiq_legal_content_v1';
let legalCache = null;

function safeParse(json) {
    try {
        return JSON.parse(json);
    } catch {
        return null;
    }
}

function coerceVersion(v) {
    if (v == null || v === '') return '';
    return String(v).trim();
}

function sanitizeContent(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const tosRaw = raw.tos ?? raw.terms ?? raw.terms_of_service ?? raw.text ?? '';
    const tos = typeof tosRaw === 'string' ? tosRaw : '';
    return {
        version: coerceVersion(raw.version ?? raw.tos_version),
        tos,
        disclaimer: typeof raw.disclaimer === 'string' ? raw.disclaimer : '',
        insights_footer: typeof raw.insights_footer === 'string' ? raw.insights_footer : ''
    };
}

/**
 * Accepts both portal-friendly keys and DB-shaped keys from FastAPI / legal/content.
 * has_agreed | has_agreed_to_tos; agreed_version | tos_version; agreed_at | tos_agreed_at
 */
function sanitizeUserStatus(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const hasAgreed = raw.has_agreed === true || raw.has_agreed_to_tos === true;
    const agreedVersion = coerceVersion(raw.agreed_version ?? raw.tos_version);
    let agreedAt = '';
    const at = raw.agreed_at ?? raw.tos_agreed_at;
    if (typeof at === 'string') agreedAt = at;
    else if (at != null) agreedAt = String(at);
    return {
        has_agreed: hasAgreed,
        agreed_version: agreedVersion,
        agreed_at: agreedAt
    };
}

export function mergeUserStatuses(a, b) {
    if (!a && !b) return null;
    const x = a || { has_agreed: false, agreed_version: '', agreed_at: '' };
    const y = b || { has_agreed: false, agreed_version: '', agreed_at: '' };
    const at = x.agreed_at || y.agreed_at;
    return {
        has_agreed: !!(x.has_agreed || y.has_agreed),
        agreed_version: coerceVersion(x.agreed_version || y.agreed_version),
        agreed_at: at != null && at !== '' ? String(at) : ''
    };
}

/** Merge profile / bootstrap extras (some APIs nest agreement on profile only). */
export function userStatusFromBootstrapPayload(bootstrap) {
    if (!bootstrap || typeof bootstrap !== 'object') return null;
    const u = bootstrap.user_status && typeof bootstrap.user_status === 'object' ? sanitizeUserStatus(bootstrap.user_status) : null;
    const p = bootstrap.profile
        ? sanitizeUserStatus({
              has_agreed_to_tos: bootstrap.profile.has_agreed_to_tos,
              has_agreed: bootstrap.profile.has_agreed,
              tos_version: bootstrap.profile.tos_version,
              agreed_version: bootstrap.profile.agreed_version,
              tos_agreed_at: bootstrap.profile.tos_agreed_at,
              agreed_at: bootstrap.profile.agreed_at
          })
        : null;
    return mergeUserStatuses(u, p);
}

function saveToSession(state) {
    legalCache = state;
    window.__MINTRAIQ_LEGAL__ = state;
    sessionStorage.setItem(LEGAL_SESSION_KEY, JSON.stringify(state));
}

export function clearLegalContentState() {
    legalCache = null;
    window.__MINTRAIQ_LEGAL__ = null;
    sessionStorage.removeItem(LEGAL_SESSION_KEY);
}

export function getLegalContent() {
    if (legalCache) return legalCache;
    if (window.__MINTRAIQ_LEGAL__) {
        const src = window.__MINTRAIQ_LEGAL__;
        legalCache = {
            content: sanitizeContent(src.content || src),
            user_status: sanitizeUserStatus(src.user_status)
        };
        return legalCache;
    }
    const raw = sessionStorage.getItem(LEGAL_SESSION_KEY);
    if (!raw) return null;
    const parsedRaw = safeParse(raw);
    if (!parsedRaw) return null;
    const parsed = {
        content: sanitizeContent(parsedRaw.content || parsedRaw),
        user_status: sanitizeUserStatus(parsedRaw.user_status)
    };
    if (!parsed.content) return null;
    legalCache = parsed;
    window.__MINTRAIQ_LEGAL__ = parsed;
    return parsed;
}

export async function loadLegalContent(logtoClient, opts = {}) {
    if (!opts.force) {
        const cached = getLegalContent();
        if (cached) return cached;
    }
    const res = await financeApiFetch(logtoClient, '/legal/content', {
        method: 'GET',
        headers: { Accept: 'application/json' }
    });
    const text = await res.text();
    let data = {};
    try {
        data = text ? JSON.parse(text) : {};
    } catch {
        throw new Error(`Legal content returned non-JSON (${res.status}).`);
    }
    if (!res.ok) {
        const detail = data && data.detail;
        const msg = typeof detail === 'string' ? detail : data.message || `Failed to load legal content (${res.status})`;
        throw new Error(msg);
    }
    const content = sanitizeContent(data.content || data);
    const topUser =
        data.user_status && typeof data.user_status === 'object' ? sanitizeUserStatus(data.user_status) : null;
    const nestedProfile =
        data.profile && typeof data.profile === 'object' ? sanitizeUserStatus(data.profile) : null;
    const user_status = mergeUserStatuses(topUser, nestedProfile);
    if (!content || (!content.tos && !content.disclaimer && !content.insights_footer && !content.version)) {
        throw new Error('Legal content response is invalid.');
    }
    const state = { content, user_status };
    saveToSession(state);
    return state;
}

export async function agreeToLegalTerms(logtoClient, version) {
    const normalizedVersion = String(version || '').trim();
    if (!normalizedVersion) {
        throw new Error('Legal content version is required.');
    }
    const res = await financeApiFetch(logtoClient, '/legal/agree', {
        method: 'POST',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ version: normalizedVersion })
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Failed to record legal agreement (${res.status}).`);
    }
}
