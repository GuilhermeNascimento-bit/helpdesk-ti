import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db, nowIso } from '../db.js';
import { emitPendingUser } from '../realtime.js';
import { signToken, requireAuth, PUBLIC_USER_COLS } from '../auth.js';

export const authRouter = Router();

authRouter.post('/login', (req, res) => {
  const email = String(req.body?.email || '').trim();
  const password = String(req.body?.password || '');
  const row = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!row || !bcrypt.compareSync(password, row.password_hash)) {
    return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
  }
  if (!row.approved) {
    return res.status(403).json({ error: 'Seu cadastro ainda está aguardando a aprovação do administrador.', pending: true });
  }
  if (!row.active) return res.status(403).json({ error: 'Usuário desativado. Fale com o administrador.' });
  const user = db.prepare(`SELECT ${PUBLIC_USER_COLS} FROM users WHERE id = ?`).get(row.id);
  res.json({ token: signToken(user), user });
});

authRouter.get('/me', requireAuth, (req, res) => res.json(req.user));

// ---------- Cadastro (fica pendente até o admin aprovar) ----------
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
authRouter.post('/register', (req, res) => {
  const b = req.body || {};
  const name = String(b.name || '').trim();
  const email = String(b.email || '').trim().toLowerCase();
  const password = String(b.password || '');
  const department = String(b.department || '').trim();
  const location = String(b.location || '').trim();
  const bad = (error) => res.status(400).json({ error });

  if (name.length < 3 || !name.includes(' ')) return bad('Informe seu nome e sobrenome.');
  if (department.length < 2) return bad('Informe o seu setor.');
  if (location.length < 2) return bad('Informe onde você trabalha (andar, sala ou mesa).');
  if (!EMAIL_RE.test(email)) return bad('E-mail inválido.');
  if (password.length < 6) return bad('A senha precisa ter pelo menos 6 caracteres.');
  const existing = db.prepare('SELECT approved FROM users WHERE email = ?').get(email);
  if (existing) {
    return bad(existing.approved ? 'Já existe uma conta com esse e-mail. Tente entrar.' : 'Esse e-mail já tem um cadastro aguardando aprovação.');
  }

  const r = db
    .prepare(
      `INSERT INTO users (name, email, password_hash, role, department, location, active, approved, created_at)
       VALUES (?, ?, ?, 'colaborador', ?, ?, 1, 0, ?)`
    )
    .run(name, email, bcrypt.hashSync(password, 10), department, location, nowIso());
  const user = db.prepare(`SELECT ${PUBLIC_USER_COLS} FROM users WHERE id = ?`).get(Number(r.lastInsertRowid));
  emitPendingUser(user);
  res.status(201).json({ ok: true });
});

authRouter.post('/password', requireAuth, (req, res) => {
  const { current, next } = req.body || {};
  const row = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user.id);
  if (!bcrypt.compareSync(String(current || ''), row.password_hash)) {
    return res.status(400).json({ error: 'Senha atual incorreta.' });
  }
  if (String(next || '').length < 6) return res.status(400).json({ error: 'A nova senha precisa ter pelo menos 6 caracteres.' });
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(String(next), 10), req.user.id);
  res.json({ ok: true });
});
