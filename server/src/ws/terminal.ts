/**
 * WebSocket handler for terminal I/O.
 * Tracks per-client viewport size, uses the LARGEST connected viewport for PTY resize.
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

// Track all clients' viewport sizes per session
const clientViewports = new Map<string, Map<WebSocket, { cols: number; rows: number }>>();

function updateSessionSize(sessionId: string, manager: TerminalManager): void {
  const viewports = clientViewports.get(sessionId);
  if (!viewports || viewports.size === 0) return;

  // Use the LARGEST cols among all clients (so desktop isn't shrunk by phone)
  let maxCols = 0;
  let maxRows = 0;
  for (const { cols, rows } of viewports.values()) {
    if (cols > maxCols) { maxCols = cols; maxRows = rows; }
  }

  if (maxCols > 0 && maxRows > 0) {
    const session = manager.get(sessionId);
    if (session) session.resize(maxCols, maxRows);
  }
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

      // Remove this client's viewport for this session
      const viewports = clientViewports.get(id);
      if (viewports) {
        viewports.delete(ws);
        if (viewports.size === 0) clientViewports.delete(id);
        else updateSessionSize(id, manager);
      }
    };

    safeSend(ws, { type: 'sessions', sessions: manager.list() });

    ws.on('message', (raw: Buffer | string) => {
      try {
        const msg = JSON.parse(typeof raw === 'string' ? raw : raw.toString());

        switch (msg.type) {
          case 'create': {
            const session = manager.create(msg.cwd, msg.cols, msg.rows);
            subscribe(session);
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
            // Send only recent output (last 50KB) to avoid flooding on reconnect
            const scrollback = session.getRecentOutput(50000);
            if (scrollback) {
              safeSend(ws, { type: 'scrollback', id: msg.id, data: scrollback });
            }
            break;
          }

          case 'input': {
            if (typeof msg.id !== 'string' || typeof msg.data !== 'string') break;
            const session = manager.get(msg.id);
            if (session) session.write(msg.data);
            break;
          }

          case 'resize': {
            if (typeof msg.id !== 'string') break;
            const cols = typeof msg.cols === 'number' ? msg.cols : 0;
            const rows = typeof msg.rows === 'number' ? msg.rows : 0;
            if (cols < 20 || rows < 5 || cols > 500 || rows > 200) break;

            // Store this client's viewport size
            if (!clientViewports.has(msg.id)) {
              clientViewports.set(msg.id, new Map());
            }
            clientViewports.get(msg.id)!.set(ws, { cols, rows });

            // Resize PTY to the largest connected viewport
            updateSessionSize(msg.id, manager);
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
            broadcastSessions(wss, manager); // Notify ALL clients
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
      // Remove this client's viewports and unsubscribe
      for (const [id] of subscriptions) {
        const viewports = clientViewports.get(id);
        if (viewports) {
          viewports.delete(ws);
          if (viewports.size === 0) clientViewports.delete(id);
          else updateSessionSize(id, manager);
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
