/**
 * WebSocket handler for terminal I/O.
 *
 * Protocol (JSON messages):
 *   Client → Server:
 *     { type: "input",  id: string, data: string }
 *     { type: "resize", id: string, cols: number, rows: number }
 *     { type: "ack",    id: string, bytes: number }
 *
 *   Server → Client:
 *     { type: "output", id: string, data: string }
 *     { type: "exit",   id: string, exitCode: number }
 *     { type: "sessions", sessions: TerminalSessionInfo[] }
 */
import { WebSocket, WebSocketServer } from 'ws';
import type { IncomingMessage } from 'http';
import { TerminalManager } from '../terminal/manager.js';
import type { TerminalSession } from '../terminal/session.js';

export function setupTerminalWS(wss: WebSocketServer, manager: TerminalManager): void {
  wss.on('connection', (ws: WebSocket, _req: IncomingMessage) => {
    console.log('[WS:Terminal] Client connected');

    // Track which sessions this client is subscribed to
    const subscriptions = new Map<string, { onOutput: (e: any) => void; onExit: (e: any) => void }>();

    const subscribe = (session: TerminalSession) => {
      if (subscriptions.has(session.id)) return;

      const onOutput = (e: { id: string; data: string }) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'output', id: e.id, data: e.data }));
        }
      };
      const onExit = (e: { id: string; exitCode: number }) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'exit', id: e.id, exitCode: e.exitCode }));
        }
        subscriptions.delete(session.id);
      };

      session.on('output', onOutput);
      session.on('exit', onExit);
      subscriptions.set(session.id, { onOutput, onExit });
    };

    const unsubscribe = (session: TerminalSession) => {
      const handlers = subscriptions.get(session.id);
      if (!handlers) return;
      session.off('output', handlers.onOutput);
      session.off('exit', handlers.onExit);
      subscriptions.delete(session.id);
    };

    // Send initial session list
    sendSessions(ws, manager);

    ws.on('message', (raw: Buffer | string) => {
      try {
        const msg = JSON.parse(typeof raw === 'string' ? raw : raw.toString());

        switch (msg.type) {
          case 'create': {
            const session = manager.create(msg.cwd, msg.cols, msg.rows);
            subscribe(session);
            // Send scrollback for new session (empty, but consistent)
            sendSessions(ws, manager);
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'created', id: session.id }));
            }
            break;
          }

          case 'attach': {
            const session = manager.get(msg.id);
            if (!session) {
              ws.send(JSON.stringify({ type: 'error', message: `Session ${msg.id} not found` }));
              break;
            }
            subscribe(session);
            // Send scrollback for reconnection
            const scrollback = session.getScrollback();
            if (scrollback && ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'scrollback', id: msg.id, data: scrollback }));
            }
            break;
          }

          case 'input': {
            const session = manager.get(msg.id);
            if (session) session.write(msg.data);
            break;
          }

          case 'resize': {
            const session = manager.get(msg.id);
            if (session) session.resize(msg.cols, msg.rows);
            break;
          }

          case 'ack': {
            const session = manager.get(msg.id);
            if (session) session.ack(msg.bytes);
            break;
          }

          case 'destroy': {
            const session = manager.get(msg.id);
            if (session) unsubscribe(session);
            manager.destroy(msg.id);
            sendSessions(ws, manager);
            break;
          }

          case 'list': {
            sendSessions(ws, manager);
            break;
          }

          default:
            console.warn(`[WS:Terminal] Unknown message type: ${msg.type}`);
        }
      } catch (err) {
        console.error('[WS:Terminal] Failed to parse message:', err);
      }
    });

    ws.on('close', () => {
      // Unsubscribe from all sessions (but don't kill them!)
      for (const [id, handlers] of subscriptions) {
        const session = manager.get(id);
        if (session) {
          session.off('output', handlers.onOutput);
          session.off('exit', handlers.onExit);
        }
      }
      subscriptions.clear();
      console.log('[WS:Terminal] Client disconnected');
    });
  });
}

function sendSessions(ws: WebSocket, manager: TerminalManager): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'sessions', sessions: manager.list() }));
  }
}
