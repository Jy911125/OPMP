import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';

const baseURL = '/api';

const createApiClient = (): AxiosInstance => {
  const client = axios.create({
    baseURL,
    timeout: 30000,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  client.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

  client.interceptors.response.use(
    (response) => response.data,
    (error) => {
      if (error.response?.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
      return Promise.reject(error.response?.data || error);
    }
  );

  return client;
};

const api = createApiClient();

// Auth API
export const authApi = {
  login: (username: string, password: string) =>
    api.post('/auth/login', { username, password }),
  refreshToken: (refreshToken: string) =>
    api.post('/auth/refresh', { refreshToken }),
  me: () => api.get('/auth/me'),
};

// System Monitor API
export const monitorApi = {
  getCpu: () => api.get('/system/monitor/cpu'),
  getMemory: () => api.get('/system/monitor/memory'),
  getDisk: () => api.get('/system/monitor/disk'),
  getNetwork: () => api.get('/system/monitor/network'),
  getSnapshot: () => api.get('/system/monitor/snapshot'),
  getHistory: () => api.get('/system/monitor/history'),
  getSystemInfo: () => api.get('/system/info'),
};

// Filesystem API
export const filesApi = {
  list: (path: string) => api.get('/system/files', { params: { path } }),
  getContent: (path: string) => api.get('/system/files/content', { params: { path } }),
  writeFile: (path: string, content: string) =>
    api.put('/system/files/content', { path, content }),
  mkdir: (path: string) => api.post('/system/files/mkdir', { path }),
  delete: (path: string, recursive: boolean = false) =>
    api.delete('/system/files', { params: { path, recursive } }),
  chmod: (path: string, mode: string) =>
    api.post('/system/files/chmod', { path, mode }),
  chown: (path: string, owner: string, group?: string) =>
    api.post('/system/files/chown', { path, owner, group }),
  copy: (src: string, dst: string) =>
    api.post('/system/files/copy', { src, dst }),
  move: (src: string, dst: string) =>
    api.post('/system/files/move', { src, dst }),
  search: (pattern: string, base: string = '/') =>
    api.get('/system/files/search', { params: { pattern, base } }),
};

// Process API
export const processApi = {
  list: () => api.get('/system/processes'),
  get: (pid: number) => api.get(`/system/processes/${pid}`),
  kill: (pid: number, signal: 'SIGTERM' | 'SIGKILL' = 'SIGTERM') =>
    api.post(`/system/processes/${pid}/kill`, { signal }),
};

// Users API
export const usersApi = {
  list: () => api.get('/system/users'),
  create: (data: { username: string; home?: string; shell?: string; groups?: string }) =>
    api.post('/system/users', data),
  delete: (username: string) => api.delete(`/system/users/${username}`),
  listGroups: () => api.get('/system/groups'),
};

// Network API
export const networkApi = {
  getInterfaces: () => api.get('/system/network/interfaces'),
  getConnections: () => api.get('/system/network/connections'),
  getFirewallRules: () => api.get('/system/firewall/rules'),
  addFirewallRule: (data: { action: string; port?: string; from?: string; protocol?: string }) =>
    api.post('/system/firewall/rules', data),
};

// Services API
export const servicesApi = {
  list: (type: string = 'service') => api.get('/system/services', { params: { type } }),
  get: (name: string) => api.get(`/system/services/${name}`),
  action: (name: string, action: 'start' | 'stop' | 'restart' | 'enable' | 'disable') =>
    api.post(`/system/services/${name}/${action}`),
};

// Packages API
export const packagesApi = {
  list: () => api.get('/system/packages'),
  install: (name: string) => api.post('/system/packages/install', { name }),
  remove: (name: string, purge: boolean = false) =>
    api.post('/system/packages/remove', { name, purge }),
  update: () => api.post('/system/packages/update'),
  upgrade: () => api.post('/system/packages/upgrade'),
};

// Cron API
export const cronApi = {
  list: () => api.get('/system/cron'),
  add: (schedule: string, command: string) =>
    api.post('/system/cron', { schedule, command }),
  delete: (id: string) => api.delete(`/system/cron/${id}`),
};

// Logs API
export const logsApi = {
  get: (params: { unit?: string; lines?: number; since?: string }) =>
    api.get('/system/logs', { params }),
};

// Docker API
export const dockerApi = {
  // Containers
  listContainers: (all: boolean = false) =>
    api.get('/docker/containers', { params: { all } }),
  getContainer: (id: string) => api.get(`/docker/containers/${id}`),
  createContainer: (data: any) => api.post('/docker/containers', data),
  containerAction: (id: string, action: 'start' | 'stop' | 'restart' | 'pause' | 'unpause' | 'remove', body?: any) =>
    api.post(`/docker/containers/${id}/${action}`, body),
  getContainerLogs: (id: string, tail: number = 100) =>
    api.get(`/docker/containers/${id}/logs`, { params: { tail } }),
  getContainerStats: (id: string) => api.get(`/docker/containers/${id}/stats`),

  // Images
  listImages: () => api.get('/docker/images'),
  getImage: (id: string) => api.get(`/docker/images/${id}`),
  pullImage: (name: string) => api.post('/docker/images/pull', { name }),
  removeImage: (id: string, force: boolean = false) =>
    api.delete(`/docker/images/${id}`, { params: { force } }),

  // Volumes
  listVolumes: () => api.get('/docker/volumes'),
  createVolume: (name: string, driver?: string) =>
    api.post('/docker/volumes', { name, driver }),
  removeVolume: (name: string) => api.delete(`/docker/volumes/${name}`),
  pruneVolumes: () => api.post('/docker/volumes/prune'),

  // Networks
  listNetworks: () => api.get('/docker/networks'),
  createNetwork: (data: { name: string; driver?: string; subnet?: string }) =>
    api.post('/docker/networks', data),
  removeNetwork: (id: string) => api.delete(`/docker/networks/${id}`),
  connectNetwork: (networkId: string, containerId: string) =>
    api.post(`/docker/networks/${networkId}/connect`, { containerId }),
  disconnectNetwork: (networkId: string, containerId: string) =>
    api.post(`/docker/networks/${networkId}/disconnect`, { containerId }),

  // System
  getInfo: () => api.get('/docker/info'),
  getDiskUsage: () => api.get('/docker/disk-usage'),
  prune: (all: boolean = true, volumes: boolean = true) =>
    api.post('/docker/prune', { all, volumes }),
};

export default api;
