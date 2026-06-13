import { expect, test } from '@playwright/test';

const HARNESS = '/portal/e2e/modal-states-harness.html';

async function waitHarnessReady(page: import('@playwright/test').Page) {
    await page.waitForFunction(() => document.body.dataset.harnessReady === 'true', null, {
        timeout: 15_000
    });
}

test.describe('Error cards and interaction modals', () => {
    test('load-error state shows dashboard error card', async ({ page }) => {
        await page.goto(`${HARNESS}?state=load-error`);
        await waitHarnessReady(page);

        await expect(page.getByTestId('state-error-card')).toBeVisible();
        await expect(page.getByTestId('state-error-card')).toContainText('503');
        await expect(page.getByTestId('state-modal')).toBeHidden();
    });

    test('error-modal state shows review failure dialog', async ({ page }) => {
        await page.goto(`${HARNESS}?state=error-modal`);
        await waitHarnessReady(page);

        await expect(page.getByTestId('state-modal')).toBeVisible();
        await expect(page.getByTestId('state-modal')).toContainText('Review could not be saved');
        await expect(page.getByTestId('state-modal')).toContainText('422');
    });

    test('review-modal dismisses on confirm', async ({ page }) => {
        await page.goto(`${HARNESS}?state=review-modal`);
        await waitHarnessReady(page);

        await expect(page.getByTestId('state-modal')).toContainText('Review transaction');
        await page.getByTestId('state-modal-confirm').click();
        await expect(page.getByTestId('state-modal')).toBeHidden();
    });

    test('enquire-modal dismisses on dismiss button', async ({ page }) => {
        await page.goto(`${HARNESS}?state=enquire-modal`);
        await waitHarnessReady(page);

        await expect(page.getByTestId('state-modal')).toContainText('Transaction enrichment');
        await page.getByTestId('state-modal-dismiss').click();
        await expect(page.getByTestId('state-modal')).toBeHidden();
    });

    test('unknown state surfaces harness error', async ({ page }) => {
        await page.goto(`${HARNESS}?state=unknown`);
        await page.waitForFunction(() => document.body.dataset.harnessReady === 'error');

        await expect(page.getByTestId('harness-error')).toContainText('Unknown state');
    });
});
