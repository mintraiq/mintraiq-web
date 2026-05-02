# Legacy Flask UI

This folder holds the original **Flask + Jinja** templates and static assets copied from your Python app.

- `templates/` — HTML with `{% extends %}`, `{{ url_for(...) }}`, and server-side blocks. These are **not** served as-is by a static CDN until you strip Jinja or run Flask again.
- `static-flask/` — Original browser scripts (`dashboard.js`, `camera.js`, etc.) that expect `window.fetchSecureAPI` and cookie-based sessions from Flask.

## Current product direction

New auth and API wiring live under **`/portal/`** (Logto browser SDK + `Authorization: Bearer` calls to your FastAPI `finance_api`).

You can gradually port each legacy template to static HTML under `portal/` or the repo root, reusing styles from `legacy/templates/layout.html`.
