/**
 * Rules a MintrAIQ social post must satisfy before it is scheduled.
 *
 * A post is the loosest surface this product has and the hardest to retract.
 * An in-app string is fixed by a release; a published Reel is fixed by deleting
 * the post that already has the impressions. So the checks the reel skill's
 * claims gate describes in prose live here as code, and run as a test.
 *
 * The rules themselves are DATA, in marketing/claims/rules.json (design
 * 01-design section 4.2), each with its reason and its own positive and
 * negative fixtures. This module is the evaluator: it normalises text, then
 * runs each rule's matchers. Add or change a rule in the JSON, not here.
 *
 * Baseline, recorded 17 Oct 2026: the previous hard-coded gate caught 1 of 14
 * known-bad probes (only "We will never sell your data."). It had no bank,
 * Akahu, retired-name, number, score or injection rule at all.
 *
 * Exports kept for existing importers: BLOCKED, ADVICE (the original eight
 * rules, as RegExp lists), GO_URL, IOS_URL, ANDROID_URL, findViolations.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { PLACEHOLDER, REGISTER, findEntry, isStale, literalPattern, numericEntries, todayIso } from './claims-register.mjs';

export const RULES_PATH = join(import.meta.dirname, '..', 'marketing', 'claims', 'rules.json');

export const CONFIG = JSON.parse(readFileSync(RULES_PATH, 'utf8'));

export const GO_URL = CONFIG.constants.go_url;
export const IOS_URL = CONFIG.constants.ios_url;
export const ANDROID_URL = CONFIG.constants.android_url;

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const INVISIBLE = new RegExp(CONFIG.normalise.invisible, 'g');
const DASHES = new RegExp(CONFIG.normalise.dashes, 'g');
const HTML_TAG = new RegExp(`</?(?:${CONFIG.normalise.html_tags})\\b[^>]*>`, 'gi');
const CONFUSABLE = new RegExp(`[${Object.keys(CONFIG.normalise.confusables).join('')}]`, 'g');

/** A GO_URL form (bare or https, with optional utm params), the two store URLs. */
const ALLOWED_URLS = new RegExp(
    [
        `(?:https?://)?${escapeRegex(GO_URL)}(?:\\?utm_[a-z]+=[a-z0-9_-]+(?:&utm_[a-z]+=[a-z0-9_-]+)*)?`,
        escapeRegex(IOS_URL),
        escapeRegex(ANDROID_URL)
    ].join('|'),
    'gi'
);

/**
 * The text a rule actually sees: NFKC, invisible and bidi characters removed,
 * lookalike letters folded to Latin, markdown and HTML tags stripped,
 * whitespace collapsed. The original is never modified (callers keep it to diff).
 */
