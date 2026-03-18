/**
 * Password-based auth. Password set via ANYTERM_PASSWORD env var or ~/.anyterm_password file.
 * Default: no password (localhost-only access).
 */
import type { IncomingMessage } from 'http';
import fs from 'fs';
import path from 'path';
import os from 'os';

const PASSWORD_FILE = path.join(os.homedir(), '.anyterm_password');

let password: string | null = null;

export function initAuth(): string {
  // 1. Environment variable takes priority
  if (process.env.ANYTERM_PASSWORD) {
    password = process.env.ANYTERM_PASSWORD;
    return password;
  }

  // 2. Read from file
  try {
    if (fs.existsSync(PASSWORD_FILE)) {
      const saved = fs.readFileSync(PASSWORD_FILE, 'utf8').trim();
      if (saved.length > 0) {
        password = saved;
        return password;
      }
    }
  } catch { /* ignore */ }

  // 3. No password set — will be localhost-only
  password = null;
  return '';
}

export function getToken(): string {
  return password || '';
}

export function hasPassword(): boolean {
  return password !== null && password.length > 0;
}

/** Validate password from query string ?token=xxx or cookie */
export function validateRequest(req: IncomingMessage): boolean {
  if (!password) return true;

  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const queryToken = url.searchParams.get('token');
  if (queryToken === password) return true;

  const cookies = req.headers.cookie || '';
  const match = cookies.match(/anyterm_token=([^;]+)/);
  if (match && match[1] === password) return true;

  return false;
}
