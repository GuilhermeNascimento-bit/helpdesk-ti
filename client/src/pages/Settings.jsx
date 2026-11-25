import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth, useToast } from '../context.jsx';
import { ROLE, fmtDateOnly } from '../constants.js';
import { PrefsPanel, ping, usePrefs } from '../prefs.jsx';
import { Avatar, Icons, Spinner } from '../components/ui.jsx';

const SECTIONS = [
  { id: 'perfil', label: 'Perfil', icon: Icons.users, hint: 'Foto, nome, setor e local' },
  { id: 'seguranca', label: 'Segurança', icon: Icons.lock, hint: 'Trocar a senha' },
  { id: 'aparencia', label: 'Aparência', icon: Icons.palette, hint: 'Tema, idioma, cor e visual' },
  { id: 'notificacoes', label: 'Notificações', icon: Icons.bell, hint: 'Avisos, som e Windows' },
];

/** Configurações da própria conta: cada pessoa ajusta o sistema do seu jeito. */
export default function Settings() {
  const { hash } = useLocation();
  const navigate = useNavigate();
  const tab = SECTIONS.some((s) => `#${s.id}` === hash) ? hash.slice(1) : 'perfil';

  return (
    <div className="page settings">
      <header className="page-head">
        <div>
          <h1>Configurações</h1>
          <p className="muted">Ajuste sua conta e o sistema do seu jeito. As mudanças são salvas na hora.</p>
        </div>
      </header>

      <div className="settings-layout">
        <nav className="settings-nav" aria-label="Seções">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              className={`settings-tab ${tab === s.id ? 'active' : ''}`}
              onClick={() => navigate(`#${s.id}`, { replace: true })}
              aria-current={tab === s.id ? 'page' : undefined}
            >
              <span className="settings-tab-icon">{s.icon}</span>
              <span>
                <b>{s.label}</b>
                <small>{s.hint}</small>
              </span>
            </button>
          ))}
        </nav>

        <div className="settings-body" key={tab}>
          {tab === 'perfil' && <ProfileSection />}
          {tab === 'seguranca' && <SecuritySection />}
          {tab === 'aparencia' && <AppearanceSection />}
          {tab === 'notificacoes' && <NotificationsSection />}
        </div>
      </div>
    </div>
  );
}

function Section({ title, sub, children }) {
  return (
    <section className="card settings-card">
      <header>
        <h2>{title}</h2>
        {sub && <p className="muted">{sub}</p>}
      </header>
      {children}
    </section>
  );
}

// ---------------------------------------------------------------- Perfil

