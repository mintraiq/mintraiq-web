import { CONFIG } from './config.js';
import { getAccessTokenOrReauth } from './logto-client.js';

/**
 * POST {financeApiBase}/generate with Bearer API token (same resource as bootstrap).
 * Body: { start_date, end_date } (snake_case; FastAPI accepts both).
 */
export async function fetchFinanceDashboardJson(logtoClient, startDate, endDate) {
    if (!CONFIG.financeApiResource) {
        throw new Error('Missing financeApiResource in config.');
    }
    const token = await getAccessTokenOrReauth(logtoClient, CONFIG.financeApiResource);
    const base = CONFIG.financeApiBase.replace(/\/$/, '');
    const url = `${base}/generate`;

    const res = await fetch(url, {
        method: 'POST',
        cache: 'no-store',
        headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ start_date: startDate, end_date: endDate })
    });

    const text = await res.text();
    let data;
    try {
        data = text ? JSON.parse(text) : {};
    } catch {
        throw new Error(`Non-JSON from ${url} (${res.status}): ${text.slice(0, 200)}`);
    }

    if (res.status === 401) {
        const err = new Error('Session expired. Sign in again.');
        err.status = 401;
        throw err;
    }

    if (!res.ok) {
        const msg =
            typeof data.detail === 'string'
                ? data.detail
                : data.message || `Request failed (${res.status})`;
        throw new Error(msg);
    }

    return data;
}

export function monthRangeStrings() {
    const date = new Date();
    const first = new Date(date.getFullYear(), date.getMonth(), 1);
    const last = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    const fmt = (d) =>
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return { start: fmt(first), end: fmt(last) };
}
