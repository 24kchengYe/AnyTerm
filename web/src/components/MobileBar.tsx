/**
 * Mobile input bar — replaces tiny on-screen keyboard with a proper command input,
 * quick shortcut buttons, and voice input. Terminal output is still fully visible above.
 */
import React, { useState, useCallback, useRef } from 'react';
import { Send, ChevronUp, ChevronDown, Mic, MicOff } from 'lucide-react';

interface MobileBarProps {
  onSend: (data: string) => void;
  whisperAvailable?: boolean;
  onVoice?: (audio: string, format: string) => void;
}

const SHORTCUTS = [
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

export const MobileBar: React.FC<MobileBarProps> = ({ onSend, whisperAvailable, onVoice }) => {
  const [input, setInput] = useState('');
  const [showShortcuts, setShowShortcuts] = useState(true);
  const [recording, setRecording] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const toggleRecording = useCallback(async () => {
    if (recording) {
      // Stop
      mediaRecorderRef.current?.stop();
      setRecording(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm',
      });
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const buf = await blob.arrayBuffer();
        const b64 = btoa(new Uint8Array(buf).reduce((d, b) => d + String.fromCharCode(b), ''));
        onVoice?.(b64, 'webm');
        stream.getTracks().forEach(t => t.stop());
      };
      mediaRecorderRef.current = mr;
      mr.start();
      setRecording(true);
    } catch {
      setRecording(false);
    }
  }, [recording, onVoice]);

  const handleSubmit = useCallback(() => {
    if (!input.trim()) return;
    // Send as typed command + Enter
    onSend(input + '\r');
    setInput('');
    inputRef.current?.focus();
  }, [input, onSend]);

  return (
    <div style={{
      background: '#13141c',
      borderTop: '1px solid #292d3e',
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
                background: '#1f2335',
                border: '1px solid #292d3e',
                borderRadius: 6,
                color: '#a9b1d6',
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
            background: 'none', border: 'none', color: '#565f89',
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
            background: '#1f2335',
            border: '1px solid #292d3e',
            borderRadius: 8,
            padding: '10px 14px',
            color: '#c0caf5',
            fontSize: 15,
            outline: 'none',
            minHeight: 42,
          }}
        />

        {/* Voice button */}
        {whisperAvailable && onVoice && (
          <button
            onClick={toggleRecording}
            style={{
              background: recording ? '#f7768e' : '#292d3e',
              border: 'none',
              borderRadius: 8,
              padding: '10px',
              display: 'flex',
              alignItems: 'center',
              color: recording ? '#1a1b26' : '#a9b1d6',
              minHeight: 42,
              flexShrink: 0,
              cursor: 'pointer',
              animation: recording ? 'pulse 1.5s infinite' : 'none',
            }}
          >
            {recording ? <MicOff size={18} /> : <Mic size={18} />}
          </button>
        )}

        {/* Send button */}
        <button
          onClick={handleSubmit}
          disabled={!input.trim()}
          style={{
            background: input.trim() ? '#7aa2f7' : '#292d3e',
            border: 'none',
            borderRadius: 8,
            padding: '10px 14px',
            cursor: input.trim() ? 'pointer' : 'default',
            display: 'flex',
            alignItems: 'center',
            color: '#1a1b26',
            minHeight: 42,
            flexShrink: 0,
          }}
        >
          <Send size={18} />
        </button>

        <style>{`@keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:0.6 } }`}</style>
      </div>
    </div>
  );
};
