/**
 * Every user-facing string in the portal whose truth depends on whether bank
 * sync exists — plus the guard that stops the server sending one back.
 *
 * WHAT: one module holding the portal's bank-sync flag and the copy that moves
 * with it, ported from `finance-ai-mobile/lib/bankSyncCopy.ts`.
 *
 * WHY: founder decision 13 Aug 2026 — there is **no bank aggregation**. Neither
 * Akahu nor BlinkPay is connected and none will be. Data arrives only when the
 * user uploads a statement or scans a receipt. So a line like "Connect my bank"
 * or "Sync Akahu" does not merely point at a hidden button — it represents a
 * capability the product does not have, which is Fair Trading Act 1986
 * ss 9/10/13 territory. The impression created on a reasonable NZ consumer is
 * the test, not the words avoided.
 *
 * WHY A MODULE AND NOT INLINE STRINGS: the same claim was spread across seven
 * portal files, and mobile says the same things in its own words. Describing
 * one service two ways across repos is itself an FTA problem, so the wording
 * lives in one place per repo and the two places are kept identical.
 * `scripts/bank-sync-copy.test.mjs` holds the line.
 *
 * The subtler half is automation. "Connect once and I can track your emergency
 * fund without you lifting a finger" is a promise of *ongoing, unattended*
 * tracking. Statement upload is neither. Every replacement below therefore says
 * what the user has to keep doing.
 *
 * Each function takes the flag rather than reading it, so both branches stay
 * reachable in a test. Call sites pass `ENABLE_BANK_SYNC` from this module.
 */

/**
 * OFF: there is no bank aggregation integration.
 *
 * The portal is static — there is no build-time env inlining here the way
 * `EXPO_PUBLIC_*` works in the mobile bundle — so this is a plain constant
 * rather than an env read. Flipping it back on is a code change and a review,
 * which is the correct amount of friction for a claim this size.
 *
 * The backend has already gated `/akahu/sync` behind its own `enable_bank_sync`
 * flag, so the endpoint 404s. Turning this on alone would put a button in front
 * of the user that fails.
 */
export const ENABLE_BANK_SYNC = false;

/**
 * Phrases that assert a bank connection or unattended tracking. None may appear
 * in any string this module returns, or in any string the portal renders from
 * the API, while bank sync is off. Asserted by the test.
 *
 * Kept identical to `BANK_SYNC_CLAIMS` in finance-ai-mobile.
 */
export const BANK_SYNC_CLAIMS = [
    'connect your bank',
    'connect a bank',
    'connect my bank',
    'connect bank',
    'link your bank',
    'bank sync',
    'auto-sync',
    'akahu',
    'lifting a finger',
];

/**
 * Phrases the API sends that mobile never has to see, so they are kept out of
 * the parity list above rather than silently diverging from it.
 *
 * The portal renders server-supplied copy in three places — the LITE unlock
 * CTA, the receipt-only expansion prompt, and the cold-start flow tiles. The
 * receipt prompt currently arrives as "Pair receipts with your bank feed" /
 * "Connect a primary banking portal to reconcile receipt line-items…", and
 * neither of those trips a single phrase in the mobile list. That near-miss is
 * the whole reason this second list exists: the offending string is not in our
 * markup, so no amount of reading our markup finds it.
 */
export const API_BANK_SYNC_CLAIMS = [
    'bank feed',
    'banking portal',
    'linked banking',
    'bank connection',
];

/** Everything a rendered string is checked against. */
export const ALL_BANK_SYNC_CLAIMS = [...BANK_SYNC_CLAIMS, ...API_BANK_SYNC_CLAIMS];

/**
 * True when a string carries a claim the product cannot support.
 *
 * @param {unknown} text
 * @returns {boolean}
 */
export function containsBankSyncClaim(text) {
    if (typeof text !== 'string' || !text) return false;
    const haystack = text.toLowerCase();
    return ALL_BANK_SYNC_CLAIMS.some((claim) => haystack.includes(claim));
}

/**
 * A server-supplied string, or the local fallback when the server's version
 * makes a claim we cannot stand behind.
 *
 * @param {unknown} value
 * @param {string} fallback
 * @returns {string}
 */
export function safeCopy(value, fallback) {
    if (typeof value !== 'string' || !value.trim()) return fallback;
    return containsBankSyncClaim(value) ? fallback : value;
}

/** Links that would land the user on a bank-connect surface. */
const BANK_SYNC_HREF = /settings-banks|bank[-_]?sync|akahu/i;

/**
 * A server-supplied href, or the local fallback when it points at a
 * bank-connect destination.
 *
 * @param {unknown} value
 * @param {string} fallback
 * @returns {string}
 */
