import { z } from 'zod';

/** Sample payloads — strict enough to catch garbage; `.passthrough()` keeps unknown fields for forward compat */

const summaryCardSchema = z
    .object({
        label: z.string(),
        value: z.string(),
        icon: z.string().optional(),
        color: z.string().optional(),
        sublabel: z.string().optional()
    })
    .passthrough();

export const weeklyPayloadSchema = z
    .object({
        meta: z
            .object({
                week_label: z.string().optional(),
                week_start: z.string().optional(),
                week_end: z.string().optional(),
                generated_at: z.string().optional()
            })
            .passthrough()
            .optional(),
        user: z.record(z.unknown()).optional(),
        summary: z.record(summaryCardSchema).optional(),
        goal_progress: z
            .object({
                target_monthly: z.number().optional(),
                achieved_monthly: z.number().optional(),
                percentage: z.number().optional(),
                status_label: z.string().optional()
            })
            .passthrough()
            .optional(),
        categories: z
            .array(
                z
                    .object({
                        id: z.string(),
                        name: z.string(),
                        emoji: z.string().optional(),
                        weekly_budget: z.string().optional(),
                        daily_allowance: z.string().optional(),
                        tip: z.string().optional(),
                        badge: z
                            .object({
                                label: z.string().optional(),
                                color: z.string().optional()
                            })
                            .passthrough()
                            .optional()
                    })
                    .passthrough()
            )
            .optional()
    })
    .passthrough();

export type WeeklyPayload = z.infer<typeof weeklyPayloadSchema>;

const cutRowSchema = z
    .object({
        original: z.number(),
        suggested: z.number(),
        cut_amount: z.number(),
        cut_pct: z.number(),
        impact_score: z.number()
    })
    .passthrough();

export const budgetPayloadSchema = z
    .object({
        meta: z
            .object({
                currency: z.string().optional(),
                period: z.string().optional(),
                generated_at: z.string().optional(),
                engine_version: z.string().optional()
            })
            .passthrough()
            .optional(),
        summary: z
            .object({
                monthly_income: z.number().optional(),
                current_savings: z.number().optional(),
                savings_goal: z.number().optional(),
                gap_to_close: z.number().optional(),
                status: z.string().optional(),
                total_savings_after_cuts: z.number().optional()
            })
            .passthrough()
            .optional(),
        cuts: z.record(cutRowSchema).optional(),
        coach_advice: z.string().optional()
    })
    .passthrough();

export type BudgetPayload = z.infer<typeof budgetPayloadSchema>;

export const dashboardSampleSchema = z
    .object({
        fidelity_mode: z
            .enum([
                'LSTM_FULL',
                'HYBRID_STANDARD',
                'LITE_MINIMUM',
                'RECEIPT_ONLY_INSIGHTS',
                'COLD_START_ONBOARDING',
                'NORMAL'
            ])
            .optional(),
        ai_status: z.string().optional(),
        anchor_period: z
            .object({
                start_date: z.string(),
                end_date: z.string()
            })
            .passthrough()
            .optional(),
        coverage: z
            .object({
                txn_months: z.number().optional(),
                receipt_months: z.number().optional()
            })
            .passthrough()
            .optional(),
        influence_hooks: z
            .object({
                unlock_percentage: z.number().optional(),
                cta_label: z.string().optional(),
                cta_href: z.string().optional(),
                message: z.string().optional()
            })
            .passthrough()
            .optional(),
        receipt_summary: z
            .object({
                scanned_count_previous_month: z.number().optional(),
                total_receipt_spend: z.number().optional(),
                projected_tax_deductions: z.number().optional()
            })
            .passthrough()
            .optional(),
        expansion_prompt: z
            .object({
                title: z.string().optional(),
                message: z.string().optional(),
                cta_label: z.string().optional(),
                cta_href: z.string().optional()
            })
            .passthrough()
            .optional(),
        onboarding_flows: z
            .array(
                z
                    .object({
                        id: z.string(),
                        title: z.string(),
                        description: z.string().optional(),
                        cta_href: z.string().optional()
                    })
                    .passthrough()
            )
            .optional(),
        forecast: z
            .object({
                future_dates: z.array(z.string()),
                future: z.array(z.number())
            })
            .passthrough()
            .optional(),
        monthly: z
            .object({
                predicted_expense: z.number().optional(),
                historical_avg_expense: z.number().optional(),
                predicted_income: z.number().optional(),
                predicted_savings: z.number().optional(),
                historical_avg_income: z.number().optional(),
                discretionary_spend: z.number().optional(),
                top_categories: z
                    .array(
                        z.object({
                            category: z.string(),
                            amount: z.number()
                        })
                    )
                    .optional()
            })
            .passthrough()
            .optional(),
        explanations: z.array(z.string()).optional(),
        risk: z
            .object({
                level: z.string().optional(),
                score: z.number().optional(),
                explanation: z.array(z.string()).optional(),
                flags: z.array(z.string()).optional()
            })
            .passthrough()
            .optional(),
        recommendations: z
            .array(
                z
                    .object({
                        title: z.string().optional(),
                        severity: z.string().optional(),
                        description: z.string().optional()
                    })
                    .passthrough()
            )
            .optional()
    })
    .passthrough();

export type DashboardSample = z.infer<typeof dashboardSampleSchema>;

export function parseSample<T>(label: string, schema: z.ZodType<T>, data: unknown): T {
    const r = schema.safeParse(data);
    if (!r.success) {
        const msg = r.error.issues.map((i) => `${i.path.join('.') || 'root'}: ${i.message}`).join('; ');
        throw new Error(`Invalid ${label} (${msg})`);
    }
    return r.data;
}
