import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'http';
import { config } from './config/index.js';
import { apiRateLimit } from './middleware/rateLimit.js';
import authRoutes from './routes/auth.js';
import systemRoutes from './routes/system/index.js';
import servicesRoutes from './routes/system/services.js';
import dockerRoutes from './routes/docker/index.js';
import { setupWebSocket, broadcastMonitor, broadcastDockerEvent } from './websocket/index.js';
import { monitorService } from './services/system/monitor.js';
import { dockerSystemService } from './services/docker/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, '..', 'public');

const app = express();
const httpServer = createServer(app);

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'blob:'],
      connectSrc: ["'self'", 'ws:', 'wss:'],
    },
  },
}));
app.use(cors({
  origin: config.CORS_ORIGIN,
  credentials: true,
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(apiRateLimit);

// Health check
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/system', systemRoutes);
app.use('/api/system', servicesRoutes);
app.use('/api/docker', dockerRoutes);

// Static files (frontend)
app.use(express.static(publicDir));

// SPA fallback - serve index.html for all non-API routes
app.get('*', (_req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Error:', err.message);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

// Setup WebSocket
const io = setupWebSocket(httpServer, config.CORS_ORIGIN);

// Start monitor service and broadcast updates
monitorService.startMonitoring(config.MONITOR_INTERVAL);
setInterval(() => {
  const latest = monitorService.getLatestSnapshot();
  if (latest) {
    broadcastMonitor(io, latest);
  }
}, config.MONITOR_INTERVAL);

// Subscribe to Docker events
dockerSystemService.events().on('data', (event: any) => {
  broadcastDockerEvent(io, JSON.parse(event.toString()));
}).on('error', (err: Error) => {
  console.error('Docker events error:', err.message);
});

// Start server
httpServer.listen(config.PORT, config.HOST, () => {
  console.log(`OPMP server running at http://${config.HOST}:${config.PORT}`);
  console.log(`Environment: ${config.NODE_ENV}`);
  console.log(`WebSocket: enabled`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down...');
  monitorService.stopMonitoring();
  httpServer.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down...');
  monitorService.stopMonitoring();
  httpServer.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

export { app, httpServer, io };