function ProfileSection() {
  const { user, updateUser } = useAuth();
  const { push } = useToast();
  const [f, setF] = useState({ name: user.name, department: user.department || '', location: user.location || '' });
  const [busy, setBusy] = useState(null);
  const fileRef = useRef();
  const dirty = f.name !== user.name || f.department !== (user.department || '') || f.location !== (user.location || '');
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));

  const save = async (e) => {
    e.preventDefault();
    setBusy('save');
    try {
      updateUser(await api('/auth/me', { method: 'PATCH', body: f }));
      push({ tone: 'success', title: 'Perfil salvo', ttl: 3000 });
    } catch (err) {
      push({ tone: 'error', title: 'Não foi possível salvar', body: err.message });
    } finally {
      setBusy(null);
    }
  };

  const uploadPhoto = async (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) return push({ tone: 'error', title: 'Escolha uma imagem', body: 'PNG, JPG, GIF ou WEBP.' });
    if (file.size > 10 * 1024 * 1024) return push({ tone: 'error', title: 'Imagem muito grande', body: 'O limite é 10 MB.' });
    setBusy('photo');
    const fd = new FormData();
    fd.append('file', file);
    try {
      updateUser(await api('/auth/me/avatar', { method: 'POST', form: fd }));
      push({ tone: 'success', title: 'Foto atualizada', ttl: 3000 });
    } catch (err) {
      push({ tone: 'error', title: 'Não foi possível enviar a foto', body: err.message });
    } finally {
      setBusy(null);
    }
  };

  const removePhoto = async () => {
    setBusy('photo');
    try {
      updateUser(await api('/auth/me/avatar', { method: 'DELETE' }));
    } catch (err) {
      push({ tone: 'error', title: 'Não foi possível remover a foto', body: err.message });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Section title="Perfil" sub="É assim que a equipe de T.I e os colegas veem você nos chamados.">
      <div className="profile-photo">
        <button type="button" className="photo-drop" onClick={() => fileRef.current.click()} title="Trocar foto" disabled={busy === 'photo'}>
          <Avatar name={f.name || user.name} src={user.avatar_url} size={88} />
          <span className="photo-overlay">{busy === 'photo' ? <Spinner /> : Icons.image}</span>
        </button>
        <div className="photo-text">
          <strong>{user.name}</strong>
          <span className="muted">
            {ROLE[user.role]} · conta criada em {fmtDateOnly(user.created_at)}
          </span>
          <div className="row-actions">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => fileRef.current.click()} disabled={busy === 'photo'}>
              {user.avatar_url ? 'Trocar foto' : 'Adicionar foto'}
            </button>
            {user.avatar_url && (
              <button type="button" className="btn btn-link btn-danger-link" onClick={removePhoto} disabled={busy === 'photo'}>
                Remover
              </button>
            )}
          </div>
        </div>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => (uploadPhoto(e.target.files[0]), (e.target.value = ''))} />
      </div>

      <form className="settings-form" onSubmit={save}>
        <label className="field">
          <span>Nome completo</span>
          <input value={f.name} onChange={set('name')} maxLength={80} required />
        </label>
        <div className="form-2">
          <label className="field">
            <span>Setor</span>
            <input value={f.department} onChange={set('department')} placeholder="Ex.: Financeiro" maxLength={60} />
          </label>
          <label className="field">
            <span>Onde você trabalha</span>
            <input value={f.location} onChange={set('location')} placeholder="Ex.: 2º andar, sala 204" maxLength={80} />
            <small className="hint">Já vem preenchido quando você abre um chamado.</small>
          </label>
        </div>
        <label className="field">
          <span>E-mail</span>
          <input value={user.email} disabled />
          <small className="hint">Para trocar o e-mail, fale com o administrador.</small>
        </label>
        <div className="settings-actions">
          {dirty && (
            <button type="button" className="btn btn-ghost" onClick={() => setF({ name: user.name, department: user.department || '', location: user.location || '' })}>
              Desfazer
            </button>
          )}
          <button className="btn btn-primary" disabled={!dirty || !!busy}>
            {busy === 'save' ? <Spinner /> : 'Salvar perfil'}
          </button>
        </div>
      </form>
    </Section>
  );
}

// ---------------------------------------------------------------- Segurança

