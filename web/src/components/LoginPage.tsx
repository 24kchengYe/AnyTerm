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
      height: '100vh', width: '100vw', background: '#0c0c0c',
    }}>
      <div style={{
        background: '#161616', borderRadius: 12, border: '1px solid #1a2a1a',
        padding: 32, width: 320, maxWidth: '85vw', textAlign: 'center',
      }}>
        <Lock size={32} color="#00aaff" style={{ marginBottom: 16 }} />
        <h2 style={{ color: '#e0e0e0', fontSize: 18, margin: '0 0 8px', fontWeight: 600 }}>AnyTerm</h2>
        <p style={{ color: '#666', fontSize: 13, margin: '0 0 20px' }}>Enter password to access terminal</p>

        <input
          ref={inputRef}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
          placeholder="Password"
          style={{
            width: '100%', padding: '10px 14px', borderRadius: 8,
            background: '#1a2a1a', border: '1px solid #2a4a2a',
            color: '#e0e0e0', fontSize: 15, outline: 'none',
            textAlign: 'center', letterSpacing: 2,
          }}
        />

        {error && <p style={{ color: '#ff3333', fontSize: 13, margin: '10px 0 0' }}>{error}</p>}

        <button
          onClick={handleSubmit}
          disabled={loading || !password.trim()}
          style={{
            width: '100%', padding: '10px', borderRadius: 8, marginTop: 14,
            background: loading ? '#1a2a1a' : '#00aaff', border: 'none',
            color: '#0c0c0c', fontSize: 14, fontWeight: 600,
            cursor: loading ? 'default' : 'pointer',
          }}
        >
          {loading ? 'Connecting...' : 'Login'}
        </button>
      </div>
    </div>
  );
};
