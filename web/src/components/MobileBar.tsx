/**
 * Mobile shortcut bar — quick access to terminal control keys on touch devices.
 */
import React from 'react';

interface MobileBarProps {
  onSend: (data: string) => void;
}

const SHORTCUTS = [
  { label: 'Tab', data: '\t' },
  { label: 'Esc', data: '\x1b' },
  { label: 'Ctrl+C', data: '\x03' },
  { label: 'Ctrl+D', data: '\x04' },
  { label: 'Ctrl+Z', data: '\x1a' },
  { label: 'Ctrl+L', data: '\x0c' },
  { label: '\u2191', data: '\x1b[A' },  // Up arrow
  { label: '\u2193', data: '\x1b[B' },  // Down arrow
  { label: '\u2190', data: '\x1b[D' },  // Left arrow
  { label: '\u2192', data: '\x1b[C' },  // Right arrow
];

export const MobileBar: React.FC<MobileBarProps> = ({ onSend }) => {
  return (
    <div style={{
      display: 'flex',
      gap: 4,
      padding: '6px 8px',
      background: '#13141c',
      borderTop: '1px solid #292d3e',
      overflowX: 'auto',
      flexShrink: 0,
      WebkitOverflowScrolling: 'touch',
    }}>
      {SHORTCUTS.map(s => (
        <button
          key={s.label}
          onClick={() => onSend(s.data)}
          style={{
            background: '#1f2335',
            border: '1px solid #292d3e',
            borderRadius: 4,
            color: '#a9b1d6',
            fontSize: 12,
            padding: '4px 10px',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            flexShrink: 0,
            touchAction: 'manipulation',
          }}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
};
