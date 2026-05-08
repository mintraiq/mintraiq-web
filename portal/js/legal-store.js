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
        tos: typeof raw.tos === 'string' ? raw.tos : '',
        disclaimer: typeof raw.disclaimer === 'string' ? raw.disclaimer : '',
        insights_footer: typeof raw.insights_footer === 'string' ? raw.insights_footer : ''
    };
}

function saveToSession(content) {
    legalCache = content;
    window.__MINTRAIQ_LEGAL__ = content;
    sessionStorage.setItem(LEGAL_SESSION_KEY, JSON.stringify(content));
}

export function clearLegalContentState() {
    legalCache = null;
    window.__MINTRAIQ_LEGAL__ = null;
    sessionStorage.removeItem(LEGAL_SESSION_KEY);
}

export function getLegalContent() {
    if (legalCache) return legalCache;
    if (window.__MINTRAIQ_LEGAL__) {
        legalCache = sanitizeContent(window.__MINTRAIQ_LEGAL__);
        return legalCache;
    }
    const raw = sessionStorage.getItem(LEGAL_SESSION_KEY);
    if (!raw) return null;
    const parsed = sanitizeContent(safeParse(raw));
    if (!parsed) return null;
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
    saveToSession(content);
    return content;
}

export async function agreeToLegalTerms(logtoClient) {
    const res = await financeApiFetch(logtoClient, '/legal/agree', {
        method: 'POST',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ agreed: true })
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Failed to record legal agreement (${res.status}).`);
    }
}
