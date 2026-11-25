import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth, useSocketEvent } from '../context.jsx';
import { ACTIVE, PENDING, dueInfo, firstName, fmtDateOnly, fmtDay, greeting, timeAgo } from '../constants.js';
import { Avatar, Empty, Icons, ProgressTrack, Stars, StatusBadge } from '../components/ui.jsx';

const EXAMPLES = ['A internet não está funcionando', 'Esqueci minha senha', 'A impressora não imprime', 'O computador está lento'];

/** Tela inicial do colaborador: pedir ajuda rápido + acompanhar o que já pediu. */
export default function MyTickets() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tickets, setTickets] = useState(null);
  const [ask, setAsk] = useState('');
  const changed = useRef({});

  const load = useCallback(() => {
    api('/tickets?scope=requested')
      .then(setTickets)
      .catch(() => setTickets([]));
  }, []);
  useEffect(load, [load]);
  useSocketEvent('ticket:updated', ({ ticket }) => {
    changed.current[ticket.id] = Date.now();
    load();
  });

  const start = (text) => navigate('/chamados/novo', { state: { description: text } });

  const active = tickets?.filter((t) => ACTIVE.includes(t.status)) ?? [];
  const toConfirm = tickets?.filter((t) => t.status === 'resolvido') ?? [];
  const history = tickets?.filter((t) => ['fechado', 'cancelado'].includes(t.status)).slice(0, 8) ?? [];
  const isFresh = (id) => Date.now() - (changed.current[id] || 0) < 2000;

  return (
    <div className="page page-home">
      <section className="ask">
        <div className="ask-head">
          <h1>
            {greeting()}, {firstName(user.name)}.
          </h1>
          <p>Algo não está funcionando? Conte aqui e a T.I recebe na hora.</p>
        </div>
        <form
          className="ask-box"
          onSubmit={(e) => {
            e.preventDefault();
            start(ask);
          }}
        >
          <input value={ask} onChange={(e) => setAsk(e.target.value)} placeholder="Ex.: minha internet caiu e não consigo abrir o sistema" />
          <button className="btn btn-primary">
            Continuar {Icons.send}
          </button>
        </form>
        <div className="ask-examples">
          {EXAMPLES.map((ex) => (
            <button key={ex} type="button" className="chip chip-dark" onClick={() => start(ex + '. ')}>
              {ex}
            </button>
          ))}
        </div>
      </section>

      {tickets && toConfirm.length > 0 && (
        <section className="group">
          <h2 className="group-title">
            Esperando sua confirmação <span className="count">{toConfirm.length}</span>
          </h2>
          <div className="card-grid">
            {toConfirm.map((t, i) => (
              <Link key={t.id} to={`/chamados/${t.id}`} className="tcard tcard-confirm" style={{ '--i': i }}>
                <div className="tcard-top">
                  <span className="ticket-id">#{t.id}</span>
                  <StatusBadge status={t.status} />
                </div>
                <strong className="tcard-title">{t.title}</strong>
                <p className="tcard-note">
                  {firstName(t.technician_name)} marcou como resolvido. Funcionou?
                </p>
                <span className="tcard-cta">
                  <Stars value={0} size={16} /> Avaliar e encerrar
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {tickets?.length !== 0 && (
      <section className="group">
        <h2 className="group-title">
          Em andamento {tickets && <span className="count">{active.length}</span>}
        </h2>
        {!tickets ? (
          <div className="card-grid">
            {[0, 1, 2].map((i) => (
              <div key={i} className="tcard tcard-skeleton" style={{ '--i': i }}>
                <span className="sk sk-meta" />
                <span className="sk sk-title" />
                <span className="sk" />
              </div>
            ))}
          </div>
        ) : active.length === 0 ? (
          <div className="calm">
            <span className="calm-icon">{Icons.check}</span>
            <div>
              <strong>Nada pendente</strong>
              <p className="muted">Quando você abrir um chamado, ele aparece aqui com cada passo do atendimento.</p>
            </div>
          </div>
        ) : (
          <div className="card-grid">
            {active.map((t, i) => (
              <Link key={t.id} to={`/chamados/${t.id}`} className={`tcard ${isFresh(t.id) ? 'is-changed' : ''}`} style={{ '--i': i }}>
                <div className="tcard-top">
                  <span className="ticket-id">#{t.id}</span>
                  <StatusBadge status={t.status} />
                  <span className="tcard-time">{timeAgo(t.updated_at)}</span>
                </div>
                <strong className="tcard-title">{t.title}</strong>
                <ProgressTrack ticket={t} size="sm" />
                {t.status === 'aguardando' && (
                  <div className={`tcard-pending ${dueInfo(t.pending_due)?.overdue ? 'is-overdue' : ''}`}>
                    {t.pending_type === 'compra' ? Icons.box : Icons.truck}
                    <span>
                      {PENDING[t.pending_type]?.waiting}: <b>{t.pending_item}</b>
                    </span>
                    <small>até {fmtDay(t.pending_due)}</small>
                  </div>
                )}
                <div className="tcard-foot">
                  {t.technician_name ? (
                    <>
                      <Avatar name={t.technician_name} src={t.technician_avatar} size={24} />
                      <span>
                        {t.status === 'visita_agendada' ? `${firstName(t.technician_name)} vai até você` : `${firstName(t.technician_name)} está cuidando`}
                      </span>
                    </>
                  ) : (
                    <span className="muted">Na fila, esperando um técnico</span>
                  )}
                  {t.message_count > 0 && (
                    <span className="meta-msgs">
                      {Icons.chat} {t.message_count}
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
      )}

      {history.length > 0 && (
        <section className="group">
          <h2 className="group-title">Histórico</h2>
          <div className="history card">
            {history.map((t) => (
              <Link key={t.id} to={`/chamados/${t.id}`} className="history-row">
                <span className="ticket-id">#{t.id}</span>
                <span className="history-title">{t.title}</span>
                <span className="history-who">{t.technician_name ? firstName(t.technician_name) : '—'}</span>
                {t.rating ? <Stars value={t.rating} size={13} /> : <StatusBadge status={t.status} />}
                <span className="muted small">{fmtDateOnly(t.closed_at || t.updated_at)}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {tickets?.length === 0 && (
        <Empty icon={Icons.chat} title="Você ainda não abriu nenhum chamado">
          Use a caixa lá em cima: descreva o problema do seu jeito.
        </Empty>
      )}
    </div>
  );
}
