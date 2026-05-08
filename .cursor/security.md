# MintrAIQ Security & Production Standards

## 1. Data Handling
- **Zero-Leaking:** Never log raw bank statements or receipt JSON to the console in production.
- **Sanitization:** All user input must be sanitized via Zod before being sent to the `finance-ai-dashboard` API.
- **Storage:** Sensitive financial insights must be cleared from memory on logout.

## 2. Compliance (New Zealand)
- **Privacy:** Data must be handled according to NZ Privacy Act 2020. Implement "Right to be Forgotten" logic in UI workflows.
- **Disclaimers:** Any AI-generated financial insight must be accompanied by a disclaimer: *"This is AI-generated analysis and does not constitute financial advice under NZ law."*

## 3. Production Readiness
- **Error Boundaries:** Wrap all AI-insight widgets in React Error Boundaries to prevent total UI failure if a specialized agent (forecasting/scanner) returns an error. *(Implemented for `apps/ninja-react` via `WidgetErrorBoundary`.)*
- **Environment variables:** Server-side and CI should use env vars. **Browser/static bundles** in this repo expose only **public** IDs and URLs via **`config/runtime-env.js`**, generated from **`PUBLIC_*`** variables (`npm run build:env`) — never ship Gemini keys or Logto **client secrets** to static HTML. Secrets belong only on the FastAPI/backend host.

## 4. Logging
- Do not **`console.log`** dashboard payloads, receipts, or bank-derived JSON. Use **`console.error`** sparingly and never print raw API responses in production builds.

## 5. Content Security Policy (Vercel)
- **`vercel.json`** sends a site-wide `Content-Security-Policy` on production deploys: jsDelivr, cdnjs, Vercel Analytics, **`esm.sh`** (Logto browser SDK import), Google Fonts, `'unsafe-inline'` for existing inline boot scripts, and broad **`connect-src https:`** for configurable API bases. Remove `'unsafe-inline'` after migrating inline scripts to modules. Local static servers do not apply these headers unless configured separately.