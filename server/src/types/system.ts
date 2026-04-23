export interface CpuInfo {
  usage: number;
  cores: CoreInfo[];
  loadAvg: [number, number, number];
  uptime: number;
}

export interface CoreInfo {
  model: string;
  speed: number;
  times: {
    user: number;
    nice: number;
    sys: number;
    idle: number;
    irq: number;
  };
}

export interface MemoryInfo {
  total: number;
  used: number;
  free: number;
  available: number;
  buffers: number;
  cached: number;
  swapTotal: number;
  swapUsed: number;
  swapFree: number;
  usagePercent: number;
}

export interface DiskInfo {
  filesystem: string;
  mountPoint: string;
  total: number;
  used: number;
  available: number;
  usagePercent: number;
  type: string;
}

export interface DiskIO {
  device: string;
  readSpeed: number;
  writeSpeed: number;
  readCount: number;
  writeCount: number;
}

export interface NetworkInterface {
  name: string;
  ipv4: string;
  ipv6: string;
  mac: string;
  status: 'UP' | 'DOWN';
  speed: number;
  rxBytes: number;
  txBytes: number;
  rxPackets: number;
  txPackets: number;
}

export interface NetworkConnection {
  proto: string;
  localAddress: string;
  localPort: number;
  remoteAddress: string;
  remotePort: number;
  state: string;
  pid: number;
  program: string;
}

export interface NetworkTraffic {
  interfaceName: string;
  rxBytesPerSec: number;
  txBytesPerSec: number;
  rxPacketsPerSec: number;
  txPacketsPerSec: number;
}

export interface ProcessInfo {
  pid: number;
  ppid: number;
  name: string;
  cmd: string;
  user: string;
  state: string;
  cpuPercent: number;
  memPercent: number;
  memRSS: number;
  memVMS: number;
  startTime: number;
  threads: number;
}

export interface FileInfo {
  name: string;
  path: string;
  type: 'file' | 'directory' | 'symlink' | 'other';
  size: number;
  permissions: string;
  owner: string;
  group: string;
  modified: Date;
  accessed: Date;
}

export interface UserInfo {
  username: string;
  uid: number;
  gid: number;
  home: string;
  shell: string;
  groups: string[];
  isSystem: boolean;
}

export interface GroupInfo {
  name: string;
  gid: number;
  members: string[];
}

export interface ServiceInfo {
  name: string;
  description: string;
  activeState: string;
  subState: string;
  loadState: string;
  unitFileState: string;
  pid: number;
  memoryCurrent: number;
}

export interface PackageInfo {
  name: string;
  version: string;
  architecture: string;
  status: string;
  description: string;
}

export interface CronJob {
  id: string;
  schedule: string;
  command: string;
  user: string;
  comment?: string;
}

export interface FirewallRule {
  id: string;
  action: 'allow' | 'deny' | 'reject' | 'limit';
  from: string;
  to: string;
  port: string;
  protocol: string;
  direction: 'in' | 'out';
  comment?: string;
}

export interface SystemInfo {
  hostname: string;
  os: string;
  kernel: string;
  arch: string;
  uptime: number;
  currentTime: string;
  timezone: string;
  locale: string;
  totalMemory: number;
  cpuModel: string;
  cpuCores: number;
}

export interface MonitorSnapshot {
  timestamp: number;
  cpu: CpuInfo;
  memory: MemoryInfo;
  disks: DiskInfo[];
  network: NetworkTraffic[];
  loadAvg: [number, number, number];
}
