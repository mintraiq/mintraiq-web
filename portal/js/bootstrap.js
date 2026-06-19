import { CONFIG } from './config.js';
import { getAccessTokenOrReauth } from './logto-client.js';

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

    const accessToken = await getAccessTokenOrReauth(logtoClient, CONFIG.financeApiResource);

    const base = CONFIG.financeApiBase.replace(/\/$/, '');
    const url = `${base}/bootstrap`;

    // #region agent log
    let tokenMeta = { tokenParts: accessToken.split('.').length };
    try {
        const payload = JSON.parse(atob(accessToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
        tokenMeta = {
            tokenParts: accessToken.split('.').length,
            iss: payload.iss ?? null,
            aud: payload.aud ?? null,
            audType: typeof payload.aud,
            audJson: JSON.stringify(payload.aud ?? null),
            resource: payload.resource ?? null,
            scp: payload.scope ?? payload.scp ?? null,
            expIn: payload.exp ? payload.exp - Math.floor(Date.now() / 1000) : null
        };
    } catch { /* ignore */ }
    fetch('http://127.0.0.1:7478/ingest/644bafec-be20-4001-92d1-9dc284896227',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'6f70b8'},body:JSON.stringify({sessionId:'6f70b8',runId:'post-fix-v3',hypothesisId:'E',location:'bootstrap.js:pre-fetch',message:'bootstrap fetch start',data:{url,financeApiBase:CONFIG.financeApiBase,financeApiResource:CONFIG.financeApiResource,...tokenMeta},timestamp:Date.now()})}).catch(()=>{});
    // #endregion

    let res;
    try {
        res = await fetch(url, {
            method: 'POST',
            cache: 'no-store',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                Accept: 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, name })
        });
    } catch (fetchErr) {
        // #region agent log
        fetch('http://127.0.0.1:7478/ingest/644bafec-be20-4001-92d1-9dc284896227',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'6f70b8'},body:JSON.stringify({sessionId:'6f70b8',runId:'post-fix',hypothesisId:'C',location:'bootstrap.js:fetch-catch',message:'bootstrap fetch failed',data:{url,errorName:fetchErr?.name,errorMessage:String(fetchErr?.message||fetchErr)},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        throw fetchErr;
    }

    const text = await res.text();
    let data;
    try {
        data = text ? JSON.parse(text) : {};
    } catch {
        throw new Error(`Bootstrap: non-JSON response (${res.status}): ${text.slice(0, 500)}`);
    }

    // #region agent log
    const detailStr = typeof data.detail === 'string' ? data.detail : null;
    fetch('http://127.0.0.1:7478/ingest/644bafec-be20-4001-92d1-9dc284896227',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'6f70b8'},body:JSON.stringify({sessionId:'6f70b8',runId:'post-fix-v3',hypothesisId:'E',location:'bootstrap.js:post-fetch',message:'bootstrap fetch response',data:{url,status:res.status,ok:res.ok,detail:detailStr,...tokenMeta},timestamp:Date.now()})}).catch(()=>{});
    // #endregion

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
