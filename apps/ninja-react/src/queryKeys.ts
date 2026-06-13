/** Strict array-based keys per `.cursor/guidelines.md` */
export const queryKeys = {
    samples: {
        all: ['samples'] as const,
        weeklyPlan: () => [...queryKeys.samples.all, 'weekly_plan'] as const,
        budgetPlan: () => [...queryKeys.samples.all, 'budget_plan'] as const,
        dashboard: () => [...queryKeys.samples.all, 'dashboard'] as const
    },
    forecasts: {
        all: ['forecasts'] as const,
        current: () => [...queryKeys.forecasts.all, 'current'] as const
    }
};
