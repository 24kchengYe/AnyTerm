/**
 * WebSocket hook for AI chat communication.
 */
import { useRef, useEffect, useCallback, useState } from 'react';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  command?: string;
  dangerous?: boolean;
  targetTerminal?: string;
  timestamp: Date;
}

interface UseChatWSOptions {
  onMessage: (msg: ChatMessage) => void;
  onThinking: (thinking: boolean) => void;
  onTranscription: (text: string) => void;
  onAIStatus: (available: boolean, whisperAvailable: boolean) => void;
}

export function useChatWS(options: UseChatWSOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const optionsRef = useRef(options);
  const [connected, setConnected] = useState(false);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  optionsRef.current = options;

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const ws = new WebSocket(`${protocol}//${host}/ws/chat`);

    ws.onopen = () => {
      setConnected(true);
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
        reconnectTimer.current = null;
      }
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        const opts = optionsRef.current;

        switch (msg.type) {
          case 'reply':
            opts.onThinking(false);
            opts.onMessage({
              role: 'assistant',
              content: msg.text,
              command: msg.command,
              dangerous: msg.dangerous,
              targetTerminal: msg.targetTerminal,
              timestamp: new Date(),
            });
            break;
          case 'executing':
            opts.onMessage({
              role: 'system',
              content: `Executing: \`${msg.command}\` in Terminal ${msg.targetTerminal}`,
              timestamp: new Date(),
            });
            break;
          case 'thinking':
            opts.onThinking(true);
            break;
          case 'transcription':
            opts.onTranscription(msg.text);
            break;
          case 'ai_status':
            opts.onAIStatus(msg.available, msg.whisperAvailable);
            break;
          case 'error':
            opts.onThinking(false);
            opts.onMessage({
              role: 'system',
              content: `Error: ${msg.message}`,
              timestamp: new Date(),
            });
            break;
        }
      } catch (err) {
        console.error('[WS:Chat] Parse error:', err);
      }
    };

    ws.onclose = () => {
      setConnected(false);
      wsRef.current = null;
      reconnectTimer.current = setTimeout(connect, 2000);
    };

    wsRef.current = ws;
  }, []);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const send = useCallback((msg: Record<string, unknown>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  const sendMessage = useCallback((text: string, targetTerminal?: string) => {
    send({ type: 'message', text, targetTerminal });
  }, [send]);

  const sendVoice = useCallback((audio: string, format: string, targetTerminal?: string) => {
    send({ type: 'voice', audio, format, targetTerminal });
  }, [send]);

  const confirmCommand = useCallback(() => {
    send({ type: 'confirm' });
  }, [send]);

  const rejectCommand = useCallback(() => {
    send({ type: 'reject' });
  }, [send]);

  return { connected, sendMessage, sendVoice, confirmCommand, rejectCommand };
}
