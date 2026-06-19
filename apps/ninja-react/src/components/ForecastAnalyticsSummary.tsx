import type { ForecastProjection } from '../schemas/forecasts';

/**
 * Distills the raw projection array into plain-English financial translations
 * (FORECASTING_WEB_UI_SPEC.md §2): a Safe-to-Spend tracker, trend alert bars,
 * and a per-category outlook list.
 */
export interface ForecastAnalyticsSummaryProps {
    projections: ForecastProjection[];
    /** Live spend this month, keyed by category (case-insensitive match). */
    currentSpendByCategory?: Record<string, number>;
    /** Predicted monthly income, when known (drives the safe-to-spend copy). */
    predictedIncome?: number;
}

const WEEKS_PER_MONTH = 4.345;

function money(value: number): string {
    return value.toLocaleString('en-NZ', {
        style: 'currency',
        currency: 'NZD',
        maximumFractionDigits: 0
    });
}

function findSpend(
    spend: Record<string, number> | undefined,
    category: string
): number | undefined {
    if (!spend) return undefined;
    const hit = Object.keys(spend).find(
        (key) => key.trim().toLowerCase() === category.trim().toLowerCase()
    );
    return hit === undefined ? undefined : spend[hit];
}

interface TrendAlert {
    category: string;
    overBy: number;
}

export function ForecastAnalyticsSummary({
    projections,
    currentSpendByCategory,
    predictedIncome
}: ForecastAnalyticsSummaryProps): JSX.Element {
    const totalPredicted = projections.reduce((sum, p) => sum + p.predicted_amount, 0);

    const safeWeekly =
        predictedIncome !== undefined
            ? Math.max(0, (predictedIncome - totalPredicted) / WEEKS_PER_MONTH)
            : undefined;

    const trendAlerts: TrendAlert[] = projections
        .map((p) => {
            const spend = findSpend(currentSpendByCategory, p.category);
            if (spend === undefined || spend <= p.predicted_amount) return null;
            return { category: p.category, overBy: spend - p.predicted_amount };
        })
        .filter((a): a is TrendAlert => a !== null)
        .sort((a, b) => b.overBy - a.overBy);

    return (
        <div className="ninja-forecast-analytics">
            {/* Safe to Spend Tracker */}
            <div className="card metric-card" style={{ marginBottom: 16 }}>
                <div className="card-header">
                    <span className="card-title">Safe to spend</span>
                </div>
                {safeWeekly !== undefined ? (
                    <>
                        <div className="value">{money(safeWeekly)}</div>
                        <p style={{ color: 'var(--text-secondary)', margin: '6px 0 0', fontSize: '0.92rem' }}>
                            Based on your usual bills, you have {money(safeWeekly)} left to spend
                            safely this week.
                        </p>
                    </>
                ) : (
                    <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
                        Your usual bills add up to about {money(totalPredicted)} a month. Connect
                        income tracking to see your weekly safe-to-spend amount.
                    </p>
                )}
            </div>

            {/* Trend Alerts */}
            {trendAlerts.map((alert) => (
                <div
                    key={alert.category}
                    className="card"
                    role="alert"
                    style={{
                        marginBottom: 12,
                        borderColor: 'rgba(255,177,66,0.55)',
                        borderLeft: '4px solid var(--accent-orange, #ffb142)'
                    }}
                >
                    <strong>Heads up:</strong>{' '}
                    <span style={{ color: 'var(--text-secondary)' }}>
                        You are trending to spend {money(alert.overBy)} more on {alert.category}{' '}
                        this month than usual.
                    </span>
                </div>
            ))}

            {/* Per-category outlook */}
            <div className="card" style={{ marginTop: 16 }}>
                <div className="card-header">
                    <span className="card-title">This month&apos;s outlook by category</span>
                </div>
                <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                    {projections.map((p) => (
                        <li
                            key={p.category}
                            style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                gap: 12,
                                padding: '10px 0',
                                borderBottom: '1px solid rgba(255,255,255,0.06)'
                            }}
                        >
                            <span>{p.category}</span>
                            <span style={{ color: 'var(--text-secondary)', textAlign: 'right' }}>
                                Usually between {money(p.lower_bound)} and {money(p.upper_bound)} —
                                expecting about {money(p.predicted_amount)}
                            </span>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
}

export default ForecastAnalyticsSummary;
