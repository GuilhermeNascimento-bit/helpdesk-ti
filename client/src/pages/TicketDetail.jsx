import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth, useSocket, useSocketEvent, useToast } from '../context.jsx';
import {
  ACTIVE, CATEGORIES, PENDING, PRIORITY, UNCLASSIFIED, addDaysYmd, dueInfo, firstName, fmtDate, fmtDay, fmtTime, fmtWhen, isStaff, todayYmd,
} from '../constants.js';

const DUE_SHORTCUTS = [
  { days: 1, label: 'Amanhã' },
  { days: 3, label: 'Em 3 dias' },
  { days: 7, label: 'Em 1 semana' },
  { days: 15, label: 'Em 15 dias' },
  { days: 30, label: 'Em 1 mês' },
];

/** O que está sendo aguardado, com prazo e barra de tempo decorrido. */
export function PendingCard({ ticket, isRequester, compact = false }) {
  const info = dueInfo(ticket.pending_due);
  const p = PENDING[ticket.pending_type];
  if (!p) return null;
  const start = new Date(ticket.pending_since || ticket.updated_at).getTime();
  const end = new Date(`${ticket.pending_due}T18:00:00`).getTime();
  const pct = Math.min(100, Math.max(4, ((Date.now() - start) / Math.max(1, end - start)) * 100));
  return (
    <div className={`pending-card ${info?.overdue ? 'is-overdue' : ''} ${compact ? 'pending-compact' : ''}`}>
      <div className="pending-icon">{ticket.pending_type === 'compra' ? Icons.box : Icons.truck}</div>
      <div className="pending-text">
        <span className="pending-kind">{p.waiting}</span>
        <strong>{ticket.pending_item}</strong>
        <span className="pending-due">
          Prazo {fmtDay(ticket.pending_due)}, <b>{info?.text}</b>
        </span>
        <div className="pending-bar" title="Tempo decorrido até o prazo">
          <i style={{ width: `${pct}%` }} />
        </div>
        {isRequester && !compact && (
          <span className="pending-hint">
            {info?.overdue
              ? 'O prazo passou. O técnico já foi avisado; você pode perguntar pelo chat.'
              : `Assim que chegar, ${firstName(ticket.technician_name) || 'o técnico'} retoma o atendimento.`}
          </span>
        )}
      </div>
    </div>
  );
}
import { Avatar, Badge, Confetti, Empty, Icons, PriorityBadge, ProgressTrack, Spinner, Stars, StatusBadge } from '../components/ui.jsx';
import { pastedImage, useFilePreview } from './NewTicket.jsx';

