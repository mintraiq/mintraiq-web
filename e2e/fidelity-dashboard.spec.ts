import { expect, test } from '@playwright/test';

const HARNESS = '/portal/e2e/fidelity-harness.html';

async function waitHarnessReady(page: import('@playwright/test').Page) {
    await page.waitForFunction(() => document.body.dataset.harnessReady === 'true', null, {
        timeout: 15_000
    });
}

test.describe('Multi-fidelity dashboard layouts', () => {
    test('LITE_MINIMUM shows unlock CTA and hides full analytics cards', async ({ page }) => {
        await page.goto(`${HARNESS}?fixture=lite`);
        await waitHarnessReady(page);

        await expect(page.getByTestId('harness-mode')).toContainText('LITE_MINIMUM');
        await expect(page.locator('#liteForecastLock')).toBeVisible();
        await expect(page.locator('#liteUnlockPct')).toHaveText('50%');
        await expect(page.locator('#liteUnlockCta')).toContainText('Drop Statement PDF');
        await expect(page.locator('#liteAvgExpense')).toContainText('$2,841');

        const incomeCard = page.locator('.card.metric-card.income[data-fidelity-view="full"]');
        await expect(incomeCard).toHaveAttribute('hidden', '');
    });

    test('RECEIPT_ONLY_INSIGHTS shows receipt ledger and bank banner', async ({ page }) => {
        await page.goto(`${HARNESS}?fixture=receipt`);
        await waitHarnessReady(page);

        await expect(page.getByTestId('harness-mode')).toContainText('RECEIPT_ONLY_INSIGHTS');
        await expect(page.locator('#receiptScanCount')).toHaveText('18');
        await expect(page.locator('#receiptTotalSpend')).toContainText('$1,240.5');
        await expect(page.locator('#receiptTaxDeductions')).toContainText('$310.13');
        await expect(page.locator('#receiptBankBanner')).toBeVisible();
        await expect(page.locator('[data-receipt-banner-title]')).toContainText('Pair receipts');
    });

    test('HYBRID_STANDARD full layout shows income metrics and charts', async ({ page }) => {
        await page.goto(`${HARNESS}?fixture=full`);
        await waitHarnessReady(page);

        await expect(page.getByTestId('harness-mode')).toContainText('HYBRID_STANDARD');
        await expect(page.locator('#current_income')).toContainText('$9200');
        await expect(page.locator('#current_expense')).toContainText('$7100');
        await expect(page.locator('#liteForecastLock')).toHaveAttribute('hidden', '');
        await expect(page.locator('#receiptBankBanner')).toHaveAttribute('hidden', '');
        await expect(page.locator('#trendChart')).toBeVisible();
        await expect(page.locator('#recommendationList li')).toHaveCount(1);
    });

    test('COLD_START_ONBOARDING shows onboarding flow actions', async ({ page }) => {
        await page.goto(`${HARNESS}?fixture=cold`);
        await waitHarnessReady(page);

        await expect(page.getByTestId('harness-mode')).toContainText('COLD_START_ONBOARDING');
        await expect(page.locator('#coldStartFlows a')).toHaveCount(2);
        await expect(page.locator('#coldStartFlows')).toContainText('Upload statement');
        await expect(page.locator('#coldStartFlows')).toContainText('Scan a receipt');
        await expect(page.locator('#dashboardRecommendationsCard')).toHaveAttribute('hidden', '');
        await expect(page.locator('#receiptBankBanner')).toHaveAttribute('hidden', '');
        await expect(page.locator('.card.metric-card.income[data-fidelity-view="full"]')).toHaveAttribute(
            'hidden',
            ''
        );
    });

    test('harness surfaces load errors for unknown fixture', async ({ page }) => {
        await page.goto(`${HARNESS}?fixture=unknown`);
        await page.waitForFunction(() => document.body.dataset.harnessReady === 'error');
        await expect(page.getByTestId('harness-error')).toContainText('Unknown fixture');
    });

    test('all fidelity fixtures load without harness error', async ({ page }) => {
        for (const fixture of ['lite', 'receipt', 'full', 'cold'] as const) {
            await page.goto(`${HARNESS}?fixture=${fixture}`);
            await waitHarnessReady(page);
            await expect(page.getByTestId('harness-error')).toBeHidden();
            await expect(page.getByTestId('harness-mode')).toContainText(fixture);
        }
    });
});
