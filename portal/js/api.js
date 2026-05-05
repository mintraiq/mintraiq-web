import { CONFIG } from './config.js';
import { getAccessTokenOrReauth } from './logto-client.js';

/**
 * Authenticated fetch to finance_api (same audience as bootstrap).
 * Path is relative to financeApiBase, e.g. "/generate" → POST {base}/generate
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

    return fetch(url, { ...options, headers });
}
