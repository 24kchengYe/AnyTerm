/**
 * Mobile input bar — replaces tiny on-screen keyboard with a proper command input
 * and quick shortcut buttons. Voice input delegates to the phone's voice keyboard.
 */
import React, { useState, useCallback, useRef } from 'react';
import { Send, ChevronUp, ChevronDown } from 'lucide-react';

interface MobileBarProps {
  onSend: (data: string) => void;
}

const SHORTCUTS = [
  { label: 'Enter', data: '\r' },
  { label: 'Tab', data: '\t' },
  { label: 'Esc', data: '\x1b' },
  { label: 'Ctrl+C', data: '\x03' },
  { label: 'Ctrl+D', data: '\x04' },
  { label: 'Ctrl+Z', data: '\x1a' },
  { label: 'Ctrl+L', data: '\x0c' },
  { label: '\u2191', data: '\x1b[A' },
  { label: '\u2193', data: '\x1b[B' },
  { label: '\u2190', data: '\x1b[D' },
  { label: '\u2192', data: '\x1b[C' },
];

export const MobileBar: React.FC<MobileBarProps> = ({ onSend }) => {
  const [input, setInput] = useState('');
  const [showShortcuts, setShowShortcuts] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = useCallback(() => {
    if (!input.trim()) return;
    onSend(input + '\r');
    setInput('');
    inputRef.current?.focus();
  }, [input, onSend]);

  return (
    <div style={{
      background: '#050505',
      borderTop: '1px solid #2a2a2a',
      flexShrink: 0,
    }}>
      {/* Shortcut buttons row */}
      {showShortcuts && (
        <div style={{
          display: 'flex',
          gap: 4,
          padding: '6px 8px',
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch' as any,
        }}>
          {SHORTCUTS.map(s => (
            <button
              key={s.label}
              onClick={() => onSend(s.data)}
              style={{
                background: '#141414',
                border: '1px solid #2a2a2a',
                borderRadius: 6,
                color: '#ccc',
                fontSize: 13,
                padding: '6px 12px',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                flexShrink: 0,
                touchAction: 'manipulation',
                minHeight: 34,
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}

      {/* Command input row */}
      <div style={{
        display: 'flex',
        gap: 6,
        padding: '8px',
        alignItems: 'center',
      }}>
        {/* Toggle shortcuts */}
        <button
          onClick={() => setShowShortcuts(!showShortcuts)}
          style={{
            background: 'none', border: 'none', color: '#777',
            padding: 4, cursor: 'pointer', display: 'flex',
            flexShrink: 0,
          }}
        >
          {showShortcuts ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
        </button>

        {/* Text input */}
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); handleSubmit(); }
          }}
          placeholder="Type command..."
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          style={{
            flex: 1,
            background: '#141414',
            border: '1px solid #2a2a2a',
            borderRadius: 8,
            padding: '10px 14px',
            color: '#f0f0f0',
            fontSize: 15,
            outline: 'none',
            minHeight: 42,
          }}
        />

        {/* Send button */}
        <button
          onClick={handleSubmit}
          disabled={!input.trim()}
          style={{
            background: input.trim() ? '#6272a4' : '#2a2a2a',
            border: 'none',
            borderRadius: 8,
            padding: '10px 14px',
            cursor: input.trim() ? 'pointer' : 'default',
            display: 'flex',
            alignItems: 'center',
            color: '#0a0a0a',
            minHeight: 42,
            flexShrink: 0,
          }}
        >
          <Send size={18} />
        </button>
      </div>

      {/* Voice keyboard hint */}
      <div style={{
        textAlign: 'center',
        padding: '2px 8px 6px',
        fontSize: 11,
        color: '#777',
      }}>
        Tip: Use your phone's voice keyboard 🎤
      </div>
    </div>
  );
};