export function safeHref(value, fallback) {
    if (typeof value !== 'string' || !value.trim()) return fallback;
    return BANK_SYNC_HREF.test(value) ? fallback : value;
}

/**
 * Empty transactions list and the receipt-only expansion prompt — both answer
 * "how does data get in here?", so they must name only the routes that exist.
 *
 * Verbatim from finance-ai-mobile `dataSourcePrompt`.
 *
 * @param {boolean} bankSyncEnabled
 * @returns {string}
 */
export function dataSourcePrompt(bankSyncEnabled) {
    return bankSyncEnabled
        ? 'Import a bank statement or connect your bank to start tracking spending.'
        : 'Import a bank statement or scan a receipt to start tracking spending.';
}

/**
 * The short action label used on unlock and expansion CTAs.
 *
 * Verbatim from finance-ai-mobile `dataSourceCoachMark`.
 *
 * @param {boolean} bankSyncEnabled
 * @returns {string}
 */
export function dataSourceCoachMark(bankSyncEnabled) {
    return bankSyncEnabled ? 'Upload a statement or connect your bank' : 'Upload a bank statement';
}

/**
 * The connect step's goal framing — the one place the portal promises what
 * happens *after* the user gives it data.
 *
 * With sync, "connect once" is literally true: the feed keeps arriving. Without
 * it, every one of these becomes a claim of automation the portal cannot make,
 * so the replacements put the recurring effort back on the user ("keep
 * adding"). That is less seductive on purpose; it is the accurate version.
 *
 * Both tables are verbatim from finance-ai-mobile.
 */
const GOAL_FRAMING_SYNCED = {
    emergency_fund: 'Connect once and I can track your emergency fund without you lifting a finger.',
    debt_payoff: 'Connect once and I can watch your debt come down without you doing the maths.',
    big_purchase: 'Connect once and I can tell you when your big purchase is actually within reach.',
    retirement: "Connect once and I can show you what today's spending does to the long game.",
    just_visibility: 'Connect once and the whole picture shows up on its own — no spreadsheets.',
};

const GOAL_FRAMING_MANUAL = {
    emergency_fund: 'Keep adding your spending and I can track your emergency fund alongside it.',
    debt_payoff: 'Keep adding your spending and I can watch your debt come down without you doing the maths.',
    big_purchase: 'Keep adding your spending and I can tell you when your big purchase is actually within reach.',
    retirement: 'Keep adding your spending and I can show you what it does to the long game.',
    just_visibility: 'Keep adding your spending and the whole picture comes together — no spreadsheets.',
};

export const DEFAULT_CONNECT_SUBTITLE = 'Pick whichever fits. You can add the others later.';

/** Every goal the framing tables answer. Both tables must cover all of them. */
export const FRAMED_GOALS = Object.keys(GOAL_FRAMING_SYNCED);

/**
 * Framing for the user's stated goal, or the neutral subtitle if unknown.
 *
 * @param {boolean} bankSyncEnabled
 * @param {string} [primaryGoal]
 * @returns {string}
 */
export function connectGoalFraming(bankSyncEnabled, primaryGoal) {
    const table = bankSyncEnabled ? GOAL_FRAMING_SYNCED : GOAL_FRAMING_MANUAL;
    return (primaryGoal && table[primaryGoal]) || DEFAULT_CONNECT_SUBTITLE;
}

/**
 * The LITE_MINIMUM forecast lock — the loudest ask in the portal, shown to a
 * user who has some history but not enough to forecast on.
 *
 * @param {boolean} bankSyncEnabled
 * @returns {string}
 */
export function unlockForecastCta(bankSyncEnabled) {
    return bankSyncEnabled ? 'Drop Statement PDF or Connect Akahu Feed.' : dataSourceCoachMark(false);
}

/**
 * The RECEIPT_ONLY_INSIGHTS banner: the user has receipts and no transactions,
 * and this is what we tell them to do about it.
 *
 * `href` stays on the uploader, because with sync off `settings-banks.html` no
 * longer offers a connection to land on.
 *
 * @param {boolean} bankSyncEnabled
 * @returns {{ title: string, body: string, ctaLabel: string, href: string }}
 */
export function expansionPrompt(bankSyncEnabled) {
    return bankSyncEnabled
        ? {
              title: 'Pair receipts with your bank feed',
              body: dataSourcePrompt(true),
              ctaLabel: 'Connect bank account',
              href: './settings-banks.html',
          }
        : {
              title: 'Add a statement to unlock forecasts',
              body: dataSourcePrompt(false),
              ctaLabel: dataSourceCoachMark(false),
              href: './upload-statement.html',
          };
}
