/**
 * Runs the claims gate over the site itself.
 *
 * WHY THIS EXISTS: the gate in `social-copy-rules.mjs` already encoded every
 * claim §1 of `marketing-reel/references/claims-gate.md` forbids, but only
 * `social-copy.test.mjs` ever ran it — against generated captions. So the
 * blocklist was enforced on the lowest-traffic surface in the repo and not on
 * the highest. "Secured by bank-grade encryption" sat in the hero of
 * `intro.html` the whole time, matching `encryption-spec` exactly, and nothing
 * failed. A guard that runs on one surface is a guard that documents a rule
 * rather than holding it.
 *
 * WHAT IS SCANNED: every .html file in the tree. `vercel.json` sets
 * outputDirectory "." with no .vercelignore, so each one is a live URL —
 * `legacy/`, `web/` and the e2e harnesses included. That is the same trap as
 * the publicly served enquiry fixture removed under ADR 0005, and it is why
 * there is no allowlist of "the pages that count".
 *
 * WHAT IS READ: the text a reader actually gets — comments, <script>, <style>
 * and <noscript> removed, tags dropped, entities decoded — plus meta
 * descriptions and alt text, which are copy a person reads in a search result,
 * a link preview or a screen reader even though they never render in the body.
 *
 * NOT VACUOUS: a filesystem walk that matches nothing passes every assertion
 * inside it. Two guards below stop that — `REQUIRED_PAGES` names pages that
 * must be in the scan set, and `MIN_PAGES` floors the count — so a walk that
 * silently narrows fails instead of going green.
 *
 * THE HONEST LIMIT: this catches the claims already known to be false in the
 * shipped product, in the wordings the patterns describe. A novel false claim
 * in fresh wording passes here, and a phrase split across two tags
 * (`bank-<b>grade</b>`) survives tag stripping. This raises the floor; it does
 * not sign copy off. §7 of the claims gate still applies.
 *
 * Run: npm run test:site-claims
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ADVICE, BLOCKED, findViolations } from './social-copy-rules.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Never walked: not served, and the tree is large enough to matter. */
const SKIP_DIRS = new Set(['node_modules']);

/**
 * Pages that must appear in the scan set. If the walk stops reaching these,
 * the gate has stopped covering the site whatever else it reports.
 */
const REQUIRED_PAGES = [
    'index.html',
    'intro.html',
    'home.html',
    'get-started.html',
    'coming-soon.html',
    'app-store.html',
    'play-store.html',
    'contact.html',
    'support.html',
    'privacy.html',
    'terms.html',
    'delete-account.html',
    'go.html',
    'portal/index.html',
    'portal/join.html',
    'portal/dashboard.html',
    'portal/upload-statement.html'
];

/**
 * A floor on the scan set, well under the ~118 pages served today but well
 * over the root and portal trees alone. Catches a walk that narrowed to one
 * directory, which `REQUIRED_PAGES` on its own would not.
 */
const MIN_PAGES = 40;

/** Entities that appear inside prose, so a claim cannot hide behind one. */
const ENTITIES = {
    '&nbsp;': ' ',
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&apos;': "'",
    '&#39;': "'",
    '&lsquo;': "'",
    '&rsquo;': "'",
    '&ldquo;': '"',
    '&rdquo;': '"',
    '&ndash;': '-',
    '&mdash;': '-'
};

