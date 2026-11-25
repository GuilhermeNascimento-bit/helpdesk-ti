import { useNavigate } from 'react-router-dom';
import { STATUS, PRIORITY, initials } from '../constants.js';
import { useToast } from '../context.jsx';

export const Badge = ({ tone = 'gray', children, className = '' }) => (
  <span className={`badge tone-${tone} ${className}`}>{children}</span>
);

/** Luzinha de status: pisca enquanto o chamado está vivo. */
export const Led = ({ tone, live }) => <i className={`led led-${tone} ${live ? 'led-live' : ''}`} aria-hidden="true" />;

export const StatusBadge = ({ status }) => {
  const s = STATUS[status] ?? { label: status, tone: 'gray' };
  return (
    <span className={`badge tone-${s.tone}`} key={status}>
      <Led tone={s.tone} live={s.live} />
      <span className="badge-swap">{s.label}</span>
    </span>
  );
};

export const PriorityBadge = ({ priority }) => (
  <Badge tone={PRIORITY[priority]?.tone}>
    <PriorityIcon priority={priority} /> {PRIORITY[priority]?.label ?? priority}
  </Badge>
);

export function PriorityIcon({ priority }) {
  const level = { baixa: 1, media: 2, alta: 3, urgente: 4 }[priority] ?? 1;
  return (
    <svg className="prio-icon" viewBox="0 0 12 12" aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x={i * 3} y={9 - i * 2.5} width="2" height={3 + i * 2.5} rx="0.6" opacity={i < level ? 1 : 0.22} />
      ))}
    </svg>
  );
}

const AVATAR_HUES = [172, 205, 260, 330, 28, 95, 190, 240];
export const Avatar = ({ name = '', size = 32 }) => {
  const hue = AVATAR_HUES[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_HUES.length];
  return (
    <span
      className="avatar"
      style={{ width: size, height: size, fontSize: size * 0.38, '--h': hue }}
      title={name}
    >
      {initials(name)}
    </span>
  );
};

/* ---------- Trilha de progresso do chamado ---------- */
const TRACK_LABEL = {
  aberto: 'Aberto',
  em_atendimento: 'Com técnico',
  aguardando: 'Aguardando',
  visita_agendada: 'Visita',
  resolvido: 'Resolvido',
  fechado: 'Fechado',
};

export function ProgressTrack({ ticket, compact = false, size }) {
  const hasVisit = ticket.status === 'visita_agendada' || ticket.visit_at || ticket.resolution_type === 'presencial';
  const hasWait = ticket.status === 'aguardando' || ticket.pending_type;
  const steps = ['aberto', 'em_atendimento', ...(hasWait ? ['aguardando'] : []), ...(hasVisit ? ['visita_agendada'] : []), 'resolvido', 'fechado'];
  const cancelled = ticket.status === 'cancelado';
  const finished = ticket.status === 'fechado';
  const idx = cancelled ? 0 : finished ? steps.length : Math.max(0, steps.indexOf(ticket.status));
  const pct = (Math.min(idx, steps.length - 1) / (steps.length - 1)) * 100;
  const tone = STATUS[ticket.status]?.tone ?? 'gray';

  return (
    <div
      className={`track ${compact ? 'track-compact' : ''} ${size ? `track-${size}` : ''} ${cancelled ? 'track-cancelled' : ''} track-${tone}`}
      style={{ '--p': `${pct}%` }}
      role="img"
      aria-label={`Andamento: ${STATUS[ticket.status]?.label}`}
    >
      <div className="track-line">
        <div className="track-fill" />
      </div>
      {steps.map((s, i) => (
        <div key={s} className={`track-step ${i < idx ? 'done' : ''} ${i === idx && !cancelled ? 'current' : ''}`}>
          <span className="track-dot">{i < idx && <CheckGlyph />}</span>
          {!compact && <span className="track-label">{TRACK_LABEL[s]}</span>}
        </div>
      ))}
    </div>
  );
}

const CheckGlyph = () => (
  <svg viewBox="0 0 12 12" aria-hidden="true">
    <path d="M2.5 6.2 5 8.6l4.5-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export function Stars({ value = 0, onChange, size = 22 }) {
  return (
    <div className={`stars ${onChange ? 'stars-input' : ''}`} role={onChange ? 'radiogroup' : undefined}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={!onChange}
          className={n <= value ? 'on' : ''}
          onClick={() => onChange?.(n)}
          aria-label={`${n} estrela${n > 1 ? 's' : ''}`}
          style={{ fontSize: size, '--d': `${n * 40}ms` }}
        >
          ★
        </button>
      ))}
    </div>
  );
}

export const Spinner = () => <span className="spinner" aria-label="Carregando" />;

export const SkeletonRows = ({ n = 5 }) => (
  <div className="ticket-list" aria-busy="true">
    {Array.from({ length: n }, (_, i) => (
      <div key={i} className="skeleton-row" style={{ '--i': i }}>
        <span className="sk sk-title" />
        <span className="sk sk-meta" />
      </div>
    ))}
  </div>
);

/** Check desenhado: usado nas confirmações. */
export const DrawnCheck = ({ size = 72 }) => (
  <svg className="drawn-check" viewBox="0 0 52 52" width={size} height={size} aria-hidden="true">
    <circle cx="26" cy="26" r="24" />
    <path d="M15 27.5 22.5 35 38 18.5" />
  </svg>
);

