import { fetchSampleJson } from '../sample';
import {
    budgetPayloadSchema,
    dashboardSampleSchema,
    parseSample,
    weeklyPayloadSchema,
    type BudgetPayload,
    type DashboardSample,
    type WeeklyPayload
} from '../schemas/samples';

export async function fetchWeeklyPlanSample(): Promise<WeeklyPayload> {
    const raw = await fetchSampleJson('weekly_plan.json');
    return parseSample('weekly_plan.json', weeklyPayloadSchema, raw);
}

export async function fetchBudgetPlanSample(): Promise<BudgetPayload> {
    const raw = await fetchSampleJson('budget_plan.json');
    return parseSample('budget_plan.json', budgetPayloadSchema, raw);
}

export async function fetchDashboardSample(): Promise<DashboardSample> {
    const raw = await fetchSampleJson('dashboard.json');
    return parseSample('dashboard.json', dashboardSampleSchema, raw);
}
