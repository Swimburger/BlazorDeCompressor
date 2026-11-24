// @ts-check
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

async function waitForBlazor(page) {
  await page.waitForSelector('.spinner-border', { state: 'hidden', timeout: 30000 });
}

test('published PWA installs and reloads while offline', async ({ page, context }) => {
  await page.goto('/');
  await waitForBlazor(page);
  await page.evaluate(() => navigator.serviceWorker.ready);

  if (!await page.evaluate(() => Boolean(navigator.serviceWorker.controller))) {
    await page.reload();
    await waitForBlazor(page);
  }

  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await waitForBlazor(page);
  await expect(page.getByRole('heading', { name: /Online GZIP de\/compressor/i })).toBeVisible();
});

test('gzip PWA cache excludes lazy-loaded Zstandard assemblies', async ({ page }) => {
  await page.goto('/');
  await waitForBlazor(page);
  await page.evaluate(() => navigator.serviceWorker.ready);

  const cachedUrls = await page.evaluate(async () => {
    const names = await caches.keys();
    const urls = [];
    for (const name of names) {
      urls.push(...(await (await caches.open(name)).keys()).map(request => request.url));
    }
    return urls;
  });

  expect(cachedUrls.some(url => url.includes('ZstdSharp.'))).toBe(false);
  expect(cachedUrls.some(url => url.includes('BlazorDeCompressor.Zstd.'))).toBe(false);
});

test('Zstandard host loads and caches its lazy assemblies', async ({ page }) => {
  const responses = [];
  page.on('response', response => responses.push(response.url()));

  await page.goto('http://zstd.localhost:5002');
  await waitForBlazor(page);
  await page.evaluate(() => navigator.serviceWorker.ready);

  expect(responses.some(url => url.includes('ZstdSharp.'))).toBe(true);
  expect(responses.some(url => url.includes('BlazorDeCompressor.Zstd.'))).toBe(true);

  const cachedUrls = await page.evaluate(async () => {
    const names = await caches.keys();
    const urls = [];
    for (const name of names) {
      urls.push(...(await (await caches.open(name)).keys()).map(request => request.url));
    }
    return urls;
  });
  expect(cachedUrls.some(url => url.includes('ZstdSharp.'))).toBe(true);
  expect(cachedUrls.some(url => url.includes('BlazorDeCompressor.Zstd.'))).toBe(true);
});

test('published cache and security headers match hosting policy', async ({ request }) => {
  const index = await request.get('http://localhost:5002/');
  expect(index.headers()['x-content-type-options']).toBe('nosniff');
  expect(index.headers()['referrer-policy']).toBe('strict-origin-when-cross-origin');
  expect(index.headers()['content-security-policy']).toBe("base-uri 'self'; object-src 'none'; frame-ancestors 'none'");
  expect(index.headers()['permissions-policy']).toContain('camera=()');
  expect(index.headers()['x-frame-options']).toBe('DENY');

  const robots = await request.get('http://localhost:5002/robots.txt');
  expect(robots.headers()['content-type']).toContain('text/plain');
  expect(await robots.text()).toBe('User-agent: *\nAllow: /\n');

  const socialImage = await request.get('http://localhost:5002/SocialImage.png');
  expect(socialImage.headers()['content-type']).toContain('image/png');

  const serviceWorker = await request.get('http://localhost:5002/service-worker.js');
  expect(serviceWorker.headers()['cache-control']).toBe('no-cache');

  const assetsManifest = await request.get('http://localhost:5002/service-worker-assets.js');
  expect(assetsManifest.headers()['cache-control']).toBe('no-cache');

  const compressedFrameworkAsset = fs.readdirSync(path.resolve(__dirname, '../../dist/wwwroot/_framework'))
    .find(file => file.endsWith('.wasm.br'));
  expect(compressedFrameworkAsset).toBeTruthy();
  const frameworkAsset = compressedFrameworkAsset.slice(0, -3);
  const compressedResponse = await request.get(`http://localhost:5002/_framework/${frameworkAsset}`, {
    headers: { 'Accept-Encoding': 'br, gzip' },
  });
  expect(compressedResponse.headers()['content-encoding']).toBe('br');
  expect(compressedResponse.headers()['vary']).toContain('Accept-Encoding');
});
