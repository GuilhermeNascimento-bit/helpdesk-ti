import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth, useSocketEvent } from '../context.jsx';
import { firstName, fmtDuration, timeAgo } from '../constants.js';
import { Empty, Icons, Spinner, Stars } from '../components/ui.jsx';
import { CountUp, DayColumns, Donut, HBars } from '../components/charts.jsx';

export default function TechStats() {
  const { user } = useAuth();
  const [s, setS] = useState(null);
  const [error, setError] = useState('');
  const timer = useRef();

  const load = useCallback(() => api('/stats/me').then(setS).catch((e) => setError(e.message)), []);
  useEffect(() => {
    load();
  }, [load]);
  useSocketEvent('ticket:updated', ({ ticket, event }) => {
    if (event === 'message' || ticket.technician_id !== user.id) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(load, 400);
  });

  if (error) return <div className="page"><div className="alert alert-error">{error}</div></div>;
  if (!s) return <div className="center-pad"><Spinner /></div>;

  const t = s.totals;
  const month = new Date().toLocaleDateString('pt-BR', { month: 'long' });

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Meu desempenho</h1>
          <p className="muted">Seus atendimentos, {firstName(user.name)}. Atualiza sozinho a cada chamado.</p>
        </div>
      </header>

      {t.handled === 0 ? (
        <Empty icon={Icons.trophy} title="Nenhum atendimento ainda" action={<Link className="btn btn-primary" to="/fila">Ver a fila</Link>}>
          Assuma um chamado da fila e seus números aparecem aqui.
        </Empty>
      ) : (
        <>
          <section className="score">
            <div className="score-main">
              <span>Resolvidos em {month}</span>
              <strong><CountUp value={s.thisMonth} /></strong>
            </div>
            <div className="score-stats">
              <div>
                <strong><CountUp value={t.handled} /></strong>
                <span>atendidos no total</span>
              </div>
              <div>
                <strong><CountUp value={t.active ?? 0} /></strong>
                <span>em andamento agora</span>
              </div>
              <div>
                <strong>{fmtDuration(t.avg_hours)}</strong>
                <span>tempo médio até resolver</span>
              </div>
            </div>
            <div className="score-rating">
              <strong>{t.rating ? <CountUp value={t.rating} decimals={1} /> : '—'}</strong>
              <Stars value={Math.round(t.rating || 0)} size={18} />
              <span>{t.ratings} {t.ratings === 1 ? 'avaliação' : 'avaliações'}</span>
            </div>
          </section>

          <div className="dash-grid dash-grid-3">
            <section className="card dash-card">
              <h3>Resolvidos por dia</h3>
              <p className="muted small">Últimos 14 dias</p>
              <DayColumns daily={s.daily} since={s.since} label="resolvido(s)" />
            </section>

            <section className="card dash-card">
              <h3>Como você resolveu</h3>
              <p className="muted small">Chamados resolvidos e fechados</p>
              <Donut a={t.online ?? 0} b={t.presencial ?? 0} labelA="À distância" labelB="Presencial" />
            </section>

            <section className="card dash-card">
              <h3>Suas notas</h3>
              <p className="muted small">Quantas vezes recebeu cada nota</p>
              <HBars
                labelWidth={70}
                rows={[5, 4, 3, 2, 1].map((n) => ({
                  label: '★'.repeat(n),
                  n: s.distribution[n] || 0,
                  color: n >= 4 ? 'var(--led-green)' : n === 3 ? 'var(--led-amber)' : 'var(--led-red)',
                }))}
              />
            </section>

            <section className="card dash-card dash-wide">
              <h3>O que disseram</h3>
              {s.reviews.length === 0 ? (
                <p className="muted">Quando os colaboradores avaliarem seus atendimentos, os comentários aparecem aqui.</p>
              ) : (
                <div className="reviews">
                  {s.reviews.map((r, i) => (
                    <Link to={`/chamados/${r.id}`} className="review" key={r.id} style={{ '--i': i }}>
                      <Stars value={r.rating} size={14} />
                      <p>{r.rating_comment ? `“${r.rating_comment}”` : <span className="muted">Sem comentário</span>}</p>
                      <span className="muted small">
                        {r.requester_name}, #{r.id} {timeAgo(r.closed_at)}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
