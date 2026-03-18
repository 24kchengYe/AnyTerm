/**
 * Terminal session manager — creates, tracks, and cleans up terminal sessions.
 */
import { TerminalSession, TerminalSessionInfo } from './session.js';

let nextId = 1;

export class TerminalManager {
  private sessions = new Map<string, TerminalSession>();

  create(cwd?: string, cols?: number, rows?: number): TerminalSession {
    const id = String(nextId++);
    const session = new TerminalSession(id, cwd, cols, rows);

    session.on('exit', () => {
      console.log(`[TerminalManager] Session ${id} exited`);
      this.sessions.delete(id);
    });

    this.sessions.set(id, session);
    console.log(`[TerminalManager] Created session ${id} (total: ${this.sessions.size})`);
    return session;
  }

  get(id: string): TerminalSession | undefined {
    return this.sessions.get(id);
  }

  list(): TerminalSessionInfo[] {
    return Array.from(this.sessions.values()).map(s => s.getInfo());
  }

  destroy(id: string): boolean {
    const session = this.sessions.get(id);
    if (!session) return false;
    session.destroy();
    this.sessions.delete(id);
    console.log(`[TerminalManager] Destroyed session ${id} (total: ${this.sessions.size})`);
    return true;
  }

  destroyAll(): void {
    for (const [id, session] of this.sessions) {
      session.destroy();
      console.log(`[TerminalManager] Destroyed session ${id}`);
    }
    this.sessions.clear();
  }
}
