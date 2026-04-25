import { ref } from 'vue';
import { defineStore } from 'pinia';
import { dockerApi } from '@/api';
import { io, Socket } from 'socket.io-client';

export interface Container {
  id: string;
  name: string;
  image: string;
  state: string;
  status: string;
  created: number;
  ports: { publicPort: number; privatePort: number; type: string }[];
  networks: string[];
}

export interface Image {
  id: string;
  repoTags: string[];
  size: number;
  created: number;
}

export interface Volume {
  name: string;
  driver: string;
  mountPoint: string;
}

export interface DockerNetwork {
  id: string;
  name: string;
  driver: string;
  subnet: string;
}

export const useDockerStore = defineStore('docker', () => {
  const containers = ref<Container[]>([]);
  const images = ref<Image[]>([]);
  const volumes = ref<Volume[]>([]);
  const networks = ref<DockerNetwork[]>([]);
  const info = ref<any>(null);
  const loading = ref(false);

  let socket: Socket | null = null;

  async function fetchContainers(all: boolean = false) {
    loading.value = true;
    try {
      const res: any = await dockerApi.listContainers(all);
      containers.value = res;
    } finally {
      loading.value = false;
    }
  }

  async function fetchImages() {
    const res: any = await dockerApi.listImages();
    images.value = res;
  }

  async function fetchVolumes() {
    const res: any = await dockerApi.listVolumes();
    volumes.value = res;
  }

  async function fetchNetworks() {
    const res: any = await dockerApi.listNetworks();
    networks.value = res;
  }

  async function fetchInfo() {
    const res: any = await dockerApi.getInfo();
    info.value = res;
  }

  async function startContainer(id: string) {
    await dockerApi.containerAction(id, 'start');
    await fetchContainers();
  }

  async function stopContainer(id: string) {
    await dockerApi.containerAction(id, 'stop');
    await fetchContainers();
  }

  async function restartContainer(id: string) {
    await dockerApi.containerAction(id, 'restart');
    await fetchContainers();
  }

  async function removeContainer(id: string) {
    await dockerApi.containerAction(id, 'remove', { force: true });
    await fetchContainers();
  }

  async function pullImage(name: string) {
    await dockerApi.pullImage(name);
    await fetchImages();
  }

  async function removeImage(id: string) {
    await dockerApi.removeImage(id, true);
    await fetchImages();
  }

  async function createVolume(name: string, driver?: string) {
    await dockerApi.createVolume(name, driver);
    await fetchVolumes();
  }

  async function removeVolume(name: string) {
    await dockerApi.removeVolume(name);
    await fetchVolumes();
  }

  async function createNetwork(name: string, driver: string = 'bridge') {
    await dockerApi.createNetwork({ name, driver });
    await fetchNetworks();
  }

  async function removeNetwork(id: string) {
    await dockerApi.removeNetwork(id);
    await fetchNetworks();
  }

  function connectWebSocket() {
    if (socket?.connected) return;

    socket = io('/', {
      transports: ['websocket'],
    });

    socket.on('docker:event', (event) => {
      if (event.type === 'container' || event.type === 'image') {
        fetchContainers(true);
        fetchImages();
      }
    });
  }

  function disconnectWebSocket() {
    socket?.disconnect();
    socket = null;
  }

  const runningContainers = containers.value.filter(c => c.state === 'running');
  const totalImages = images.value.length;
  const totalVolumes = volumes.value.length;

  return {
    containers,
    images,
    volumes,
    networks,
    info,
    loading,
    runningContainers,
    totalImages,
    totalVolumes,
    fetchContainers,
    fetchImages,
    fetchVolumes,
    fetchNetworks,
    fetchInfo,
    startContainer,
    stopContainer,
    restartContainer,
    removeContainer,
    pullImage,
    removeImage,
    createVolume,
    removeVolume,
    createNetwork,
    removeNetwork,
    connectWebSocket,
    disconnectWebSocket,
  };
});
