/**
 * Backend com Firebase (Auth + Firestore), usado no GitHub Pages.
 * Mesmas rotas, regras e mensagens do servidor Node (server/src/routes): o resto do app não muda.
 * Quem garante a segurança de verdade são as regras em firestore.rules.
 */
import { initializeApp, deleteApp } from 'firebase/app';
import {
  getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendEmailVerification, signOut,
  sendPasswordResetEmail, EmailAuthProvider, reauthenticateWithCredential, updatePassword,
} from 'firebase/auth';
import {
  doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, collection, query, where, orderBy, runTransaction, writeBatch, increment, onSnapshot,
} from 'firebase/firestore';
import { app, auth, db } from './firebase.js';
import { firebaseConfig } from './config.js';
import { shrinkImage, fileToDataUrl } from '../demo/image.js';

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
export const isStaff = (u) => u?.role === 'tecnico' || u?.role === 'admin';

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

/** Erros do Firebase em português. */
function friendly(e) {
  if (e instanceof HttpError) return e;
  const code = e?.code || '';
  const map = {
    'auth/invalid-credential': [401, 'E-mail ou senha incorretos.'],
    'auth/wrong-password': [401, 'E-mail ou senha incorretos.'],
    'auth/user-not-found': [401, 'E-mail ou senha incorretos.'],
    'auth/invalid-email': [400, 'E-mail inválido.'],
    'auth/too-many-requests': [429, 'Muitas tentativas. Espere alguns minutos e tente de novo.'],
    'auth/weak-password': [400, 'A senha precisa ter pelo menos 6 caracteres.'],
    'auth/network-request-failed': [503, 'Sem conexão com a internet.'],
    'auth/requires-recent-login': [401, 'Por segurança, entre de novo e repita a operação.'],
    'permission-denied': [403, 'Você não tem permissão para isso.'],
    unavailable: [503, 'Sem conexão com o servidor.'],
  };
  const [status, message] = map[code] || [500, 'Algo deu errado. Tente novamente.'];
  if (!map[code]) console.error(e);
  return new HttpError(status, message);
}

// ---------------------------------------------------------------- usuários em cache (nomes e fotos)

let usersMap = null;
let unsubUsers = null;
async function usersCache() {
  if (usersMap) return usersMap;
  const snap = await getDocs(collection(db, 'users'));
  usersMap = new Map(snap.docs.map((d) => [d.id, { id: d.id, ...d.data() }]));
  unsubUsers ??= onSnapshot(
    collection(db, 'users'),
    (s) => (usersMap = new Map(s.docs.map((d) => [d.id, { id: d.id, ...d.data() }]))),
    () => {}
  );
  return usersMap;
}
function resetCache() {
  unsubUsers?.();
  unsubUsers = null;
  usersMap = null;
}

export function ticketView(t, U) {
  const r = U.get(t.requester_id);
  const te = t.technician_id ? U.get(t.technician_id) : null;
  return {
    ...t,
    requester_name: r?.name ?? t.requester_name ?? 'Usuário removido', requester_email: r?.email ?? null,
    requester_department: r?.department ?? null, requester_avatar: r?.avatar_url ?? null,
    technician_name: te?.name ?? null, technician_avatar: te?.avatar_url ?? null,
    message_count: t.message_count || 0,
  };
}
export function messageView(m, U) {
  const u = m.user_id ? U.get(m.user_id) : null;
  return { ...m, user_name: u?.name ?? m.user_name ?? null, user_role: u?.role ?? null, user_avatar: u?.avatar_url ?? null };
}
const publicUser = (u) => ({ ...u });

/** Usuário logado, confirmado e aprovado. */
async function current() {
  await auth.authStateReady();
  const fu = auth.currentUser;
  if (!fu) fail(401, 'Sessão expirada. Faça login novamente.');
  const snap = await getDoc(doc(db, 'users', fu.uid));
  if (!snap.exists() || !fu.emailVerified) fail(401, 'Sessão expirada. Faça login novamente.');
  const u = { id: fu.uid, ...snap.data() };
  if (!u.approved || !u.active) fail(401, 'Sessão expirada. Faça login novamente.');
  return u;
}

