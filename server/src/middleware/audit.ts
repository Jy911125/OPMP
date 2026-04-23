import { Request, Response, NextFunction } from 'express';
import fs from 'fs/promises';
import path from 'path';

interface AuditEntry {
  timestamp: string;
  userId: string;
  method: string;
  path: string;
  body?: any;
  ip: string;
  userAgent: string;
}

const AUDIT_LOG_PATH = process.env.AUDIT_LOG_PATH || '/var/log/opmp/audit.log';

export async function auditMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  const entry: AuditEntry = {
    timestamp: new Date().toISOString(),
    userId: req.user?.userId || 'anonymous',
    method: req.method,
    path: req.path,
    ip: req.ip || req.socket.remoteAddress || 'unknown',
    userAgent: req.get('user-agent') || 'unknown',
  };

  if (req.method !== 'GET' && req.body) {
    entry.body = sanitizeBody(req.body);
  }

  writeAudit(entry).catch(() => {});
  next();
}

function sanitizeBody(body: any): any {
  if (!body || typeof body !== 'object') return body;
  const sanitized = { ...body };
  for (const key of ['password', 'token', 'secret', 'key']) {
    if (sanitized[key]) sanitized[key] = '***';
  }
  return sanitized;
}

async function writeAudit(entry: AuditEntry): Promise<void> {
  try {
    const dir = path.dirname(AUDIT_LOG_PATH);
    await fs.mkdir(dir, { recursive: true });
    await fs.appendFile(AUDIT_LOG_PATH, JSON.stringify(entry) + '\n');
  } catch {
    // Silent fail - audit logging should not break requests
  }
}
