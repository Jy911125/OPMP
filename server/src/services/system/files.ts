import * as fs from 'fs/promises';
import * as path from 'path';
import { CommandExecutor } from '../../utils/executor.js';
import { OutputParser } from '../../utils/parser.js';
import { validateCommandArgs } from '../../config/whitelist.js';
import type { FileInfo } from '../../types/system.js';

export class FilesystemService {
  private async statFile(filePath: string): Promise<FileInfo | null> {
    try {
      const normalized = path.normalize(filePath);
      await CommandExecutor.execute('stat', ['-c', '%a %U %G %s %Y %n', normalized]);

      const stat = await fs.stat(normalized);
      let owner = 'unknown';
      let group = 'unknown';

      try {
        const result = await CommandExecutor.execute('stat', ['-c', '%U %G', normalized]);
        const parts = result.stdout.trim().split(' ');
        owner = parts[0] || 'unknown';
        group = parts[1] || 'unknown';
      } catch {}

      let type: FileInfo['type'] = 'other';
      if (stat.isDirectory()) type = 'directory';
      else if (stat.isFile()) type = 'file';
      else if (stat.isSymbolicLink()) type = 'symlink';

      return {
        name: path.basename(normalized),
        path: normalized,
        type,
        size: stat.size,
        permissions: (await fs.stat(normalized)).mode.toString(8).slice(-3),
        owner,
        group,
        modified: stat.mtime,
        accessed: stat.atime,
      };
    } catch {
      return null;
    }
  }

  async listDirectory(dirPath: string): Promise<FileInfo[]> {
    const normalized = path.normalize(dirPath);
    const entries = await fs.readdir(normalized, { withFileTypes: true });
    const results: FileInfo[] = [];

    for (const entry of entries) {
      const fullPath = path.join(normalized, entry.name);
      const info = await this.statFile(fullPath);
      if (info) results.push(info);
    }

    return results.sort((a, b) => {
      if (a.type === 'directory' && b.type !== 'directory') return -1;
      if (a.type !== 'directory' && b.type === 'directory') return 1;
      return a.name.localeCompare(b.name);
    });
  }

  async readFile(filePath: string, maxSize: number = 10 * 1024 * 1024): Promise<{ content: string; size: number }> {
    const normalized = path.normalize(filePath);
    const stat = await fs.stat(normalized);

    if (stat.size > maxSize) {
      throw new Error(`File too large: ${OutputParser.formatBytes(stat.size)} > ${OutputParser.formatBytes(maxSize)}`);
    }

    const content = await fs.readFile(normalized, 'utf-8');
    return { content, size: stat.size };
  }

  async writeFile(filePath: string, content: string): Promise<void> {
    const normalized = path.normalize(filePath);
    await fs.mkdir(path.dirname(normalized), { recursive: true });
    await fs.writeFile(normalized, content, 'utf-8');
  }

  async deletePath(filePath: string, recursive: boolean = false): Promise<void> {
    const normalized = path.normalize(filePath);
    const args = recursive ? ['-r', '-f', normalized] : ['-f', normalized];
    const validation = validateCommandArgs('rm', args);

    if (!validation.valid) {
      throw new Error(validation.reason);
    }

    await CommandExecutor.execute('rm', args, { sudo: true });
  }

  async createDirectory(dirPath: string): Promise<void> {
    const normalized = path.normalize(dirPath);
    await fs.mkdir(normalized, { recursive: true });
  }

  async copyPath(src: string, dst: string, recursive: boolean = true): Promise<void> {
    const srcNorm = path.normalize(src);
    const dstNorm = path.normalize(dst);

    const args = recursive ? ['-r', srcNorm, dstNorm] : [srcNorm, dstNorm];
    const validation = validateCommandArgs('cp', args);

    if (!validation.valid) {
      throw new Error(validation.reason);
    }

    await CommandExecutor.execute('cp', args, { sudo: true });
  }

  async movePath(src: string, dst: string): Promise<void> {
    const srcNorm = path.normalize(src);
    const dstNorm = path.normalize(dst);

    await CommandExecutor.execute('mv', [srcNorm, dstNorm], { sudo: true });
  }

  async chmod(filePath: string, mode: string): Promise<void> {
    const normalized = path.normalize(filePath);
    const validation = validateCommandArgs('chmod', [mode, normalized]);

    if (!validation.valid) {
      throw new Error(validation.reason);
    }

    await CommandExecutor.execute('chmod', [mode, normalized], { sudo: true });
  }

  async chown(filePath: string, owner: string, group?: string): Promise<void> {
    const normalized = path.normalize(filePath);
    const ownerSpec = group ? `${owner}:${group}` : owner;

    await CommandExecutor.execute('chown', [ownerSpec, normalized], { sudo: true });
  }

  async searchFiles(basePath: string, pattern: string, maxDepth: number = 10): Promise<FileInfo[]> {
    const normalized = path.normalize(basePath);
    const result = await CommandExecutor.execute('find', [normalized, '-name', `*${pattern}*`, '-maxdepth', String(maxDepth)]);

    const files: FileInfo[] = [];
    for (const line of result.stdout.split('\n')) {
      if (line.trim()) {
        const info = await this.statFile(line.trim());
        if (info) files.push(info);
      }
    }

    return files;
  }

  async getDiskUsage(dirPath: string): Promise<{ size: number; files: number }[]> {
    const normalized = path.normalize(dirPath);
    const result = await CommandExecutor.execute('du', ['-s', '-b', normalized]);

    const entries: { size: number; files: number }[] = [];
    for (const line of result.stdout.split('\n').filter((l: string) => l.trim())) {
      const parts = line.trim().split('\t');
      if (parts.length >= 2) {
        entries.push({
          size: parseInt(parts[0]) || 0,
          files: 1,
        });
      }
    }

    return entries;
  }

  async exists(filePath: string): Promise<boolean> {
    try {
      const normalized = path.normalize(filePath);
      await fs.access(normalized);
      return true;
    } catch {
      return false;
    }
  }
}

export const filesystemService = new FilesystemService();
