#!/usr/bin/env node
// Kills any process listening on the given port (cross-platform).
const { execSync } = require('child_process');
const port = process.argv[2];
if (!port) { console.error('Usage: kill-port.js <port>'); process.exit(1); }

try {
  if (process.platform === 'win32') {
    const out = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf8' });
    const pids = [...new Set(out.trim().split('\n').map(l => l.trim().split(/\s+/).at(-1)).filter(Boolean))];
    for (const pid of pids) execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' });
  } else {
    execSync(`lsof -ti:${port} | xargs kill -9`, { stdio: 'ignore' });
  }
} catch {
  // Nothing was listening — ignore
}
