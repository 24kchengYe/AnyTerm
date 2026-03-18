/**
 * AnyTerm Server — HTTP + WebSocket server for remote terminal management + AI chat.
 *
 * Endpoints:
 *   GET  /              → Web UI (static files from ../web/dist or proxied in dev)
 *   GET  /api/sessions  → List terminal sessions
 *   GET  /api/auth      → Set auth cookie (with ?token=xxx)
 *   GET  /api/settings  → Get server settings/capabilities
 *   WS   /ws/terminal   → Terminal I/O
 *   WS   /ws/chat       → AI chat + voice
 */
import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { TerminalManager } from './terminal/manager.js';
import { setupTerminalWS } from './ws/terminal.js';
import { setupChatWS } from './ws/chat.js';
import { initAuth, getToken, validateRequest } from './auth.js';
import { AIEngine } from './ai/engine.js';
import { LocalWhisper, checkWhisperAvailable } from './speech/whisper.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.ANYTERM_PORT || '7860', 10);
const HOST = process.env.ANYTERM_HOST || '0.0.0.0';
const DEV = process.env.NODE_ENV !== 'production';

// Initialize core services
const token = initAuth();
const manager = new TerminalManager();
const aiEngine = new AIEngine(manager);

// Initialize whisper (optional)
let whisper: LocalWhisper | null = null;
const whisperModel = process.env.ANYTERM_WHISPER_MODEL || '';
if (whisperModel) {
  whisper = new LocalWhisper({
    exePath: process.env.ANYTERM_WHISPER_EXE || 'whisper-cli',
    modelPath: whisperModel,
    ffmpegPath: process.env.ANYTERM_FFMPEG_PATH,
    language: process.env.ANYTERM_WHISPER_LANG || 'zh',
  });
  console.log(`[Speech] Whisper configured (model: ${whisperModel})`);
} else {
  console.log('[Speech] Whisper not configured (set ANYTERM_WHISPER_MODEL to enable)');
}

const app = express();
app.use(express.json({ limit: '10mb' }));

// CORS: configurable origin (default * for LAN/Tailscale access from phone)
const CORS_ORIGIN = process.env.ANYTERM_CORS_ORIGIN || '*';
app.use((_req, res, next) => {
  res.header('Access-Control-Allow-Origin', CORS_ORIGIN);
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (_req.method === 'OPTIONS') { res.status(204).end(); return; }
  next();
});

const server = createServer(app);

// --- REST API ---

app.get('/api/sessions', (_req, res) => {
  res.json(manager.list());
});

app.get('/api/auth', (req, res) => {
  const t = req.query.token as string;
  if (t === getToken()) {
    res.cookie('anyterm_token', t, {
      httpOnly: true,
      sameSite: 'strict',
      maxAge: 365 * 24 * 60 * 60 * 1000,
    });
    res.json({ ok: true });
  } else {
    res.status(401).json({ error: 'Invalid token' });
  }
});

app.get('/api/settings', (_req, res) => {
  res.json({
    ai: aiEngine.isAvailable(),
    whisper: whisper !== null,
    version: '0.1.0',
  });
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
setupChatWS(chatWSS, aiEngine, manager, whisper);

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
  const ip = getLocalIP();
  console.log('');
  console.log('  ╔══════════════════════════════════════════════════╗');
  console.log('  ║              AnyTerm is running                  ║');
  console.log('  ╠══════════════════════════════════════════════════╣');
  console.log(`  ║  Local:    http://localhost:${PORT}                ║`);
  console.log(`  ║  Network:  http://${ip.padEnd(15)}:${PORT}        ║`);
  console.log('  ╠══════════════════════════════════════════════════╣');
  console.log(`  ║  AI:       ${aiEngine.isAvailable() ? 'Enabled (Claude)' : 'Disabled (no API key)'}${' '.repeat(aiEngine.isAvailable() ? 15 : 13)}║`);
  console.log(`  ║  Voice:    ${whisper ? 'Enabled (Whisper)' : 'Disabled'}${' '.repeat(whisper ? 14 : 22)}║`);
  console.log('  ╠══════════════════════════════════════════════════╣');
  console.log(`  ║  Token:    ${token}  ║`);
  console.log('  ╚══════════════════════════════════════════════════╝');
  console.log('');
  if (DEV) {
    console.log('  [Dev] Auth disabled. Frontend at http://localhost:5173');
  }
  console.log('  [Env] ANTHROPIC_API_KEY     → AI chat');
  console.log('  [Env] ANYTERM_WHISPER_MODEL → Voice input');
  console.log('');
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
