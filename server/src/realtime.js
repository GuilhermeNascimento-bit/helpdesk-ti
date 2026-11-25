import { Server } from 'socket.io';
import { db } from './db.js';
import { userFromToken, isStaff } from './auth.js';

let io;

export function initRealtime(httpServer) {
  io = new Server(httpServer);

  io.use((socket, next) => {
    const user = userFromToken(socket.handshake.auth?.token);
    if (!user) return next(new Error('unauthorized'));
    socket.user = user;
    next();
  });

  io.on('connection', (socket) => {
    const { user } = socket;
    socket.join(`user:${user.id}`);
    if (isStaff(user)) socket.join('staff');
    if (user.role === 'admin') socket.join('admins');

    socket.on('ticket:join', (id) => {
      const t = db.prepare('SELECT requester_id FROM tickets WHERE id = ?').get(Number(id));
      if (t && (isStaff(user) || t.requester_id === user.id)) socket.join(`ticket:${id}`);
    });
    socket.on('ticket:leave', (id) => socket.leave(`ticket:${id}`));
    socket.on('typing', (id) => {
      const room = `ticket:${id}`;
      if (socket.rooms.has(room)) socket.to(room).emit('typing', { ticketId: Number(id), userId: user.id, name: user.name });
    });
  });
}

const participants = (ticket) => {
  const rooms = [`ticket:${ticket.id}`, `user:${ticket.requester_id}`];
  if (ticket.technician_id) rooms.push(`user:${ticket.technician_id}`);
  return rooms;
};

/** Mudança de estado do chamado: equipe de T.I + solicitante. */
export function emitTicket(ticket, event, actorId) {
  io?.to('staff').to(participants(ticket)).emit('ticket:updated', { ticket, event, actorId });
}

/** Alguém se cadastrou ou um cadastro foi aprovado/recusado: avisa os admins. */
export function emitPendingUser(user, event = 'created') {
  io?.to('admins').emit('user:pending', { user, event });
}

/** Nova mensagem: quem está na conversa + solicitante + técnico responsável. */
export function emitMessage(ticket, message) {
  io?.to(participants(ticket)).emit('message:new', { message, ticket });
}
