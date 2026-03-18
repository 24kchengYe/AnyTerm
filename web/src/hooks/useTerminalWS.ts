/**
 * WebSocket hook for terminal communication.
 * Manages connection lifecycle, auto-reconnect, and message routing.
 */
import { useRef, useEffect, useCallback, useState } from 'react';

export interface TerminalSessionInfo {
  id: string;
  title: string;
  cwd: string;
  shell: string;
  cols: number;
  rows: number;
  alive: boolean;
  lastActivity: string;
}

interface WSMessage {
  type: string;
  id?: string;
  data?: string;
  sessions?: TerminalSessionInfo[];
  exitCode?: number;
  message?: string;
  bytes?: number;
}

interface UseTerminalWSOptions {
  onOutput: (id: string, data: string) => void;
  onScrollback: (id: string, data: string) => void;
  onExit: (id: string, exitCode: number) => void;
  onSessionsUpdate: (sessions: TerminalSessionInfo[]) => void;
  onCreated: (id: string) => void;
}

export function useTerminalWS(options: UseTerminalWSOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const optionsRef = useRef(options);
  const [connected, setConnected] = useState(false);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  optionsRef.current = options;

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const ws = new WebSocket(`${protocol}//${host}/ws/terminal`);

    ws.onopen = () => {
      console.log('[WS] Connected to terminal server');
      setConnected(true);
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
        reconnectTimer.current = null;
      }
    };

    ws.onmessage = (event) => {
      try {
        const msg: WSMessage = JSON.parse(event.data);
        const opts = optionsRef.current;

        switch (msg.type) {
          case 'output':
            if (msg.id && msg.data) opts.onOutput(msg.id, msg.data);
            break;
          case 'scrollback':
            if (msg.id && msg.data) opts.onScrollback(msg.id, msg.data);
            break;
          case 'exit':
            if (msg.id) opts.onExit(msg.id, msg.exitCode ?? -1);
            break;
          case 'sessions':
            if (msg.sessions) opts.onSessionsUpdate(msg.sessions);
            break;
          case 'created':
            if (msg.id) opts.onCreated(msg.id);
            break;
          case 'error':
            console.error('[WS] Server error:', msg.message);
            break;
        }
      } catch (err) {
        console.error('[WS] Failed to parse message:', err);
      }
    };

    ws.onclose = () => {
      console.log('[WS] Disconnected');
      setConnected(false);
      wsRef.current = null;
      // Auto-reconnect after 2s
      reconnectTimer.current = setTimeout(connect, 2000);
    };

    ws.onerror = (err) => {
      console.error('[WS] Error:', err);
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

  const createSession = useCallback((cwd?: string, cols?: number, rows?: number) => {
    send({ type: 'create', cwd, cols, rows });
  }, [send]);

  const attachSession = useCallback((id: string) => {
    send({ type: 'attach', id });
  }, [send]);

  const writeInput = useCallback((id: string, data: string) => {
    send({ type: 'input', id, data });
  }, [send]);

  const resizeTerminal = useCallback((id: string, cols: number, rows: number) => {
    send({ type: 'resize', id, cols, rows });
  }, [send]);

  const ackBytes = useCallback((id: string, bytes: number) => {
    send({ type: 'ack', id, bytes });
  }, [send]);

  const destroySession = useCallback((id: string) => {
    send({ type: 'destroy', id });
  }, [send]);

  return {
    connected,
    createSession,
    attachSession,
    writeInput,
    resizeTerminal,
    ackBytes,
    destroySession,
  };
}
