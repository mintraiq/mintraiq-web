import { expect, test } from '@playwright/test';

const HARNESS = '/portal/e2e/pilot-banner-harness.html';

async function waitHarnessReady(page: import('@playwright/test').Page) {
    await page.waitForFunction(() => document.body.dataset.harnessReady === 'true', null, {
        timeout: 15_000
    });
}

test.describe('Pilot access window banner', () => {
    test('states the end date and what happens after', async ({ page }) => {
        await page.goto(`${HARNESS}?case=midway`);
        await waitHarnessReady(page);

        const banner = page.locator('#pilotWindowBanner');
        await expect(banner).toBeVisible();
        await expect(banner.locator('.pilot-banner__title')).toContainText('90 more days');
        await expect(banner.locator('.pilot-banner__body')).toContainText('10 November 2026');
        // The two facts that keep this from reading as a bait-and-switch.
        await expect(banner.locator('.pilot-banner__body')).toContainText('your data stays');
        await expect(banner.locator('.pilot-banner__body')).toContainText('nothing is charged');
    });

    test('the final day reads as singular, not "1 days"', async ({ page }) => {
        await page.goto(`${HARNESS}?case=lastday`);
        await waitHarnessReady(page);

        await expect(page.locator('.pilot-banner__title')).toHaveText('Full access for 1 more day');
    });

    test('the last day says "ends today" rather than zero days', async ({ page }) => {
        await page.goto(`${HARNESS}?case=today`);
        await waitHarnessReady(page);

        await expect(page.locator('.pilot-banner__title')).toHaveText('Your full access ends today');
    });

    test('a lapsed grant never renders a negative countdown', async ({ page }) => {
        await page.goto(`${HARNESS}?case=expired`);
        await waitHarnessReady(page);

        const title = page.locator('.pilot-banner__title');
        await expect(title).toHaveText('Your full access ends today');
        await expect(title).not.toContainText('-');
    });

    test('a user with no pilot sees no banner at all', async ({ page }) => {
        await page.goto(`${HARNESS}?case=none`);
        await waitHarnessReady(page);

        await expect(page.locator('#pilotWindowBanner')).toBeHidden();
        expect(await page.evaluate(() => document.body.dataset.bannerShown)).toBe('false');
    });

    test('a malformed date hides the banner instead of showing "Invalid Date"', async ({
        page
    }) => {
        await page.goto(`${HARNESS}?case=bad`);
        await waitHarnessReady(page);

        await expect(page.locator('#pilotWindowBanner')).toBeHidden();
    });
});
