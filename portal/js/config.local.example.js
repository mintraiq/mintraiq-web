/**
 * Copy to portal/js/config.local.js (gitignored) OR set on each HTML page before modules load:
 *
 * <script>
 *   window.__MINTRAIQ_ENV__ = {
 *     financeApiBase: "http://192.168.68.66:5000/api",
 *     // Same string as settings.api_identifier in FastAPI config / Logto API resource:
 *     financeApiResource: "https://your-mintraiq-api-resource",
 *     logtoRegisterUrl: "https://your-tenant.logto.app/register?app_id=..."
 *   };
 * </script>
 */
