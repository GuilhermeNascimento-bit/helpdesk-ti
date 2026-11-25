import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth, useSocket, useSocketEvent, useToast } from '../context.jsx';
import { ROLE, dueInfo, isStaff, firstName } from '../constants.js';
import { Avatar, Icons, Toasts } from './ui.jsx';
import ErrorBoundary from './ErrorBoundary.jsx';
import { PrefsButton } from '../prefs.jsx';

export default function Layout() {
  const { user, logout } = useAuth();
  const { push } = useToast();
  const socket = useSocket();
  const location = useLocation();
  const staff = isStaff(user);
  const [queueCount, setQueueCount] = useState(0);
  const [waiting, setWaiting] = useState({ n: 0, late: 0 });
  const [bump, setBump] = useState(0);
  const [online, setOnline] = useState(true);

  const refreshQueue = useCallback(() => {
    if (!staff) return;
    api('/tickets?scope=queue')
      .then((l) =>
        setQueueCount((prev) => {
          if (l.length > prev) setBump((b) => b + 1);
          return l.length;
        })
      )
      .catch(() => {});
    api('/tickets?scope=waiting')
      .then((l) => setWaiting({ n: l.length, late: l.filter((t) => dueInfo(t.pending_due)?.overdue).length }))
      .catch(() => {});
  }, [staff]);
  useEffect(refreshQueue, [refreshQueue]);

  // Admin: cadastros esperando aprovação
  const [pendingUsers, setPendingUsers] = useState(0);
  const refreshPendingUsers = useCallback(() => {
    if (user.role !== 'admin') return;
    api('/users')
      .then((l) => setPendingUsers(l.filter((u) => !u.approved).length))
      .catch(() => {});
  }, [user.role]);
  useEffect(refreshPendingUsers, [refreshPendingUsers]);
  useSocketEvent('user:pending', ({ user: u, event }) => {
    refreshPendingUsers();
    if (event === 'created')
      push({ title: 'Novo cadastro para aprovar', body: `${u.name} (${u.department || 'sem setor'})`, to: '/usuarios' });
  });

  useEffect(() => {
    if (!socket) return;
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    socket.on('connect', up);
    socket.on('disconnect', down);
    return () => {
      socket.off('connect', up);
      socket.off('disconnect', down);
    };
  }, [socket]);

  const viewing = (id) => location.pathname === `/chamados/${id}`;

  useSocketEvent('message:new', ({ message, ticket }) => {
    if (message.is_system || message.user_id === user.id || viewing(ticket.id)) return;
    push({ title: `${message.user_name} no #${ticket.id}`, body: message.body || 'Enviou um anexo', to: `/chamados/${ticket.id}` });
  });

  useSocketEvent('ticket:updated', ({ ticket, event, actorId }) => {
    refreshQueue();
    if (actorId === user.id || viewing(ticket.id)) return;
    const to = `/chamados/${ticket.id}`;
    const tech = firstName(ticket.technician_name) || 'Um técnico';
    if (event === 'created' && staff) {
      push({
        title: ticket.priority === 'urgente' ? `Chamado urgente #${ticket.id}` : `Novo chamado #${ticket.id}`,
        body: `${ticket.requester_name}: ${ticket.title}`,
        tone: ticket.priority === 'urgente' ? 'error' : 'info',
        to,
      });
    } else if (ticket.requester_id === user.id) {
      const text = {
        assigned: `${tech} está cuidando do seu chamado.`,
        visit: `${tech} vai até você.`,
        waiting: 'Seu chamado está aguardando um item ou serviço. Veja o prazo.',
        resumed: 'O item chegou e o atendimento foi retomado.',
        resolved: 'Seu chamado foi resolvido. Confirme e avalie o atendimento.',
        cancelled: 'Seu chamado foi cancelado.',
      }[event];
      if (text) push({ title: ticket.title, body: text, tone: event === 'resolved' ? 'success' : 'info', to });
    } else if (event === 'assigned' && ticket.technician_id === user.id) {
      push({ title: `Chamado #${ticket.id} agora é seu`, body: ticket.title, to });
    } else if (event === 'reopened' && ticket.technician_id === user.id) {
      push({ title: `Chamado #${ticket.id} foi reaberto`, body: ticket.title, tone: 'error', to });
    } else if (event === 'rated' && ticket.technician_id === user.id) {
      push({ title: `Você recebeu ${ticket.rating} ★`, body: ticket.rating_comment || ticket.title, tone: 'success', to });
    }
  });

  const content = (
    <ErrorBoundary key={location.pathname}>
      <div className="route">
        <Outlet />
      </div>
    </ErrorBoundary>
  );

  const conn = (
    <span className={`conn ${online ? 'conn-on' : 'conn-off'}`} title={online ? 'Conectado' : 'Reconectando…'} />
  );

  // ---------- Colaborador: barra no topo, conteúdo centralizado ----------
  if (!staff)
    return (
      <div className="shell-top">
        <header className="topbar">
          <div className="topbar-inner">
            <Link to="/" className="brand brand-dark">
              <span className="brand-mark">{Icons.monitor}</span>
              <span className="brand-name">Helpdesk T.I</span>
            </Link>
            <div className="topbar-right">
              {location.pathname !== '/chamados/novo' && (
                <Link to="/chamados/novo" className="btn btn-primary btn-sm">
                  {Icons.plus} <span className="hide-sm">Abrir chamado</span>
                </Link>
              )}
              <div className="me-chip">
                <Avatar name={user.name} size={30} />
                <span className="hide-sm">{firstName(user.name)}</span>
                {conn}
              </div>
              <PrefsButton />
              <button className="icon-btn" onClick={logout} title="Sair">
                {Icons.logout}
              </button>
            </div>
          </div>
        </header>
        <main className="main">{content}</main>
        <Toasts />
      </div>
    );

  // ---------- T.I: barra lateral ----------
  const nav = [
    ...(user.role === 'admin' ? [{ to: '/painel', label: 'Painel', icon: Icons.chart }] : []),
    { to: '/fila', label: 'Fila', icon: Icons.inbox, count: queueCount },
    { to: '/meus-atendimentos', label: 'Meus atendimentos', icon: Icons.wrench },
    { to: '/pendencias', label: 'Pendências', icon: Icons.box, count: waiting.n, late: waiting.late > 0 },
    { to: '/chamados', label: 'Todos os chamados', icon: Icons.list, end: true },
    { to: '/desempenho', label: 'Meu desempenho', icon: Icons.trophy },
    ...(user.role === 'admin'
      ? [{ to: '/usuarios', label: 'Usuários', icon: Icons.users, count: pendingUsers, late: pendingUsers > 0, lateTitle: 'Cadastros aguardando aprovação' }]
      : []),
  ];

  return (
    <div className="shell">
      <aside className="sidebar">
        <Link to="/" className="brand">
          <span className="brand-mark">{Icons.monitor}</span>
          <span className="brand-name">Helpdesk T.I</span>
        </Link>
        <SideNav items={nav} pathname={location.pathname} bump={bump} />
      </aside>
      <div className="staff-main">
        {/* Barra do topo: conexão, preferências e conta, igual à do colaborador */}
        <header className="staff-top">
          <span className="staff-status">
            {conn} {online ? 'Conectado em tempo real' : 'Reconectando…'}
          </span>
          <div className="topbar-right">
            <PrefsButton />
            <div className="me-chip">
              <Avatar name={user.name} size={30} />
              <span className="me-chip-text hide-sm">
                <b>{user.name}</b>
                <small>{ROLE[user.role]}</small>
              </span>
            </div>
            <button className="icon-btn" onClick={logout} title="Sair">
              {Icons.logout}
            </button>
          </div>
        </header>
        <main className="main">{content}</main>
      </div>
      <Toasts />
    </div>
  );
}

/** Navegação com a pílula que desliza até o item ativo. */
function SideNav({ items, pathname, bump }) {
  const ref = useRef();
  const [pill, setPill] = useState(null);
  useLayoutEffect(() => {
    const measure = () => {
      const el = ref.current?.querySelector('.nav-item.active');
      setPill(el ? { top: el.offsetTop, left: el.offsetLeft, width: el.offsetWidth, height: el.offsetHeight } : null);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [pathname, items.length]);

  return (
    <nav className="nav" ref={ref}>
      {pill && <span className="nav-pill" style={pill} />}
      {items.map((n) => (
        <NavLink key={n.to} to={n.to} end={n.end} className="nav-item">
          {n.icon}
          <span className="nav-label">{n.label}</span>
          {n.count > 0 && (
            <span className={`nav-count ${n.late ? 'nav-count-late' : n.to === '/pendencias' ? 'nav-count-soft' : ''}`} key={bump} title={n.late ? n.lateTitle || 'Tem pendência atrasada' : undefined}>
              {n.count}
            </span>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
