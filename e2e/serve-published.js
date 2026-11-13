const http = require('http');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../dist/wwwroot');
const port = 5002;
const contentTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.dat', 'application/octet-stream'],
  ['.html', 'text/html; charset=utf-8'],
  ['.ico', 'image/x-icon'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.wasm', 'application/wasm'],
]);

if (!fs.existsSync(path.join(root, 'index.html'))) {
  console.error(`Published app not found at ${root}. Run npm run build from the repository root first.`);
  process.exit(1);
}

http.createServer((request, response) => {
  const requestPath = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  const relativePath = requestPath === '/' ? 'index.html' : requestPath.replace(/^\/+/, '');
  let filePath = path.resolve(root, relativePath);

  if (!filePath.startsWith(`${root}${path.sep}`) || path.basename(filePath) === '_headers') {
    response.writeHead(404).end();
    return;
  }

  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    filePath = path.join(root, 'index.html');
  }

  let servedPath = filePath;
  const acceptedEncodings = request.headers['accept-encoding'] || '';
  if (acceptedEncodings.includes('br') && fs.existsSync(`${filePath}.br`)) {
    servedPath = `${filePath}.br`;
  } else if (acceptedEncodings.includes('gzip') && fs.existsSync(`${filePath}.gz`)) {
    servedPath = `${filePath}.gz`;
  }

  const headers = {
    'Content-Type': contentTypes.get(path.extname(filePath)) || 'application/octet-stream',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Vary': 'Accept-Encoding',
  };
  if (servedPath.endsWith('.br')) headers['Content-Encoding'] = 'br';
  if (servedPath.endsWith('.gz')) headers['Content-Encoding'] = 'gzip';
  if (requestPath.startsWith('/_framework/')) {
    headers['Cache-Control'] = 'public, max-age=31536000, immutable';
  } else if (requestPath === '/service-worker.js' || requestPath === '/service-worker-assets.js') {
    headers['Cache-Control'] = 'no-cache';
  } else {
    headers['Cache-Control'] = 'public, max-age=0, must-revalidate';
  }

  response.writeHead(200, headers);
  fs.createReadStream(servedPath).pipe(response);
}).listen(port, '0.0.0.0', () => {
  console.log(`Serving published app from ${root} on http://localhost:${port}`);
});
