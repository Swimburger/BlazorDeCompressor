// @ts-check
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const os = require('os');
const path = require('path');

const formats = [
  { name: 'gzip', ext: '.gz', url: 'https://gzip.swimburger.net' },
  { name: 'brotli', ext: '.br', url: 'https://brotli.swimburger.net' },
  { name: 'deflate', ext: '.deflate', url: 'https://deflate.swimburger.net' },
  { name: 'zlib', ext: '.zlib', url: 'https://zlib.swimburger.net' },
  { name: 'zstd', ext: '.zst', url: 'https://zstd.swimburger.net' },
];

for (const format of formats) {
  test(`${format.name} production round-trip preserves content`, async ({ page }) => {
    const content = `Live ${format.name} round-trip ${Date.now()}`;
    const inputPath = path.join(os.tmpdir(), `live-${format.name}.txt`);
    const compressedPath = `${inputPath}${format.ext}`;
    fs.writeFileSync(inputPath, content);

    try {
      await page.addInitScript(() => {
        window.showSaveFilePicker = async () => null;
        window.showDirectoryPicker = async () => null;
      });
      await page.goto(format.url);
      await page.waitForSelector('.spinner-border', { state: 'hidden', timeout: 30000 });

      let downloadPromise = page.waitForEvent('download');
      await page.locator('input[type="file"]').setInputFiles(inputPath);
      await page.getByRole('button', { name: 'Compress Files' }).click();
      const compressed = await downloadPromise;
      await compressed.saveAs(compressedPath);

      await page.locator('label[for="radio-decompress"]').click();
      downloadPromise = page.waitForEvent('download');
      await page.locator('input[type="file"]').setInputFiles(compressedPath);
      await page.getByRole('button', { name: 'Decompress Files' }).click();
      const decompressed = await downloadPromise;
      expect(fs.readFileSync(await decompressed.path(), 'utf8')).toBe(content);
    } finally {
      if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
      if (fs.existsSync(compressedPath)) fs.unlinkSync(compressedPath);
    }
  });
}

test('production caching, lazy loading, Zaraz, and Web Analytics are active', async ({ page, request }) => {
  const requestedUrls = [];
  page.on('request', req => requestedUrls.push(req.url()));

  const response = await page.goto('https://gzip.swimburger.net');
  expect(response).not.toBeNull();
  expect(response.headers()['cf-cache-status']).toBeTruthy();
  await page.waitForSelector('.spinner-border', { state: 'hidden', timeout: 30000 });

  const frameworkUrl = await page.evaluate(() => performance.getEntriesByType('resource')
    .map(entry => entry.name)
    .find(url => url.includes('/_framework/') && url.endsWith('.wasm')));
  expect(frameworkUrl).toBeTruthy();
  const frameworkResponse = await request.get(frameworkUrl);
  expect(frameworkResponse.headers()['cache-control']).toContain('immutable');

  expect(requestedUrls.some(url => url.includes('ZstdSharp.'))).toBe(false);
  expect(requestedUrls.some(url => url.includes('BlazorDeCompressor.Zstd.'))).toBe(false);
  expect(requestedUrls.some(url => url.includes('/cdn-cgi/zaraz/'))).toBe(true);
  expect(requestedUrls.some(url => url.includes('/cdn-cgi/rum'))).toBe(true);

  const zstdRequests = [];
  page.on('request', req => zstdRequests.push(req.url()));
  await page.goto('https://zstd.swimburger.net');
  await page.waitForSelector('.spinner-border', { state: 'hidden', timeout: 30000 });
  expect(zstdRequests.some(url => url.includes('ZstdSharp.'))).toBe(true);
  expect(zstdRequests.some(url => url.includes('BlazorDeCompressor.Zstd.'))).toBe(true);
});
