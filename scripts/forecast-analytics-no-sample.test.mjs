/**
 * The live forecast page must never read the sample dashboard file.
 *
 * WHY: ForecastAnalyticsApp used to fetch docs/samples/dashboard.json and compare
 * its category spend with the user's live forecast, so a trend alert such as
 * "You are trending to spend $X more on Groceries" could rest on a figure that
 * belongs to nobody. Same defect class as the sample income that fed Safe to
 * spend (P0 #92). An alert with no real spend behind it is omitted, not invented.
 *
 * Run: node --test scripts/forecast-analytics-no-sample.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(
    join(here, '..', 'apps', 'ninja-react', 'src', 'ForecastAnalyticsApp.tsx'),
    'utf8'
);

test('ForecastAnalyticsApp source was actually read', () => {
    assert.match(source, /export function ForecastAnalyticsApp/);
});

test('ForecastAnalyticsApp does not import or fetch sample data', () => {
    assert.doesNotMatch(source, /api\/samples|fetchDashboardSample|queryKeys\.samples/);
});

test('ForecastAnalyticsApp passes no spend map to the summary', () => {
    assert.doesNotMatch(source, /currentSpendByCategory/);
});
