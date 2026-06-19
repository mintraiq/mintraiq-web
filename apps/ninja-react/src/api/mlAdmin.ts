import {
    mlAccessSchema,
    mlRegistryResponseSchema,
    mlTrainResponseSchema,
    type MlRegistryResponse,
    type MlTrainResponse
} from '../schemas/mlAdmin';

interface MlAdminBridge {
    financeApiBase: string;
    getAccessToken: () => Promise<string>;
}

declare global {
    interface Window {
        __MINTRAIQ_ML_ADMIN_BRIDGE__?: MlAdminBridge;
    }
}

function getBridge(): MlAdminBridge | null {
    const bridge = window.__MINTRAIQ_ML_ADMIN_BRIDGE__;
    return bridge && typeof bridge.getAccessToken === 'function' ? bridge : null;
}

async function adminFetch<T>(path: string, init?: RequestInit): Promise<T> {
    const bridge = getBridge();
    if (!bridge) {
        throw new Error('ML admin auth bridge is not configured');
    }
    const token = await bridge.getAccessToken();
    const base = bridge.financeApiBase.replace(/\/$/, '');
    const res = await fetch(`${base}${path}`, {
        ...init,
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
            ...(init?.headers || {})
        }
    });
    if (!res.ok) {
        const detail = await res.text();
        throw new Error(detail || `Request failed (${res.status})`);
    }
    return res.json() as Promise<T>;
}

export async function fetchMlAdminAccess(): Promise<{ allowed: boolean; required_roles: string[] }> {
    const data = await adminFetch('/v1/admin/ml/access');
    return mlAccessSchema.parse(data);
}

export async function fetchMlRegistry(): Promise<MlRegistryResponse> {
    const data = await adminFetch('/v1/admin/ml/models');
    return mlRegistryResponseSchema.parse(data);
}

export async function triggerMlTraining(modelId: string, force: boolean): Promise<MlTrainResponse> {
    const data = await adminFetch(`/v1/admin/ml/models/${encodeURIComponent(modelId)}/train`, {
        method: 'POST',
        body: JSON.stringify({ force })
    });
    return mlTrainResponseSchema.parse(data);
}

export async function triggerMlEvaluation(modelId: string): Promise<Record<string, unknown>> {
    return adminFetch(`/v1/admin/ml/models/${encodeURIComponent(modelId)}/evaluate`, {
        method: 'POST',
        body: JSON.stringify({})
    });
}
