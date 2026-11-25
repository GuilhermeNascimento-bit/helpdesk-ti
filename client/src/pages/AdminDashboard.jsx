import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useSocketEvent } from '../context.jsx';
import { STATUS, UNCLASSIFIED, fmtDuration } from '../constants.js';
import { Avatar, Led, Spinner, Stars } from '../components/ui.jsx';
import { CountUp, DayColumns, Donut, HBars } from '../components/charts.jsx';

export default function AdminDashboard() {
  const [s, setS] = useState(null);
  const [error, setError] = useState('');
  const timer = useRef();

  const load = useCallback(() => api('/stats').then(setS).catch((e) => setError(e.message)), []);
  useEffect(() => {
    load();
  }, [load]);
  useSocketEvent('ticket:updated', ({ event }) => {
    if (event === 'message') return;
    clearTimeout(timer.current);
    timer.current = setTimeout(load, 500);
  });

  if (error) return <div className="page"><div className="alert alert-error">{error}</div></div>;
  if (!s) return <div className="center-pad"><Spinner /></div>;

  const active = (s.byStatus.aberto || 0) + (s.byStatus.em_atendimento || 0) + (s.byStatus.visita_agendada || 0);
  const total = Object.values(s.byStatus).reduce((a, b) => a + b, 0);

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Painel</h1>
          <p className="muted">Como está o atendimento da T.I, ao vivo. {total} chamados no total.</p>
        </div>
      </header>

      <div className="kpis">
        <Link to="/fila" className={`kpi ${s.queue > 0 ? 'kpi-warn' : ''}`} style={{ '--i': 0 }}>
          <span>Na fila, sem técnico</span>
          <strong><CountUp value={s.queue} /></strong>
          {s.queue > 0 && <small>Ver fila</small>}
        </Link>
        <div className="kpi" style={{ '--i': 1 }}>
          <span>Em andamento</span>
          <strong><CountUp value={active} /></strong>
          {s.urgentActive > 0 && <small className="kpi-alert"><Led tone="red" live /> {s.urgentActive} urgente{s.urgentActive > 1 ? 's' : ''}</small>}
        </div>
        <Link to="/pendencias" className={`kpi ${s.waiting.overdue ? 'kpi-late' : ''}`} style={{ '--i': 2 }}>
          <span>Aguardando compra ou terceiro</span>
          <strong><CountUp value={s.waiting.n} /></strong>
          {s.waiting.overdue > 0 ? <small className="kpi-alert"><Led tone="red" live /> {s.waiting.overdue} com prazo vencido</small> : s.waiting.n > 0 && <small>Ver pendências</small>}
        </Link>
        <div className="kpi" style={{ '--i': 3 }}>
          <span>Tempo médio até resolver</span>
          <strong>{fmtDuration(s.avgResolutionHours)}</strong>
        </div>
        <div className="kpi" style={{ '--i': 4 }}>
          <span>Satisfação</span>
          <strong>{s.rating.avg ? <CountUp value={s.rating.avg} decimals={1} /> : '—'}</strong>
          {s.rating.n > 0 && <small>{s.rating.n} avaliações</small>}
        </div>
      </div>

      <div className="dash-grid dash-grid-3">
        <section className="card dash-card">
          <h3>Chamados abertos por dia</h3>
          <p className="muted small">Últimos 14 dias</p>
          <DayColumns daily={s.daily} since={s.since} />
        </section>

        <section className="card dash-card">
          <h3>Resolvidos à distância</h3>
          <p className="muted small">Quanto menos visitas, mais rápido</p>
          <Donut a={s.resolution.online || 0} b={s.resolution.presencial || 0} labelA="À distância" labelB="Presencial" />
        </section>

        <section className="card dash-card">
          <h3>Por status</h3>
          <div className="status-list">
            {Object.entries(STATUS).map(([k, v]) => (
              <div key={k} className="status-line">
                <Led tone={v.tone} live={v.live && (s.byStatus[k] || 0) > 0} />
                <span>{v.label}</span>
                <b>{s.byStatus[k] || 0}</b>
              </div>
            ))}
          </div>
        </section>

        <section className="card dash-card">
          <h3>Por categoria</h3>
          <p className="muted small">Definida pelo técnico</p>
          {s.byCategory.length === 0 ? (
            <p className="muted">Sem dados ainda.</p>
          ) : (
            <HBars
              rows={s.byCategory.map((c) => ({
                label: c.category,
                n: c.n,
                color: c.category === UNCLASSIFIED ? 'var(--line-strong)' : undefined,
              }))}
            />
          )}
        </section>

        <section className="card dash-card dash-span-2">
          <h3>Equipe técnica</h3>
          <table className="table">
            <thead>
              <tr>
                <th>Técnico</th>
                <th className="num">Em andamento</th>
                <th className="num">Resolvidos</th>
                <th className="num">À distância</th>
                <th>Nota</th>
              </tr>
            </thead>
            <tbody>
              {s.technicians.map((t) => (
                <tr key={t.id}>
                  <td>
                    <span className="user-cell">
                      <Avatar name={t.name} size={26} /> {t.name}
                    </span>
                  </td>
                  <td className="num">{t.active}</td>
                  <td className="num">{t.resolved}</td>
                  <td className="num">{t.resolved ? `${Math.round((t.online / t.resolved) * 100)}%` : '—'}</td>
                  <td>
                    {t.rating ? (
                      <span className="rating-cell">
                        <Stars value={Math.round(t.rating)} size={13} /> {t.rating.toFixed(1).replace('.', ',')}
                      </span>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}
