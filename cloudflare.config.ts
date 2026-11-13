import { defineConfig } from "cf/config";

export default defineConfig({
  worker: {
    name: "blazor-decompressor",
    compatibilityDate: "2026-11-13",
    domains: [
      "gzip.swimburger.net",
      "brotli.swimburger.net",
      "deflate.swimburger.net",
      "zlib.swimburger.net",
      "zstd.swimburger.net",
    ],
    assets: {
      notFoundHandling: "single-page-application",
    },
    observability: {
      enabled: true,
      redactQueryString: true,
      logs: {
        enabled: true,
        headSamplingRate: 1,
      },
      traces: {
        enabled: true,
        headSamplingRate: 0.01,
      },
    },
  },
});
