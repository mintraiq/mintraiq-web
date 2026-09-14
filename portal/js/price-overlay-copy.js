/**
 * Copy for the national-average line on the product price chart.
 *
 * WHY THIS IS A MODULE AND NOT INLINE STRINGS: every string here is a factual
 * claim about someone else's data, and one of them is a licence condition.
 *
 *  1. The line used to be labelled "National CPI". It is not the CPI — it is the
 *     Stats NZ Food Price Index weighted-average retail price for one item, a
 *     dollar figure rather than an index. Under the Fair Trading Act 1986
 *     ss 9/10/13 the test is the impression created on a reasonable NZ consumer.
 *     Founder decision 2026-09-08: name the index.
 *
 *  2. The caption carries the month the data is FOR. It used to carry none,
 *     while the chart drew a single September 2023 figure across 2026 months.
 *
 *  3. STATS_NZ_ATTRIBUTION is prescribed wording, not a choice. Stats NZ content
 *     is CC BY 4.0 and stats.govt.nz/about-us/copyright specifies the sentence
 *     to use when their data is included in a collection — which is what this
 *     chart does. Attribution uses the words "Stats NZ", never their logo.
 *
 * Pinned verbatim to finance-ai-mobile/lib/productPriceCopy.ts by
 * scripts/price-overlay-copy.test.mjs. Describing one thing two ways across
 * repos is itself an FTA problem.
 */

export const CPI_LEGEND_LABEL = 'Stats NZ food price index avg';

export const CPI_SOURCE_NAME = 'Stats NZ food price index';

export const STATS_NZ_ATTRIBUTION =
    "This work is based on Stats NZ's data which are licensed by Stats NZ for reuse " +
    'under the Creative Commons Attribution 4.0 International licence.';

export const NO_BASELINE_NOTE = 'No Stats NZ food price index series for this item and unit.';

const MONTH_NAMES = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
];

/** "2026-07" -> "July 2026". NZ house format, never US. Null if unparseable. */
export function formatBaselineMonth(period) {
    if (typeof period !== 'string' || !/^\d{4}-\d{2}$/.test(period)) return null;
    const month = Number(period.slice(5, 7));
    if (month < 1 || month > 12) return null;
    return `${MONTH_NAMES[month - 1]} ${period.slice(0, 4)}`;
}

export function overlayCaption(productName, period) {
    const month = formatBaselineMonth(period);
    return [`${CPI_SOURCE_NAME} average`, productName || null, month ? `to ${month}` : null]
        .filter(Boolean)
        .join(' · ');
}
