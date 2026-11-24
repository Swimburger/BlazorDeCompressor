import { copyFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = resolve(root, "node_modules/brotli-wasm");
const destination = resolve(root, "wwwroot/vendor/brotli-wasm");

await mkdir(resolve(destination, "pkg.web"), { recursive: true });
await Promise.all([
  copyFile(resolve(source, "LICENSE"), resolve(destination, "LICENSE")),
  copyFile(resolve(source, "index.web.js"), resolve(destination, "index.web.js")),
  copyFile(resolve(source, "pkg.web/brotli_wasm.js"), resolve(destination, "pkg.web/brotli_wasm.js")),
  copyFile(resolve(source, "pkg.web/brotli_wasm_bg.wasm"), resolve(destination, "pkg.web/brotli_wasm_bg.wasm")),
]);
