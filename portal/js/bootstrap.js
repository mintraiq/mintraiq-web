import { CONFIG } from './config.js';

/**
 * POST /api/bootstrap — matches finance_api.BootstrapPayload and Depends(validate_token).
 * validate_token expects a JWT whose `aud` matches settings.api_identifier → use Logto API resource token.
 */
export async function bootstrapSession(logtoClient) {
    if (!CONFIG.financeApiResource) {
        throw new Error(
            'Missing financeApiResource. Set window.__MINTRAIQ_ENV__.financeApiResource to the same value as ' +
                'settings.api_identifier in your FastAPI config (Logto API resource identifier).'
        );
    }

    const claims = await logtoClient.getIdTokenClaims();
    const email = claims.email ?? '';
    const name = claims.name ?? claims.username ?? claims.preferred_username ?? '';

    const accessToken = await logtoClient.getAccessToken(CONFIG.financeApiResource);

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
        const detail = data.detail;
        const msg =
            typeof detail === 'string'
                ? detail
                : Array.isArray(detail)
                  ? detail.map((d) => d.msg || JSON.stringify(d)).join('; ')
                  : data.message || `Bootstrap failed (${res.status})`;
        const err = new Error(msg);
        err.status = res.status;
        err.body = data;
        throw err;
    }

    return data;
}
