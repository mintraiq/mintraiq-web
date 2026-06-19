import { useQuery } from '@tanstack/react-query';
import { fetchDashboardSample } from './api/samples';
import { ForecastAnalyticsSummary } from './components/ForecastAnalyticsSummary';
import { ForecastLoadingPlaceholder } from './components/ForecastLoadingPlaceholder';
import { useFinancialForecast } from './hooks/useFinancialForecast';
import { queryKeys } from './queryKeys';

/**
 * Dashboard analytics page: pulls the raw projection array from
 * GET /api/v1/forecasts/current and renders plain-English translations.
 * Mounted via <div id="ninja-react-root" data-ninja-page="dashboard-analytics">.
 */
export function ForecastAnalyticsApp(): JSX.Element {
    const forecast = useFinancialForecast();

    // Current-month context (income + live category spend) for the
    // safe-to-spend copy and trend alert comparisons.
    const dashboard = useQuery({
        queryKey: queryKeys.samples.dashboard(),
        queryFn: fetchDashboardSample
    });

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

    const monthly = dashboard.data?.monthly;
    const currentSpendByCategory = Object.fromEntries(
        (monthly?.top_categories ?? []).map((c) => [c.category, c.amount])
    );

    return (
        <ForecastAnalyticsSummary
            projections={forecast.projections}
            currentSpendByCategory={currentSpendByCategory}
            predictedIncome={monthly?.predicted_income}
        />
    );
}
