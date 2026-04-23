export class OutputParser {
  static parseTable(output: string): Record<string, string>[] {
    const lines = output.trim().split('\n').filter(l => l.trim());
    if (lines.length < 2) return [];

    const headers = lines[0].split(/\s{2,}/).map(h => h.trim().toLowerCase().replace(/\s+/g, '_'));
    const rows: Record<string, string>[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(/\s{2,}/).map(v => v.trim());
      const row: Record<string, string> = {};
      headers.forEach((header, idx) => {
        row[header] = values[idx] || '';
      });
      rows.push(row);
    }

    return rows;
  }

  static parseKeyValue(output: string, separator: string = ':'): Record<string, string> {
    const result: Record<string, string> = {};
    for (const line of output.split('\n')) {
      const idx = line.indexOf(separator);
      if (idx !== -1) {
        const key = line.slice(0, idx).trim().toLowerCase().replace(/\s+/g, '_');
        const value = line.slice(idx + 1).trim();
        result[key] = value;
      }
    }
    return result;
  }

  static parseSize(sizeStr: string): number {
    const match = sizeStr.match(/^([\d.]+)\s*([KMGTPE]?)B?$/i);
    if (!match) return 0;

    const value = parseFloat(match[1]);
    const unit = match[2].toUpperCase();

    const multipliers: Record<string, number> = {
      '': 1, 'K': 1024, 'M': 1024 ** 2, 'G': 1024 ** 3,
      'T': 1024 ** 4, 'P': 1024 ** 5, 'E': 1024 ** 6,
    };

    return value * (multipliers[unit] || 1);
  }

  static formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i]}`;
  }

  static parsePermissionString(permStr: string): { owner: string; group: string; others: string } {
    if (permStr.length < 9) return { owner: '---', group: '---', others: '---' };
    return {
      owner: permStr.slice(0, 3),
      group: permStr.slice(3, 6),
      others: permStr.slice(6, 9),
    };
  }

  static parseCpuStat(statContent: string): { total: number; idle: number } {
    const line = statContent.split('\n')[0];
    const parts = line.split(/\s+/);
    const user = parseInt(parts[1]) || 0;
    const nice = parseInt(parts[2]) || 0;
    const system = parseInt(parts[3]) || 0;
    const idle = parseInt(parts[4]) || 0;
    const iowait = parseInt(parts[5]) || 0;
    const irq = parseInt(parts[6]) || 0;
    const softirq = parseInt(parts[7]) || 0;
    const steal = parseInt(parts[8]) || 0;

    const total = user + nice + system + idle + iowait + irq + softirq + steal;
    return { total, idle: idle + iowait };
  }

  static parseMemInfo(content: string): Record<string, number> {
    const result: Record<string, number> = {};
    for (const line of content.split('\n')) {
      const match = line.match(/^(\w+):\s+(\d+)\s+kB$/);
      if (match) {
        result[match[1].toLowerCase()] = parseInt(match[2]) * 1024;
      }
    }
    return result;
  }

  static parseNetDev(content: string): Record<string, { rxBytes: number; txBytes: number; rxPackets: number; txPackets: number }> {
    const result: Record<string, any> = {};
    const lines = content.split('\n').slice(2);

    for (const line of lines) {
      const match = line.match(/^\s*(\w+):\s*(\d+)\s+(\d+)\s+(\d+)\s+\d+\s+\d+\s+\d+\s+\d+\s+(\d+)\s+(\d+)\s+(\d+)/);
      if (match) {
        result[match[1]] = {
          rxBytes: parseInt(match[2]),
          rxPackets: parseInt(match[3]),
          txBytes: parseInt(match[5]),
          txPackets: parseInt(match[6]),
        };
      }
    }
    return result;
  }
}
