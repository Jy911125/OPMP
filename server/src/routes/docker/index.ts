import { Router, Request, Response } from 'express';
import { authMiddleware, requireRole } from '../../middleware/auth';
import { auditMiddleware } from '../../middleware/audit';
import {
  containerService, imageService, volumeService,
  networkService, dockerSystemService
} from '../../services/docker/index';

const router = Router();

router.use(authMiddleware);
router.use(auditMiddleware);

// ============ Containers ============
router.get('/containers', async (_req: Request, res: Response) => {
  try {
    const all = _req.query.all === 'true';
    const containers = await containerService.listContainers(all);
    res.json(containers);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/containers/:id', async (req: Request, res: Response) => {
  try {
    const container = await containerService.getContainer(req.params.id);
    if (!container) {
      res.status(404).json({ error: 'Container not found' });
      return;
    }
    res.json(container);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/containers', requireRole('admin', 'operator'), async (req: Request, res: Response) => {
  try {
    const id = await containerService.createContainer(req.body);
    res.json({ id });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/containers/:id/:action', requireRole('admin', 'operator'), async (req: Request, res: Response) => {
  try {
    const { id, action } = req.params;
    switch (action) {
      case 'start':
        await containerService.startContainer(id);
        break;
      case 'stop':
        await containerService.stopContainer(id);
        break;
      case 'restart':
        await containerService.restartContainer(id);
        break;
      case 'pause':
        await containerService.pauseContainer(id);
        break;
      case 'unpause':
        await containerService.unpauseContainer(id);
        break;
      case 'remove':
        await containerService.removeContainer(id, req.body?.force, req.body?.removeVolumes);
        break;
      default:
        res.status(400).json({ error: `Unknown action: ${action}` });
        return;
    }
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/containers/:id/logs', async (req: Request, res: Response) => {
  try {
    const tail = parseInt(req.query.tail as string) || 100;
    const stream = await containerService.getContainerLogs(req.params.id, tail, false);

    let logs = '';
    stream.on('data', (chunk: Buffer) => {
      logs += chunk.toString('utf-8');
    });
    stream.on('end', () => {
      res.json({ logs });
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/containers/:id/stats', async (req: Request, res: Response) => {
  try {
    const stats = await containerService.getContainerStats(req.params.id);
    res.json(stats);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============ Images ============
router.get('/images', async (_req: Request, res: Response) => {
  try {
    const images = await imageService.listImages();
    res.json(images);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/images/:id', async (req: Request, res: Response) => {
  try {
    const image = await imageService.inspectImage(req.params.id);
    res.json(image);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/images/pull', requireRole('admin', 'operator'), async (req: Request, res: Response) => {
  try {
    const { name } = req.body;
    if (!name) {
      res.status(400).json({ error: 'Image name required' });
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    await imageService.pullImage(name, (event) => {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    });

    res.write(`data: ${JSON.stringify({ status: 'done' })}\n\n`);
    res.end();
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/images/:id', requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const force = req.query.force === 'true';
    await imageService.removeImage(req.params.id, force);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============ Volumes ============
router.get('/volumes', async (_req: Request, res: Response) => {
  try {
    const volumes = await volumeService.listVolumes();
    res.json(volumes);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/volumes', requireRole('admin', 'operator'), async (req: Request, res: Response) => {
  try {
    const { name, driver } = req.body;
    const volumeName = await volumeService.createVolume(name, driver);
    res.json({ name: volumeName });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/volumes/:name', requireRole('admin'), async (req: Request, res: Response) => {
  try {
    await volumeService.removeVolume(req.params.name);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/volumes/prune', requireRole('admin'), async (_req: Request, res: Response) => {
  try {
    const result = await volumeService.pruneVolumes();
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============ Networks ============
router.get('/networks', async (_req: Request, res: Response) => {
  try {
    const networks = await networkService.listNetworks();
    res.json(networks);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/networks', requireRole('admin', 'operator'), async (req: Request, res: Response) => {
  try {
    const { name, driver, subnet } = req.body;
    const networkId = await networkService.createNetwork(name, driver, subnet);
    res.json({ id: networkId });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/networks/:id', requireRole('admin'), async (req: Request, res: Response) => {
  try {
    await networkService.removeNetwork(req.params.id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/networks/:id/connect', requireRole('admin', 'operator'), async (req: Request, res: Response) => {
  try {
    await networkService.connectContainer(req.params.id, req.body.containerId);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/networks/:id/disconnect', requireRole('admin', 'operator'), async (req: Request, res: Response) => {
  try {
    await networkService.disconnectContainer(req.params.id, req.body.containerId);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============ Docker System ============
router.get('/info', async (_req: Request, res: Response) => {
  try {
    const info = await dockerSystemService.getInfo();
    res.json(info);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/disk-usage', async (_req: Request, res: Response) => {
  try {
    const usage = await dockerSystemService.getDiskUsage();
    res.json(usage);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/prune', requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const result = await dockerSystemService.pruneSystem(
      req.body.all !== false,
      req.body.volumes !== false
    );
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
