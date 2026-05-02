# Legacy Flask UI

This folder holds the original **Flask + Jinja** templates and static assets copied from your Python app.

- `templates/` — Jinja sources (`{% extends %}`, `{{ url_for(...) }}`). Not CDN-safe until converted.
- `static-flask/` — Scripts written for the Flask shell (`window.fetchSecureAPI`, session cookies).
- **`pages/`** — Static HTML + **`static-app/`** (MintrAIQ-branded). Prefer repo-root **`web/`** for a **Ninja Finance** shell that tracks Flask `layout.html` navigation and the same `static-app` JS for API calls.

## Running the static app UI

1. Run your Flask app (default assumed: `http://127.0.0.1:5000`).
2. Sign in so the browser holds the session / `ninja_access_token` cookie for that origin.
3. Open the static pages **from the same origin** as Flask, or use a dev proxy so `credentials: 'include'` cookies apply:
   - Mount `legacy/pages/` as Flask static files, e.g. at `/app/`, **or**
   - Use `python -m http.server` **only** if you also proxy API calls (otherwise cookies will not match).

### Configurable API URLs (Vercel / tunnels)

- **Defaults:** `config/runtime-env.defaults.js` (committed) sets `legacyFlaskBase`, Logto, and FastAPI-related keys on `window.__MINTRAIQ_ENV__`.
- **Overrides:** Copy `env.public.example` → `env.public` (gitignored), set e.g. `PUBLIC_FINANCE_API_BASE` and `PUBLIC_LEGACY_FLASK_BASE` to your **Cloudflare tunnel** URL, then run `npm run build:env` → generates `config/runtime-env.js` (also gitignored).
- **Vercel:** Add the same variables in Project → Settings → Environment Variables (`PUBLIC_*`). The build command runs `npm run build:env` so each redeploy bakes the current values into `config/runtime-env.js`.
- **Portal** (`portal/index.html`, `callback.html`, `shell.html`) loads `runtime-env.defaults.js`, then `runtime-env.js`, then optional `portal/env.js` for quick local tweaks.

## API reference

- **Flask routes** are implemented in your canonical `expense_loader` app (this repo may only hold a reference copy; **`expense_loader.py` is gitignored** here if you drop it in locally).
- **FastAPI** request/response models: open **`http://localhost:5000/api/docs`** when the FastAPI blueprint is mounted (as in your full stack).

### Route map (static pages → Flask)

| Page | Flask / behavior |
|------|-------------------|
| `pages/home.html` | `GET /generate1` → dashboard JSON (charts + metrics). |
| `pages/transactions.html`, `expenses-monthly.html` | `GET /list/monthly_expenses` (DataTables-style JSON). |
| `pages/search-by-date.html` | `GET /list/expenses?startDate=&endDate=` |
| `pages/financial-score.html` | `POST /financial-score` |
| `pages/cpi-guru.html` | `POST /cpi-guru` |
| `pages/goals.html` | `POST /account/goals` |
| `pages/upload.html` | `POST /upload` multipart `files` |
| `pages/account-profile.html` | `PUT /users/me1` |
| `pages/forecast.html`, `budget-planner.html` | Iframe to `GET /forecast`, `GET /budget-planner` (server-rendered HTML). |
| `pages/weekly-planner.html` | Explains Flask bug (`budget_data` undefined); fix route then iframe or JSON. |

`static-app/js/api-client.js` remaps legacy paths used in `static-flask/dashboard.js` (`/api/generate` → `GET /generate1`, `/api/transactions` → monthly expenses list, `/api/financial-score` → `/financial-score`).

## Current product direction

New auth and API wiring also live under **`/portal/`** (Logto + Bearer to FastAPI). The `legacy/pages` bundle is for migrating the old cookie-based Flask UI to a static, dashboard-consistent layout.
