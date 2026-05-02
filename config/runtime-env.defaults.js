/**
 * Default public browser config (safe to commit — no secrets).
 * Override with `config/runtime-env.js` (generated: npm run build:env) or Vercel PUBLIC_* vars.
 * @see env.public.example
 */
(function (w) {
    'use strict';
    w.__MINTRAIQ_ENV__ = Object.assign({}, w.__MINTRAIQ_ENV__ || {}, {
        logtoEndpoint: 'https://ufq3nf.logto.app',
        logtoAppId: 'jj76jvuz39xoys68ys7ly',
        financeApiBase: 'http://127.0.0.1:5000/api',
        financeApiResource: 'https://api.finance-ai.suite.com',
        signInRedirectUri: '',
        legacyFlaskBase: 'http://127.0.0.1:5000',
        fastApiDocsUrl: 'http://127.0.0.1:5000/api/docs'
    });
})(typeof window !== 'undefined' ? window : this);
