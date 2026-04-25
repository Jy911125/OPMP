import { Router, Request, Response } from 'express';
import { authMiddleware, requireRole } from '../../middleware/auth';
import { auditMiddleware } from '../../middleware/audit';
import { monitorService } from '../../services/system/monitor';
import { filesystemService } from '../../services/system/files';
import { processService } from '../../services/system/process';

const router = Router();

router.use(authMiddleware);
router.use(auditMiddleware);

// ============ Monitor ============
router.get('/monitor/cpu', async (_req: Request, res: Response) => {
  try {
    const cpu = await monitorService.getCpuInfo();
    res.json(cpu);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/monitor/memory', async (_req: Request, res: Response) => {
  try {
    const memory = await monitorService.getMemoryInfo();
    res.json(memory);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/monitor/disk', async (_req: Request, res: Response) => {
  try {
    const disks = await monitorService.getDiskInfo();
    res.json(disks);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/monitor/network', async (_req: Request, res: Response) => {
  try {
    const network = await monitorService.getNetworkTraffic();
    res.json(network);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/monitor/snapshot', async (_req: Request, res: Response) => {
  try {
    const snapshot = await monitorService.getSnapshot();
    res.json(snapshot);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/monitor/history', (_req: Request, res: Response) => {
  res.json(monitorService.getHistory());
});

router.get('/info', async (_req: Request, res: Response) => {
  try {
    const info = await monitorService.getSystemInfo();
    res.json(info);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============ Filesystem ============
router.get('/files', async (req: Request, res: Response) => {
  try {
    const dirPath = (req.query.path as string) || '/';
    const files = await filesystemService.listDirectory(dirPath);
    res.json(files);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/files/content', async (req: Request, res: Response) => {
  try {
    const filePath = req.query.path as string;
    if (!filePath) {
      res.status(400).json({ error: 'Path parameter required' });
      return;
    }
    const result = await filesystemService.readFile(filePath);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/files/content', requireRole('admin', 'operator'), async (req: Request, res: Response) => {
  try {
    const { path: filePath, content } = req.body;
    if (!filePath || content === undefined) {
      res.status(400).json({ error: 'Path and content required' });
      return;
    }
    await filesystemService.writeFile(filePath, content);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/files/mkdir', requireRole('admin', 'operator'), async (req: Request, res: Response) => {
  try {
    const { path: dirPath } = req.body;
    if (!dirPath) {
      res.status(400).json({ error: 'Path required' });
      return;
    }
    await filesystemService.createDirectory(dirPath);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/files', requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const filePath = req.query.path as string;
    const recursive = req.query.recursive === 'true';
    if (!filePath) {
      res.status(400).json({ error: 'Path required' });
      return;
    }
    await filesystemService.deletePath(filePath, recursive);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/files/chmod', requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const { path: filePath, mode } = req.body;
    if (!filePath || !mode) {
      res.status(400).json({ error: 'Path and mode required' });
      return;
    }
    await filesystemService.chmod(filePath, mode);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/files/chown', requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const { path: filePath, owner, group } = req.body;
    if (!filePath || !owner) {
      res.status(400).json({ error: 'Path and owner required' });
      return;
    }
    await filesystemService.chown(filePath, owner, group);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/files/copy', requireRole('admin', 'operator'), async (req: Request, res: Response) => {
  try {
    const { src, dst } = req.body;
    if (!src || !dst) {
      res.status(400).json({ error: 'Source and destination required' });
      return;
    }
    await filesystemService.copyPath(src, dst);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/files/move', requireRole('admin', 'operator'), async (req: Request, res: Response) => {
  try {
    const { src, dst } = req.body;
    if (!src || !dst) {
      res.status(400).json({ error: 'Source and destination required' });
      return;
    }
    await filesystemService.movePath(src, dst);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/files/search', async (req: Request, res: Response) => {
  try {
    const basePath = (req.query.base as string) || '/';
    const pattern = req.query.pattern as string;
    if (!pattern) {
      res.status(400).json({ error: 'Search pattern required' });
      return;
    }
    const results = await filesystemService.searchFiles(basePath, pattern);
    res.json(results);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============ Process ============
router.get('/processes', async (_req: Request, res: Response) => {
  try {
    const processes = await processService.getProcessList();
    res.json(processes);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/processes/:pid', async (req: Request, res: Response) => {
  try {
    const pid = parseInt(req.params.pid);
    const process = await processService.getProcessByPid(pid);
    if (!process) {
      res.status(404).json({ error: 'Process not found' });
      return;
    }
    res.json(process);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/processes/:pid/kill', requireRole('admin', 'operator'), async (req: Request, res: Response) => {
  try {
    const pid = parseInt(req.params.pid);
    const { signal } = req.body;
    await processService.killProcess(pid, signal || 'SIGTERM');
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
