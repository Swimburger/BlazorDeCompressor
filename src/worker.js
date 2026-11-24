const FORMAT_METADATA = Object.freeze({
  gzip: Object.freeze({
    hostname: "gzip.swimburger.net",
    displayName: "GZIP",
    title: "GZIP decompress/compress files from your browser",
    description: "Use this online GZIP tool to compress and decompress files right in the browser",
    socialImagePath: "/SocialImage.png",
    socialImageWidth: "1200",
    socialImageHeight: "630",
    twitterCard: "summary_large_image",
  }),
  brotli: Object.freeze({
    hostname: "brotli.swimburger.net",
    displayName: "Brotli",
    title: "Brotli decompress/compress files from your browser",
    description: "Use this online Brotli tool to compress and decompress files right in the browser",
    socialImagePath: "/assets/brotli/512x512.png",
    socialImageWidth: "512",
    socialImageHeight: "512",
    twitterCard: "summary",
  }),
  deflate: Object.freeze({
    hostname: "deflate.swimburger.net",
    displayName: "Deflate",
    title: "Deflate decompress/compress files from your browser",
    description: "Use this online Deflate tool to compress and decompress files right in the browser",
    socialImagePath: "/assets/deflate/512x512.png",
    socialImageWidth: "512",
    socialImageHeight: "512",
    twitterCard: "summary",
  }),
  zlib: Object.freeze({
    hostname: "zlib.swimburger.net",
    displayName: "ZLib",
    title: "ZLib decompress/compress files from your browser",
    description: "Use this online ZLib tool to compress and decompress files right in the browser",
    socialImagePath: "/assets/zlib/512x512.png",
    socialImageWidth: "512",
    socialImageHeight: "512",
    twitterCard: "summary",
  }),
  zstd: Object.freeze({
    hostname: "zstd.swimburger.net",
    displayName: "Zstandard",
    title: "Zstandard decompress/compress files from your browser",
    description: "Use this online Zstandard tool to compress and decompress files right in the browser",
    socialImagePath: "/assets/zstd/512x512.png",
    socialImageWidth: "512",
    socialImageHeight: "512",
    twitterCard: "summary",
  }),
});

const FORMAT_BY_HOSTNAME = new Map(
  Object.entries(FORMAT_METADATA).map(([slug, metadata]) => [metadata.hostname, { slug, ...metadata }]),
);

export function metadataForHostname(hostname) {
  return FORMAT_BY_HOSTNAME.get(hostname.toLowerCase()) ?? { slug: "gzip", ...FORMAT_METADATA.gzip };
}

export function crawlerMetadataForHostname(hostname) {
  const metadata = metadataForHostname(hostname);
  const canonicalUrl = `https://${metadata.hostname}/`;
  return {
    ...metadata,
    canonicalUrl,
    heading: `Online ${metadata.displayName} de/compressor`,
    intro: `This tool can compress and decompress files using the ${metadata.displayName} algorithm. Files are compressed and decompressed inside your browser without transmitting file contents to a server.`,
    socialImageUrl: new URL(metadata.socialImagePath, canonicalUrl).toString(),
    socialImageAlt: `The online browser compression tool with ${metadata.displayName} format and file controls.`,
  };
}

function setText(rewriter, selector, value) {
  return rewriter.on(selector, {
    element(element) {
      element.setInnerContent(value);
    },
  });
}

function setAttribute(rewriter, selector, name, value) {
  return rewriter.on(selector, {
    element(element) {
      element.setAttribute(name, value);
    },
  });
}

export function rewriteCrawlerMetadata(response, hostname) {
  const metadata = crawlerMetadataForHostname(hostname);
  let rewriter = new HTMLRewriter();

  rewriter = setText(rewriter, "title", metadata.title);
  rewriter = setAttribute(rewriter, 'meta[name="description"]', "content", metadata.description);
  rewriter = setAttribute(rewriter, 'link[rel="canonical"]', "href", metadata.canonicalUrl);
  rewriter = setAttribute(rewriter, 'meta[property="og:url"]', "content", metadata.canonicalUrl);
  rewriter = setAttribute(rewriter, 'meta[property="og:title"]', "content", metadata.title);
  rewriter = setAttribute(rewriter, 'meta[name="twitter:title"]', "content", metadata.title);
  rewriter = setAttribute(rewriter, 'meta[property="og:description"]', "content", metadata.description);
  rewriter = setAttribute(rewriter, 'meta[name="twitter:description"]', "content", metadata.description);
  rewriter = setAttribute(rewriter, 'meta[property="og:image"]', "content", metadata.socialImageUrl);
  rewriter = setAttribute(rewriter, 'meta[name="twitter:image"]', "content", metadata.socialImageUrl);
  rewriter = setAttribute(rewriter, 'meta[property="og:image:alt"]', "content", metadata.socialImageAlt);
  rewriter = setAttribute(rewriter, 'meta[name="twitter:image:alt"]', "content", metadata.socialImageAlt);
  rewriter = setAttribute(rewriter, 'meta[property="og:image:width"]', "content", metadata.socialImageWidth);
  rewriter = setAttribute(rewriter, 'meta[property="og:image:height"]', "content", metadata.socialImageHeight);
  rewriter = setAttribute(rewriter, 'meta[name="twitter:card"]', "content", metadata.twitterCard);
  rewriter = setText(rewriter, "h1", metadata.heading);
  rewriter = setText(rewriter, "#intro-paragraph", metadata.intro);

  if (metadata.slug !== "gzip") {
    const iconBase = `/assets/${metadata.slug}/`;
    rewriter = setAttribute(rewriter, 'link[rel="apple-touch-icon"][sizes="180x180"]', "href", `${iconBase}apple-touch-icon.png`);
    rewriter = setAttribute(rewriter, 'link[rel="apple-touch-icon"][sizes="512x512"]', "href", `${iconBase}512x512.png`);
    rewriter = setAttribute(rewriter, 'link[rel="icon"][sizes="32x32"]', "href", `${iconBase}favicon-32x32.png`);
    rewriter = setAttribute(rewriter, 'link[rel="icon"][sizes="16x16"]', "href", `${iconBase}favicon-16x16.png`);
    rewriter = setAttribute(rewriter, 'link[rel="manifest"]', "href", `manifest-${metadata.slug}.json`);
  }

  return rewriter.transform(response);
}

export default {
  async fetch(request, env) {
    const response = await env.ASSETS.fetch(request);
    const contentType = response.headers.get("content-type") ?? "";
    if (request.method === "HEAD" || !contentType.includes("text/html")) {
      return response;
    }

    return rewriteCrawlerMetadata(response, new URL(request.url).hostname);
  },
};