// ---------------------------------------------------------------- roteamento

export async function firebaseRequest(path, { method = 'GET', body, form }) {
  try {
    return await route(path, { method, input: form ? Object.fromEntries(form.entries()) : body || {} });
  } catch (e) {
    throw friendly(e);
  }
}

export async function firebaseLogout() {
  resetCache();
  await signOut(auth).catch(() => {});
}

async function route(path, { method, input }) {
  const [rawPath, query_ = ''] = path.split('?');
  const q = Object.fromEntries(new URLSearchParams(query_));
  const [a, b, c] = rawPath.split('/').filter(Boolean);

  if (a === 'health') return { ok: true, demo: false, firebase: true };

  if (a === 'auth') {
    if (b === 'login' && method === 'POST') return login(input);
    if (b === 'register' && method === 'POST') return register(input);
    if (b === 'reset' && method === 'POST') return resetPassword(input);
    const me = await current();
    if (b === 'me' && !c && method === 'GET') return publicUser(me);
    if (b === 'me' && !c && method === 'PATCH') return updateMe(me, input);
    if (b === 'me' && c === 'avatar' && method === 'POST') return setAvatar(me, input.file);
    if (b === 'me' && c === 'avatar' && method === 'DELETE') {
      await updateDoc(doc(db, 'users', me.id), { avatar_url: null });
      return { ...me, avatar_url: null };
    }
    if (b === 'password' && method === 'POST') return changePassword(me, input);
  }

  const me = await current();
  const U = await usersCache();
  const role = (...roles) => (roles.includes(me.role) ? me : fail(403, 'Você não tem permissão para isso.'));

  if (a === 'tickets') {
    if (!b && method === 'GET') return listTickets(me, U, q);
    if (!b && method === 'POST') return createTicket(me, U, input);
    const snap = await getDoc(doc(db, 'tickets', String(b))).catch((e) => (e.code === 'permission-denied' ? null : Promise.reject(e)));
    const t = snap?.exists() ? { id: Number(snap.id), ...snap.data() } : null;
    if (!t || !(isStaff(me) || t.requester_id === me.id)) fail(404, 'Chamado não encontrado.');
    if (!c && method === 'GET') {
      const ms = await getDocs(query(collection(db, 'tickets', String(t.id), 'messages'), orderBy('created_at')));
      return { ticket: ticketView(t, U), messages: ms.docs.map((d) => messageView({ id: d.id, ...d.data() }, U)) };
    }
    if (!c && method === 'PATCH') return patchTicket(role('tecnico', 'admin'), U, t, input);
    const action = ACTIONS[c];
    if (action && method === 'POST') return action(me, U, t, input);
  }

  if (a === 'users') {
    if (b === 'technicians') {
      role('tecnico', 'admin');
      return [...U.values()].filter((u) => u.active && u.approved && isStaff(u)).sort((x, y) => x.name.localeCompare(y.name)).map(({ id, name, role: r, avatar_url }) => ({ id, name, role: r, avatar_url }));
    }
    role('admin');
    if (!b && method === 'GET') return listUsers(U);
    if (!b && method === 'POST') return createUser(input);
    const u = U.get(String(b)) || fail(404, 'Usuário não encontrado.');
    if (c === 'approve' && method === 'POST') return approveUser(u, input);
    if (!c && method === 'DELETE') return rejectUser(u);
    if (!c && method === 'PATCH') return patchUser(me, u, input);
  }

  if (a === 'stats') {
    if (b === 'me') {
      role('tecnico', 'admin');
      const snap = await getDocs(query(collection(db, 'tickets'), where('technician_id', '==', me.id)));
      return statsMe(snap.docs.map((d) => ({ id: Number(d.id), ...d.data() })));
    }
    role('admin');
    const snap = await getDocs(collection(db, 'tickets'));
    return statsAll(snap.docs.map((d) => ({ id: Number(d.id), ...d.data() })), U);
  }

  fail(404, 'Rota não encontrada.');
}

// ---------------------------------------------------------------- conta

