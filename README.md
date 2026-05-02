# MintrAIQ Web

Static marketing pages, a **Logto-powered portal** (`portal/`), and **legacy Flask templates** (`legacy/`) kept for reference while you migrate screens.

## Layout

| Path | Purpose |
|------|---------|
| `intro*.html`, `mock-dashboard.html`, … | Static marketing + demo dashboard |
| `portal/` | Logto browser sign-in, OIDC callback, `POST …/bootstrap` to FastAPI, then redirect |
| `legacy/templates/` | Original Jinja templates (not CDN-ready until converted) |
| `legacy/static-flask/` | Original JS that expected Flask cookies + `fetchSecureAPI` |
| `static/dashboard.js` | Demo dashboard data for `mock-dashboard.html` |

## Auth + API flow (target architecture)

1. User opens `portal/index.html` and clicks **Continue with Logto**.
2. Logto returns to `portal/callback.html` with an authorization code; `@logto/browser` exchanges it and stores the session.
3. The callback handler calls **`POST {financeApiBase}/bootstrap`** with `Authorization: Bearer <access_token>` and JSON body `{ "email", "name" }` from ID-token claims.
4. FastAPI verifies the JWT (JWKS from Logto), links the user, determines tier/route, returns JSON such as `{ "route": "/lite-dashboard", "tier": "free" }`.
5. The browser navigates to a static page. Until real pages exist, `portal/js/config.js` maps known routes to `mock-dashboard.html`.

**Important:** the Logto **client secret is only for a confidential server app**. This SPA uses the **public app id** in the browser. Keep the secret on FastAPI if you add server-side token exchange.

## Local testing (required for Logto)

Logto **does not work** with `file://` URLs. Serve the repo root over HTTP, for example:

```bash
chmod +x scripts/serve.sh
./scripts/serve.sh 8080
```

Then open `http://localhost:8080/portal/index.html`.

### Logto Console checklist

Add **Redirect URIs** (examples):

- `http://localhost:8080/portal/callback.html`
- `https://<your-cdn-domain>/portal/callback.html`

Add **Sign-out redirect URIs**:

- `http://localhost:8080/intro.html`
- `https://<your-cdn-domain>/intro.html`

### FastAPI / CORS

Your browser will call `http://192.168.68.66:5000/api/...` from an `http://localhost:8080` origin. FastAPI must send CORS headers for that origin (and production), for example:

- `Access-Control-Allow-Origin`
- `Access-Control-Allow-Headers: Authorization, Content-Type`
- `OPTIONS` preflight for `POST /api/bootstrap`

### Optional: Logto API resource JWT

If your finance API validates **resource access tokens**, create an API resource in Logto and set `financeApiResource` in `window.__MINTRAIQ_ENV__` (see `portal/js/config.local.example.js`).

## Override config (no secrets)

Create `portal/js/config.local.js` (gitignored) or inject:

```html
<script>
  window.__MINTRAIQ_ENV__ = {
    financeApiBase: "http://127.0.0.1:5000/api",
    financeApiResource: ""
  };
</script>
```

before loading portal module scripts.

## Oracle CDN

Upload the **repository root** (or a build folder that preserves `portal/` and asset paths). All internal links are **relative** so they keep working under a path prefix as long as `portal/` is deployed as a folder next to your HTML files.
