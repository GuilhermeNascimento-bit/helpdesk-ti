import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db, nowIso } from '../db.js';
import { requireAuth, requireRole, PUBLIC_USER_COLS } from '../auth.js';
import { ROLES } from '../constants.js';
import { emitPendingUser } from '../realtime.js';
import { isDemoAccount } from '../demo.js';

export const usersRouter = Router();
usersRouter.use(requireAuth);

const bad = (res, error, status = 400) => res.status(status).json({ error });
const getUser = (id) => db.prepare(`SELECT ${PUBLIC_USER_COLS} FROM users WHERE id = ?`).get(id);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Lista de técnicos (para atribuir chamados)
usersRouter.get('/technicians', requireRole('tecnico', 'admin'), (_req, res) => {
  res.json(db.prepare("SELECT id, name, role FROM users WHERE active = 1 AND role IN ('tecnico','admin') ORDER BY name").all());
});

usersRouter.use(requireRole('admin'));

usersRouter.get('/', (_req, res) => {
  res.json(
    db
      .prepare(
        `SELECT ${PUBLIC_USER_COLS},
           (SELECT COUNT(*) FROM tickets t WHERE t.requester_id = users.id) AS tickets_opened,
           (SELECT COUNT(*) FROM tickets t WHERE t.technician_id = users.id) AS tickets_handled
         FROM users ORDER BY approved ASC, active DESC, name`
      )
      .all()
  );
});

usersRouter.post('/', (req, res) => {
  const name = String(req.body?.name || '').trim();
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  const role = req.body?.role;
  if (name.length < 2) return bad(res, 'Informe o nome.');
  if (!EMAIL_RE.test(email)) return bad(res, 'E-mail inválido.');
  if (password.length < 6) return bad(res, 'A senha precisa ter pelo menos 6 caracteres.');
  if (!ROLES.includes(role)) return bad(res, 'Perfil inválido.');
  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) return bad(res, 'Já existe um usuário com esse e-mail.');

  const r = db
    .prepare(
      'INSERT INTO users (name, email, password_hash, role, department, location, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    )
    .run(
      name,
      email,
      bcrypt.hashSync(password, 10),
      role,
      String(req.body?.department || '').trim() || null,
      String(req.body?.location || '').trim() || null,
      nowIso()
    );
  res.status(201).json(getUser(Number(r.lastInsertRowid)));
});

// ---------- Cadastros aguardando aprovação ----------
usersRouter.post('/:id/approve', (req, res) => {
  const id = Number(req.params.id);
  const u = getUser(id);
  if (!u) return bad(res, 'Usuário não encontrado.', 404);
  if (u.approved) return bad(res, 'Esse cadastro já foi aprovado.');
  const role = req.body?.role || 'colaborador';
  if (!ROLES.includes(role)) return bad(res, 'Perfil inválido.');
  db.prepare('UPDATE users SET approved = 1, active = 1, role = ? WHERE id = ?').run(role, id);
  const user = getUser(id);
  emitPendingUser(user, 'approved');
  res.json(user);
});

usersRouter.delete('/:id', (req, res) => {
  const id = Number(req.params.id);
  const u = getUser(id);
  if (!u) return bad(res, 'Usuário não encontrado.', 404);
  // Só cadastros ainda não aprovados podem ser apagados; os demais são desativados (mantém o histórico)
  if (u.approved) return bad(res, 'Só é possível recusar cadastros pendentes. Para tirar o acesso, desative o usuário.');
  db.prepare('DELETE FROM users WHERE id = ? AND approved = 0').run(id);
  emitPendingUser(u, 'rejected');
  res.json({ ok: true });
});

usersRouter.patch('/:id', (req, res) => {
  const id = Number(req.params.id);
  const current = getUser(id);
  if (current && isDemoAccount(current.email) && ['email', 'role', 'active', 'password'].some((k) => req.body?.[k] !== undefined && String(req.body[k]) !== String(k === 'active' ? !!current.active : current[k]))) {
    return bad(res, 'Esta é uma conta de demonstração: e-mail, perfil, senha e status não podem ser alterados.', 403);
  }
  if (!current) return bad(res, 'Usuário não encontrado.', 404);
  const b = req.body || {};
  const fields = {};

  if (b.name !== undefined) {
    if (String(b.name).trim().length < 2) return bad(res, 'Informe o nome.');
    fields.name = String(b.name).trim();
  }
  if (b.email !== undefined) {
    const email = String(b.email).trim().toLowerCase();
    if (!EMAIL_RE.test(email)) return bad(res, 'E-mail inválido.');
    if (db.prepare('SELECT 1 FROM users WHERE email = ? AND id <> ?').get(email, id)) return bad(res, 'E-mail já em uso.');
    fields.email = email;
  }
  if (b.role !== undefined) {
    if (!ROLES.includes(b.role)) return bad(res, 'Perfil inválido.');
    if (id === req.user.id && b.role !== 'admin') return bad(res, 'Você não pode remover seu próprio acesso de administrador.');
    fields.role = b.role;
  }
  if (b.department !== undefined) fields.department = String(b.department).trim() || null;
  if (b.location !== undefined) fields.location = String(b.location).trim() || null;
  if (b.active !== undefined) {
    if (id === req.user.id && !b.active) return bad(res, 'Você não pode desativar a si mesmo.');
    fields.active = b.active ? 1 : 0;
  }
  if (b.password) {
    if (String(b.password).length < 6) return bad(res, 'A senha precisa ter pelo menos 6 caracteres.');
    fields.password_hash = bcrypt.hashSync(String(b.password), 10);
  }

  const keys = Object.keys(fields);
  if (keys.length) {
    db.prepare(`UPDATE users SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`).run(...keys.map((k) => fields[k]), id);
  }
  res.json(getUser(id));
});