export default function TicketDetail() {
  const { id } = useParams();
  const ticketId = Number(id);
  const { user } = useAuth();
  const socket = useSocket();
  const { push } = useToast();
  const navigate = useNavigate();
  const [ticket, setTicket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [error, setError] = useState('');
  const [typing, setTyping] = useState(null);
  const typingTimer = useRef();
  const initialIds = useRef(new Set()); // mensagens que já estavam lá não animam

  const addMessages = useCallback(
    (list) =>
      setMessages((prev) => {
        const ids = new Set(prev.map((m) => m.id));
        const fresh = list.filter((m) => !ids.has(m.id));
        return fresh.length ? [...prev, ...fresh] : prev;
      }),
    []
  );

  const load = useCallback(() => {
    api(`/tickets/${ticketId}`)
      .then((d) => {
        initialIds.current = new Set(d.messages.map((m) => m.id));
        setTicket(d.ticket);
        setMessages(d.messages);
      })
      .catch((e) => setError(e.message));
  }, [ticketId]);

  useEffect(() => {
    setTicket(null);
    setMessages([]);
    setError('');
    load();
  }, [load]);

  useEffect(() => {
    if (!socket) return;
    const join = () => socket.emit('ticket:join', ticketId);
    const rejoin = () => (join(), load());
    join();
    socket.on('connect', rejoin);
    return () => {
      socket.off('connect', rejoin);
      socket.emit('ticket:leave', ticketId);
    };
  }, [socket, ticketId, load]);

  useSocketEvent('message:new', ({ message, ticket: t }) => {
    if (t.id !== ticketId) return;
    addMessages([message]);
    setTicket(t);
    if (message.user_id && message.user_id !== user.id) setTyping(null);
  });
  useSocketEvent('ticket:updated', ({ ticket: t }) => t.id === ticketId && setTicket(t));
  useSocketEvent('typing', ({ ticketId: tid, userId, name }) => {
    if (tid !== ticketId || userId === user.id) return;
    setTyping(name);
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => setTyping(null), 3000);
  });

  const act = async (path, body, method = 'POST') => {
    try {
      const d = await api(`/tickets/${ticketId}${path}`, { method, body });
      setTicket(d.ticket);
      addMessages(d.messages);
      return true;
    } catch (e) {
      push({ tone: 'error', title: 'Não foi possível concluir', body: e.message });
      return false;
    }
  };

  if (error)
    return (
      <div className="page">
        <Empty title="Chamado não encontrado">{error}</Empty>
      </div>
    );
  if (!ticket)
    return (
      <div className="center-pad">
        <Spinner />
      </div>
    );

  const closed = ['fechado', 'cancelado'].includes(ticket.status);

  return (
    <div className="detail">
      <header className="detail-head">
        <div className="detail-left">
          <button className="back" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))}>
            {Icons.back} Voltar
          </button>
          <div className="detail-title">
            <span className="ticket-id">#{ticket.id}</span>
            <h1 title={ticket.title}>{ticket.title}</h1>
          </div>
          <div className="detail-badges">
            <StatusBadge status={ticket.status} />
            <PriorityBadge priority={ticket.priority} />
            {ticket.category !== UNCLASSIFIED && <Badge>{ticket.category}</Badge>}
          </div>
        </div>
        <div className="detail-right">
          <ProgressTrack ticket={ticket} />
        </div>
      </header>

      <div className="detail-body">
        <section className="chat">
          <Messages ticket={ticket} messages={messages} me={user} typing={typing} initialIds={initialIds.current} />
          <Composer ticket={ticket} disabled={closed} onSent={(d) => (setTicket(d.ticket), addMessages(d.messages))} />
        </section>

        <aside className="side">
          <StatusPanel ticket={ticket} me={user} act={act} />
          {isStaff(user) && <StaffPanel ticket={ticket} me={user} act={act} />}
          <DetailsCard ticket={ticket} />
        </aside>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Chat

function Messages({ ticket, messages, me, typing, initialIds }) {
  const ref = useRef();
  useLayoutEffect(() => {
    const el = ref.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: initialIds.size && messages.length > initialIds.size ? 'smooth' : 'auto' });
  }, [messages.length, typing]);

  let lastDay = '';
  return (
    <div className="messages" ref={ref}>
      <div className="problem">
        <div className="problem-head">
          <Avatar name={ticket.requester_name} src={ticket.requester_avatar} size={30} />
          <div>
            <strong>{ticket.requester_name}</strong>
            <span className="muted"> descreveu o problema {fmtWhen(ticket.created_at)}</span>
          </div>
        </div>
        <p>{ticket.description}</p>
      </div>

      {messages.map((m) => {
        const day = new Date(m.created_at).toLocaleDateString('pt-BR');
        const divider = day !== lastDay;
        lastDay = day;
        const isNew = !initialIds.has(m.id);
        return (
          <Fragment key={m.id}>
            {divider && (
              <div className="day-divider">
                <span>{day}</span>
              </div>
            )}
            {m.is_system ? (
              <div className={`sys-msg ${isNew ? 'enter' : ''}`}>
                <span>
                  {m.body}
                  <time>{fmtTime(m.created_at)}</time>
                </span>
              </div>
            ) : (
              <Message m={m} mine={m.user_id === me.id} isNew={isNew} />
            )}
          </Fragment>
        );
      })}
      {typing && (
        <div className="typing">
          <span className="typing-bubble">
            <span className="dots">
              <i />
              <i />
              <i />
            </span>
          </span>
          {firstName(typing)} está digitando
        </div>
      )}
    </div>
  );
}