/** Explosão de confete leve (CSS puro). */
export function Confetti({ count = 28 }) {
  const colors = ['#0E7C74', '#F2A516', '#2F7BEA', '#8A5CF6', '#2DBE6C', '#E5484D'];
  return (
    <div className="confetti" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => {
        const angle = (i / count) * Math.PI * 2 + Math.random() * 0.4;
        const dist = 70 + Math.random() * 70;
        return (
          <i
            key={i}
            style={{
              '--x': `${Math.cos(angle) * dist}px`,
              '--y': `${Math.sin(angle) * dist - 30}px`,
              '--r': `${Math.random() * 540 - 270}deg`,
              background: colors[i % colors.length],
              animationDelay: `${Math.random() * 80}ms`,
            }}
          />
        );
      })}
    </div>
  );
}

export const Empty = ({ icon = Icons.inbox, title, children, action }) => (
  <div className="empty">
    <div className="empty-icon">{icon}</div>
    <h3>{title}</h3>
    {children && <p>{children}</p>}
    {action}
  </div>
);

export function Toasts() {
  const { toasts, dismiss } = useToast();
  const navigate = useNavigate();
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`toast toast-${t.tone} ${t.to ? 'clickable' : ''} ${t.leaving ? 'leaving' : ''}`}
          style={{ '--ttl': `${t.ttl}ms` }}
          onClick={() => {
            if (t.to) navigate(t.to);
            dismiss(t.id);
          }}
        >
          <span className="toast-icon">{t.tone === 'error' ? Icons.alert : t.tone === 'success' ? Icons.check : Icons.bell}</span>
          <div className="toast-text">
            <strong>{t.title}</strong>
            {t.body && <span>{t.body}</span>}
          </div>
          <i className="toast-timer" />
        </div>
      ))}
    </div>
  );
}

const svg = (d) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {d}
  </svg>
);

export const Icons = {
  inbox: svg(<><path d="M22 12h-6l-2 3h-4l-2-3H2" /><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" /></>),
  list: svg(<><path d="M8 6h13M8 12h13M8 18h13" /><path d="M3 6h.01M3 12h.01M3 18h.01" /></>),
  home: svg(<><path d="m3 10 9-7 9 7v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><path d="M9 22V12h6v10" /></>),
  wrench: svg(<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />),
  plus: svg(<path d="M12 5v14M5 12h14" />),
  chart: svg(<><path d="M3 3v18h18" /><path d="M7 15v2M12 10v7M17 6v11" /></>),
  trophy: svg(<><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18" /><path d="M4 22h16M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" /><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" /></>),
  users: svg(<><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>),
  logout: svg(<><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5M21 12H9" /></>),
  clip: svg(<path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />),
  send: svg(<><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></>),
  back: svg(<path d="m15 18-6-6 6-6" />),
  file: svg(<><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" /><path d="M14 2v6h6" /></>),
  pin: svg(<><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></>),
  calendar: svg(<><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></>),
  clock: svg(<><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></>),
  walk: svg(<><circle cx="13" cy="4" r="2" /><path d="m9 20 3-6 3 2v5M8 11l2-3 4 1 3 3M10 8l-1 6" /></>),
  check: svg(<path d="M20 6 9 17l-5-5" />),
  monitor: svg(<><rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" /></>),
  wifi: svg(<><path d="M5 12.55a11 11 0 0 1 14.08 0M1.42 9a16 16 0 0 1 21.16 0M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01" /></>),
  chat: svg(<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />),
  x: svg(<path d="M18 6 6 18M6 6l12 12" />),
  search: svg(<><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></>),
  bell: svg(<><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></>),
  alert: svg(<><circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" /></>),
  box: svg(<><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" /><path d="m3.3 7 8.7 5 8.7-5M12 22V12" /></>),
  truck: svg(<><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2M15 18H9M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.62l-3.48-4.35A1 1 0 0 0 17.52 8H14" /><circle cx="17" cy="18" r="2" /><circle cx="7" cy="18" r="2" /></>),
  handshake: svg(<><path d="m11 17 2 2a1 1 0 1 0 3-3" /><path d="m14 14 2.5 2.5a1 1 0 1 0 3-3l-3.88-3.88a3 3 0 0 0-4.24 0l-.88.88a1 1 0 1 1-3-3l2.81-2.81a5.79 5.79 0 0 1 7.06-.87l.47.28a2 2 0 0 0 1.42.25L21 4" /><path d="m21 3 1 11h-2M3 3 2 14l6.5 6.5a1 1 0 1 0 3-3M3 4h8" /></>),
  tag: svg(<><path d="M12.59 2.59A2 2 0 0 0 11.17 2H4a2 2 0 0 0-2 2v7.17a2 2 0 0 0 .59 1.42l8.7 8.7a2.43 2.43 0 0 0 3.42 0l6.58-6.58a2.43 2.43 0 0 0 0-3.42z" /><circle cx="7.5" cy="7.5" r=".5" fill="currentColor" /></>),
  image: svg(<><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.09-3.09a2 2 0 0 0-2.82 0L6 21" /></>),
};
