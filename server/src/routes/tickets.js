import { Router } from 'express';
import { db, nowIso } from '../db.js';
import { requireAuth, requireRole, isStaff } from '../auth.js';
import { upload, fileInfo, discardUpload } from '../uploads.js';
import { CATEGORIES, PRIORITIES, ACTIVE_STATUSES, ACTIVE_SQL, UNCLASSIFIED, fmtDateTime, fmtDay, todayYmd } from '../constants.js';
import { emitTicket, emitMessage } from '../realtime.js';

export const ticketsRouter = Router();
ticketsRouter.use(requireAuth);

const TICKET_SELECT = `
  SELECT t.*,
         r.name AS requester_name, r.email AS requester_email, r.department AS requester_department,
         te.name AS technician_name,
         (SELECT COUNT(*) FROM messages m WHERE m.ticket_id = t.id AND m.is_system = 0) AS message_count
  FROM tickets t
  JOIN users r ON r.id = t.requester_id
  LEFT JOIN users te ON te.id = t.technician_id`;

const MESSAGE_SELECT = `
  SELECT m.*, u.name AS user_name, u.role AS user_role
  FROM messages m LEFT JOIN users u ON u.id = m.user_id`;

function deriveTitle(text) {
  const line = text.split('\n').find((l) => l.trim()) || 'Chamado';
  const clean = line.trim().replace(/\s+/g, ' ');
  return clean.length > 70 ? clean.slice(0, 67).replace(/\s+\S*$/, '') + '…' : clean;
}

const getTicket = (id) => db.prepare(`${TICKET_SELECT} WHERE t.id = ?`).get(id);
const getMessage = (id) => db.prepare(`${MESSAGE_SELECT} WHERE m.id = ?`).get(id);
const canView = (user, t) => isStaff(user) || t.requester_id === user.id;
const bad = (res, error, status = 400) => res.status(status).json({ error });

