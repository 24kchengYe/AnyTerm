/**
 * Mobile input bar — command input, shortcuts, and output viewer for easy copy.
 */
import React, { useState, useCallback, useRef } from 'react';
import { Send, ChevronUp, ChevronDown, FileText, X } from 'lucide-react';

interface MobileBarProps {
  onSend: (data: string) => void;
  getBuffer?: () => string;
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

export const MobileBar: React.FC<MobileBarProps> = ({ onSend, getBuffer }) => {
  const [input, setInput] = useState('');
  const [showShortcuts, setShowShortcuts] = useState(true);
  const [showOutput, setShowOutput] = useState(false);
  const [outputText, setOutputText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = useCallback(() => {
    if (!input.trim()) return;
    onSend(input + '\r');
    setInput('');
    inputRef.current?.focus();
  }, [input, onSend]);

  const handleViewOutput = useCallback(() => {
    if (getBuffer) {
      const text = getBuffer();
      // Get last 200 lines for readability
      const lines = text.split('\n');
      setOutputText(lines.slice(-200).join('\n'));
      setShowOutput(true);
    }
  }, [getBuffer]);

  return (
    <div style={{ background: '#060606', borderTop: '1px solid #1a2a1a', flexShrink: 0 }}>
      {/* Output viewer overlay — plain text, easy to select & copy */}
      {showOutput && (
        <div style={{
          position: 'fixed', inset: 0, background: '#0c0c0c', zIndex: 2000,
          display: 'flex', flexDirection: 'column',
        }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '12px 16px', borderBottom: '1px solid #1a2a1a',
          }}>
            <span style={{ color: '#00ff41', fontSize: 14, fontWeight: 600 }}>Terminal Output (long-press to select)</span>
            <button onClick={() => setShowOutput(false)} style={{
              background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', padding: 4,
            }}>
              <X size={20} />
            </button>
          </div>
          <pre style={{
            flex: 1, overflow: 'auto', padding: 16, margin: 0,
            color: '#e0e0e0', fontSize: 12, lineHeight: 1.5,
            fontFamily: "Consolas, 'Courier New', monospace",
            WebkitUserSelect: 'text', userSelect: 'text',  // Enable text selection
            whiteSpace: 'pre-wrap', wordBreak: 'break-all',
          }}>
            {outputText}
          </pre>
        </div>
      )}

      {/* Shortcut buttons row */}
      {showShortcuts && (
        <div style={{
          display: 'flex', gap: 4, padding: '6px 8px',
          overflowX: 'auto', WebkitOverflowScrolling: 'touch' as any,
        }}>
          {SHORTCUTS.map(s => (
            <button key={s.label} onClick={() => onSend(s.data)} style={{
              background: '#161616', border: '1px solid #1a2a1a', borderRadius: 6,
              color: '#aaa', fontSize: 13, padding: '6px 12px', cursor: 'pointer',
              whiteSpace: 'nowrap', flexShrink: 0, touchAction: 'manipulation', minHeight: 34,
            }}>
              {s.label}
            </button>
          ))}
        </div>
      )}

      {/* Command input row */}
      <div style={{ display: 'flex', gap: 6, padding: '8px', alignItems: 'center' }}>
        <button onClick={() => setShowShortcuts(!showShortcuts)} style={{
          background: 'none', border: 'none', color: '#666',
          padding: 4, cursor: 'pointer', display: 'flex', flexShrink: 0,
        }}>
          {showShortcuts ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
        </button>

        {/* View output button */}
        {getBuffer && (
          <button onClick={handleViewOutput} title="View output (copyable)" style={{
            background: '#161616', border: '1px solid #1a2a1a', borderRadius: 8,
            padding: '10px', display: 'flex', alignItems: 'center',
            color: '#aaa', cursor: 'pointer', flexShrink: 0, minHeight: 42,
          }}>
            <FileText size={18} />
          </button>
        )}

        <input
          ref={inputRef} value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSubmit(); } }}
          placeholder="Type command..."
          autoComplete="off" autoCapitalize="off" spellCheck={false}
          style={{
            flex: 1, background: '#161616', border: '1px solid #1a2a1a',
            borderRadius: 8, padding: '10px 14px', color: '#e0e0e0',
            fontSize: 15, outline: 'none', minHeight: 42,
          }}
        />

        <button onClick={handleSubmit} disabled={!input.trim()} style={{
          background: input.trim() ? '#00aaff' : '#1a2a1a', border: 'none',
          borderRadius: 8, padding: '10px 14px', cursor: input.trim() ? 'pointer' : 'default',
          display: 'flex', alignItems: 'center', color: '#0c0c0c', minHeight: 42, flexShrink: 0,
        }}>
          <Send size={18} />
        </button>
      </div>

      <div style={{ textAlign: 'center', padding: '2px 8px 6px', fontSize: 11, color: '#666' }}>
        Tip: Use your phone's voice keyboard 🎤
      </div>
    </div>
  );
};
