export interface ContainerInfo {
  id: string;
  name: string;
  image: string;
  state: string;
  status: string;
  created: number;
  ports: PortMapping[];
  networks: string[];
  mounts: MountInfo[];
  labels: Record<string, string>;
}

export interface ContainerCreateOptions {
  name?: string;
  image: string;
  cmd?: string[];
  env?: string[];
  ports?: Record<string, { HostPort: string; HostIp?: string }>;
  volumes?: Record<string, {}>;
  network?: string;
  restartPolicy?: string;
  memory?: number;
  cpuShares?: number;
  privileged?: boolean;
  interactive?: boolean;
  tty?: boolean;
}

export interface ContainerStats {
  cpuPercent: number;
  memoryUsage: number;
  memoryLimit: number;
  memoryPercent: number;
  networkRxBytes: number;
  networkTxBytes: number;
  blockReadBytes: number;
  blockWriteBytes: number;
  pids: number;
}

export interface PortMapping {
  ip: string;
  privatePort: number;
  publicPort: number;
  type: string;
}

export interface MountInfo {
  type: string;
  source: string;
  destination: string;
  mode: string;
  rw: boolean;
}

export interface ImageInfo {
  id: string;
  repoTags: string[];
  repoDigests: string[];
  created: number;
  size: number;
  labels: Record<string, string>;
  architecture: string;
  os: string;
}

export interface VolumeInfo {
  name: string;
  driver: string;
  mountPoint: string;
  created: number;
  size: number;
  labels: Record<string, string>;
  containers: number;
}

export interface DockerNetworkInfo {
  id: string;
  name: string;
  driver: string;
  scope: string;
  subnet: string;
  gateway: string;
  containers: Record<string, { name: string; ipv4: string; ipv6: string }>;
  labels: Record<string, string>;
}

export interface DockerInfo {
  containers: number;
  containersRunning: number;
  containersStopped: number;
  images: number;
  serverVersion: string;
  storageDriver: string;
  operatingSystem: string;
  architecture: string;
  cpuCores: number;
  memoryTotal: number;
  dockerRootDir: string;
  kernelVersion: string;
}

export interface DockerDiskUsage {
  images: { count: number; size: number; reclaimable: number };
  containers: { count: number; size: number; reclaimable: number };
  volumes: { count: number; size: number; reclaimable: number };
  buildCache: { count: number; size: number; reclaimable: number };
}

export interface DockerEvent {
  type: string;
  action: string;
  actor: { id: string; attributes: Record<string, string> };
  time: number;
  timeNano: number;
}

export interface ComposeProject {
  name: string;
  path: string;
  status: string;
  services: string[];
  createdAt: Date;
}

export interface ImageBuildProgress {
  id: string;
  status: string;
  progress?: string;
  progressDetail?: { current: number; total: number };
  error?: string;
  stream?: string;
}
