/**
 * Login page — shown when remote access requires a password.
 */
import React, { useState, useRef, useEffect } from 'react';
import { Lock } from 'lucide-react';

interface LoginPageProps {
  onLogin: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const handleSubmit = async () => {
    if (!password.trim()) return;
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        // Also save to localStorage for WebSocket connections
        localStorage.setItem('anyterm_token', password);
        onLogin();
      } else {
        setError('Wrong password');
        setPassword('');
        inputRef.current?.focus();
      }
    } catch {
      setError('Cannot connect to server');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', width: '100vw', background: '#0a0a0a',
    }}>
      <div style={{
        background: '#141414', borderRadius: 12, border: '1px solid #2a2a2a',
        padding: 32, width: 320, maxWidth: '85vw', textAlign: 'center',
      }}>
        <Lock size={32} color="#6272a4" style={{ marginBottom: 16 }} />
        <h2 style={{ color: '#f0f0f0', fontSize: 18, margin: '0 0 8px', fontWeight: 600 }}>AnyTerm</h2>
        <p style={{ color: '#777', fontSize: 13, margin: '0 0 20px' }}>Enter password to access terminal</p>

        <input
          ref={inputRef}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
          placeholder="Password"
          style={{
            width: '100%', padding: '10px 14px', borderRadius: 8,
            background: '#2a2a2a', border: '1px solid #444',
            color: '#f0f0f0', fontSize: 15, outline: 'none',
            textAlign: 'center', letterSpacing: 2,
          }}
        />

        {error && <p style={{ color: '#ff5555', fontSize: 13, margin: '10px 0 0' }}>{error}</p>}

        <button
          onClick={handleSubmit}
          disabled={loading || !password.trim()}
          style={{
            width: '100%', padding: '10px', borderRadius: 8, marginTop: 14,
            background: loading ? '#2a2a2a' : '#6272a4', border: 'none',
            color: '#0a0a0a', fontSize: 14, fontWeight: 600,
            cursor: loading ? 'default' : 'pointer',
          }}
        >
          {loading ? 'Connecting...' : 'Login'}
        </button>
      </div>
    </div>
  );
};
