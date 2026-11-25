import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { setLanguage } from './i18n.js';

/**
 * Preferências visuais guardadas no navegador:
 *  - theme:  'light' | 'dark' | 'system'
 *  - lang:   'pt' | 'en'
 *  - motion: 'full' (animações e efeitos) | 'lite' (sem animações)
 */
const KEY = 'helpdesk_prefs';
export const DEFAULT_ACCENT = '#0e7c74';
const DEFAULTS = { theme: 'system', lang: 'pt', motion: 'full', accent: DEFAULT_ACCENT };

/** Cores prontas para a personalização. */
export const ACCENTS = [
  { value: DEFAULT_ACCENT, label: 'Petróleo' },
  { value: '#2563eb', label: 'Azul' },
  { value: '#4f46e5', label: 'Índigo' },
  { value: '#7c3aed', label: 'Roxo' },
  { value: '#db2777', label: 'Rosa' },
  { value: '#dc2626', label: 'Vermelho' },
  { value: '#ea580c', label: 'Laranja' },
  { value: '#ca8a04', label: 'Mostarda' },
  { value: '#16a34a', label: 'Verde' },
  { value: '#475569', label: 'Grafite' },
];

/** Deriva toda a paleta (botões, destaques, barra lateral, painéis escuros) da cor escolhida. */
function applyAccent(root, accent, dark) {
  const a = /^#[0-9a-f]{6}$/i.test(accent || '') ? accent : DEFAULT_ACCENT;
  const set = (k, v) => root.style.setProperty(k, v);
  const mix = (pct, other) => `color-mix(in srgb, ${a} ${pct}%, ${other})`;
  set('--primary', dark ? mix(78, 'white') : a);
  set('--primary-strong', dark ? mix(62, 'white') : mix(80, 'black'));
  set('--primary-soft', dark ? mix(24, '#122125') : mix(13, 'white'));
  set('--accent-2', mix(68, 'white'));
  set('--side', dark ? mix(12, '#060d0f') : mix(22, '#0a1416'));
  set('--side-2', dark ? mix(22, '#0d1a1c') : mix(30, '#132022'));
}

function load() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
  } catch {
    return { ...DEFAULTS };
  }
}

const darkQuery = window.matchMedia?.('(prefers-color-scheme: dark)');
const reducedQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)');

function apply(p) {
  const root = document.documentElement;
  const dark = p.theme === 'dark' || (p.theme === 'system' && darkQuery?.matches);
  const next = dark ? 'dark' : 'light';
  if (root.dataset.theme && root.dataset.theme !== next) {
    root.classList.add('theme-switching');
    setTimeout(() => root.classList.remove('theme-switching'), 450);
  }
  root.dataset.theme = next;
  root.style.colorScheme = dark ? 'dark' : 'light';
  applyAccent(root, p.accent, dark);
  root.dataset.motion = p.motion === 'lite' || reducedQuery?.matches ? 'lite' : 'full';
}

// Aplica antes do React desenhar, para não piscar o tema errado
const initial = load();
apply(initial);

export const isLite = () => document.documentElement.dataset.motion === 'lite';

const PrefsCtx = createContext(null);
export const usePrefs = () => useContext(PrefsCtx);

export function PrefsProvider({ children }) {
  const [prefs, setPrefs] = useState(initial);

  useEffect(() => {
    apply(prefs);
    localStorage.setItem(KEY, JSON.stringify(prefs));
  }, [prefs]);

  // idioma: aplicado depois que a tela existe
  useEffect(() => {
    setLanguage(prefs.lang);
  }, [prefs.lang]);

  useEffect(() => {
    const re = () => apply(prefs);
    darkQuery?.addEventListener?.('change', re);
    reducedQuery?.addEventListener?.('change', re);
    return () => {
      darkQuery?.removeEventListener?.('change', re);
      reducedQuery?.removeEventListener?.('change', re);
    };
  }, [prefs]);

  useFullEffects();

  const set = (k, v) => setPrefs((p) => ({ ...p, [k]: v }));
  return <PrefsCtx.Provider value={{ prefs, set }}>{children}</PrefsCtx.Provider>;
}

