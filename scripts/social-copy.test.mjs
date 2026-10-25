/**
 * Guard on published social copy.
 *
 * The weekly Sunday post is generated on a schedule, which means the gap
 * between "a sentence was written" and "a public representation about a
 * licensed consumer-finance product exists" is short and largely unattended.
 * This test is the thing standing in that gap. A rule that must hold belongs
 * in a test, not in a prompt asking the generator nicely.
 *
 * Two layers, deliberately:
 *
 *   1. Fixture tests prove each rule actually fires. These carry the real
 *      coverage and can never pass vacuously — every rule in the module must
 *      have a fixture, and `every rule has a fixture` fails if one is added
 *      without one.
 *
 *   2. The scan checks the link contract of every package under marketing/reels/.
 *      The claims themselves are scanned, on every text surface, in
 *      social-copy-gate.test.mjs. With no packages on disk this FAILS: a silent
 *      green on an empty directory is exactly how a guard stops guarding.
 *
 * The honest limit: these patterns catch the claims already known to be false
 * and the advice verbs already identified. A novel false claim in fresh wording
 * passes here. That is what the human review step before scheduling is for —
 * this test raises the floor, it does not sign anything off.
 *
 * Run: npm run test:social-copy
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import {
    ADVICE,
    ANDROID_URL,
    BLOCKED,
    GO_URL,
    IOS_URL,
    findViolations
} from './social-copy-rules.mjs';

const REELS_DIR = join(import.meta.dirname, '..', 'marketing', 'reels');

/** One phrase per rule id that must be caught. */
const FIXTURES = {
    'data-sharing': 'Your data stays with us. We never sell your data.',
    'encryption-spec': 'Protected with bank-level 256-bit encryption.',
    'training-claim': 'Your data is never used to train AI.',
    'retention-period': 'Everything is deleted after 30 days.',
    'deletion-completeness': 'Delete your account and everything goes.',
    'guarantee': 'You will save $400 a month, guaranteed.',
    'product-recommendation': 'Mintr finds you a better mortgage rate — switch and save.',
    'directive-framing': 'Mintr tells you what to do with your money.'
};

const SAFE_COPY = `
Groceries went up again this month. MintrAIQ shows you where it went —
scan a receipt, see the categories, spot the subscription you forgot.
Get it: ${GO_URL}
`;

test('every rule has a fixture, so no rule ships untested', () => {
    const ids = [...BLOCKED, ...ADVICE].map((rule) => rule.id);
    assert.deepEqual(
        ids.filter((id) => !FIXTURES[id]),
        [],
        'add a fixture to FIXTURES for each new rule'
    );
    assert.equal(ids.length, 8, 'the original eight rules changed — a claim guard was added or removed');
});

for (const [id, phrase] of Object.entries(FIXTURES)) {
    test(`catches ${id}`, () => {
        const hits = findViolations(phrase).map((v) => v.id);
        assert.ok(hits.includes(id), `"${phrase}" should trip ${id}, got: ${hits.join(', ') || 'nothing'}`);
    });
}

test('passes copy that keeps the verb on understanding', () => {
    assert.deepEqual(findViolations(SAFE_COPY), []);
});

test('empty and missing input are not violations', () => {
    assert.deepEqual(findViolations(''), []);
    assert.deepEqual(findViolations(null), []);
});

test('every package under marketing/reels carries the link contract', () => {
    const packages = readdirSync(REELS_DIR, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name);
    assert.ok(packages.length > 0, 'marketing/reels is empty: the link contract is not being checked');

    for (const name of packages) {
        const dir = join(REELS_DIR, name);
        const captionsPath = join(dir, 'captions.md');

        assert.ok(existsSync(join(dir, 'claims.md')), `${name}: claims.md is missing`);
        assert.ok(existsSync(captionsPath), `${name}: captions.md is missing`);

        const captions = readFileSync(captionsPath, 'utf8');

        // Instagram cannot render a link in a caption, so the bio page is the
        // only route off the post. Facebook takes the store URLs directly.
        assert.ok(captions.includes(GO_URL), `${name}: captions must carry ${GO_URL}`);
        assert.ok(captions.includes(IOS_URL), `${name}: captions must carry the App Store URL`);
        assert.ok(captions.includes(ANDROID_URL), `${name}: captions must carry the Play Store URL`);
    }
});
