/**
 * AnyTerm — main application component.
 * Manages terminal sessions, WebSocket connection, layout, and settings.
 */
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { TerminalTabs } from './components/TerminalTabs.js';
import { TerminalView } from './components/Terminal.js';
import { ChatPanel } from './components/ChatPanel.js';
import { MobileBar } from './components/MobileBar.js';
import { SettingsPanel } from './components/Settings.js';
import { useTerminalWS, type TerminalSessionInfo } from './hooks/useTerminalWS.js';

const isMobile = () => window.innerWidth < 768;

export default function App() {
  const [sessions, setSessions] = useState<TerminalSessionInfo[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [chatExpanded, setChatExpanded] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mobile, setMobile] = useState(isMobile());

  // Detect mobile on resize
  useEffect(() => {
    const handler = () => setMobile(isMobile());
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  const writeToTerminal = useCallback((id: string, data: string) => {
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
    },
    onSessionsUpdate: (newSessions) => {
      setSessions(newSessions);
      if (!activeId && newSessions.length > 0) {
        setActiveId(newSessions[0].id);
      }
    },
    onCreated: (id) => {
      setActiveId(id);
      ws.attachSession(id);
    },
  });

  // On connect, attach to existing sessions
  useEffect(() => {
    if (ws.connected && sessions.length > 0) {
      for (const s of sessions) {
        ws.attachSession(s.id);
      }
    }
  }, [ws.connected]);

  const handleCreate = useCallback(() => { ws.createSession(); }, [ws]);

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

  // Auto-create first terminal
  useEffect(() => {
    if (ws.connected && sessions.length === 0) {
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
        onSelect={(id) => { setActiveId(id); ws.attachSession(id); }}
        onCreate={handleCreate}
        onClose={handleClose}
        onSettings={() => setSettingsOpen(true)}
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
        activeTerminalId={activeId}
        terminalIds={sessions.map(s => s.id)}
      />

      {/* Settings overlay */}
      {settingsOpen && (
        <SettingsPanel onClose={() => setSettingsOpen(false)} />
      )}
    </div>
  );
}
