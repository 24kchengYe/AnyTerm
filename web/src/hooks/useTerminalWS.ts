/**
 * WebSocket hook for terminal communication.
 * Manages connection lifecycle, exponential backoff reconnect, and message routing.
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
  const reconnectAttempts = useRef(0);
  const connectingRef = useRef(false);

  optionsRef.current = options;

  const connect = useCallback(() => {
    // Prevent concurrent connections
    if (connectingRef.current) return;
    if (wsRef.current?.readyState === WebSocket.OPEN || wsRef.current?.readyState === WebSocket.CONNECTING) return;
    connectingRef.current = true;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const ws = new WebSocket(`${protocol}//${host}/ws/terminal`);

    ws.onopen = () => {
      console.log('[WS] Connected to terminal server');
      connectingRef.current = false;
      reconnectAttempts.current = 0;
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
        console.error('[WS] Parse error:', err);
      }
    };

    ws.onclose = () => {
      console.log('[WS] Disconnected');
      connectingRef.current = false;
      setConnected(false);
      wsRef.current = null;
      // Exponential backoff: 2s, 3s, 4.5s, ... max 30s
      const delay = Math.min(30000, 2000 * Math.pow(1.5, reconnectAttempts.current));
      reconnectAttempts.current++;
      reconnectTimer.current = setTimeout(connect, delay);
    };

    ws.onerror = () => {
      // onclose will fire after onerror, no need to handle separately
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

  return {
    connected,
    createSession: useCallback((cwd?: string, cols?: number, rows?: number) => send({ type: 'create', cwd, cols, rows }), [send]),
    attachSession: useCallback((id: string) => send({ type: 'attach', id }), [send]),
    writeInput: useCallback((id: string, data: string) => send({ type: 'input', id, data }), [send]),
    resizeTerminal: useCallback((id: string, cols: number, rows: number) => send({ type: 'resize', id, cols, rows }), [send]),
    ackBytes: useCallback((id: string, bytes: number) => send({ type: 'ack', id, bytes }), [send]),
    destroySession: useCallback((id: string) => send({ type: 'destroy', id }), [send]),
  };
}
