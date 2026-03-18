import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.js';

// Auto-save token from URL query (?token=xxx) to localStorage
const params = new URLSearchParams(window.location.search);
const urlToken = params.get('token');
if (urlToken) {
  localStorage.setItem('anyterm_token', urlToken);
  // Clean URL
  window.history.replaceState({}, '', window.location.pathname);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
