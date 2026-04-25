import { z } from 'zod';

const commandSchema = z.object({
  command: z.string(),
  allowedArgs: z.array(z.string()),
  allowPathArg: z.boolean().default(false),
  maxPathLength: z.number().default(4096),
  allowSudo: z.boolean().default(false),
  argPattern: z.instanceof(RegExp).optional(),
});

export type WhitelistedCommand = z.infer<typeof commandSchema>;

export const COMMAND_WHITELIST: Record<string, WhitelistedCommand> = {
  // File system
  ls: {
    command: 'ls',
    allowedArgs: ['-l', '-a', '-h', '-R', '-la', '-lah', '-lha'],
    allowPathArg: true,
    maxPathLength: 4096,
    allowSudo: false,
  },
  stat: {
    command: 'stat',
    allowedArgs: ['-c', '%a %U %G %s %Y %n'],
    allowPathArg: true,
    maxPathLength: 4096,
    allowSudo: false,
  },
  cat: {
    command: 'cat',
    allowedArgs: [],
    allowPathArg: true,
    maxPathLength: 4096,
    allowSudo: false,
  },
  find: {
    command: 'find',
    allowedArgs: ['-name', '-type', '-size', '-mtime', '-maxdepth'],
    allowPathArg: true,
    maxPathLength: 4096,
    allowSudo: false,
  },
  df: {
    command: 'df',
    allowedArgs: ['-h', '-B', '--output'],
    allowPathArg: false,
    maxPathLength: 0,
    allowSudo: false,
  },
  du: {
    command: 'du',
    allowedArgs: ['-h', '-s', '-d', '-a'],
    allowPathArg: true,
    maxPathLength: 4096,
    allowSudo: false,
  },
  mkdir: {
    command: 'mkdir',
    allowedArgs: ['-p', '-m'],
    allowPathArg: true,
    allowSudo: true,
    maxPathLength: 4096,
  },
  touch: {
    command: 'touch',
    allowedArgs: ['-m', '-a'],
    allowPathArg: true,
    allowSudo: true,
    maxPathLength: 4096,
  },
  rm: {
    command: 'rm',
    allowedArgs: ['-r', '-f', '-rf'],
    allowPathArg: true,
    allowSudo: true,
    maxPathLength: 4096,
  },
  chmod: {
    command: 'chmod',
    allowedArgs: [],
    allowPathArg: true,
    allowSudo: true,
    maxPathLength: 4096,
    argPattern: /^[0-7]{3,4}$/,
  },
  chown: {
    command: 'chown',
    allowedArgs: ['-R'],
    allowPathArg: true,
    allowSudo: true,
    maxPathLength: 4096,
  },
  cp: {
    command: 'cp',
    allowedArgs: ['-r', '-p'],
    allowPathArg: true,
    allowSudo: true,
    maxPathLength: 4096,
  },
  mv: {
    command: 'mv',
    allowedArgs: [],
    allowPathArg: true,
    allowSudo: true,
    maxPathLength: 4096,
  },

  // Process
  ps: {
    command: 'ps',
    allowedArgs: ['aux', 'auxwww', '-ef', '-eo'],
    allowPathArg: false,
    maxPathLength: 0,
    allowSudo: false,
  },
  top: {
    command: 'top',
    allowedArgs: ['-bn1', '-bn2'],
    allowPathArg: false,
    maxPathLength: 0,
    allowSudo: false,
  },
  kill: {
    command: 'kill',
    allowedArgs: ['-9', '-15', '-HUP', '-SIGTERM', '-SIGKILL'],
    allowPathArg: true,
    allowSudo: true,
    maxPathLength: 10,
    argPattern: /^\d+$/,
  },

  // User management
  whoami: {
    command: 'whoami',
    allowedArgs: [],
    allowPathArg: false,
    maxPathLength: 0,
    allowSudo: false,
  },
  id: {
    command: 'id',
    allowedArgs: [],
    allowPathArg: true,
    maxPathLength: 64,
    allowSudo: false,
  },
  useradd: {
    command: 'useradd',
    allowedArgs: ['-m', '-d', '-s', '-g', '-G', '-c'],
    allowPathArg: true,
    allowSudo: true,
    maxPathLength: 256,
  },
  userdel: {
    command: 'userdel',
    allowedArgs: ['-r'],
    allowPathArg: true,
    allowSudo: true,
    maxPathLength: 64,
  },
  usermod: {
    command: 'usermod',
    allowedArgs: ['-aG', '-G', '-s', '-d', '-L', '-U'],
    allowPathArg: true,
    allowSudo: true,
    maxPathLength: 256,
  },
  groupadd: {
    command: 'groupadd',
    allowedArgs: [],
    allowPathArg: true,
    allowSudo: true,
    maxPathLength: 64,
  },
  groupdel: {
    command: 'groupdel',
    allowedArgs: [],
    allowPathArg: true,
    allowSudo: true,
    maxPathLength: 64,
  },
  passwd: {
    command: 'passwd',
    allowedArgs: [],
    allowPathArg: true,
    allowSudo: true,
    maxPathLength: 64,
  },

  // Network
  ip: {
    command: 'ip',
    allowedArgs: ['addr', 'addr show', 'route', 'route show', 'link', 'link show', 'neigh'],
    allowPathArg: false,
    maxPathLength: 0,
    allowSudo: false,
  },
  ss: {
    command: 'ss',
    allowedArgs: ['-tulnp', '-tuln', '-tlnp', '-ulnp'],
    allowPathArg: false,
    maxPathLength: 0,
    allowSudo: false,
  },
  ufw: {
    command: 'ufw',
    allowedArgs: ['status', 'status verbose', 'allow', 'deny', 'delete', 'enable', 'disable', 'reload'],
    allowPathArg: true,
    allowSudo: true,
    maxPathLength: 256,
  },

  // Service management
  systemctl: {
    command: 'systemctl',
    allowedArgs: ['start', 'stop', 'restart', 'reload', 'status', 'enable', 'disable',
      'list-units', 'list-unit-files', 'list-timers', 'is-active', 'is-enabled',
      'show', 'cat', 'daemon-reload'],
    allowPathArg: true,
    allowSudo: true,
    maxPathLength: 256,
  },
  journalctl: {
    command: 'journalctl',
    allowedArgs: ['-u', '-n', '--since', '--until', '-f', '--no-pager', '-p', '-o',
      '--output', '-b', '-k', '--disk-usage'],
    allowPathArg: true,
    maxPathLength: 256,
    allowSudo: false,
  },

  // Package management
  apt: {
    command: 'apt',
    allowedArgs: ['list', 'search', 'show', 'update', 'upgrade', 'install', 'remove',
      'autoremove', 'purge'],
    allowPathArg: true,
    allowSudo: true,
    maxPathLength: 256,
  },
  dpkg: {
    command: 'dpkg',
    allowedArgs: ['-l', '-s', '-L', '-S'],
    allowPathArg: true,
    maxPathLength: 256,
    allowSudo: false,
  },

  // Cron
  crontab: {
    command: 'crontab',
    allowedArgs: ['-l', '-e', '-r'],
    allowPathArg: false,
    maxPathLength: 0,
    allowSudo: true,
  },

  // System info
  uname: {
    command: 'uname',
    allowedArgs: ['-a', '-r', '-m', '-s'],
    allowPathArg: false,
    maxPathLength: 0,
    allowSudo: false,
  },
  uptime: {
    command: 'uptime',
    allowedArgs: ['-p', '-s'],
    allowPathArg: false,
    maxPathLength: 0,
    allowSudo: false,
  },
  hostname: {
    command: 'hostname',
    allowedArgs: ['-f', '-I', '-d'],
    allowPathArg: false,
    maxPathLength: 0,
    allowSudo: false,
  },
  free: {
    command: 'free',
    allowedArgs: ['-h', '-b', '-k', '-m', '-g'],
    allowPathArg: false,
    maxPathLength: 0,
    allowSudo: false,
  },
  lscpu: {
    command: 'lscpu',
    allowedArgs: [],
    allowPathArg: false,
    maxPathLength: 0,
    allowSudo: false,
  },
  date: {
    command: 'date',
    allowedArgs: ['+%Y-%m-%d %H:%M:%S', '+%Z', '+%s'],
    allowPathArg: false,
    maxPathLength: 0,
    allowSudo: false,
  },
  timedatectl: {
    command: 'timedatectl',
    allowedArgs: ['status'],
    allowPathArg: false,
    maxPathLength: 0,
    allowSudo: false,
  },
};

export function isCommandAllowed(command: string): boolean {
  return command in COMMAND_WHITELIST;
}

export function validateCommandArgs(command: string, args: string[]): { valid: boolean; reason?: string } {
  const whitelist = COMMAND_WHITELIST[command];
  if (!whitelist) {
    return { valid: false, reason: `Command '${command}' is not in whitelist` };
  }

  for (const arg of args) {
    if (arg.startsWith('-')) {
      if (!whitelist.allowedArgs.some(allowed => arg === allowed || arg.startsWith(allowed.split(' ')[0]))) {
        return { valid: false, reason: `Argument '${arg}' is not allowed for command '${command}'` };
      }
    } else if (whitelist.argPattern && !whitelist.argPattern.test(arg)) {
      return { valid: false, reason: `Argument '${arg}' does not match allowed pattern` };
    } else if (!whitelist.allowPathArg) {
      return { valid: false, reason: `Path arguments are not allowed for command '${command}'` };
    } else if (arg.length > whitelist.maxPathLength) {
      return { valid: false, reason: `Argument exceeds maximum length of ${whitelist.maxPathLength}` };
    }
  }

  return { valid: true };
}
