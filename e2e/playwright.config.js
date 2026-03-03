// @ts-check
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  use: {
    baseURL: 'https://localhost:5001',
    ignoreHTTPSErrors: true,
  },
});
