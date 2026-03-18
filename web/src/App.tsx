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
  // Track which sessions are already attached to avoid duplicate subscriptions
  const attachedRef = useRef<Set<string>>(new Set());

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
    onExit: (_id) => { /* Terminal shows as dead in session list */ },
    onSessionsUpdate: (newSessions) => {
      setSessions(newSessions);
      // Auto-select first session if none active
      if (newSessions.length > 0) {
        setActiveId(prev => {
          if (prev && newSessions.some(s => s.id === prev)) return prev;
          return newSessions[0].id;
        });
      }
    },
    onCreated: (id) => {
      setActiveId(id);
      // Attach to new session (prevent duplicate)
      if (!attachedRef.current.has(id)) {
        ws.attachSession(id);
        attachedRef.current.add(id);
      }
    },
  });

  // On connect, attach to existing sessions (once per session)
  useEffect(() => {
    if (ws.connected && sessions.length > 0) {
      for (const s of sessions) {
        if (!attachedRef.current.has(s.id)) {
          ws.attachSession(s.id);
          attachedRef.current.add(s.id);
        }
      }
    }
    // Reset attached set on disconnect
    if (!ws.connected) {
      attachedRef.current.clear();
    }
  }, [ws.connected, sessions]);

  const handleCreate = useCallback(() => { ws.createSession(); }, [ws]);

  const handleClose = useCallback((id: string) => {
    ws.destroySession(id);
    attachedRef.current.delete(id);
    setActiveId(prev => {
      if (prev !== id) return prev;
      const remaining = sessions.filter(s => s.id !== id);
      return remaining.length > 0 ? remaining[0].id : null;
    });
  }, [ws, sessions]);

  const handleInput = useCallback((data: string) => {
    if (activeId) ws.writeInput(activeId, data);
  }, [ws, activeId]);

  // Auto-create first terminal
  useEffect(() => {
    if (ws.connected && sessions.length === 0) {
      const timer = setTimeout(() => ws.createSession(), 300);
      return () => clearTimeout(timer);
    }
  }, [ws.connected, sessions.length]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      width: '100vw',
      overflow: 'hidden',
      background: '#1a1b26',
    }}>
      <TerminalTabs
        sessions={sessions}
        activeId={activeId}
        connected={ws.connected}
        mobile={mobile}
        onSelect={(id) => {
          setActiveId(id);
          if (!attachedRef.current.has(id)) {
            ws.attachSession(id);
            attachedRef.current.add(id);
          }
        }}
        onCreate={handleCreate}
        onClose={handleClose}
        onSettings={() => setSettingsOpen(true)}
      />

      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {sessions.length === 0 && (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', height: '100%', gap: 16, color: '#565f89',
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

      {mobile && activeId && <MobileBar onSend={handleInput} />}

      {/* AI Chat — only shown if user wants it (click gear → toggle) */}
      {chatExpanded && (
        <ChatPanel
          expanded={chatExpanded}
          onToggle={() => setChatExpanded(false)}
          activeTerminalId={activeId}
          terminalIds={sessions.map(s => s.id)}
        />
      )}

      {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}
