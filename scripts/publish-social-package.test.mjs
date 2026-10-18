/**
 * Tests for the hash-pinned publish step (marketing-agent design 01-design 6.3,
 * adapted to step 1: no Slack, no issue; the human reads the --dry-run output
 * and pins exactly what he read with --approve-sha).
 *
 * Nothing here needs a Meta token or the network. The CLI is run as a child
 * process against a throwaway package, with every META_* variable removed, so
 * a bug that reached the Graph API would fail on the missing token first.
 *
 * Vectors 1-3 are message-level: vector 1 is the contract in marketing-agent
 * state.md ("Contract: marketing_draft"), vectors 2-4 were produced with
 * Python's json.dumps(sort_keys=True, separators=(',', ':'), ensure_ascii=False)
 * and sha256, an independent implementation.
 *
 * Run: npm run test:social-copy
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { canonicalJson, packageHash, readSurfaces, sha256Hex } from './social-package.mjs';

const PUBLISH = join(import.meta.dirname, 'publish-social-package.mjs');
const HEX_64 = /^[0-9a-f]{64}$/;

const VECTORS = [
    {
        name: 'contract vector (616 bytes)',
        canonical: '{"alt_text":"Card reading: Still paying for that?","beat":"The subscription you forgot you had","calendar_row":6,"caption_facebook":"See what\'s on repeat.\\nhttps://mintraiq.com/go","caption_instagram":"See what\'s on repeat.\\nLink in bio","figures":[],"frames":[{"body":"Spot the charge you forgot.","headline":"Still paying for that?","role":"hook"}],"illustrative_chip":false,"kind":"social","pillar":"where-it-went","schema_version":1,"sentences":[{"claim_id":"recurring_grouping","kind":"capability","text":"MintrAIQ groups repeat charges under one merchant name."},{"kind":"cta","text":"See what\'s on repeat."}]}',
        bytes: 616,
        sha256: 'b099b85534eb7ea532b4d6431b6598ddb2e55a79d379a79d45e11b85d38c9266'
    },
    {
        name: 'figure placeholder',
        canonical: '{"beat":"Food prices","calendar_row":7,"figures":[{"claim_id":"fpi_food_yoy","placeholder":"fpi_food_yoy","value":"1.9%"}],"illustrative_chip":false,"kind":"social","schema_version":1,"sentences":[{"kind":"observation","text":"Food prices rose {{fpi_food_yoy}} in the year to August."}]}',
        sha256: 'a7eb2ea0e2c948ade716ee223b97549aa2f34fdf77d920fe5708aba2098a3a29'
    },
    {
        name: 'non-ASCII, escapes and a decline output',
        canonical: '{"beat":"Café – naïve 🙂","calendar_row":8,"decline":{"reason":"No sourced claim fits \\"this\\" beat\\nso decline."},"figures":[],"illustrative_chip":false,"kind":"social","schema_version":1}',
        sha256: '31ccdd59cd10036c7d7068ba1a0755e2435f733eded3e7c189a5fa2ce08fda97'
    }
];

for (const vector of VECTORS) {
    test(`canonical JSON vector: ${vector.name}`, () => {
        const parsed = JSON.parse(vector.canonical);
        const reverseKeys = (v) => (Array.isArray(v) ? v.map(reverseKeys) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).reverse().map(([k, x]) => [k, reverseKeys(x)])) : v);
        const shuffled = reverseKeys(parsed);
        assert.equal(canonicalJson(shuffled), vector.canonical, 'key order or escaping differs from JCS');
        assert.equal(sha256Hex(vector.canonical), vector.sha256);
        if (vector.name.startsWith('contract')) assert.equal(Buffer.byteLength(vector.canonical, 'utf8'), vector.bytes);
    });
}

test('canonicalJson refuses what the hash cannot represent', () => {
    assert.throws(() => canonicalJson({ n: 1.5 }), /unsupported/);
    assert.throws(() => canonicalJson({ n: null }), /unsupported/);
    assert.throws(() => canonicalJson('\ud800'), /lone surrogate/);
});

test('package hash vector (NFC and CRLF folded, key order irrelevant)', () => {
    const surfaces = [
        { name: 'script.md', raw: 'Line\r\n' },
        { name: 'captions.md', raw: '## Facebook\ncafé\n' }
    ];
    assert.equal(packageHash(surfaces), 'ab34aaa58f7364b1d7faeea7521384b4796327b67564e730ebf60fcd903e8b66');
});

test('changing one character of any surface changes the hash', () => {
    const base = [{ name: 'captions.md', raw: 'See what is on repeat.' }, { name: 'script.md', raw: 'Calm.' }];
    const edited = [base[0], { name: 'script.md', raw: 'Calm!' }];
    assert.notEqual(packageHash(base), packageHash(edited));
    assert.notEqual(packageHash(base), packageHash([...base, { name: 'frames/01.html', raw: '' }]));
});

// --- the CLI -------------------------------------------------------------------

function goodPackage(captionBody = 'See what is on repeat.\nmintraiq.com/go') {
    const dir = mkdtempSync(join(tmpdir(), 'publish-'));
    mkdirSync(join(dir, 'frames'));
    mkdirSync(join(dir, 'frames-feed'));
    writeFileSync(join(dir, 'captions.md'), `# Captions\n\n## Facebook\n\n\`\`\`\n${captionBody}\n\`\`\`\n\n## Instagram\n\n\`\`\`\n${captionBody}\n\`\`\`\n`);
    writeFileSync(join(dir, 'script.md'), '# Script\nCalm and documentary.\n');
    writeFileSync(join(dir, 'claims.md'), '# Claims\n');
    writeFileSync(join(dir, 'frames', '01-hook.html'), '<body><h1>Still paying for that?</h1></body>');
    writeFileSync(join(dir, 'frames', '01-hook.png'), 'png');
    return dir;
}

function run(dir, ...flags) {
    return runIn(mkdtempSync(join(tmpdir(), 'cwd-')), dir, ...flags);
}

function runIn(cwd, dir, ...flags) {
    const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('META_')));
    const result = spawnSync(process.execPath, [PUBLISH, dir, ...flags], { env, cwd, encoding: 'utf8' });
    return { code: result.status, out: `${result.stdout}${result.stderr}` };
}

test('dry run on a clean package prints the approval hash and makes no network call', () => {
    const dir = goodPackage();
    const { code, out } = run(dir, '--dry-run');
    assert.equal(code, 0, out);
    const printed = out.match(/Approval hash \(SHA-256\): ([0-9a-f]{64})/)?.[1];
    assert.match(printed, HEX_64);
    assert.equal(printed, packageHash(readSurfaces(dir)), 'printed hash must be the recomputed package hash');
    assert.match(out, /--approve-sha/);
});

test('dry run refuses a package that violates the gate, and prints no hash to approve', () => {
    const { code, out } = run(goodPackage('Ask Mintor where it went.\nmintraiq.com/go'), '--dry-run');
    assert.notEqual(code, 0);
    assert.match(out, /brand-retired-names/);
    assert.doesNotMatch(out, /Approval hash/);
});

test('a violation in a non-caption surface also blocks (script.md, frames)', () => {
    for (const [file, text] of [['script.md', 'Connects to ASB.'], ['frames/01-hook.html', '<h1>Score: 82/100</h1>']]) {
        const dir = goodPackage();
        writeFileSync(join(dir, file), text);
        const { code, out } = run(dir, '--dry-run');
        assert.notEqual(code, 0, file);
        assert.match(out, new RegExp(file.replace('/', '\\/')));
    }
});

test('a package missing a surface is refused, not skipped', () => {
    const dir = goodPackage();
    writeFileSync(join(dir, 'stray.txt'), 'unscanned');
    const { code, out } = run(dir, '--dry-run');
    assert.notEqual(code, 0);
    assert.match(out, /unscanned text surface stray\.txt/);
});

test('live run without --approve-sha is refused', () => {
    const { code, out } = run(goodPackage(), '--row', '1');
    assert.notEqual(code, 0);
    assert.match(out, /--approve-sha/);
    assert.doesNotMatch(out, /Missing META/);
});

test('live run with the wrong hash is refused', () => {
    const { code, out } = run(goodPackage(), '--row', '1', '--approve-sha', '0'.repeat(64));
    assert.notEqual(code, 0);
    assert.match(out, /does not match/);
    assert.doesNotMatch(out, /Missing META/);
});

test('an edit after approval is refused (the hash is pinned to the bytes that were read)', () => {
    const dir = goodPackage();
    const approved = run(dir, '--dry-run').out.match(/([0-9a-f]{64})/)[1];
    writeFileSync(join(dir, 'script.md'), '# Script\nCalm and documentary, edited.\n');
    const { code, out } = run(dir, '--row', '1', '--approve-sha', approved);
    assert.notEqual(code, 0);
    assert.match(out, /does not match/);
});

test('approval is not read from the calendar: an approved calendar row alone does nothing', () => {
    const dir = goodPackage();
    const cwd = mkdtempSync(join(tmpdir(), 'cwd-'));
    mkdirSync(join(cwd, 'marketing'));
    writeFileSync(join(cwd, 'marketing', 'calendar.md'), '| 1 | 2026-09-27 | approved |\n');
    const { code, out } = runIn(cwd, dir, '--row', '1');
    assert.notEqual(code, 0);
    assert.match(out, /--approve-sha/);
});

test('the right hash passes the approval check and stops at the missing Meta token (no network)', () => {
    const dir = goodPackage();
    const approved = run(dir, '--dry-run').out.match(/Approval hash \(SHA-256\): ([0-9a-f]{64})/)[1];
    const { code, out } = run(dir, '--row', '1', '--approve-sha', approved);
    assert.notEqual(code, 0);
    assert.match(out, /Missing META_PAGE_ID/);
});

test('the gate re-runs on a live run even with a matching hash', () => {
    const dir = goodPackage('Ask Mintor where it went.\nmintraiq.com/go');
    const hash = packageHash(readSurfaces(dir));
    const { code, out } = run(dir, '--row', '1', '--approve-sha', hash);
    assert.notEqual(code, 0);
    assert.match(out, /brand-retired-names/);
    assert.doesNotMatch(out, /Missing META/);
});
