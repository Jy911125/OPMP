import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { config } from '../config/index.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { apiRateLimit, authRateLimit } from '../middleware/rateLimit.js';

const router = Router();

interface User {
  id: string;
  username: string;
  password: string;
  role: 'admin' | 'operator' | 'viewer';
}

const defaultUsers: User[] = [
  {
    id: '1',
    username: 'admin',
    password: bcrypt.hashSync('opmp@2026', 10),
    role: 'admin',
  },
  {
    id: '2',
    username: 'operator',
    password: bcrypt.hashSync('operator@2026', 10),
    role: 'operator',
  },
  {
    id: '3',
    username: 'viewer',
    password: bcrypt.hashSync('viewer@2026', 10),
    role: 'viewer',
  },
];

let users = [...defaultUsers];

function generateToken(user: User) {
  const payload = { userId: user.id, username: user.username, role: user.role };
  const accessToken = jwt.sign(payload, config.JWT_SECRET, { expiresIn: config.JWT_EXPIRES_IN });
  const refreshToken = jwt.sign(payload, config.JWT_SECRET, { expiresIn: config.JWT_REFRESH_EXPIRES_IN });
  return { accessToken, refreshToken };
}

router.post('/login', authRateLimit, (req: Request, res: Response) => {
  const { username, password } = req.body;

  if (!username || !password) {
    res.status(400).json({ error: 'Username and password required' });
    return;
  }

  const user = users.find(u => u.username === username);
  if (!user || !bcrypt.compareSync(password, user.password)) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const tokens = generateToken(user);
  res.json({
    ...tokens,
    user: { id: user.id, username: user.username, role: user.role },
  });
});

router.post('/refresh', (req: Request, res: Response) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    res.status(400).json({ error: 'Refresh token required' });
    return;
  }

  try {
    const decoded = jwt.verify(refreshToken, config.JWT_SECRET) as any;
    const tokens = generateToken({ id: decoded.userId, username: decoded.username, password: '', role: decoded.role });
    res.json(tokens);
  } catch {
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});

router.get('/me', authMiddleware, (req: Request, res: Response) => {
  res.json({ user: req.user });
});

export default router;
