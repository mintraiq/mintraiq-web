import { z } from 'zod';

/**
 * One per-category projection row served raw by
 * GET {financeApiBase}/v1/forecasts/current (FORECASTING_GATEWAY_SPEC.md).
 */
export const forecastProjectionSchema = z.object({
    category: z.string(),
    predicted_amount: z.number(),
    lower_bound: z.number(),
    upper_bound: z.number()
});

export const forecastProjectionArraySchema = z.array(forecastProjectionSchema);

export type ForecastProjection = z.infer<typeof forecastProjectionSchema>;
