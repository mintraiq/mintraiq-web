import { expect, test } from '@playwright/test';

import { ANDROID_URL, IOS_URL, findViolations } from '../scripts/social-copy-rules.mjs';

/**
 * The link-in-bio page.
 *
 * Instagram captions cannot carry a clickable link, so for every Instagram post
 * this page is the *only* route to the app. That makes its failure mode quiet
 * and expensive: a wrong store URL still looks like a working button, and the
 * campaign reports traffic while sending nobody to the listing.
 *
 * So the assertions below are mostly about the hrefs being exactly right, and
 * about them staying in step with the URLs the captions promise.
 *
 * Note this exercises `/go.html` rather than `/go`. The pretty path is a Vercel
 * rewrite, and the e2e harness serves the repo root with `python3 -m http.server`,
 * which knows nothing about `vercel.json`. The rewrite is verified on a preview
 * deploy, not here.
 */
const GO = '/go.html';

test.describe('Link-in-bio landing page', () => {
    test('offers exactly the three routes a post promises', async ({ page }) => {
        await page.goto(GO);

        const actions = page.locator('.go-actions .go-btn');
        await expect(actions).toHaveCount(3);
        await expect(actions.nth(0)).toHaveText(/iPhone/);
        await expect(actions.nth(1)).toHaveText(/Android/);
        await expect(actions.nth(2)).toHaveText(/mintraiq\.com/);
    });

    test('points at the live store listings, exactly', async ({ page }) => {
        await page.goto(GO);

        // Pinned to the full URL, not a substring. A transposed App Store ID
        // resolves to a different app and nothing on the page looks broken.
        await expect(page.locator(`a[href="${IOS_URL}"]`)).toHaveCount(1);
        await expect(page.locator(`a[href="${ANDROID_URL}"]`)).toHaveCount(1);
    });

    test('store links are plain anchors, so they survive an in-app browser', async ({ page }) => {
        await page.goto(GO);

        // Instagram and Facebook open links in their own webview. A button that
        // needs JavaScript to navigate is the thing that breaks there.
        for (const url of [IOS_URL, ANDROID_URL]) {
            const link = page.locator(`a[href="${url}"]`);
            await expect(link).toBeVisible();
            expect(await link.evaluate((el) => el.tagName)).toBe('A');
        }
    });

    test('the page makes no claim the social copy guard would reject', async ({ page }) => {
        await page.goto(GO);

        // This page is marketing copy reached from an ad, so the same claims
        // gate applies to it as to the captions that point here.
        const visibleText = await page.locator('body').innerText();
        expect(visibleText.length).toBeGreaterThan(0);
        expect(findViolations(visibleText)).toEqual([]);
    });

    test('keeps the legal routes reachable from an ad landing', async ({ page }) => {
        await page.goto(GO);

        const footer = page.locator('.legal-footer');
        await expect(footer.locator('a[href="terms.html"]')).toBeVisible();
        await expect(footer.locator('a[href="privacy.html"]')).toBeVisible();
        await expect(footer.locator('a[href="contact.html"]')).toBeVisible();
    });
});
