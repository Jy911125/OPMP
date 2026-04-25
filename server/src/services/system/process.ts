import * as fs from 'fs/promises';
import { CommandExecutor } from '../../utils/executor';
import { validateCommandArgs } from '../../config/whitelist';
import type { ProcessInfo } from '../../types/system';

export class ProcessService {
  async getProcessList(): Promise<ProcessInfo[]> {
    const result = await CommandExecutor.execute('ps', ['auxwww']);
    const lines = result.stdout.split('\n').filter((l: string) => l.trim()).slice(1);
    const processes: ProcessInfo[] = [];

    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 11) {
        processes.push({
          pid: parseInt(parts[1]),
          ppid: await this.getParentPid(parseInt(parts[1])),
          name: parts[10].split('/').pop() || parts[10],
          cmd: parts.slice(10).join(' '),
          user: parts[0],
          state: await this.getProcessState(parseInt(parts[1])),
          cpuPercent: parseFloat(parts[2]),
          memPercent: parseFloat(parts[3]),
          memRSS: parseInt(parts[5]) * 1024,
          memVMS: parseInt(parts[4]) * 1024,
          startTime: Date.now() - await this.getProcessUptime(parseInt(parts[1])),
          threads: await this.getProcessThreads(parseInt(parts[1])),
        });
      }
    }

    return processes;
  }

  async getProcessByPid(pid: number): Promise<ProcessInfo | null> {
    const result = await CommandExecutor.execute('ps', ['-p', String(pid), '-o', 'pid,ppid,user,%cpu,%mem,vsz,rss,stat,start,cmd']);

    const lines = result.stdout.split('\n').filter((l: string) => l.trim());
    if (lines.length < 2) return null;

    const parts = lines[1].trim().split(/\s+/);
    return {
      pid: parseInt(parts[0]),
      ppid: parseInt(parts[1]),
      name: parts.slice(8).join(' ').split('/').pop() || parts.slice(8).join(' '),
      cmd: parts.slice(8).join(' '),
      user: parts[2],
      state: parts[6],
      cpuPercent: parseFloat(parts[3]),
      memPercent: parseFloat(parts[4]),
      memRSS: parseInt(parts[5]) * 1024,
      memVMS: parseInt(parts[4]) * 1024,
      startTime: Date.now(),
      threads: await this.getProcessThreads(pid),
    };
  }

  async killProcess(pid: number, signal: 'SIGTERM' | 'SIGKILL' = 'SIGTERM'): Promise<void> {
    const signalArg = signal === 'SIGKILL' ? '-9' : '-15';
    const validation = validateCommandArgs('kill', [signalArg, String(pid)]);

    if (!validation.valid) {
      throw new Error(validation.reason);
    }

    await CommandExecutor.execute('kill', [signalArg, String(pid)], { sudo: true });
  }

  async getProcessChildren(pid: number): Promise<ProcessInfo[]> {
    const result = await CommandExecutor.execute('ps', ['--ppid', String(pid), '-o', 'pid,ppid,user,%cpu,%mem,cmd']);

    const lines = result.stdout.split('\n').filter((l: string) => l.trim()).slice(1);
    const children: ProcessInfo[] = [];

    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 6) {
        const childPid = parseInt(parts[0]);
        children.push({
          pid: childPid,
          ppid: parseInt(parts[1]),
          name: parts.slice(5).join(' ').split('/').pop() || '',
          cmd: parts.slice(5).join(' '),
          user: parts[2],
          state: 'unknown',
          cpuPercent: parseFloat(parts[3]),
          memPercent: parseFloat(parts[4]),
          memRSS: 0,
          memVMS: 0,
          startTime: Date.now(),
          threads: await this.getProcessThreads(childPid),
        });
      }
    }

    return children;
  }

  private async getParentPid(pid: number): Promise<number> {
    try {
      const content = await fs.readFile(`/proc/${pid}/stat`, 'utf-8');
      const parts = content.split(' ');
      return parseInt(parts[3]) || 0;
    } catch {
      return 0;
    }
  }

  private async getProcessState(pid: number): Promise<string> {
    try {
      const content = await fs.readFile(`/proc/${pid}/stat`, 'utf-8');
      const parts = content.split(' ');
      return parts[2] || 'unknown';
    } catch {
      return 'unknown';
    }
  }

  private async getProcessUptime(pid: number): Promise<number> {
    try {
      const stat = await fs.stat(`/proc/${pid}`);
      return Date.now() - stat.birthtime.getTime();
    } catch {
      return 0;
    }
  }

  private async getProcessThreads(pid: number): Promise<number> {
    try {
      const entries = await fs.readdir(`/proc/${pid}/task`);
      return entries.length;
    } catch {
      return 1;
    }
  }
}

export const processService = new ProcessService();
