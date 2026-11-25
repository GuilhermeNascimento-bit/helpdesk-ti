import { useEffect, useState } from 'react';
import { useAuth } from '../context.jsx';
import { QuickPrefs, isLite } from '../prefs.jsx';
import { Avatar, DrawnCheck, Icons, ProgressTrack, Spinner, StatusBadge } from '../components/ui.jsx';
import { api, BACKEND, HAS_DEMO, enterDemo, leaveDemo } from '../api.js';

const Eye = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);
const EyeOff = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M9.9 4.24A9.1 9.1 0 0 1 12 4c6.4 0 10 7 10 7a18 18 0 0 1-2.16 3.19M6.6 6.6A17.6 17.6 0 0 0 2 12s3.6 7 10 7a9.7 9.7 0 0 0 5.4-1.6M14.12 14.12a3 3 0 1 1-4.24-4.24M2 2l20 20" />
  </svg>
);

const DEMO = [
  { label: 'Colaborador', email: 'ana@empresa.com', password: 'ana123' },
  { label: 'Técnico', email: 'tecnico@empresa.com', password: 'tecnico123' },
  { label: 'Admin', email: 'admin@empresa.com', password: 'admin123' },
];

// Um chamado de exemplo percorrendo o caminho inteiro, em loop
const STORY = [
  { status: 'aberto', line: 'Chamado enviado para a T.I', who: 'Ana Souza' },
  { status: 'em_atendimento', line: 'Carlos assumiu e está no chat', who: 'Carlos Técnico' },
  { status: 'visita_agendada', line: 'Carlos está a caminho da sua mesa', who: 'Carlos Técnico', visit: true },
  { status: 'resolvido', line: 'Cabo de rede trocado, tudo certo', who: 'Carlos Técnico', visit: true },
  { status: 'fechado', line: 'Avaliado com 5 estrelas', who: 'Ana Souza', visit: true },
];

function StoryCard() {
  const [i, setI] = useState(1);
  useEffect(() => {
    const t = setInterval(() => !isLite() && setI((x) => (x + 1) % STORY.length), 2400);
    return () => clearInterval(t);
  }, []);
  const s = STORY[i];
  return (
    <div className="story">
      <div className="story-head">
        <span className="ticket-id">#128</span>
        <strong>A internet caiu no meu computador</strong>
      </div>
      <StatusBadge status={s.status} />
      <ProgressTrack ticket={{ status: s.status, visit_at: s.visit ? 'x' : null }} size="sm" />
      <div className="story-line" key={i}>
        <Avatar name={s.who} size={24} />
        <span>{s.line}</span>
      </div>
    </div>
  );
}

function PasswordInput({ value, onChange, autoComplete }) {
  const [show, setShow] = useState(false);
  return (
    <span className="pass-wrap">
      <input type={show ? 'text' : 'password'} value={value} onChange={onChange} autoComplete={autoComplete} required minLength={autoComplete === 'new-password' ? 6 : undefined} />
      <button type="button" className="pass-eye" onClick={() => setShow((s) => !s)} aria-label={show ? 'Esconder senha' : 'Mostrar senha'}>
        {show ? <EyeOff /> : <Eye />}
      </button>
    </span>
  );
}

