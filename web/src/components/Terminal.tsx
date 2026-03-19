/**
 * Terminal component — xterm.js wrapper with WebGL, FitAddon, flow control ack.
 *
 * MULTI-DEVICE STRATEGY: "Last active client wins"
 * Both desktop and mobile use FitAddon normally to determine cols/rows.
 * The server resizes PTY to whichever client sent the most recent input.
 * This means: when you type on phone → PTY matches phone width.
 *             when you type on desktop → PTY matches desktop width.
 */
import React, { useRef, useEffect, useCallback, useState } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

const ACK_BATCH_SIZE = 10_000;
const ACK_BATCH_INTERVAL = 100;
const ACK_HEARTBEAT = 500;

interface TerminalProps {
  sessionId: string;
  isActive: boolean;
  mobile: boolean;
  onInput: (data: string) => void;
  onResize: (cols: number, rows: number) => void;
  onAck: (bytes: number) => void;
}

export const TerminalView: React.FC<TerminalProps> = React.memo(({
  sessionId, isActive, mobile, onInput, onResize, onAck,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const isActiveRef = useRef(isActive);
  const [ready, setReady] = useState(false);
  const [showMobileHint, setShowMobileHint] = useState(() => {
    if (!mobile) return false;
    return localStorage.getItem('anyterm_mobile_hint_dismissed') !== '1';
  });

  useEffect(() => { isActiveRef.current = isActive; }, [isActive]);

  useEffect(() => {
    if (!containerRef.current) return;

    let disposed = false;
    // Mobile: smaller font to fit more columns. Desktop: normal size.
    const terminal = new XTerm({
      fontSize: mobile ? 11 : 13,
      fontFamily: "Consolas, 'Cascadia Code', 'JetBrains Mono', Menlo, Monaco, 'Courier New', monospace",
      // Matrix hacker theme — green phosphor on deep black
      theme: {
        background: '#0c0c0c', foreground: '#e0e0e0', cursor: '#00ff41', cursorAccent: '#0c0c0c',
        selectionBackground: '#00ff4140',  // Green tint, clearly visible on black
        selectionForeground: '#ffffff',
        black: '#0c0c0c',       red: '#ff3333',      green: '#00ff41',    yellow: '#ffff00',
        blue: '#00aaff',         magenta: '#ff00ff',  cyan: '#00ffff',     white: '#e0e0e0',
        brightBlack: '#555555',  brightRed: '#ff6666', brightGreen: '#33ff66', brightYellow: '#ffff66',
        brightBlue: '#66ccff',   brightMagenta: '#ff66ff', brightCyan: '#66ffff', brightWhite: '#ffffff',
      },
      scrollback: 5000,
      cursorBlink: true,
      cursorStyle: 'bar',
      allowTransparency: false,
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);

    // Keyboard shortcuts
    terminal.attachCustomKeyEventHandler((e: KeyboardEvent) => {
      const ctrlOrMeta = e.ctrlKey || e.metaKey;
      if (ctrlOrMeta && e.key.toLowerCase() === 'c' && terminal.hasSelection()) {
        const sel = terminal.getSelection();
        if (sel) navigator.clipboard.writeText(sel).catch(() => {});
        terminal.clearSelection();
        return false;
      }
      if (ctrlOrMeta && e.key.toLowerCase() === 'v') return false;
      if (ctrlOrMeta && e.key.toLowerCase() === 'a') { terminal.selectAll(); return false; }
      return true;
    });

    terminal.open(containerRef.current);

    // Fit terminal to container — works for both desktop and mobile
    const doFit = () => {
      if (disposed || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      if (rect.width > 50 && rect.height > 30) {
        fitAddon.fit();
        const dims = fitAddon.proposeDimensions();
        if (dims) onResize(dims.cols, dims.rows);
      }
    };
    requestAnimationFrame(() => {
      doFit();
      requestAnimationFrame(() => { doFit(); setTimeout(doFit, 200); });
    });

    // WebGL + WebLinks
    (async () => {
      try {
        const { WebglAddon } = await import('@xterm/addon-webgl');
        if (!disposed) {
          const addon = new WebglAddon();
          addon.onContextLoss(() => { try { addon.dispose(); } catch {} });
          terminal.loadAddon(addon);
        }
      } catch {}
      try {
        const { WebLinksAddon } = await import('@xterm/addon-web-links');
        if (!disposed) terminal.loadAddon(new WebLinksAddon());
      } catch {}
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

    const el = containerRef.current;
    // Full clear (used before scrollback replay to prevent duplication)
    (el as any).__clearTerminal = () => {
      // Write ANSI clear screen + move cursor to top + clear scrollback
      terminal.write('\x1b[2J\x1b[H\x1b[3J');
      terminal.clear();
    };

    (el as any).__writeToTerminal = (data: string) => {
      pendingAckBytes += data.length;
      if (pendingAckBytes >= ACK_BATCH_SIZE) flushAck();
      else if (!ackTimer) ackTimer = setTimeout(flushAck, ACK_BATCH_INTERVAL);
      terminal.write(data);
    };

    (el as any).__getBuffer = (): string => {
      const buf = terminal.buffer.active;
      const lines: string[] = [];
      for (let i = 0; i < buf.length; i++) {
        const line = buf.getLine(i);
        if (line) lines.push(line.translateToString(true));
      }
      return lines.join('\n');
    };

    const inputDisposable = terminal.onData(onInput);

    // Resize observer
    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const throttledResize = () => {
      if (resizeTimer) return;
      resizeTimer = setTimeout(() => {
        resizeTimer = null;
        doFit();
      }, 100);
    };
    const resizeObserver = new ResizeObserver(throttledResize);
    resizeObserver.observe(containerRef.current);

    // Paste handler
    const handlePaste = (e: ClipboardEvent) => {
      try {
        const text = e.clipboardData?.getData('text');
        if (text && terminal && !disposed) { e.preventDefault(); terminal.paste(text); }
      } catch {}
    };
    el.addEventListener('paste', handlePaste);

    setReady(true);

    return () => {
      disposed = true;
      clearInterval(heartbeat);
      flushAck();
      if (ackTimer) clearTimeout(ackTimer);
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeObserver.disconnect();
      inputDisposable.dispose();
      el.removeEventListener('paste', handlePaste);
      (el as any).__writeToTerminal = undefined;
      (el as any).__clearTerminal = undefined;
      (el as any).__getBuffer = undefined;
      terminal.dispose();
      fitAddon.dispose();
      xtermRef.current = null;
      fitAddonRef.current = null;
    };
  }, [sessionId]);

  // Re-fit on becoming active
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

  const dismissHint = useCallback(() => {
    setShowMobileHint(false);
    localStorage.setItem('anyterm_mobile_hint_dismissed', '1');
  }, []);

  return (
    <div style={{
      width: '100%', height: '100%',
      display: isActive ? 'flex' : 'none',
      flexDirection: 'column',
    }}>
      {showMobileHint && (
        <div style={{
          background: '#1f2335', borderBottom: '1px solid #292d3e',
          padding: '6px 12px', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', fontSize: 12, color: '#7aa2f7', flexShrink: 0,
        }}>
          <span>Terminal auto-fits your screen. Rotate for wider view.</span>
          <button onClick={dismissHint} style={{ background: 'none', border: 'none', color: '#565f89', cursor: 'pointer', padding: '0 4px', fontSize: 14 }} aria-label="Dismiss">×</button>
        </div>
      )}
      <div
        ref={containerRef}
        data-session-id={sessionId}
        style={{ width: '100%', flex: 1, minHeight: 0 }}
      />
    </div>
  );
});

TerminalView.displayName = 'TerminalView';
