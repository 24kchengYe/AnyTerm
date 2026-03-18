/**
 * Terminal component — xterm.js wrapper with WebGL, FitAddon, flow control ack.
 * Adapted from Zync's TerminalPanel.tsx.
 */
import React, { useRef, useEffect, useCallback, useState } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

const ACK_BATCH_SIZE = 10_000;   // 10KB
const ACK_BATCH_INTERVAL = 100;  // ms
const ACK_HEARTBEAT = 500;       // ms

interface TerminalProps {
  sessionId: string;
  isActive: boolean;
  onInput: (data: string) => void;
  onResize: (cols: number, rows: number) => void;
  onAck: (bytes: number) => void;
}

export const TerminalView: React.FC<TerminalProps> = React.memo(({
  sessionId,
  isActive,
  onInput,
  onResize,
  onAck,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const isActiveRef = useRef(isActive);
  const [ready, setReady] = useState(false);

  // Keep isActiveRef in sync
  useEffect(() => { isActiveRef.current = isActive; }, [isActive]);

  // Initialize terminal
  useEffect(() => {
    if (!containerRef.current) return;

    let disposed = false;
    const terminal = new XTerm({
      fontSize: 14,
      fontFamily: "'JetBrains Mono', Menlo, Monaco, 'Courier New', monospace",
      theme: {
        background: '#1a1b26',
        foreground: '#c0caf5',
        cursor: '#c0caf5',
        cursorAccent: '#1a1b26',
        selectionBackground: '#33467c',
        black: '#15161e',
        red: '#f7768e',
        green: '#9ece6a',
        yellow: '#e0af68',
        blue: '#7aa2f7',
        magenta: '#bb9af7',
        cyan: '#7dcfff',
        white: '#a9b1d6',
        brightBlack: '#414868',
        brightRed: '#f7768e',
        brightGreen: '#9ece6a',
        brightYellow: '#e0af68',
        brightBlue: '#7aa2f7',
        brightMagenta: '#bb9af7',
        brightCyan: '#7dcfff',
        brightWhite: '#c0caf5',
      },
      scrollback: 5000,
      cursorBlink: true,
      cursorStyle: 'bar',
      allowTransparency: false,
      fastScrollModifier: 'ctrl',
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);

    terminal.open(containerRef.current);
    fitAddon.fit();

    // Try WebGL addon
    (async () => {
      try {
        const { WebglAddon } = await import('@xterm/addon-webgl');
        if (!disposed) {
          const addon = new WebglAddon();
          addon.onContextLoss(() => {
            try { addon.dispose(); } catch { /* */ }
          });
          terminal.loadAddon(addon);
        }
      } catch { /* DOM renderer fallback */ }

      try {
        const { WebLinksAddon } = await import('@xterm/addon-web-links');
        if (!disposed) {
          terminal.loadAddon(new WebLinksAddon());
        }
      } catch { /* ignore */ }
    })();

    xtermRef.current = terminal;
    fitAddonRef.current = fitAddon;

    // Ack batching
    let pendingAckBytes = 0;
    let ackTimer: ReturnType<typeof setTimeout> | null = null;

    const flushAck = () => {
      if (ackTimer) { clearTimeout(ackTimer); ackTimer = null; }
      if (pendingAckBytes > 0) {
        const bytes = pendingAckBytes;
        pendingAckBytes = 0;
        onAck(bytes);
      }
    };

    const heartbeat = setInterval(flushAck, ACK_HEARTBEAT);

    // Expose write method via data attribute for parent to call
    const el = containerRef.current;
    (el as any).__writeToTerminal = (data: string) => {
      pendingAckBytes += data.length;
      if (pendingAckBytes >= ACK_BATCH_SIZE) {
        flushAck();
      } else if (!ackTimer) {
        ackTimer = setTimeout(flushAck, ACK_BATCH_INTERVAL);
      }
      terminal.write(data);
    };

    // Input handler
    const inputDisposable = terminal.onData(onInput);

    // Resize handler
    const throttledResize = (() => {
      let timer: ReturnType<typeof setTimeout> | null = null;
      return () => {
        if (timer) return;
        timer = setTimeout(() => {
          timer = null;
          if (fitAddon && !disposed && containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            if (rect.width < 100 || rect.height < 50) return;
            fitAddon.fit();
            const dims = fitAddon.proposeDimensions();
            if (dims) onResize(dims.cols, dims.rows);
          }
        }, 100);
      };
    })();

    const resizeObserver = new ResizeObserver(throttledResize);
    resizeObserver.observe(containerRef.current);

    // Paste handler
    const handlePaste = (e: ClipboardEvent) => {
      const text = e.clipboardData?.getData('text');
      if (text && terminal && !disposed) {
        e.preventDefault();
        terminal.paste(text);
      }
    };
    el.addEventListener('paste', handlePaste);

    // Report initial size
    const dims = fitAddon.proposeDimensions();
    if (dims) onResize(dims.cols, dims.rows);

    setReady(true);

    return () => {
      disposed = true;
      clearInterval(heartbeat);
      flushAck();
      if (ackTimer) clearTimeout(ackTimer);
      resizeObserver.disconnect();
      inputDisposable.dispose();
      el.removeEventListener('paste', handlePaste);
      terminal.dispose();
      fitAddon.dispose();
      xtermRef.current = null;
      fitAddonRef.current = null;
    };
  }, [sessionId]); // Re-create terminal when session changes

  // Re-fit when becoming active
  useEffect(() => {
    if (isActive && fitAddonRef.current && xtermRef.current) {
      requestAnimationFrame(() => {
        fitAddonRef.current?.fit();
        xtermRef.current?.focus();
        const dims = fitAddonRef.current?.proposeDimensions();
        if (dims) onResize(dims.cols, dims.rows);
      });
    }
  }, [isActive, onResize]);

  return (
    <div
      ref={containerRef}
      data-session-id={sessionId}
      style={{
        width: '100%',
        height: '100%',
        display: isActive ? 'block' : 'none',
      }}
    />
  );
});

TerminalView.displayName = 'TerminalView';
