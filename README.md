# MintrAIQ Web

Static marketing pages, a **Logto-powered portal** (`portal/`), **FastAPI reference** (`finance_api.py`), and **legacy Flask templates** (`legacy/`) while you migrate screens.

## Layout

| Path | Purpose |
|------|---------|
| `intro*.html`, `mock-dashboard.html`, … | Static marketing + demo dashboard |
| `portal/` | Logto browser sign-in, OIDC callback, `POST /api/bootstrap` to FastAPI, then redirect |
| `finance_api.py` | Reference copy of your FastAPI app (`validate_token`, `BootstrapPayload`, CORS). Run the real app from your backend repo with `config.settings`. |
| `legacy/templates/` | Original Jinja templates (not CDN-ready until converted) |
| `legacy/static-flask/` | Original JS that expected Flask cookies + `fetchSecureAPI` |
| `static/dashboard.js` | Demo dashboard data for `mock-dashboard.html` |

## Auth + API flow (aligned with `finance_api.py`)

1. User opens `portal/index.html` and clicks **Continue with Logto**.
2. Logto returns to `portal/callback.html`; `@logto/browser` completes `handleSignInCallback`.
3. The portal requests an **access token for your Logto API resource** whose identifier equals FastAPI **`settings.api_identifier`** (same value `validate_token` uses as JWT `audience`).
4. **`POST {financeApiBase}/bootstrap`** with `Authorization: Bearer <access_token>` and JSON body `{ "name", "email" }` (`BootstrapPayload`).
5. FastAPI `bootstrap_user_session` returns:

```json
{
  "status": "success",
  "is_new_user": false,
  "routing": {
    "dashboard_type": "landing | lite | full",
    "redirect_to_license": false
  },
  "profile": { "name": "...", "tier": "..." }
}
```

6. The portal maps `routing` to static pages (today all dashboard types go to `mock-dashboard.html`; `redirect_to_license` → `coming-soon.html?from=license`).

**Important:** the Logto **client secret** is not used in the browser. It stays on the server if you use a confidential client elsewhere.

### Configure the portal

Edit **`portal/env.js`** (loaded before module scripts on portal pages):

- `financeApiBase` — e.g. `http://192.168.68.66:5000/api` (must match how your API is mounted; bootstrap path is `/api/bootstrap` under that base).
- `financeApiResource` — **required**: same string as **`settings.api_identifier`** in your deployed FastAPI `config` (Logto API resource).

## CORS (backend repo, not required in this repo)

The copy of **`finance_api.py` here is for reference only** — your real API lives in another repository. You do **not** need to mirror CORS edits here.

For the static **`portal/`** to call FastAPI from another origin (e.g. `http://localhost:8080` → `http://192.168.x.x:5000`), the **canonical** `finance_api.py` in the backend repo must list that frontend origin in **`CORSMiddleware`** `allow_origins` (or equivalent config-driven list). Example:

```python
allow_origins=[
    "http://localhost:5000",
    "http://localhost:8080",
    "https://your-production-cdn-domain",
],
```

### `api_identifier` ↔ portal

Use the same **`api_identifier`** value as in your backend config (see **`config.example.json`**) for **`portal/env.js`** → **`financeApiResource`** so JWT `aud` matches `validate_token`.

## Local testing (Logto)

Logto **does not work** with `file://` URLs. Serve the repo root over HTTP:

```bash
chmod +x scripts/serve.sh
./scripts/serve.sh 8080
```

Open `http://localhost:8080/portal/index.html`.

### Logto Console checklist

- **Redirect URI:** `http://localhost:8080/portal/callback.html` (and production CDN URL).
- **Post sign-out redirect:** `http://localhost:8080/intro.html` (and production).
- **API resource** registered in Logto with identifier = FastAPI `settings.api_identifier`; SPA requests access token for that resource.

## Oracle CDN

Upload the **repository root** so `portal/` and `portal/env.js` stay together. Links are **relative** so they work under a path prefix when the whole tree is deployed as one folder.
