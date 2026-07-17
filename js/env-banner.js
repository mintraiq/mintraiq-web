/**
 * Non-production environment notice for the public marketing pages.
 *
 * Renders only when `config/runtime-env.js` reports a deploy environment other than
 * production, so staging/preview copies of the site are never mistaken for the live
 * product. Reads `envLabel` (Vercel's VERCEL_ENV, set at build by build-runtime-env.mjs).
 *
 * Styles are inline so this drops into any page without touching shared CSS.
 */
(function (w, d) {
    'use strict';

    var PRODUCTION_LABEL = 'production';
    var BANNER_ID = 'mintraiq-env-banner';

    var COPY = {
        preview: 'Staging / demo environment — sample data, not the live Mintr product.',
        development: 'Local development build — sample data, not the live Mintr product.'
    };
    var FALLBACK_COPY = 'Non-production environment — sample data, not the live Mintr product.';

    function readEnvLabel() {
        var env = w.__MINTRAIQ_ENV__;
        if (!env || typeof env !== 'object') return '';
        return String(env.envLabel || '').trim().toLowerCase();
    }

    function buildBanner(label) {
        var el = d.createElement('div');
        el.id = BANNER_ID;
        el.setAttribute('role', 'status');
        el.textContent = COPY[label] || FALLBACK_COPY;
        el.style.cssText = [
            'position:sticky',
            'top:0',
            'z-index:2147483647',
            'box-sizing:border-box',
            'width:100%',
            'padding:8px 16px',
            'background:#7a3e00',
            'color:#fff',
            'font:600 13px/1.4 system-ui,-apple-system,"Segoe UI",sans-serif',
            'text-align:center',
            'letter-spacing:0.01em',
            'border-bottom:1px solid rgba(255,255,255,0.25)'
        ].join(';');
        return el;
    }

    function render() {
        var label = readEnvLabel();
        if (!label || label === PRODUCTION_LABEL) return;
        if (d.getElementById(BANNER_ID)) return;
        d.body.insertBefore(buildBanner(label), d.body.firstChild);
    }

    if (d.readyState === 'loading') {
        d.addEventListener('DOMContentLoaded', render);
    } else {
        render();
    }
})(window, document);
