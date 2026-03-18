/**
 * Terminal tab bar — create, switch, close terminal sessions.
 * Adapts to mobile with larger touch targets.
 */
import React from 'react';
import { Plus, X, Terminal as TerminalIcon, Wifi, WifiOff, Settings } from 'lucide-react';
import type { TerminalSessionInfo } from '../hooks/useTerminalWS.js';

interface TerminalTabsProps {
  sessions: TerminalSessionInfo[];
  activeId: string | null;
  connected: boolean;
  mobile: boolean;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onClose: (id: string) => void;
  onSettings?: () => void;
}

export const TerminalTabs: React.FC<TerminalTabsProps> = ({
  sessions, activeId, connected, mobile,
  onSelect, onCreate, onClose, onSettings,
}) => {
  const h = mobile ? 44 : 36;
  const fontSize = mobile ? 14 : 13;
  const pad = mobile ? '6px 12px' : '4px 8px';

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      height: h,
      background: '#13141c',
      borderBottom: '1px solid #292d3e',
      padding: '0 4px',
      gap: mobile ? 4 : 2,
      overflowX: 'auto',
      flexShrink: 0,
      WebkitOverflowScrolling: 'touch' as any,
    }}>
      {/* Connection status */}
      <div style={{ padding: '0 6px', display: 'flex', alignItems: 'center', flexShrink: 0 }}
        title={connected ? 'Connected' : 'Disconnected'}>
        {connected
          ? <Wifi size={14} color="#9ece6a" />
          : <WifiOff size={14} color="#f7768e" />
        }
      </div>

      {/* Tabs */}
      {sessions.map(s => (
        <div
          key={s.id}
          onClick={() => onSelect(s.id)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: pad,
            borderRadius: 6,
            cursor: 'pointer',
            background: s.id === activeId ? '#1f2335' : 'transparent',
            color: s.id === activeId ? '#c0caf5' : '#565f89',
            fontSize,
            whiteSpace: 'nowrap',
            transition: 'background 0.15s',
            flexShrink: 0,
            minHeight: mobile ? 36 : 28,
          }}
        >
          <TerminalIcon size={mobile ? 14 : 13} />
          <span>T{s.id.split('-')[0]}</span>
          {!mobile && (
            <button
              onClick={(e) => { e.stopPropagation(); onClose(s.id); }}
              style={{
                background: 'none', border: 'none', color: 'inherit',
                cursor: 'pointer', padding: 2, borderRadius: 3,
                display: 'flex', alignItems: 'center', opacity: 0.5,
              }}
              onMouseOver={(e) => { (e.target as HTMLElement).style.opacity = '1'; }}
              onMouseOut={(e) => { (e.target as HTMLElement).style.opacity = '0.5'; }}
            >
              <X size={12} />
            </button>
          )}
        </div>
      ))}

      {/* New terminal button */}
      <button
        onClick={onCreate}
        style={{
          background: 'none',
          border: '1px solid #292d3e',
          color: '#565f89',
          cursor: 'pointer',
          padding: pad,
          borderRadius: 6,
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          fontSize,
          flexShrink: 0,
          minHeight: mobile ? 36 : 28,
        }}
        title="New terminal"
      >
        <Plus size={mobile ? 16 : 13} />
      </button>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Settings button */}
      {onSettings && (
        <button
          onClick={onSettings}
          style={{
            background: 'none', border: 'none', color: '#565f89',
            cursor: 'pointer', padding: 6, borderRadius: 4,
            display: 'flex', alignItems: 'center', flexShrink: 0,
          }}
          title="Settings"
        >
          <Settings size={mobile ? 16 : 14} />
        </button>
      )}
    </div>
  );
};
