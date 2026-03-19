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
import fs from 'fs';
import { fileURLToPath } from 'url';
import { TerminalManager } from './terminal/manager.js';
import { setupTerminalWS } from './ws/terminal.js';
import { setupChatWS } from './ws/chat.js';
import { initAuth, getToken, hasPassword, validateRequest } from './auth.js';
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

// Initialize whisper — auto-detect local whisper.cpp installation
let whisper: LocalWhisper | null = null;
const whisperModel = process.env.ANYTERM_WHISPER_MODEL || '';
const defaultWhisperPaths = {
  exe: ['D:/whisper/Release/whisper-cli.exe', 'D:/whisper/whisper-cli.exe', 'whisper-cli'],
  model: ['D:/whisper/ggml-base.bin', 'D:/whisper/models/ggml-base.bin'],
  ffmpeg: ['D:/ffmpeg/ffmpeg.exe', 'D:/ffmpeg/bin/ffmpeg.exe', 'C:/ffmpeg/ffmpeg.exe'],
};

function findFile(paths: string[]): string | null {
  for (const p of paths) {
    try { if (fs.existsSync(p)) return p; } catch {}
  }
  return null;
}

if (whisperModel) {
  // Explicit config via env var
  whisper = new LocalWhisper({
    exePath: process.env.ANYTERM_WHISPER_EXE || 'whisper-cli',
    modelPath: whisperModel,
    ffmpegPath: process.env.ANYTERM_FFMPEG_PATH,
    language: process.env.ANYTERM_WHISPER_LANG || 'zh',
  });
  console.log(`[Speech] Whisper configured (model: ${whisperModel})`);
} else {
  // Auto-detect local whisper.cpp
  const autoExe = findFile(defaultWhisperPaths.exe);
  const autoModel = findFile(defaultWhisperPaths.model);
  const autoFfmpeg = findFile(defaultWhisperPaths.ffmpeg);

  if (autoExe && autoModel) {
    whisper = new LocalWhisper({
      exePath: autoExe,
      modelPath: autoModel,
      ffmpegPath: autoFfmpeg || undefined,
      language: process.env.ANYTERM_WHISPER_LANG || 'zh',
    });
    console.log(`[Speech] Whisper auto-detected (${autoExe}, ${autoModel})`);
  } else {
    console.log('[Speech] Whisper not found (set ANYTERM_WHISPER_MODEL or install to D:/whisper/)');
  }
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

// Login endpoint — POST { password: "xxx" } → sets cookie
app.post('/api/login', (req, res) => {
  const { password } = req.body || {};
  if (typeof password === 'string' && password === getToken()) {
    res.cookie('anyterm_token', password, {
      httpOnly: false, // JS needs to read it for WebSocket
      sameSite: 'lax',
      maxAge: 365 * 24 * 60 * 60 * 1000,
    });
    res.json({ ok: true });
  } else {
    res.status(401).json({ error: 'Wrong password' });
  }
});

app.get('/api/auth-check', (req, res) => {
  const remoteAddr = req.socket.remoteAddress || '';
  const isLocal = remoteAddr === '127.0.0.1' || remoteAddr === '::1' || remoteAddr === '::ffff:127.0.0.1';
  if (isLocal || !hasPassword()) {
    res.json({ authenticated: true });
  } else {
    res.json({ authenticated: validateRequest(req), needsPassword: hasPassword() });
  }
});

// Voice transcription endpoint (for mobile voice button)
app.post('/api/voice', async (req, res) => {
  if (!whisper) {
    res.status(400).json({ error: 'Whisper not available' });
    return;
  }
  try {
    const { audio, format } = req.body;
    if (!audio || typeof audio !== 'string') {
      res.status(400).json({ error: 'No audio data' });
      return;
    }
    const buf = Buffer.from(audio, 'base64');
    const result = await whisper.transcribe(buf, format || 'webm');
    res.json({ text: result.text });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: msg });
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
  // Express 5 uses {*path} instead of * for catch-all
  app.get('/{*path}', (_req, res) => {
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

  // Auth: localhost connections are always allowed.
  // Remote connections (from phone/other device) require token in URL: ?token=xxx
  // Token is shown at startup and in the browser's Settings panel.
  const remoteAddr = req.socket.remoteAddress || '';
  const isLocalhost = remoteAddr === '127.0.0.1' || remoteAddr === '::1' || remoteAddr === '::ffff:127.0.0.1';
  if (!isLocalhost && !validateRequest(req)) {
    // Don't spam logs — only log terminal WS blocks, not chat (which auto-reconnects)
    if (pathname === '/ws/terminal') {
      console.log(`[Auth] Blocked remote connection from ${remoteAddr} (no valid token)`);
    }
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
  const ips = getAllLocalIPs();
  const devUrl = DEV ? `http://localhost:5173` : `http://localhost:${PORT}`;

  console.log('');
  console.log('  ═══════════════════════════════════════════');
  console.log('             AnyTerm is running');
  console.log('  ═══════════════════════════════════════════');
  console.log('');
  console.log(`  电脑访问:  ${devUrl}`);
  console.log('');
  if (ips.length > 0) {
    console.log('  手机访问 (同一WiFi下，浏览器打开):');
    for (const ip of ips) {
      console.log(`             http://${ip}:${PORT}`);
    }
  } else {
    console.log('  手机访问:  未检测到局域网IP');
  }
  console.log('');
  if (hasPassword()) {
    console.log('  Password:   Set (remote access protected)');
  } else {
    console.log('  Password:   Not set (localhost only)');
    console.log('              Set via: echo "yourpass" > ~/.anyterm_password');
  }
  if (aiEngine.isAvailable()) console.log('  AI Chat:    Enabled');
  if (whisper) console.log('  Voice:      Enabled');
  console.log('  ═══════════════════════════════════════════');
  console.log('');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n[AnyTerm] Shutting down...');
  manager.destroyAll();
  server.close();
  process.exit(0);
});

function getAllLocalIPs(): string[] {
  const result: string[] = [];
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        result.push(iface.address);
      }
    }
  }
  return result;
}