/** Cadastro: fica aguardando a aprovação do administrador. */
function SignupForm({ onBack, onDone }) {
  const [f, setF] = useState({ name: '', department: '', location: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      leaveDemo();
      const res = await api('/auth/register', { method: 'POST', body: f });
      onDone(f.name, f.email, res);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <form className="login-form signup-form" onSubmit={submit}>
      <div>
        <h2>Criar conta</h2>
        <p className="muted">O administrador da T.I aprova o seu acesso.</p>
      </div>
      <label className="field">
        <span>Nome completo</span>
        <input value={f.name} onChange={set('name')} autoComplete="name" required autoFocus />
      </label>
      <div className="signup-row">
        <label className="field">
          <span>Setor</span>
          <input value={f.department} onChange={set('department')} placeholder="Ex.: Financeiro" required />
        </label>
        <label className="field">
          <span>Onde você trabalha</span>
          <input value={f.location} onChange={set('location')} placeholder="Ex.: 2º andar, sala 204" required />
        </label>
      </div>
      <label className="field">
        <span>E-mail da empresa</span>
        <input type="email" value={f.email} onChange={set('email')} autoComplete="email" required />
      </label>
      <label className="field">
        <span>Crie uma senha</span>
        <PasswordInput value={f.password} onChange={set('password')} autoComplete="new-password" />
        <small className="hint">Pelo menos 6 caracteres.</small>
      </label>
      {error && <div className="alert alert-error">{error}</div>}
      <button className="btn btn-primary btn-lg btn-block" disabled={busy}>
        {busy ? <Spinner /> : 'Enviar cadastro'}
      </button>
      <p className="switch-line">
        Já tem conta?{' '}
        <button type="button" className="btn-link" onClick={onBack}>
          Entrar
        </button>
      </p>
    </form>
  );
}

export default function Login() {
  const { login } = useAuth();
  const [mode, setMode] = useState('login'); // 'login' | 'signup' | 'sent'
  const [sentName, setSentName] = useState('');
  const [sent, setSent] = useState(null); // { email, firstAdmin, verify }
  const [info, setInfo] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(0);

  // Site público de demonstração? (mostra um aviso para quem vem pelo portfólio)
  const [demoSite, setDemoSite] = useState(false);
  useEffect(() => {
    api('/health').then((h) => setDemoSite(!!h?.demo)).catch(() => {});
  }, []);

  /** Botões de conta de demonstração: preenchem e já entram. */
  const quickLogin = (d) => {
    if (BACKEND === 'firebase') enterDemo(); // a demonstração roda no navegador, separada das contas de verdade
    setEmail(d.email);
    setPassword(d.password);
    doLogin(d.email, d.password);
  };

  const submit = (e) => {
    e.preventDefault();
    leaveDemo();
    doLogin(email, password);
  };

  /** Firebase: manda o link para criar uma senha nova. */
  const forgot = async () => {
    setError('');
    setInfo('');
    try {
      leaveDemo();
      await api('/auth/reset', { method: 'POST', body: { email } });
      setInfo(`Se existir uma conta com ${email}, enviamos um link para criar uma senha nova. Veja também a caixa de spam.`);
    } catch (err) {
      setError(err.message);
    }
  };

  const doLogin = async (em, pw) => {
    setError('');
    setInfo('');
    setPending(false);
    setBusy(true);
    try {
      await login(em, pw);
    } catch (err) {
      const isPending = /aguardando a aprovação|Confirme o seu e-mail/.test(err.message);
      setPending(isPending);
      setError(err.message);
      if (!isPending) setShake((s) => s + 1);
      setBusy(false);
    }
  };

  return (
    <div className="login">
      <div className="login-bg" aria-hidden="true">
        <i className="blob b1" />
        <i className="blob b2" />
        <i className="blob b3" />
        <i className="login-grid" />
      </div>

      <header className="login-top">
        <div className="brand brand-dark">
          <span className="brand-mark">{Icons.monitor}</span>
          <span className="brand-name">Helpdesk T.I</span>
        </div>
        <QuickPrefs />
      </header>

      <main className={`login-card ${shake ? 'shake' : ''}`} key={shake}>
        <section className="login-side">
          <h1>Deu problema? A T.I resolve.</h1>
          <p>Descreva o problema, converse com o técnico pelo chat e acompanhe cada passo até a solução.</p>
          <StoryCard />
        </section>

        {mode === 'signup' && (
          <SignupForm
            onBack={() => setMode('login')}
            onDone={(name, mail, res) => {
              setSentName(name);
              setSent({ email: mail, firstAdmin: !!res?.firstAdmin, verify: !!res?.verify });
              setEmail(mail);
              setMode('sent');
            }}
          />
        )}

        {mode === 'sent' && (
          <div className="login-form signup-sent">
            <DrawnCheck size={76} />
            <h2>Cadastro enviado</h2>
            {sent?.verify ? (
              <p className="muted">
                Enviamos um link de confirmação para <b>{sent.email}</b>. Abra o e-mail e clique no link (veja também a caixa de spam).{' '}
                {sent.firstAdmin
                  ? 'Você é o primeiro cadastro, então já é o administrador: depois de confirmar, é só entrar.'
                  : 'Depois de confirmar, aguarde o administrador aprovar o seu acesso.'}
              </p>
            ) : (
              <p className="muted">
                Obrigado, {sentName.split(' ')[0]}. Assim que o administrador aprovar, você já consegue entrar com o seu e-mail e senha.
              </p>
            )}
            <button className="btn btn-ghost btn-block" onClick={() => setMode('login')}>
              Voltar para o login
            </button>
          </div>
        )}

        {mode === 'login' && (
        <form className="login-form" onSubmit={submit}>
          <div>
            <h2>Entrar</h2>
            <p className="muted">Use seu e-mail da empresa.</p>
          </div>
          <label className="field">
            <span>E-mail</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required autoFocus />
          </label>
          <label className="field">
            <span>Senha</span>
            <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
            {BACKEND === 'firebase' && (
              <button type="button" className="btn-link forgot" onClick={forgot}>
                Esqueci minha senha
              </button>
            )}
          </label>
          {error && <div className={`alert ${pending ? 'alert-info' : 'alert-error'}`}>{error}</div>}
          {info && <div className="alert alert-info">{info}</div>}
          <button className="btn btn-primary btn-lg btn-block btn-shine" disabled={busy}>
            {busy ? <Spinner /> : 'Entrar'}
          </button>

          <div className="demo">
            <span>
              {BACKEND === 'firebase'
                ? 'É recrutador? Teste sem cadastro, com um clique:'
                : demoSite
                  ? 'Entre com um clique para conhecer o sistema:'
                  : 'Contas de demonstração'}
            </span>
            <div className="demo-list">
              {DEMO.map((d) => (
                <button
                  type="button"
                  key={d.email}
                  disabled={busy}
                  className={`chip chip-sm ${email === d.email ? 'chip-on' : ''}`}
                  onClick={() => quickLogin(d)}
                  title={`${d.email} / ${d.password}`}
                >
                  {d.label}
                </button>
              ))}
            </div>
            {demoSite && !HAS_DEMO && <small className="hint">Site de demonstração: os dados voltam ao estado inicial de tempos em tempos.</small>}
            {HAS_DEMO && (
              <div className="demo-browser">
                <small className="hint">
                  Demonstração: tudo roda no seu navegador e as mudanças ficam só aqui. Abra duas abas, uma como Técnico e outra como
                  Colaborador, para ver o chat em tempo real.
                </small>
                <button
                  type="button"
                  className="btn-link demo-reset"
                  onClick={async () => {
                    if (!window.confirm('Apagar as suas mudanças e voltar aos dados de exemplo?')) return;
                    (await import('../demo/store.js')).resetDemo();
                    window.location.reload();
                  }}
                >
                  Restaurar dados de exemplo
                </button>
              </div>
            )}
          </div>
          <p className="switch-line">
            Ainda não tem conta?{' '}
            <button type="button" className="btn-link" onClick={() => setMode('signup')}>
              Criar conta
            </button>
          </p>
        </form>
        )}
      </main>

      <footer className="login-foot">Equipe de T.I interna</footer>
    </div>
  );
}
