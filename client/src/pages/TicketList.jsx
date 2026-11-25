import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useSocketEvent, useToast } from '../context.jsx';
import { PENDING, PRIORITY, UNCLASSIFIED, dueInfo, firstName, fmtDay, timeAgo } from '../constants.js';
import { Avatar, Empty, Icons, PriorityIcon, ProgressTrack, SkeletonRows, StatusBadge } from '../components/ui.jsx';

const SCOPES = {
  requested: { title: 'Chamados que eu abri', sub: 'Pedidos que você mesmo fez para a T.I.' },
  all: { title: 'Todos os chamados', sub: 'Tudo que chegou para a T.I.' },
  queue: { title: 'Fila', sub: 'Esperando alguém assumir. Os mais urgentes ficam no topo.' },
  mine: { title: 'Meus atendimentos', sub: 'Chamados que estão com você agora.' },
  waiting: { title: 'Pendências', sub: 'Chamados esperando uma compra ou um serviço terceirizado. Os prazos mais próximos ficam no topo.' },
};

const FILTERS = [
  { value: 'ativos', label: 'Em andamento' },
  { value: 'resolvido', label: 'Aguardando confirmação' },
  { value: 'encerrados', label: 'Encerrados' },
  { value: '', label: 'Todos' },
];

/** Lista da equipe de T.I: tabela com colunas alinhadas. */
export default function TicketList({ scope }) {
  const { push } = useToast();
  const navigate = useNavigate();
  const queue = scope === 'queue';
  const waiting = scope === 'waiting';
  const [filter, setFilter] = useState(queue || waiting ? '' : 'ativos');
  const [q, setQ] = useState('');
  const [tickets, setTickets] = useState(null);
  const [error, setError] = useState('');
  const [leaving, setLeaving] = useState(null);
  const seen = useRef(null);
  const [fresh, setFresh] = useState({});

  const load = useCallback(() => {
    const p = new URLSearchParams({ scope });
    if (filter) p.set('status', filter);
    if (q.trim()) p.set('q', q.trim());
    api(`/tickets?${p}`)
      .then((list) => {
        if (seen.current) {
          const marks = {};
          for (const t of list) {
            if (!(t.id in seen.current)) marks[t.id] = 'new';
            else if (seen.current[t.id] !== t.updated_at) marks[t.id] = 'changed';
          }
          setFresh(marks);
        }
        seen.current = Object.fromEntries(list.map((t) => [t.id, t.updated_at]));
        setTickets(list);
        setError('');
      })
      .catch((e) => setError(e.message));
  }, [scope, filter, q]);

  useEffect(() => {
    seen.current = null;
    setFresh({});
  }, [filter, q]);

  useEffect(() => {
    const t = setTimeout(load, q ? 250 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  useSocketEvent('ticket:updated', load);

  const assume = async (e, t) => {
    e.preventDefault();
    setLeaving(t.id);
    try {
      await api(`/tickets/${t.id}/assign`, { method: 'POST', body: {} });
      push({ tone: 'success', title: `Chamado #${t.id} é seu`, body: t.title, ttl: 3500 });
      setTimeout(() => navigate(`/chamados/${t.id}`), 280);
    } catch (err) {
      setLeaving(null);
      push({ tone: 'error', title: 'Não foi possível assumir', body: err.message });
      load();
    }
  };

  const { title, sub } = SCOPES[scope];

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>
            {title}
            {tickets && <span className="count count-lg">{tickets.length}</span>}
          </h1>
          <p className="muted">{sub}</p>
        </div>
        <label className="search">
          {Icons.search}
          <input placeholder="Buscar por assunto, nome ou número" value={q} onChange={(e) => setQ(e.target.value)} />
          {q && (
            <button className="search-clear" onClick={() => setQ('')} aria-label="Limpar busca">
              {Icons.x}
            </button>
          )}
        </label>
      </header>

      {!queue && !waiting && (
        <div className="toolbar">
          <div className="segmented">
            {FILTERS.map((f) => (
              <button key={f.value} className={filter === f.value ? 'active' : ''} onClick={() => setFilter(f.value)}>
                {f.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {error && <div className="alert alert-error">{error}</div>}
      {!tickets && !error && <SkeletonRows />}

      {tickets?.length === 0 && (
        <Empty icon={queue || waiting ? Icons.check : Icons.inbox} title={queue ? 'Fila zerada' : waiting ? 'Nenhuma pendência' : q ? 'Nada encontrado' : 'Nenhum chamado aqui'}>
          {waiting
            ? 'Nenhum chamado esperando compra ou serviço terceirizado.'
            : queue
            ? 'Ninguém esperando atendimento. Chamados novos aparecem aqui na hora.'
            : q
              ? `Nenhum chamado combina com "${q}".`
              : 'Troque o filtro acima para ver outros chamados.'}
        </Empty>
      )}

      {tickets?.length > 0 && waiting && <WaitingTable tickets={tickets} />}

      {tickets?.length > 0 && !waiting && (
        <div className={`tl card ${queue ? 'tl-queue' : ''}`}>
          <div className="tl-head">
            <span>Chamado</span>
            <span>Prioridade</span>
            <span>{queue ? 'Local' : 'Técnico'}</span>
            <span>{queue ? 'Esperando há' : 'Andamento'}</span>
            <span>{queue ? '' : 'Situação'}</span>
          </div>
          {tickets.map((t, i) => (
            <Link
              key={t.id}
              to={`/chamados/${t.id}`}
              className={`tl-row prio-${t.priority} ${fresh[t.id] ? `is-${fresh[t.id]}` : ''} ${leaving === t.id ? 'is-leaving' : ''}`}
              style={{ '--i': Math.min(i, 12) }}
            >
              <div className="tl-main">
                <div className="ticket-title">
                  <span className="ticket-id">#{t.id}</span>
                  <strong>{t.title}</strong>
                </div>
                <div className="ticket-meta">
                  <span className="meta-strong">{t.requester_name}</span>
                  {t.requester_department && <span>{t.requester_department}</span>}
                  {t.category === UNCLASSIFIED ? <span className="meta-warn">Sem categoria</span> : <span>{t.category}</span>}
                  {t.message_count > 0 && (
                    <span className="meta-msgs">
                      {Icons.chat} {t.message_count}
                    </span>
                  )}
                </div>
              </div>

              <span className={`tl-prio prio-text-${t.priority}`}>
                <PriorityIcon priority={t.priority} /> {PRIORITY[t.priority]?.label}
              </span>

              {queue ? (
                <span className="tl-cell muted">{t.location || '—'}</span>
              ) : (
                <span className="tl-cell">
                  {t.technician_name ? (
                    <>
                      <Avatar name={t.technician_name} size={24} /> {firstName(t.technician_name)}
                    </>
                  ) : (
                    <span className="meta-warn">Ninguém</span>
                  )}
                </span>
              )}

              {queue ? (
                <span className="tl-cell muted">{timeAgo(t.created_at).replace('há ', '')}</span>
              ) : (
                <div className="tl-track">
                  <ProgressTrack ticket={t} compact />
                  <small>{timeAgo(t.updated_at)}</small>
                </div>
              )}

              <span className="tl-end">
                {queue ? (
                  <button className="btn btn-sm btn-primary" onClick={(e) => assume(e, t)}>
                    Assumir
                  </button>
                ) : (
                  <StatusBadge status={t.status} />
                )}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

/** Pendências: o que está sendo esperado e quando deve chegar. */
function WaitingTable({ tickets }) {
  return (
    <div className="tl tl-wait card">
      <div className="tl-head">
        <span>Chamado</span>
        <span>Aguardando</span>
        <span>Técnico</span>
        <span>Prazo</span>
      </div>
      {tickets.map((t, i) => {
        const info = dueInfo(t.pending_due);
        return (
          <Link key={t.id} to={`/chamados/${t.id}`} className={`tl-row ${info?.overdue ? 'row-overdue' : ''}`} style={{ '--i': Math.min(i, 12) }}>
            <div className="tl-main">
              <div className="ticket-title">
                <span className="ticket-id">#{t.id}</span>
                <strong>{t.title}</strong>
              </div>
              <div className="ticket-meta">
                <span className="meta-strong">{t.requester_name}</span>
                {t.location && <span>{t.location}</span>}
              </div>
            </div>
            <span className="tl-cell tl-wait-item">
              <span className={`wait-kind wait-${t.pending_type}`}>{t.pending_type === 'compra' ? Icons.box : Icons.truck}</span>
              <span className="wait-text">
                <b>{t.pending_item}</b>
                <small>{PENDING[t.pending_type]?.label}</small>
              </span>
            </span>
            <span className="tl-cell">
              {t.technician_name && <Avatar name={t.technician_name} size={24} />} {firstName(t.technician_name)}
            </span>
            <span className={`due ${info?.overdue ? 'due-late' : info?.days <= 1 ? 'due-soon' : ''}`}>
              <b>{fmtDay(t.pending_due)}</b>
              <small>{info?.text}</small>
            </span>
          </Link>
        );
      })}
    </div>
  );
}
