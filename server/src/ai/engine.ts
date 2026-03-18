/**
 * AI Engine — converts natural language to shell commands using Claude API.
 * Reads terminal context (recent output) to make smarter decisions.
 *
 * SECURITY: Output from terminals is stripped of ANSI codes and truncated
 * before being sent to the API. Sensitive data warning is included in system prompt.
 */
import Anthropic from '@anthropic-ai/sdk';
import { TerminalManager } from '../terminal/manager.js';
import { getProxyFetch } from '../utils/proxy.js';

export interface AIResponse {
  type: 'command' | 'explanation' | 'error';
  text: string;
  command?: string;
  dangerous?: boolean;
  targetTerminal?: string;
}

const SYSTEM_PROMPT = `You are AnyTerm AI — a terminal assistant running on the user's computer.
Your job is to convert natural language requests into shell commands.

Rules:
1. Return a JSON object with these fields:
   - "command": the shell command to execute (string, or null if just explaining)
   - "explanation": brief explanation of what the command does (1-2 sentences)
   - "dangerous": true if the command could delete data, modify system files, kill processes, or is destructive in any way. When in doubt, mark as dangerous.
2. Use the terminal context (recent output) to understand the current state.
3. If the user asks a question that doesn't need a command, set command to null and just explain.
4. If the request is ambiguous, ask for clarification (set command to null).
5. Prefer simple, portable commands. On Windows with Git Bash, use Unix commands.
6. NEVER include sensitive data (passwords, API keys, tokens) in your response.
7. Output ONLY valid JSON, no markdown fences, no extra text.
8. Mark ALL of these as dangerous=true: rm, del, kill, pkill, shutdown, reboot, format, mkfs, dd, chmod 777, chown, iptables, registry edits, pip install, npm install -g, sudo, any command with >, >>, or |.`;

export class AIEngine {
  private client: Anthropic | null = null;
  private model: string;
  private terminalManager: TerminalManager;

  constructor(terminalManager: TerminalManager) {
    this.terminalManager = terminalManager;
    this.model = process.env.ANYTERM_AI_MODEL || 'claude-sonnet-4-20250514';
    this.initClient();
  }

  private initClient(): void {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.log('[AI] No ANTHROPIC_API_KEY set — AI chat disabled');
      return;
    }

    try {
      const proxyFetch = getProxyFetch();
      this.client = new Anthropic({
        apiKey,
        ...(proxyFetch ? { fetch: proxyFetch } : {}),
      });
      console.log(`[AI] Claude API initialized (model: ${this.model})`);
    } catch (err) {
      console.error('[AI] Failed to initialize Claude client:', err);
    }
  }

  isAvailable(): boolean {
    return this.client !== null;
  }

  async process(userMessage: string, targetTerminalId?: string): Promise<AIResponse> {
    if (!this.client) {
      return {
        type: 'error',
        text: 'AI not configured. Set ANTHROPIC_API_KEY environment variable.',
      };
    }

    // Get terminal context
    let terminalContext = '';
    const termId = targetTerminalId || this.getFirstTerminalId();
    if (termId) {
      const session = this.terminalManager.get(termId);
      if (session && session.isAlive()) {
        const recent = session.getRecentOutput(4000);
        // Strip ANSI escape codes
        const clean = recent.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '').replace(/\x1b\][^\x07]*\x07/g, '');
        terminalContext = `\n\nRecent terminal output (Terminal ${termId}):\n\`\`\`\n${clean.slice(-3000)}\n\`\`\``;
      }
    }

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [{
          role: 'user',
          content: `${userMessage}${terminalContext}`,
        }],
      });

      // Safely extract text from response
      let text = '';
      for (const block of response.content) {
        if (block.type === 'text' && typeof block.text === 'string') {
          text += block.text;
        }
      }

      if (!text) {
        return { type: 'explanation', text: 'AI returned an empty response.' };
      }

      // Parse JSON response
      try {
        // Strip markdown fences if Claude wraps in ```json
        const cleaned = text.replace(/^```json?\s*/i, '').replace(/\s*```$/i, '').trim();
        const parsed = JSON.parse(cleaned);

        const command = typeof parsed.command === 'string' ? parsed.command.trim() : undefined;
        const explanation = typeof parsed.explanation === 'string' ? parsed.explanation : text;
        const dangerous = parsed.dangerous === true || this.isLikelyDangerous(command);

        return {
          type: command ? 'command' : 'explanation',
          text: explanation,
          command: command || undefined,
          dangerous,
          targetTerminal: termId || undefined,
        };
      } catch {
        return { type: 'explanation', text };
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown API error';
      console.error('[AI] API error:', message);
      return { type: 'error', text: `AI error: ${message}` };
    }
  }

  /** Double-check dangerous patterns even if AI says safe */
  private isLikelyDangerous(command?: string): boolean {
    if (!command) return false;
    const patterns = [
      /\brm\b/, /\bdel\b/, /\bkill\b/, /\bpkill\b/, /\bshutdown\b/, /\breboot\b/,
      /\bformat\b/, /\bmkfs\b/, /\bdd\b/, /\bchmod\s+777/, /\bsudo\b/,
      /\biptables\b/, /\breg\s+(add|delete)/, />\s*\/dev\//, /\bpip\s+install/,
      /\bnpm\s+install\s+-g/, /\bcurl\b.*\|\s*(bash|sh)/, /\bwget\b.*\|\s*(bash|sh)/,
    ];
    return patterns.some(p => p.test(command));
  }

  private getFirstTerminalId(): string | undefined {
    const sessions = this.terminalManager.list();
    return sessions.length > 0 ? sessions[0].id : undefined;
  }
}
