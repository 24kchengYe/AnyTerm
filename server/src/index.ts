/**
 * AnyTerm Server — HTTP + WebSocket server for remote terminal management.
 *
 * Endpoints:
 *   GET  /              → Web UI (static files from ../web/dist or proxied in dev)
 *   GET  /api/sessions  → List terminal sessions
 *   GET  /api/auth      → Set auth cookie (with ?token=xxx)
 *   WS   /ws/terminal   → Terminal I/O
 *   WS   /ws/chat       → AI chat (Phase 2)
 */
import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { TerminalManager } from './terminal/manager.js';
import { setupTerminalWS } from './ws/terminal.js';
import { setupChatWS } from './ws/chat.js';
import { initAuth, getToken, validateRequest } from './auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.ANYTERM_PORT || '7860', 10);
const HOST = process.env.ANYTERM_HOST || '0.0.0.0';
const DEV = process.env.NODE_ENV !== 'production';

// Initialize
const token = initAuth();
const manager = new TerminalManager();
const app = express();
const server = createServer(app);

// --- REST API ---

app.get('/api/sessions', (req, res) => {
  res.json(manager.list());
});

app.get('/api/auth', (req, res) => {
  const t = req.query.token as string;
  if (t === getToken()) {
    res.cookie('anyterm_token', t, {
      httpOnly: true,
      sameSite: 'strict',
      maxAge: 365 * 24 * 60 * 60 * 1000, // 1 year
    });
    res.json({ ok: true });
  } else {
    res.status(401).json({ error: 'Invalid token' });
  }
});

// Serve static files in production
if (!DEV) {
  const webDist = path.resolve(__dirname, '../../web/dist');
  app.use(express.static(webDist));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(webDist, 'index.html'));
  });
}

// --- WebSocket ---

const terminalWSS = new WebSocketServer({ noServer: true });
const chatWSS = new WebSocketServer({ noServer: true });

setupTerminalWS(terminalWSS, manager);
setupChatWS(chatWSS);

server.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  // Auth check (skip in dev for convenience)
  if (!DEV && !validateRequest(req)) {
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
    socket.destroy();
    return;
  }

  if (pathname === '/ws/terminal') {
    terminalWSS.handleUpgrade(req, socket, head, (ws) => {
      terminalWSS.emit('connection', ws, req);
    });
  } else if (pathname === '/ws/chat') {
    chatWSS.handleUpgrade(req, socket, head, (ws) => {
      chatWSS.emit('connection', ws, req);
    });
  } else {
    socket.destroy();
  }
});

// --- Start ---

server.listen(PORT, HOST, () => {
  console.log('');
  console.log('  ╔══════════════════════════════════════════════╗');
  console.log('  ║             AnyTerm is running               ║');
  console.log('  ╠══════════════════════════════════════════════╣');
  console.log(`  ║  Local:   http://localhost:${PORT}             ║`);
  console.log(`  ║  Network: http://${getLocalIP()}:${PORT}       ║`);
  console.log('  ╠══════════════════════════════════════════════╣');
  console.log(`  ║  Auth Token: ${token}  ║`);
  console.log('  ╚══════════════════════════════════════════════╝');
  console.log('');
  if (DEV) {
    console.log('  [Dev mode] Auth disabled. Frontend at http://localhost:5173');
  }
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n[AnyTerm] Shutting down...');
  manager.destroyAll();
  server.close();
  process.exit(0);
});

function getLocalIP(): string {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '0.0.0.0';
}
