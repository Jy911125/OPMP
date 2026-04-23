import Docker from 'dockerode';
import type {
  ContainerInfo, ContainerCreateOptions, ContainerStats,
  ImageInfo, VolumeInfo, DockerNetworkInfo, DockerInfo, DockerDiskUsage
} from '../types/docker.js';
import type { PortMapping, MountInfo } from '../types/docker.js';

const docker = new Docker({ socketPath: '/var/run/docker.sock' });

export class DockerContainerService {
  async listContainers(all: boolean = false): Promise<ContainerInfo[]> {
    const containers = await docker.listContainers({ all });

    return containers.map(c => ({
      id: c.Id,
      name: c.Names[0]?.replace(/^\//, '') || '',
      image: c.Image,
      state: c.State,
      status: c.Status,
      created: c.Created * 1000,
      ports: c.Ports.map(p => ({
        ip: p.IP || '',
        privatePort: p.PrivatePort || 0,
        publicPort: p.PublicPort || 0,
        type: p.Type || '',
      })),
      networks: Object.keys(c.NetworkSettings?.Networks || {}),
      mounts: c.Mounts.map(m => ({
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
      const info = await container.inspect();

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
    const createOpts: any = {
      name: options.name,
      Image: options.image,
      Cmd: options.cmd,
      Env: options.env,
      Tty: options.tty,
      OpenStdin: options.interactive,
      HostConfig: {},
    };

    if (options.ports) {
      createOpts.HostConfig.PortBindings = {};
      createOpts.ExposedPorts = {};
      for (const [containerPort, hostConfig] of Object.entries(options.ports)) {
        createOpts.ExposedPorts[containerPort] = {};
        createOpts.HostConfig.PortBindings[containerPort] = [{
          HostPort: hostConfig.HostPort,
          HostIp: hostConfig.HostIp || '0.0.0.0',
        }];
      }
    }

    if (options.volumes) {
      createOpts.HostConfig.Binds = Object.entries(options.volumes)
        .map(([vol, dst]) => `${vol}:${dst}`);
    }

    if (options.network) {
      createOpts.HostConfig.NetworkMode = options.network;
    }

    if (options.restartPolicy) {
      createOpts.HostConfig.RestartPolicy = { Name: options.restartPolicy };
    }

    if (options.memory) {
      createOpts.HostConfig.Memory = options.memory;
    }

    if (options.privileged) {
      createOpts.HostConfig.Privileged = true;
    }

    const container = await docker.createContainer(createOpts);
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
      follow,
      timestamps: true,
    });
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
      for (const network of Object.values(stats.networks)) {
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
    return container.stats({ stream: true });
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

    return images.map(img => ({
      id: img.Id,
      repoTags: img.RepoTags || ['<none>'],
      repoDigests: img.RepoDigests || [],
      created: img.Created * 1000,
      size: img.Size,
      labels: img.Labels || {},
      architecture: img.Architecture || 'unknown',
      os: img.Os || 'unknown',
    }));
  }

  async pullImage(name: string, onProgress?: (event: any) => void): Promise<void> {
    return new Promise((resolve, reject) => {
      docker.pull(name, (err: any, stream: NodeJS.ReadableStream) => {
        if (err) return reject(err);

        docker.modem.followProgress(stream, (err) => {
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
      created: info.Created,
      size: info.Size,
      labels: info.Config?.Labels || {},
      architecture: info.Architecture,
      os: info.Os,
    };
  }

  async buildImage(dockerfile: string, tag: string, context?: string): Promise<NodeJS.ReadableStream> {
    return docker.buildImage(dockerfile, {
      t: tag,
      context,
    });
  }
}

export class DockerVolumeService {
  async listVolumes(): Promise<VolumeInfo[]> {
    const result = await docker.listVolumes();

    return result.Volumes.map(v => ({
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
    return volume.name;
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

    return networks.map(net => ({
      id: net.Id,
      name: net.Name,
      driver: net.Driver,
      scope: net.Scope,
      subnet: net.IPAM?.Config?.[0]?.Subnet || '',
      gateway: net.IPAM?.Config?.[0]?.Gateway || '',
      containers: Object.entries(net.Containers || {}).reduce((acc, [id, info]) => {
        acc[id] = { name: info.Name, ipv4: info.IPv4Address, ipv6: info.IPv6Address };
        return acc;
      }, {} as any),
      labels: net.Labels || {},
    }));
  }

  async createNetwork(name: string, driver: string = 'bridge', subnet?: string): Promise<string> {
    const options: any = { Name: name, Driver: driver };
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
    const info = await docker.info();
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
    const result = await docker.systemDf();

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
    return docker.pruneSystem({
      all,
      volumes,
    });
  }

  events(): NodeJS.ReadableStream {
    return docker.getEvents();
  }
}

export const containerService = new DockerContainerService();
export const imageService = new DockerImageService();
export const volumeService = new DockerVolumeService();
export const networkService = new DockerNetworkService();
export const dockerSystemService = new DockerSystemService();
