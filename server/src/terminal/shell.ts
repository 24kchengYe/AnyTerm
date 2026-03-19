/**
 * Cross-platform shell detector — adapted from Zync's shellDetector.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import * as os from 'os';

export interface ShellInfo {
  path: string;
  name: string;
  args: string[];
}

let cachedShell: ShellInfo | null = null;

export function getDefaultShell(): ShellInfo {
  if (cachedShell) return cachedShell;
  cachedShell = process.platform === 'win32' ? detectWindowsShell() : detectUnixShell();
  console.log(`[Shell] Detected: ${cachedShell.name} (${cachedShell.path})`);
  return cachedShell;
}

function detectWindowsShell(): ShellInfo {
  // PowerShell Core (pwsh) first — modern, cross-platform, UTF-8 by default
  const pwsh = findExecutable('pwsh.exe');
  if (pwsh) return { path: pwsh, name: 'pwsh', args: ['-NoExit', '-NoLogo'] };

  // Windows PowerShell — use -NoExit -Command to set UTF-8 before interactive prompt
  const powershell = findExecutable('powershell.exe');
  if (powershell) return {
    path: powershell, name: 'powershell',
    args: ['-NoExit', '-NoLogo', '-Command',
      '[Console]::OutputEncoding=[System.Text.Encoding]::UTF8;[Console]::InputEncoding=[System.Text.Encoding]::UTF8'],
  };

  // Git Bash fallback
  const gitBash = findGitBash();
  if (gitBash) return { path: gitBash, name: 'gitbash', args: ['-i'] };

  // cmd.exe last resort
  const cmdPath = path.join(process.env.SYSTEMROOT || 'C:\\Windows', 'System32', 'cmd.exe');
  return { path: cmdPath, name: 'cmd', args: [] };
}

function findGitBash(): string | null {
  const locations = [
    process.env.GIT_INSTALL_ROOT ? path.join(process.env.GIT_INSTALL_ROOT, 'bin', 'bash.exe') : '',
    path.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'Git', 'bin', 'bash.exe'),
    path.join(process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)', 'Git', 'bin', 'bash.exe'),
    path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Git', 'bin', 'bash.exe'),
    path.join(os.homedir(), 'scoop', 'apps', 'git', 'current', 'bin', 'bash.exe'),
  ].filter(Boolean);

  for (const loc of locations) {
    try {
      if (fs.existsSync(loc)) return loc;
    } catch { /* skip */ }
  }
  return null;
}

function detectUnixShell(): ShellInfo {
  const envShell = process.env.SHELL;
  if (envShell && fs.existsSync(envShell)) {
    const name = path.basename(envShell);
    return { path: envShell, name, args: ['-i'] };
  }

  // macOS: Directory Services
  if (process.platform === 'darwin') {
    try {
      const username = os.userInfo().username;
      const result = execSync(`dscl . -read /Users/${username} UserShell`, { encoding: 'utf8' });
      const match = result.match(/UserShell:\s*(.+)/);
      if (match?.[1]) {
        const shellPath = match[1].trim();
        if (fs.existsSync(shellPath)) {
          return { path: shellPath, name: path.basename(shellPath), args: ['-i'] };
        }
      }
    } catch { /* fallthrough */ }
  }

  // Try common shells
  for (const shellPath of ['/bin/zsh', '/usr/bin/zsh', '/bin/bash', '/usr/bin/bash', '/bin/sh']) {
    if (fs.existsSync(shellPath)) {
      return { path: shellPath, name: path.basename(shellPath), args: ['-i'] };
    }
  }

  return { path: '/bin/sh', name: 'sh', args: ['-i'] };
}

function findExecutable(name: string): string | null {
  const pathEnv = process.env.PATH || '';
  for (const dir of pathEnv.split(path.delimiter)) {
    const fullPath = path.join(dir, name);
    try {
      if (fs.existsSync(fullPath)) {
        fs.accessSync(fullPath, fs.constants.X_OK);
        return fullPath;
      }
    } catch { /* skip */ }
  }
  return null;
}
