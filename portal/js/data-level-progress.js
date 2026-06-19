/** Hybrid engine unlocks at 6 months; full LSTM forecast needs 12. */
export const HYBRID_UNLOCK_MONTHS = 6;
export const FULL_FORECAST_MONTHS = 12;

/**
 * Bucket fill on upload/home — progress toward hybrid unlock only (< 6 months).
 * @param {number} txnMonths
 */
export function dataLevelForBucket(txnMonths) {
    const months = Math.max(0, Number(txnMonths) || 0);
    const capped = Math.min(months, HYBRID_UNLOCK_MONTHS);
    const fillPercent = Math.min(
        100,
        Math.max(0, Math.round((capped / HYBRID_UNLOCK_MONTHS) * 100))
    );
    return {
        txnMonths: months,
        hybridTargetMonths: HYBRID_UNLOCK_MONTHS,
        fullTargetMonths: FULL_FORECAST_MONTHS,
        fillPercent,
        remainingToHybridPercent: Math.max(0, 100 - fillPercent),
        isHybridReady: months >= HYBRID_UNLOCK_MONTHS,
        isFullForecastReady: months >= FULL_FORECAST_MONTHS
    };
}

/** @deprecated use dataLevelForBucket */
export function dataLevelFromTxnMonths(txnMonths) {
    const level = dataLevelForBucket(txnMonths);
    return {
        txnMonths: level.txnMonths,
        targetMonths: level.hybridTargetMonths,
        fillPercent: level.fillPercent,
        remainingPercent: level.remainingToHybridPercent,
        isFull: level.isHybridReady
    };
}

/**
 * @param {number} txnMonths
 */
export function shouldShowHungryMintrBucket(txnMonths) {
    return dataLevelForBucket(txnMonths).txnMonths < HYBRID_UNLOCK_MONTHS;
}

/**
 * @param {number} txnMonths
 */
export function needsTwelveMonthReminder(txnMonths) {
    const months = Math.max(0, Number(txnMonths) || 0);
    return months >= HYBRID_UNLOCK_MONTHS && months < FULL_FORECAST_MONTHS;
}

/**
 * @param {number} txnMonths
 */
export function hungryMintrMessage(txnMonths) {
    const level = dataLevelForBucket(txnMonths);
    if (level.txnMonths <= 0) {
        return 'Mintr is hungry — upload a statement to start filling the bucket.';
    }
    if (level.isHybridReady) {
        const remaining = FULL_FORECAST_MONTHS - level.txnMonths;
        return `Hybrid forecast is live. Upload ${remaining} more month${remaining === 1 ? '' : 's'} for the full 12-month AI forecast.`;
    }
    return `Still ${level.remainingToHybridPercent}% more to unlock hybrid forecasting.`;
}

/**
 * @param {number} txnMonths
 */
export function buildTwelveMonthReminderNudge(txnMonths) {
    const months = Math.max(0, Number(txnMonths) || 0);
    const remaining = Math.max(0, FULL_FORECAST_MONTHS - months);
    return {
        id: 'twelve-month-history-reminder',
        title: 'Unlock full 12-month forecast',
        message: `You have ${months} month${months === 1 ? '' : 's'} of statements. Upload ${remaining} more for Mintr's deepest AI forecast.`,
        href: './upload-statement.html',
        icon: 'fa-lightbulb'
    };
}

/**
 * @param {Record<string, unknown> | null | undefined} bootstrap
 */
export function txnMonthsFromBootstrap(bootstrap) {
    const fidelity = bootstrap?.fidelity;
    if (fidelity && typeof fidelity === 'object') {
        const n = Number(/** @type {{ txn_months?: number }} */ (fidelity).txn_months);
        if (Number.isFinite(n)) return n;
    }
    return 0;
}
