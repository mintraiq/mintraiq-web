import { CONFIG } from './config.js';

/**
 * POST /bootstrap on finance API with Logto access token + minimal profile body.
 * Backend should verify JWT (JWKS) and return { route, tier, ... }.
 */
export async function bootstrapSession(logtoClient) {
    const claims = await logtoClient.getIdTokenClaims();
    const email = claims.email ?? '';
    const name = claims.name ?? claims.username ?? claims.preferred_username ?? '';

    let accessToken;
    try {
        accessToken = CONFIG.financeApiResource
            ? await logtoClient.getAccessToken(CONFIG.financeApiResource)
            : await logtoClient.getAccessToken();
    } catch (e) {
        console.warn('getAccessToken with resource failed, retrying default:', e);
        accessToken = await logtoClient.getAccessToken();
    }

    const base = CONFIG.financeApiBase.replace(/\/$/, '');
    const url = `${base}/bootstrap`;

    const res = await fetch(url, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/json',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, name })
    });

    const text = await res.text();
    let data;
    try {
        data = text ? JSON.parse(text) : {};
    } catch {
        throw new Error(`Bootstrap: non-JSON response (${res.status}): ${text.slice(0, 500)}`);
    }

    if (!res.ok) {
        const err = new Error(data.detail || data.message || `Bootstrap failed (${res.status})`);
        err.status = res.status;
        err.body = data;
        throw err;
    }

    return data;
}
