#!/usr/bin/env node
/**
 * AnyTerm CLI — one command to start everything.
 * Usage: anyterm [--port 7860] [--no-open]
 */
import { execSync, spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import path from 'path';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const args = process.argv.slice(2);

let port = '7860';
const portIdx = args.indexOf('--port');
if (portIdx !== -1 && args[portIdx + 1]) port = args[portIdx + 1];
const noOpen = args.includes('--no-open');

// Auto-build frontend if web/dist doesn't exist
const webDist = path.join(root, 'web', 'dist', 'index.html');
if (!fs.existsSync(webDist)) {
  console.log('\n  First run — building frontend...\n');
  try {
    execSync('npx vite build', { cwd: path.join(root, 'web'), stdio: 'inherit' });
  } catch (e) {
    console.error('  Frontend build failed. Run manually: cd web && npm run build');
    process.exit(1);
  }
}

// Always run as production (serve built frontend from web/dist)
const env = {
  ...process.env,
  ANYTERM_PORT: port,
  NODE_ENV: 'production',
};

const serverEntry = path.join(root, 'server', 'src', 'index.ts');

// Resolve tsx binary directly (avoid shell:true deprecation)
const require2 = createRequire(path.join(root, 'server', 'package.json'));
let tsxBin;
try {
  const tsxPkg = path.dirname(require2.resolve('tsx/package.json'));
  tsxBin = path.join(tsxPkg, 'dist', 'cli.mjs');
} catch { tsxBin = null; }

console.log('');
console.log('  Starting AnyTerm...');
console.log('');

const server = tsxBin
  ? spawn(process.execPath, [tsxBin, serverEntry], { env, stdio: 'inherit', cwd: root })
  : spawn('npx', ['tsx', serverEntry], { env, stdio: 'inherit', cwd: root, shell: true });

// Open browser at the correct address (server serves everything on one port)
if (!noOpen) {
  const url = `http://localhost:${port}`;
  setTimeout(() => {
    try {
      const cmd = process.platform === 'win32' ? `start ${url}`
        : process.platform === 'darwin' ? `open ${url}`
        : `xdg-open ${url}`;
      execSync(cmd, { stdio: 'ignore' });
    } catch { /* ignore */ }
  }, 2500);
}

server.on('exit', (code) => process.exit(code || 0));
process.on('SIGINT', () => server.kill('SIGINT'));
