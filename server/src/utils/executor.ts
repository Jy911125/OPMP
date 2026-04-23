import { exec, execFile, spawn } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);

export interface ExecuteOptions {
  timeout?: number;
  maxBuffer?: number;
  cwd?: string;
  env?: Record<string, string>;
  sudo?: boolean;
}

export interface ExecuteResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  timedOut: boolean;
}

const DEFAULT_OPTIONS: ExecuteOptions = {
  timeout: 30000,
  maxBuffer: 1024 * 1024,
};

export class CommandExecutor {
  static async execute(command: string, args: string[] = [], options: ExecuteOptions = {}): Promise<ExecuteResult> {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const fullCommand = opts.sudo ? `sudo ${command} ${args.join(' ')}` : `${command} ${args.join(' ')}`;

    try {
      const { stdout, stderr } = await execAsync(fullCommand, {
        timeout: opts.timeout,
        maxBuffer: opts.maxBuffer,
        cwd: opts.cwd,
        env: { ...process.env, ...opts.env },
      });

      return {
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exitCode: 0,
        timedOut: false,
      };
    } catch (error: any) {
      if (error.killed) {
        return {
          stdout: error.stdout?.trim() || '',
          stderr: 'Command timed out',
          exitCode: -1,
          timedOut: true,
        };
      }

      return {
        stdout: error.stdout?.trim() || '',
        stderr: error.stderr?.trim() || error.message || '',
        exitCode: error.code || 1,
        timedOut: false,
      };
    }
  }

  static async executeSafe(command: string, args: string[] = [], options: ExecuteOptions = {}): Promise<ExecuteResult> {
    const opts = { ...DEFAULT_OPTIONS, ...options };

    try {
      const { stdout, stderr } = await execFileAsync(command, args, {
        timeout: opts.timeout,
        maxBuffer: opts.maxBuffer,
        cwd: opts.cwd,
        env: { ...process.env, ...opts.env },
      });

      return {
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exitCode: 0,
        timedOut: false,
      };
    } catch (error: any) {
      if (error.killed) {
        return {
          stdout: error.stdout?.trim() || '',
          stderr: 'Command timed out',
          exitCode: -1,
          timedOut: true,
        };
      }

      return {
        stdout: error.stdout?.trim() || '',
        stderr: error.stderr?.trim() || error.message || '',
        exitCode: error.code || 1,
        timedOut: false,
      };
    }
  }

  static spawn(command: string, args: string[] = [], options: ExecuteOptions = {}) {
    const cmd = options.sudo ? 'sudo' : command;
    const cmdArgs = options.sudo ? [command, ...args] : args;

    return spawn(cmd, cmdArgs, {
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  }
}
