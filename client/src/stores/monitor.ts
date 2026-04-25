import { ref, computed } from 'vue';
import { defineStore } from 'pinia';
import { monitorApi } from '@/api';
import { io, Socket } from 'socket.io-client';

export interface MonitorSnapshot {
  timestamp: number;
  cpu: { usage: number; loadAvg: [number, number, number]; uptime: number; cores?: { model: string }[] };
  memory: { total: number; used: number; available: number; usagePercent: number; swapUsed: number; swapTotal: number };
  disks: { filesystem: string; mountPoint: string; total: number; used: number; usagePercent: number }[];
  network: { interfaceName: string; rxBytesPerSec: number; txBytesPerSec: number }[];
  loadAvg: [number, number, number];
}

export const useMonitorStore = defineStore('monitor', () => {
  const snapshot = ref<MonitorSnapshot | null>(null);
  const history = ref<MonitorSnapshot[]>([]);
  const systemInfo = ref<any>(null);
  const loading = ref(false);
  const connected = ref(false);

  let socket: Socket | null = null;

  async function fetchSnapshot() {
    try {
      loading.value = true;
      const res: any = await monitorApi.getSnapshot();
      snapshot.value = res;
    } finally {
      loading.value = false;
    }
  }

  async function fetchHistory() {
    const res: any = await monitorApi.getHistory();
    history.value = res;
  }

  async function fetchSystemInfo() {
    const res: any = await monitorApi.getSystemInfo();
    systemInfo.value = res;
  }

  function connectWebSocket() {
    if (socket?.connected) return;

    socket = io('/', {
      transports: ['websocket', 'polling'],
      auth: { token: localStorage.getItem('token') },
    });

    socket.on('connect', () => {
      connected.value = true;
      socket?.emit('subscribe:monitor', { intervalMs: 3000 });
    });

    socket.on('disconnect', () => {
      connected.value = false;
    });

    socket.on('monitor:data', (data: MonitorSnapshot) => {
      snapshot.value = data;
      history.value.push(data);
      if (history.value.length > 3600) {
        history.value.shift();
      }
    });

    socket.on('connect_error', () => {
      connected.value = false;
    });
  }

  function disconnectWebSocket() {
    if (socket) {
      socket.emit('unsubscribe:monitor');
      socket.disconnect();
      socket = null;
      connected.value = false;
    }
  }

  const cpuUsage = computed(() => snapshot.value?.cpu.usage || 0);
  const memoryUsage = computed(() => snapshot.value?.memory.usagePercent || 0);
  const diskUsage = computed(() => snapshot.value?.disks?.[0]?.usagePercent || 0);
  const networkTraffic = computed(() => {
    const net = snapshot.value?.network?.[0];
    return {
      rx: net?.rxBytesPerSec || 0,
      tx: net?.txBytesPerSec || 0,
    };
  });

  return {
    snapshot,
    history,
    systemInfo,
    loading,
    connected,
    cpuUsage,
    memoryUsage,
    diskUsage,
    networkTraffic,
    fetchSnapshot,
    fetchHistory,
    fetchSystemInfo,
    connectWebSocket,
    disconnectWebSocket,
  };
});
