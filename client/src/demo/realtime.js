/**
 * Tempo real da demonstração, sem servidor.
 * Os eventos são entregues na própria aba e nas outras abas do mesmo navegador (BroadcastChannel),
 * com as mesmas regras de quem recebe o quê que o servidor de verdade usa no Socket.IO.
 */
import { load } from './store.js';
import { getToken } from '../api.js';

const listeners = new Set();
const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('helpdesk-demo') : null;
channel?.addEventListener('message', (e) => listeners.forEach((fn) => fn(e.data.event, e.data.payload)));

/** Dispara um evento para esta aba e para as outras. */
export function broadcast(event, payload) {
  listeners.forEach((fn) => fn(event, payload));
  channel?.postMessage({ event, payload });
}

const userIdFromToken = () => Number(String(getToken() || '').replace('demo:', '')) || null;
const isStaff = (u) => u?.role === 'tecnico' || u?.role === 'admin';

/** Mesmas regras de sala do servidor (realtime.js). */
function canReceive(event, payload, me, joined) {
  switch (event) {
    case 'ticket:updated': {
      const t = payload.ticket;
      return isStaff(me) || t.requester_id === me.id || t.technician_id === me.id;
    }
    case 'message:new': {
      const t = payload.ticket;
      return t.requester_id === me.id || t.technician_id === me.id || joined.has(t.id);
    }
    case 'typing':
      return joined.has(payload.ticketId) && payload.userId !== me.id;
    case 'user:pending':
      return me.role === 'admin';
    default:
      return false;
  }
}

/** Objeto com a mesma cara de um socket do Socket.IO (on/off/emit/disconnect). */
export function createDemoSocket() {
  const handlers = new Map();
  const joined = new Set();
  const deliver = (event, payload) => handlers.get(event)?.forEach((fn) => fn(payload));

  const onBus = (event, payload) => {
    const id = userIdFromToken();
    const me = id && load().users.find((u) => u.id === id);
    if (me && canReceive(event, payload, me, joined)) deliver(event, payload);
  };
  listeners.add(onBus);

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
      if (event === 'ticket:join') joined.add(id);
      else if (event === 'ticket:leave') joined.delete(id);
      else if (event === 'typing') {
        const me = load().users.find((u) => u.id === userIdFromToken());
        if (me) broadcast('typing', { ticketId: id, userId: me.id, name: me.name });
      }
      return socket;
    },
    disconnect() {
      listeners.delete(onBus);
      socket.connected = false;
    },
  };
  setTimeout(() => deliver('connect'), 0);
  return socket;
}