function Message({ m, mine, isNew }) {
  const staff = m.user_role === 'tecnico' || m.user_role === 'admin';
  return (
    <div className={`msg ${mine ? 'mine' : ''} ${isNew ? 'enter' : ''}`}>
      {!mine && <Avatar name={m.user_name} src={m.user_avatar} size={30} />}
      <div className="msg-col">
        {!mine && (
          <div className="msg-author">
            {m.user_name} {staff && <span className="tag">T.I</span>}
          </div>
        )}
        <div className="bubble">
          {m.attachment_url &&
            (m.attachment_type?.startsWith('image/') ? (
              <a href={m.attachment_url} target="_blank" rel="noreferrer" className="bubble-img">
                <img src={m.attachment_url} alt={m.attachment_name} loading="lazy" />
              </a>
            ) : (
              <a href={m.attachment_url} target="_blank" rel="noreferrer" className="bubble-file">
                {Icons.file} {m.attachment_name}
              </a>
            ))}
          {m.body && <p>{m.body}</p>}
        </div>
        <time>{fmtTime(m.created_at)}</time>
      </div>
    </div>
  );
}

function Composer({ ticket, disabled, onSent }) {
  const socket = useSocket();
  const { push } = useToast();
  const [body, setBody] = useState('');
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [fly, setFly] = useState(0);
  const lastTyping = useRef(0);
  const preview = useFilePreview(file);
  const inputRef = useRef();

  if (disabled) return <div className="composer-closed">Chamado encerrado. Se o problema voltar, abra um novo chamado.</div>;

  const send = async () => {
    if (busy || (!body.trim() && !file)) return;
    setBusy(true);
    setFly((f) => f + 1);
    const fd = new FormData();
    fd.append('body', body);
    if (file) fd.append('file', file);
    try {
      const d = await api(`/tickets/${ticket.id}/messages`, { method: 'POST', form: fd });
      onSent(d);
      setBody('');
      setFile(null);
      inputRef.current?.focus();
    } catch (e) {
      push({ tone: 'error', title: 'Mensagem não enviada', body: e.message });
    } finally {
      setBusy(false);
    }
  };

  const onChange = (e) => {
    setBody(e.target.value);
    if (Date.now() - lastTyping.current > 2000) {
      lastTyping.current = Date.now();
      socket?.emit('typing', ticket.id);
    }
  };

  const canSend = !!body.trim() || !!file;
  return (
    <div className="composer">
      {file && (
        <div className="attach-preview attach-sm pop-in">
          {preview ? <img src={preview} alt="" /> : <span className="file-icon">{Icons.file}</span>}
          <span className="attach-name">{file.name}</span>
          <button type="button" className="icon-btn" onClick={() => setFile(null)} title="Remover anexo">
            {Icons.x}
          </button>
        </div>
      )}
      <div className="composer-row">
        <label className="icon-btn" title="Anexar print ou arquivo">
          {Icons.clip}
          <input type="file" accept="image/*,.pdf,.txt" hidden onChange={(e) => (setFile(e.target.files[0] || null), (e.target.value = ''))} />
        </label>
        <textarea
          ref={inputRef}
          rows={Math.min(6, Math.max(1, body.split('\n').length))}
          placeholder="Escreva uma mensagem"
          value={body}
          onChange={onChange}
          onPaste={(e) => {
            const img = pastedImage(e);
            if (img) {
              e.preventDefault();
              setFile(img);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              send();
            }
          }}
        />
        <button className={`btn btn-primary btn-send ${canSend ? 'ready' : ''}`} onClick={send} disabled={busy || !canSend} title="Enviar (Enter)">
          <span className="send-icon" key={fly}>
            {Icons.send}
          </span>
        </button>
      </div>
      <span className="composer-hint">Enter envia · Shift+Enter pula linha · Ctrl+V cola print</span>
    </div>
  );
}

// ---------------------------------------------------------------- Painel do status

