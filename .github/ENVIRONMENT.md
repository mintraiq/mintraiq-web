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

Deploy: **Actions → CD - Build & Deploy Portal**

Or use Vercel git integration with the same `PUBLIC_*` vars in the Vercel dashboard.
