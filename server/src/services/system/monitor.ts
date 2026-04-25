import * as fs from 'fs/promises';
import * as os from 'os';
import { CommandExecutor } from '../../utils/executor.js';
import { OutputParser } from '../../utils/parser.js';
import { config } from '../../config/index.js';
import type {
  CpuInfo, CoreInfo, MemoryInfo, DiskInfo,
  NetworkTraffic, SystemInfo, MonitorSnapshot
} from '../../types/system.js';

export class MonitorService {
  private history: MonitorSnapshot[] = [];
  private historySize: number;
  private interval: NodeJS.Timeout | null = null;
  private prevCpuStat: { total: number; idle: number } | null = null;
  private prevNetDev: Record<string, { rxBytes: number; txBytes: number; rxPackets: number; txPackets: number }> | null = null;
  private prevTime: number = 0;

  constructor(historySize: number = config.MONITOR_HISTORY_SIZE) {
    this.historySize = historySize;
  }

  async getCpuInfo(): Promise<CpuInfo> {
    const [statContent, uptime] = await Promise.all([
      fs.readFile('/proc/stat', 'utf-8'),
      fs.readFile('/proc/uptime', 'utf-8').then(s => parseFloat(s.split(' ')[0])),
    ]);

    const stat = OutputParser.parseCpuStat(statContent);
    let cpuUsage = 0;

    if (this.prevCpuStat) {
      const totalDiff = stat.total - this.prevCpuStat.total;
      const idleDiff = stat.idle - this.prevCpuStat.idle;
      cpuUsage = totalDiff > 0 ? ((totalDiff - idleDiff) / totalDiff) * 100 : 0;
    }

    this.prevCpuStat = stat;

    const cores: CoreInfo[] = os.cpus().map(cpu => ({
      model: cpu.model,
      speed: cpu.speed,
      times: cpu.times,
    }));

    const loadAvg = os.loadavg() as [number, number, number];

    return {
      usage: Math.max(0, Math.min(100, cpuUsage)),
      cores,
      loadAvg,
      uptime,
    };
  }

  async getMemoryInfo(): Promise<MemoryInfo> {
    const meminfo = await fs.readFile('/proc/meminfo', 'utf-8');
    const parsed = OutputParser.parseMemInfo(meminfo);

    const total = parsed['memtotal'] || 0;
    const free = parsed['memfree'] || 0;
    const available = parsed['memavailable'] || free;
    const buffers = parsed['buffers'] || 0;
    const cached = parsed['cached'] || 0;
    const swapTotal = parsed['swaptotal'] || 0;
    const swapFree = parsed['swapfree'] || 0;
    const used = total - available;
    const swapUsed = swapTotal - swapFree;

    return {
      total,
      used,
      free,
      available,
      buffers,
      cached,
      swapTotal,
      swapUsed,
      swapFree,
      usagePercent: total > 0 ? (used / total) * 100 : 0,
    };
  }

  async getDiskInfo(): Promise<DiskInfo[]> {
    const result = await CommandExecutor.execute('df -B1 --output=source,target,size,used,avail,pcent,type | grep -v tmpfs');
    const lines = result.stdout.split('\n').filter((l: string) => l.trim()).slice(1);
    const disks: DiskInfo[] = [];

    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 7) {
        disks.push({
          filesystem: parts[0],
          mountPoint: parts[1],
          total: parseInt(parts[2]) || 0,
          used: parseInt(parts[3]) || 0,
          available: parseInt(parts[4]) || 0,
          usagePercent: parseFloat(parts[5]) || 0,
          type: parts[6],
        });
      }
    }

    return disks;
  }

  async getNetworkTraffic(): Promise<NetworkTraffic[]> {
    const netDev = await fs.readFile('/proc/net/dev', 'utf-8');
    const parsed = OutputParser.parseNetDev(netDev);
    const now = Date.now();
    const result: NetworkTraffic[] = [];

    const interval = this.prevTime > 0 ? (now - this.prevTime) / 1000 : 1;

    type NetDevData = { rxBytes: number; txBytes: number; rxPackets: number; txPackets: number };
    for (const [name, data] of Object.entries(parsed) as [string, NetDevData][]) {
      let rxSpeed = 0;
      let txSpeed = 0;
      let rxPps = 0;
      let txPps = 0;

      if (this.prevNetDev && this.prevNetDev[name]) {
        const prev = this.prevNetDev[name];
        rxSpeed = (data.rxBytes - prev.rxBytes) / interval;
        txSpeed = (data.txBytes - prev.txBytes) / interval;
        rxPps = (data.rxPackets - prev.rxPackets) / interval;
        txPps = (data.txPackets - prev.txPackets) / interval;
      }

      result.push({
        interfaceName: name,
        rxBytesPerSec: rxSpeed,
        txBytesPerSec: txSpeed,
        rxPacketsPerSec: rxPps,
        txPacketsPerSec: txPps,
      });
    }

    this.prevNetDev = parsed;
    this.prevTime = now;

    return result;
  }

  async getSystemInfo(): Promise<SystemInfo> {
    const [hostname, kernel] = await Promise.all([
      CommandExecutor.execute('hostname -f'),
      CommandExecutor.execute('uname -r'),
    ]);

    return {
      hostname: hostname.stdout.trim() || os.hostname(),
      os: 'Ubuntu 24.04 LTS',
      kernel: kernel.stdout.trim(),
      arch: os.arch(),
      uptime: os.uptime(),
      currentTime: new Date().toISOString(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      locale: process.env.LANG || 'en_US.UTF-8',
      totalMemory: os.totalmem(),
      cpuModel: os.cpus()[0]?.model || 'Unknown',
      cpuCores: os.cpus().length,
    };
  }

  async getSnapshot(): Promise<MonitorSnapshot> {
    const [cpu, memory, disks, network] = await Promise.all([
      this.getCpuInfo(),
      this.getMemoryInfo(),
      this.getDiskInfo(),
      this.getNetworkTraffic(),
    ]);

    return {
      timestamp: Date.now(),
      cpu,
      memory,
      disks,
      network,
      loadAvg: cpu.loadAvg,
    };
  }

  startMonitoring(intervalMs: number = config.MONITOR_INTERVAL): void {
    if (this.interval) return;

    this.interval = setInterval(async () => {
      try {
        const snapshot = await this.getSnapshot();
        this.history.push(snapshot);
        if (this.history.length > this.historySize) {
          this.history.shift();
        }
      } catch (error) {
        console.error('Monitor error:', error);
      }
    }, intervalMs);
  }

  stopMonitoring(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  getHistory(): MonitorSnapshot[] {
    return [...this.history];
  }

  getLatestSnapshot(): MonitorSnapshot | null {
    return this.history.length > 0 ? this.history[this.history.length - 1] : null;
  }
}

export const monitorService = new MonitorService();
