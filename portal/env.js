/**
 * Optional last-mile overrides (no secrets). Prefer:
 *   - env.public + npm run build:env  → config/runtime-env.js
 *   - Vercel Environment Variables (PUBLIC_*)
 */
window.__MINTRAIQ_ENV__ = Object.assign({}, window.__MINTRAIQ_ENV__ || {}, {
    // financeApiBase: 'https://your-tunnel.trycloudflare.com/api',
});
