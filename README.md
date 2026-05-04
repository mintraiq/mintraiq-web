# MintrAIQ Web

Static marketing pages, a **Logto-powered portal** (`portal/`), **FastAPI reference** (`finance_api.py`), and **legacy Flask templates** (`legacy/`) while you migrate screens.

## Layout

| Path | Purpose |
|------|---------|
| `intro*.html`, `mock-dashboard.html`, … | Static marketing + demo dashboard |
| **`web/`** | **Ninja Finance** static shell (Flask `layout.html`–style nav). Same pages as `http://localhost:5000/…` mapped to `web/*.html`; API base from `config/runtime-env` → `legacyFlaskBase`. Entry: `web/home.html` or `web/index.html`. |
| **`mintraiq/`** | Built **`react-embed/ninja-ui.js`** (React). Source in **`apps/ninja-react/`**; run `npm run build:react`. See **`mintraiq/README.md`** (iframe audit). |
| **`apps/ninja-react/`** | Vite project that emits into **`mintraiq/react-embed/`**. |
| `portal/` | Logto sign-in, callback → `POST …/bootstrap`, then **`portal/dashboard.html`** (live `POST …/generate` + charts) |
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

6. The portal maps `routing` to **`portal/dashboard.html`** for `landing` / `lite` / `full` (loads metrics from FastAPI `POST /generate`); `redirect_to_license` → `coming-soon.html?from=license`. Marketing demo remains at **`mock-dashboard.html`**.

**Important:** the Logto **client secret** is not used in the browser. It stays on the server if you use a confidential client elsewhere.

### Configure the portal

Prefer **`env.public.example`** → copy to **`env.public`** and run **`npm run build:env`**, or set **`PUBLIC_*`** variables on Vercel (see [Deploy to Vercel](#deploy-to-vercel)). Optional last-mile overrides in **`portal/env.js`**.

`config/runtime-env.js` is a **single** generated script (defaults live in `scripts/build-runtime-env.mjs`, not a second browsable file). Treat anything shipped to the browser as **public**—never put API keys or Logto client secrets there.

- `financeApiBase` — e.g. `https://your-api.example.com/api` (bootstrap path is `/api/bootstrap` under that base).
- `financeApiResource` — **required**: same string as **`settings.api_identifier`** in FastAPI (Logto API resource).

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

## Deploy to Vercel

1. **Push this repo to GitHub** (or GitLab / Bitbucket) if it is not already remote-connected.
2. In [Vercel](https://vercel.com), **Add New Project** → **Import** the repository. Use the **repository root** as the project root (no subdirectory).
3. **Framework Preset:** Other (or leave default). Vercel reads **`vercel.json`**: install runs **`npm install`**, build runs **`npm run build:env`**, which generates **`config/runtime-env.js`** from environment variables.
4. **Output:** Static files are served from the repo root (same as local layout: `intro.html`, `portal/`, `legacy/pages/`, etc.).
5. **Environment variables** (Project → Settings → Environment Variables). Add at least the **`PUBLIC_*`** keys from **`env.public.example`** for Production (and Preview if you want preview deploys to hit a staging API):

   | Variable | Example |
   |----------|---------|
   | `PUBLIC_LOGTO_ENDPOINT` | `https://your-tenant.logto.app` |
   | `PUBLIC_LOGTO_APP_ID` | Your Logto SPA app id |
   | `PUBLIC_FINANCE_API_BASE` | `https://api.yourdomain.com/api` |
   | `PUBLIC_FINANCE_API_RESOURCE` | Same as FastAPI `api_identifier` |
   | `PUBLIC_LEGACY_FLASK_BASE` | Only if you use `legacy/pages` against Flask (tunnel URL ok) |
   | `PUBLIC_SIGN_IN_REDIRECT_URI` | `https://your-project.vercel.app/portal/callback.html` |

6. **Redeploy** after changing env vars: Deployments → **Redeploy** (or push a commit). The build must run so **`config/runtime-env.js`** is regenerated.
7. **Logto Console:** Add **Redirect URI** `https://<your-vercel-domain>/portal/callback.html` and **allowed CORS / post-logout** URLs for your production site origin.
8. **FastAPI CORS:** Allow your Vercel origin (e.g. `https://mintraiq-xxx.vercel.app`) in the backend `allow_origins` so the portal can call the API with Bearer tokens.

Local build before push (optional): `npm install && npm run build:env` — creates **`config/runtime-env.js`** from **`env.public`** or exported **`PUBLIC_*`** vars.

### Ninja Finance static app (`web/`)

| Flask (localhost:5000) | Vercel / static file |
|------------------------|----------------------|
| `/home` | `web/home.html` |
| `/expenses` | `web/transactions.html` |
| `/upload` | `web/upload.html` |
| `/budget-planner` | `web/budget-planner.html` (React embed + `docs/samples/budget_plan.json`) |
| `/weekly-planner` | `web/weekly-planner.html` (React + `docs/samples/weekly_plan.json` via `mintraiq/react-embed/`) |
| `/financial-score` | `web/financial-score.html` |
| `/forecast` | `web/forecast.html` (React + `docs/samples/dashboard.json` via `mintraiq/react-embed/`) |
| `/cpi-guru` | `web/cpi-guru.html` |
| `/account/goals` | `web/goals.html` |
| `/account/profile` (tabs) | `web/account-profile.html` + `web/settings.html` |
| `/camera` | `web/scan-receipts.html` |
| `/upload-receipt` | `web/upload-receipts.html` |

Set **`PUBLIC_LEGACY_FLASK_BASE`** (or edit defaults inside `scripts/build-runtime-env.mjs` / regenerate `config/runtime-env.js`) to your Flask origin so sidebar hints and `fetch` calls match.

## Oracle CDN

Upload the **repository root** so `portal/` and config scripts stay together. Links are **relative** so they work under a path prefix when the whole tree is deployed as one folder.
