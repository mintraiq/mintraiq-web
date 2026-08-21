/**
 * Guards the dates in legal.json.
 *
 * The Privacy Policy promises, in its own "Changes to this Privacy Policy"
 * section, that "the updated version will be indicated by an updated Last
 * Updated date". On 21 Aug 2026 the AI clause and the bank-connection copy were
 * both rewritten and every date was left untouched — the document broke the
 * promise it makes about itself, which is the FTA-relevant kind of stale.
 *
 * There were four dates or versions describing when the legal terms last
 * changed, and none of them agreed: top-level `version`, top-level
 * `effective_date`, the "Last Updated" line inside each document body, and the
 * separate version in finance-ai-dashboard legal/nz/legal_contents.json.
 *
 * Run: node --test scripts/legal-dates.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const legal = JSON.parse(readFileSync(join(root, 'legal.json'), 'utf8'));

/** Documents that are an agreement with the user, so must carry a date. */
const DATED_DOCS = ['terms_of_service', 'privacy_policy'];

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function lastUpdatedLine(key) {
  const lines = legal.documents[key].content.split('\n');
  return lines.find((line) => line.includes('Last Updated')) ?? null;
}

test('effective_date is an ISO date', () => {
  assert.match(legal.effective_date, /^\d{4}-\d{2}-\d{2}$/);
});

test('every agreement document carries a Last Updated line', () => {
  for (const key of DATED_DOCS) {
    assert.ok(lastUpdatedLine(key), `${key} has no Last Updated line`);
  }
});

test('every Last Updated line uses one date format', () => {
  // "21 August 2026", not "May 18, 2026". Two formats in one file reads as two
  // authors, and it was two authors.
  for (const key of DATED_DOCS) {
    assert.match(
      lastUpdatedLine(key),
      new RegExp(`^\\*\\*Last Updated:\\*\\* \\d{1,2} (${MONTHS.join('|')}) \\d{4}$`),
      `${key} does not use "D Month YYYY"`,
    );
  }
});

test('the rendered date agrees with effective_date', () => {
  // effective_date is not rendered anywhere, so nothing else catches it drifting
  // away from the line the reader actually sees.
  const [year, month, day] = legal.effective_date.split('-').map(Number);
  const expected = `**Last Updated:** ${day} ${MONTHS[month - 1]} ${year}`;
  for (const key of DATED_DOCS) {
    assert.equal(lastUpdatedLine(key), expected, `${key} date disagrees with effective_date`);
  }
});

test('both documents are stamped with the same date', () => {
  const dates = new Set(DATED_DOCS.map(lastUpdatedLine));
  assert.equal(dates.size, 1, 'documents in one file carry different Last Updated dates');
});
