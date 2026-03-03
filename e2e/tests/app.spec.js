// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const os = require('os');

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  // Wait for Blazor WASM to finish loading
  await page.waitForSelector('.spinner-border', { state: 'hidden', timeout: 30000 });
});

test('page title and heading', async ({ page }) => {
  await expect(page).toHaveTitle(/GZIP/i);
  await expect(page.getByRole('heading', { name: /Online GZIP de\/compressor/i })).toBeVisible();
});

test('compress mode is selected by default', async ({ page }) => {
  await expect(page.locator('#radio-compress')).toBeChecked();
  await expect(page.locator('#radio-decompress')).not.toBeChecked();
});

test('all four compression levels are shown in compress mode', async ({ page }) => {
  await expect(page.locator('#radio-smallest')).toBeVisible();
  await expect(page.locator('#radio-optimal')).toBeVisible();
  await expect(page.locator('#radio-fastest')).toBeVisible();
  await expect(page.locator('#radio-no-compression')).toBeVisible();
  await expect(page.locator('#radio-optimal')).toBeChecked();
});

test('compress button is disabled with no files selected', async ({ page }) => {
  await expect(page.getByRole('button', { name: 'Compress Files' })).toBeDisabled();
  await expect(page.getByText('No files selected')).toBeVisible();
});

test('compression level options are hidden in decompress mode', async ({ page }) => {
  await page.locator('label[for="radio-decompress"]').click();
  await expect(page.locator('#radio-optimal')).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Decompress Files' })).toBeDisabled();
});

test('compress a file end-to-end', async ({ page }) => {
  // Create a temp file to compress
  const tmpFile = path.join(os.tmpdir(), 'test-input.txt');
  fs.writeFileSync(tmpFile, 'Hello, GZIP!');

  const downloadPromise = page.waitForEvent('download');
  await page.locator('input[type="file"]').setInputFiles(tmpFile);
  await page.getByRole('button', { name: 'Compress Files' }).click();

  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('test-input.txt.gz');

  await expect(page.getByText('✔ Finished')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('.list-group-item .text-muted')).toBeVisible();
  await expect(page.locator('.list-group-item .badge').filter({ hasText: /smaller|larger/ })).toBeVisible();

  fs.unlinkSync(tmpFile);
});

test('decompress a file end-to-end', async ({ page }) => {
  // Create a real gzip file to decompress
  const { execSync } = require('child_process');
  const tmpDir = os.tmpdir();
  const srcFile = path.join(tmpDir, 'test-decompress.txt');
  const gzFile = path.join(tmpDir, 'test-decompress.txt.gz');
  fs.writeFileSync(srcFile, 'Hello, GZIP decompressed!');
  execSync(`gzip -kf ${srcFile}`);

  await page.locator('label[for="radio-decompress"]').click();

  const downloadPromise = page.waitForEvent('download');
  await page.locator('input[type="file"]').setInputFiles(gzFile);
  await page.getByRole('button', { name: 'Decompress Files' }).click();

  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('test-decompress.txt');

  await expect(page.getByText('✔ Finished')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('.list-group-item .text-muted')).toBeVisible();

  fs.unlinkSync(srcFile);
  fs.unlinkSync(gzFile);
});

// Static content (heading, title, meta, paragraph) is driven by the inline JS in index.html,
// which reads window.compressionFormat. We spoof it here via addInitScript.
// Blazor component behaviour (labels, file extension) uses NavigationManager and requires
// a real hostname match, so those paths are covered by manual / deployment testing.
const formatDisplayNames = { zstd: 'Zstandard' };
for (const format of ['brotli', 'deflate', 'zlib', 'zstd']) {
  const displayName = formatDisplayNames[format] || format;
  test.describe(`${format} mode`, () => {
    test.beforeEach(async ({ page }) => {
      await page.addInitScript((f) => { window.compressionFormat = f; }, format);
      await page.goto('/');
      await page.waitForSelector('.spinner-border', { state: 'hidden', timeout: 30000 });
    });

    test(`page title and heading reflect ${format}`, async ({ page }) => {
      await expect(page).toHaveTitle(new RegExp(displayName, 'i'));
      await expect(page.getByRole('heading', { name: new RegExp(`Online ${displayName} de/compressor`, 'i') })).toBeVisible();
    });

    test(`intro paragraph mentions ${format}`, async ({ page }) => {
      await expect(page.locator('#intro-paragraph')).toContainText(new RegExp(displayName, 'i'));
    });
  });
}
