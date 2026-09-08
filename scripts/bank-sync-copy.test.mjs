/**
 * Guards every user-facing surface against re-advertising bank sync.
 *
 * WHY: founder decision 13 Aug 2026 — MintrAIQ has no bank aggregation.
 * Neither Akahu nor BlinkPay is connected and none will be. Data arrives only
 * by uploaded statement and scanned receipt. A portal page offering to connect
 * an ASB/ANZ/BNZ/Westpac/Kiwibank account therefore describes a service that
 * does not exist, and under the Fair Trading Act 1986 ss 9/10/13 the test is
 * the impression created on a reasonable NZ consumer, not the words avoided.
 *
 * WHY A TEST AND NOT A NOTE: this copy has come back before. The mobile app was
 * gated in August and the web half was deferred; the wording then sat live for
 * another three weeks. A rule that must hold belongs in the harness, not in a
 * document asking the next author nicely.
 *
 * TWO DISTINCT FAILURES ARE CHECKED, because a wording sweep only catches one:
 *   1. Claim phrases in the portal's own source and markup.
 *   2. Claim phrases arriving from finance-ai-dashboard at runtime. The API
 *      still sends "Drop Statement PDF or Connect Akahu Feed." and "Pair
 *      receipts with your bank feed", so the renderers must refuse them. That
 *      string is not in our HTML, so no amount of reading our HTML finds it.
 *
 * Run: node --test scripts/bank-sync-copy.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, extname, join, relative } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const {
    ALL_BANK_SYNC_CLAIMS,
    API_BANK_SYNC_CLAIMS,
    BANK_SYNC_CLAIMS,
    DEFAULT_CONNECT_SUBTITLE,
    ENABLE_BANK_SYNC,
    FRAMED_GOALS,
    connectGoalFraming,
    containsBankSyncClaim,
    dataSourceCoachMark,
    dataSourcePrompt,
    expansionPrompt,
    safeCopy,
    safeHref,
    unlockForecastCta,
} = await import(new URL('../portal/js/bank-sync-copy.js', import.meta.url));

/* ------------------------------------------------------------------ *
 * 1. The flag and the copy it drives
 * ------------------------------------------------------------------ */

test('bank sync is off — there is no aggregation integration', () => {
    assert.equal(ENABLE_BANK_SYNC, false);
});

test('with the flag off, no copy function returns a bank-sync claim', () => {
    const strings = [
        dataSourcePrompt(false),
        dataSourceCoachMark(false),
        unlockForecastCta(false),
        DEFAULT_CONNECT_SUBTITLE,
        ...Object.values(expansionPrompt(false)),
        ...FRAMED_GOALS.map((goal) => connectGoalFraming(false, goal)),
        connectGoalFraming(false, undefined),
        connectGoalFraming(false, 'a_goal_that_does_not_exist'),
    ];
    for (const value of strings) {
        assert.ok(value, 'a copy function returned nothing');
        assert.equal(
            containsBankSyncClaim(value),
            false,
            `claims a bank connection while sync is off: ${JSON.stringify(value)}`,
        );
    }
});

test('the synced branch is still reachable and still says the opposite', () => {
    // Both branches must stay live: a dead branch rots, and the day the flag
    // flips the wrong copy would ship. This asserts they genuinely differ.
    assert.notEqual(dataSourcePrompt(true), dataSourcePrompt(false));
    assert.notEqual(unlockForecastCta(true), unlockForecastCta(false));
    assert.ok(containsBankSyncClaim(unlockForecastCta(true)));
});

test('both goal-framing tables cover every goal', () => {
    for (const goal of FRAMED_GOALS) {
        assert.notEqual(connectGoalFraming(true, goal), DEFAULT_CONNECT_SUBTITLE, goal);
        assert.notEqual(connectGoalFraming(false, goal), DEFAULT_CONNECT_SUBTITLE, goal);
    }
});

