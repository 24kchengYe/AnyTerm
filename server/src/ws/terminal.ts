/**
 * WebSocket handler for terminal I/O.
 * Includes proper cleanup, input validation, and error boundaries.
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
    };

    // Send initial session list
    safeSend(ws, { type: 'sessions', sessions: manager.list() });

    ws.on('message', (raw: Buffer | string) => {
      try {
        const msg = JSON.parse(typeof raw === 'string' ? raw : raw.toString());

        switch (msg.type) {
          case 'create': {
            const session = manager.create(msg.cwd, msg.cols, msg.rows);
            subscribe(session);
            safeSend(ws, { type: 'sessions', sessions: manager.list() });
            safeSend(ws, { type: 'created', id: session.id });
            break;
          }

          case 'attach': {
            if (typeof msg.id !== 'string') break;
            // Prevent duplicate subscriptions
            if (subscriptions.has(msg.id)) break;
            const session = manager.get(msg.id);
            if (!session) {
              safeSend(ws, { type: 'error', message: `Session ${msg.id} not found` });
              break;
            }
            subscribe(session);
            const scrollback = session.getScrollback();
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
            if (cols < 10 || rows < 3 || cols > 500 || rows > 200) break;
            const session = manager.get(msg.id);
            if (session) session.resize(cols, rows);
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
            safeSend(ws, { type: 'sessions', sessions: manager.list() });
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
      // Unsubscribe from all sessions (sessions stay alive)
      for (const [id] of subscriptions) {
        unsubscribeById(id);
      }
      console.log('[WS:Terminal] Client disconnected');
    });

    ws.on('error', (err) => {
      console.error('[WS:Terminal] Socket error:', err.message);
    });
  });
}
