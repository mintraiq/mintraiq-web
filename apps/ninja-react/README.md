# ninja-react

Small React embed used by **`web/budget-planner.html`**, **`web/forecast.html`**, **`web/weekly-planner.html`**, and the matching **`legacy/pages/*`** shells.

- **Build:** from repo root, `npm run build:react` (also runs as part of `npm run build` / Vercel `vercel-build`).
- **Output:** `legacy/static-app/react-embed/ninja-ui.js` (loaded as `type="module"`). Host pages set `<meta name="mintraiq-samples-base" content="…">` so fetches resolve to `docs/samples/`.
- **Swap samples for API:** replace `fetchSampleJson(...)` calls in `src/*.tsx` with authenticated `fetch` to your FastAPI routes when those return the same JSON shapes.
