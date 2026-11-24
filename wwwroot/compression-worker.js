import brotliWasm from './vendor/brotli-wasm/index.web.js';

const brotliReady = brotliWasm;

self.onmessage = async ({ data: { id, type, payload, quality } }) => {
    try {
        const brotli = await brotliReady;
        const result = type === 'compress'
            ? brotli.compress(payload, { quality })
            : brotli.decompress(payload);
        self.postMessage({ id, result }, [result.buffer]);
    } catch (err) {
        self.postMessage({ id, error: String(err) });
    }
};
