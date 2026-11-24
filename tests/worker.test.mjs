import assert from "node:assert/strict";
import test from "node:test";

import worker, { crawlerMetadataForHostname, metadataForHostname, rewriteCrawlerMetadata } from "../src/worker.js";

const formats = [
  ["gzip", "GZIP"],
  ["brotli", "Brotli"],
  ["deflate", "Deflate"],
  ["zlib", "ZLib"],
  ["zstd", "Zstandard"],
];

for (const [slug, displayName] of formats) {
  test(`${slug} has host-specific crawler and social metadata`, () => {
    const metadata = crawlerMetadataForHostname(`${slug}.swimburger.net`);
    assert.equal(metadata.slug, slug);
    assert.equal(metadata.displayName, displayName);
    assert.equal(metadata.canonicalUrl, `https://${slug}.swimburger.net/`);
    assert.match(metadata.title, new RegExp(`^${displayName}`, "i"));
    assert.match(metadata.heading, new RegExp(displayName, "i"));
    assert.match(metadata.intro, new RegExp(displayName, "i"));
    assert.equal(new URL(metadata.socialImageUrl).hostname, `${slug}.swimburger.net`);
    assert.equal(new URL(metadata.socialImageUrl).pathname, `/assets/social/${slug}.png`);
    assert.match(metadata.socialImageAlt, new RegExp(displayName, "i"));
    assert.equal(metadata.socialImageWidth, "1200");
    assert.equal(metadata.socialImageHeight, "630");
    assert.equal(metadata.twitterCard, "summary_large_image");
  });
}

test("unknown preview hosts safely use GZIP content", () => {
  const metadata = metadataForHostname("preview.example.test");
  assert.equal(metadata.slug, "gzip");
  assert.equal(metadata.hostname, "gzip.swimburger.net");
});

class FakeHTMLRewriter {
  changes = new Map();

  on(selector, handler) {
    const element = {
      setInnerContent: (value) => this.changes.set(`${selector}:text`, value),
      setAttribute: (name, value) => this.changes.set(`${selector}:${name}`, value),
    };
    handler.element(element);
    return this;
  }

  transform(response) {
    return { response, changes: this.changes };
  }
}

for (const [slug, displayName] of formats) {
  test(`${slug} HTML rewrite exposes its dedicated crawler social metadata`, () => {
    globalThis.HTMLRewriter = FakeHTMLRewriter;
    const response = new Response("<html></html>", { headers: { "content-type": "text/html" } });
    const result = rewriteCrawlerMetadata(response, `${slug}.swimburger.net`);

    assert.equal(result.changes.get("title:text"), `${displayName} decompress/compress files from your browser`);
    assert.equal(result.changes.get('link[rel="canonical"]:href'), `https://${slug}.swimburger.net/`);
    assert.equal(result.changes.get('meta[property="og:image"]:content'), `https://${slug}.swimburger.net/assets/social/${slug}.png`);
    assert.equal(result.changes.get('meta[name="twitter:image"]:content'), `https://${slug}.swimburger.net/assets/social/${slug}.png`);
    assert.equal(result.changes.get('meta[property="og:image:width"]:content'), "1200");
    assert.equal(result.changes.get('meta[property="og:image:height"]:content'), "630");
    assert.equal(result.changes.get('meta[name="twitter:card"]:content'), "summary_large_image");
    assert.match(result.changes.get('meta[property="og:image:alt"]:content'), new RegExp(displayName, "i"));
    assert.equal(result.changes.get("h1:text"), `Online ${displayName} de/compressor`);
    assert.match(result.changes.get("#intro-paragraph:text"), new RegExp(`${displayName} algorithm`, "i"));
    if (slug !== "gzip")
      assert.equal(result.changes.get('link[rel="manifest"]:href'), `manifest-${slug}.json`);
  });
}

test("Worker fetches the static asset and rewrites HTML responses", async () => {
  globalThis.HTMLRewriter = FakeHTMLRewriter;
  const assetResponse = new Response("<html></html>", { headers: { "content-type": "text/html; charset=utf-8" } });
  const env = { ASSETS: { fetch: async () => assetResponse } };
  const result = await worker.fetch(new Request("https://zstd.swimburger.net/"), env);

  assert.equal(result.response, assetResponse);
  assert.equal(result.changes.get("title:text"), "Zstandard decompress/compress files from your browser");
  assert.equal(result.changes.get('meta[property="og:url"]:content'), "https://zstd.swimburger.net/");
});

test("Worker passes non-HTML assets through without rewriting", async () => {
  const assetResponse = new Response("body{}", { headers: { "content-type": "text/css" } });
  const env = { ASSETS: { fetch: async () => assetResponse } };
  const result = await worker.fetch(new Request("https://gzip.swimburger.net/css/site.css"), env);
  assert.equal(result, assetResponse);
});
