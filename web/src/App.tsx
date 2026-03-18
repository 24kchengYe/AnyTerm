/**
 * AnyTerm — main application component.
 * Manages terminal sessions, WebSocket connection, and layout.
 */
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { TerminalTabs } from './components/TerminalTabs.js';
import { TerminalView } from './components/Terminal.js';
import { ChatPanel } from './components/ChatPanel.js';
import { MobileBar } from './components/MobileBar.js';
import { useTerminalWS, type TerminalSessionInfo } from './hooks/useTerminalWS.js';

const isMobile = () => window.innerWidth < 768;

export default function App() {
  const [sessions, setSessions] = useState<TerminalSessionInfo[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [chatExpanded, setChatExpanded] = useState(false);
  const [mobile, setMobile] = useState(isMobile());

  // Track terminal containers for writing output
  const containerRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Detect mobile on resize
  useEffect(() => {
    const handler = () => setMobile(isMobile());
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  const writeToTerminal = useCallback((id: string, data: string) => {
    // Find the terminal container and write data
    const el = document.querySelector(`[data-session-id="${id}"]`) as HTMLDivElement | null;
    if (el && (el as any).__writeToTerminal) {
      (el as any).__writeToTerminal(data);
    }
  }, []);

  const ws = useTerminalWS({
    onOutput: writeToTerminal,
    onScrollback: writeToTerminal,
    onExit: (id) => {
      console.log(`Terminal ${id} exited`);
      // Don't remove from list — let user see it's dead
    },
    onSessionsUpdate: (newSessions) => {
      setSessions(newSessions);
      // Auto-select first session if none active
      if (!activeId && newSessions.length > 0) {
        setActiveId(newSessions[0].id);
      }
    },
    onCreated: (id) => {
      setActiveId(id);
      // Attach to receive output
      ws.attachSession(id);
    },
  });

  // On initial connect, attach to all existing sessions
  useEffect(() => {
    if (ws.connected && sessions.length > 0) {
      for (const s of sessions) {
        ws.attachSession(s.id);
      }
    }
  }, [ws.connected]); // Only on connect, not on every session change

  const handleCreate = useCallback(() => {
    ws.createSession();
  }, [ws]);

  const handleClose = useCallback((id: string) => {
    ws.destroySession(id);
    if (activeId === id) {
      const remaining = sessions.filter(s => s.id !== id);
      setActiveId(remaining.length > 0 ? remaining[0].id : null);
    }
  }, [ws, activeId, sessions]);

  const handleInput = useCallback((data: string) => {
    if (activeId) ws.writeInput(activeId, data);
  }, [ws, activeId]);

  const handleResize = useCallback((cols: number, rows: number) => {
    if (activeId) ws.resizeTerminal(activeId, cols, rows);
  }, [ws, activeId]);

  const handleAck = useCallback((bytes: number) => {
    if (activeId) ws.ackBytes(activeId, bytes);
  }, [ws, activeId]);

  // Auto-create first terminal on connect if none exist
  useEffect(() => {
    if (ws.connected && sessions.length === 0) {
      // Small delay to let WS handshake settle
      const timer = setTimeout(() => {
        if (sessions.length === 0) ws.createSession();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [ws.connected]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      width: '100vw',
      overflow: 'hidden',
      background: '#1a1b26',
    }}>
      {/* Tab bar */}
      <TerminalTabs
        sessions={sessions}
        activeId={activeId}
        connected={ws.connected}
        onSelect={(id) => {
          setActiveId(id);
          ws.attachSession(id);
        }}
        onCreate={handleCreate}
        onClose={handleClose}
      />

      {/* Terminal area */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {sessions.length === 0 && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            gap: 16,
            color: '#565f89',
          }}>
            <div style={{ fontSize: 48 }}>{'>'}_</div>
            <div style={{ fontSize: 14 }}>
              {ws.connected ? 'Creating terminal...' : 'Connecting to server...'}
            </div>
          </div>
        )}

        {sessions.map(s => (
          <TerminalView
            key={s.id}
            sessionId={s.id}
            isActive={s.id === activeId}
            onInput={(data) => ws.writeInput(s.id, data)}
            onResize={(cols, rows) => ws.resizeTerminal(s.id, cols, rows)}
            onAck={(bytes) => ws.ackBytes(s.id, bytes)}
          />
        ))}
      </div>

      {/* Mobile shortcut bar */}
      {mobile && activeId && (
        <MobileBar onSend={handleInput} />
      )}

      {/* AI Chat panel */}
      <ChatPanel
        expanded={chatExpanded}
        onToggle={() => setChatExpanded(!chatExpanded)}
      />
    </div>
  );
}
