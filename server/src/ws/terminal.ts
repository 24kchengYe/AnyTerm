/**
 * WebSocket handler for terminal I/O.
 *
 * RESIZE STRATEGY: "Last active client wins"
 * - Each client sends its own resize based on FitAddon
 * - PTY is resized to match whoever sent the most recent INPUT
 * - This way: desktop user typing → PTY stays 120 cols
 *             phone user typing → PTY shrinks to 45 cols
 * - Since you rarely type on both simultaneously, this works well
 */
import { WebSocket, WebSocketServer } from 'ws';
import type { IncomingMessage } from 'http';
import { TerminalManager } from '../terminal/manager.js';
import type { TerminalSession } from '../terminal/session.js';

function safeSend(ws: WebSocket, data: Record<string, unknown>): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

// Track per-client viewport and last-active client per session
const clientViewports = new Map<string, Map<WebSocket, { cols: number; rows: number }>>();
const lastActiveClient = new Map<string, WebSocket>();

function resizeToActiveClient(sessionId: string, manager: TerminalManager): void {
  const active = lastActiveClient.get(sessionId);
  if (!active) return;
  const viewports = clientViewports.get(sessionId);
  if (!viewports) return;
  const dims = viewports.get(active);
  if (!dims) return;
  const session = manager.get(sessionId);
  if (session) session.resize(dims.cols, dims.rows);
}

// Broadcast session list to ALL connected clients
function broadcastSessions(wss: WebSocketServer, manager: TerminalManager): void {
  const msg = JSON.stringify({ type: 'sessions', sessions: manager.list() });
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  }
}

export function setupTerminalWS(wss: WebSocketServer, manager: TerminalManager): void {
  wss.on('connection', (ws: WebSocket, _req: IncomingMessage) => {
    console.log('[WS:Terminal] Client connected');

    const subscriptions = new Map<string, { onOutput: (e: any) => void; onExit: (e: any) => void }>();

    const subscribe = (session: TerminalSession) => {
      if (subscriptions.has(session.id)) return;
      const onOutput = (e: { id: string; data: string }) => {
        safeSend(ws, { type: 'output', id: e.id, data: e.data });
      };
      const onExit = (e: { id: string; exitCode: number }) => {
        safeSend(ws, { type: 'exit', id: e.id, exitCode: e.exitCode });
        unsubscribeById(e.id);
      };
      session.on('output', onOutput);
      session.on('exit', onExit);
      subscriptions.set(session.id, { onOutput, onExit });
    };

    const unsubscribeById = (id: string) => {
      const handlers = subscriptions.get(id);
      if (!handlers) return;
      const session = manager.get(id);
      if (session) {
        session.off('output', handlers.onOutput);
        session.off('exit', handlers.onExit);
      }
      subscriptions.delete(id);
      // Clean up viewport tracking
      const viewports = clientViewports.get(id);
      if (viewports) {
        viewports.delete(ws);
        if (viewports.size === 0) clientViewports.delete(id);
      }
      if (lastActiveClient.get(id) === ws) lastActiveClient.delete(id);
    };

    safeSend(ws, { type: 'sessions', sessions: manager.list() });

    ws.on('message', (raw: Buffer | string) => {
      try {
        const msg = JSON.parse(typeof raw === 'string' ? raw : raw.toString());

        switch (msg.type) {
          case 'create': {
            const session = manager.create(msg.cwd, msg.cols, msg.rows);
            subscribe(session);
            // This client created it, so it's the active client
            lastActiveClient.set(session.id, ws);
            if (msg.cols && msg.rows) {
              if (!clientViewports.has(session.id)) clientViewports.set(session.id, new Map());
              clientViewports.get(session.id)!.set(ws, { cols: msg.cols, rows: msg.rows });
            }
            broadcastSessions(wss, manager);
            safeSend(ws, { type: 'created', id: session.id });
            break;
          }

          case 'attach': {
            if (typeof msg.id !== 'string') break;
            if (subscriptions.has(msg.id)) break;
            const session = manager.get(msg.id);
            if (!session) {
              safeSend(ws, { type: 'error', message: `Session ${msg.id} not found` });
              break;
            }
            subscribe(session);
            // Send scrollback for page refresh/new device (client deduplicates)
            const scrollback = session.getRecentOutput(50000);
            if (scrollback) {
              safeSend(ws, { type: 'scrollback', id: msg.id, data: scrollback });
            }
            break;
          }

          case 'input': {
            if (typeof msg.id !== 'string' || typeof msg.data !== 'string') break;
            const session = manager.get(msg.id);
            if (session) {
              session.write(msg.data);
              // Mark this client as active → resize PTY to this client's viewport
              const prev = lastActiveClient.get(msg.id);
              if (prev !== ws) {
                lastActiveClient.set(msg.id, ws);
                resizeToActiveClient(msg.id, manager);
              }
            }
            break;
          }

          case 'rename': {
            if (typeof msg.id !== 'string' || typeof msg.title !== 'string') break;
            const session = manager.get(msg.id);
            if (session) {
              session.setTitle(msg.title.slice(0, 50)); // Max 50 chars
              broadcastSessions(wss, manager); // Sync to all clients
            }
            break;
          }

          case 'resize': {
            if (typeof msg.id !== 'string') break;
            const cols = typeof msg.cols === 'number' ? msg.cols : 0;
            const rows = typeof msg.rows === 'number' ? msg.rows : 0;
            if (cols < 20 || rows < 5 || cols > 500 || rows > 200) break;

            // Store this client's viewport
            if (!clientViewports.has(msg.id)) clientViewports.set(msg.id, new Map());
            clientViewports.get(msg.id)!.set(ws, { cols, rows });

            // Only resize PTY if this client is the active one (or the only one)
            const active = lastActiveClient.get(msg.id);
            if (!active || active === ws) {
              lastActiveClient.set(msg.id, ws);
              const session = manager.get(msg.id);
              if (session) session.resize(cols, rows);
            }
            break;
          }

          case 'ack': {
            if (typeof msg.id !== 'string') break;
            const bytes = typeof msg.bytes === 'number' ? Math.max(0, msg.bytes) : 0;
            if (bytes === 0) break;
            const session = manager.get(msg.id);
            if (session) session.ack(bytes);
            break;
          }

          case 'destroy': {
            if (typeof msg.id !== 'string') break;
            unsubscribeById(msg.id);
            manager.destroy(msg.id);
            clientViewports.delete(msg.id);
            lastActiveClient.delete(msg.id);
            broadcastSessions(wss, manager);
            break;
          }

          case 'list': {
            safeSend(ws, { type: 'sessions', sessions: manager.list() });
            break;
          }
        }
      } catch (err) {
        console.error('[WS:Terminal] Message handling error:', err);
        safeSend(ws, { type: 'error', message: 'Invalid message format' });
      }
    });

    ws.on('close', () => {
      for (const [id] of subscriptions) {
        const viewports = clientViewports.get(id);
        if (viewports) {
          viewports.delete(ws);
          if (viewports.size === 0) clientViewports.delete(id);
        }
        if (lastActiveClient.get(id) === ws) {
          lastActiveClient.delete(id);
          // If another client is connected, resize to it
          const remaining = clientViewports.get(id);
          if (remaining && remaining.size > 0) {
            const [nextWs] = remaining.keys();
            lastActiveClient.set(id, nextWs);
            resizeToActiveClient(id, manager);
          }
        }
        unsubscribeById(id);
      }
      console.log('[WS:Terminal] Client disconnected');
    });

    ws.on('error', (err) => {
      console.error('[WS:Terminal] Socket error:', err.message);
    });
  });
}
