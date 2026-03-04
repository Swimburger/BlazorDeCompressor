// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { gzipSync, gunzipSync } = require('zlib');

// Injected before page load: replaces browser File System Access APIs with in-memory mocks.
// Each write lands in window.__mockSavedFiles[filename] as a plain number array (JSON-serializable).
const mockFilePickerScript = () => {
    window.__mockSavedFiles = {};
    const createWritable = (name) => {
        const chunks = [];
        return {
            write: async (data) => chunks.push(data),
            close: async () => {
                const total = chunks.reduce((s, c) => s + c.byteLength, 0);
                const buf = new Uint8Array(total);
                let off = 0;
                for (const c of chunks) { buf.set(new Uint8Array(c), off); off += c.byteLength; }
                window.__mockSavedFiles[name] = Array.from(buf);
            },
        };
    };
    window.showSaveFilePicker = async ({ suggestedName }) => ({
        createWritable: async () => createWritable(suggestedName),
    });
    window.showDirectoryPicker = async () => ({
        getFileHandle: async (name) => ({
            createWritable: async () => createWritable(name),
        }),
    });
};

// Injected before page load: makes both picker APIs return null so the app falls back to
// anchor download, regardless of what the real browser supports.
const disableFilePickerScript = () => {
    window.showSaveFilePicker = async () => null;
    window.showDirectoryPicker = async () => null;
};

async function loadPage(page) {
    await page.goto('/');
    await page.waitForSelector('.spinner-border', { state: 'hidden', timeout: 30000 });
}

test.describe('File System Access API', () => {
    test.beforeEach(async ({ page }) => {
        await page.addInitScript(mockFilePickerScript);
        await loadPage(page);
    });

    test('single file compress uses showSaveFilePicker and writes correct bytes', async ({ page }) => {
        const content = 'Hello, File System API!';
        const tmpFile = path.join(os.tmpdir(), 'fsa-compress-single.txt');
        fs.writeFileSync(tmpFile, content);
        try {
            let downloadFired = false;
            page.on('download', () => { downloadFired = true; });

            await page.locator('input[type="file"]').setInputFiles(tmpFile);
            await page.getByRole('button', { name: 'Compress Files' }).click();
            await expect(page.getByText('✔ Finished')).toBeVisible({ timeout: 10000 });

            expect(downloadFired).toBe(false);
            const bytes = await page.evaluate(() => window.__mockSavedFiles['fsa-compress-single.txt.gz']);
            expect(bytes).toBeTruthy();
            expect(gunzipSync(Buffer.from(bytes)).toString()).toBe(content);
        } finally {
            fs.unlinkSync(tmpFile);
        }
    });

    test('single file decompress uses showSaveFilePicker and writes correct bytes', async ({ page }) => {
        const content = 'Hello, decompressed via File System API!';
        const tmpFile = path.join(os.tmpdir(), 'fsa-decompress-single.txt.gz');
        fs.writeFileSync(tmpFile, gzipSync(Buffer.from(content)));
        try {
            let downloadFired = false;
            page.on('download', () => { downloadFired = true; });

            await page.locator('label[for="radio-decompress"]').click();
            await page.locator('input[type="file"]').setInputFiles(tmpFile);
            await page.getByRole('button', { name: 'Decompress Files' }).click();
            await expect(page.getByText('✔ Finished')).toBeVisible({ timeout: 10000 });

            expect(downloadFired).toBe(false);
            const bytes = await page.evaluate(() => window.__mockSavedFiles['fsa-decompress-single.txt']);
            expect(bytes).toBeTruthy();
            expect(Buffer.from(bytes).toString()).toBe(content);
        } finally {
            fs.unlinkSync(tmpFile);
        }
    });

    test('multiple files compress uses showDirectoryPicker and writes correct bytes', async ({ page }) => {
        const inputs = [
            { name: 'fsa-multi-a.txt', content: 'Alpha content' },
            { name: 'fsa-multi-b.txt', content: 'Beta content' },
        ];
        const tmpPaths = inputs.map(({ name, content }) => {
            const p = path.join(os.tmpdir(), name);
            fs.writeFileSync(p, content);
            return p;
        });
        try {
            let downloadFired = false;
            page.on('download', () => { downloadFired = true; });

            await page.locator('input[type="file"]').setInputFiles(tmpPaths);
            await page.getByRole('button', { name: 'Compress Files' }).click();
            await expect(page.getByText('✔ Finished')).toHaveCount(2, { timeout: 10000 });

            expect(downloadFired).toBe(false);
            const saved = await page.evaluate(() => window.__mockSavedFiles);
            for (const { name, content } of inputs) {
                const bytes = saved[`${name}.gz`];
                expect(bytes).toBeTruthy();
                expect(gunzipSync(Buffer.from(bytes)).toString()).toBe(content);
            }
        } finally {
            tmpPaths.forEach(p => fs.existsSync(p) && fs.unlinkSync(p));
        }
    });
});

