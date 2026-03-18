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
      height: '100vh', width: '100vw', background: '#1a1b26',
    }}>
      <div style={{
        background: '#1f2335', borderRadius: 12, border: '1px solid #292d3e',
        padding: 32, width: 320, maxWidth: '85vw', textAlign: 'center',
      }}>
        <Lock size={32} color="#7aa2f7" style={{ marginBottom: 16 }} />
        <h2 style={{ color: '#c0caf5', fontSize: 18, margin: '0 0 8px', fontWeight: 600 }}>AnyTerm</h2>
        <p style={{ color: '#565f89', fontSize: 13, margin: '0 0 20px' }}>Enter password to access terminal</p>

        <input
          ref={inputRef}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
          placeholder="Password"
          style={{
            width: '100%', padding: '10px 14px', borderRadius: 8,
            background: '#292d3e', border: '1px solid #3b4261',
            color: '#c0caf5', fontSize: 15, outline: 'none',
            textAlign: 'center', letterSpacing: 2,
          }}
        />

        {error && <p style={{ color: '#f7768e', fontSize: 13, margin: '10px 0 0' }}>{error}</p>}

        <button
          onClick={handleSubmit}
          disabled={loading || !password.trim()}
          style={{
            width: '100%', padding: '10px', borderRadius: 8, marginTop: 14,
            background: loading ? '#292d3e' : '#7aa2f7', border: 'none',
            color: '#1a1b26', fontSize: 14, fontWeight: 600,
            cursor: loading ? 'default' : 'pointer',
          }}
        >
          {loading ? 'Connecting...' : 'Login'}
        </button>
      </div>
    </div>
  );
};
