// @ts-check
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  outputDir: './test-results/development',
  reporter: process.env.CI
    ? [['failures'], ['html', { outputFolder: 'playwright-report/development', open: 'never' }]]
    : [['list'], ['html', { outputFolder: 'playwright-report/development', open: 'never' }]],
  use: {
    baseURL: 'https://localhost:5001',
    ignoreHTTPSErrors: true,
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'dotnet run --no-build --configuration Release --project .. --urls https://localhost:5001',
    url: 'https://localhost:5001',
    timeout: 30000,
    reuseExistingServer: false,
    ignoreHTTPSErrors: true,
  },
});
