# GitHub Environments — mintraiq-web

All configuration is **browser-public** (`PUBLIC_*`). No secrets in the static bundle except Stripe publishable key (`pk_…`).

```bash
gh variable set -f .env.vars --env STAGING
gh variable set -f .env.vars --env PROD
```

## Optional Vercel deploy secrets

| Secret | Purpose |
|--------|---------|
| `VERCEL_TOKEN` | Vercel API token |
| `VERCEL_ORG_ID` | Vercel team/org ID |

| Variable | Purpose |
|----------|---------|
| `VERCEL_PROJECT_ID` | Enables CD Vercel deploy step |

## Variables

See `.env.vars` — maps 1:1 to `PUBLIC_*` in `.github/workflows/cd.yml`.

Deploy: **Vercel Git integration** (recommended — connect repo; each push runs `npm run build` per `vercel.json`).

Optional: **Actions → CD - Build & Deploy Portal** when `DEPLOY_TO_VERCEL=true` and Vercel secrets are set.

Set the same **`PUBLIC_*`** keys in **Vercel → Project → Settings → Environment Variables** (Production / Preview). See README **Deploy to Vercel** for the full Firebase custom-domain table.
