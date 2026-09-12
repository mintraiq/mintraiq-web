/**
 * Guard on the commercial-email consent copy.
 *
 * This wording is a Privacy Act 2020 IPP3 notice and the consent element
 * required by the Unsolicited Electronic Messages Act 2007. The assertions
 * below are the wording contract: an edit that drops a required statement, or
 * slips in a claim we cannot keep, fails here rather than after it has been
 * sent to thousands of inboxes.
 *
 * **These assertions are deliberately the same set as
 * `finance-ai-mobile/__tests__/marketingConsent.test.ts`.** The two repos each
 * hold their own copy of the strings — mintraiq-web cannot import from the
 * mobile repo — so what is enforced here is not byte-equality but that neither
 * platform can start making a claim the other does not. The honest limit: the
 * two files could still drift in phrasing while both passing. What they cannot
 * do is diverge on any claim either test names.
 *
 * Run: npm run test:consent-copy   (also part of npm run test:legal-suite)
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
    MARKETING_CONSENT_BODY,
    MARKETING_CONSENT_DECLINE_NOTE,
    MARKETING_CONSENT_LABEL,
    MARKETING_CONSENT_SAVE_FAILED,
    MARKETING_CONSENT_SETTINGS_BODY,
    MARKETING_CONSENT_SETTINGS_LABEL
} from '../portal/js/marketing-consent.js';

const ALL = [
    MARKETING_CONSENT_LABEL,
    MARKETING_CONSENT_BODY,
    MARKETING_CONSENT_DECLINE_NOTE,
    MARKETING_CONSENT_SAVE_FAILED,
    MARKETING_CONSENT_SETTINGS_LABEL,
    MARKETING_CONSENT_SETTINGS_BODY
];

test('says what the emails are about, so the consent is informed', () => {
    assert.match(MARKETING_CONSENT_LABEL, /email/i);
    assert.match(MARKETING_CONSENT_LABEL, /account/i);
    assert.match(MARKETING_CONSENT_BODY, /updates|tips/i);
});

test('states how to withdraw consent, in both of the two ways it can be done', () => {
    // UEMA requires a functional unsubscribe. Naming Settings as well matters
    // because that is also the user's IPP6/IPP7 route to the stored record.
    assert.match(MARKETING_CONSENT_BODY, /unsubscribe/i);
    assert.match(MARKETING_CONSENT_BODY, /settings/i);
});

test('makes declining a real option by saying it costs nothing', () => {
    // Consent is not freely given if declining looks like it has a penalty.
    assert.match(MARKETING_CONSENT_DECLINE_NOTE, /won't affect your account/i);
    assert.match(MARKETING_CONSENT_DECLINE_NOTE, /security|billing/i);
});

test('distinguishes these emails from the ones that arrive either way', () => {
    assert.match(MARKETING_CONSENT_SETTINGS_BODY, /does not affect/i);
    assert.match(MARKETING_CONSENT_SETTINGS_BODY, /security|billing/i);
});

test('keeps its frequency promise vague enough to keep', () => {
    // "A few times a year at most" is a claim under the Fair Trading Act. A
    // number the programme cannot honour would be a misrepresentation.
    assert.match(MARKETING_CONSENT_BODY, /occasional|a few times a year/i);
    assert.doesNotMatch(MARKETING_CONSENT_BODY, /\b(daily|weekly|every week|every month)\b/i);
});

test('never names a third party the Privacy Policy has not named', () => {
    // Brevo is the sender and is not yet a named sub-processor in legal.json.
    // When the batched legal PR names it, this is the assertion to revisit —
    // deliberately, not by someone quietly adding a word.
    for (const copy of ALL) {
        assert.doesNotMatch(copy, /brevo|sendinblue/i);
    }
});

test('never implies bank aggregation, which does not exist', () => {
    for (const copy of ALL) {
        assert.doesNotMatch(copy, /\b(bank feed|connect your bank|open banking|akahu|bank sync)\b/i);
    }
});

test('makes no claim about the user that would read as a score', () => {
    for (const copy of ALL) {
        assert.doesNotMatch(copy, /\b(score|rating|grade|credit)\b/i);
    }
});

test('promises a Settings screen only because one exists', () => {
    assert.match(MARKETING_CONSENT_SAVE_FAILED, /settings/i);
    assert.ok(MARKETING_CONSENT_SETTINGS_LABEL.length > 0);
});

test('does not present a failed save as a recorded preference', () => {
    assert.match(MARKETING_CONSENT_SAVE_FAILED, /couldn't save|could not save/i);
});

test('no default lead API host is guessed in config', async () => {
    // A wrong host would receive the user's Supabase access token. Empty is the
    // safe default; the URL is set per-deployment at build time.
    const { getLeadApiBase } = await import('../portal/js/marketing-consent.js');
    assert.equal(getLeadApiBase(), '');
});
