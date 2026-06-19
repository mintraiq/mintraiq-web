import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { fetchCurrentForecast } from '../api/forecasts';
import { queryKeys } from '../queryKeys';
import type { ForecastProjection } from '../schemas/forecasts';

/** NFR: only surface the skeleton once the fetch exceeds this latency budget. */
const SKELETON_DELAY_MS = 150;

export interface FinancialForecastState {
    projections: ForecastProjection[];
    isPending: boolean;
    /** Fetch settled successfully but the gateway returned 204 / empty array. */
    isEmpty: boolean;
    error: Error | null;
    /** True only while pending AND past the 150ms threshold (prevents flicker). */
    showSkeleton: boolean;
}

export function useFinancialForecast(): FinancialForecastState {
    const { data, error, isPending } = useQuery({
        queryKey: queryKeys.forecasts.current(),
        queryFn: fetchCurrentForecast
    });

    const [skeletonGateOpen, setSkeletonGateOpen] = useState(false);

    useEffect(() => {
        if (!isPending) {
            setSkeletonGateOpen(false);
            return;
        }
        const timer = window.setTimeout(() => setSkeletonGateOpen(true), SKELETON_DELAY_MS);
        return () => window.clearTimeout(timer);
    }, [isPending]);

    const projections = data ?? [];

    return {
        projections,
        isPending,
        isEmpty: !isPending && !error && projections.length === 0,
        error: error ? (error as Error) : null,
        showSkeleton: isPending && skeletonGateOpen
    };
}
