// @ts-check
const { defineConfig, devices } = require('@playwright/test');
const path = require('path');

const rootDir = __dirname;
const repoRoot = path.join(rootDir, '..');

module.exports = defineConfig({
    testDir: rootDir,
    testMatch: '**/*.spec.ts',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 1 : 0,
    workers: process.env.CI ? 1 : undefined,
    reporter: [['list'], ['html', { open: 'never', outputFolder: path.join(rootDir, 'report') }]],
    use: {
        baseURL: 'http://127.0.0.1:4173',
        trace: 'on-first-retry',
        screenshot: 'only-on-failure'
    },
    projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
    webServer: {
        command: 'python3 -m http.server 4173',
        cwd: repoRoot,
        url: 'http://127.0.0.1:4173',
        reuseExistingServer: !process.env.CI,
        timeout: 120_000
    }
});
