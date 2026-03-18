/**
 * Simple token-based auth. Generates a random token on startup,
 * prints it to the console, and validates it on WebSocket upgrade.
 */
import { nanoid } from 'nanoid';
import type { IncomingMessage } from 'http';

let authToken: string | null = null;

export function initAuth(): string {
  authToken = nanoid(32);
  return authToken;
}

export function getToken(): string {
  return authToken || '';
}

/** Validate token from query string ?token=xxx or cookie */
export function validateRequest(req: IncomingMessage): boolean {
  // If auth is disabled (e.g., in dev), allow all
  if (!authToken) return true;

  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const queryToken = url.searchParams.get('token');
  if (queryToken === authToken) return true;

  // Check cookie
  const cookies = req.headers.cookie || '';
  const match = cookies.match(/anyterm_token=([^;]+)/);
  if (match && match[1] === authToken) return true;

  return false;
}
