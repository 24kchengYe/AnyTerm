/**
 * Speech-to-text using local whisper.cpp — adapted from DigitalMe.
 * Converts audio to WAV 16kHz mono via ffmpeg, then runs whisper-cli.
 */
import { execFile, execSync } from 'child_process';
import { writeFile, unlink, mkdtemp } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';

export interface STTResult {
  text: string;
  language?: string;
}

export class LocalWhisper {
  private exePath: string;
  private modelPath: string;
  private ffmpegPath: string | null;
  private language: string;

  constructor(opts: {
    exePath?: string;
    modelPath: string;
    ffmpegPath?: string;
    language?: string;
  }) {
    this.exePath = opts.exePath || 'whisper-cli';
    this.modelPath = opts.modelPath;
    this.ffmpegPath = opts.ffmpegPath || null;
    this.language = opts.language || '';

    // Validate model path at init time
    import('fs').then(fs => {
      if (!fs.existsSync(this.modelPath)) {
        console.warn(`[Whisper] Model file not found: ${this.modelPath}`);
      }
    });
  }

  async transcribe(audioBuffer: Buffer, format: string): Promise<STTResult> {
    const tmpDir = await mkdtemp(path.join(tmpdir(), 'anyterm-stt-'));
    const inputFile = path.join(tmpDir, `input.${format}`);
    const wavFile = path.join(tmpDir, 'input.wav');

    try {
      // Write audio to temp file
      await writeFile(inputFile, audioBuffer);

      // Convert to WAV 16kHz mono
      const ffmpeg = await this.findFFmpeg();
      await this.convertToWav(ffmpeg, inputFile, wavFile);

      // Run whisper
      const text = await this.runWhisper(wavFile);
      return { text: text.trim(), language: this.language || undefined };
    } finally {
      // Cleanup temp files — log failures for debugging
      for (const f of [inputFile, wavFile]) {
        try { await unlink(f); } catch (e: any) {
          if (e.code !== 'ENOENT') console.warn(`[Whisper] Failed to clean up ${f}: ${e.message}`);
        }
      }
      try {
        const { rmdir } = await import('fs/promises');
        await rmdir(tmpDir);
      } catch (e: any) {
        if (e.code !== 'ENOENT' && e.code !== 'ENOTEMPTY') {
          console.warn(`[Whisper] Failed to clean up tmpdir: ${e.message}`);
        }
      }
    }
  }

  private convertToWav(ffmpegPath: string, input: string, output: string): Promise<void> {
    return new Promise((resolve, reject) => {
      execFile(ffmpegPath, [
        '-i', input,
        '-ar', '16000',       // 16kHz
        '-ac', '1',           // mono
        '-sample_fmt', 's16', // 16-bit signed
        '-f', 'wav',
        '-y', output,
      ], { timeout: 30000 }, (err) => {
        if (err) reject(new Error(`FFmpeg conversion failed: ${err.message}`));
        else resolve();
      });
    });
  }

  private runWhisper(wavFile: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const args = [
        '-m', this.modelPath,
        '-f', wavFile,
        '--no-timestamps',
        '-nt',
      ];
      if (this.language) {
        args.push('-l', this.language);
      }

      execFile(this.exePath, args, { timeout: 60000 }, (err, stdout, stderr) => {
        if (err) {
          reject(new Error(`Whisper failed: ${err.message}\n${stderr}`));
        } else {
          // whisper-cli outputs text to stdout, strip leading/trailing whitespace
          resolve(stdout.trim());
        }
      });
    });
  }

  private async findFFmpeg(): Promise<string> {
    if (this.ffmpegPath) return this.ffmpegPath;

    // Check PATH
    try {
      const which = process.platform === 'win32' ? 'where ffmpeg' : 'which ffmpeg';
      const result = execSync(which, { encoding: 'utf8', timeout: 3000 }).trim().split('\n')[0];
      if (result) return result;
    } catch { /* not in PATH */ }

    // Common Windows locations
    if (process.platform === 'win32') {
      const fs = await import('fs');
      for (const candidate of [
        'D:\\ffmpeg\\ffmpeg.exe',
        'D:\\ffmpeg\\bin\\ffmpeg.exe',
        'C:\\ffmpeg\\ffmpeg.exe',
        'C:\\ffmpeg\\bin\\ffmpeg.exe',
      ]) {
        if (fs.existsSync(candidate)) return candidate;
      }
    }

    throw new Error('ffmpeg not found. Install ffmpeg or set ANYTERM_FFMPEG_PATH.');
  }
}

/**
 * Check if whisper.cpp is available on the system.
 */
export function checkWhisperAvailable(exePath = 'whisper-cli'): boolean {
  try {
    execSync(`${exePath} --help`, { timeout: 5000, stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}
