/**
 * Guards the price-chart overlay copy on the web portal.
 *
 * WHY: the chart drew a single September 2023 Stats NZ figure across every month
 * of the user's window and labelled it "National CPI". Three things were wrong
 * with that label and all three are Fair Trading Act 1986 ss 9/10/13 exposure,
 * where the test is the impression created on a reasonable NZ consumer:
 *   1. It is not the CPI. It is the Food Price Index weighted-average retail
 *      price for one item — dollars, not an index.
 *   2. It carried no date, so three-year-old data read as current.
 *   3. It named no source, and Stats NZ data is CC BY 4.0 where attribution is
 *      a condition of use.
 *
 * WHY A TEST AND NOT A NOTE: the same overlay renders in finance-ai-mobile.
 * Describing one thing two ways across repos is itself an FTA problem, so the
 * strings below are pinned to finance-ai-mobile/lib/productPriceCopy.ts. If
 * either side is reworded this fails and the two are brought back into line
 * deliberately.
 *
 * Run: node --test scripts/price-overlay-copy.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const {
    CPI_LEGEND_LABEL,
    CPI_SOURCE_NAME,
    NO_BASELINE_NOTE,
    STATS_NZ_ATTRIBUTION,
    formatBaselineMonth,
    overlayCaption,
} = await import(new URL('../portal/js/price-overlay-copy.js', import.meta.url));

test('no surface calls the line a CPI figure', () => {
    const surfaces = [
        CPI_LEGEND_LABEL,
        CPI_SOURCE_NAME,
        NO_BASELINE_NOTE,
        overlayCaption('Tomatoes 1Kg', '2026-07'),
    ];
    for (const text of surfaces) {
        assert.equal(text.toLowerCase().includes('cpi'), false, text);
        assert.equal(text.toLowerCase().includes('consumers price'), false, text);
    }
});

test('every surface naming the source names the index', () => {
    assert.match(CPI_LEGEND_LABEL, /food price index/);
    assert.equal(CPI_SOURCE_NAME, 'Stats NZ food price index');
    assert.match(NO_BASELINE_NOTE, /Stats NZ food price index/);
});

test('the attribution is the wording Stats NZ prescribes for reuse in a collection', () => {
    // stats.govt.nz/about-us/copyright — specified, not chosen. "Stats NZ" in
    // words; their logo may not be used.
    assert.equal(
        STATS_NZ_ATTRIBUTION,
        "This work is based on Stats NZ's data which are licensed by Stats NZ for reuse " +
            'under the Creative Commons Attribution 4.0 International licence.',
    );
});

test('months render in NZ house format, never US', () => {
    assert.equal(formatBaselineMonth('2026-07'), 'July 2026');
    assert.equal(formatBaselineMonth('2026-01'), 'January 2026');
});

test('an absent or malformed period drops the date clause rather than inventing one', () => {
    assert.equal(formatBaselineMonth(undefined), null);
    assert.equal(formatBaselineMonth('2026-13'), null);
    assert.equal(formatBaselineMonth('07/2026'), null);
    assert.equal(overlayCaption('Tomatoes 1Kg', null), 'Stats NZ food price index average · Tomatoes 1Kg');
});

test('the caption carries the item and the month the data is for', () => {
    assert.equal(
        overlayCaption('Tomatoes 1Kg', '2026-07'),
        'Stats NZ food price index average · Tomatoes 1Kg · to July 2026',
    );
});

test('the strings are verbatim from finance-ai-mobile', () => {
    // Read as source: the mobile module is TypeScript and cannot be imported here.
    const mobile = join(
        root,
        '..',
        'NodeProjects',
        'finance-ai-mobile',
        'lib',
        'productPriceCopy.ts',
    );
    if (!existsSync(mobile)) {
        // The mobile repo is not always checked out beside this one; the pinned
        // literals above still hold the line on their own.
        return;
    }
    const src = readFileSync(mobile, 'utf8');
    for (const value of [CPI_LEGEND_LABEL, CPI_SOURCE_NAME, NO_BASELINE_NOTE]) {
        assert.ok(src.includes(value), `finance-ai-mobile no longer says: ${value}`);
    }
    assert.ok(
        src.includes("This work is based on Stats NZ's data which are licensed by Stats NZ for reuse"),
        'the attribution wording has diverged from finance-ai-mobile',
    );
});

test('no served portal file still labels the line National CPI', () => {
    for (const file of [
        'portal/js/product-analytics-page.js',
        'portal/product-analytics.html',
    ]) {
        const src = readFileSync(join(root, file), 'utf8');
        assert.equal(src.includes('National CPI'), false, `${file} still says "National CPI"`);
    }
});