/* ------------------------------------------------------------------ *
 * 2. The wording matches finance-ai-mobile
 *
 * Describing one service two ways across repos is itself an FTA problem, so
 * these strings are pinned to the mobile originals in
 * finance-ai-mobile/lib/bankSyncCopy.ts. If mobile's copy is revised, this
 * test fails and the two are brought back into line deliberately.
 * ------------------------------------------------------------------ */

test('shared strings are verbatim from finance-ai-mobile', () => {
    assert.equal(
        dataSourcePrompt(false),
        'Import a bank statement or scan a receipt to start tracking spending.',
    );
    assert.equal(dataSourceCoachMark(false), 'Upload a bank statement');
    assert.equal(DEFAULT_CONNECT_SUBTITLE, 'Pick whichever fits. You can add the others later.');
    assert.equal(
        connectGoalFraming(false, 'emergency_fund'),
        'Keep adding your spending and I can track your emergency fund alongside it.',
    );
    assert.equal(
        connectGoalFraming(false, 'just_visibility'),
        'Keep adding your spending and the whole picture comes together — no spreadsheets.',
    );
});

/* ------------------------------------------------------------------ *
 * 3. Server-supplied copy is refused, not painted
 * ------------------------------------------------------------------ */

test('safeCopy drops a claim-bearing API string for the local wording', () => {
    // The exact strings finance-ai-dashboard sends today.
    assert.equal(
        safeCopy('Drop Statement PDF or Connect Akahu Feed.', 'Upload a bank statement'),
        'Upload a bank statement',
    );
    assert.equal(
        safeCopy('Connect a primary banking portal to reconcile receipt line-items.', 'fallback'),
        'fallback',
    );
    // A harmless server string is still preferred over the local default.
    assert.equal(safeCopy('Two more months unlocks forecasting.', 'fallback'), 'Two more months unlocks forecasting.');
    assert.equal(safeCopy('', 'fallback'), 'fallback');
    assert.equal(safeCopy(undefined, 'fallback'), 'fallback');
});

test('safeHref refuses a link to a bank-connect destination', () => {
    assert.equal(safeHref('./settings-banks.html', './upload-statement.html'), './upload-statement.html');
    assert.equal(safeHref('/akahu/connect', './upload-statement.html'), './upload-statement.html');
    assert.equal(safeHref('./receipt-scanner.html', './upload-statement.html'), './receipt-scanner.html');
    assert.equal(safeHref(undefined, './upload-statement.html'), './upload-statement.html');
});

test('the parity list stays identical to finance-ai-mobile', () => {
    // API-only phrases live in a separate list precisely so this one can be
    // compared, phrase for phrase, against finance-ai-mobile/lib/bankSyncCopy.ts.
    assert.deepEqual(BANK_SYNC_CLAIMS, [
        'connect your bank',
        'connect a bank',
        'connect my bank',
        'connect bank',
        'link your bank',
        'bank sync',
        'auto-sync',
        'akahu',
        'lifting a finger',
    ]);
    for (const phrase of API_BANK_SYNC_CLAIMS) {
        assert.equal(BANK_SYNC_CLAIMS.includes(phrase), false, `${phrase} must not drift into the parity list`);
    }
});

test('containsBankSyncClaim is case-insensitive and ignores non-strings', () => {
    assert.equal(containsBankSyncClaim('CONNECT YOUR BANK today'), true);
    assert.equal(containsBankSyncClaim('Sync via AKAHU'), true);
    assert.equal(containsBankSyncClaim('Upload a bank statement'), false);
    assert.equal(containsBankSyncClaim(null), false);
    assert.equal(containsBankSyncClaim(42), false);
});

/* ------------------------------------------------------------------ *
 * 4. No served file re-introduces the claim
 *
 * vercel.json sets outputDirectory "." with no .vercelignore, so every path
 * below is a live URL on the deployed site — the e2e harnesses and the
 * docs/samples fixtures included. That is the same trap as the publicly served
 * enquiry fixture removed under ADR 0005.
 * ------------------------------------------------------------------ */

/** Served trees whose copy a user can actually reach. */
const SERVED_DIRS = ['portal', 'apps/ninja-react/src', 'docs/samples'];
const SCANNED_EXTENSIONS = new Set(['.html', '.js', '.ts', '.tsx', '.json', '.css']);