function SecuritySection() {
  const { push } = useToast();
  const [f, setF] = useState({ current: '', next: '', confirm: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const strength = passwordStrength(f.next);
  const mismatch = f.confirm && f.next !== f.confirm;

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (f.next !== f.confirm) return setError('A confirmação não é igual à nova senha.');
    setBusy(true);
    try {
      await api('/auth/password', { method: 'POST', body: { current: f.current, next: f.next } });
      setF({ current: '', next: '', confirm: '' });
      push({ tone: 'success', title: 'Senha alterada', body: 'Use a nova senha no próximo login.', ttl: 4000 });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section title="Segurança" sub="Troque a sua senha sempre que achar necessário.">
      <form className="settings-form narrow" onSubmit={submit}>
        <label className="field">
          <span>Senha atual</span>
          <input type="password" value={f.current} onChange={set('current')} autoComplete="current-password" required />
        </label>
        <label className="field">
          <span>Nova senha</span>
          <input type="password" value={f.next} onChange={set('next')} autoComplete="new-password" minLength={6} required />
          {f.next && (
            <div className={`strength strength-${strength.level}`} aria-live="polite">
              <div className="strength-bar">
                <i style={{ width: `${(strength.level / 4) * 100}%` }} />
              </div>
              <small>{strength.label}</small>
            </div>
          )}
        </label>
        <label className="field">
          <span>Confirme a nova senha</span>
          <input type="password" value={f.confirm} onChange={set('confirm')} autoComplete="new-password" required />
          {mismatch && <small className="hint hint-error">As senhas não são iguais.</small>}
        </label>
        {error && <div className="alert alert-error">{error}</div>}
        <div className="settings-actions">
          <button className="btn btn-primary" disabled={busy || !f.current || f.next.length < 6 || mismatch}>
            {busy ? <Spinner /> : 'Trocar senha'}
          </button>
        </div>
      </form>
    </Section>
  );
}

function passwordStrength(p) {
  if (!p) return { level: 0, label: '' };
  if (p.length < 6) return { level: 1, label: 'Curta demais (mínimo 6)' };
  let score = 1;
  if (p.length >= 10) score++;
  if (/[A-Z]/.test(p) && /[a-z]/.test(p)) score++;
  if (/\d/.test(p) && /[^A-Za-z0-9]/.test(p)) score++;
  return { level: score, label: ['', 'Fraca', 'Razoável', 'Boa', 'Forte'][score] };
}

// ---------------------------------------------------------------- Aparência

function AppearanceSection() {
  return (
    <Section title="Aparência" sub="Vale só para este navegador. Em outro computador, você escolhe de novo.">
      <div className="appearance">
        <PrefsPanel />
        <Preview />
      </div>
    </Section>
  );
}

/** Miniatura que mostra na hora como fica a cor e o tema escolhidos. */
function Preview() {
  return (
    <div className="preview" aria-hidden="true">
      <div className="preview-side">
        <i className="pv-logo" />
        <i className="pv-nav on" />
        <i className="pv-nav" />
        <i className="pv-nav" />
      </div>
      <div className="preview-main">
        <i className="pv-title" />
        <div className="pv-card">
          <i className="pv-line" />
          <div className="pv-track">
            <b className="done" />
            <b className="done" />
            <b className="cur" />
            <b />
          </div>
        </div>
        <div className="pv-bubbles">
          <i className="pv-bubble" />
          <i className="pv-bubble mine" />
        </div>
        <span className="pv-btn">Abrir chamado</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Notificações

function NotificationsSection() {
  const { prefs, set } = usePrefs();
  const { push } = useToast();
  const supported = 'Notification' in window;
  const [perm, setPerm] = useState(supported ? Notification.permission : 'unsupported');

  useEffect(() => {
    if (prefs.desktop && perm === 'denied') set('desktop', false);
  }, [perm]);

  const toggleDesktop = async (on) => {
    if (!on) return set('desktop', false);
    if (!supported) return;
    let p = Notification.permission;
    if (p === 'default') p = await Notification.requestPermission();
    setPerm(p);
    if (p === 'granted') {
      set('desktop', true);
      new Notification('Notificações ligadas', { body: 'Você será avisado mesmo com a aba em segundo plano.' });
    } else {
      push({ tone: 'error', title: 'O navegador bloqueou as notificações', body: 'Libere nas configurações do site (cadeado ao lado do endereço).' });
    }
  };

  return (
    <Section title="Notificações" sub="Escolha como quer ser avisado quando algo acontece nos seus chamados.">
      <div className="toggles">
        <Toggle
          on={prefs.toasts}
          onChange={(v) => set('toasts', v)}
          title="Avisos na tela"
          desc="Novos chamados, mensagens e mudanças aparecem no canto da tela."
          action={
            <button type="button" className="btn btn-link" onClick={() => push({ title: 'Assim é um aviso', body: 'Clique nele para abrir o chamado.' })}>
              Testar
            </button>
          }
        />
        <Toggle
          on={prefs.sound}
          onChange={(v) => (set('sound', v), v && ping())}
          title="Som ao receber um aviso"
          desc="Um toque curto, útil quando você está em outra janela."
          action={
            <button type="button" className="btn btn-link" onClick={ping}>
              Ouvir
            </button>
          }
        />
        <Toggle
          on={prefs.desktop && perm === 'granted'}
          onChange={toggleDesktop}
          disabled={!supported}
          title="Notificações do Windows"
          desc={
            !supported
              ? 'Este navegador não suporta notificações.'
              : perm === 'denied'
                ? 'Bloqueadas pelo navegador. Libere no cadeado ao lado do endereço do site.'
                : 'Avisa mesmo quando a aba do Helpdesk está minimizada ou em segundo plano.'
          }
        />
      </div>
    </Section>
  );
}

function Toggle({ on, onChange, title, desc, action, disabled }) {
  return (
    <div className={`toggle-row ${disabled ? 'is-disabled' : ''}`}>
      <div className="toggle-text">
        <b>{title}</b>
        <small>{desc}</small>
        {action}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={!!on}
        aria-label={title}
        className={`switch ${on ? 'on' : ''}`}
        onClick={() => !disabled && onChange(!on)}
        disabled={disabled}
      >
        <i />
      </button>
    </div>
  );
}
