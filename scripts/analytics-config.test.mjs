/**
 * Guard on the PostHog analytics configuration.
 *
 * The restrictions in `js/analytics.js` are what the Privacy Policy tells users
 * we do. They are not defaults we happened to inherit — PostHog ships with
 * autocapture and session replay ON, so every assertion below is something a
 * later edit could silently undo, in a portal that renders transaction
 * descriptions, amounts and balances.
 *
 * The two that matter most:
 *
 *   - Autocapture and session replay stay off. Turning either on sends the
 *     contents of the signed-in dashboard to a processor outside New Zealand.
 *   - No identify(). Visitors stay pseudonymous; PostHog never receives a
 *     MintrAIQ user_id or email. Calling identify would convert web traffic
 *     measurement into a per-user behavioural profile held offshore — a
 *     different disclosure, and a different legal question.
 *
 * And `portal/callback.html` never loads analytics: its URL carries a
 * single-use sign-in credential (`?code=` / `?token_hash=`, see
 * `portal/js/logto-client.js`) and PostHog records the full URL as
 * `$current_url`.
 *
 * Run: npm run test:analytics-config   (also part of npm run test:legal)
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const LOADER = 'js/analytics.js';
const loader = readFileSync(join(ROOT, LOADER), 'utf8');

/** Assertions about calls must read code, not the prose above it that names them. */
const loaderCode = loader.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/**
 * Pages deliberately excluded from analytics, and why. Removing an entry here is
 * the decision this file exists to make visible.
 */
const EXCLUDED = {
    'portal/callback.html': 'URL carries a single-use sign-in credential',
    'privacy.html': 'a reader consulting the Privacy Policy is not tracked while doing it',
    'terms.html': 'same as privacy.html'
};

const REQUIRED_INIT_OPTIONS = [
    ['autocapture: false', 'autocapture would send element text from the portal'],
    ['disable_session_recording: true', 'replay would send a video of the dashboard'],
    ['mask_all_text: true', 'masking must already be in place if replay is ever enabled'],
    ["capture_pageview: 'history_change'", 'the portal navigates with Turbo (pushState)'],
    ['cross_subdomain_cookie: false', 'the identifier stays on this host'],
    ['secure_cookie: true', 'the site is HTTPS-only'],
    ['capture_performance: false', 'undefined here means PostHog remote config decides'],
    ['capture_dead_clicks: false', 'dead clicks capture element information'],
    ['capture_heatmaps: false', 'heatmaps capture clicks, mouse movement and scrolling']
];

const FORBIDDEN_CALLS = ['identify', 'alias', 'setPersonProperties', 'createPersonProfile'];

function htmlFiles() {
    const out = [];
    for (const name of readdirSync(ROOT)) {
        if (name.endsWith('.html')) out.push(name);
    }
    for (const name of readdirSync(join(ROOT, 'portal'))) {
        if (name.endsWith('.html')) out.push(`portal/${name}`);
    }
    return out.sort();
}

const pages = htmlFiles().map((rel) => ({
    rel,
    text: readFileSync(join(ROOT, rel), 'utf8')
}));

test('the loader pins every privacy-relevant init option', () => {
    for (const [option, why] of REQUIRED_INIT_OPTIONS) {
        assert.ok(loader.includes(option), `${LOADER} must set ${option} — ${why}`);
    }
});

test('the loader never identifies a visitor to PostHog', () => {
    for (const call of FORBIDDEN_CALLS) {
        assert.ok(
            !new RegExp(`posthog\\s*\\.\\s*${call}\\s*\\(`).test(loaderCode),
            `${LOADER} must not call posthog.${call}() — visitors stay pseudonymous`
        );
    }
});

test('the key and host come from runtime-env, never hardcoded', () => {
    assert.ok(loader.includes('__MINTRAIQ_ENV__'), 'config must come from config/runtime-env.js');
    assert.ok(
        !/['"]phc_[A-Za-z0-9]/.test(loaderCode),
        'a project key is hardcoded — clearing PUBLIC_POSTHOG_KEY would no longer disable analytics'
    );
});

test('posthog.init is configured in exactly one place', () => {
    const configuring = pages
        .filter((p) => p.text.includes('posthog.init'))
        .map((p) => p.rel);
    assert.deepEqual(configuring, [], `posthog.init belongs only in ${LOADER}, found in: ${configuring}`);
});

test('excluded pages do not load analytics', () => {
    for (const [rel, why] of Object.entries(EXCLUDED)) {
        const page = pages.find((p) => p.rel === rel);
        assert.ok(page, `${rel} is listed as excluded but does not exist`);
        assert.ok(!page.text.includes('analytics.js'), `${rel} must not load analytics — ${why}`);
    }
});

test('every page with Vercel Analytics also has PostHog, unless excluded', () => {
    const missing = pages
        .filter((p) => p.text.includes('va.vercel-scripts.com'))
        .filter((p) => !(p.rel in EXCLUDED))
        .filter((p) => !p.text.includes('analytics.js'))
        .map((p) => p.rel);
    assert.deepEqual(
        missing,
        [],
        `these pages send data to Vercel but not PostHog: ${missing}. ` +
            'The two coverage sets must stay in step, or the Privacy Policy describes ' +
            'a site that does not exist. Add the tag, or add the page to EXCLUDED with a reason.'
    );
});
