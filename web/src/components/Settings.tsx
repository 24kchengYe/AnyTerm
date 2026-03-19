/**
 * Settings panel — theme, font size, remote access info.
 */
import React, { useState, useEffect } from 'react';
import { X, Moon, Sun, Monitor, Globe, Key } from 'lucide-react';

interface SettingsPanelProps {
  onClose: () => void;
}

interface ServerInfo {
  ai: boolean;
  whisper: boolean;
  version: string;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ onClose }) => {
  const [serverInfo, setServerInfo] = useState<ServerInfo | null>(null);

  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then(setServerInfo)
      .catch(() => {});
  }, []);

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.6)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
    }} onClick={onClose}>
      <div
        style={{
          background: '#141414',
          borderRadius: 12,
          border: '1px solid #2a2a2a',
          width: 420,
          maxWidth: '90vw',
          maxHeight: '80vh',
          overflowY: 'auto',
          padding: 24,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: '#f0f0f0', margin: 0 }}>Settings</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#777', cursor: 'pointer', padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        {/* Server Info */}
        {serverInfo && (
          <Section title="Server Status">
            <InfoRow icon={<Monitor size={14} />} label="Version" value={`v${serverInfo.version}`} />
            <InfoRow icon={<Globe size={14} />} label="AI (Claude)" value={serverInfo.ai ? 'Enabled' : 'Disabled'} color={serverInfo.ai ? '#50fa7b' : '#ff5555'} />
            <InfoRow icon={<Globe size={14} />} label="Voice (Whisper)" value={serverInfo.whisper ? 'Enabled' : 'Disabled'} color={serverInfo.whisper ? '#50fa7b' : '#ff5555'} />
          </Section>
        )}

        {/* Remote Access */}
        <Section title="Remote Access">
          <p style={{ fontSize: 13, color: '#ccc', lineHeight: 1.6, margin: 0 }}>
            To access AnyTerm from your phone or other devices:
          </p>
          <div style={{ marginTop: 10, fontSize: 12, color: '#777', lineHeight: 1.8 }}>
            <b style={{ color: '#6272a4' }}>Same WiFi:</b> Open <code style={codeStyle}>http://YOUR_PC_IP:{window.location.port || '7860'}</code> in phone browser<br/>
            <b style={{ color: '#6272a4' }}>Remote (Tailscale):</b><br/>
            <code style={codeStyle}>
              # Install Tailscale on PC and phone{'\n'}
              # Then access via Tailscale IP:{'\n'}
              http://100.x.x.x:{window.location.port || '7860'}
            </code><br/>
            <b style={{ color: '#6272a4' }}>Remote (ZeroTier):</b> Similar to Tailscale, use ZeroTier IP<br/>
            <b style={{ color: '#6272a4' }}>Remote (FRP):</b> Configure frpc to forward the server port
          </div>
        </Section>

        {/* Environment Variables */}
        <Section title="Configuration (Env Vars)">
          <div style={{ fontSize: 12, color: '#ccc', lineHeight: 2 }}>
            <EnvRow name="ANTHROPIC_API_KEY" desc="Enable AI chat" />
            <EnvRow name="ANYTERM_WHISPER_MODEL" desc="Whisper model path for voice" />
            <EnvRow name="ANYTERM_WHISPER_EXE" desc="whisper-cli path (default: whisper-cli)" />
            <EnvRow name="ANYTERM_WHISPER_LANG" desc="Language code (default: zh)" />
            <EnvRow name="ANYTERM_PORT" desc="Server port (default: 7860)" />
            <EnvRow name="ANYTERM_FFMPEG_PATH" desc="FFmpeg path (auto-detected)" />
          </div>
        </Section>

        {/* Keyboard shortcuts */}
        <Section title="Tips">
          <div style={{ fontSize: 12, color: '#ccc', lineHeight: 2 }}>
            Mobile touch bar provides: Tab, Esc, Ctrl+C/D/Z/L, Arrow keys<br/>
            Click the AI Chat bar at bottom to toggle chat panel<br/>
            Paste works with Ctrl+V / long-press on mobile
          </div>
        </Section>
      </div>
    </div>
  );
};

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div style={{ marginBottom: 20 }}>
    <h3 style={{ fontSize: 13, fontWeight: 600, color: '#6272a4', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>{title}</h3>
    {children}
  </div>
);

const InfoRow: React.FC<{ icon: React.ReactNode; label: string; value: string; color?: string }> = ({ icon, label, value, color }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginBottom: 4 }}>
    <span style={{ color: '#777' }}>{icon}</span>
    <span style={{ color: '#ccc' }}>{label}:</span>
    <span style={{ color: color || '#f0f0f0', fontWeight: 500 }}>{value}</span>
  </div>
);

const EnvRow: React.FC<{ name: string; desc: string }> = ({ name, desc }) => (
  <div>
    <code style={{ color: '#e0af68', fontSize: 11 }}>{name}</code>
    <span style={{ color: '#777' }}> — {desc}</span>
  </div>
);

const codeStyle: React.CSSProperties = {
  background: '#0a0a0a',
  padding: '2px 6px',
  borderRadius: 3,
  fontSize: 11,
  color: '#50fa7b',
  display: 'inline-block',
  whiteSpace: 'pre',
};
