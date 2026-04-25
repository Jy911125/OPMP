import Docker from 'dockerode';
import type {
  ContainerInfo, ContainerCreateOptions, ContainerStats,
  ImageInfo, VolumeInfo, DockerNetworkInfo, DockerInfo, DockerDiskUsage
} from '../../types/docker';

const docker = new Docker({ socketPath: '/var/run/docker.sock' });

interface ContainerInspectInfo {
  Id: string;
  Name: string;
  Config: { Image: string; Labels?: Record<string, string> };
  State: { Status: string; Running: boolean };
  Created: number;
  NetworkSettings: {
    Ports?: Record<string, Array<{ HostIp: string; HostPort: string }> | null>;
    Networks?: Record<string, unknown>;
  };
  Mounts: Array<{
    Type: string;
    Source: string;
    Destination: string;
    Mode: string;
    RW: boolean;
  }>;
}

interface NetworkInspectInfo {
  Id: string;
  Name: string;
  Driver: string;
  Scope: string;
  IPAM?: { Config?: Array<{ Subnet?: string; Gateway?: string }> };
  Containers?: Record<string, { Name: string; IPv4Address: string; IPv6Address: string }>;
  Labels?: Record<string, string>;
}

interface SystemInfoResult {
  Containers?: number;
  ContainersRunning?: number;
  ContainersStopped?: number;
  Images?: number;
  StorageDriver?: string;
  OperatingSystem?: string;
  Aarch?: string;
  NCPU?: number;
  MemTotal?: number;
  DockerRootDir?: string;
  KernelVersion?: string;
}

interface SystemDfResult {
  Images?: number;
  ImagesSize?: number;
  Containers?: number;
  ContainersSize?: number;
  Volumes?: number;
  VolumesSize?: number;
  BuildCache?: number;
  BuildCacheSize?: number;
  BuildCacheReclaimed?: number;
}

