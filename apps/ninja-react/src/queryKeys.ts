/** Strict array-based keys per `.cursor/guidelines.md` */
export const queryKeys = {
    samples: {
        all: ['samples'] as const,
        weeklyPlan: () => [...queryKeys.samples.all, 'weekly_plan'] as const,
        budgetPlan: () => [...queryKeys.samples.all, 'budget_plan'] as const,
        dashboard: () => [...queryKeys.samples.all, 'dashboard'] as const
    }
};
