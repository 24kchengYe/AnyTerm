/**
 * WebSocket handler for AI chat + voice input.
 *
 * Protocol (JSON messages):
 *   Client → Server:
 *     { type: "message", text: string, targetTerminal?: string }
 *     { type: "voice",   audio: string (base64), format: string }
 *     { type: "confirm", command: string, targetTerminal: string }
 *     { type: "reject" }
 *
 *   Server → Client:
 *     { type: "reply",      text: string, command?: string, dangerous?: boolean, targetTerminal?: string }
 *     { type: "executing",  command: string, targetTerminal: string }
 *     { type: "transcription", text: string }
 *     { type: "thinking" }
 *     { type: "error",      message: string }
 *     { type: "ai_status",  available: boolean }
 */
import { WebSocket, WebSocketServer } from 'ws';
import type { IncomingMessage } from 'http';
import { AIEngine } from '../ai/engine.js';
import { TerminalManager } from '../terminal/manager.js';
import { LocalWhisper, checkWhisperAvailable } from '../speech/whisper.js';

export function setupChatWS(
  wss: WebSocketServer,
  aiEngine: AIEngine,
  terminalManager: TerminalManager,
  whisper: LocalWhisper | null,
): void {
  wss.on('connection', (ws: WebSocket, _req: IncomingMessage) => {
    console.log('[WS:Chat] Client connected');

    // Send AI status
    ws.send(JSON.stringify({
      type: 'ai_status',
      available: aiEngine.isAvailable(),
      whisperAvailable: whisper !== null,
    }));

    // Pending dangerous command
    let pendingCommand: { command: string; targetTerminal: string } | null = null;

    ws.on('message', async (raw: Buffer | string) => {
      try {
        const msg = JSON.parse(typeof raw === 'string' ? raw : raw.toString());

        switch (msg.type) {
          case 'message': {
            // Tell client we're thinking
            ws.send(JSON.stringify({ type: 'thinking' }));

            const result = await aiEngine.process(msg.text, msg.targetTerminal);

            if (result.type === 'error') {
              ws.send(JSON.stringify({ type: 'error', message: result.text }));
              break;
            }

            if (result.command && result.dangerous) {
              // Store pending and ask for confirmation
              pendingCommand = {
                command: result.command,
                targetTerminal: result.targetTerminal || '',
              };
              ws.send(JSON.stringify({
                type: 'reply',
                text: result.text,
                command: result.command,
                dangerous: true,
                targetTerminal: result.targetTerminal,
              }));
            } else if (result.command) {
              // Safe command — execute immediately
              const termId = result.targetTerminal;
              if (termId) {
                const session = terminalManager.get(termId);
                if (session) {
                  session.write(result.command + '\r');
                  ws.send(JSON.stringify({
                    type: 'executing',
                    command: result.command,
                    targetTerminal: termId,
                  }));
                }
              }
              ws.send(JSON.stringify({
                type: 'reply',
                text: result.text,
                command: result.command,
                dangerous: false,
                targetTerminal: result.targetTerminal,
              }));
            } else {
              // Just explanation
              ws.send(JSON.stringify({
                type: 'reply',
                text: result.text,
              }));
            }
            break;
          }

          case 'confirm': {
            if (pendingCommand) {
              const { command, targetTerminal } = pendingCommand;
              const session = terminalManager.get(targetTerminal);
              if (session) {
                session.write(command + '\r');
                ws.send(JSON.stringify({
                  type: 'executing',
                  command,
                  targetTerminal,
                }));
              }
              pendingCommand = null;
            }
            break;
          }

          case 'reject': {
            pendingCommand = null;
            ws.send(JSON.stringify({ type: 'reply', text: 'Command cancelled.' }));
            break;
          }

          case 'voice': {
            if (!whisper) {
              ws.send(JSON.stringify({
                type: 'error',
                message: 'Voice input not available. Configure whisper model path.',
              }));
              break;
            }

            try {
              ws.send(JSON.stringify({ type: 'thinking' }));
              const audioBuffer = Buffer.from(msg.audio, 'base64');
              const result = await whisper.transcribe(audioBuffer, msg.format || 'webm');

              ws.send(JSON.stringify({ type: 'transcription', text: result.text }));

              // Auto-process transcribed text through AI
              if (result.text) {
                const aiResult = await aiEngine.process(result.text, msg.targetTerminal);
                if (aiResult.command && !aiResult.dangerous) {
                  const termId = aiResult.targetTerminal;
                  if (termId) {
                    const session = terminalManager.get(termId);
                    if (session) session.write(aiResult.command + '\r');
                  }
                }
                ws.send(JSON.stringify({
                  type: 'reply',
                  text: aiResult.text,
                  command: aiResult.command,
                  dangerous: aiResult.dangerous,
                  targetTerminal: aiResult.targetTerminal,
                }));
              }
            } catch (err: any) {
              ws.send(JSON.stringify({
                type: 'error',
                message: `Voice transcription failed: ${err.message}`,
              }));
            }
            break;
          }

          default:
            console.warn(`[WS:Chat] Unknown message type: ${msg.type}`);
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