async function login({ email = '', password = '' }) {
  const cred = await signInWithEmailAndPassword(auth, String(email).trim(), password);
  const fu = cred.user;
  const snap = await getDoc(doc(db, 'users', fu.uid));
  if (!fu.emailVerified) {
    await sendEmailVerification(fu).catch(() => {});
    await signOut(auth);
    fail(403, `Confirme o seu e-mail para entrar: enviamos um link para ${fu.email} (veja também a caixa de spam).`);
  }
  if (!snap.exists()) {
    await signOut(auth);
    fail(403, 'Cadastro não encontrado. Crie a sua conta de novo.');
  }
  const u = { id: fu.uid, ...snap.data() };
  if (!u.approved) {
    await signOut(auth);
    fail(403, 'Seu cadastro ainda está aguardando a aprovação do administrador.', { pending: true });
  }
  if (!u.active) {
    await signOut(auth);
    fail(403, 'Usuário desativado. Fale com o administrador.');
  }
  return { token: 'fb', user: u };
}

async function register(b) {
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

  let fu;
  try {
    fu = (await createUserWithEmailAndPassword(auth, email, password)).user;
  } catch (e) {
    if (e.code !== 'auth/email-already-in-use') throw e;
    // A conta de login existe: pode ser um cadastro recusado antes. Se a senha bate e não há ficha, refaz a ficha.
    try {
      fu = (await signInWithEmailAndPassword(auth, email, password)).user;
    } catch {
      fail(400, 'Já existe uma conta com esse e-mail. Tente entrar ou use "Esqueci minha senha".');
    }
    const existing = await getDoc(doc(db, 'users', fu.uid));
    if (existing.exists()) {
      await signOut(auth);
      fail(400, existing.data().approved ? 'Já existe uma conta com esse e-mail. Tente entrar.' : 'Esse e-mail já tem um cadastro aguardando aprovação.');
    }
  }

  // O primeiro cadastro do projeto vira administrador (ninguém mais consegue depois: ver firestore.rules)
  const boot = await getDoc(doc(db, 'meta', 'bootstrap'));
  const first = !boot.exists();
  const profile = {
    name, email, department, location, role: first ? 'admin' : 'colaborador', approved: first, active: true, avatar_url: null, created_at: nowIso(),
  };
  const batch = writeBatch(db);
  batch.set(doc(db, 'users', fu.uid), profile);
  if (first) batch.set(doc(db, 'meta', 'bootstrap'), { uid: fu.uid, at: profile.created_at });
  await batch.commit();
  if (!fu.emailVerified) await sendEmailVerification(fu).catch(() => {});
  await signOut(auth);
  return { ok: true, firstAdmin: first, verify: true };
}

async function resetPassword({ email = '' }) {
  const e = String(email).trim().toLowerCase();
  if (!EMAIL_RE.test(e)) fail(400, 'Digite o seu e-mail no campo acima e clique de novo.');
  await sendPasswordResetEmail(auth, e).catch((err) => {
    if (err.code !== 'auth/user-not-found') throw err; // não revela se o e-mail existe
  });
  return { ok: true };
}

async function updateMe(me, b) {
  const name = String(b.name ?? me.name).trim();
  const department = String(b.department ?? me.department ?? '').trim();
  const location = String(b.location ?? me.location ?? '').trim();
  if (name.length < 3 || !name.includes(' ')) fail(400, 'Informe seu nome e sobrenome.');
  if (name.length > 80 || department.length > 60 || location.length > 80) fail(400, 'Texto muito longo.');
  const fields = { name, department: department || null, location: location || null };
  await updateDoc(doc(db, 'users', me.id), fields);
  return { ...me, ...fields };
}

async function setAvatar(me, file) {
  if (!file || typeof file === 'string') fail(400, 'Escolha uma imagem.');
  if (!file.type?.startsWith('image/')) fail(400, 'A foto precisa ser uma imagem (PNG, JPG, GIF ou WEBP).');
  const avatar_url = await shrinkImage(file, 256);
  await updateDoc(doc(db, 'users', me.id), { avatar_url });
  return { ...me, avatar_url };
}

