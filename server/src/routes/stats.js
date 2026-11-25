import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth, requireRole } from '../auth.js';
import { ACTIVE_SQL, todayYmd } from '../constants.js';

export const statsRouter = Router();
statsRouter.use(requireAuth);

const one = (sql, ...p) => db.prepare(sql).get(...p);
const all = (sql, ...p) => db.prepare(sql).all(...p);
const ACTIVE = ACTIVE_SQL;
const DONE = "('resolvido','fechado')";

const since14 = () => {
  const since = new Date(Date.now() - 13 * 864e5);
  since.setUTCHours(0, 0, 0, 0);
  return since.toISOString();
};

// ---------- Desempenho do próprio técnico ----------
statsRouter.get('/me', requireRole('tecnico', 'admin'), (req, res) => {
  const id = req.user.id;
  const since = since14();
  res.json({
    totals: one(
      `SELECT COUNT(*) AS handled,
              SUM(CASE WHEN status IN ${ACTIVE} THEN 1 ELSE 0 END) AS active,
              SUM(CASE WHEN status IN ${DONE} THEN 1 ELSE 0 END) AS resolved,
              SUM(CASE WHEN status IN ${DONE} AND resolution_type = 'online' THEN 1 ELSE 0 END) AS online,
              SUM(CASE WHEN status IN ${DONE} AND resolution_type = 'presencial' THEN 1 ELSE 0 END) AS presencial,
              AVG(rating) AS rating, COUNT(rating) AS ratings,
              AVG(CASE WHEN resolved_at IS NOT NULL THEN (julianday(resolved_at) - julianday(created_at)) * 24 END) AS avg_hours
       FROM tickets WHERE technician_id = ?`,
      id
    ),
    thisMonth: one(
      `SELECT COUNT(*) AS n FROM tickets WHERE technician_id = ? AND resolved_at >= ?`,
      id,
      new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
    ).n,
    distribution: Object.fromEntries(
      all('SELECT rating, COUNT(*) AS n FROM tickets WHERE technician_id = ? AND rating IS NOT NULL GROUP BY rating', id).map((r) => [
        r.rating,
        r.n,
      ])
    ),
    daily: all(
      'SELECT substr(resolved_at, 1, 10) AS day, COUNT(*) AS n FROM tickets WHERE technician_id = ? AND resolved_at >= ? GROUP BY day',
      id,
      since
    ),
    since,
    reviews: all(
      `SELECT t.id, t.title, t.rating, t.rating_comment, t.closed_at, u.name AS requester_name
       FROM tickets t JOIN users u ON u.id = t.requester_id
       WHERE t.technician_id = ? AND t.rating IS NOT NULL
       ORDER BY t.closed_at DESC LIMIT 8`,
      id
    ),
  });
});

// ---------- Painel geral (admin) ----------
statsRouter.get('/', requireRole('admin'), (_req, res) => {
  const since = since14();
  res.json({
    byStatus: Object.fromEntries(all('SELECT status, COUNT(*) AS n FROM tickets GROUP BY status').map((r) => [r.status, r.n])),
    waiting: one(
      "SELECT COUNT(*) AS n, SUM(CASE WHEN pending_due < ? THEN 1 ELSE 0 END) AS overdue FROM tickets WHERE status = 'aguardando'",
      todayYmd()
    ),
    queue: one("SELECT COUNT(*) AS n FROM tickets WHERE status = 'aberto' AND technician_id IS NULL").n,
    urgentActive: one(`SELECT COUNT(*) AS n FROM tickets WHERE priority = 'urgente' AND status IN ${ACTIVE}`).n,
    avgResolutionHours: one(
      'SELECT AVG((julianday(resolved_at) - julianday(created_at)) * 24) AS h FROM tickets WHERE resolved_at IS NOT NULL'
    ).h,
    rating: one('SELECT AVG(rating) AS avg, COUNT(rating) AS n FROM tickets WHERE rating IS NOT NULL'),
    resolution: Object.fromEntries(
      all(
        `SELECT resolution_type AS type, COUNT(*) AS n FROM tickets WHERE status IN ${DONE} AND resolution_type IS NOT NULL GROUP BY resolution_type`
      ).map((r) => [r.type, r.n])
    ),
    byCategory: all('SELECT category, COUNT(*) AS n FROM tickets GROUP BY category ORDER BY n DESC'),
    technicians: all(`
      SELECT u.id, u.name, u.avatar_url,
             COUNT(t.id) AS total,
             SUM(CASE WHEN t.status IN ${ACTIVE} THEN 1 ELSE 0 END) AS active,
             SUM(CASE WHEN t.status IN ${DONE} THEN 1 ELSE 0 END) AS resolved,
             SUM(CASE WHEN t.resolution_type = 'online' AND t.status IN ${DONE} THEN 1 ELSE 0 END) AS online,
             AVG(t.rating) AS rating
      FROM users u LEFT JOIN tickets t ON t.technician_id = u.id
      WHERE u.role IN ('tecnico','admin') AND u.active = 1
      GROUP BY u.id ORDER BY resolved DESC, u.name`),
    daily: all('SELECT substr(created_at, 1, 10) AS day, COUNT(*) AS n FROM tickets WHERE created_at >= ? GROUP BY day', since),
    since,
  });
});
