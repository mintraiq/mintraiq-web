import { expect, test } from '@playwright/test';

const HARNESS = '/portal/e2e/entitlement-error-harness.html';

async function waitHarnessReady(page: import('@playwright/test').Page) {
    await page.waitForFunction(() => document.body.dataset.harnessReady === 'true', null, {
        timeout: 15_000
    });
}

test.describe('Dashboard entitlement errors', () => {
    // The API sends `detail` as an object for entitlement failures. Reading only
    // the string form turned all of these into "Request failed (403)".
    test('UPGRADE_REQUIRED shows the plan state, not a generic error', async ({ page }) => {
        await page.goto(`${HARNESS}?case=upgrade`);
        await waitHarnessReady(page);

        await expect(page.getByTestId('harness-mode')).toContainText('UPGRADE_REQUIRED');
        await expect(page.locator('.grid-container h3')).toHaveText(
            'Your plan does not include this dashboard'
        );
        await expect(page.locator('.grid-container p')).toContainText(
            'Feature not available on current plan.'
        );
        await expect(page.locator('.grid-container a')).toHaveAttribute(
            'href',
            './settings-billing.html'
        );
    });

    test('LIMIT_EXCEEDED phrases the limit from the numbers, not the status line', async ({
        page
    }) => {
        // check_limit sends no `message` field — only limit_key/limit/usage.
        await page.goto(`${HARNESS}?case=limit`);
        await waitHarnessReady(page);

        await expect(page.locator('.grid-container h3')).toHaveText(
            "You have reached this month's limit"
        );
        await expect(page.locator('.grid-container p')).toContainText(
            'You have used 3 of your 3 statement uploads'
        );
        await expect(page.locator('.grid-container p')).not.toContainText('Request failed');
    });

    test('a plain string detail still reads through unchanged', async ({ page }) => {
        await page.goto(`${HARNESS}?case=plain`);
        await waitHarnessReady(page);

        await expect(page.locator('.grid-container h3')).toHaveText('Could not load dashboard');
        await expect(page.locator('.grid-container p')).toContainText(
            'start_date must precede end_date'
        );
    });

    test('a response with no detail falls back to the status line', async ({ page }) => {
        await page.goto(`${HARNESS}?case=server`);
        await waitHarnessReady(page);

        await expect(page.locator('.grid-container h3')).toHaveText('Could not load dashboard');
        await expect(page.locator('.grid-container p')).toContainText('Request failed (500)');
    });
});
