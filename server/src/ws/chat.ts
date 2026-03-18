/**
 * WebSocket handler for AI chat (Phase 2 — stub for now).
 *
 * Protocol (JSON messages):
 *   Client → Server:
 *     { type: "message", text: string, targetTerminal?: string }
 *     { type: "voice",   audio: string (base64), format: string }
 *
 *   Server → Client:
 *     { type: "reply",    text: string, command?: string }
 *     { type: "thinking", text: string }
 *     { type: "error",    message: string }
 */
import { WebSocket, WebSocketServer } from 'ws';
import type { IncomingMessage } from 'http';

export function setupChatWS(wss: WebSocketServer): void {
  wss.on('connection', (ws: WebSocket, _req: IncomingMessage) => {
    console.log('[WS:Chat] Client connected');

    ws.on('message', (raw: Buffer | string) => {
      try {
        const msg = JSON.parse(typeof raw === 'string' ? raw : raw.toString());

        if (msg.type === 'message') {
          // Phase 2: AI engine will process this
          ws.send(JSON.stringify({
            type: 'reply',
            text: '[AI Engine not yet implemented] You said: ' + msg.text,
          }));
        }
      } catch (err) {
        console.error('[WS:Chat] Failed to parse message:', err);
      }
    });

    ws.on('close', () => {
      console.log('[WS:Chat] Client disconnected');
    });
  });
}
