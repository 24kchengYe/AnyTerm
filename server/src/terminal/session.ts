/**
 * Single terminal session — wraps a node-pty instance with scrollback buffer and flow control.
 * Adapted from Zync's TerminalPanelManager.
 */
import * as pty from '@lydell/node-pty';
import { getDefaultShell } from './shell.js';
import { EventEmitter } from 'events';

// Flow control constants (from Zync)
const HIGH_WATERMARK = 100_000;       // 100KB — pause PTY when pending exceeds this
const LOW_WATERMARK = 10_000;         // 10KB — resume PTY when pending drops below this
const OUTPUT_BATCH_INTERVAL = 32;     // ms (~30fps)
const OUTPUT_BATCH_SIZE = 131_072;    // 128KB safety flush
const OUTPUT_HARD_LIMIT = 1_048_576;  // 1MB drop oldest if buffer unbounded
const PAUSE_SAFETY_TIMEOUT = 5_000;   // 5s auto-resume
const MAX_SCROLLBACK_SIZE = 512_000;  // 512KB scrollback for reconnection

export interface TerminalSessionInfo {
  id: string;
  title: string;
  cwd: string;
  shell: string;
  cols: number;
  rows: number;
  alive: boolean;
  lastActivity: string;
}

export class TerminalSession extends EventEmitter {
  readonly id: string;
  private ptyProcess: pty.IPty;
  private scrollbackBuffer = '';
  private cwd: string;
  private shell: string;
  private cols: number;
  private rows: number;
  private lastActivity = new Date();
  private alive = true;

  // Flow control
  private pendingBytes = 0;
  private isPaused = false;
  private pauseSafetyTimer: ReturnType<typeof setTimeout> | null = null;

  // Output batching
  private outputBuffer = '';
  private outputFlushTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(id: string, cwd?: string, cols = 120, rows = 30) {
    super();
    this.id = id;
    // Validate dimensions
    this.cols = Math.max(20, Math.min(500, cols));
    this.rows = Math.max(5, Math.min(200, rows));

    const shell = getDefaultShell();
    this.shell = shell.name;
    this.cwd = cwd || process.cwd();

    this.ptyProcess = pty.spawn(shell.path, shell.args, {
      name: 'xterm-256color',
      cols,
      rows,
      cwd: this.cwd,
      env: {
        ...process.env,
        TERM: 'xterm-256color',
        COLORTERM: 'truecolor',
        FORCE_COLOR: '3',
        LANG: process.env.LANG || 'en_US.UTF-8',
      } as Record<string, string>,
    });

    this.setupHandlers();
  }

  private setupHandlers(): void {
    this.ptyProcess.onData((data: string) => {
      this.lastActivity = new Date();
      this.addToScrollback(data);

      // Batch output
      this.outputBuffer += data;

      if (this.outputBuffer.length > OUTPUT_HARD_LIMIT) {
        this.outputBuffer = this.outputBuffer.slice(-OUTPUT_BATCH_SIZE);
      }

      if (this.outputBuffer.length >= OUTPUT_BATCH_SIZE) {
        this.flushOutput();
      } else if (!this.outputFlushTimer) {
        this.outputFlushTimer = setTimeout(() => this.flushOutput(), OUTPUT_BATCH_INTERVAL);
      }
    });

    this.ptyProcess.onExit(({ exitCode }) => {
      this.alive = false;
      this.clearTimers();
      this.emit('exit', { id: this.id, exitCode });
    });
  }

  private flushOutput(): void {
    if (this.outputFlushTimer) {
      clearTimeout(this.outputFlushTimer);
      this.outputFlushTimer = null;
    }
    if (!this.outputBuffer) return;

    const data = this.outputBuffer;
    this.outputBuffer = '';
    this.pendingBytes += data.length;

    this.emit('output', { id: this.id, data });

    // Backpressure
    if (this.pendingBytes > HIGH_WATERMARK && !this.isPaused) {
      this.isPaused = true;
      this.ptyProcess.pause();

      if (this.pauseSafetyTimer) clearTimeout(this.pauseSafetyTimer);
      this.pauseSafetyTimer = setTimeout(() => {
        if (this.isPaused) {
          this.isPaused = false;
          this.pendingBytes = 0;
          this.ptyProcess.resume();
        }
        this.pauseSafetyTimer = null;
      }, PAUSE_SAFETY_TIMEOUT);
    }
  }

  ack(bytes: number): void {
    this.pendingBytes = Math.max(0, this.pendingBytes - bytes);
    if (this.isPaused && this.pendingBytes < LOW_WATERMARK) {
      this.isPaused = false;
      this.ptyProcess.resume();
      if (this.pauseSafetyTimer) {
        clearTimeout(this.pauseSafetyTimer);
        this.pauseSafetyTimer = null;
      }
    }
  }

  private addToScrollback(data: string): void {
    this.scrollbackBuffer += data;
    if (this.scrollbackBuffer.length > MAX_SCROLLBACK_SIZE) {
      this.scrollbackBuffer = this.scrollbackBuffer.slice(-MAX_SCROLLBACK_SIZE);
    }
  }

  getScrollback(): string {
    return this.scrollbackBuffer;
  }

  /** Get last N characters of scrollback — useful for AI context */
  getRecentOutput(maxChars = 8000): string {
    const safe = Math.max(0, Math.min(maxChars, MAX_SCROLLBACK_SIZE));
    if (this.scrollbackBuffer.length <= safe) return this.scrollbackBuffer;
    return this.scrollbackBuffer.slice(-safe);
  }

  write(data: string): void {
    if (!this.alive) return;
    this.ptyProcess.write(data);
    this.lastActivity = new Date();
  }

  resize(cols: number, rows: number): void {
    if (!this.alive) return;
    if (cols < 10 || rows < 3) return;
    this.cols = cols;
    this.rows = rows;
    this.ptyProcess.resize(cols, rows);
  }

  getInfo(): TerminalSessionInfo {
    return {
      id: this.id,
      title: `Terminal ${this.id}`,
      cwd: this.cwd,
      shell: this.shell,
      cols: this.cols,
      rows: this.rows,
      alive: this.alive,
      lastActivity: this.lastActivity.toISOString(),
    };
  }

  isAlive(): boolean {
    return this.alive;
  }

  private clearTimers(): void {
    if (this.outputFlushTimer) {
      clearTimeout(this.outputFlushTimer);
      this.outputFlushTimer = null;
    }
    if (this.pauseSafetyTimer) {
      clearTimeout(this.pauseSafetyTimer);
      this.pauseSafetyTimer = null;
    }
  }

  destroy(): void {
    this.clearTimers();
    if (this.outputBuffer) this.flushOutput();
    try {
      this.ptyProcess.kill();
    } catch { /* already dead */ }
    this.alive = false;
  }
}
