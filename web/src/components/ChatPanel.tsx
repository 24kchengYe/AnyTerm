/**
 * AI Chat panel — Phase 2 stub. Shows a simple chat interface.
 */
import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, ChevronDown, ChevronUp } from 'lucide-react';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface ChatPanelProps {
  expanded: boolean;
  onToggle: () => void;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({ expanded, onToggle }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: 'AI Chat will be available in Phase 2. For now, use the terminal directly.', timestamp: new Date() },
  ]);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (!input.trim()) return;
    setMessages(prev => [...prev, { role: 'user', content: input, timestamp: new Date() }]);
    // Phase 2: send to AI engine via WebSocket
    setTimeout(() => {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: '[Phase 2] AI engine not yet connected. Your message: ' + input,
        timestamp: new Date(),
      }]);
    }, 300);
    setInput('');
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      background: '#1a1b26',
      borderTop: '1px solid #292d3e',
      height: expanded ? 280 : 36,
      transition: 'height 0.2s ease',
      flexShrink: 0,
    }}>
      {/* Header */}
      <div
        onClick={onToggle}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 12px',
          height: 36,
          cursor: 'pointer',
          background: '#13141c',
          borderBottom: expanded ? '1px solid #292d3e' : 'none',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#7aa2f7' }}>
          <Bot size={14} />
          <span>AI Chat</span>
          <span style={{ fontSize: 11, color: '#565f89' }}>(Phase 2)</span>
        </div>
        {expanded ? <ChevronDown size={14} color="#565f89" /> : <ChevronUp size={14} color="#565f89" />}
      </div>

      {/* Messages */}
      {expanded && (
        <>
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: 12,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}>
            {messages.map((msg, i) => (
              <div key={i} style={{
                display: 'flex',
                gap: 8,
                alignItems: 'flex-start',
              }}>
                {msg.role === 'assistant'
                  ? <Bot size={16} color="#7aa2f7" style={{ marginTop: 2, flexShrink: 0 }} />
                  : <User size={16} color="#9ece6a" style={{ marginTop: 2, flexShrink: 0 }} />
                }
                <div style={{
                  fontSize: 13,
                  color: '#c0caf5',
                  lineHeight: 1.5,
                  wordBreak: 'break-word',
                }}>
                  {msg.content}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div style={{
            display: 'flex',
            padding: '8px 12px',
            gap: 8,
            borderTop: '1px solid #292d3e',
          }}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder="Ask AI to run a command..."
              style={{
                flex: 1,
                background: '#1f2335',
                border: '1px solid #292d3e',
                borderRadius: 6,
                padding: '6px 12px',
                color: '#c0caf5',
                fontSize: 13,
                outline: 'none',
              }}
            />
            <button
              onClick={handleSend}
              style={{
                background: '#7aa2f7',
                border: 'none',
                borderRadius: 6,
                padding: '6px 12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                color: '#1a1b26',
              }}
            >
              <Send size={14} />
            </button>
          </div>
        </>
      )}
    </div>
  );
};
