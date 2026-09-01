/**
 * PostHog web analytics loader — marketing site and signed-in portal.
 *
 * Why this is not PostHog's copy-paste snippet: that snippet bakes the project
 * key into every page. Here the key comes from `config/runtime-env.js`
 * (Vercel `PUBLIC_POSTHOG_KEY`), so clearing that one variable and redeploying
 * turns analytics off across the whole site. That is the kill switch — there is
 * no other way to stop collection without a release.
 *
 * The configuration below is a privacy commitment, not an inherited default.
 * `scripts/analytics-config.test.mjs` pins every line of it. Read that test
 * before changing any of this:
 *
 *   - `autocapture: false` and `disable_session_recording: true`. The portal
 *     renders transaction descriptions, amounts and balances. Autocapture would
 *     send element text; session replay would send a video of it. Both would go
 *     to a processor outside New Zealand.
 *   - No `posthog.identify()` anywhere. Visitors stay pseudonymous — PostHog
 *     never receives a MintrAIQ `user_id`, email or provider `sub`.
 *   - `cross_subdomain_cookie: false` keeps the identifier on this host instead
 *     of sharing it with app./agent./survey.mintraiq.com.
 *
 * This file must never load on `portal/callback.html`. That page's URL carries a
 * single-use sign-in credential (`?code=` for PKCE, `?token_hash=` for a magic
 * link — see `portal/js/logto-client.js`), and PostHog records the full URL,
 * query string included, as `$current_url`.
 *
 * Disclosed to users in the Privacy Policy (`legal.json`, "Website analytics")
 * and recorded in `docs/privacy-data-flow-matrix.md`. Adding a provider, or
 * widening what is captured, changes both documents and needs a legal pass.
 */
(function (w, d) {
    'use strict';

    var CLOUD_HOST_SUFFIX = '.i.posthog.com';
    var CLOUD_ASSET_SUFFIX = '-assets.i.posthog.com';

    function readConfig() {
        var env = w.__MINTRAIQ_ENV__;
        if (!env || typeof env !== 'object') return null;
        var key = String(env.posthogKey || '').trim();
        var host = String(env.posthogHost || '').trim().replace(/\/+$/, '');
        if (!key || !host) return null;
        return { key: key, host: host };
    }

    /** PostHog Cloud serves the bundle from a sibling assets subdomain; a proxy serves it itself. */
    function bundleUrl(host) {
        var assetHost =
            host.indexOf(CLOUD_HOST_SUFFIX) === -1
                ? host
                : host.replace(CLOUD_HOST_SUFFIX, CLOUD_ASSET_SUFFIX);
        return assetHost + '/static/array.js';
    }

    var cfg = readConfig();
    if (!cfg) return;

    var script = d.createElement('script');
    script.src = bundleUrl(cfg.host);
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.onload = function () {
        w.posthog.init(cfg.key, {
            api_host: cfg.host,
            autocapture: false,
            disable_session_recording: true,
            mask_all_text: true,
            disable_surveys: true,
            capture_pageview: 'history_change',
            cross_subdomain_cookie: false,
            secure_cookie: true
        });
    };
    d.head.appendChild(script);
})(window, document);
