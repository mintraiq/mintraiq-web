/**
 * The claims register: structure, freshness and the capability asserts.
 * Deterministic: `today` is pinned, and the assert reader reads the working
 * tree, so no clock and no git remote. (Production reads origin/main.)
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import { REGISTER, checkRegisterAsserts, isStale, literalPattern, numericEntries, validateRegister } from './claims-register.mjs';
import { normalise } from './social-copy-rules.mjs';

const REPO_ROOT = join(import.meta.dirname, '..');
const FRESH_DAY = '2026-09-25';
const STALE_DAY = '2026-12-31';

const workingTreeReader = (_repo, _ref, path) => readFileSync(join(REPO_ROOT, path), 'utf8');
const withEntry = (entry) => ({ ...REGISTER, figures: [entry] });
const capability = () => REGISTER.figures.find((entry) => entry.type === 'capability');

test('the shipped register is well formed and not empty', () => {
    assert.ok(REGISTER.figures.length > 0, 'register has no entries');
    assert.deepEqual(validateRegister(REGISTER), []);
});

test('every entry text is stored in normalised form', () => {
    for (const entry of REGISTER.figures) assert.equal(normalise(entry.text), entry.text, `${entry.id}: text is not normalised`);
});

test('validateRegister reports each structural defect', () => {
    const base = REGISTER.figures.find((entry) => entry.type === 'published_stat');
    const defects = [
        [{ ...base, id: 'Bad Id' }, 'id must be lowercase'],
        [{ ...base, type: 'rumour' }, 'unknown type'],
        [{ ...base, text: '' }, 'no text'],
        [{ ...base, verified_at: '20 Sep' }, 'verified_at'],
        [{ ...base, max_age_days: 0 }, 'max_age_days'],
        [{ ...base, source: { url: base.source.url } }, 'source.retrieved'],
        [{ ...capability(), assert: undefined }, 'needs assert']
    ];
    for (const [entry, expected] of defects) {
        assert.ok(validateRegister(withEntry(entry)).some((p) => p.includes(expected)), `no problem reported containing "${expected}"`);
    }
    assert.ok(validateRegister({ ...REGISTER, figures: [base, base] }).some((p) => p.includes('duplicate id')));
});

test('every capability assert holds in the working tree', () => {
    assert.ok(REGISTER.figures.some((entry) => entry.assert), 'no entry carries an assert, so this test checks nothing');
    assert.deepEqual(checkRegisterAsserts(REGISTER, workingTreeReader), []);
});

test('an assert fails when the file changed, cannot be read, or the reader returns nothing', () => {
    const id = capability().id;
    assert.deepEqual(checkRegisterAsserts(REGISTER, () => 'unrelated').map((f) => f.id).includes(id), true);
    assert.match(checkRegisterAsserts(REGISTER, () => { throw new Error('no such ref'); })[0].reason, /cannot read/);
    assert.match(checkRegisterAsserts(REGISTER, () => undefined)[0].reason, /cannot read/);
});

test('an entry goes stale after its shelf life and not before', () => {
    const entry = REGISTER.figures.find((e) => e.type === 'published_stat');
    assert.equal(isStale(entry, FRESH_DAY), false);
    assert.equal(isStale(entry, STALE_DAY), true);
});

test('literalPattern matches a registered figure but not a longer or differently signed number', () => {
    const plain = literalPattern('1.9%');
    assert.match('up 1.9% on a year ago', plain);
    for (const text of ['up 11.9%', 'up -1.9%', 'up +1.9%', 'up $1.9%', 'up 1.95%']) {
        assert.equal(new RegExp(plain.source).test(text), false, text);
    }
});

test('numericEntries are exactly the entries that carry a figure', () => {
    assert.ok(numericEntries(REGISTER).length > 0);
    assert.ok(numericEntries(REGISTER).every((entry) => ['published_stat', 'illustrative'].includes(entry.type)));
});
