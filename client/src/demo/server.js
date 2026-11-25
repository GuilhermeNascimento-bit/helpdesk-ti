/**
 * "Servidor" da demonstração: mesmas rotas, regras e mensagens do backend Node (server/src/routes),
 * rodando no navegador sobre o localStorage. Usado só no build do GitHub Pages (VITE_DEMO=1).
 */
import { load, save, nextId } from './store.js';
import { broadcast } from './realtime.js';
import { shrinkImage, fileToDataUrl } from './image.js';

const ROLES = ['colaborador', 'tecnico', 'admin'];
const UNCLASSIFIED = 'A classificar';
const CATEGORIES = [UNCLASSIFIED, 'Hardware', 'Software', 'Rede / Internet', 'Acesso / Senha', 'Impressora', 'E-mail', 'Telefonia', 'Outros'];
const PRIORITIES = ['baixa', 'media', 'alta', 'urgente'];
const ACTIVE = ['aberto', 'em_atendimento', 'aguardando', 'visita_agendada'];
const DONE = ['resolvido', 'fechado'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NO_PENDING = { pending_type: null, pending_item: null, pending_due: null, pending_since: null };
const PENDING_LABEL = { compra: 'a compra de', terceirizado: 'um serviço terceirizado:' };

const nowIso = () => new Date().toISOString();
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const todayYmd = () => ymd(new Date());
const fmtDateTime = (d) => new Date(d).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
const fmtDay = (v) => new Date(`${v}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });
const isStaff = (u) => u.role === 'tecnico' || u.role === 'admin';

class HttpError extends Error {
  constructor(status, message, extra) {
    super(message);
    this.status = status;
    Object.assign(this, extra);
  }
}
const fail = (status, message, extra) => {
  throw new HttpError(status, message, extra);
};

// ---------------------------------------------------------------- vistas (como o SELECT do servidor)

const publicUser = ({ password, ...u }) => u;

function ticketView(s, t) {
  const r = s.users.find((u) => u.id === t.requester_id);
  const te = s.users.find((u) => u.id === t.technician_id);
  return {
    ...t,
    requester_name: r?.name, requester_email: r?.email, requester_department: r?.department, requester_avatar: r?.avatar_url ?? null,
    technician_name: te?.name ?? null, technician_avatar: te?.avatar_url ?? null,
    message_count: s.messages.filter((m) => m.ticket_id === t.id && !m.is_system).length,
  };
}
function messageView(s, m) {
  const u = s.users.find((x) => x.id === m.user_id);
  return { ...m, user_name: u?.name ?? null, user_role: u?.role ?? null, user_avatar: u?.avatar_url ?? null };
}

function addMessage(s, ticketId, { userId = null, body = '', file = null, system = false }) {
  const m = {
    id: nextId(s, 'message'), ticket_id: ticketId, user_id: userId, body,
    attachment_url: file?.url ?? null, attachment_name: file?.name ?? null, attachment_type: file?.type ?? null,
    is_system: system ? 1 : 0, created_at: nowIso(),
  };
  s.messages.push(m);
  return m;
}

function updateTicket(t, fields = {}) {
  Object.assign(t, fields, { updated_at: nowIso() });
}

/** Salva e avisa em tempo real, como o publish() do servidor. */
function publish(s, t, event, actorId, messages = []) {
  save(s);
  const ticket = ticketView(s, t);
  const views = messages.map((m) => messageView(s, m));
  for (const message of views) broadcast('message:new', { message, ticket });
  broadcast('ticket:updated', { ticket, event, actorId });
  return { ticket, messages: views };
}

// ---------------------------------------------------------------- roteamento

export async function demoRequest(path, { method = 'GET', body, form, token }) {
  await new Promise((r) => setTimeout(r, 120 + Math.random() * 120)); // um pouco de "rede"
  const [rawPath, query = ''] = path.split('?');
  const q = Object.fromEntries(new URLSearchParams(query));
  const parts = rawPath.split('/').filter(Boolean);
  const s = load();
  const me = s.users.find((u) => u.id === Number(String(token || '').replace('demo:', '')) && u.active && u.approved) || null;
  const input = form ? await formToObject(form) : body || {};

  const auth = () => me || fail(401, 'Sessão expirada. Faça login novamente.');
  const role = (...roles) => (roles.includes(auth().role) ? me : fail(403, 'Você não tem permissão para isso.'));

  const [a, b, c] = parts;
  const id = Number(b);

  if (a === 'health') return { ok: true, demo: true, browser: true };

  // ---------- autenticação e conta ----------
  if (a === 'auth') {
    if (b === 'login' && method === 'POST') return login(s, input);
    if (b === 'register' && method === 'POST') return register(s, input);
    if (b === 'me' && !c && method === 'GET') return publicUser(auth());
    if (b === 'me' && !c && method === 'PATCH') return updateMe(s, auth(), input);
    if (b === 'me' && c === 'avatar' && method === 'POST') return setAvatar(s, auth(), input);
    if (b === 'me' && c === 'avatar' && method === 'DELETE') {
      auth().avatar_url = null;
      save(s);
      return publicUser(me);
    }
    if (b === 'password' && method === 'POST') return changePassword(s, auth(), input);
  }

  // ---------- chamados ----------
  if (a === 'tickets') {
    auth();
    if (!b && method === 'GET') return listTickets(s, me, q);
    if (!b && method === 'POST') return createTicket(s, me, input);
    const t = s.tickets.find((x) => x.id === id);
    if (!t || !(isStaff(me) || t.requester_id === me.id)) fail(404, 'Chamado não encontrado.');
    if (!c && method === 'GET') {
      return { ticket: ticketView(s, t), messages: s.messages.filter((m) => m.ticket_id === t.id).sort((x, y) => x.id - y.id).map((m) => messageView(s, m)) };
    }
    if (!c && method === 'PATCH') return patchTicket(s, role('tecnico', 'admin'), t, input);
    const action = ACTIONS[c];
    if (action && method === 'POST') return action(s, me, t, input);
  }

  // ---------- usuários ----------
  if (a === 'users') {
    if (b === 'technicians') {
      role('tecnico', 'admin');
      return s.users.filter((u) => u.active && isStaff(u)).sort((x, y) => x.name.localeCompare(y.name)).map(({ id, name, role, avatar_url }) => ({ id, name, role, avatar_url }));
    }
    role('admin');
    if (!b && method === 'GET') return listUsers(s);
    if (!b && method === 'POST') return createUser(s, input);
    const u = s.users.find((x) => x.id === id) || fail(404, 'Usuário não encontrado.');
    if (c === 'approve' && method === 'POST') return approveUser(s, u, input);
    if (!c && method === 'DELETE') return rejectUser(s, u);
    if (!c && method === 'PATCH') return patchUser(s, me, u, input);
  }

  // ---------- painéis ----------
  if (a === 'stats') {
    if (b === 'me') return statsMe(s, role('tecnico', 'admin'));
    role('admin');
    return statsAll(s);
  }

  fail(404, 'Rota não encontrada.');
}

async function formToObject(form) {
  const o = {};
  for (const [k, v] of form.entries()) o[k] = v;
  return o;
}

// ---------------------------------------------------------------- conta

function login(s, { email = '', password = '' }) {
  const u = s.users.find((x) => x.email.toLowerCase() === String(email).trim().toLowerCase());
  if (!u || u.password !== password) fail(401, 'E-mail ou senha incorretos.');
  if (!u.approved) fail(403, 'Seu cadastro ainda está aguardando a aprovação do administrador.', { pending: true });
  if (!u.active) fail(403, 'Usuário desativado. Fale com o administrador.');
  return { token: `demo:${u.id}`, user: publicUser(u) };
}

function register(s, b) {
  const name = String(b.name || '').trim();
  const email = String(b.email || '').trim().toLowerCase();
  const password = String(b.password || '');
  const department = String(b.department || '').trim();
  const location = String(b.location || '').trim();
  if (name.length < 3 || !name.includes(' ')) fail(400, 'Informe seu nome e sobrenome.');
  if (department.length < 2) fail(400, 'Informe o seu setor.');
  if (location.length < 2) fail(400, 'Informe onde você trabalha (andar, sala ou mesa).');
  if (!EMAIL_RE.test(email)) fail(400, 'E-mail inválido.');
  if (password.length < 6) fail(400, 'A senha precisa ter pelo menos 6 caracteres.');
  const existing = s.users.find((u) => u.email === email);
  if (existing) fail(400, existing.approved ? 'Já existe uma conta com esse e-mail. Tente entrar.' : 'Esse e-mail já tem um cadastro aguardando aprovação.');
  const u = { id: nextId(s, 'user'), name, email, password, role: 'colaborador', department, location, active: 1, approved: 0, avatar_url: null, created_at: nowIso() };
  s.users.push(u);
  save(s);
  broadcast('user:pending', { user: publicUser(u), event: 'created' });
  return { ok: true };
}

function updateMe(s, me, b) {
  const name = String(b.name ?? me.name).trim();
  const department = String(b.department ?? me.department ?? '').trim();
  const location = String(b.location ?? me.location ?? '').trim();
  if (name.length < 3 || !name.includes(' ')) fail(400, 'Informe seu nome e sobrenome.');
  Object.assign(me, { name, department: department || null, location: location || null });
  save(s);
  return publicUser(me);
}

async function setAvatar(s, me, { file }) {
  if (!file) fail(400, 'Escolha uma imagem.');
  if (!file.type?.startsWith('image/')) fail(400, 'A foto precisa ser uma imagem (PNG, JPG, GIF ou WEBP).');
  me.avatar_url = await shrinkImage(file, 256);
  save(s);
  return publicUser(me);
}

function changePassword(s, me, { current, next }) {
  if (me.password !== String(current || '')) fail(400, 'Senha atual incorreta.');
  if (String(next || '').length < 6) fail(400, 'A nova senha precisa ter pelo menos 6 caracteres.');
  me.password = String(next);
  save(s);
  return { ok: true };
}

// ---------------------------------------------------------------- chamados

function listTickets(s, me, { scope, status, q }) {
  let list = s.tickets;
  if (!isStaff(me) || scope === 'requested') list = list.filter((t) => t.requester_id === me.id);
  else if (scope === 'mine') list = list.filter((t) => t.technician_id === me.id);
  else if (scope === 'queue') list = list.filter((t) => !t.technician_id && t.status === 'aberto');
  else if (scope === 'waiting') list = list.filter((t) => t.status === 'aguardando');

  if (status === 'ativos') list = list.filter((t) => ACTIVE.includes(t.status));
  else if (status === 'encerrados') list = list.filter((t) => ['fechado', 'cancelado'].includes(t.status));
  else if (status) list = list.filter((t) => t.status === status);

  let views = list.map((t) => ticketView(s, t));
  if (q) {
    const term = String(q).trim().toLowerCase();
    const num = term.replace(/^#/, '');
    views = views.filter((t) => t.title.toLowerCase().includes(term) || t.description.toLowerCase().includes(term) || t.requester_name?.toLowerCase().includes(term) || String(t.id) === num);
  }
  const prio = { urgente: 0, alta: 1, media: 2, baixa: 3 };
  return views.sort(
    (x, y) =>
      (ACTIVE.includes(x.status) ? 0 : 1) - (ACTIVE.includes(y.status) ? 0 : 1) ||
      (scope === 'waiting' ? String(x.pending_due).localeCompare(String(y.pending_due)) : 0) ||
      prio[x.priority] - prio[y.priority] ||
      y.updated_at.localeCompare(x.updated_at)
  );
}

function deriveTitle(text) {
  const line = text.split('\n').find((l) => l.trim()) || 'Chamado';
  const clean = line.trim().replace(/\s+/g, ' ');
  return clean.length > 70 ? clean.slice(0, 67).replace(/\s+\S*$/, '') + '…' : clean;
}

async function attachment(file) {
  if (!file || typeof file === 'string') return null;
  const ok = /^(image\/(png|jpe?g|gif|webp)|application\/pdf|text\/plain)$/.test(file.type);
  if (!ok) fail(400, 'Tipo de arquivo não permitido. Envie imagem (PNG, JPG, GIF, WEBP), PDF ou TXT.');
  if (file.type.startsWith('image/')) return { url: await shrinkImage(file, 1200), name: file.name, type: 'image/jpeg' };
  if (file.size > 1.5 * 1024 * 1024) fail(400, 'Na demonstração, PDFs e textos podem ter até 1,5 MB.');
  return { url: await fileToDataUrl(file), name: file.name, type: file.type };
}

async function createTicket(s, me, b) {
  const description = String(b.description || '').trim();
  const title = String(b.title || '').trim() || deriveTitle(description);
  const category = b.category || UNCLASSIFIED;
  const location = String(b.location || me.location || '').trim();
  if (description.length < 5) fail(400, 'Conte um pouco mais sobre o problema (pelo menos uma frase curta).');
  if (!CATEGORIES.includes(category)) fail(400, 'Escolha uma categoria válida.');
  if (!PRIORITIES.includes(b.priority)) fail(400, 'Escolha uma prioridade válida.');
  const file = await attachment(b.file);

  const now = nowIso();
  const t = {
    id: nextId(s, 'ticket'), title, description, category, priority: b.priority, status: 'aberto', location: location || null,
    requester_id: me.id, technician_id: null, resolution_type: null, resolution_note: null, visit_at: null, ...NO_PENDING,
    rating: null, rating_comment: null, created_at: now, updated_at: now, resolved_at: null, closed_at: null,
  };
  s.tickets.push(t);
  addMessage(s, t.id, { body: `Chamado aberto por ${me.name}.`, system: true });
  if (file) addMessage(s, t.id, { userId: me.id, file });
  save(s);
  const view = ticketView(s, t);
  broadcast('ticket:updated', { ticket: view, event: 'created', actorId: me.id });
  if (me.role === 'colaborador') botTakesTicket(t.id);
  return view;
}

function patchTicket(s, me, t, b) {
  if (!ACTIVE.includes(t.status)) fail(400, 'Este chamado não está mais em andamento.');
  const changes = {};
  const notes = [];
  if (b.priority && b.priority !== t.priority) {
    if (!PRIORITIES.includes(b.priority)) fail(400, 'Prioridade inválida.');
    changes.priority = b.priority;
    notes.push(`prioridade → ${b.priority}`);
  }
  if (b.category && b.category !== t.category) {
    if (!CATEGORIES.includes(b.category)) fail(400, 'Categoria inválida.');
    changes.category = b.category;
    notes.push(`categoria → ${b.category}`);
  }
  if (!notes.length) return { ticket: ticketView(s, t), messages: [] };
  updateTicket(t, changes);
  const msg = addMessage(s, t.id, { body: `${me.name} alterou ${notes.join(', ')}.`, system: true });
  return publish(s, t, 'updated', me.id, [msg]);
}

const needStaff = (me) => (isStaff(me) ? me : fail(403, 'Você não tem permissão para isso.'));
const needActive = (t) => ACTIVE.includes(t.status) || fail(400, 'Este chamado não está mais em andamento.');
function needHandler(s, me, t) {
  if (t.technician_id && t.technician_id !== me.id && me.role !== 'admin') {
    fail(403, `Este chamado está com ${s.users.find((u) => u.id === t.technician_id)?.name}.`);
  }
}

const ACTIONS = {
  assign(s, me, t, b) {
    needStaff(me);
    needActive(t);
    const techId = b?.technician_id ? Number(b.technician_id) : me.id;
    if (techId !== me.id && me.role !== 'admin') fail(403, 'Só o administrador pode atribuir a outra pessoa.');
    const tech = s.users.find((u) => u.id === techId && u.active && isStaff(u)) || fail(400, 'Técnico não encontrado.');
    if (t.technician_id === tech.id) fail(400, `O chamado já está com ${tech.name}.`);
    updateTicket(t, { technician_id: tech.id, status: t.status === 'aberto' ? 'em_atendimento' : t.status });
    const body = tech.id === me.id ? `${tech.name} assumiu o chamado.` : `${me.name} atribuiu o chamado a ${tech.name}.`;
    return publish(s, t, 'assigned', me.id, [addMessage(s, t.id, { body, system: true })]);
  },

  visit(s, me, t, b) {
    needStaff(me);
    needActive(t);
    needHandler(s, me, t);
    const when = new Date(b?.visit_at);
    if (!b?.visit_at || Number.isNaN(when.getTime())) fail(400, 'Informe a data e hora da visita.');
    const note = String(b?.note || '').trim();
    updateTicket(t, { technician_id: t.technician_id ?? me.id, status: 'visita_agendada', visit_at: when.toISOString(), resolution_type: 'presencial' });
    const where = t.location ? ` (${t.location})` : '';
    const what = when.getTime() - Date.now() < 10 * 60e3 ? `${me.name} está a caminho${where}.` : `${me.name} agendou uma visita presencial para ${fmtDateTime(when)}${where}.`;
    return publish(s, t, 'visit', me.id, [addMessage(s, t.id, { body: `${what}${note ? `\n${note}` : ''}`, system: true })]);
  },

  wait(s, me, t, b) {
    needStaff(me);
    needActive(t);
    needHandler(s, me, t);
    const type = b?.type;
    const item = String(b?.item || '').trim();
    const due = String(b?.due || '');
    const note = String(b?.note || '').trim();
    if (!['compra', 'terceirizado'].includes(type)) fail(400, 'Informe se é uma compra ou um serviço terceirizado.');
    if (item.length < 2) fail(400, type === 'compra' ? 'Informe o que vai ser comprado.' : 'Informe qual serviço foi acionado.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(due)) fail(400, 'Informe o prazo de chegada.');
    if (due < todayYmd()) fail(400, 'O prazo não pode estar no passado.');
    const updating = t.status === 'aguardando';
    updateTicket(t, {
      technician_id: t.technician_id ?? me.id, status: 'aguardando', pending_type: type, pending_item: item, pending_due: due,
      pending_since: updating ? t.pending_since : nowIso(),
    });
    const what = updating
      ? `${me.name} atualizou a pendência: ${item}. Novo prazo: ${fmtDay(due)}.`
      : `${me.name} solicitou ${PENDING_LABEL[type]} ${item}.\nPrazo de chegada: ${fmtDay(due)}.`;
    return publish(s, t, 'waiting', me.id, [addMessage(s, t.id, { body: `${what}${note ? `\n${note}` : ''}`, system: true })]);
  },

  resume(s, me, t, b) {
    needStaff(me);
    needHandler(s, me, t);
    if (t.status !== 'aguardando') fail(400, 'Este chamado não está aguardando nada.');
    const note = String(b?.note || '').trim();
    const arrived = t.pending_type === 'compra' ? `Chegou: ${t.pending_item}.` : `Serviço terceirizado concluído: ${t.pending_item}.`;
    updateTicket(t, { status: 'em_atendimento', ...NO_PENDING });
    return publish(s, t, 'resumed', me.id, [addMessage(s, t.id, { body: `${arrived} ${me.name} retomou o atendimento.${note ? `\n${note}` : ''}`, system: true })]);
  },

  resolve(s, me, t, b) {
    needStaff(me);
    needActive(t);
    needHandler(s, me, t);
    const type = b?.resolution_type;
    const note = String(b?.note || '').trim();
    if (!['online', 'presencial'].includes(type)) fail(400, 'Informe se foi resolvido online ou presencialmente.');
    if (note.length < 3) fail(400, 'Descreva rapidamente a solução aplicada.');
    updateTicket(t, { technician_id: t.technician_id ?? me.id, status: 'resolvido', resolution_type: type, resolution_note: note, resolved_at: nowIso() });
    const how = type === 'online' ? 'remotamente (online)' : 'presencialmente';
    return publish(s, t, 'resolved', me.id, [addMessage(s, t.id, { body: `${me.name} marcou o chamado como resolvido ${how}.\nSolução: ${note}`, system: true })]);
  },

  reopen(s, me, t, b) {
    if (t.status !== 'resolvido') fail(400, 'Só é possível reabrir chamados resolvidos e ainda não avaliados.');
    const reason = String(b?.reason || '').trim();
    if (!isStaff(me) && reason.length < 3) fail(400, 'Conte o que ainda não está funcionando.');
    updateTicket(t, { status: t.technician_id ? 'em_atendimento' : 'aberto', resolution_type: null, resolution_note: null, resolved_at: null, visit_at: null, ...NO_PENDING });
    return publish(s, t, 'reopened', me.id, [addMessage(s, t.id, { body: `${me.name} reabriu o chamado.${reason ? `\nMotivo: ${reason}` : ''}`, system: true })]);
  },

  rate(s, me, t, b) {
    if (t.requester_id !== me.id) fail(403, 'Só quem abriu o chamado pode avaliar.');
    if (t.status !== 'resolvido') fail(400, 'O chamado precisa estar resolvido para ser avaliado.');
    const rating = Number(b?.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) fail(400, 'Escolha uma nota de 1 a 5.');
    const comment = String(b?.comment || '').trim();
    updateTicket(t, { status: 'fechado', rating, rating_comment: comment || null, closed_at: nowIso() });
    const body = `${me.name} avaliou o atendimento com ${rating} ${rating === 1 ? 'estrela' : 'estrelas'} e encerrou o chamado.`;
    return publish(s, t, 'rated', me.id, [addMessage(s, t.id, { body, system: true })]);
  },

  cancel(s, me, t, b) {
    needActive(t);
    if (!isStaff(me) && t.requester_id !== me.id) fail(403, 'Sem permissão.');
    const reason = String(b?.reason || '').trim();
    updateTicket(t, { status: 'cancelado', closed_at: nowIso() });
    return publish(s, t, 'cancelled', me.id, [addMessage(s, t.id, { body: `${me.name} cancelou o chamado.${reason ? `\nMotivo: ${reason}` : ''}`, system: true })]);
  },

  async messages(s, me, t, b) {
    const body = String(b?.body || '').trim();
    if (['fechado', 'cancelado'].includes(t.status)) fail(400, 'Este chamado foi encerrado. Se o problema voltar, abra um novo chamado.');
    const file = await attachment(b?.file);
    if (!body && !file) fail(400, 'Escreva uma mensagem ou anexe um arquivo.');
    if (body.length > 5000) fail(400, 'Mensagem muito longa.');
    const msg = addMessage(s, t.id, { userId: me.id, body, file });
    updateTicket(t);
    const res = publish(s, t, 'message', me.id, [msg]);
    if (me.id === t.requester_id) botReplies(t.id);
    return res;
  },
};

// ---------------------------------------------------------------- usuários (admin)

function listUsers(s) {
  return s.users
    .map((u) => ({
      ...publicUser(u),
      tickets_opened: s.tickets.filter((t) => t.requester_id === u.id).length,
      tickets_handled: s.tickets.filter((t) => t.technician_id === u.id).length,
    }))
    .sort((x, y) => x.approved - y.approved || y.active - x.active || x.name.localeCompare(y.name));
}

function createUser(s, b) {
  const name = String(b.name || '').trim();
  const email = String(b.email || '').trim().toLowerCase();
  const password = String(b.password || '');
  if (name.length < 2) fail(400, 'Informe o nome.');
  if (!EMAIL_RE.test(email)) fail(400, 'E-mail inválido.');
  if (password.length < 6) fail(400, 'A senha precisa ter pelo menos 6 caracteres.');
  if (!ROLES.includes(b.role)) fail(400, 'Perfil inválido.');
  if (s.users.some((u) => u.email === email)) fail(400, 'Já existe um usuário com esse e-mail.');
  const u = {
    id: nextId(s, 'user'), name, email, password, role: b.role, department: String(b.department || '').trim() || null,
    location: String(b.location || '').trim() || null, active: 1, approved: 1, avatar_url: null, created_at: nowIso(),
  };
  s.users.push(u);
  save(s);
  return publicUser(u);
}

function patchUser(s, me, u, b) {
  if (b.name !== undefined) {
    if (String(b.name).trim().length < 2) fail(400, 'Informe o nome.');
    u.name = String(b.name).trim();
  }
  if (b.email !== undefined) {
    const email = String(b.email).trim().toLowerCase();
    if (!EMAIL_RE.test(email)) fail(400, 'E-mail inválido.');
    if (s.users.some((x) => x.email === email && x.id !== u.id)) fail(400, 'E-mail já em uso.');
    u.email = email;
  }
  if (b.role !== undefined) {
    if (!ROLES.includes(b.role)) fail(400, 'Perfil inválido.');
    if (u.id === me.id && b.role !== 'admin') fail(400, 'Você não pode remover seu próprio acesso de administrador.');
    u.role = b.role;
  }
  if (b.department !== undefined) u.department = String(b.department).trim() || null;
  if (b.location !== undefined) u.location = String(b.location).trim() || null;
  if (b.active !== undefined) {
    if (u.id === me.id && !b.active) fail(400, 'Você não pode desativar a si mesmo.');
    u.active = b.active ? 1 : 0;
  }
  if (b.password) {
    if (String(b.password).length < 6) fail(400, 'A senha precisa ter pelo menos 6 caracteres.');
    u.password = String(b.password);
  }
  save(s);
  return publicUser(u);
}

function approveUser(s, u, b) {
  if (u.approved) fail(400, 'Esse cadastro já foi aprovado.');
  const r = b?.role || 'colaborador';
  if (!ROLES.includes(r)) fail(400, 'Perfil inválido.');
  Object.assign(u, { approved: 1, active: 1, role: r });
  save(s);
  broadcast('user:pending', { user: publicUser(u), event: 'approved' });
  return publicUser(u);
}

function rejectUser(s, u) {
  if (u.approved) fail(400, 'Só é possível recusar cadastros pendentes. Para tirar o acesso, desative o usuário.');
  s.users = s.users.filter((x) => x.id !== u.id);
  save(s);
  broadcast('user:pending', { user: publicUser(u), event: 'rejected' });
  return { ok: true };
}

// ---------------------------------------------------------------- painéis

const hoursBetween = (a, b) => (new Date(b) - new Date(a)) / 36e5;
const avg = (xs) => (xs.length ? xs.reduce((p, c) => p + c, 0) / xs.length : null);
function since14() {
  const d = new Date(Date.now() - 13 * 864e5);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}
function countByDay(items, field, since) {
  const m = {};
  for (const t of items) if (t[field] && t[field] >= since) m[t[field].slice(0, 10)] = (m[t[field].slice(0, 10)] || 0) + 1;
  return Object.entries(m).map(([day, n]) => ({ day, n }));
}

function statsAll(s) {
  const T = s.tickets;
  const byStatus = {};
  for (const t of T) byStatus[t.status] = (byStatus[t.status] || 0) + 1;
  const done = T.filter((t) => DONE.includes(t.status) && t.resolution_type);
  const rated = T.filter((t) => t.rating);
  const cats = {};
  for (const t of T) cats[t.category] = (cats[t.category] || 0) + 1;
  const waiting = T.filter((t) => t.status === 'aguardando');
  const since = since14();
  return {
    byStatus,
    waiting: { n: waiting.length, overdue: waiting.filter((t) => t.pending_due < todayYmd()).length },
    queue: T.filter((t) => t.status === 'aberto' && !t.technician_id).length,
    urgentActive: T.filter((t) => t.priority === 'urgente' && ACTIVE.includes(t.status)).length,
    avgResolutionHours: avg(T.filter((t) => t.resolved_at).map((t) => hoursBetween(t.created_at, t.resolved_at))),
    rating: { avg: avg(rated.map((t) => t.rating)), n: rated.length },
    resolution: {
      online: done.filter((t) => t.resolution_type === 'online').length,
      presencial: done.filter((t) => t.resolution_type === 'presencial').length,
    },
    byCategory: Object.entries(cats).map(([category, n]) => ({ category, n })).sort((a, b) => b.n - a.n),
    technicians: s.users
      .filter((u) => isStaff(u) && u.active)
      .map((u) => {
        const mine = T.filter((t) => t.technician_id === u.id);
        const res = mine.filter((t) => DONE.includes(t.status));
        return {
          id: u.id, name: u.name, avatar_url: u.avatar_url, total: mine.length,
          active: mine.filter((t) => ACTIVE.includes(t.status)).length, resolved: res.length,
          online: res.filter((t) => t.resolution_type === 'online').length,
          rating: avg(mine.filter((t) => t.rating).map((t) => t.rating)),
        };
      })
      .sort((a, b) => b.resolved - a.resolved || a.name.localeCompare(b.name)),
    daily: countByDay(T, 'created_at', since),
    since,
  };
}

function statsMe(s, me) {
  const mine = s.tickets.filter((t) => t.technician_id === me.id);
  const res = mine.filter((t) => DONE.includes(t.status));
  const rated = mine.filter((t) => t.rating);
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  const distribution = {};
  for (const t of rated) distribution[t.rating] = (distribution[t.rating] || 0) + 1;
  const since = since14();
  return {
    totals: {
      handled: mine.length,
      active: mine.filter((t) => ACTIVE.includes(t.status)).length,
      resolved: res.length,
      online: res.filter((t) => t.resolution_type === 'online').length,
      presencial: res.filter((t) => t.resolution_type === 'presencial').length,
      rating: avg(rated.map((t) => t.rating)),
      ratings: rated.length,
      avg_hours: avg(mine.filter((t) => t.resolved_at).map((t) => hoursBetween(t.created_at, t.resolved_at))),
    },
    thisMonth: mine.filter((t) => t.resolved_at && t.resolved_at >= monthStart).length,
    distribution,
    daily: countByDay(mine, 'resolved_at', since),
    since,
    reviews: rated
      .sort((a, b) => String(b.closed_at).localeCompare(String(a.closed_at)))
      .slice(0, 8)
      .map((t) => ({ id: t.id, title: t.title, rating: t.rating, rating_comment: t.rating_comment, closed_at: t.closed_at, requester_name: s.users.find((u) => u.id === t.requester_id)?.name })),
  };
}

// ---------------------------------------------------------------- técnico robô (só na demonstração)
// Para quem testa sozinho numa aba: o Carlos assume chamados novos e responde no chat.

const botEmail = 'tecnico@empresa.com';
const repliedTo = new Set();

function botTakesTicket(ticketId) {
  setTimeout(() => {
    const s = load();
    const t = s.tickets.find((x) => x.id === ticketId);
    const bot = s.users.find((u) => u.email === botEmail);
    if (!t || !bot || t.technician_id || t.status !== 'aberto') return;
    updateTicket(t, { technician_id: bot.id, status: 'em_atendimento' });
    publish(s, t, 'assigned', bot.id, [addMessage(s, t.id, { body: `${bot.name} assumiu o chamado.`, system: true })]);
    const requester = s.users.find((u) => u.id === t.requester_id);
    botSays(ticketId, `Oi ${requester.name.split(' ')[0]}! Aqui é o Carlos, da T.I. Já estou vendo o seu chamado. Se tiver um print do erro, pode mandar por aqui.`);
  }, 4500);
}

function botReplies(ticketId) {
  if (repliedTo.has(ticketId)) return;
  const s = load();
  const t = s.tickets.find((x) => x.id === ticketId);
  const bot = s.users.find((u) => u.email === botEmail);
  if (!t || !bot || t.technician_id !== bot.id || !ACTIVE.includes(t.status)) return;
  repliedTo.add(ticketId);
  botSays(ticketId, 'Obrigado pelas informações! Vou verificar isso agora e te aviso por aqui.', 1200);
}

function botSays(ticketId, text, delay = 1500) {
  setTimeout(() => {
    const s = load();
    const bot = s.users.find((u) => u.email === botEmail);
    broadcast('typing', { ticketId, userId: bot.id, name: bot.name });
    setTimeout(() => {
      const s2 = load();
      const t = s2.tickets.find((x) => x.id === ticketId);
      if (!t || !ACTIVE.includes(t.status)) return;
      const msg = addMessage(s2, t.id, { userId: bot.id, body: text });
      updateTicket(t);
      publish(s2, t, 'message', bot.id, [msg]);
    }, 2200);
  }, delay);
}
