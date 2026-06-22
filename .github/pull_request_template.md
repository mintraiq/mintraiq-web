## What changed
<!-- Describe the change concisely. One paragraph or bullet list. -->


## Why
<!-- What problem does this solve, or what requirement drove it? Link to issue/ticket if applicable. -->


## How to test
<!-- Step-by-step instructions a reviewer can follow to verify the change. -->

1. `npm install && npm run build:env && ./scripts/serve.sh 8080`
2. Open `http://localhost:8080/portal/index.html`
3. 
4. 

**Pages / flows to verify:**
- [ ] Marketing landing page renders correctly
- [ ] Logto PKCE auth flow: sign in → callback → dashboard routing
- [ ] `POST /bootstrap` response drives correct dashboard variant
- [ ] Stripe checkout redirect works (use test mode key)
- [ ] React embed (`ninja-ui.js`) loads and renders budget/forecast widgets

**Browsers tested:**
- [ ] Chrome
- [ ] Safari

---

## Paired PRs (cross-repo)
<!--
mintraiq-web is a pure frontend consumer of finance-ai-dashboard.
Paired PRs are almost always in finance-ai-dashboard when API contracts change.
-->

| Repo | PR | Required? |
|------|----|-----------|
| `finance-ai-dashboard` | <!-- link — if bootstrap, generate, transactions, or billing endpoint shapes changed --> | <!-- yes / no --> |

---

## Checklist

### Auth & routing
- [ ] `portal/callback.html` handles Logto PKCE callback correctly (no token in URL fragment leaking to logs)
- [ ] `portal/dashboard.html` respects all `BootstrapResponse.routing.dashboard_type` values
- [ ] `PUBLIC_SIGN_IN_REDIRECT_URI` matches the Logto app's allowed redirect URIs
- [ ] Auth tokens not stored in `localStorage` (use Logto SDK's secure storage)

### Runtime env injection
- [ ] `npm run build:env` generates `config/runtime-env.js` from `env.public` (or Vercel env vars)
- [ ] No `PUBLIC_*` values hard-coded in HTML/JS — all sourced from `config/runtime-env.js`
- [ ] `PUBLIC_STRIPE_PUBLISHABLE_KEY` is the **publishable** key (not secret)
- [ ] Vercel preview deployment tested with staging env vars

### React embed (`apps/ninja-react/`)
- [ ] `npm run build` in `apps/ninja-react/` produces updated `ninja-ui.js`
- [ ] Built bundle committed / deployed (not ignored by `.gitignore`)
- [ ] Widget renders correctly when embedded in a static HTML page (no React root conflict)

### Contracts & shared types
- [ ] If `BootstrapResponse` consumption changed, [`shared/types/bootstrap.ts`](../../../mintraiq-workspace/shared/types/bootstrap.ts) still matches
- [ ] If any endpoint contract changed, [`mintraiq-workspace/docs/api-contracts/finance-ai-dashboard.md`](../../../mintraiq-workspace/docs/api-contracts/finance-ai-dashboard.md) is updated

### Static site hygiene
- [ ] No `console.log` statements with tokens or PII in production code
- [ ] No `PUBLIC_LEGACY_FLASK_BASE` calls to localhost in production build
- [ ] `web/finance_api.py` and `web/payment_router.py` are reference copies only — not executed

### Tests & quality
- [ ] Playwright E2E tests pass: `npx playwright test` (requires running local server)
- [ ] New pages/flows have at least one Playwright test covering the happy path

### Docs
- [ ] [`mintraiq-workspace/repos/mintraiq-web/CLAUDE.md`](../../../mintraiq-workspace/repos/mintraiq-web/CLAUDE.md) updated if env vars, entry points, or API calls changed