function StatusPanel({ ticket, me, act }) {
  const isRequester = ticket.requester_id === me.id;
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [reopening, setReopening] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const run = async (...args) => {
    setBusy(true);
    const ok = await act(...args);
    setBusy(false);
    return ok;
  };

  const s = ticket.status;
  const tech = firstName(ticket.technician_name);
  return (
    <div className="card side-card" key={s}>
      <h3 className="side-title">Agora</h3>

      {s === 'aberto' && (
        <div className="state">
          <span className="state-icon tone-amber">{Icons.clock}</span>
          <p>{isRequester ? 'Seu chamado está na fila. Um técnico vai assumir em breve.' : 'Esperando um técnico assumir.'}</p>
        </div>
      )}
      {s === 'em_atendimento' && (
        <div className="state">
          <Avatar name={ticket.technician_name} src={ticket.technician_avatar} size={36} />
          <p>
            <b>{ticket.technician_name}</b> {isRequester ? 'está cuidando do seu chamado. Fale com ele(a) pelo chat.' : 'está cuidando deste chamado.'}
          </p>
        </div>
      )}
      {s === 'aguardando' && <PendingCard ticket={ticket} isRequester={isRequester} />}
      {s === 'visita_agendada' && ticket.visit_at && (
        <div className="visit-card">
          <div className="visit-icon">{new Date(ticket.visit_at) - Date.now() < 10 * 60e3 ? Icons.walk : Icons.calendar}</div>
          <div>
            <strong>{new Date(ticket.visit_at) - Date.now() < 10 * 60e3 ? `${tech} está a caminho` : `${tech} vai ${fmtWhen(ticket.visit_at)}`}</strong>
            {ticket.location && (
              <span className="muted">
                {Icons.pin} {ticket.location}
              </span>
            )}
          </div>
        </div>
      )}

      {(s === 'resolvido' || s === 'fechado') && ticket.resolution_note && (
        <div className="resolution">
          <div className="resolution-head">
            {Icons.check}
            Resolvido {ticket.resolution_type === 'online' ? 'à distância' : 'presencialmente'} por {tech}
          </div>
          <p>{ticket.resolution_note}</p>
        </div>
      )}

      {s === 'resolvido' && !isRequester && <p className="muted">Esperando {firstName(ticket.requester_name)} confirmar e avaliar.</p>}

      {s === 'resolvido' && isRequester && !reopening && (
        <div className="rate-box">
          <strong>Funcionou?</strong>
          <span className="muted">Dê uma nota para o atendimento e encerre o chamado.</span>
          <Stars value={rating} onChange={setRating} size={32} />
          {rating > 0 && (
            <textarea
              className="pop-in"
              rows={2}
              placeholder={rating >= 4 ? 'Quer deixar um elogio? (opcional)' : 'O que poderia ter sido melhor? (opcional)'}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
          )}
          <button
            className="btn btn-primary btn-block"
            disabled={!rating || busy}
            onClick={async () => {
              if (await run('/rate', { rating, comment })) setCelebrate(true);
            }}
          >
            Encerrar chamado
          </button>
          <button className="btn btn-link" onClick={() => setReopening(true)}>
            Ainda não funcionou
          </button>
        </div>
      )}

      {s === 'resolvido' && isRequester && reopening && (
        <div className="rate-box pop-in">
          <strong>O que ainda está errado?</strong>
          <textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
          <div className="row-actions">
            <button className="btn btn-ghost" onClick={() => setReopening(false)}>
              Voltar
            </button>
            <button
              className="btn btn-primary"
              disabled={reason.trim().length < 3 || busy}
              onClick={async () => (await run('/reopen', { reason })) && setReopening(false)}
            >
              Reabrir chamado
            </button>
          </div>
        </div>
      )}

      {s === 'fechado' && (
        <div className="rated">
          {celebrate && <Confetti />}
          {celebrate && <strong className="thanks">Obrigado pela avaliação!</strong>}
          {ticket.rating ? <Stars value={ticket.rating} size={20} /> : <p className="muted">Chamado encerrado.</p>}
          {ticket.rating_comment && <p className="quote">“{ticket.rating_comment}”</p>}
        </div>
      )}
      {s === 'cancelado' && <p className="muted">Chamado cancelado.</p>}

      {isRequester && ACTIVE.includes(s) && !isStaff(me) && (
        <button
          className="btn btn-link btn-danger-link"
          disabled={busy}
          onClick={() => {
            const r = window.prompt('Cancelar este chamado? Se quiser, conte o motivo (ex.: "voltou a funcionar").');
            if (r !== null) run('/cancel', { reason: r });
          }}
        >
          Cancelar chamado
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Painel do técnico

/** Atalhos de horário para a visita. */
function visitShortcuts() {
  const now = new Date();
  const at = (h, m = 0, addDays = 0) => {
    const d = new Date(now);
    d.setDate(d.getDate() + addDays);
    d.setHours(h, m, 0, 0);
    return d;
  };
  const opts = [
    { key: 'now', label: 'Estou indo agora', icon: Icons.walk, at: now, main: true },
    { key: '30', label: 'Em 30 min', at: new Date(+now + 30 * 60e3) },
    { key: '60', label: 'Em 1 hora', at: new Date(+now + 60 * 60e3) },
  ];
  if (now.getHours() < 13) opts.push({ key: 'pm', label: 'Hoje às 14h', at: at(14) });
  else if (now.getHours() < 15) opts.push({ key: 'pm', label: 'Hoje às 16h', at: at(16) });
  // próximo dia útil às 9h
  let add = 1;
  while ([0, 6].includes(at(9, 0, add).getDay())) add++;
  opts.push({ key: 'next', label: add === 1 ? 'Amanhã às 9h' : `${at(9, 0, add).toLocaleDateString('pt-BR', { weekday: 'long' })} às 9h`, at: at(9, 0, add) });
  return opts;
}

function StaffPanel({ ticket, me, act }) {
  const [mode, setMode] = useState(null); // 'resolve' | 'visit'
  const [busy, setBusy] = useState(null); // chave do botão em andamento
  const [technicians, setTechnicians] = useState([]);
  const [resolveType, setResolveType] = useState('online');
  const [note, setNote] = useState('');
  const [custom, setCustom] = useState(false);
  const [customAt, setCustomAt] = useState('');
  const [visitNote, setVisitNote] = useState('');
  const [wait, setWait] = useState({ type: 'compra', item: '', due: '', note: '' });
  const openWait = (editing) => {
    setWait(
      editing
        ? { type: ticket.pending_type || 'compra', item: ticket.pending_item || '', due: ticket.pending_due || '', note: '' }
        : { type: 'compra', item: '', due: addDaysYmd(3), note: '' }
    );
    setMode('wait');
  };
  const isAdmin = me.role === 'admin';
  const active = ACTIVE.includes(ticket.status);
  const canHandle = !ticket.technician_id || ticket.technician_id === me.id || isAdmin;
  const unclassified = ticket.category === UNCLASSIFIED;

  useEffect(() => {
    if (isAdmin) api('/users/technicians').then(setTechnicians).catch(() => {});
  }, [isAdmin]);

  useEffect(() => {
    setMode(null);
    setCustom(false);
    setResolveType(ticket.status === 'visita_agendada' ? 'presencial' : 'online');
  }, [ticket.status]);

  const run = async (key, ...args) => {
    setBusy(key);
    const ok = await act(...args);
    setBusy(null);
    if (ok) {
      setMode(null);
      setNote('');
      setVisitNote('');
      setCustom(false);
    }
    return ok;
  };
  const schedule = (key, date) => run(key, '/visit', { visit_at: date.toISOString(), note: visitNote });

  if (!active && ticket.status !== 'resolvido') return null;

  if (ticket.status === 'resolvido')
    return (
      <div className="card side-card">
        <h3 className="side-title">Atendimento</h3>
        <button className="btn btn-ghost btn-block" disabled={!!busy} onClick={() => run('reopen', '/reopen', {})}>
          Reabrir chamado
        </button>
      </div>
    );

  return (
    <div className="card side-card">
      <h3 className="side-title">Atendimento</h3>

      {ticket.technician_id !== me.id && (
        <button className="btn btn-primary btn-block btn-lg" disabled={!!busy} onClick={() => run('assign', '/assign', {})}>
          {busy === 'assign' ? <Spinner /> : ticket.technician_id ? 'Assumir para mim' : 'Assumir chamado'}
        </button>
      )}

      {/* Classificação: o técnico decide a categoria */}
      <div className={`classify ${unclassified ? 'classify-pending' : ''}`}>
        <span className="classify-label">
          {Icons.tag} {unclassified ? 'Classifique este chamado' : 'Categoria'}
        </span>
        <div className="chip-grid chip-grid-sm">
          {CATEGORIES.filter((c) => c !== UNCLASSIFIED).map((c) => (
            <button
              key={c}
              className={`chip chip-sm ${ticket.category === c ? 'chip-on' : ''}`}
              disabled={!!busy}
              onClick={() => ticket.category !== c && run('cat', '', { category: c }, 'PATCH')}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {canHandle && !mode && ticket.status === 'aguardando' && (
        <div className="pending-actions">
          <button className="btn btn-primary btn-block btn-lg" disabled={!!busy} onClick={() => run('resume', '/resume', {})}>
            {busy === 'resume' ? <Spinner /> : <>{Icons.check} {ticket.pending_type === 'compra' ? 'Chegou, retomar atendimento' : 'Serviço feito, retomar'}</>}
          </button>
          <button className="btn btn-ghost btn-block" onClick={() => openWait(true)}>
            {Icons.calendar} Mudar prazo ou item
          </button>
        </div>
      )}

      {canHandle && !mode && (
        <div className="resolve-choices">
          {ticket.status !== 'aguardando' && (
            <button className="choice choice-wait" onClick={() => openWait(false)}>
              <span className="choice-icon tone-pink">{Icons.box}</span>
              <span>
                <b>Precisa comprar ou terceirizar</b>
                <small>Registrar o item ou serviço e o prazo</small>
              </span>
            </button>
          )}
          <button className="choice" onClick={() => setMode('resolve')}>
            <span className="choice-icon tone-green">{Icons.check}</span>
            <span>
              <b>Resolvido</b>
              <small>À distância ou já fui até lá</small>
            </span>
          </button>
          <button className="choice" onClick={() => setMode('visit')}>
            <span className="choice-icon tone-violet">{Icons.walk}</span>
            <span>
              <b>{ticket.status === 'visita_agendada' ? 'Mudar horário da visita' : 'Vou até lá'}</b>
              <small>{ticket.location || 'Ir até o colaborador'}</small>
            </span>
          </button>
        </div>
      )}

      {mode === 'wait' && (
        <div className="inline-form pop-in">
          <div className="segmented segmented-block">
            {Object.entries(PENDING).map(([k, p]) => (
              <button key={k} className={wait.type === k ? 'active' : ''} onClick={() => setWait((w) => ({ ...w, type: k }))}>
                {k === 'compra' ? Icons.box : Icons.truck} {p.label}
              </button>
            ))}
          </div>
          <label className="field">
            <span>{PENDING[wait.type].item}</span>
            <input value={wait.item} onChange={(e) => setWait((w) => ({ ...w, item: e.target.value }))} placeholder={PENDING[wait.type].placeholder} autoFocus />
          </label>
          <div className="field">
            <span>Prazo para chegar</span>
            <div className="due-chips">
              {DUE_SHORTCUTS.map((d) => {
                const v = addDaysYmd(d.days);
                return (
                  <button key={d.days} className={`chip chip-sm ${wait.due === v ? 'chip-on' : ''}`} onClick={() => setWait((w) => ({ ...w, due: v }))}>
                    {d.label}
                  </button>
                );
              })}
            </div>
            <input type="date" min={todayYmd()} value={wait.due} onChange={(e) => setWait((w) => ({ ...w, due: e.target.value }))} />
            {wait.due && <small className="hint pop-in" key={wait.due}>Previsto para {fmtDay(wait.due)}, {dueInfo(wait.due)?.text}</small>}
          </div>
          <input
            className="note-input"
            placeholder="Observação para o colaborador (opcional)"
            value={wait.note}
            onChange={(e) => setWait((w) => ({ ...w, note: e.target.value }))}
          />
          <div className="row-actions">
            <button className="btn btn-ghost" onClick={() => setMode(null)}>
              Voltar
            </button>
            <button
              className="btn btn-primary"
              disabled={!!busy || wait.item.trim().length < 2 || !wait.due}
              onClick={() => run('wait', '/wait', wait)}
            >
              {busy === 'wait' ? <Spinner /> : ticket.status === 'aguardando' ? 'Salvar' : 'Registrar pendência'}
            </button>
          </div>
        </div>
      )}

      {mode === 'visit' && (
        <div className="inline-form pop-in">
          <span className="muted small">Quando você vai? Um clique e o colaborador já é avisado.</span>
          <div className="when-grid">
            {visitShortcuts().map((o) => (
              <button
                key={o.key}
                className={`when ${o.main ? 'when-main' : ''}`}
                disabled={!!busy}
                onClick={() => schedule(o.key, o.at)}
              >
                {busy === o.key ? <Spinner /> : o.icon}
                <span>{o.label}</span>
              </button>
            ))}
            <button className={`when ${custom ? 'when-on' : ''}`} onClick={() => setCustom((c) => !c)}>
              {Icons.calendar}
              <span>Outro horário</span>
            </button>
          </div>
          {custom && (
            <div className="custom-when pop-in">
              <input type="datetime-local" value={customAt} onChange={(e) => setCustomAt(e.target.value)} />
              <button className="btn btn-primary" disabled={!customAt || !!busy} onClick={() => schedule('custom', new Date(customAt))}>
                Agendar
              </button>
            </div>
          )}
          <input
            className="note-input"
            placeholder="Recado para o colaborador (opcional)"
            value={visitNote}
            onChange={(e) => setVisitNote(e.target.value)}
          />
          <button className="btn btn-link" onClick={() => setMode(null)}>
            Voltar
          </button>
        </div>
      )}

      {mode === 'resolve' && (
        <div className="inline-form pop-in">
          <div className="segmented segmented-block">
            <button className={resolveType === 'online' ? 'active' : ''} onClick={() => setResolveType('online')}>
              À distância
            </button>
            <button className={resolveType === 'presencial' ? 'active' : ''} onClick={() => setResolveType('presencial')}>
              Presencial
            </button>
          </div>
          <textarea rows={3} placeholder="O que você fez para resolver?" value={note} onChange={(e) => setNote(e.target.value)} autoFocus />
          <div className="row-actions">
            <button className="btn btn-ghost" onClick={() => setMode(null)}>
              Voltar
            </button>
            <button
              className="btn btn-primary"
              disabled={!!busy || note.trim().length < 3}
              onClick={() => run('resolve', '/resolve', { resolution_type: resolveType, note })}
            >
              {busy === 'resolve' ? <Spinner /> : 'Marcar como resolvido'}
            </button>
          </div>
        </div>
      )}

      <div className="split-fields">
        <label className="field field-inline">
          <span>Prioridade</span>
          <select value={ticket.priority} disabled={!!busy} onChange={(e) => run('prio', '', { priority: e.target.value }, 'PATCH')}>
            {Object.entries(PRIORITY).map(([k, p]) => (
              <option key={k} value={k}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        {isAdmin && technicians.length > 0 && (
          <label className="field field-inline">
            <span>Técnico</span>
            <select
              value={ticket.technician_id ?? ''}
              disabled={!!busy}
              onChange={(e) => e.target.value && run('assign', '/assign', { technician_id: Number(e.target.value) })}
            >
              <option value="">Ninguém</option>
              {technicians.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <button
        className="btn btn-link btn-danger-link"
        disabled={!!busy}
        onClick={() => {
          const r = window.prompt('Cancelar este chamado? Informe o motivo (ex.: duplicado).');
          if (r !== null) run('cancel', '/cancel', { reason: r });
        }}
      >
        Cancelar chamado
      </button>
    </div>
  );
}

function DetailsCard({ ticket }) {
  const rows = [
    ['Quem abriu', <>{ticket.requester_name}<small>{[ticket.requester_department, ticket.requester_email].filter(Boolean).join(', ')}</small></>],
    ['Local', ticket.location || '—'],
    ['Técnico', ticket.technician_name || 'Ninguém ainda'],
    ['Aberto', fmtDate(ticket.created_at)],
    ['Atualizado', fmtDate(ticket.updated_at)],
  ];
  return (
    <div className="card side-card">
      <h3 className="side-title">Detalhes</h3>
      <dl className="details">
        {rows.map(([k, v]) => (
          <Fragment key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </Fragment>
        ))}
      </dl>
    </div>
  );
}
