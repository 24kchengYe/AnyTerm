/**
 * Terminal tab bar — create, switch, close terminal sessions.
 */
import React from 'react';
import { Plus, X, Terminal as TerminalIcon, Wifi, WifiOff, Settings } from 'lucide-react';
import type { TerminalSessionInfo } from '../hooks/useTerminalWS.js';

interface TerminalTabsProps {
  sessions: TerminalSessionInfo[];
  activeId: string | null;
  connected: boolean;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onClose: (id: string) => void;
  onSettings?: () => void;
}

export const TerminalTabs: React.FC<TerminalTabsProps> = ({
  sessions,
  activeId,
  connected,
  onSelect,
  onCreate,
  onClose,
  onSettings,
}) => {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      height: 36,
      background: '#13141c',
      borderBottom: '1px solid #292d3e',
      padding: '0 4px',
      gap: 2,
      overflowX: 'auto',
      flexShrink: 0,
    }}>
      {/* Connection status */}
      <div style={{ padding: '0 8px', display: 'flex', alignItems: 'center' }} title={connected ? 'Connected' : 'Disconnected'}>
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
            padding: '4px 8px',
            borderRadius: 4,
            cursor: 'pointer',
            background: s.id === activeId ? '#1f2335' : 'transparent',
            color: s.id === activeId ? '#c0caf5' : '#565f89',
            fontSize: 13,
            whiteSpace: 'nowrap',
            transition: 'background 0.15s',
          }}
        >
          <TerminalIcon size={13} />
          <span>Terminal {s.id}</span>
          <button
            onClick={(e) => { e.stopPropagation(); onClose(s.id); }}
            style={{
              background: 'none',
              border: 'none',
              color: 'inherit',
              cursor: 'pointer',
              padding: 2,
              borderRadius: 3,
              display: 'flex',
              alignItems: 'center',
              opacity: 0.5,
            }}
            onMouseOver={(e) => { (e.target as HTMLElement).style.opacity = '1'; }}
            onMouseOut={(e) => { (e.target as HTMLElement).style.opacity = '0.5'; }}
            title="Close terminal"
          >
            <X size={12} />
          </button>
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
          padding: '4px 8px',
          borderRadius: 4,
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          fontSize: 13,
          transition: 'all 0.15s',
        }}
        onMouseOver={(e) => {
          (e.target as HTMLElement).style.color = '#c0caf5';
          (e.target as HTMLElement).style.borderColor = '#565f89';
        }}
        onMouseOut={(e) => {
          (e.target as HTMLElement).style.color = '#565f89';
          (e.target as HTMLElement).style.borderColor = '#292d3e';
        }}
        title="New terminal"
      >
        <Plus size={13} />
      </button>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Settings button */}
      {onSettings && (
        <button
          onClick={onSettings}
          style={{
            background: 'none',
            border: 'none',
            color: '#565f89',
            cursor: 'pointer',
            padding: 4,
            borderRadius: 4,
            display: 'flex',
            alignItems: 'center',
          }}
          title="Settings"
        >
          <Settings size={14} />
        </button>
      )}
    </div>
  );
};
