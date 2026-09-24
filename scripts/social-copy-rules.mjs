/**
 * Rules a Mintr social post must satisfy before it is scheduled.
 *
 * A post is the loosest surface this product has and the hardest to retract.
 * An in-app string is fixed by a release; a published Reel is fixed by deleting
 * the post that already has the impressions. So the checks the reel skill's
 * claims gate describes in prose live here as code, and run as a test.
 *
 * Two bodies of rule, from `marketing-reel/references/claims-gate.md`:
 *
 *   BLOCKED   — claims already proven false in the shipped product (§1) plus
 *               the guarantee language §4 forbids. Restating one of these in an
 *               ad is the same defect with a wider audience and no version
 *               field. The precedent set in this codebase is remove, not soften.
 *
 *   ADVICE    — the FMCA Part 6 line (§2). Budgeting insight needs no licence;
 *               recommending a financial advice product does. Ad copy compresses,
 *               which is why marketing sits closer to this line than the app.
 *               The verb stays on understanding, never on acting on a product.
 *
 * Each rule carries the reason, because a future edit needs to know what it is
 * about to reintroduce.
 */

/** Claims that must never appear, in any wording. */
export const BLOCKED = [
    {
        id: 'data-sharing',
        // `(y|ies)?` is load-bearing: without it the `\b` after `part` falls
        // inside "third-party", so the ordinary way anyone writes this claim
        // slipped through. Found 22 Sep 2026 porting these rules to
        // finance-ai-mobile/lib/copyClaims.ts, where the same hole existed.
        pattern: /\b(never (sell|share)|don'?t (sell|share)|stays with us|no third[- ]part(y|ies)?|third parties:\s*none)\b/i,
        reason:
            'Transaction descriptions, receipt images and Mintor questions reach Google and Groq. ' +
            'Copy inventory F1.'
    },
    {
        id: 'encryption-spec',
        pattern: /\b(bank[- ]level|bank[- ]grade|military[- ]grade|256[- ]bit|aes[- ]?256)\b/i,
        reason:
            'Unsubstantiated as displayed; no application-level encryption on the upload path. F2. ' +
            'Over a bank name it also implies a partnership that does not exist (FTA s 13).'
    },
    {
        id: 'training-claim',
        pattern: /\bnever (used )?to train\b|\bnot used (for|to) train/i,
        reason:
            'Training does happen — the review switch defaults on and onboarding posts ' +
            'training_required: true.'
    },
    {
        id: 'retention-period',
        pattern: /\bdeleted after \d+|\b\d+[- ]day retention\b/i,
        reason: 'No retention period is enforced anywhere except a 400-day snapshot TTL.'
    },
    {
        id: 'deletion-completeness',
        pattern: /\b(everything goes|wiped completely|erased for good|all your data is deleted)\b/i,
        reason: 'Deletion currently leaves collections and the Supabase auth user standing.'
    },
    {
        id: 'guarantee',
        pattern: /\b(guaranteed?|you will save|we'?ll save you|risk[- ]free)\b/i,
        reason:
            'A performance representation. Forecasts stay conditional — projected, estimate, ' +
            'based on your last 3 months. Claims gate §4.'
    }
];

/** Verbs that cross from understanding money into advising on a financial product. */
export const ADVICE = [
    {
        id: 'product-recommendation',
        pattern:
            /\b(switch and save|better (mortgage|interest|rate)|refinanc|which (kiwisaver|fund|insurer)|where to invest|best (fund|rate|provider))\b/i,
        reason:
            'Recommending a credit contract, insurance, KiwiSaver or investment is regulated ' +
            'financial advice and requires a FAP licence (FMCA Part 6).'
    },
    {
        id: 'directive-framing',
        pattern: /\b(tells you what to do with your money|money,? optimised|we'?ll tell you where to put)\b/i,
        reason: 'Implies advice on a product in a handful of words. Claims gate §2.'
    }
];

/** Links every post must carry, and the form each platform can actually render. */
export const GO_URL = 'mintraiq.com/go';
export const IOS_URL = 'https://apps.apple.com/nz/app/mintraiq/id6782332605';
export const ANDROID_URL = 'https://play.google.com/store/apps/details?id=com.mintraiq.app';

/**
 * Every blocked or advice phrase present in `text`.
 * Returns [] for compliant copy, so an empty result is the pass condition.
 */
export function findViolations(text) {
    const source = String(text ?? '');
    return [...BLOCKED, ...ADVICE]
        .filter((rule) => rule.pattern.test(source))
        .map((rule) => ({ id: rule.id, reason: rule.reason }));
}
