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
    assert.match(metadata.socialImageAlt, new RegExp(displayName, "i"));
    assert.match(metadata.socialImageWidth, /^\d+$/);
    assert.match(metadata.socialImageHeight, /^\d+$/);
    assert.match(metadata.twitterCard, /^summary/);
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

test("HTML rewriting changes crawler-visible metadata and page content", () => {
  globalThis.HTMLRewriter = FakeHTMLRewriter;
  const response = new Response("<html></html>", { headers: { "content-type": "text/html" } });
  const result = rewriteCrawlerMetadata(response, "brotli.swimburger.net");

  assert.equal(result.changes.get("title:text"), "Brotli decompress/compress files from your browser");
  assert.equal(result.changes.get('link[rel="canonical"]:href'), "https://brotli.swimburger.net/");
  assert.equal(result.changes.get('meta[property="og:image"]:content'), "https://brotli.swimburger.net/assets/brotli/512x512.png");
  assert.equal(result.changes.get("h1:text"), "Online Brotli de/compressor");
  assert.match(result.changes.get("#intro-paragraph:text"), /Brotli algorithm/);
  assert.equal(result.changes.get('link[rel="manifest"]:href'), "manifest-brotli.json");
});

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