function addMessage(ticketId, { userId = null, body = '', file = null, system = false }) {
  const r = db
    .prepare(
      `INSERT INTO messages (ticket_id, user_id, body, attachment_url, attachment_name, attachment_type, is_system, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(ticketId, userId, body, file?.url ?? null, file?.name ?? null, file?.type ?? null, system ? 1 : 0, nowIso());
  return getMessage(Number(r.lastInsertRowid));
}

/** Atualiza colunas do chamado (nomes de colunas vêm só do código) e sempre toca updated_at. */
function updateTicket(id, fields = {}) {
  const keys = Object.keys(fields);
  const sets = [...keys.map((k) => `${k} = ?`), 'updated_at = ?'];
  db.prepare(`UPDATE tickets SET ${sets.join(', ')} WHERE id = ?`).run(...keys.map((k) => fields[k] ?? null), nowIso(), id);
}

/** Envia as novas mensagens e o estado atualizado em tempo real, e devolve a resposta HTTP. */
function publish(res, ticketId, event, actorId, messages = []) {
  const ticket = getTicket(ticketId);
  for (const m of messages) emitMessage(ticket, m);
  emitTicket(ticket, event, actorId);
  res.json({ ticket, messages });
}

function loadTicket(req, res, next) {
  const t = getTicket(Number(req.params.id));
  if (!t || !canView(req.user, t)) return (discardUpload(req), bad(res, 'Chamado não encontrado.', 404));
  req.ticket = t;
  next();
}

const requireActive = (req, res, next) =>
  ACTIVE_STATUSES.includes(req.ticket.status) ? next() : bad(res, 'Este chamado não está mais em andamento.');

/** Técnico responsável ou admin. Se ninguém assumiu ainda, quem agir assume. */
function requireHandler(req, res, next) {
  const t = req.ticket;
  if (t.technician_id && t.technician_id !== req.user.id && req.user.role !== 'admin') {
    return bad(res, `Este chamado está com ${t.technician_name}.`, 403);
  }
  next();
}

// ---------- Listagem ----------
ticketsRouter.get('/', (req, res) => {
  const { status, scope, q } = req.query;
  const where = [];
  const params = [];

  if (!isStaff(req.user) || scope === 'requested') {
    where.push('t.requester_id = ?');
    params.push(req.user.id);
  } else if (scope === 'mine') {
    where.push('t.technician_id = ?');
    params.push(req.user.id);
  } else if (scope === 'queue') {
    where.push("t.technician_id IS NULL AND t.status = 'aberto'");
  } else if (scope === 'waiting') {
    where.push("t.status = 'aguardando'");
  }

  if (status === 'ativos') where.push(`t.status IN (${ACTIVE_STATUSES.map(() => '?').join(',')})`), params.push(...ACTIVE_STATUSES);
  else if (status === 'encerrados') where.push("t.status IN ('fechado','cancelado')");
  else if (status) where.push('t.status = ?'), params.push(String(status));

  if (q) {
    const term = String(q).trim();
    where.push('(t.title LIKE ? OR t.description LIKE ? OR r.name LIKE ? OR CAST(t.id AS TEXT) = ?)');
    params.push(`%${term}%`, `%${term}%`, `%${term}%`, term.replace(/^#/, ''));
  }

  const sql = `${TICKET_SELECT}
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY CASE WHEN t.status IN ${ACTIVE_SQL} THEN 0 ELSE 1 END,
             ${scope === 'waiting' ? 't.pending_due,' : ''}
             CASE t.priority WHEN 'urgente' THEN 0 WHEN 'alta' THEN 1 WHEN 'media' THEN 2 ELSE 3 END,
             t.updated_at DESC
    LIMIT 500`;
  res.json(db.prepare(sql).all(...params));
});

// ---------- Abrir chamado ----------
ticketsRouter.post('/', upload.single('file'), (req, res) => {
  const description = String(req.body.description || '').trim();
  // O colaborador só descreve; título e categoria são opcionais (o técnico classifica depois)
  const title = String(req.body.title || '').trim() || deriveTitle(description);
  const category = req.body.category || UNCLASSIFIED;
  const { priority } = req.body;
  const location = String(req.body.location || req.user.location || '').trim();

  const fail = (msg) => (discardUpload(req), bad(res, msg));
  if (description.length < 5) return fail('Conte um pouco mais sobre o problema (pelo menos uma frase curta).');
  if (!CATEGORIES.includes(category)) return fail('Escolha uma categoria válida.');
  if (!PRIORITIES.includes(priority)) return fail('Escolha uma prioridade válida.');

  const now = nowIso();
  const r = db
    .prepare(
      `INSERT INTO tickets (title, description, category, priority, location, requester_id, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'aberto', ?, ?)`
    )
    .run(title, description, category, priority, location || null, req.user.id, now, now);
  const id = Number(r.lastInsertRowid);

  addMessage(id, { body: `Chamado aberto por ${req.user.name}.`, system: true });
  if (req.file) addMessage(id, { userId: req.user.id, file: fileInfo(req.file) });

  const ticket = getTicket(id);
  emitTicket(ticket, 'created', req.user.id);
  res.status(201).json(ticket);
});

// ---------- Detalhe ----------
ticketsRouter.get('/:id', loadTicket, (req, res) => {
  const messages = db.prepare(`${MESSAGE_SELECT} WHERE m.ticket_id = ? ORDER BY m.id`).all(req.ticket.id);
  res.json({ ticket: req.ticket, messages });
});

// ---------- Ajustar prioridade / categoria (T.I) ----------
ticketsRouter.patch('/:id', requireRole('tecnico', 'admin'), loadTicket, requireActive, (req, res) => {
  const t = req.ticket;
  const changes = {};
  const notes = [];
  if (req.body.priority && req.body.priority !== t.priority) {
    if (!PRIORITIES.includes(req.body.priority)) return bad(res, 'Prioridade inválida.');
    changes.priority = req.body.priority;
    notes.push(`prioridade → ${req.body.priority}`);
  }
  if (req.body.category && req.body.category !== t.category) {
    if (!CATEGORIES.includes(req.body.category)) return bad(res, 'Categoria inválida.');
    changes.category = req.body.category;
    notes.push(`categoria → ${req.body.category}`);
  }
  if (!notes.length) return res.json({ ticket: t, messages: [] });
  updateTicket(t.id, changes);
  const msg = addMessage(t.id, { body: `${req.user.name} alterou ${notes.join(', ')}.`, system: true });
  publish(res, t.id, 'updated', req.user.id, [msg]);
});

// ---------- Assumir / atribuir ----------
ticketsRouter.post('/:id/assign', requireRole('tecnico', 'admin'), loadTicket, requireActive, (req, res) => {
  const t = req.ticket;
  const techId = req.body?.technician_id ? Number(req.body.technician_id) : req.user.id;
  if (techId !== req.user.id && req.user.role !== 'admin') return bad(res, 'Só o administrador pode atribuir a outra pessoa.', 403);

  const tech = db
    .prepare("SELECT id, name FROM users WHERE id = ? AND active = 1 AND role IN ('tecnico','admin')")
    .get(techId);
  if (!tech) return bad(res, 'Técnico não encontrado.');
  if (t.technician_id === tech.id) return bad(res, `O chamado já está com ${tech.name}.`);

  updateTicket(t.id, { technician_id: tech.id, status: t.status === 'aberto' ? 'em_atendimento' : t.status });
  const body =
    tech.id === req.user.id ? `${tech.name} assumiu o chamado.` : `${req.user.name} atribuiu o chamado a ${tech.name}.`;
  publish(res, t.id, 'assigned', req.user.id, [addMessage(t.id, { body, system: true })]);
});

// ---------- Agendar visita presencial ----------
ticketsRouter.post('/:id/visit', requireRole('tecnico', 'admin'), loadTicket, requireActive, requireHandler, (req, res) => {
  const t = req.ticket;
  const when = new Date(req.body?.visit_at);
  if (!req.body?.visit_at || Number.isNaN(when.getTime())) return bad(res, 'Informe a data e hora da visita.');
  const note = String(req.body?.note || '').trim();

  updateTicket(t.id, {
    technician_id: t.technician_id ?? req.user.id,
    status: 'visita_agendada',
    visit_at: when.toISOString(),
    resolution_type: 'presencial',
  });
  const where = t.location ? ` (${t.location})` : '';
  const onTheWay = when.getTime() - Date.now() < 10 * 60e3;
  const what = onTheWay
    ? `${req.user.name} está a caminho${where}.`
    : `${req.user.name} agendou uma visita presencial para ${fmtDateTime(when)}${where}.`;
  const body = `${what}${note ? `\n${note}` : ''}`;
  publish(res, t.id, 'visit', req.user.id, [addMessage(t.id, { body, system: true })]);
});

// ---------- Aguardar compra ou serviço terceirizado ----------
const NO_PENDING = { pending_type: null, pending_item: null, pending_due: null, pending_since: null };
const PENDING_LABEL = { compra: 'a compra de', terceirizado: 'um serviço terceirizado:' };

ticketsRouter.post('/:id/wait', requireRole('tecnico', 'admin'), loadTicket, requireActive, requireHandler, (req, res) => {
  const t = req.ticket;
  const type = req.body?.type;
  const item = String(req.body?.item || '').trim();
  const due = String(req.body?.due || '');
  const note = String(req.body?.note || '').trim();
  if (!['compra', 'terceirizado'].includes(type)) return bad(res, 'Informe se é uma compra ou um serviço terceirizado.');
  if (item.length < 2) return bad(res, type === 'compra' ? 'Informe o que vai ser comprado.' : 'Informe qual serviço foi acionado.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(due) || Number.isNaN(new Date(due).getTime())) return bad(res, 'Informe o prazo de chegada.');
  if (due < todayYmd()) return bad(res, 'O prazo não pode estar no passado.');

  const updating = t.status === 'aguardando';
  updateTicket(t.id, {
    technician_id: t.technician_id ?? req.user.id,
    status: 'aguardando',
    pending_type: type,
    pending_item: item,
    pending_due: due,
    pending_since: updating ? t.pending_since : nowIso(),
  });
  const what = updating
    ? `${req.user.name} atualizou a pendência: ${item}. Novo prazo: ${fmtDay(due)}.`
    : `${req.user.name} solicitou ${PENDING_LABEL[type]} ${item}.\nPrazo de chegada: ${fmtDay(due)}.`;
  const body = `${what}${note ? `\n${note}` : ''}`;
  publish(res, t.id, 'waiting', req.user.id, [addMessage(t.id, { body, system: true })]);
});

ticketsRouter.post('/:id/resume', requireRole('tecnico', 'admin'), loadTicket, requireHandler, (req, res) => {
  const t = req.ticket;
  if (t.status !== 'aguardando') return bad(res, 'Este chamado não está aguardando nada.');
  const note = String(req.body?.note || '').trim();
  updateTicket(t.id, { status: 'em_atendimento', ...NO_PENDING });
  const arrived = t.pending_type === 'compra' ? `Chegou: ${t.pending_item}.` : `Serviço terceirizado concluído: ${t.pending_item}.`;
  const body = `${arrived} ${req.user.name} retomou o atendimento.${note ? `\n${note}` : ''}`;
  publish(res, t.id, 'resumed', req.user.id, [addMessage(t.id, { body, system: true })]);
});

// ---------- Marcar como resolvido ----------
ticketsRouter.post('/:id/resolve', requireRole('tecnico', 'admin'), loadTicket, requireActive, requireHandler, (req, res) => {
  const t = req.ticket;
  const type = req.body?.resolution_type;
  const note = String(req.body?.note || '').trim();
  if (!['online', 'presencial'].includes(type)) return bad(res, 'Informe se foi resolvido online ou presencialmente.');
  if (note.length < 3) return bad(res, 'Descreva rapidamente a solução aplicada.');

  updateTicket(t.id, {
    technician_id: t.technician_id ?? req.user.id,
    status: 'resolvido',
    resolution_type: type,
    resolution_note: note,
    resolved_at: nowIso(),
  });
  const how = type === 'online' ? 'remotamente (online)' : 'presencialmente';
  const body = `${req.user.name} marcou o chamado como resolvido ${how}.\nSolução: ${note}`;
  publish(res, t.id, 'resolved', req.user.id, [addMessage(t.id, { body, system: true })]);
});

// ---------- Reabrir (não resolveu) ----------
ticketsRouter.post('/:id/reopen', loadTicket, (req, res) => {
  const t = req.ticket;
  if (t.status !== 'resolvido') return bad(res, 'Só é possível reabrir chamados resolvidos e ainda não avaliados.');
  const reason = String(req.body?.reason || '').trim();
  if (!isStaff(req.user) && reason.length < 3) return bad(res, 'Conte o que ainda não está funcionando.');

  updateTicket(t.id, {
    status: t.technician_id ? 'em_atendimento' : 'aberto',
    resolution_type: null,
    resolution_note: null,
    resolved_at: null,
    visit_at: null,
    ...NO_PENDING,
  });
  const body = `${req.user.name} reabriu o chamado.${reason ? `\nMotivo: ${reason}` : ''}`;
  publish(res, t.id, 'reopened', req.user.id, [addMessage(t.id, { body, system: true })]);
});

// ---------- Avaliar e fechar ----------
ticketsRouter.post('/:id/rate', loadTicket, (req, res) => {
  const t = req.ticket;
  if (t.requester_id !== req.user.id) return bad(res, 'Só quem abriu o chamado pode avaliar.', 403);
  if (t.status !== 'resolvido') return bad(res, 'O chamado precisa estar resolvido para ser avaliado.');
  const rating = Number(req.body?.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return bad(res, 'Escolha uma nota de 1 a 5.');
  const comment = String(req.body?.comment || '').trim();

  updateTicket(t.id, { status: 'fechado', rating, rating_comment: comment || null, closed_at: nowIso() });
  const body = `${req.user.name} avaliou o atendimento com ${rating} ${rating === 1 ? 'estrela' : 'estrelas'} e encerrou o chamado.`;
  publish(res, t.id, 'rated', req.user.id, [addMessage(t.id, { body, system: true })]);
});

// ---------- Cancelar ----------
ticketsRouter.post('/:id/cancel', loadTicket, requireActive, (req, res) => {
  const t = req.ticket;
  if (!isStaff(req.user) && t.requester_id !== req.user.id) return bad(res, 'Sem permissão.', 403);
  const reason = String(req.body?.reason || '').trim();
  updateTicket(t.id, { status: 'cancelado', closed_at: nowIso() });
  const body = `${req.user.name} cancelou o chamado.${reason ? `\nMotivo: ${reason}` : ''}`;
  publish(res, t.id, 'cancelled', req.user.id, [addMessage(t.id, { body, system: true })]);
});

// ---------- Chat ----------
ticketsRouter.post('/:id/messages', upload.single('file'), loadTicket, (req, res) => {
  const t = req.ticket;
  const body = String(req.body?.body || '').trim();
  if (['fechado', 'cancelado'].includes(t.status)) {
    discardUpload(req);
    return bad(res, 'Este chamado foi encerrado. Se o problema voltou, abra um novo chamado.');
  }
  if (!body && !req.file) return bad(res, 'Escreva uma mensagem ou anexe um arquivo.');
  if (body.length > 5000) return (discardUpload(req), bad(res, 'Mensagem muito longa.'));

  const msg = addMessage(t.id, { userId: req.user.id, body, file: fileInfo(req.file) });
  updateTicket(t.id);
  publish(res, t.id, 'message', req.user.id, [msg]);
});
