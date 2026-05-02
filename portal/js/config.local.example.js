/**
 * Copy to config.local.js (gitignored) and load before other portal modules if you need overrides.
 *
 * Example (in portal/index.html, before module scripts):
 *   <script src="./js/config.local.js"></script>
 *
 * window.__MINTRAIQ_ENV__ = {
 *   financeApiBase: "http://127.0.0.1:5000/api",
 *   financeApiResource: "" // or your Logto API resource identifier for JWT access tokens
 * };
 */
