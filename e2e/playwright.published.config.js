// @ts-check
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './published-tests',
  outputDir: './test-results/published',
  reporter: process.env.CI
    ? [['failures'], ['html', { outputFolder: 'playwright-report/published', open: 'never' }]]
    : [['list'], ['html', { outputFolder: 'playwright-report/published', open: 'never' }]],
  use: {
    baseURL: 'http://localhost:5002',
    serviceWorkers: 'allow',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'node serve-published.js',
    url: 'http://localhost:5002',
    timeout: 10000,
    reuseExistingServer: false,
  },
});
