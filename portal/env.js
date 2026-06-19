/**
 * Optional last-mile overrides for LOCAL dev only.
 * Production values come from Vercel PUBLIC_* → npm run build:env → config/runtime-env.js.
 * Do not set keys here if they are already in runtime-env.js (would override deploy config).
 */
(function (w) {
    'use strict';
    if (!w.__MINTRAIQ_ENV__ || typeof w.__MINTRAIQ_ENV__ !== 'object') {
        w.__MINTRAIQ_ENV__ = {};
    }
    // Example: only fill when build did not set a value (local tunnel)
    // var env = w.__MINTRAIQ_ENV__;
    // if (!env.financeApiBase) env.financeApiBase = 'http://localhost:5000/api';
    // Billing (local Stripe test mode):
    // if (!env.stripePublishableKey) env.stripePublishableKey = 'pk_test_...';
    // if (env.requireBillingPaywall == null) env.requireBillingPaywall = true;
})(typeof window !== 'undefined' ? window : globalThis);
