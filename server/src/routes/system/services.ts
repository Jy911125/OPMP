import { Router, Request, Response } from 'express';
import { authMiddleware, requireRole } from '../../middleware/auth';
import { auditMiddleware } from '../../middleware/audit';
import { CommandExecutor } from '../../utils/executor';
import { OutputParser } from '../../utils/parser';
import type { UserInfo, GroupInfo, ServiceInfo, PackageInfo, CronJob, FirewallRule, NetworkConnection } from '../../types/system';

const router = Router();

router.use(authMiddleware);
router.use(auditMiddleware);

// ============ Users ============
router.get('/users', async (_req: Request, res: Response) => {
  try {
    const result = await CommandExecutor.execute('cat', ['/etc/passwd']);
    const users: UserInfo[] = result.stdout.split('\n').filter(l => l.trim()).map(line => {
      const parts = line.split(':');
      return {
        username: parts[0],
        uid: parseInt(parts[2]),
        gid: parseInt(parts[3]),
        home: parts[5] || '',
        shell: parts[6] || '',
        groups: [],
        isSystem: parseInt(parts[2]) < 1000,
      };
    });
    res.json(users);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/users', requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const { username, home, shell, groups } = req.body;
    if (!username) {
      res.status(400).json({ error: 'Username required' });
      return;
    }

    const args = ['-m'];
    if (home) args.push('-d', home);
    if (shell) args.push('-s', shell);
    if (groups) args.push('-G', groups);
    args.push(username);

    await CommandExecutor.execute('useradd', args, { sudo: true });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/users/:username', requireRole('admin'), async (req: Request, res: Response) => {
  try {
    await CommandExecutor.execute('userdel', ['-r', req.params.username], { sudo: true });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============ Groups ============
router.get('/groups', async (_req: Request, res: Response) => {
  try {
    const result = await CommandExecutor.execute('cat', ['/etc/group']);
    const groups: GroupInfo[] = result.stdout.split('\n').filter(l => l.trim()).map(line => {
      const parts = line.split(':');
      return {
        name: parts[0],
        gid: parseInt(parts[2]),
        members: parts[3] ? parts[3].split(',') : [],
      };
    });
    res.json(groups);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============ Network ============
router.get('/network/interfaces', async (_req: Request, res: Response) => {
  try {
    const result = await CommandExecutor.execute('ip', ['-json', 'addr', 'show']);
    const interfaces = JSON.parse(result.stdout || '[]').map((iface: any) => ({
      name: iface.ifname,
      ipv4: iface.addr_info?.find((a: any) => a.family === 'inet')?.local || '',
      ipv6: iface.addr_info?.find((a: any) => a.family === 'inet6')?.local || '',
      mac: iface.address || '',
      status: iface.operstate === 'UP' ? 'UP' : 'DOWN' as const,
      speed: 0,
      rxBytes: 0,
      txBytes: 0,
      rxPackets: 0,
      txPackets: 0,
    }));
    res.json(interfaces);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/network/connections', async (_req: Request, res: Response) => {
  try {
    const result = await CommandExecutor.execute('ss', ['-tulnp']);
    const lines = result.stdout.split('\n').filter(l => l.trim()).slice(1);
    const connections: NetworkConnection[] = lines.map(line => {
      const parts = line.trim().split(/\s+/);
      const local = parts[4]?.split(':') || [];
      const remote = parts[5]?.split(':') || [];
      return {
        proto: parts[0] || '',
        localAddress: local.slice(0, -1).join(':') || '',
        localPort: parseInt(local[local.length - 1]) || 0,
        remoteAddress: remote.slice(0, -1).join(':') || '',
        remotePort: parseInt(remote[remote.length - 1]) || 0,
        state: parts[1] || '',
        pid: 0,
        program: parts[6] || '',
      };
    });
    res.json(connections);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/firewall/rules', async (_req: Request, res: Response) => {
  try {
    const result = await CommandExecutor.execute('ufw', ['status', 'verbose']);
    const rules: FirewallRule[] = [];
    const lines = result.stdout.split('\n').slice(4);

    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 3 && ['ALLOW', 'DENY', 'REJECT', 'LIMIT'].includes(parts[0].toUpperCase())) {
        rules.push({
          id: `${parts[0]}-${parts[1]}-${parts[2]}`,
          action: parts[0].toLowerCase() as any,
          from: parts[1] || '',
          to: parts[2] || '',
          port: parts[2] || '',
          protocol: parts[3] || '',
          direction: 'in' as const,
        });
      }
    }
    res.json(rules);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/firewall/rules', requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const { action, port, from: fromAddr, protocol } = req.body;
    const cmd = action === 'allow' ? 'allow' : 'deny';
    const args = [cmd];
    if (fromAddr) args.push('from', fromAddr);
    if (port) args.push('to', 'any', 'port', port);
    if (protocol) args.push('proto', protocol);

    await CommandExecutor.execute('ufw', args, { sudo: true });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============ Services ============
router.get('/services', async (req: Request, res: Response) => {
  try {
    const type = (req.query.type as string) || 'service';
    const result = await CommandExecutor.execute('systemctl', ['list-units', `--type=${type}`, '--all', '--no-pager', '--no-legend']);
    const services: ServiceInfo[] = result.stdout.split('\n').filter(l => l.trim()).map(line => {
      const parts = line.trim().split(/\s+/);
      return {
        name: parts[0] || '',
        description: parts.slice(3).join(' ') || '',
        activeState: parts[2] || '',
        subState: parts[3] || '',
        loadState: parts[1] || '',
        unitFileState: '',
        pid: 0,
        memoryCurrent: 0,
      };
    });
    res.json(services);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/services/:name', async (req: Request, res: Response) => {
  try {
    const result = await CommandExecutor.execute('systemctl', ['show', req.params.name, '--no-pager']);
    const props = OutputParser.parseKeyValue(result.stdout);
    res.json({
      name: props['id'] || req.params.name,
      description: props['description'] || '',
      activeState: props['activestate'] || '',
      subState: props['substate'] || '',
      loadState: props['loadstate'] || '',
      unitFileState: props['unitfilestate'] || '',
      pid: parseInt(props['mainpid']) || 0,
      memoryCurrent: parseInt(props['memorycurrent']) || 0,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/services/:name/:action', requireRole('admin', 'operator'), async (req: Request, res: Response) => {
  try {
    const { name, action } = req.params;
    if (!['start', 'stop', 'restart', 'reload', 'enable', 'disable'].includes(action)) {
      res.status(400).json({ error: 'Invalid action' });
      return;
    }
    await CommandExecutor.execute('systemctl', [action, name], { sudo: true });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============ Packages ============
router.get('/packages', async (_req: Request, res: Response) => {
  try {
    const result = await CommandExecutor.execute('dpkg', ['-l']);
    const lines = result.stdout.split('\n').filter(l => l.trim()).slice(5);
    const packages: PackageInfo[] = lines.map(line => {
      const parts = line.trim().split(/\s+/);
      return {
        name: parts[1] || '',
        version: parts[2] || '',
        architecture: parts[3] || '',
        status: parts[0] || '',
        description: parts.slice(4).join(' ') || '',
      };
    });
    res.json(packages);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/packages/install', requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const { name } = req.body;
    if (!name) {
      res.status(400).json({ error: 'Package name required' });
      return;
    }
    await CommandExecutor.execute('apt', ['install', '-y', name], { sudo: true, timeout: 120000 });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/packages/remove', requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const { name, purge } = req.body;
    if (!name) {
      res.status(400).json({ error: 'Package name required' });
      return;
    }
    const cmd = purge ? 'purge' : 'remove';
    await CommandExecutor.execute('apt', [cmd, '-y', name], { sudo: true, timeout: 60000 });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/packages/update', requireRole('admin'), async (_req: Request, res: Response) => {
  try {
    await CommandExecutor.execute('apt', ['update', '-y'], { sudo: true, timeout: 120000 });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/packages/upgrade', requireRole('admin'), async (_req: Request, res: Response) => {
  try {
    await CommandExecutor.execute('apt', ['upgrade', '-y'], { sudo: true, timeout: 300000 });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============ Cron ============
router.get('/cron', async (_req: Request, res: Response) => {
  try {
    const result = await CommandExecutor.execute('crontab', ['-l']);
    const jobs: CronJob[] = result.stdout.split('\n')
      .filter(l => l.trim() && !l.startsWith('#'))
      .map((line, idx) => {
        const parts = line.trim().split(/\s+/);
        return {
          id: String(idx),
          schedule: parts.slice(0, 5).join(' '),
          command: parts.slice(5).join(' '),
          user: 'current',
        };
      });
    res.json(jobs);
  } catch (error: any) {
    if (error.message?.includes('no crontab')) {
      res.json([]);
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

router.post('/cron', requireRole('admin', 'operator'), async (req: Request, res: Response) => {
  try {
    const { schedule, command } = req.body;
    if (!schedule || !command) {
      res.status(400).json({ error: 'Schedule and command required' });
      return;
    }
    const entry = `${schedule} ${command}\n`;
    const existing = await CommandExecutor.execute('crontab', ['-l']);
    const newCrontab = existing.stdout + '\n' + entry;
    const { exec: execPromised } = await import('child_process');
    const { promisify } = await import('util');
    const exec = promisify(execPromised);
    await exec(`echo '${newCrontab.replace(/'/g, "'\\''")}' | crontab -`);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/cron/:id', requireRole('admin', 'operator'), async (req: Request, res: Response) => {
  try {
    const idx = parseInt(req.params.id);
    const existing = await CommandExecutor.execute('crontab', ['-l']);
    const lines = existing.stdout.split('\n').filter(l => l.trim() && !l.startsWith('#'));
    lines.splice(idx, 1);
    const { exec: execPromised } = await import('child_process');
    const { promisify } = await import('util');
    const exec = promisify(execPromised);
    await exec(`echo '${lines.join('\n').replace(/'/g, "'\\''")}' | crontab -`);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============ Logs ============
router.get('/logs', async (req: Request, res: Response) => {
  try {
    const unit = req.query.unit as string;
    const lines = req.query.lines ? `${req.query.lines}` : '100';
    const since = req.query.since as string;

    const args = ['--no-pager', '-n', lines];
    if (unit) args.push('-u', unit);
    if (since) args.push('--since', since);

    const result = await CommandExecutor.execute('journalctl', args);
    res.json({ logs: result.stdout });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
