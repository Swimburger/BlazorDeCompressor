// @ts-check
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  use: {
    baseURL: 'https://localhost:5001',
    ignoreHTTPSErrors: true,
  },
  webServer: {
    command: 'dotnet run --no-build --project .. --urls https://localhost:5001',
    url: 'https://localhost:5001',
    timeout: 10000,
    reuseExistingServer: false,
    ignoreHTTPSErrors: true,
  },
});
