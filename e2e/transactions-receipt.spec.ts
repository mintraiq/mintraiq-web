import { expect, test } from '@playwright/test';

const HARNESS = '/portal/e2e/transactions-harness.html';

async function waitHarnessReady(page: import('@playwright/test').Page) {
    await page.waitForFunction(() => document.body.dataset.harnessReady === 'true', null, {
        timeout: 15_000
    });
}

test.describe('Transactions receipt drill-down', () => {
    test('linked fixture shows receipt badge and line-item breakdown', async ({ page }) => {
        await page.goto(`${HARNESS}?fixture=linked`);
        await waitHarnessReady(page);

        await expect(page.getByTestId('harness-mode')).toContainText('fixture=linked');
        await expect(page.getByTestId('tx-receipt-badge')).toHaveCount(1);

        await page.locator('tr[data-id="tx-linked-grocery"]').click();
        await expect(page.getByTestId('tx-expanded-card')).toBeVisible();
        await expect(page.getByTestId('tx-receipt-btn')).toBeVisible();

        await page.getByTestId('tx-receipt-btn').click();
        await expect(page.getByTestId('receipt-breakdown-panel')).toBeVisible();
        await expect(page.getByTestId('receipt-line-item')).toHaveCount(3);
        await expect(page.getByTestId('receipt-breakdown-panel')).toContainText('Anchor Milk 2L');
    });

    test('empty fixture renders empty state without receipt controls', async ({ page }) => {
        await page.goto(`${HARNESS}?fixture=empty`);
        await waitHarnessReady(page);

        await expect(page.getByTestId('tx-empty-state')).toContainText('No transactions returned');
        await expect(page.getByTestId('tx-receipt-badge')).toHaveCount(0);
    });

    test('error fixture surfaces tx error card', async ({ page }) => {
        await page.goto(`${HARNESS}?fixture=error`);
        await page.waitForFunction(() => document.body.dataset.harnessReady === 'error');

        await expect(page.getByTestId('harness-error')).toContainText('Simulated API failure');
        await expect(page.getByTestId('tx-error-card')).toBeVisible();
    });

    test('review and enquire modals open from expanded row', async ({ page }) => {
        await page.goto(`${HARNESS}?fixture=linked`);
        await waitHarnessReady(page);

        await page.locator('tr[data-id="tx-linked-grocery"]').click();
        await page.getByTestId('tx-review-btn').click();
        await expect(page.getByTestId('tx-review-panel')).toBeVisible();

        await page.getByTestId('tx-enquire-btn').click();
        await expect(page.getByTestId('tx-enquire-panel')).toBeVisible();
    });
});
