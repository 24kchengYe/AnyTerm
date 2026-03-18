/**
 * AI Chat panel — full integration with Claude API + voice input.
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Bot, User, ChevronDown, ChevronUp, Terminal, Check, X, Loader, AlertTriangle, Zap } from 'lucide-react';
import { useChatWS, type ChatMessage } from '../hooks/useChatWS.js';
import { VoiceButton } from './VoiceButton.js';

interface ChatPanelProps {
  expanded: boolean;
  onToggle: () => void;
  activeTerminalId: string | null;
  terminalIds: string[];
}

export const ChatPanel: React.FC<ChatPanelProps> = ({
  expanded,
  onToggle,
  activeTerminalId,
  terminalIds,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const [aiAvailable, setAiAvailable] = useState(false);
  const [whisperAvailable, setWhisperAvailable] = useState(false);
  const [targetTerminal, setTargetTerminal] = useState<string>('');
  const [pendingDangerous, setPendingDangerous] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const chat = useChatWS({
    onMessage: (msg) => {
      setMessages(prev => [...prev, msg]);
      if (msg.dangerous) setPendingDangerous(true);
    },
    onThinking: setThinking,
    onTranscription: (text) => {
      setMessages(prev => [...prev, {
        role: 'system',
        content: `Transcribed: "${text}"`,
        timestamp: new Date(),
      }]);
    },
    onAIStatus: (available, whisper) => {
      setAiAvailable(available);
      setWhisperAvailable(whisper);
      if (!available) {
        setMessages([{
          role: 'system',
          content: 'AI not configured. Set ANTHROPIC_API_KEY environment variable on the server.',
          timestamp: new Date(),
        }]);
      }
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, thinking]);

  useEffect(() => {
    if (expanded) inputRef.current?.focus();
  }, [expanded]);

  const effectiveTarget = targetTerminal || activeTerminalId || undefined;

  const handleSend = useCallback(() => {
    if (!input.trim() || thinking) return;
    setMessages(prev => [...prev, {
      role: 'user',
      content: input,
      timestamp: new Date(),
    }]);
    chat.sendMessage(input, effectiveTarget);
    setInput('');
  }, [input, thinking, chat, effectiveTarget]);

  const handleVoice = useCallback((audio: string, format: string) => {
    chat.sendVoice(audio, format, effectiveTarget);
  }, [chat, effectiveTarget]);

  const handleConfirm = useCallback(() => {
    chat.confirmCommand();
    setPendingDangerous(false);
  }, [chat]);

  const handleReject = useCallback(() => {
    chat.rejectCommand();
    setPendingDangerous(false);
  }, [chat]);

  const s = styles;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      background: '#1a1b26',
      borderTop: '1px solid #292d3e',
      height: expanded ? 320 : 36,
      transition: 'height 0.2s ease',
      flexShrink: 0,
    }}>
      {/* Header */}
      <div onClick={onToggle} style={s.header}>
        <div style={s.headerLeft}>
          <Bot size={14} />
          <span style={{ fontWeight: 500 }}>AI Chat</span>
          {aiAvailable
            ? <Zap size={11} color="#9ece6a" />
            : <span style={{ fontSize: 11, color: '#565f89' }}>(no API key)</span>
          }
          {thinking && <Loader size={12} style={{ animation: 'spin 1s linear infinite' }} />}
        </div>
        {expanded ? <ChevronDown size={14} color="#565f89" /> : <ChevronUp size={14} color="#565f89" />}
      </div>

      {expanded && (
        <>
          {/* Messages */}
          <div style={s.messageArea}>
            {messages.map((msg, i) => (
              <div key={i} style={s.messageRow}>
                {msg.role === 'assistant' && <Bot size={15} color="#7aa2f7" style={{ marginTop: 2, flexShrink: 0 }} />}
                {msg.role === 'user' && <User size={15} color="#9ece6a" style={{ marginTop: 2, flexShrink: 0 }} />}
                {msg.role === 'system' && <Terminal size={15} color="#565f89" style={{ marginTop: 2, flexShrink: 0 }} />}
                <div style={{ fontSize: 13, lineHeight: 1.5, wordBreak: 'break-word', color: msg.role === 'system' ? '#565f89' : '#c0caf5' }}>
                  {msg.content}
                  {msg.command && (
                    <div style={s.commandBlock}>
                      <code style={{ color: '#e0af68' }}>{msg.command}</code>
                      {msg.dangerous && (
                        <div style={s.dangerBadge}>
                          <AlertTriangle size={12} />
                          <span>Dangerous — confirm?</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {thinking && (
              <div style={s.messageRow}>
                <Bot size={15} color="#7aa2f7" style={{ marginTop: 2 }} />
                <div style={s.thinkingDots}>
                  <span className="dot" />
                  <span className="dot" />
                  <span className="dot" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Dangerous command confirmation bar */}
          {pendingDangerous && (
            <div style={s.confirmBar}>
              <span style={{ fontSize: 12, color: '#f7768e' }}>
                <AlertTriangle size={13} style={{ verticalAlign: 'middle' }} /> Execute dangerous command?
              </span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={handleConfirm} style={s.confirmBtn}>
                  <Check size={13} /> Yes
                </button>
                <button onClick={handleReject} style={s.rejectBtn}>
                  <X size={13} /> No
                </button>
              </div>
            </div>
          )}

          {/* Input area */}
          <div style={s.inputArea}>
            {/* Target terminal selector */}
            {terminalIds.length > 1 && (
              <select
                value={targetTerminal}
                onChange={(e) => setTargetTerminal(e.target.value)}
                style={s.terminalSelect}
                title="Target terminal"
              >
                <option value="">Auto</option>
                {terminalIds.map(id => (
                  <option key={id} value={id}>T{id}</option>
                ))}
              </select>
            )}

            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder={aiAvailable ? 'Ask AI to run a command...' : 'AI not available (no API key)'}
              disabled={!aiAvailable || thinking}
              style={s.input}
            />

            {whisperAvailable && (
              <VoiceButton onVoiceData={handleVoice} disabled={!aiAvailable || thinking} />
            )}

            <button
              onClick={handleSend}
              disabled={!aiAvailable || thinking || !input.trim()}
              style={{
                ...s.sendBtn,
                opacity: (!aiAvailable || thinking || !input.trim()) ? 0.4 : 1,
              }}
            >
              <Send size={14} />
            </button>
          </div>
        </>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .dot {
          display: inline-block;
          width: 6px; height: 6px;
          border-radius: 50%;
          background: #565f89;
          animation: dotPulse 1.4s infinite both;
          margin: 0 2px;
        }
        .dot:nth-child(2) { animation-delay: 0.2s; }
        .dot:nth-child(3) { animation-delay: 0.4s; }
        @keyframes dotPulse {
          0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 12px',
    height: 36,
    cursor: 'pointer',
    background: '#13141c',
    borderBottom: '1px solid #292d3e',
    flexShrink: 0,
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 13,
    color: '#7aa2f7',
  },
  messageArea: {
    flex: 1,
    overflowY: 'auto',
    padding: 12,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  messageRow: {
    display: 'flex',
    gap: 8,
    alignItems: 'flex-start',
  },
  commandBlock: {
    marginTop: 6,
    padding: '6px 10px',
    background: '#1f2335',
    borderRadius: 4,
    border: '1px solid #292d3e',
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 12,
  },
  dangerBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
    fontSize: 11,
    color: '#f7768e',
  },
  thinkingDots: {
    display: 'flex',
    alignItems: 'center',
    height: 20,
    paddingTop: 4,
  },
  confirmBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '6px 12px',
    background: '#1f2335',
    borderTop: '1px solid #f7768e33',
  },
  confirmBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '3px 10px',
    background: '#9ece6a22',
    border: '1px solid #9ece6a44',
    borderRadius: 4,
    color: '#9ece6a',
    fontSize: 12,
    cursor: 'pointer',
  },
  rejectBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '3px 10px',
    background: '#f7768e22',
    border: '1px solid #f7768e44',
    borderRadius: 4,
    color: '#f7768e',
    fontSize: 12,
    cursor: 'pointer',
  },
  inputArea: {
    display: 'flex',
    padding: '8px 12px',
    gap: 6,
    borderTop: '1px solid #292d3e',
    alignItems: 'center',
  },
  terminalSelect: {
    background: '#1f2335',
    border: '1px solid #292d3e',
    borderRadius: 4,
    color: '#a9b1d6',
    fontSize: 12,
    padding: '5px 4px',
    outline: 'none',
    width: 55,
  },
  input: {
    flex: 1,
    background: '#1f2335',
    border: '1px solid #292d3e',
    borderRadius: 6,
    padding: '6px 12px',
    color: '#c0caf5',
    fontSize: 13,
    outline: 'none',
  },
  sendBtn: {
    background: '#7aa2f7',
    border: 'none',
    borderRadius: 6,
    padding: '6px 10px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    color: '#1a1b26',
  },
};