async function changePassword(me, { current: cur, next }) {
  if (String(next || '').length < 6) fail(400, 'A nova senha precisa ter pelo menos 6 caracteres.');
  try {
    await reauthenticateWithCredential(auth.currentUser, EmailAuthProvider.credential(me.email, String(cur || '')));
  } catch {
    fail(400, 'Senha atual incorreta.');
  }
  await updatePassword(auth.currentUser, String(next));
  return { ok: true };
}

// ---------------------------------------------------------------- chamados

async function listTickets(me, U, { scope, status, q }) {
  const snap = isStaff(me) && scope !== 'requested'
    ? await getDocs(collection(db, 'tickets'))
    : await getDocs(query(collection(db, 'tickets'), where('requester_id', '==', me.id)));
  let list = snap.docs.map((d) => ({ id: Number(d.id), ...d.data() }));
  if (scope === 'mine') list = list.filter((t) => t.technician_id === me.id);
  else if (scope === 'queue') list = list.filter((t) => !t.technician_id && t.status === 'aberto');
  else if (scope === 'waiting') list = list.filter((t) => t.status === 'aguardando');

  if (status === 'ativos') list = list.filter((t) => ACTIVE.includes(t.status));
  else if (status === 'encerrados') list = list.filter((t) => ['fechado', 'cancelado'].includes(t.status));
  else if (status) list = list.filter((t) => t.status === status);

  let views = list.map((t) => ticketView(t, U));
  if (q) {
    const term = String(q).trim().toLowerCase();
    const num = term.replace(/^#/, '');
    views = views.filter((t) => t.title.toLowerCase().includes(term) || t.description.toLowerCase().includes(term) || t.requester_name?.toLowerCase().includes(term) || String(t.id) === num);
  }
  const prio = { urgente: 0, alta: 1, media: 2, baixa: 3 };
  return views
    .sort(
      (x, y) =>
        (ACTIVE.includes(x.status) ? 0 : 1) - (ACTIVE.includes(y.status) ? 0 : 1) ||
        (scope === 'waiting' ? String(x.pending_due).localeCompare(String(y.pending_due)) : 0) ||
        prio[x.priority] - prio[y.priority] ||
        y.updated_at.localeCompare(x.updated_at)
    )
    .slice(0, 500);
}

function deriveTitle(text) {
  const line = text.split('\n').find((l) => l.trim()) || 'Chamado';
  const clean = line.trim().replace(/\s+/g, ' ');
  return clean.length > 70 ? clean.slice(0, 67).replace(/\s+\S*$/, '') + '…' : clean;
}

/** Anexos vão para dentro do Firestore (o Storage é pago): imagens são reduzidas antes. */
async function attachment(file) {
  if (!file || typeof file === 'string') return null;
  if (!/^(image\/(png|jpe?g|gif|webp)|application\/pdf|text\/plain)$/.test(file.type)) {
    fail(400, 'Tipo de arquivo não permitido. Envie imagem (PNG, JPG, GIF, WEBP), PDF ou TXT.');
  }
  if (file.type.startsWith('image/')) return { url: await shrinkImage(file, 1200), name: file.name, type: 'image/jpeg' };
  if (file.size > 600 * 1024) fail(400, 'PDFs e textos podem ter até 600 KB. Para imagens não há limite: elas são reduzidas.');
  return { url: await fileToDataUrl(file), name: file.name, type: file.type };
}

const newMessage = (ticketId, { userId = null, body = '', file = null, system = false }) => ({
  ticket_id: ticketId, user_id: userId, body, attachment_url: file?.url ?? null, attachment_name: file?.name ?? null,
  attachment_type: file?.type ?? null, is_system: system ? 1 : 0, created_at: nowIso(),
});

async function createTicket(me, U, b) {
  const description = String(b.description || '').trim();
  const title = String(b.title || '').trim() || deriveTitle(description);
  const category = b.category || UNCLASSIFIED;
  const location = String(b.location || me.location || '').trim();
  if (description.length < 5) fail(400, 'Conte um pouco mais sobre o problema (pelo menos uma frase curta).');
  if (!CATEGORIES.includes(category)) fail(400, 'Escolha uma categoria válida.');
  if (!PRIORITIES.includes(b.priority)) fail(400, 'Escolha uma prioridade válida.');
  const file = await attachment(b.file);

  const now = nowIso();
  const counter = doc(db, 'meta', 'counters');
  const t = await runTransaction(db, async (tx) => {
    const c = await tx.get(counter);
    const id = (c.exists() ? c.data().tickets : 0) + 1;
    const data = {
      title, description, category, priority: b.priority, status: 'aberto', location: location || null,
      requester_id: me.id, technician_id: null, resolution_type: null, resolution_note: null, visit_at: null, ...NO_PENDING,
      rating: null, rating_comment: null, created_at: now, updated_at: now, resolved_at: null, closed_at: null,
      message_count: file ? 1 : 0, last_event: 'created', last_actor: me.id, last_message: null,
    };
    tx.set(counter, { tickets: id });
    tx.set(doc(db, 'tickets', String(id)), data);
    return { id, ...data };
  });
  const batch = writeBatch(db);
  batch.set(doc(collection(db, 'tickets', String(t.id), 'messages')), newMessage(t.id, { body: `Chamado aberto por ${me.name}.`, system: true }));
  if (file) batch.set(doc(collection(db, 'tickets', String(t.id), 'messages')), newMessage(t.id, { userId: me.id, file }));
  await batch.commit();
  return ticketView(t, U);
}

/** Grava a mudança do chamado + um aviso do sistema, e devolve como o servidor devolveria. */
async function change(me, U, t, fields, systemBody, event) {
  const tref = doc(db, 'tickets', String(t.id));
  const mref = doc(collection(db, 'tickets', String(t.id), 'messages'));
  const m = newMessage(t.id, { body: systemBody, system: true });
  const upd = { ...fields, updated_at: m.created_at, last_event: event, last_actor: me.id };
  const batch = writeBatch(db);
  batch.set(mref, m);
  batch.update(tref, upd);
  await batch.commit();
  Object.assign(t, upd);
  return { ticket: ticketView(t, U), messages: [messageView({ id: mref.id, ...m }, U)] };
}

async function patchTicket(me, U, t, b) {
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
  if (!notes.length) return { ticket: ticketView(t, U), messages: [] };
  return change(me, U, t, changes, `${me.name} alterou ${notes.join(', ')}.`, 'updated');
}

const needStaff = (me) => (isStaff(me) ? me : fail(403, 'Você não tem permissão para isso.'));
const needActive = (t) => ACTIVE.includes(t.status) || fail(400, 'Este chamado não está mais em andamento.');
function needHandler(U, me, t) {
  if (t.technician_id && t.technician_id !== me.id && me.role !== 'admin') fail(403, `Este chamado está com ${U.get(t.technician_id)?.name}.`);
}

const ACTIONS = {
  async assign(me, U, t, b) {
    needStaff(me);
    needActive(t);
    const techId = b?.technician_id ? String(b.technician_id) : me.id;
    if (techId !== me.id && me.role !== 'admin') fail(403, 'Só o administrador pode atribuir a outra pessoa.');
    const tech = U.get(techId);
    if (!tech || !tech.active || !isStaff(tech)) fail(400, 'Técnico não encontrado.');
    if (t.technician_id === tech.id) fail(400, `O chamado já está com ${tech.name}.`);
    const body = tech.id === me.id ? `${tech.name} assumiu o chamado.` : `${me.name} atribuiu o chamado a ${tech.name}.`;
    return change(me, U, t, { technician_id: tech.id, status: t.status === 'aberto' ? 'em_atendimento' : t.status }, body, 'assigned');
  },

  async visit(me, U, t, b) {
    needStaff(me);
    needActive(t);
    needHandler(U, me, t);
    const when = new Date(b?.visit_at);
    if (!b?.visit_at || Number.isNaN(when.getTime())) fail(400, 'Informe a data e hora da visita.');
    const note = String(b?.note || '').trim();
    const where_ = t.location ? ` (${t.location})` : '';
    const what = when.getTime() - Date.now() < 10 * 60e3 ? `${me.name} está a caminho${where_}.` : `${me.name} agendou uma visita presencial para ${fmtDateTime(when)}${where_}.`;
    return change(me, U, t, { technician_id: t.technician_id ?? me.id, status: 'visita_agendada', visit_at: when.toISOString(), resolution_type: 'presencial' }, `${what}${note ? `\n${note}` : ''}`, 'visit');
  },

  async wait(me, U, t, b) {
    needStaff(me);
    needActive(t);
    needHandler(U, me, t);
    const type = b?.type;
    const item = String(b?.item || '').trim();
    const due = String(b?.due || '');
    const note = String(b?.note || '').trim();
    if (!['compra', 'terceirizado'].includes(type)) fail(400, 'Informe se é uma compra ou um serviço terceirizado.');
    if (item.length < 2) fail(400, type === 'compra' ? 'Informe o que vai ser comprado.' : 'Informe qual serviço foi acionado.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(due)) fail(400, 'Informe o prazo de chegada.');
    if (due < todayYmd()) fail(400, 'O prazo não pode estar no passado.');
    const updating = t.status === 'aguardando';
    const what = updating
      ? `${me.name} atualizou a pendência: ${item}. Novo prazo: ${fmtDay(due)}.`
      : `${me.name} solicitou ${PENDING_LABEL[type]} ${item}.\nPrazo de chegada: ${fmtDay(due)}.`;
    return change(
      me, U, t,
      { technician_id: t.technician_id ?? me.id, status: 'aguardando', pending_type: type, pending_item: item, pending_due: due, pending_since: updating ? t.pending_since : nowIso() },
      `${what}${note ? `\n${note}` : ''}`, 'waiting'
    );
  },

  async resume(me, U, t, b) {
    needStaff(me);
    needHandler(U, me, t);
    if (t.status !== 'aguardando') fail(400, 'Este chamado não está aguardando nada.');
    const note = String(b?.note || '').trim();
    const arrived = t.pending_type === 'compra' ? `Chegou: ${t.pending_item}.` : `Serviço terceirizado concluído: ${t.pending_item}.`;
    return change(me, U, t, { status: 'em_atendimento', ...NO_PENDING }, `${arrived} ${me.name} retomou o atendimento.${note ? `\n${note}` : ''}`, 'resumed');
  },

  async resolve(me, U, t, b) {
    needStaff(me);
    needActive(t);
    needHandler(U, me, t);
    const type = b?.resolution_type;
    const note = String(b?.note || '').trim();
    if (!['online', 'presencial'].includes(type)) fail(400, 'Informe se foi resolvido online ou presencialmente.');
    if (note.length < 3) fail(400, 'Descreva rapidamente a solução aplicada.');
    const how = type === 'online' ? 'remotamente (online)' : 'presencialmente';
    return change(
      me, U, t,
      { technician_id: t.technician_id ?? me.id, status: 'resolvido', resolution_type: type, resolution_note: note, resolved_at: nowIso() },
      `${me.name} marcou o chamado como resolvido ${how}.\nSolução: ${note}`, 'resolved'
    );
  },

  async reopen(me, U, t, b) {
    if (t.status !== 'resolvido') fail(400, 'Só é possível reabrir chamados resolvidos e ainda não avaliados.');
    const reason = String(b?.reason || '').trim();
    if (!isStaff(me) && reason.length < 3) fail(400, 'Conte o que ainda não está funcionando.');
    return change(
      me, U, t,
      { status: t.technician_id ? 'em_atendimento' : 'aberto', resolution_type: null, resolution_note: null, resolved_at: null, visit_at: null, ...NO_PENDING },
      `${me.name} reabriu o chamado.${reason ? `\nMotivo: ${reason}` : ''}`, 'reopened'
    );
  },

  async rate(me, U, t, b) {
    if (t.requester_id !== me.id) fail(403, 'Só quem abriu o chamado pode avaliar.');
    if (t.status !== 'resolvido') fail(400, 'O chamado precisa estar resolvido para ser avaliado.');
    const rating = Number(b?.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) fail(400, 'Escolha uma nota de 1 a 5.');
    const comment = String(b?.comment || '').trim();
    const body = `${me.name} avaliou o atendimento com ${rating} ${rating === 1 ? 'estrela' : 'estrelas'} e encerrou o chamado.`;
    return change(me, U, t, { status: 'fechado', rating, rating_comment: comment || null, closed_at: nowIso() }, body, 'rated');
  },

  async cancel(me, U, t, b) {
    needActive(t);
    if (!isStaff(me) && t.requester_id !== me.id) fail(403, 'Sem permissão.');
    const reason = String(b?.reason || '').trim();
    return change(me, U, t, { status: 'cancelado', closed_at: nowIso() }, `${me.name} cancelou o chamado.${reason ? `\nMotivo: ${reason}` : ''}`, 'cancelled');
  },

  async messages(me, U, t, b) {
    const body = String(b?.body || '').trim();
    if (['fechado', 'cancelado'].includes(t.status)) fail(400, 'Este chamado foi encerrado. Se o problema voltar, abra um novo chamado.');
    const file = await attachment(b?.file);
    if (!body && !file) fail(400, 'Escreva uma mensagem ou anexe um arquivo.');
    if (body.length > 5000) fail(400, 'Mensagem muito longa.');
    const mref = doc(collection(db, 'tickets', String(t.id), 'messages'));
    const m = newMessage(t.id, { userId: me.id, body, file });
    const upd = {
      updated_at: m.created_at, message_count: increment(1), last_event: 'message', last_actor: me.id,
      last_message: { id: mref.id, user_id: me.id, user_name: me.name, body: body ? body.slice(0, 160) : '', created_at: m.created_at },
    };
    const batch = writeBatch(db);
    batch.set(mref, m);
    batch.update(doc(db, 'tickets', String(t.id)), upd);
    await batch.commit();
    Object.assign(t, upd, { message_count: (t.message_count || 0) + 1 });
    return { ticket: ticketView(t, U), messages: [messageView({ id: mref.id, ...m }, U)] };
  },
};

// ---------------------------------------------------------------- usuários (admin)

async function listUsers(U) {
  const tickets = (await getDocs(collection(db, 'tickets'))).docs.map((d) => d.data());
  return [...U.values()]
    .map((u) => ({
      ...u,
      active: u.active ? 1 : 0,
      approved: u.approved ? 1 : 0,
      tickets_opened: tickets.filter((t) => t.requester_id === u.id).length,
      tickets_handled: tickets.filter((t) => t.technician_id === u.id).length,
    }))
    .sort((x, y) => x.approved - y.approved || y.active - x.active || x.name.localeCompare(y.name));
}

/**
 * O admin cria uma conta para outra pessoa sem perder a própria sessão:
 * usa uma segunda instância do Firebase só para isso e manda o e-mail de confirmação para a pessoa.
 */
async function createUser(b) {
  const name = String(b.name || '').trim();
  const email = String(b.email || '').trim().toLowerCase();
  const password = String(b.password || '');
  if (name.length < 2) fail(400, 'Informe o nome.');
  if (!EMAIL_RE.test(email)) fail(400, 'E-mail inválido.');
  if (password.length < 6) fail(400, 'A senha precisa ter pelo menos 6 caracteres.');
  if (!ROLES.includes(b.role)) fail(400, 'Perfil inválido.');
  const second = initializeApp(firebaseConfig, `admin-create-${Date.now()}`);
  try {
    const auth2 = getAuth(second);
    let fu;
    try {
      fu = (await createUserWithEmailAndPassword(auth2, email, password)).user;
    } catch (e) {
      if (e.code === 'auth/email-already-in-use') fail(400, 'Já existe um usuário com esse e-mail.');
      throw e;
    }
    await sendEmailVerification(fu).catch(() => {});
    const profile = {
      name, email, role: b.role, department: String(b.department || '').trim() || null, location: String(b.location || '').trim() || null,
      active: true, approved: true, avatar_url: null, created_at: nowIso(),
    };
    await setDoc(doc(db, 'users', fu.uid), profile);
    await signOut(auth2);
    return { id: fu.uid, ...profile };
  } finally {
    await deleteApp(second).catch(() => {});
  }
}

async function patchUser(me, u, b) {
  const fields = {};
  if (b.name !== undefined) {
    if (String(b.name).trim().length < 2) fail(400, 'Informe o nome.');
    fields.name = String(b.name).trim();
  }
  if (b.email !== undefined && String(b.email).trim().toLowerCase() !== u.email) {
    fail(400, 'O e-mail de login não pode ser trocado por aqui. Crie uma conta nova com o e-mail certo e desative esta.');
  }
  if (b.role !== undefined) {
    if (!ROLES.includes(b.role)) fail(400, 'Perfil inválido.');
    if (u.id === me.id && b.role !== 'admin') fail(400, 'Você não pode remover seu próprio acesso de administrador.');
    fields.role = b.role;
  }
  if (b.department !== undefined) fields.department = String(b.department).trim() || null;
  if (b.location !== undefined) fields.location = String(b.location).trim() || null;
  if (b.active !== undefined) {
    if (u.id === me.id && !b.active) fail(400, 'Você não pode desativar a si mesmo.');
    fields.active = !!b.active;
  }
  if (b.password) await sendPasswordResetEmail(auth, u.email); // senha de outra pessoa: vai por e-mail
  if (Object.keys(fields).length) await updateDoc(doc(db, 'users', u.id), fields);
  return { ...u, ...fields };
}

async function approveUser(u, b) {
  if (u.approved) fail(400, 'Esse cadastro já foi aprovado.');
  const r = b?.role || 'colaborador';
  if (!ROLES.includes(r)) fail(400, 'Perfil inválido.');
  await updateDoc(doc(db, 'users', u.id), { approved: true, active: true, role: r });
  return { ...u, approved: 1, active: 1, role: r };
}

async function rejectUser(u) {
  if (u.approved) fail(400, 'Só é possível recusar cadastros pendentes. Para tirar o acesso, desative o usuário.');
  await deleteDoc(doc(db, 'users', u.id));
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

function statsAll(T, U) {
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
    resolution: { online: done.filter((t) => t.resolution_type === 'online').length, presencial: done.filter((t) => t.resolution_type === 'presencial').length },
    byCategory: Object.entries(cats).map(([category, n]) => ({ category, n })).sort((a, b) => b.n - a.n),
    technicians: [...U.values()]
      .filter((u) => isStaff(u) && u.active && u.approved)
      .map((u) => {
        const mine = T.filter((t) => t.technician_id === u.id);
        const res = mine.filter((t) => DONE.includes(t.status));
        return {
          id: u.id, name: u.name, avatar_url: u.avatar_url, total: mine.length, active: mine.filter((t) => ACTIVE.includes(t.status)).length,
          resolved: res.length, online: res.filter((t) => t.resolution_type === 'online').length, rating: avg(mine.filter((t) => t.rating).map((t) => t.rating)),
        };
      })
      .sort((a, b) => b.resolved - a.resolved || a.name.localeCompare(b.name)),
    daily: countByDay(T, 'created_at', since),
    since,
  };
}

function statsMe(mine) {
  const res = mine.filter((t) => DONE.includes(t.status));
  const rated = mine.filter((t) => t.rating);
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  const distribution = {};
  for (const t of rated) distribution[t.rating] = (distribution[t.rating] || 0) + 1;
  const since = since14();
  return {
    totals: {
      handled: mine.length, active: mine.filter((t) => ACTIVE.includes(t.status)).length, resolved: res.length,
      online: res.filter((t) => t.resolution_type === 'online').length, presencial: res.filter((t) => t.resolution_type === 'presencial').length,
      rating: avg(rated.map((t) => t.rating)), ratings: rated.length,
      avg_hours: avg(mine.filter((t) => t.resolved_at).map((t) => hoursBetween(t.created_at, t.resolved_at))),
    },
    thisMonth: mine.filter((t) => t.resolved_at && t.resolved_at >= monthStart).length,
    distribution,
    daily: countByDay(mine, 'resolved_at', since),
    since,
    reviews: rated
      .sort((a, b) => String(b.closed_at).localeCompare(String(a.closed_at)))
      .slice(0, 8)
      .map((t) => ({ id: t.id, title: t.title, rating: t.rating, rating_comment: t.rating_comment, closed_at: t.closed_at, requester_name: usersMap?.get(t.requester_id)?.name })),
  };
}

export { usersCache, app };
