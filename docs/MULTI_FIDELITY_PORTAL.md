# Portal multi-fidelity UI

The live dashboard (`portal/dashboard.html`) switches layout based on `fidelity_mode` from `POST /api/generate`.

## Modes → views

| `fidelity_mode` | Portal module | UX |
|-----------------|---------------|-----|
| `NORMAL`, `HYBRID_STANDARD`, `LSTM_FULL` | `dashboard-fidelity.js` → full render | Standard metrics, charts, forecast |
| `LITE_MINIMUM` | `dashboard-lite.js` | Blurred forecast lock + `influence_hooks` CTA |
| `RECEIPT_ONLY_INSIGHTS` | `dashboard-receipt.js` | Receipt ledger cards + bank-connect banner |
| `COLD_START_ONBOARDING` | `dashboard-receipt.js` (`renderColdStart`) | Onboarding flow buttons |

## Files

| File | Purpose |
|------|---------|
| `portal/js/dashboard-fidelity.js` | Top-level router |
| `portal/js/dashboard-page.js` | Calls `renderFidelityDashboard` after fetch |
| `portal/css/dashboard-fidelity.css` | Lite lock, receipt banner styles |
| `docs/samples/dashboard.json` | Full / hybrid sample |
| `docs/samples/dashboard-lite.json` | Lite sample |
| `docs/samples/dashboard-receipt.json` | Receipt-only sample |
| `apps/ninja-react/src/ForecastApp.tsx` | React embed on `forecast.html` with same mode switch |

## Local testing

1. Point portal at local API (`config/runtime-env.js`).
2. Sign in → `POST /bootstrap` returns `routing.fidelity_mode`.
3. Dashboard loads → `POST /generate` returns payload; layout switches without reload.

### Playwright E2E (fidelity layouts)

Static harness (no Logto) exercises production `dashboard-fidelity.js` against sample JSON:

```bash
cd mintraiq-web
npm install
npm run test:e2e:install   # once — downloads Chromium
npm run test:e2e
```

| File | Role |
|------|------|
| `portal/e2e/fidelity-harness.html` | Dashboard DOM shell for tests |
| `portal/e2e/fidelity-harness.js` | Loads `docs/samples/dashboard-*.json` |
| `e2e/fidelity-dashboard.spec.ts` | Assertions per `fidelity_mode` |
| `e2e/playwright.config.js` | Serves repo on `:4173` via `python3 -m http.server` |

From `finance-ai-dashboard` (optional):

```bash
export MINTRAIQ_WEB_ROOT=/path/to/mintraiq-web
pytest tests/e2e/test_fidelity_portal_playwright.py -m e2e
```

Use sample fixtures when API is offline by temporarily pointing `finance-dashboard.js` at `./docs/samples/dashboard-lite.json`.
