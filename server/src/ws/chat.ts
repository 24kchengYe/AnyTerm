/**
 * WebSocket handler for AI chat + voice input.
 *
 * SECURITY: ALL AI-generated commands require user confirmation before execution.
 * No command is auto-executed, regardless of AI's "dangerous" classification.
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
 *     { type: "ai_status",  available: boolean, whisperAvailable: boolean }
 */
import { WebSocket, WebSocketServer } from 'ws';
import type { IncomingMessage } from 'http';
import { AIEngine } from '../ai/engine.js';
import { TerminalManager } from '../terminal/manager.js';
import { LocalWhisper } from '../speech/whisper.js';

// Rate limiting: max 30 messages per minute per client
const RATE_LIMIT_WINDOW = 60_000;
const RATE_LIMIT_MAX = 30;

function safeSend(ws: WebSocket, data: Record<string, unknown>): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

export function setupChatWS(
  wss: WebSocketServer,
  aiEngine: AIEngine,
  terminalManager: TerminalManager,
  whisper: LocalWhisper | null,
): void {
  wss.on('connection', (ws: WebSocket, _req: IncomingMessage) => {
    console.log('[WS:Chat] Client connected');

    // Rate limiting state
    const messageTimestamps: number[] = [];

    // Send AI status
    safeSend(ws, {
      type: 'ai_status',
      available: aiEngine.isAvailable(),
      whisperAvailable: whisper !== null,
    });

    // Pending command awaiting confirmation (ALL commands go through this)
    let pendingCommand: { command: string; targetTerminal: string } | null = null;

    ws.on('message', async (raw: Buffer | string) => {
      try {
        // Rate limiting check
        const now = Date.now();
        messageTimestamps.push(now);
        while (messageTimestamps.length > 0 && messageTimestamps[0] < now - RATE_LIMIT_WINDOW) {
          messageTimestamps.shift();
        }
        if (messageTimestamps.length > RATE_LIMIT_MAX) {
          safeSend(ws, { type: 'error', message: 'Rate limit exceeded. Please slow down.' });
          return;
        }

        const msg = JSON.parse(typeof raw === 'string' ? raw : raw.toString());

        switch (msg.type) {
          case 'message': {
            if (typeof msg.text !== 'string' || !msg.text.trim()) {
              safeSend(ws, { type: 'error', message: 'Empty message' });
              break;
            }

            // If a command is pending confirmation, auto-reject it first
            if (pendingCommand) {
              console.log(`[AI:Audit] Auto-rejected pending: ${pendingCommand.command}`);
              pendingCommand = null;
            }

            safeSend(ws, { type: 'thinking' });

            const result = await aiEngine.process(msg.text, msg.targetTerminal);

            if (result.type === 'error') {
              safeSend(ws, { type: 'error', message: result.text });
              break;
            }

            if (result.command) {
              // ALL commands require confirmation — store as pending
              pendingCommand = {
                command: result.command,
                targetTerminal: result.targetTerminal || '',
              };
              safeSend(ws, {
                type: 'reply',
                text: result.text,
                command: result.command,
                dangerous: result.dangerous || false,
                targetTerminal: result.targetTerminal,
              });
            } else {
              // Just explanation, no command
              safeSend(ws, { type: 'reply', text: result.text });
            }
            break;
          }

          case 'confirm': {
            if (!pendingCommand) {
              safeSend(ws, { type: 'error', message: 'No pending command to confirm.' });
              break;
            }
            const { command, targetTerminal } = pendingCommand;
            pendingCommand = null;

            const session = terminalManager.get(targetTerminal);
            if (session && session.isAlive()) {
              session.write(command + '\r');
              console.log(`[AI:Audit] Executed in T${targetTerminal}: ${command}`);
              safeSend(ws, { type: 'executing', command, targetTerminal });
            } else {
              safeSend(ws, { type: 'error', message: `Terminal ${targetTerminal} not found or dead.` });
            }
            break;
          }

          case 'reject': {
            const rejected = pendingCommand;
            pendingCommand = null;
            if (rejected) {
              console.log(`[AI:Audit] Rejected: ${rejected.command}`);
            }
            safeSend(ws, { type: 'reply', text: 'Command cancelled.' });
            break;
          }

          case 'voice': {
            if (!whisper) {
              safeSend(ws, { type: 'error', message: 'Voice not available. Set ANYTERM_WHISPER_MODEL.' });
              break;
            }
            if (typeof msg.audio !== 'string' || !msg.audio) {
              safeSend(ws, { type: 'error', message: 'Invalid audio data.' });
              break;
            }

            try {
              safeSend(ws, { type: 'thinking' });
              const audioBuffer = Buffer.from(msg.audio, 'base64');
              const result = await whisper.transcribe(audioBuffer, msg.format || 'webm');

              safeSend(ws, { type: 'transcription', text: result.text });

              // Process through AI, but NEVER auto-execute
              if (result.text) {
                const aiResult = await aiEngine.process(result.text, msg.targetTerminal);
                if (aiResult.command) {
                  pendingCommand = {
                    command: aiResult.command,
                    targetTerminal: aiResult.targetTerminal || '',
                  };
                }
                safeSend(ws, {
                  type: 'reply',
                  text: aiResult.text,
                  command: aiResult.command,
                  dangerous: aiResult.dangerous,
                  targetTerminal: aiResult.targetTerminal,
                });
              }
            } catch (err: unknown) {
              const message = err instanceof Error ? err.message : 'Unknown error';
              safeSend(ws, { type: 'error', message: `Voice transcription failed: ${message}` });
            }
            break;
          }

          default:
            // Ignore unknown message types silently
            break;
        }
      } catch (err) {
        console.error('[WS:Chat] Message handling error:', err);
        safeSend(ws, { type: 'error', message: 'Internal server error.' });
      }
    });

    ws.on('close', () => {
      pendingCommand = null;
      console.log('[WS:Chat] Client disconnected');
    });
  });
}