/** Efeitos do modo completo: ondinha ao clicar e brilho que segue o mouse nos cartões. */
function useFullEffects() {
  useEffect(() => {
    const RIPPLE = '.btn, .chip, .choice, .when, .prio-option, .segmented button, .nav-item, .icon-btn';
    const GLOW = '.tcard, .kpi, .aside-block, .side-card, .review, .dash-card, .login-card, .story, .prefs-pop';

    const onDown = (e) => {
      if (isLite()) return;
      const el = e.target.closest(RIPPLE);
      if (!el || el.disabled) return;
      const r = el.getBoundingClientRect();
      const s = document.createElement('span');
      const size = Math.max(r.width, r.height) * 2;
      s.className = 'ripple';
      s.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - r.left - size / 2}px;top:${e.clientY - r.top - size / 2}px`;
      el.appendChild(s);
      setTimeout(() => s.remove(), 650);
    };
    let last;
    const onMove = (e) => {
      if (isLite()) return;
      const el = e.target.closest?.(GLOW);
      if (last && last !== el) last.classList.remove('glowing');
      last = el;
      if (!el) return;
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', `${e.clientX - r.left}px`);
      el.style.setProperty('--my', `${e.clientY - r.top}px`);
      el.classList.add('glowing');
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('pointermove', onMove);
    };
  }, []);
}

/* ---------------- Controles ---------------- */

const Sun = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
  </svg>
);
const Moon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
  </svg>
);
const Sliders = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
    <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" />
  </svg>
);
const Sparkle = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 3l1.9 5.6L19.5 10.5l-5.6 1.9L12 18l-1.9-5.6L4.5 10.5l5.6-1.9z" />
  </svg>
);
const Feather = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5zM16 8 2 22M17.5 15H9" />
  </svg>
);

function Segment({ value, onChange, options }) {
  return (
    <div className="segmented segmented-block prefs-seg">
      {options.map((o) => (
        <button key={o.value} type="button" className={value === o.value ? 'active' : ''} onClick={() => onChange(o.value)} title={o.hint}>
          {o.icon}
          <span>{o.label}</span>
        </button>
      ))}
    </div>
  );
}

/** Painel com tema, idioma e modo de visual. */
export function PrefsPanel() {
  const { prefs, set } = usePrefs();
  return (
    <div className="prefs-panel">
      <div className="prefs-row">
        <span>Tema</span>
        <Segment
          value={prefs.theme}
          onChange={(v) => set('theme', v)}
          options={[
            { value: 'light', label: 'Claro', icon: <Sun /> },
            { value: 'dark', label: 'Escuro', icon: <Moon /> },
            { value: 'system', label: 'Sistema', hint: 'Segue o tema do computador' },
          ]}
        />
      </div>
      <div className="prefs-row">
        <span>Idioma</span>
        <Segment
          value={prefs.lang}
          onChange={(v) => set('lang', v)}
          options={[
            { value: 'pt', label: 'Português' },
            { value: 'en', label: 'English' },
          ]}
        />
      </div>
      <div className="prefs-row">
        <span>Cor do site</span>
        <div className="swatches" role="radiogroup" aria-label="Cor do site">
          {ACCENTS.map((c) => (
            <button
              key={c.value}
              type="button"
              className={`swatch ${prefs.accent === c.value ? 'on' : ''}`}
              style={{ '--sw': c.value }}
              onClick={() => set('accent', c.value)}
              title={c.label}
              aria-label={c.label}
              aria-checked={prefs.accent === c.value}
              role="radio"
            />
          ))}
          <label
            className={`swatch swatch-custom ${ACCENTS.some((c) => c.value === prefs.accent) ? '' : 'on'}`}
            title="Escolher outra cor"
            style={{ '--sw': ACCENTS.some((c) => c.value === prefs.accent) ? 'transparent' : prefs.accent }}
          >
            <input type="color" value={prefs.accent} onChange={(e) => set('accent', e.target.value)} aria-label="Escolher outra cor" />
          </label>
        </div>
        <small className="prefs-hint">
          {ACCENTS.find((c) => c.value === prefs.accent)?.label || 'Cor personalizada'}
          {prefs.accent !== DEFAULT_ACCENT && (
            <>
              {' · '}
              <button type="button" className="btn-link prefs-reset" onClick={() => set('accent', DEFAULT_ACCENT)}>
                voltar ao padrão
              </button>
            </>
          )}
        </small>
      </div>
      <div className="prefs-row">
        <span>Visual</span>
        <Segment
          value={prefs.motion}
          onChange={(v) => set('motion', v)}
          options={[
            { value: 'full', label: 'Completo', icon: <Sparkle />, hint: 'Animações, efeitos e transições' },
            { value: 'lite', label: 'Leve', icon: <Feather />, hint: 'Sem animações nem efeitos, mais rápido' },
          ]}
        />
        <small className="prefs-hint">{prefs.motion === 'full' ? 'Animações, efeitos e transições' : 'Sem animações nem efeitos, mais rápido'}</small>
      </div>
    </div>
  );
}

/** Botão que abre o painel de preferências num balão. */
export function PrefsButton({ placement = 'down', className = '' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef();
  useEffect(() => {
    if (!open) return;
    const close = (e) => !ref.current?.contains(e.target) && setOpen(false);
    const esc = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);
  return (
    <div className={`prefs ${className}`} ref={ref}>
      <button type="button" className={`icon-btn ${open ? 'is-on' : ''}`} onClick={() => setOpen((o) => !o)} title="Preferências" aria-expanded={open}>
        <Sliders />
      </button>
      {open && (
        <div className={`prefs-pop prefs-${placement}`} role="dialog" aria-label="Preferências">
          <strong className="prefs-title">Preferências</strong>
          <PrefsPanel />
        </div>
      )}
    </div>
  );
}

/** Atalhos compactos (usado no login): tema e idioma com um clique. */
export function QuickPrefs() {
  const { prefs, set } = usePrefs();
  const dark = prefs.theme === 'dark' || (prefs.theme === 'system' && !!darkQuery?.matches);
  return (
    <div className="quick-prefs">
      <button type="button" className="qp-btn" onClick={() => set('theme', dark ? 'light' : 'dark')} title={dark ? 'Claro' : 'Escuro'}>
        <span className={`qp-icon ${dark ? 'is-dark' : ''}`}>{dark ? <Moon /> : <Sun />}</span>
      </button>
      <button type="button" className="qp-btn qp-lang" onClick={() => set('lang', prefs.lang === 'en' ? 'pt' : 'en')} data-no-i18n>
        <span className={prefs.lang === 'pt' ? 'on' : ''}>PT</span>
        <span className={prefs.lang === 'en' ? 'on' : ''}>EN</span>
      </button>
      <button
        type="button"
        className="qp-btn"
        onClick={() => set('motion', prefs.motion === 'full' ? 'lite' : 'full')}
        title={prefs.motion === 'full' ? 'Completo' : 'Leve'}
      >
        {prefs.motion === 'full' ? <Sparkle /> : <Feather />}
      </button>
      <PrefsButton placement="down-end" />
    </div>
  );
}
