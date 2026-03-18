#!/usr/bin/env node
/**
 * AnyTerm CLI — start the server with one command.
 * Usage: anyterm [--port 7860] [--no-open]
 */
import { execSync, spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';
import os from 'os';

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

// Check if web/dist exists (production build)
const webDist = path.join(root, 'web', 'dist', 'index.html');
let mode = 'development';
try {
  const fs = await import('fs');
  if (fs.existsSync(webDist)) mode = 'production';
} catch {}

const env = {
  ...process.env,
  ANYTERM_PORT: port,
  NODE_ENV: mode,
};

console.log(`\n  Starting AnyTerm (${mode} mode)...\n`);

if (mode === 'production') {
  // Production: just run the server (serves built frontend)
  const server = spawn('node', [path.join(root, 'server', 'dist', 'index.js')], {
    env, stdio: 'inherit', cwd: root,
  });

  if (!noOpen) {
    setTimeout(() => openBrowser(`http://localhost:${port}`), 1500);
  }

  server.on('exit', (code) => process.exit(code || 0));
} else {
  // Development: use tsx
  const server = spawn('npx', ['tsx', path.join(root, 'server', 'src', 'index.ts')], {
    env, stdio: 'inherit', cwd: root, shell: true,
  });

  if (!noOpen) {
    setTimeout(() => openBrowser(`http://localhost:${port}`), 2000);
  }

  server.on('exit', (code) => process.exit(code || 0));
}

function openBrowser(url) {
  try {
    const cmd = process.platform === 'win32' ? `start ${url}`
      : process.platform === 'darwin' ? `open ${url}`
      : `xdg-open ${url}`;
    execSync(cmd, { stdio: 'ignore' });
  } catch { /* ignore */ }
}
