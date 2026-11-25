import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { db, DATA_DIR } from './db.js';

const secretFile = path.join(DATA_DIR, '.jwt-secret');
const JWT_SECRET =
  process.env.JWT_SECRET ||
  (fs.existsSync(secretFile)
    ? fs.readFileSync(secretFile, 'utf8')
    : (() => {
        const s = crypto.randomBytes(48).toString('hex');
        fs.writeFileSync(secretFile, s);
        return s;
      })());

export const PUBLIC_USER_COLS = 'id, name, email, role, department, location, active, approved, created_at';

export const signToken = (user) => jwt.sign({ uid: user.id }, JWT_SECRET, { expiresIn: '7d' });

export function userFromToken(token) {
  if (!token) return null;
  try {
    const { uid } = jwt.verify(token, JWT_SECRET);
    return db.prepare(`SELECT ${PUBLIC_USER_COLS} FROM users WHERE id = ? AND active = 1 AND approved = 1`).get(uid) || null;
  } catch {
    return null;
  }
}

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const user = userFromToken(header.startsWith('Bearer ') ? header.slice(7) : null);
  if (!user) return res.status(401).json({ error: 'Sessão expirada. Faça login novamente.' });
  req.user = user;
  next();
}

export const requireRole =
  (...roles) =>
  (req, res, next) =>
    roles.includes(req.user.role) ? next() : res.status(403).json({ error: 'Você não tem permissão para isso.' });

export const isStaff = (user) => user.role === 'tecnico' || user.role === 'admin';
