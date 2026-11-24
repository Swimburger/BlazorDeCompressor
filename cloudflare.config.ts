import { bindings, defineConfig } from "cf/config";

export default defineConfig({
  worker: {
    name: "blazor-decompressor",
    compatibilityDate: "2026-11-13",
    entrypoint: "./src/worker.js",
    env: {
      ASSETS: bindings.assets(),
    },
    domains: [
      "gzip.swimburger.net",
      "brotli.swimburger.net",
      "deflate.swimburger.net",
      "zlib.swimburger.net",
      "zstd.swimburger.net",
    ],
    assets: {
      notFoundHandling: "single-page-application",
      runWorkerFirst: [
        "/*",
        "!/_framework/*",
        "!/assets/*",
        "!/css/*",
        "!/vendor/*",
        "!/compression-worker.js",
        "!/service-worker.js",
        "!/service-worker-assets.js",
        "!/manifest*.json",
        "!/SocialImage.png",
        "!/favicon.ico",
        "!/robots.txt",
      ],
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
