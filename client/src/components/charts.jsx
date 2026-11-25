import { useEffect, useRef, useState } from 'react';

const reduceMotion = () =>
  document.documentElement.dataset.motion === 'lite' || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Número que "sobe" até o valor. */
export function CountUp({ value, decimals = 0, duration = 900, format }) {
  const [shown, setShown] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    if (value == null || Number.isNaN(value)) return;
    if (reduceMotion()) return setShown(value);
    const start = performance.now();
    const a = from.current;
    let raf;
    const tick = (now) => {
      const k = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - k, 3);
      setShown(a + (value - a) * eased);
      if (k < 1) raf = requestAnimationFrame(tick);
      else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  if (value == null || Number.isNaN(value)) return '—';
  const n = Number(shown.toFixed(decimals));
  return format ? format(n) : n.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

/** Colunas por dia (últimos N dias), crescem ao aparecer. */
export function DayColumns({ daily, since, days = 14, label = 'chamado(s)' }) {
  const counts = Object.fromEntries(daily.map((d) => [d.day, d.n]));
  const list = Array.from({ length: days }, (_, i) => {
    const key = new Date(new Date(since).getTime() + i * 864e5).toISOString().slice(0, 10);
    return { key, label: `${key.slice(8, 10)}/${key.slice(5, 7)}`, n: counts[key] || 0 };
  });
  const max = Math.max(1, ...list.map((d) => d.n));
  return (
    <div className="cols">
      {list.map((d, i) => (
        <div className="col" key={d.key} title={`${d.label}: ${d.n} ${label}`}>
          <span className="col-n">{d.n || ''}</span>
          <div className="col-bar" style={{ height: `${(d.n / max) * 100}%`, '--i': i }} />
          <span className="col-label">{i % 2 === days % 2 ? '' : d.label}</span>
        </div>
      ))}
    </div>
  );
}

export function HBars({ rows, labelWidth = 120 }) {
  const max = Math.max(1, ...rows.map((r) => r.n));
  return (
    <div className="hbars">
      {rows.map((r, i) => (
        <div className="hbar" key={r.label} style={{ gridTemplateColumns: `${labelWidth}px 1fr 32px` }}>
          <span className="hbar-label">{r.label}</span>
          <div className="hbar-track">
            <div className="hbar-fill" style={{ width: `${(r.n / max) * 100}%`, '--i': i, background: r.color }} />
          </div>
          <span className="hbar-n">{r.n}</span>
        </div>
      ))}
    </div>
  );
}

/** Rosca de duas partes (online × presencial). */
export function Donut({ a, b, size = 120, labelA, labelB }) {
  const total = a + b;
  const r = 44;
  const c = 2 * Math.PI * r;
  const pa = total ? a / total : 0;
  return (
    <div className="donut-wrap">
      <svg className="donut" viewBox="0 0 100 100" width={size} height={size} style={{ width: size, height: size }} role="img" aria-label={`${labelA}: ${a}, ${labelB}: ${b}`}>
        <circle cx="50" cy="50" r={r} className="donut-bg" />
        {total > 0 && (
          <circle
            cx="50"
            cy="50"
            r={r}
            className="donut-a"
            strokeDasharray={`${pa * c} ${c}`}
            style={{ '--c': c }}
          />
        )}
        <text x="50" y="49" className="donut-pct">{total ? `${Math.round(pa * 100)}%` : '—'}</text>
        <text x="50" y="63" className="donut-sub">{labelA.toLowerCase()}</text>
      </svg>
      <div className="donut-legend">
        <span><i className="sw sw-a" /> {labelA} <b>{a}</b></span>
        <span><i className="sw sw-b" /> {labelB} <b>{b}</b></span>
      </div>
    </div>
  );
}
