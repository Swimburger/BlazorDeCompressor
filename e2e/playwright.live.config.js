// @ts-check
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './live-tests',
  outputDir: './test-results/live',
  timeout: 60000,
  reporter: process.env.CI
    ? [['failures'], ['html', { outputFolder: 'playwright-report/live', open: 'never' }]]
    : [['list'], ['html', { outputFolder: 'playwright-report/live', open: 'never' }]],
  use: {
    trace: 'retain-on-failure',
  },
});
