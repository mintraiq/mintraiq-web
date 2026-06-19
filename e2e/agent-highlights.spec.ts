import { expect, test } from '@playwright/test';

const HARNESS = '/portal/e2e/agent-highlights-harness.html';

async function waitHarnessReady(page: import('@playwright/test').Page) {
    await page.waitForFunction(() => document.body.dataset.harnessReady === 'true', null, {
        timeout: 15_000
    });
}

test.describe('Agent item highlight panels', () => {
    test('milk fixture renders structured highlight rows', async ({ page }) => {
        await page.goto(`${HARNESS}?fixture=milk`);
        await waitHarnessReady(page);

        await expect(page.getByTestId('harness-mode')).toContainText('highlights=2');
        await expect(page.getByTestId('agent-highlights-panel')).toBeVisible();
        await expect(page.getByTestId('agent-highlight-row')).toHaveCount(2);
        await expect(page.getByTestId('agent-highlights-panel')).toContainText('Anchor Milk 2L');
        await expect(page.getByTestId('agent-highlights-panel')).toContainText('$8.58');
    });

    test('empty fixture shows no-match hint', async ({ page }) => {
        await page.goto(`${HARNESS}?fixture=empty`);
        await waitHarnessReady(page);

        await expect(page.getByTestId('agent-highlights-empty')).toBeVisible();
        await expect(page.getByTestId('agent-highlight-row')).toHaveCount(0);
    });

    test('error fixture surfaces harness error', async ({ page }) => {
        await page.goto(`${HARNESS}?fixture=error`);
        await page.waitForFunction(() => document.body.dataset.harnessReady === 'error');

        await expect(page.getByTestId('harness-error')).toContainText('Simulated chat service failure');
    });
});