export function normalise(text) {
    return String(text ?? '')
        .normalize('NFKC')
        .replace(INVISIBLE, '')
        .replace(DASHES, '-')
        .replace(CONFUSABLE, (ch) => CONFIG.normalise.confusables[ch])
        .replace(HTML_TAG, ' ')
        .replace(/\[([^\]]*)\]\(([^)]*)\)/g, '$1 $2')
        .replace(/[*`~]/g, '')
        .replace(/(?<![A-Za-z0-9])_|_(?![A-Za-z0-9])/g, '')
        .replace(/^\s*(?:>|#{1,6}(?=\s)|[-+]\s)/gm, '')
        .replace(/\s+/g, ' ')
        .trim();
}

const withoutAllowedUrls = (text) => text.replace(ALLOWED_URLS, ' ');

const tokens = (text) => text.toLowerCase().match(/[a-z0-9']+/g) ?? [];

const NUMBER_PATTERN = new RegExp(
    `\\d|[%$]|\\b(?:${[...CONFIG.numbers.words, ...CONFIG.numbers.prevalence].join('|')})\\b`,
    'i'
);

const DIGIT_PATTERN = /[\d%$]/;

const LINK_PATTERNS = [
    /https?:\/\//i,
    /\bwww\./i,
    /\b[a-z0-9-]+\.(?:com|net|org|nz|co|io|app|ly|me|info|xyz|ai|dev|gl|link)\b/i,
    /(?:^|\s)@\w/
];

const HASHTAG = /#[a-z]\w*/gi;

/** Valid {{fig:id}} placeholders and the literal text of registered numeric figures are not claims the numbers rule can see. */
function withoutRegistered(text, register = REGISTER) {
    const known = (id) => Boolean(findEntry(id, register));
    const placeholders = text.replace(PLACEHOLDER, (whole, id) => (known(id) ? ' ' : whole));
    return numericEntries(register).reduce((rest, entry) => rest.replace(literalPattern(entry.text), ' '), placeholders);
}

const MATCHERS = {
    regex: (m) => {
        const re = new RegExp(m.pattern, m.flags ?? '');
        return (text) => re.test(text);
    },
    words: (m) => {
        const re = new RegExp(`\\b(?:${m.terms.map(escapeRegex).join('|')})\\b`, m.case_sensitive ? '' : 'i');
        return (text) => re.test(text);
    },
    proximity: (m) => {
        const first = new RegExp(m.first);
        const second = new RegExp(m.second);
        return (text) => {
            const words = tokens(text);
            return words.some((word, i) => {
                const near = (a, b) => words.slice(i + 1, i + 1 + m.window).some((w) => (a.test(word) && b.test(w)));
                return near(first, second) || (m.either_order && near(second, first));
            });
        };
    },
    numbers: () => (text, ctx) => NUMBER_PATTERN.test(withoutRegistered(withoutAllowedUrls(text), ctx.register)),
    // Registered figures only: a placeholder must name a known, fresh entry, and a literal that
    // equals a registered figure must be fresh. An illustrative entry needs the chip on its surface.
    figures: () => (text, ctx) => {
        const register = ctx.register ?? REGISTER;
        const used = [];
        // Braces left once valid placeholders are removed would be published as written.
        if (/\{\{|\}\}/.test(text.replace(PLACEHOLDER, ' '))) return 'malformed {{fig:...}} placeholder';
        for (const [, id] of text.matchAll(PLACEHOLDER)) {
            const entry = findEntry(id, register);
            if (!entry) return `unknown figure {{fig:${id}}}`;
            used.push(entry);
        }
        for (const entry of numericEntries(register)) if (literalPattern(entry.text).test(text)) used.push(entry);
        const stale = used.find((entry) => isStale(entry, ctx.today));
        if (stale) return `figure ${stale.id} was verified ${stale.verified_at} and is past its ${stale.max_age_days}-day shelf life`;
        const needsChip = used.find((entry) => entry.type === 'illustrative');
        if (needsChip && !text.includes(normalise(register.illustrative_chip))) return `figure ${needsChip.id} is illustrative and needs the "${register.illustrative_chip}" chip`;
        return false;
    },
    // Veo/Flow prompts: timing, aspect and shot numbering are spec, any other digit, $ or % is a figure
    // a video model could burn into frame. Number words describe the picture ("five rows"), not a claim.
    prompt_figures: (m) => {
        const spec = m.strip.map((pattern) => new RegExp(pattern, 'gi'));
        return (text) => DIGIT_PATTERN.test(spec.reduce((rest, re) => rest.replace(re, ' '), withoutAllowedUrls(text)));
    },
    links: () => (text) => {
        const rest = withoutAllowedUrls(text);
        const hashtags = rest.match(HASHTAG) ?? [];
        const foreignHashtag = hashtags.some((tag) => !CONFIG.constants.hashtags_allow.includes(tag.toLowerCase()));
        return foreignHashtag || LINK_PATTERNS.some((re) => re.test(rest));
    }
};

function compile(rule) {
    const tests = rule.match.map((m) => MATCHERS[m.type](m));
    const applies = (ctx) => !rule.skip_surfaces?.includes(ctx.surface) && (!rule.only_surfaces || rule.only_surfaces.includes(ctx.surface));
    // A matcher returns false, true, or a string that says what exactly matched.
    const matches = (text, ctx) => (applies(ctx) ? tests.map((t) => t(text, ctx)).find(Boolean) : false);
    return { id: rule.id, class: rule.class, reason: rule.reason, matches };
}

const textRules = CONFIG.rules.filter((rule) => rule.match);

/** Rules as loaded from JSON; the mutation tests pass a reduced list instead. */
export const RULES = textRules;

function legacyList(group) {
    return textRules
        .filter((rule) => rule.legacy_group === group)
        .map((rule) => ({ id: rule.id, pattern: new RegExp(rule.match[0].pattern, rule.match[0].flags), reason: rule.reason }));
}

export const BLOCKED = legacyList('BLOCKED');
export const ADVICE = legacyList('ADVICE');

const legacyRules = textRules.filter((rule) => rule.legacy_group);

function run(text, rules, ctx = {}) {
    const clean = normalise(text);
    const context = { ...ctx, today: ctx.today ?? todayIso() };
    return rules
        .map(compile)
        .map((rule) => ({ rule, hit: rule.matches(clean, context) }))
        .filter(({ hit }) => hit)
        .map(({ rule, hit }) => ({ id: rule.id, class: rule.class, reason: rule.reason, ...(typeof hit === 'string' ? { detail: hit } : {}) }));
}

/**
 * The ORIGINAL eight rules only (BLOCKED + ADVICE), now with normalisation.
 * site-claims.test.mjs holds the public site to this set, and the site
 * legitimately carries figures, so it must not inherit the social-only rules.
 * Returns [] for compliant copy.
 */
export const findViolations = (text, rules = legacyRules, ctx) => run(text, rules, ctx);

/**
 * The full social gate: every rule in rules.json. `rules` lets tests run a
 * mutated rule set.
 */
export const findSocialViolations = (text, rules = textRules, ctx) => run(text, rules, ctx);

/** Gaps in a package's file list: missing required surfaces, or text the gate cannot read. */
export function findCoverageGaps(files) {
    const pkg = CONFIG.package;
    const gaps = [];
    for (const required of pkg.required_files) {
        if (!files.includes(required)) gaps.push(`missing required file ${required}`);
    }
    if (!files.some((f) => f.startsWith(`${pkg.required_frames_dir}/`) && f.endsWith('.html'))) {
        gaps.push(`no ${pkg.required_frames_dir}/*.html frame to scan`);
    }
    const known = new Set([...pkg.text_files, ...pkg.metadata_files]);
    for (const file of files) {
        const isFrame = file.startsWith(`${pkg.required_frames_dir}/`) && file.endsWith('.html');
        const isMedia = pkg.media_extensions.some((ext) => file.toLowerCase().endsWith(ext));
        if (!known.has(file) && !isFrame && !isMedia) gaps.push(`unscanned text surface ${file}`);
    }
    return gaps;
}