/**
 * Files exempt from the scan, each for a stated reason. An exemption is a
 * decision, so it is listed here rather than pattern-matched away.
 */
const EXEMPT = new Map([
    // The module that defines the claim list, and the guard that mirrors it.
    ['portal/js/bank-sync-copy.js', 'defines BANK_SYNC_CLAIMS'],
    ['apps/ninja-react/src/components/ForecastFidelityViews.tsx', 'restates BANK_SYNC_CLAIMS for the embed bundle'],
    // Admin-only infra registry: session + MintrAdminAgent role + email-OTP
    // step-up. It inventories AKAHU_APP_TOKEN, a backend env var that really
    // exists. Not a consumer-facing claim about the product.
    ['portal/js/admin-config-page.js', 'admin-only secrets inventory'],
    ['portal/js/admin-config-master-matrix.js', 'admin-only secrets inventory'],
    // The user's own habit, not a claim about Mintr: "How do you track money
    // today? — My bank app". The value is also the server's Literal.
    ['portal/js/onboarding-intake.js', 'asks about the user\u2019s existing habit'],
    // The connect step still declares the bank path, gated `enabled:
    // ENABLE_BANK_SYNC`, exactly as finance-ai-mobile does. Asserted separately
    // below to prove it is filtered out rather than merely present.
    ['portal/js/onboarding-connect.js', 'flag-gated path, asserted separately'],
]);

function walk(dir) {
    const out = [];
    for (const entry of readdirSync(dir)) {
        if (entry === 'node_modules' || entry.startsWith('.')) continue;
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) out.push(...walk(full));
        else if (SCANNED_EXTENSIONS.has(extname(full))) out.push(full);
    }
    return out;
}

test('no served file offers or implies a bank connection', () => {
    const offences = [];
    for (const dir of SERVED_DIRS) {
        for (const file of walk(join(root, dir))) {
            const rel = relative(root, file).split('\\').join('/');
            if (EXEMPT.has(rel)) continue;
            const lines = readFileSync(file, 'utf8').split('\n');
            lines.forEach((line, i) => {
                const found = ALL_BANK_SYNC_CLAIMS.filter((claim) => line.toLowerCase().includes(claim));
                if (found.length) offences.push(`${rel}:${i + 1} — ${found.join(', ')}`);
            });
        }
    }
    assert.deepEqual(
        offences,
        [],
        `bank-sync copy is back on a served surface:\n  ${offences.join('\n  ')}`,
    );
});

test('the connect step hides the bank path while sync is off', async () => {
    // Read as source rather than imported: the module boots against `document`.
    const src = readFileSync(join(root, 'portal/js/onboarding-connect.js'), 'utf8');
    assert.match(src, /id: 'bank_sync'/, 'the bank path was deleted rather than gated');
    assert.match(src, /enabled: ENABLE_BANK_SYNC/, 'the bank path is no longer gated on the flag');
    assert.match(src, /p\.enabled !== false/, 'visiblePaths no longer filters disabled paths');
    // …and the paths that remain carry no claim.
    assert.equal(containsBankSyncClaim("A PDF or CSV export from your bank."), false);
});

/* ------------------------------------------------------------------ *
 * 5. The endpoint is gone from the client
 * ------------------------------------------------------------------ */

test('nothing calls the retired /akahu endpoints', () => {
    const offences = [];
    for (const dir of SERVED_DIRS) {
        for (const file of walk(join(root, dir))) {
            const rel = relative(root, file).split('\\').join('/');
            if (rel === 'portal/js/bank-sync-copy.js') continue;
            if (/\/akahu\//.test(readFileSync(file, 'utf8'))) offences.push(rel);
        }
    }
    // finance-ai-dashboard now gates /akahu/sync behind its own
    // enable_bank_sync flag, so a surviving caller POSTs to a 404 in front of
    // the user.
    assert.deepEqual(offences, [], `still calls a gated Akahu endpoint: ${offences.join(', ')}`);
});
