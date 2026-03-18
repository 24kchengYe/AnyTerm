/**
 * AI Engine — converts natural language to shell commands using Claude API.
 * Reads terminal context (recent output) to make smarter decisions.
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
   - "dangerous": true if the command could delete data, modify system files, or is destructive
2. Use the terminal context (recent output) to understand the current state (cwd, OS, running processes).
3. If the user asks a question that doesn't need a command, set command to null and just explain.
4. If the request is ambiguous, ask for clarification (set command to null).
5. Prefer simple, portable commands. On Windows with Git Bash, use Unix commands.
6. NEVER run commands that could harm the system without the user explicitly asking.
7. Output ONLY valid JSON, no markdown fences, no extra text.`;

export class AIEngine {
  private client: Anthropic | null = null;
  private model = 'claude-sonnet-4-20250514';
  private terminalManager: TerminalManager;

  constructor(terminalManager: TerminalManager) {
    this.terminalManager = terminalManager;
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
      console.log('[AI] Claude API initialized (model:', this.model, ')');
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
      if (session) {
        const recent = session.getRecentOutput(4000);
        // Strip ANSI escape codes for cleaner context
        const clean = recent.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');
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

      const text = response.content
        .filter(b => b.type === 'text')
        .map(b => (b as { type: 'text'; text: string }).text)
        .join('');

      // Parse JSON response
      try {
        const parsed = JSON.parse(text);
        return {
          type: parsed.command ? 'command' : 'explanation',
          text: parsed.explanation || text,
          command: parsed.command || undefined,
          dangerous: parsed.dangerous || false,
          targetTerminal: termId || undefined,
        };
      } catch {
        // If not valid JSON, treat as explanation
        return { type: 'explanation', text };
      }
    } catch (err: any) {
      console.error('[AI] API error:', err.message);
      return {
        type: 'error',
        text: `AI error: ${err.message}`,
      };
    }
  }

  private getFirstTerminalId(): string | undefined {
    const sessions = this.terminalManager.list();
    return sessions.length > 0 ? sessions[0].id : undefined;
  }
}