export class DockerContainerService {
  async listContainers(all: boolean = false): Promise<ContainerInfo[]> {
    const containers = await docker.listContainers({ all });

    return containers.map((c: Docker.ContainerInfo) => ({
      id: c.Id,
      name: c.Names[0]?.replace(/^\//, '') || '',
      image: c.Image,
      state: c.State,
      status: c.Status,
      created: c.Created * 1000,
      ports: c.Ports.map((p: { IP?: string; PrivatePort?: number; PublicPort?: number; Type?: string }) => ({
        ip: p.IP || '',
        privatePort: p.PrivatePort || 0,
        publicPort: p.PublicPort || 0,
        type: p.Type || '',
      })),
      networks: Object.keys(c.NetworkSettings?.Networks || {}),
      mounts: c.Mounts.map((m: { Type?: string; Source?: string; Destination?: string; Mode?: string; RW?: boolean }) => ({
        type: m.Type || '',
        source: m.Source || '',
        destination: m.Destination || '',
        mode: m.Mode || '',
        rw: m.RW || false,
      })),
      labels: c.Labels || {},
    }));
  }

  async getContainer(id: string): Promise<ContainerInfo | null> {
    try {
      const container = docker.getContainer(id);
      const info = await container.inspect() as unknown as ContainerInspectInfo;

      return {
        id: info.Id,
        name: info.Name.replace(/^\//, ''),
        image: info.Config.Image,
        state: info.State.Status,
        status: info.State.Running ? 'Up' : 'Exited',
        created: info.Created,
        ports: Object.entries(info.NetworkSettings.Ports || {})
          .filter(([_, v]) => v)
          .map(([key, val]) => {
            const privatePort = parseInt(key.split('/')[0]);
            return {
              ip: val?.[0]?.HostIp || '',
              privatePort,
              publicPort: val?.[0]?.HostPort ? parseInt(val[0].HostPort) : 0,
              type: key.split('/')[1] || 'tcp',
            };
          }),
        networks: Object.keys(info.NetworkSettings.Networks || {}),
        mounts: info.Mounts.map(m => ({
          type: m.Type || '',
          source: m.Source || '',
          destination: m.Destination || '',
          mode: m.Mode || '',
          rw: m.RW || false,
        })),
        labels: info.Config.Labels || {},
      };
    } catch {
      return null;
    }
  }

  async createContainer(options: ContainerCreateOptions): Promise<string> {
    const createOpts: Record<string, unknown> = {
      name: options.name,
      Image: options.image,
      Cmd: options.cmd,
      Env: options.env,
      Tty: options.tty,
      OpenStdin: options.interactive,
      HostConfig: {} as Record<string, unknown>,
    };

    if (options.ports) {
      const hostConfig = createOpts.HostConfig as Record<string, unknown>;
      hostConfig.PortBindings = {};
      createOpts.ExposedPorts = {};
      type PortConfig = { HostPort: string; HostIp?: string };
      for (const [containerPort, hostConfigEntry] of Object.entries(options.ports) as [string, PortConfig][]) {
        (createOpts.ExposedPorts as Record<string, unknown>)[containerPort] = {};
        (hostConfig.PortBindings as Record<string, unknown>)[containerPort] = [{
          HostPort: hostConfigEntry.HostPort,
          HostIp: hostConfigEntry.HostIp || '0.0.0.0',
        }];
      }
    }

    if (options.volumes) {
      const hostConfig = createOpts.HostConfig as Record<string, unknown>;
      hostConfig.Binds = Object.entries(options.volumes)
        .map(([vol, dst]) => `${vol}:${dst}`);
    }

    if (options.network) {
      (createOpts.HostConfig as Record<string, unknown>).NetworkMode = options.network;
    }

    if (options.restartPolicy) {
      (createOpts.HostConfig as Record<string, unknown>).RestartPolicy = { Name: options.restartPolicy };
    }

    if (options.memory) {
      (createOpts.HostConfig as Record<string, unknown>).Memory = options.memory;
    }

    if (options.privileged) {
      (createOpts.HostConfig as Record<string, unknown>).Privileged = true;
    }

    const container = await docker.createContainer(createOpts as Docker.ContainerCreateOptions);
    return container.id;
  }

  async startContainer(id: string): Promise<void> {
    const container = docker.getContainer(id);
    await container.start();
  }

  async stopContainer(id: string, timeout: number = 10): Promise<void> {
    const container = docker.getContainer(id);
    await container.stop({ t: timeout });
  }

  async restartContainer(id: string, timeout: number = 10): Promise<void> {
    const container = docker.getContainer(id);
    await container.restart({ t: timeout });
  }

  async pauseContainer(id: string): Promise<void> {
    const container = docker.getContainer(id);
    await container.pause();
  }

  async unpauseContainer(id: string): Promise<void> {
    const container = docker.getContainer(id);
    await container.unpause();
  }

  async removeContainer(id: string, force: boolean = false, removeVolumes: boolean = false): Promise<void> {
    const container = docker.getContainer(id);
    await container.remove({ force, v: removeVolumes });
  }

  async getContainerLogs(id: string, tail: number = 100, follow: boolean = false): Promise<NodeJS.ReadableStream> {
    const container = docker.getContainer(id);
    return container.logs({
      stdout: true,
      stderr: true,
      tail,
      follow: follow as true,
      timestamps: true,
    }) as unknown as NodeJS.ReadableStream;
  }

  async getContainerStats(id: string): Promise<ContainerStats> {
    const container = docker.getContainer(id);
    const stats = await container.stats({ stream: false });

    const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage;
    const systemDelta = stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;
    const cpuPercent = systemDelta > 0 ? (cpuDelta / systemDelta) * 100 * stats.cpu_stats.online_cpus : 0;

    const memoryUsage = stats.memory_stats.usage || 0;
    const memoryLimit = stats.memory_stats.limit || 0;

    let networkRxBytes = 0;
    let networkTxBytes = 0;
    if (stats.networks) {
      for (const network of Object.values(stats.networks) as Array<{ rx_bytes?: number; tx_bytes?: number }>) {
        networkRxBytes += network.rx_bytes || 0;
        networkTxBytes += network.tx_bytes || 0;
      }
    }

    let blockReadBytes = 0;
    let blockWriteBytes = 0;
    if (stats.blkio_stats?.io_service_bytes_recursive) {
      for (const entry of stats.blkio_stats.io_service_bytes_recursive) {
        if (entry.op === 'Read') blockReadBytes += entry.value || 0;
        if (entry.op === 'Write') blockWriteBytes += entry.value || 0;
      }
    }

    return {
      cpuPercent,
      memoryUsage,
      memoryLimit,
      memoryPercent: memoryLimit > 0 ? (memoryUsage / memoryLimit) * 100 : 0,
      networkRxBytes,
      networkTxBytes,
      blockReadBytes,
      blockWriteBytes,
      pids: stats.pids_stats?.current || 0,
    };
  }

  statsStream(id: string): NodeJS.ReadableStream {
    const container = docker.getContainer(id);
    return container.stats({ stream: true }) as unknown as NodeJS.ReadableStream;
  }

  async execInContainer(id: string, cmd: string[], interactive: boolean = true) {
    const container = docker.getContainer(id);
    const exec = await container.exec({
      AttachStdin: interactive,
      AttachStdout: true,
      AttachStderr: true,
      Cmd: cmd,
      Tty: true,
    });

    return exec;
  }
}

export class DockerImageService {
  async listImages(): Promise<ImageInfo[]> {
    const images = await docker.listImages({ all: false });

    return images.map((img: Docker.ImageInfo) => ({
      id: img.Id,
      repoTags: img.RepoTags || ['<none>'],
      repoDigests: img.RepoDigests || [],
      created: img.Created * 1000,
      size: img.Size,
      labels: img.Labels || {},
      architecture: (img as any).Architecture || 'unknown',
      os: (img as any).Os || 'unknown',
    }));
  }

  async pullImage(name: string, onProgress?: (event: any) => void): Promise<void> {
    return new Promise((resolve, reject) => {
      docker.pull(name, (err: Error | null, stream: NodeJS.ReadableStream) => {
        if (err) return reject(err);

        docker.modem.followProgress(stream, (err: Error | null) => {
          if (err) reject(err);
          else resolve();
        }, onProgress);
      });
    });
  }

  async removeImage(id: string, force: boolean = false): Promise<void> {
    const image = docker.getImage(id);
    await image.remove({ force });
  }

  async inspectImage(id: string): Promise<ImageInfo> {
    const image = docker.getImage(id);
    const info = await image.inspect();

    return {
      id: info.Id,
      repoTags: info.RepoTags || ['<none>'],
      repoDigests: info.RepoDigests || [],
      created: new Date(info.Created).getTime(),
      size: info.Size,
      labels: info.Config?.Labels || {},
      architecture: info.Architecture,
      os: info.Os,
    };
  }

  async buildImage(dockerfile: string, tag: string): Promise<NodeJS.ReadableStream> {
    return docker.buildImage(dockerfile, { t: tag } as Docker.ImageBuildOptions) as unknown as NodeJS.ReadableStream;
  }
}

export class DockerVolumeService {
  async listVolumes(): Promise<VolumeInfo[]> {
    const result = await docker.listVolumes();

    return (result.Volumes || []).map((v: any) => ({
      name: v.Name,
      driver: v.Driver,
      mountPoint: v.Mountpoint,
      created: new Date(v.CreatedAt).getTime(),
      size: 0,
      labels: v.Labels || {},
      containers: 0,
    }));
  }

  async createVolume(name: string, driver: string = 'local'): Promise<string> {
    const volume = await docker.createVolume({
      Name: name,
      Driver: driver,
    });
    return volume.Name || '';
  }

  async removeVolume(name: string): Promise<void> {
    const volume = docker.getVolume(name);
    await volume.remove();
  }

  async pruneVolumes(): Promise<{ deleted: string[]; spaceReclaimed: number }> {
    const result = await docker.pruneVolumes();
    return {
      deleted: result.VolumesDeleted || [],
      spaceReclaimed: result.SpaceReclaimed || 0,
    };
  }
}

export class DockerNetworkService {
  async listNetworks(): Promise<DockerNetworkInfo[]> {
    const networks = await docker.listNetworks();

    return networks.map((net: NetworkInspectInfo) => ({
      id: net.Id,
      name: net.Name,
      driver: net.Driver,
      scope: net.Scope,
      subnet: net.IPAM?.Config?.[0]?.Subnet || '',
      gateway: net.IPAM?.Config?.[0]?.Gateway || '',
      containers: Object.entries(net.Containers || {}).reduce((acc, [id, info]) => {
        acc[id] = { name: info.Name, ipv4: info.IPv4Address, ipv6: info.IPv6Address };
        return acc;
      }, {} as Record<string, { name: string; ipv4: string; ipv6: string }>),
      labels: net.Labels || {},
    }));
  }

  async createNetwork(name: string, driver: string = 'bridge', subnet?: string): Promise<string> {
    const options = { Name: name, Driver: driver } as Docker.NetworkCreateOptions;
    if (subnet) {
      options.IPAM = { Config: [{ Subnet: subnet }] };
    }

    const network = await docker.createNetwork(options);
    return network.id;
  }

  async removeNetwork(id: string): Promise<void> {
    const network = docker.getNetwork(id);
    await network.remove();
  }

  async connectContainer(networkId: string, containerId: string): Promise<void> {
    const network = docker.getNetwork(networkId);
    await network.connect({ Container: containerId });
  }

  async disconnectContainer(networkId: string, containerId: string): Promise<void> {
    const network = docker.getNetwork(networkId);
    await network.disconnect({ Container: containerId });
  }
}

export class DockerSystemService {
  async getInfo(): Promise<DockerInfo> {
    const info = await docker.info() as unknown as SystemInfoResult;
    const version = await docker.version();

    return {
      containers: info.Containers || 0,
      containersRunning: info.ContainersRunning || 0,
      containersStopped: info.ContainersStopped || 0,
      images: info.Images || 0,
      serverVersion: version.Version || 'unknown',
      storageDriver: info.StorageDriver || 'unknown',
      operatingSystem: info.OperatingSystem || 'unknown',
      architecture: info.Aarch || 'unknown',
      cpuCores: info.NCPU || 1,
      memoryTotal: info.MemTotal || 0,
      dockerRootDir: info.DockerRootDir || '/var/lib/docker',
      kernelVersion: info.KernelVersion || 'unknown',
    };
  }

  async getDiskUsage(): Promise<DockerDiskUsage> {
    const result = await (docker as any).systemDf() as SystemDfResult;

    return {
      images: {
        count: result.Images || 0,
        size: result.ImagesSize || 0,
        reclaimable: 0,
      },
      containers: {
        count: result.Containers || 0,
        size: result.ContainersSize || 0,
        reclaimable: 0,
      },
      volumes: {
        count: result.Volumes || 0,
        size: result.VolumesSize || 0,
        reclaimable: 0,
      },
      buildCache: {
        count: result.BuildCache || 0,
        size: result.BuildCacheSize || 0,
        reclaimable: result.BuildCacheReclaimed || 0,
      },
    };
  }

  async pruneSystem(all: boolean = true, volumes: boolean = true): Promise<any> {
    return (docker as any).pruneSystem({
      all,
      volumes,
    });
  }

  events(): NodeJS.ReadableStream {
    return docker.getEvents() as unknown as NodeJS.ReadableStream;
  }
}

export const containerService = new DockerContainerService();
export const imageService = new DockerImageService();
export const volumeService = new DockerVolumeService();
export const networkService = new DockerNetworkService();
export const dockerSystemService = new DockerSystemService();