test.describe('File System Access API fallback', () => {
    test.beforeEach(async ({ page }) => {
        await page.addInitScript(disableFilePickerScript);
        await loadPage(page);
    });

    test('single file compress falls back to anchor download', async ({ page }) => {
        const tmpFile = path.join(os.tmpdir(), 'fallback-compress.txt');
        fs.writeFileSync(tmpFile, 'Fallback compress content');
        try {
            const downloadPromise = page.waitForEvent('download');
            await page.locator('input[type="file"]').setInputFiles(tmpFile);
            await page.getByRole('button', { name: 'Compress Files' }).click();
            const download = await downloadPromise;
            expect(download.suggestedFilename()).toBe('fallback-compress.txt.gz');
            await expect(page.getByText('✔ Finished')).toBeVisible({ timeout: 10000 });
        } finally {
            fs.unlinkSync(tmpFile);
        }
    });

    test('single file decompress falls back to anchor download', async ({ page }) => {
        const tmpFile = path.join(os.tmpdir(), 'fallback-decompress.txt.gz');
        fs.writeFileSync(tmpFile, gzipSync(Buffer.from('Fallback decompress content')));
        try {
            await page.locator('label[for="radio-decompress"]').click();
            const downloadPromise = page.waitForEvent('download');
            await page.locator('input[type="file"]').setInputFiles(tmpFile);
            await page.getByRole('button', { name: 'Decompress Files' }).click();
            const download = await downloadPromise;
            expect(download.suggestedFilename()).toBe('fallback-decompress.txt');
            await expect(page.getByText('✔ Finished')).toBeVisible({ timeout: 10000 });
        } finally {
            fs.unlinkSync(tmpFile);
        }
    });

    test('multiple files compress falls back to anchor download', async ({ page }) => {
        const inputs = [
            { name: 'fallback-multi-a.txt', content: 'Fallback alpha' },
            { name: 'fallback-multi-b.txt', content: 'Fallback beta' },
        ];
        const tmpPaths = inputs.map(({ name, content }) => {
            const p = path.join(os.tmpdir(), name);
            fs.writeFileSync(p, content);
            return p;
        });
        try {
            const downloads = [];
            page.on('download', d => downloads.push(d));

            await page.locator('input[type="file"]').setInputFiles(tmpPaths);
            await page.getByRole('button', { name: 'Compress Files' }).click();
            await expect(page.getByText('✔ Finished')).toHaveCount(2, { timeout: 10000 });

            expect(downloads.length).toBe(2);
            const names = downloads.map(d => d.suggestedFilename()).sort();
            expect(names).toEqual(['fallback-multi-a.txt.gz', 'fallback-multi-b.txt.gz']);
        } finally {
            tmpPaths.forEach(p => fs.existsSync(p) && fs.unlinkSync(p));
        }
    });
});
