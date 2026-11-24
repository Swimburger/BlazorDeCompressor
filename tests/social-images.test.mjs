import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { socialCardFormats } from "../scripts/social-card-formats.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

for (const format of socialCardFormats) {
  test(`${format.slug} social image is a dedicated 1200x630 PNG`, async () => {
    const image = await readFile(path.join(repositoryRoot, "wwwroot", "assets", "social", `${format.slug}.png`));
    assert.deepEqual([...image.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
    assert.equal(image.readUInt32BE(16), 1200);
    assert.equal(image.readUInt32BE(20), 630);
    assert.ok(image.length > 20_000, "social card should contain rendered artwork");
    assert.ok(image.length < 1_000_000, "social card should remain practical for sharing crawlers");
  });
}

test("every social image is visually distinct", async () => {
  const images = await Promise.all(socialCardFormats.map(({ slug }) =>
    readFile(path.join(repositoryRoot, "wwwroot", "assets", "social", `${slug}.png`))));
  assert.equal(new Set(images.map(image => image.toString("base64"))).size, socialCardFormats.length);
});
