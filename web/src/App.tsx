/**
 * AnyTerm — main application component.
 */
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { TerminalTabs } from './components/TerminalTabs.js';
import { TerminalView } from './components/Terminal.js';
import { ChatPanel } from './components/ChatPanel.js';
import { MobileBar } from './components/MobileBar.js';
import { SettingsPanel } from './components/Settings.js';
import { ConfirmDialog } from './components/ConfirmDialog.js';
import { LoginPage } from './components/LoginPage.js';
import { ErrorBoundary } from './components/ErrorBoundary.js';
import { useTerminalWS, type TerminalSessionInfo } from './hooks/useTerminalWS.js';

const isMobile = () => window.innerWidth < 768;

export default function App() {
  const [authState, setAuthState] = useState<'checking' | 'needsLogin' | 'ok'>('checking');
  const [sessions, setSessions] = useState<TerminalSessionInfo[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [chatExpanded, setChatExpanded] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mobile, setMobile] = useState(isMobile());
  const [names, setNames] = useState<Record<string, string>>({});
  const [closeConfirm, setCloseConfirm] = useState<string | null>(null);
  const [whisperAvailable, setWhisperAvailable] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const attachedRef = useRef<Set<string>>(new Set());

  // Check auth on mount
  useEffect(() => {
    fetch('/api/auth-check')
      .then(r => r.json())
      .then(data => {
        if (data.authenticated) setAuthState('ok');
        else if (data.needsPassword) setAuthState('needsLogin');
        else setAuthState('ok');
      })
      .catch(() => setAuthState('ok'));
  }, []);

  // Resize detection
  useEffect(() => {
    const handler = () => setMobile(isMobile());
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  // Fetch server capabilities after auth
  useEffect(() => {
    if (authState !== 'ok') return;
    fetch('/api/settings').then(r => r.json()).then(d => setWhisperAvailable(d.whisper)).catch(() => {});
    // After login, force WS reconnect with new token
    if (!ws.connected) ws.reconnect();
  }, [authState]);

  const writeToTerminal = useCallback((id: string, data: string) => {
    const el = document.querySelector(`[data-session-id="${id}"]`) as HTMLDivElement | null;
    if (el && (el as any).__writeToTerminal) {
      (el as any).__writeToTerminal(data);
    }
  }, []);

  // Scrollback: clear terminal first, then write history (prevents duplication)
  const writeScrollback = useCallback((id: string, data: string) => {
    const el = document.querySelector(`[data-session-id="${id}"]`) as HTMLDivElement | null;
    if (el && (el as any).__clearTerminal) {
      (el as any).__clearTerminal();
    }
    if (el && (el as any).__writeToTerminal) {
      (el as any).__writeToTerminal(data);
    }
  }, []);

  // ALL hooks must be called unconditionally (React rules of hooks)
  const ws = useTerminalWS({
    onOutput: writeToTerminal,
    onScrollback: writeScrollback,
    onExit: () => {},
    onSessionsUpdate: (newSessions) => {
      setSessions(newSessions);
      // Auto-attach any new sessions (e.g., created from another device)
      for (const s of newSessions) {
        if (!attachedRef.current.has(s.id)) {
          ws.attachSession(s.id);
          attachedRef.current.add(s.id);
        }
      }
      if (newSessions.length > 0) {
        setActiveId(prev => (prev && newSessions.some(s => s.id === prev)) ? prev : newSessions[0].id);
      }
    },
    onCreated: (id) => {
      setActiveId(id);
      if (!attachedRef.current.has(id)) {
        ws.attachSession(id);
        attachedRef.current.add(id);
      }
    },
  });

  useEffect(() => {
    if (ws.connected && sessions.length > 0) {
      for (const s of sessions) {
        if (!attachedRef.current.has(s.id)) {
          ws.attachSession(s.id);
          attachedRef.current.add(s.id);
        }
      }
    }
    if (!ws.connected) attachedRef.current.clear();
  }, [ws.connected, sessions]);

  const handleCreate = useCallback(() => ws.createSession(), [ws]);

  const handleCloseRequest = useCallback((id: string) => setCloseConfirm(id), []);

  const handleCloseConfirm = useCallback(() => {
    if (!closeConfirm) return;
    const id = closeConfirm;
    setCloseConfirm(null);
    ws.destroySession(id);
    attachedRef.current.delete(id);
    setNames(prev => { const n = { ...prev }; delete n[id]; return n; });
    setActiveId(prev => {
      if (prev !== id) return prev;
      const remaining = sessions.filter(s => s.id !== id);
      return remaining.length > 0 ? remaining[0].id : null;
    });
  }, [ws, sessions, closeConfirm]);

  const handleRename = useCallback((id: string, newName: string) => {
    setNames(prev => ({ ...prev, [id]: newName }));
  }, []);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  }, []);

  const handleExport = useCallback((id: string) => {
    const el = document.querySelector(`[data-session-id="${id}"]`) as HTMLDivElement | null;
    if (el && (el as any).__getBuffer) {
      const text = (el as any).__getBuffer() as string;
      downloadText(text, `terminal-${names[id] || id}.txt`);
      showToast('Exported!');
    }
  }, [names, showToast]);

  const handleInput = useCallback((data: string) => {
    if (activeId) ws.writeInput(activeId, data);
  }, [ws, activeId]);

  const handleVoice = useCallback(async (audio: string, format: string) => {
    try {
      const res = await fetch('/api/voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audio, format }),
      });
      const data = await res.json();
      if (data.text && activeId) {
        ws.writeInput(activeId, data.text + '\r');
      }
    } catch { /* ignore */ }
  }, [activeId, ws]);

  // Auto-create first terminal when connected and authenticated
  useEffect(() => {
    if (authState === 'ok' && ws.connected && sessions.length === 0) {
      const timer = setTimeout(() => ws.createSession(), 300);
      return () => clearTimeout(timer);
    }
  }, [authState, ws.connected, sessions.length]);

  // --- RENDER ---

  // Auth gate: show login or loading BEFORE terminal UI
  if (authState === 'checking') {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0a0a0a', color: '#777' }}>Loading...</div>;
  }

  if (authState === 'needsLogin') {
    return <LoginPage onLogin={() => setAuthState('ok')} />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', overflow: 'hidden', background: '#0a0a0a' }}>
      <TerminalTabs
        sessions={sessions} activeId={activeId} connected={ws.connected} mobile={mobile} names={names}
        onSelect={(id) => { setActiveId(id); if (!attachedRef.current.has(id)) { ws.attachSession(id); attachedRef.current.add(id); } }}
        onCreate={handleCreate} onClose={handleCloseRequest} onRename={handleRename}
        onExport={handleExport} onSettings={() => setSettingsOpen(true)}
      />

      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {sessions.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 16, color: '#777' }}>
            <div style={{ fontSize: 48 }}>{'>'}_</div>
            <div style={{ fontSize: 14 }}>{ws.connected ? 'Creating terminal...' : 'Connecting to server...'}</div>
          </div>
        )}
        {sessions.map(s => (
          <ErrorBoundary key={s.id}>
            <TerminalView sessionId={s.id} isActive={s.id === activeId} mobile={mobile}
              onInput={(data) => ws.writeInput(s.id, data)}
              onResize={(cols, rows) => ws.resizeTerminal(s.id, cols, rows)}
              onAck={(bytes) => ws.ackBytes(s.id, bytes)}
            />
          </ErrorBoundary>
        ))}
      </div>

      {mobile && activeId && (
        <MobileBar onSend={handleInput} />
      )}

      {chatExpanded && (
        <ChatPanel expanded={chatExpanded} onToggle={() => setChatExpanded(false)}
          activeTerminalId={activeId} terminalIds={sessions.map(s => s.id)} />
      )}

      {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}

      {closeConfirm && (
        <ConfirmDialog
          title="Close Terminal"
          message={`Close "${names[closeConfirm] || 'Terminal ' + closeConfirm.split('-')[0]}"? The session will be terminated.`}
          onConfirm={handleCloseConfirm}
          onCancel={() => setCloseConfirm(null)}
        />
      )}

      {/* Toast notification */}
      {toast && (
        <div style={{
          position: 'fixed',
          bottom: mobile ? 120 : 60,
          left: '50%',
          transform: 'translateX(-50%)',
          background: '#50fa7b',
          color: '#0a0a0a',
          padding: '8px 20px',
          borderRadius: 8,
          fontSize: 13,
          fontWeight: 600,
          zIndex: 3000,
          pointerEvents: 'none',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        }}>
          {toast}
        </div>
      )}
    </div>
  );
}

function downloadText(text: string, filename: string) {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
