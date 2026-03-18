#!/usr/bin/env node
/**
 * AnyTerm CLI — start the server with one command.
 * Usage: anyterm [--port 7860] [--no-open]
 */
import { execSync, spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const args = process.argv.slice(2);

// Parse --port
let port = '7860';
const portIdx = args.indexOf('--port');
if (portIdx !== -1 && args[portIdx + 1]) {
  port = args[portIdx + 1];
}

// Parse --no-open
const noOpen = args.includes('--no-open');

// Check if built frontend exists → serve it; otherwise dev mode
const webDist = path.join(root, 'web', 'dist', 'index.html');
const hasBuild = fs.existsSync(webDist);

const env = {
  ...process.env,
  ANYTERM_PORT: port,
  NODE_ENV: hasBuild ? 'production' : 'development',
};

// Always use tsx to run TypeScript source directly (no build step needed)
const serverEntry = path.join(root, 'server', 'src', 'index.ts');

console.log('');
console.log('  Starting AnyTerm...');
console.log('');

// Resolve tsx binary path directly to avoid shell:true deprecation
import { createRequire } from 'module';
const require2 = createRequire(path.join(root, 'server', 'package.json'));
let tsxBin;
try {
  // Try local tsx first
  const tsxPkg = path.dirname(require2.resolve('tsx/package.json'));
  tsxBin = path.join(tsxPkg, 'dist', 'cli.mjs');
} catch {
  // Fallback: use npx with shell (Windows needs it)
  tsxBin = null;
}

const server = tsxBin
  ? spawn(process.execPath, [tsxBin, serverEntry], { env, stdio: 'inherit', cwd: root })
  : spawn('npx', ['tsx', serverEntry], { env, stdio: 'inherit', cwd: root, shell: true });

if (!noOpen) {
  const url = hasBuild ? `http://localhost:${port}` : `http://localhost:5173`;
  setTimeout(() => openBrowser(url), 2500);
}

server.on('exit', (code) => process.exit(code || 0));

// Forward SIGINT to child
process.on('SIGINT', () => {
  server.kill('SIGINT');
});

function openBrowser(url) {
  try {
    const cmd = process.platform === 'win32' ? `start ${url}`
      : process.platform === 'darwin' ? `open ${url}`
      : `xdg-open ${url}`;
    execSync(cmd, { stdio: 'ignore' });
  } catch { /* ignore */ }
}
