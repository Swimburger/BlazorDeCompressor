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

// Round-trip correctness tests — one per format.
// Each test compresses a file, decompresses the output, and asserts the content is identical.
// Non-gzip formats navigate to *.localhost:5001, which resolves to 127.0.0.1 on macOS and
// modern Linux (systemd-resolved) automatically — no /etc/hosts entries required.
const roundTripFormats = [
  { name: 'gzip',    ext: '.gz',      url: 'https://localhost:5001' },
  { name: 'brotli',  ext: '.br',      url: 'https://brotli.localhost:5001' },
  { name: 'deflate', ext: '.deflate', url: 'https://deflate.localhost:5001' },
  { name: 'zlib',    ext: '.zlib',    url: 'https://zlib.localhost:5001' },
  { name: 'zstd',    ext: '.zst',     url: 'https://zstd.localhost:5001' },
];

for (const fmt of roundTripFormats) {
  test(`${fmt.name} round-trip: compress then decompress preserves content`, async ({ page }) => {
    const content = `Hello from the ${fmt.name} round-trip test!`;
    const inputFile     = path.join(os.tmpdir(), `roundtrip-${fmt.name}-in.txt`);
    const compressedFile = path.join(os.tmpdir(), `roundtrip-${fmt.name}-in.txt${fmt.ext}`);
    fs.writeFileSync(inputFile, content);

    try {
      // Force anchor-download path so waitForEvent('download') works reliably.
      // File System Access API behaviour is covered by file-system-api.spec.js.
      await page.addInitScript(() => {
        window.showSaveFilePicker = async () => null;
        window.showDirectoryPicker = async () => null;
      });
      await page.goto(fmt.url);
      await page.waitForSelector('.spinner-border', { state: 'hidden', timeout: 30000 });

      // Compress
      const compressDownloadPromise = page.waitForEvent('download');
      await page.locator('input[type="file"]').setInputFiles(inputFile);
      await page.getByRole('button', { name: 'Compress Files' }).click();
      const compressedDownload = await compressDownloadPromise;
      expect(compressedDownload.suggestedFilename()).toBe(`roundtrip-${fmt.name}-in.txt${fmt.ext}`);
      await compressedDownload.saveAs(compressedFile);
      await expect(page.getByText('✔ Finished')).toBeVisible({ timeout: 10000 });

      // Switch to decompress mode
      await page.locator('label[for="radio-decompress"]').click();

      // Decompress
      const decompressDownloadPromise = page.waitForEvent('download');
      await page.locator('input[type="file"]').setInputFiles(compressedFile);
      await page.getByRole('button', { name: 'Decompress Files' }).click();
      const decompressedDownload = await decompressDownloadPromise;
      expect(decompressedDownload.suggestedFilename()).toBe(`roundtrip-${fmt.name}-in.txt`);
      const decompressedPath = await decompressedDownload.path();
      expect(fs.readFileSync(decompressedPath, 'utf-8')).toBe(content);
    } finally {
      if (fs.existsSync(inputFile))      fs.unlinkSync(inputFile);
      if (fs.existsSync(compressedFile)) fs.unlinkSync(compressedFile);
    }
  });
}

test('SmallestSize compression produces output <= Fastest, and round-trips correctly', async ({ page }) => {
  const content = 'A'.repeat(100000);
  const inputFile = path.join(os.tmpdir(), 'level-test-input.txt');
  fs.writeFileSync(inputFile, content);

  const smallestFile = path.join(os.tmpdir(), 'level-test-input.txt.gz');

  try {
    // Compress at SmallestSize
    await page.locator('label[for="radio-smallest"]').click();
    let downloadPromise = page.waitForEvent('download');
    await page.locator('input[type="file"]').setInputFiles(inputFile);
    await page.getByRole('button', { name: 'Compress Files' }).click();
    const smallestDownload = await downloadPromise;
    await smallestDownload.saveAs(smallestFile);
    await expect(page.getByText('✔ Finished')).toBeVisible({ timeout: 10000 });
    const smallestSize = fs.statSync(smallestFile).size;

    // Compress at Fastest (re-select file to reset list)
    await page.locator('label[for="radio-fastest"]').click();
    downloadPromise = page.waitForEvent('download');
    await page.locator('input[type="file"]').setInputFiles(inputFile);
    await page.getByRole('button', { name: 'Compress Files' }).click();
    const fastestDownload = await downloadPromise;
    const fastestPath = await fastestDownload.path();
    await expect(page.getByText('✔ Finished')).toBeVisible({ timeout: 10000 });
    const fastestSize = fs.statSync(fastestPath).size;

    expect(smallestSize).toBeLessThanOrEqual(fastestSize);

    // Decompress the SmallestSize output and verify round-trip
    await page.locator('label[for="radio-decompress"]').click();
    downloadPromise = page.waitForEvent('download');
    await page.locator('input[type="file"]').setInputFiles(smallestFile);
    await page.getByRole('button', { name: 'Decompress Files' }).click();
    const decompressedDownload = await downloadPromise;
    const decompressedPath = await decompressedDownload.path();
    await expect(page.getByText('✔ Finished')).toBeVisible({ timeout: 10000 });
    expect(fs.readFileSync(decompressedPath, 'utf-8')).toBe(content);
  } finally {
    if (fs.existsSync(inputFile))   fs.unlinkSync(inputFile);
    if (fs.existsSync(smallestFile)) fs.unlinkSync(smallestFile);
  }
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

    test(`favicons point to ${format} assets`, async ({ page }) => {
      const icon32 = await page.locator('link[rel="icon"][sizes="32x32"]').getAttribute('href');
      const icon16 = await page.locator('link[rel="icon"][sizes="16x16"]').getAttribute('href');
      const touch  = await page.locator('link[rel="apple-touch-icon"][sizes="180x180"]').getAttribute('href');
      expect(icon32).toContain(`/assets/${format}/`);
      expect(icon16).toContain(`/assets/${format}/`);
      expect(touch).toContain(`/assets/${format}/`);
    });

    test(`manifest points to ${format} manifest`, async ({ page }) => {
      const manifest = await page.locator('link[rel="manifest"]').getAttribute('href');
      expect(manifest).toBe(`manifest-${format}.json`);
    });
  });
}
