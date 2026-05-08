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

function sanitizeContent(raw) {
    if (!raw || typeof raw !== 'object') return null;
    return {
        version: typeof raw.version === 'string' ? raw.version : '',
        tos: typeof raw.tos === 'string' ? raw.tos : '',
        disclaimer: typeof raw.disclaimer === 'string' ? raw.disclaimer : '',
        insights_footer: typeof raw.insights_footer === 'string' ? raw.insights_footer : ''
    };
}

function sanitizeUserStatus(raw) {
    if (!raw || typeof raw !== 'object') return null;
    return {
        has_agreed: raw.has_agreed === true,
        agreed_version: typeof raw.agreed_version === 'string' ? raw.agreed_version : '',
        agreed_at: typeof raw.agreed_at === 'string' ? raw.agreed_at : ''
    };
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
    if (!content) throw new Error('Legal content response is invalid.');
    const state = {
        content,
        user_status: sanitizeUserStatus(data.user_status)
    };
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
