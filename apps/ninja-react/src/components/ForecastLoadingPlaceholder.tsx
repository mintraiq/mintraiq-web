import type { ReactNode } from 'react';

/**
 * <ForecastLoadingPlaceholder /> — self-contained glassmorphic skeleton.
 *
 * Mirrors the exact footprint of the forecast dashboard (metric card grid,
 * area-chart viewport, progress bars) so swapping it for real content causes
 * zero layout shift (CLS).
 *
 * Extensibility hook: pass `children` to replace the internal shimmer blocks
 * (e.g. rotating financial tips in a later sprint) — the glass frame and
 * dimensions stay identical, so no chart layout file needs editing.
 */
export interface ForecastLoadingPlaceholderProps {
    /** Which footprint to mirror. Defaults to the full dashboard layout. */
    variant?: 'full-dashboard' | 'chart-only' | 'metric-row';
    /** Optional replacement content rendered inside the glass frame. */
    children?: ReactNode;
}

const GLASS_FRAME =
    'rounded-xl border border-white/15 bg-white/10 backdrop-blur-md shadow-lg';

function ShimmerBlock({ className }: { className: string }) {
    return <div className={`animate-pulse rounded-md bg-white/20 ${className}`} aria-hidden="true" />;
}

function MetricCardWire() {
    return (
        <div className={`${GLASS_FRAME} flex-1 min-w-[150px] p-4`}>
            <ShimmerBlock className="h-3 w-24 mb-3" />
            <ShimmerBlock className="h-7 w-32" />
        </div>
    );
}

function MetricRowWire() {
    return (
        <div className="flex flex-wrap gap-4 mb-5">
            <MetricCardWire />
            <MetricCardWire />
            <MetricCardWire />
        </div>
    );
}

function ChartWire() {
    return (
        <div className={`${GLASS_FRAME} p-4 mb-5`}>
            <ShimmerBlock className="h-3 w-40 mb-4" />
            {/* Matches the 280px chart-container used by the live area graph */}
            <ShimmerBlock className="h-[280px] w-full" />
        </div>
    );
}

function ProgressBarsWire() {
    return (
        <div className={`${GLASS_FRAME} p-4`}>
            <ShimmerBlock className="h-3 w-36 mb-4" />
            <ShimmerBlock className="h-2.5 w-full mb-3" />
            <ShimmerBlock className="h-2.5 w-4/5 mb-3" />
            <ShimmerBlock className="h-2.5 w-3/5" />
        </div>
    );
}

export function ForecastLoadingPlaceholder({
    variant = 'full-dashboard',
    children
}: ForecastLoadingPlaceholderProps): JSX.Element {
    if (children) {
        return (
            <div
                className={`${GLASS_FRAME} p-4 min-h-[280px] flex items-center justify-center`}
                role="status"
                aria-label="Loading forecast"
            >
                {children}
            </div>
        );
    }

    return (
        <div role="status" aria-label="Loading forecast">
            {variant !== 'chart-only' && <MetricRowWire />}
            {variant !== 'metric-row' && <ChartWire />}
            {variant === 'full-dashboard' && <ProgressBarsWire />}
        </div>
    );
}

export default ForecastLoadingPlaceholder;
