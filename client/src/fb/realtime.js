/**
 * Tempo real com Firebase: escuta o Firestore (onSnapshot) e entrega os mesmos eventos
 * que o Socket.IO do servidor Node entregaria (ticket:updated, message:new, typing, user:pending).
 */
import { collection, doc, getDoc, onSnapshot, query, setDoc, where } from 'firebase/firestore';
import { auth, db } from './firebase.js';
import { isStaff, messageView, ticketView, usersCache } from './server.js';

export function createFirebaseSocket() {
  const handlers = new Map();
  const deliver = (event, payload) => handlers.get(event)?.forEach((fn) => fn(payload));
  const unsubs = [];
  const rooms = new Map(); // chamado aberto na tela → funções para parar de escutar
  let me = null;
  let closed = false;

  (async () => {
    await auth.authStateReady();
    const fu = auth.currentUser;
    if (!fu || closed) return;
    const snap = await getDoc(doc(db, 'users', fu.uid));
    me = { id: fu.uid, ...snap.data() };
    const U = await usersCache();

    // Chamados: a equipe de T.I vê todos; o colaborador, os dele
    const q = isStaff(me) ? collection(db, 'tickets') : query(collection(db, 'tickets'), where('requester_id', '==', me.id));
    let first = true;
    unsubs.push(
      onSnapshot(q, (s) => {
        if (first) return void (first = false); // o estado inicial não é "novidade"
        for (const ch of s.docChanges()) {
          if (ch.type === 'removed' || ch.doc.metadata.hasPendingWrites) continue; // mudanças minhas já aparecem pela resposta
          const t = { id: Number(ch.doc.id), ...ch.doc.data() };
          const ticket = ticketView(t, U);
          const event = ch.type === 'added' ? 'created' : t.last_event || 'updated';
          // Aviso de mensagem nova em chamado que não está aberto na tela (o aberto recebe pela conversa)
          if (event === 'message' && t.last_message && !rooms.has(t.id)) {
            deliver('message:new', { message: { ...t.last_message, ticket_id: t.id, is_system: 0, attachment_url: null }, ticket });
          }
          deliver('ticket:updated', { ticket, event, actorId: t.last_actor });
        }
      }, () => {})
    );

    // Admin: cadastros esperando aprovação
    if (me.role === 'admin') {
      let firstUsers = true;
      unsubs.push(
        onSnapshot(query(collection(db, 'users'), where('approved', '==', false)), (s) => {
          if (firstUsers) return void (firstUsers = false);
          for (const ch of s.docChanges()) {
            const user = { id: ch.doc.id, ...ch.doc.data() };
            deliver('user:pending', { user, event: ch.type === 'added' ? 'created' : 'approved' });
          }
        }, () => {})
      );
    }
    deliver('connect');
  })();

  function join(ticketId) {
    if (rooms.has(ticketId) || !me) return;
    const stops = [];
    let first = true;
    stops.push(
      onSnapshot(collection(db, 'tickets', String(ticketId), 'messages'), async (s) => {
        if (first) return void (first = false);
        const U = await usersCache();
        for (const ch of s.docChanges()) {
          if (ch.type !== 'added' || ch.doc.metadata.hasPendingWrites) continue;
          const tsnap = await getDoc(doc(db, 'tickets', String(ticketId)));
          const ticket = ticketView({ id: ticketId, ...tsnap.data() }, U);
          deliver('message:new', { message: messageView({ id: ch.doc.id, ...ch.doc.data() }, U), ticket });
        }
      }, () => {})
    );
    stops.push(
      onSnapshot(doc(db, 'typing', String(ticketId)), (s) => {
        const d = s.data();
        if (d && d.user_id !== me.id && Date.now() - d.at < 5000) deliver('typing', { ticketId, userId: d.user_id, name: d.name });
      }, () => {})
    );
    rooms.set(ticketId, stops);
  }

  const socket = {
    connected: true,
    on(event, fn) {
      if (!handlers.has(event)) handlers.set(event, new Set());
      handlers.get(event).add(fn);
      return socket;
    },
    off(event, fn) {
      handlers.get(event)?.delete(fn);
      return socket;
    },
    emit(event, arg) {
      const id = Number(arg);
      if (event === 'ticket:join') {
        if (me) join(id);
        else setTimeout(() => socket.emit(event, arg), 300); // ainda carregando o usuário
      } else if (event === 'ticket:leave') {
        rooms.get(id)?.forEach((stop) => stop());
        rooms.delete(id);
      } else if (event === 'typing' && me) {
        setDoc(doc(db, 'typing', String(id)), { user_id: me.id, name: me.name, at: Date.now() }).catch(() => {});
      }
      return socket;
    },
    disconnect() {
      closed = true;
      unsubs.forEach((stop) => stop());
      rooms.forEach((stops) => stops.forEach((stop) => stop()));
      rooms.clear();
      socket.connected = false;
    },
  };
  return socket;
}
