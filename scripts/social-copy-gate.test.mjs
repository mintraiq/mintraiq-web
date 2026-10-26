/**
 * Tests for the claims gate itself (marketing/claims/rules.json), as opposed to
 * social-copy.test.mjs, which pins the original eight rules and the shipped
 * packages' structure. Five parts, from marketing-agent design 01-design 7.1:
 *
 *   recall       a labelled corpus of known-bad copy must be caught 100%
 *   specificity  hard negatives and compliant lines must raise nothing
 *   mutation     removing any rule must make a test fail
 *   vacuous-pass every rule carries fixtures, the corpus is not empty, and a
 *                package missing a surface FAILS instead of being skipped
 *   packages     every shipped package is scanned on every text surface
 *
 * Run: npm run test:social-copy
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { CONFIG, RULES, findCoverageGaps, findSocialViolations, normalise } from './social-copy-rules.mjs';
import { captionsScannedText, readSurfaces, scanPackage, sha256Hex, visibleHtmlText } from './social-package.mjs';

const ROOT = join(import.meta.dirname, '..');
const MARKETING = join(ROOT, 'marketing');
const CORPUS = JSON.parse(readFileSync(join(MARKETING, 'claims', 'corpus.json'), 'utf8'));
const SHIPPED = JSON.parse(readFileSync(join(MARKETING, 'claims', 'shipped-findings.json'), 'utf8')).packages;
const MIN_POSITIVES_PER_RULE = 3;

const MIN_CORPUS_POSITIVES = 60;
// A fixed clock: figure freshness must not make the suite time-dependent.
const TODAY = '2026-09-25';
// A fixture or corpus entry is a string or {text, surface?, today?}.
const asEntry = (entry) => (typeof entry === 'string' ? { text: entry } : entry);
const ids = (entry, rules) => {
    const { text, surface, today } = asEntry(entry);
    return findSocialViolations(text, rules, { surface, today: today ?? TODAY }).map((v) => v.id);
};
const fixturePackage = (overrides = {}) => {
    const dir = mkdtempSync(join(tmpdir(), 'pkg-'));
    mkdirSync(join(dir, 'frames'));
    const files = {
        'captions.md': '# Captions\n\n## Facebook\n\n```\nSee what is on repeat.\nmintraiq.com/go\n```\n\n## Posting notes\n\n- Post on Sunday 09:00.\n',
        'script.md': '# Script\nCalm and documentary.\n',
        'claims.md': '# Claims\n| 1 | 5 | metadata |\n',
        'frames/01-hook.html': '<!doctype html><style>.x{width:1080px}</style><body><h1>Still paying for that?</h1></body>',
        ...overrides
    };
    for (const [name, content] of Object.entries(files)) {
        if (content === null) continue;
        mkdirSync(join(dir, name, '..'), { recursive: true });
        writeFileSync(join(dir, name), content);
    }
    return dir;
};

// --- vacuous-pass guards ---------------------------------------------------

test('every rule has an id, class, reason and at least one positive and one negative fixture', () => {
    const required = ['brand-retired-names', 'bank-names', 'bank-connection', 'data-sharing', 'encryption-spec', 'training-claim', 'retention-period', 'deletion-completeness', 'guarantee', 'forecast-tense', 'product-recommendation', 'directive-framing', 'advice-verb-object', 'advice-comparative', 'user-score', 'numbers', 'links', 'injection-echo', 'blocked-inflation-guru', 'blocked-reserves', 'blocked-bank-sync', 'blocked-smart-zone', 'blocked-explore-tab', 'blocked-receipt-line-categories', 'names', 'figure-resolution', 'video-prompts', 'coverage'];
    const present = CONFIG.rules.map((r) => r.id);
    assert.deepEqual(required.filter((id) => !present.includes(id)), [], 'a gate rule was removed from rules.json');
    for (const rule of CONFIG.rules) {
        assert.ok(rule.id && rule.class && rule.reason, `rule ${rule.id}: needs id, class, reason`);
        assert.ok(rule.test?.positive?.length >= 1, `${rule.id}: no positive fixture`);
        assert.ok(rule.test?.negative?.length >= 1, `${rule.id}: no negative fixture`);
        assert.ok(rule.match || rule.package_check, `${rule.id}: no matcher`);
    }
});

test('rule ids are unique', () => {
    const all = CONFIG.rules.map((r) => r.id);
    assert.equal(new Set(all).size, all.length);
});

test('each rule fires on its own positive fixtures and not on its negatives', () => {
    for (const rule of CONFIG.rules) {
        if (rule.package_check) {
            for (const fx of rule.test.positive) assert.ok(findCoverageGaps(fx.files).length > 0, `coverage should flag ${fx.files}`);
            for (const fx of rule.test.negative) assert.deepEqual(findCoverageGaps(fx.files), []);
            continue;
        }
        for (const fx of rule.test.positive) assert.ok(ids(fx).includes(rule.id), `${rule.id} should fire on: ${JSON.stringify(fx)}`);
        for (const fx of rule.test.negative) assert.ok(!ids(fx).includes(rule.id), `${rule.id} should not fire on: ${JSON.stringify(fx)}`);
    }
});

// --- recall ------------------------------------------------------------------

test('corpus is large, seeded with the 14 probes, and touches every text rule', () => {
    assert.ok(CORPUS.positives.length >= MIN_CORPUS_POSITIVES, `corpus has ${CORPUS.positives.length}, need ${MIN_CORPUS_POSITIVES}`);
    const covered = new Set(CORPUS.positives.flatMap((p) => p.rules));
    const missing = RULES.map((r) => r.id).filter((id) => !covered.has(id));
    assert.deepEqual(missing, [], 'add corpus positives for these rules');
    for (const rule of RULES) {
        const n = CORPUS.positives.filter((p) => p.rules.includes(rule.id)).length;
        assert.ok(n >= MIN_POSITIVES_PER_RULE, `${rule.id}: only ${n} corpus positives, need ${MIN_POSITIVES_PER_RULE}`);
    }
    assert.ok(CORPUS.positives.some((p) => /[​АＭ]/.test(p.text) || p.text.includes('**')), 'corpus needs obfuscated entries');
});

test('recall is 100% on the labelled corpus (previous gate: 1 of 14 probes)', () => {
    const misses = CORPUS.positives.filter((p) => {
        const hit = ids(p);
        return !p.rules.every((id) => hit.includes(id));
    });
    assert.deepEqual(misses.map((p) => p.text), []);
});

// --- specificity ---------------------------------------------------------------

test('hard negatives raise nothing', () => {
    assert.ok(CORPUS.hard_negatives.length >= 10, 'hard negatives shrank');
    for (const text of CORPUS.hard_negatives) assert.deepEqual(ids(text), [], `false positive on: ${JSON.stringify(text)}`);
});

test('shipped link lines (the three constant URLs with utm) are clean', () => {
    const lines = readFileSync(join(MARKETING, 'reels', '2026-09-27-forgotten-subscription', 'captions.md'), 'utf8')
        .split('\n')
        .filter((line) => /^(https|iPhone|Android)/.test(line));
    assert.equal(lines.length, 3, 'expected the facebook link lines');
    for (const line of lines) assert.deepEqual(ids(line), [], line);
});

// --- mutation ---------------------------------------------------------------------

for (const rule of RULES) {
    test(`mutation: neutering ${rule.id} lets its corpus positives through, so recall fails`, () => {
        const neutered = RULES.map((r) => (r.id === rule.id ? { ...r, match: [] } : r));
        const unmutated = CORPUS.positives.filter((p) => p.rules.includes(rule.id) && ids(p).includes(rule.id));
        assert.ok(unmutated.length >= MIN_POSITIVES_PER_RULE, `${rule.id} does not fire on its own corpus positives before mutation`);
        const lost = CORPUS.positives.filter((p) => p.rules.includes(rule.id) && !p.rules.every((id) => ids(p, neutered).includes(id)));
        assert.ok(lost.length >= MIN_POSITIVES_PER_RULE, `${rule.id} could be gutted with fewer than ${MIN_POSITIVES_PER_RULE} recall failures`);
    });
}

// A rule with several matchers is only as strong as its least-exercised one: drop each in turn.
for (const rule of RULES) {
    rule.match.forEach((_, index) => {
        test(`mutation: ${rule.id} matcher ${index} is exercised by the corpus`, () => {
            const mutated = RULES.map((r) => (r.id === rule.id ? { ...r, match: r.match.filter((_m, j) => j !== index) } : r));
            const lost = CORPUS.positives.filter((p) => p.rules.includes(rule.id) && ids(p).includes(rule.id) && !ids(p, mutated).includes(rule.id));
            assert.ok(lost.length >= 1, `${rule.id} matcher ${index} can be removed without a corpus positive noticing: add one`);
        });
    });
}

// --- surfaces -----------------------------------------------------------------------

test('hard negatives stay clean on prompts.md too, where video-prompts applies', () => {
    for (const text of CORPUS.hard_negatives) assert.deepEqual(ids({ text, surface: 'prompts.md' }), [], `false positive on prompts.md: ${JSON.stringify(text)}`);
});

test('numbers applies to captions and not to prompts.md, where video-prompts takes over', () => {
    const line = 'Trusted by 9 in 10 Kiwi households.';
    assert.ok(ids({ text: line, surface: 'captions.md' }).includes('numbers'));
    assert.ok(!ids({ text: line, surface: 'prompts.md' }).includes('numbers'));
    assert.ok(ids({ text: line, surface: 'prompts.md' }).includes('video-prompts'));
    assert.ok(!ids({ text: line, surface: 'captions.md' }).includes('video-prompts'));
});

// --- normalisation -------------------------------------------------------------------

test('normalise strips invisible characters, folds lookalikes, drops markup', () => {
    assert.equal(normalise('Min​tr'), 'Mintr');
    assert.equal(normalise('АSB'), 'ASB');
    assert.equal(normalise('**bold** `code` _em_'), 'bold code em');
    assert.equal(normalise('<p>Hi&nbsp;</p>  there'), 'Hi&nbsp; there');
    assert.equal(normalise('Ｍｉｎｔｒ'), 'Mintr');
});

// --- package scan ----------------------------------------------------------------------

test('visibleHtmlText reads text and alt, skips style, decodes entities', () => {
    const text = visibleHtmlText('<style>.a{}Mintor</style><body><img src="Mintr.png" alt="Logo"><p>It&rsquo;s &#36;5</p><!-- Mintr --></body>');
    assert.match(text, /Logo/);
    assert.match(text, /It’s \$5/);
    assert.doesNotMatch(text, /Mintor|Mintr\b/);
});

test('captions scan skips only the preamble and Posting notes', () => {
    const scanned = captionsScannedText('# T\nintro 1080\n\n## Facebook\nfb text\n\n## Alt text\nalt text\n\n## Posting notes\nnotes 09:00\n');
    assert.match(scanned, /fb text/);
    assert.match(scanned, /alt text/);
    assert.doesNotMatch(scanned, /intro|notes/);
});

test('a clean fixture package passes with every surface read', () => {
    const dir = fixturePackage();
    assert.deepEqual(scanPackage(dir, { today: TODAY }), { coverageGaps: [], violations: [] });
    assert.deepEqual(readSurfaces(dir).map((s) => s.name), ['captions.md', 'frames/01-hook.html', 'script.md']);
});

for (const [surface, content] of [
    ['script.md', 'Voiceover: ask Mintor.'],
    ['prompts.md', 'A phone shows Akahu syncing.'],
    ['frames/01-hook.html', '<body><h1>Connects to ASB</h1></body>'],
    ['captions.md', '## Alt text\nA card reading Mintr.\n']
]) {
    test(`the gate reads ${surface}, not just caption blocks`, () => {
        const dir = fixturePackage({ [surface]: content });
        const hit = scanPackage(dir, { today: TODAY }).violations.filter((v) => v.surface === surface);
        assert.ok(hit.length > 0, `${surface} was not scanned`);
    });
}

test('a package missing a required surface fails coverage instead of passing or skipping', () => {
    for (const missing of ['captions.md', 'script.md', 'claims.md', 'frames/01-hook.html']) {
        const dir = fixturePackage({ [missing]: null });
        assert.ok(scanPackage(dir, { today: TODAY }).coverageGaps.length > 0, `missing ${missing} must be a coverage gap`);
    }
});

test('a text file the gate cannot read fails coverage', () => {
    const dir = fixturePackage({ 'notes.txt': 'unscanned Mintor copy' });
    assert.deepEqual(scanPackage(dir, { today: TODAY }).coverageGaps, ['unscanned text surface notes.txt']);
});

// --- the shipped packages -----------------------------------------------------------------

const shippedPackages = () =>
    ['reels', 'features']
        .flatMap((group) => readdirSync(join(MARKETING, group), { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => `${group}/${e.name}`));

test('every shipped package is pinned, and the hardened gate finds exactly what is pinned', () => {
    const packages = shippedPackages();
    assert.equal(packages.length, 3, 'expected the two reels and the receipt-scan feature on disk');
    assert.deepEqual(Object.keys(SHIPPED).sort(), packages.sort(), 'shipped-findings.json out of step with marketing/');
    for (const name of packages) {
        const dir = join(MARKETING, name);
        const { coverageGaps, violations } = scanPackage(dir, { today: TODAY });
        assert.deepEqual(coverageGaps, [], `${name}: coverage`);
        const found = {};
        for (const v of violations) (found[v.surface] ??= new Set()).add(v.id);
        const actual = Object.fromEntries(
            Object.entries(found).map(([surface, set]) => {
                const raw = readSurfaces(dir).find((s) => s.name === surface).raw;
                return [surface, { rules: [...set].sort(), sha256: sha256Hex(raw) }];
            })
        );
        // The hash pins the file's bytes, so editing a flagged file (even to add a
        // new violation of an already-pinned rule) forces a conscious re-pin.
        assert.deepEqual(actual, SHIPPED[name], `${name}: findings or flagged file changed. Fix the package and shrink shipped-findings.json, or investigate`);
    }
});

test('the 27 Sep captions still say Mintr, so the gate must fail them (known positive, not excluded)', () => {
    const { violations } = scanPackage(join(MARKETING, 'reels', '2026-09-27-forgotten-subscription'), { today: TODAY });
    const caption = violations.filter((v) => v.surface === 'captions.md').map((v) => v.id);
    assert.ok(caption.includes('brand-retired-names'), 'retired name Mintr must fail this file until the posted captions are corrected');
});

// --- .vercelignore ---------------------------------------------------------------------------

test('the rules, the corpus and the evaluators stay off the public site', () => {
    const ignored = readFileSync(join(ROOT, '.vercelignore'), 'utf8').split('\n').map((l) => l.trim());
    for (const entry of ['marketing/', 'scripts/social-copy-rules.mjs', 'scripts/social-package.mjs', 'scripts/claims-register.mjs']) {
        assert.ok(ignored.includes(entry), `.vercelignore must list ${entry}`);
    }
});