/** Copy that is read but never rendered as body text. */
const META_DESCRIPTION = /<meta\b[^>]*\b(?:name|property)\s*=\s*["'][^"']*description[^"']*["'][^>]*>/gi;
const CONTENT_ATTR = /\bcontent\s*=\s*["']([^"']*)["']/i;
const ALT_ATTR = /\balt\s*=\s*["']([^"']+)["']/gi;

/**
 * The copy a reader gets from a page: rendered text, meta descriptions and alt
 * text. Script, style, noscript and comments are dropped outright — a claim in
 * a commented-out block is not a representation to anyone.
 */
function readableText(html) {
    const stripped = String(html ?? '')
        .replace(/<!--[\s\S]*?-->/g, ' ')
        .replace(/<(script|style|noscript)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, ' ');

    const meta = (stripped.match(META_DESCRIPTION) ?? [])
        .map((tag) => tag.match(CONTENT_ATTR)?.[1] ?? '');

    const alts = [...stripped.matchAll(ALT_ATTR)].map((m) => m[1]);

    const body = stripped.replace(/<[^>]*>/g, ' ');

    return decodeEntities([body, ...meta, ...alts].join('\n'))
        .replace(/[^\S\n]+/g, ' ')
        .trim();
}

function decodeEntities(text) {
    return text.replace(/&[a-z]+;|&#\d+;/gi, (entity) => ENTITIES[entity.toLowerCase()] ?? entity);
}

function walk(dir) {
    const out = [];
    for (const entry of readdirSync(dir)) {
        if (SKIP_DIRS.has(entry) || entry.startsWith('.')) continue;
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) out.push(...walk(full));
        else if (extname(full).toLowerCase() === '.html') out.push(full);
    }
    return out;
}

const PAGES = walk(ROOT)
    .map((file) => relative(ROOT, file).split('\\').join('/'))
    .sort();

/* ------------------------------------------------------------------ *
 * 1. The scan set is real
 * ------------------------------------------------------------------ */

test('the walk finds the pages the site is actually made of', () => {
    const missing = REQUIRED_PAGES.filter((page) => !PAGES.includes(page));
    assert.deepEqual(missing, [], `these pages are no longer being scanned: ${missing.join(', ')}`);
});

test('the scan set is not empty or narrowed', () => {
    assert.ok(
        PAGES.length >= MIN_PAGES,
        `only ${PAGES.length} pages resolved (floor ${MIN_PAGES}) — the walk stopped reaching the site`
    );
});

/* ------------------------------------------------------------------ *
 * 2. The reader is doing its job
 *
 * Without these, a readableText() that returned '' would make every assertion
 * in section 3 pass.
 * ------------------------------------------------------------------ */

test('a claim in body copy is read', () => {
    const page = '<html><body><p>Secured by bank-grade encryption.</p></body></html>';
    assert.deepEqual(findViolations(readableText(page)).map((v) => v.id), ['encryption-spec']);
});

test('a claim in a meta description or alt text is read', () => {
    const meta = '<meta name="description" content="Your data is never used to train AI.">';
    assert.deepEqual(findViolations(readableText(meta)).map((v) => v.id), ['training-claim']);

    const alt = '<img src="a.png" alt="You will save $400 a month, guaranteed.">';
    assert.deepEqual(findViolations(readableText(alt)).map((v) => v.id), ['guarantee']);
});

test('a claim survives the entities prose is written with', () => {
    const page = '<p>Protected with bank&nbsp;grade encryption &ndash; always.</p>';
    assert.deepEqual(findViolations(readableText(page)).map((v) => v.id), ['encryption-spec']);
});

test('a claim inside a comment, script or style is not a representation', () => {
    const page = `
        <!-- we never sell your data -->
        <script>const copy = "256-bit encryption";</script>
        <style>/* refinance your mortgage */</style>
        <p>Scan a receipt, see where it went.</p>`;
    assert.deepEqual(findViolations(readableText(page)), []);
});

test('markup alone never trips a rule', () => {
    // Tag names, classes and hrefs must not read as copy — otherwise section 3
    // would be green for the wrong reason on some pages and red on others.
    const page = '<a class="btn-guaranteed" href="/best-rate">Sign in</a>';
    assert.deepEqual(findViolations(readableText(page)), []);
    assert.equal(readableText(page), 'Sign in');
});

/* ------------------------------------------------------------------ *
 * 3. No served page makes a blocked claim
 * ------------------------------------------------------------------ */

test('no page on the site restates a claim the gate blocks', () => {
    const offences = [];
    for (const page of PAGES) {
        const violations = findViolations(readableText(readFileSync(join(ROOT, page), 'utf8')));
        for (const violation of violations) {
            offences.push(`${page} — ${violation.id}: ${violation.reason}`);
        }
    }
    assert.deepEqual(offences, [], `blocked claims are live on the site:\n  ${offences.join('\n  ')}`);
});

test('the site is held to the same rule set as social copy', () => {
    // If a rule is added for a post, it covers the site the same day. This
    // fails if the site test is ever pointed at a narrowed copy of the list.
    assert.ok([...BLOCKED, ...ADVICE].length >= 8, 'rule set shrank — a claim guard was removed');
});
