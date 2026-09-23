/**
 * Guards what we may claim happens when a user recategorises a transaction.
 *
 * Until 22 Sep 2026 the Support page answered "A transaction is in the wrong
 * category. Can I fix it?" with "MintrAIQ will learn from the correction".
 * Tracing it end to end in production:
 *
 *   - POST /transactions/review (finance_api.py:3544) does persist the
 *     correction, and app/jobs/model_training_job.py does read it;
 *   - the Cloud Scheduler job `dashboard-model-training-month-end` is ENABLED
 *     in mintraiq-production and fires at month end;
 *   - but every run so far has declined to train. The last eligible run,
 *     30 Aug 2026, logged:
 *       Global model training result:
 *         {'trained': False, 'reason': 'labeled samples 19 < minimum 50'}
 *     against `global_model_min_labeled_samples: 50` (config.py:883).
 *
 * So no model has ever been improved by a user's correction. Claiming the
 * outcome is a representation about a service characteristic that was not true
 * when made — Fair Trading Act s 9. Claiming the *retention* is true, and is
 * what the Privacy Policy already says.
 *
 * This test fails if the outcome claim returns to either surface. When the
 * training floor is genuinely met and a model ships from user corrections,
 * delete this file — do not weaken it.
 *
 * Run: node --test scripts/categorisation-learning-copy.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const legal = JSON.parse(readFileSync(join(root, 'legal.json'), 'utf8'));

/** Both surfaces that describe what happens to a correction. */
const SURFACES = ['support', 'privacy_policy'];

function content(key) {
  const doc = legal.documents?.[key];
  // Fail loudly rather than skipping: a renamed key must not silently retire
  // this guard.
  assert.ok(doc, `legal.json has no documents.${key}`);
  assert.equal(typeof doc.content, 'string', `documents.${key}.content is not a string`);
  assert.ok(doc.content.length > 0, `documents.${key}.content is empty`);
  return doc.content;
}

/**
 * Phrasings that assert the model actually learns or improves. Retention
 * wording ("we keep the correction to help improve...") is deliberately not
 * matched: keeping the correction is true today.
 */
const OUTCOME_CLAIMS = [
  /will learn from/i,
  /learns from/i,
  /learn from (?:the|your|each|every) correction/i,
  /gets? better (?:each|every) time/i,
  /improves? (?:itself|over time|automatically)/i,
  /trains? (?:itself|on your)/i,
  /won'?t (?:make|repeat) that mistake again/i,
  /remembers? (?:it|that|your) (?:next time|for next time)/i,
];

test('the Support answer about a miscategorised transaction still exists', () => {
  // Anchors every assertion below: if this question is reworded away, this test
  // starts passing for the wrong reason.
  assert.match(
    content('support'),
    /A transaction is in the wrong category\. Can I fix it\?/,
    'the anchor Support question is gone — re-point this guard before deleting it',
  );
});

test('the Privacy Policy still describes correction retention', () => {
  assert.match(
    content('privacy_policy'),
    /When you correct how a transaction has been categorised/i,
    'the Privacy Policy retention sentence is gone — re-point this guard',
  );
});

test('neither surface claims the model learns from corrections', () => {
  for (const key of SURFACES) {
    const text = content(key);
    for (const pattern of OUTCOME_CLAIMS) {
      assert.doesNotMatch(
        text,
        pattern,
        `documents.${key} claims the model learns from corrections (${pattern}). ` +
          'No model has ever been trained from user corrections — see this file’s header.',
      );
    }
  }
});

test('the Support answer claims retention, not learning', () => {
  assert.match(
    content('support'),
    /We keep the correction, in de-identified form, to help improve our categorisation model\./,
    'the Support answer no longer states what actually happens to a correction',
  );
});

test('the two surfaces agree that the correction is de-identified', () => {
  // The Privacy Policy promises the stored form is stripped of identifying
  // detail and not linked to the user. The Support page must not describe
  // something broader than that promise.
  assert.match(content('support'), /de-identified/i);
  assert.match(content('privacy_policy'), /normalised form of the transaction description/i);
});
