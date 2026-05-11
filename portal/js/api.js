import { CONFIG } from './config.js';
import { getAccessTokenOrReauth } from './logto-client.js';

/**
 * Authenticated fetch to finance_api (same audience as bootstrap).
 * Path is relative to financeApiBase, e.g. "/generate" → POST {base}/generate
 * Defaults to cache: 'no-store' so workspace data stays live; override with options.cache if needed.
 * Legal copy may still be held in session via `legal-store.js` after a successful fetch.
 */
export async function financeApiFetch(logtoClient, path, options = {}) {
    if (!CONFIG.financeApiResource) {
        throw new Error('financeApiResource is required for finance_api JWT (audience) tokens.');
    }
    const token = await getAccessTokenOrReauth(logtoClient, CONFIG.financeApiResource);

    const base = CONFIG.financeApiBase.replace(/\/$/, '');
    const rel = path.startsWith('/') ? path : `/${path}`;
    const url = path.startsWith('http') ? path : `${base}${rel}`;

    const headers = {
        Accept: 'application/json',
        ...(options.headers || {}),
        Authorization: `Bearer ${token}`
    };

    const { cache: cacheOpt, ...rest } = options;
    return fetch(url, {
        cache: cacheOpt ?? 'no-store',
        ...rest,
        headers
    });
}

/**
 * Authenticated POST to the dedicated OCR receipt scanner (multipart field `file`).
 * Uses `ocrScannerApiUrl` (full URL). JWT audience: `ocrScannerApiResource` if set, else `financeApiResource`.
 */
export async function ocrScannerFetch(logtoClient, options = {}) {
    const url = String(CONFIG.ocrScannerApiUrl || '').trim();
    if (!url) {
        throw new Error('ocrScannerApiUrl is required (e.g. https://ocr-dev.mintraiq.com/ocr/scanner).');
    }
    const resource =
        (CONFIG.ocrScannerApiResource && String(CONFIG.ocrScannerApiResource).trim()) ||
        CONFIG.financeApiResource;
    if (!resource) {
        throw new Error('financeApiResource or ocrScannerApiResource is required for OCR scanner JWT.');
    }
    const token = await getAccessTokenOrReauth(logtoClient, resource);

    const headers = {
        Accept: 'application/json',
        ...(options.headers || {}),
        Authorization: `Bearer ${token}`
    };

    const { cache: cacheOpt, ...rest } = options;
    return fetch(url, {
        cache: cacheOpt ?? 'no-store',
        ...rest,
        headers
    });
}
