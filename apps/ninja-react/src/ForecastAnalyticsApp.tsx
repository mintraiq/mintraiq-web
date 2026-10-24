import { ForecastAnalyticsSummary } from './components/ForecastAnalyticsSummary';
import { ForecastLoadingPlaceholder } from './components/ForecastLoadingPlaceholder';
import { useFinancialForecast } from './hooks/useFinancialForecast';

/**
 * Dashboard analytics page: pulls the raw projection array from
 * GET /api/v1/forecasts/current and renders plain-English translations.
 * Mounted via <div id="ninja-react-root" data-ninja-page="dashboard-analytics">.
 */
export function ForecastAnalyticsApp(): JSX.Element {
    const forecast = useFinancialForecast();

    if (forecast.error) {
        return (
            <div className="card" style={{ padding: 20, borderColor: 'rgba(255,71,87,0.45)' }}>
                <strong>Could not load your forecast</strong>
                <p style={{ color: 'var(--text-secondary)', marginTop: 8 }}>
                    {forecast.error.message}
                </p>
            </div>
        );
    }

    if (forecast.isPending) {
        // Under the 150ms latency budget nothing is shown (no flicker);
        // past it the glass skeleton mirrors the final layout to block CLS.
        return forecast.showSkeleton ? (
            <ForecastLoadingPlaceholder variant="full-dashboard" />
        ) : (
            <div style={{ minHeight: 420 }} aria-hidden="true" />
        );
    }

    if (forecast.isEmpty) {
        return (
            <div className="card" style={{ padding: 20 }}>
                <strong>No forecast yet</strong>
                <p style={{ color: 'var(--text-secondary)', marginTop: 8 }}>
                    Upload a bank statement and we&apos;ll build your first spending forecast
                    overnight.
                </p>
                <a className="btn" href="./upload-statement.html">
                    Upload a statement
                </a>
            </div>
        );
    }

    return (
        // No live current-month spend is available here, so trend alerts stay
        // off: comparing a live projection with sample spend would invent them.
        <ForecastAnalyticsSummary projections={forecast.projections} />
    );
}
