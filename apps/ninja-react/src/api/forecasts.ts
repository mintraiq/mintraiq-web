import { fetchSampleJson } from '../sample';
import {
    forecastProjectionArraySchema,
    type ForecastProjection
} from '../schemas/forecasts';

/**
 * Auth bridge installed by the host portal page
 * (portal/js/forecast-analytics-boot.js) before ninja-ui.js loads.
 * Keeps Logto out of the embed bundle: the portal owns the session.
 */
interface ForecastAuthBridge {
    financeApiBase: string;
    getAccessToken: () => Promise<string>;
}

declare global {
    interface Window {
        __MINTRAIQ_FORECAST_BRIDGE__?: ForecastAuthBridge;
    }
}

function getAuthBridge(): ForecastAuthBridge | null {
    const bridge = window.__MINTRAIQ_FORECAST_BRIDGE__;
    return bridge && typeof bridge.getAccessToken === 'function' ? bridge : null;
}

/**
 * Fetches the current per-category forecast projection array.
 * - 204 No Content → resolves to [] so the UI drives its empty state.
 * - Without an auth bridge (dev harness), falls back to docs/samples.
 */
export async function fetchCurrentForecast(): Promise<ForecastProjection[]> {
    const bridge = getAuthBridge();
    if (!bridge) {
        const raw = await fetchSampleJson('forecast-projections.json');
        return forecastProjectionArraySchema.parse(raw);
    }

    const token = await bridge.getAccessToken();
    const base = bridge.financeApiBase.replace(/\/$/, '');
    const res = await fetch(`${base}/v1/forecasts/current`, {
        cache: 'no-store',
        headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${token}`
        }
    });

    if (res.status === 204) return [];
    if (!res.ok) {
        throw new Error(`Forecast request failed (${res.status})`);
    }
    return forecastProjectionArraySchema.parse(await res.json());
}
