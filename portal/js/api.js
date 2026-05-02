import { CONFIG } from './config.js';

/** Attach Bearer token for calls to finance_api (same host as bootstrap). */
export async function financeApiFetch(logtoClient, path, options = {}) {
    const token = CONFIG.financeApiResource
        ? await logtoClient.getAccessToken(CONFIG.financeApiResource)
        : await logtoClient.getAccessToken();

    const base = CONFIG.financeApiBase.replace(/\/$/, '');
    const url = path.startsWith('http') ? path : `${base}${path.startsWith('/') ? path : '/' + path}`;

    const headers = {
        Accept: 'application/json',
        ...(options.headers || {}),
        Authorization: `Bearer ${token}`
    };

    return fetch(url, { ...options, headers });
}
