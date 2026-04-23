import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';

interface MonitorSubscription {
  intervalMs: number;
  interval?: NodeJS.Timeout;
}

const monitorSubscriptions = new Map<string, MonitorSubscription>();

export function setupWebSocket(httpServer: HttpServer, corsOrigin: string) {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: corsOrigin,
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  io.on('connection', (socket: Socket) => {
    console.log(`[WS] Client connected: ${socket.id}`);

    socket.on('subscribe:monitor', async (data: { intervalMs?: number }) => {
      const intervalMs = data.intervalMs || 3000;
      monitorSubscriptions.set(socket.id, { intervalMs });

      socket.join('monitor');
      console.log(`[WS] ${socket.id} subscribed to monitor (${intervalMs}ms)`);
    });

    socket.on('unsubscribe:monitor', () => {
      monitorSubscriptions.delete(socket.id);
      socket.leave('monitor');
      console.log(`[WS] ${socket.id} unsubscribed from monitor`);
    });

    socket.on('subscribe:docker-stats', async (data: { containerId: string }) => {
      socket.join(`docker-stats:${data.containerId}`);
      console.log(`[WS] ${socket.id} subscribed to docker-stats:${data.containerId}`);
    });

    socket.on('unsubscribe:docker-stats', (data: { containerId: string }) => {
      socket.leave(`docker-stats:${data.containerId}`);
    });

    socket.on('subscribe:docker-events', async () => {
      socket.join('docker-events');
      console.log(`[WS] ${socket.id} subscribed to docker-events`);
    });

    socket.on('unsubscribe:docker-events', () => {
      socket.leave('docker-events');
    });

    socket.on('subscribe:logs', async (data: { containerId: string }) => {
      socket.join(`logs:${data.containerId}`);
      console.log(`[WS] ${socket.id} subscribed to logs:${data.containerId}`);
    });

    socket.on('unsubscribe:logs', (data: { containerId: string }) => {
      socket.leave(`logs:${data.containerId}`);
    });

    socket.on('disconnect', () => {
      monitorSubscriptions.delete(socket.id);
      console.log(`[WS] Client disconnected: ${socket.id}`);
    });
  });

  return io;
}

export function broadcastMonitor(io: SocketIOServer, data: any) {
  io.to('monitor').emit('monitor:data', data);
}

export function broadcastDockerStats(io: SocketIOServer, containerId: string, data: any) {
  io.to(`docker-stats:${containerId}`).emit('docker:stats', data);
}

export function broadcastDockerEvent(io: SocketIOServer, event: any) {
  io.to('docker-events').emit('docker:event', event);
}

export function broadcastContainerLogs(io: SocketIOServer, containerId: string, logs: string) {
  io.to(`logs:${containerId}`).emit('container:logs', logs);
}

export type { SocketIOServer };
