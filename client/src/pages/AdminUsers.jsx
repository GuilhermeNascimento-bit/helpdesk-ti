import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAuth, useSocketEvent, useToast } from '../context.jsx';
import { ROLE, timeAgo } from '../constants.js';
import { Avatar, Badge, Icons, Led, Spinner } from '../components/ui.jsx';

const EMPTY = { name: '', email: '', role: 'colaborador', department: '', location: '', password: '', active: true };
const ROLE_TONE = { colaborador: 'gray', tecnico: 'blue', admin: 'violet' };

export default function AdminUsers() {
  const { user: me } = useAuth();
  const { push } = useToast();
  const [users, setUsers] = useState(null);
  const [editing, setEditing] = useState(null); // null | {} (novo) | user
  const [q, setQ] = useState('');

  const load = () => api('/users').then(setUsers).catch((e) => push({ tone: 'error', title: 'Erro', body: e.message }));
  useEffect(() => {
    load();
  }, []);
  useSocketEvent('user:pending', () => load());

  const pending = users?.filter((u) => !u.approved) ?? [];
  const filtered = users?.filter((u) => u.approved).filter((u) =>
    [u.name, u.email, u.department].some((v) => v?.toLowerCase().includes(q.toLowerCase()))
  );

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Usuários</h1>
          <p className="muted">Colaboradores, técnicos e administradores.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setEditing({})}>
          {Icons.plus} Novo usuário
        </button>
      </header>

      {pending.length > 0 && (
        <section className="approvals">
          <h2 className="group-title">
            Cadastros aguardando aprovação <span className="count count-alert">{pending.length}</span>
          </h2>
          <div className="approval-list">
            {pending.map((u, i) => (
              <ApprovalCard key={u.id} u={u} i={i} onDone={load} />
            ))}
          </div>
        </section>
      )}

      <div className="toolbar">
        <label className="search">
          {Icons.search}
          <input placeholder="Buscar por nome, e-mail ou setor" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
      </div>

      {!users ? (
        <div className="center-pad"><Spinner /></div>
      ) : (
        <div className="card table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Perfil</th>
                <th>Setor</th>
                <th>Local</th>
                <th className="num">Abriu</th>
                <th className="num">Atendeu</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.id} className={u.active ? '' : 'row-off'}>
                  <td>
                    <div className="user-cell">
                      <Avatar name={u.name} size={30} />
                      <div>
                        <strong>{u.name}</strong>
                        <small>{u.email}</small>
                      </div>
                    </div>
                  </td>
                  <td><Badge tone={ROLE_TONE[u.role]}>{ROLE[u.role]}</Badge></td>
                  <td>{u.department || '—'}</td>
                  <td>{u.location || '—'}</td>
                  <td className="num">{u.tickets_opened}</td>
                  <td className="num">{u.tickets_handled}</td>
                  <td>{u.active ? <Badge tone="green"><Led tone="green" /> Ativo</Badge> : <Badge><Led tone="gray" /> Inativo</Badge>}</td>
                  <td className="num">
                    <button className="btn btn-sm btn-ghost" onClick={() => setEditing(u)}>Editar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <UserModal
          user={editing}
          isSelf={editing.id === me.id}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function UserModal({ user, isSelf, onClose, onSaved }) {
  const isNew = !user.id;
  const [form, setForm] = useState({ ...EMPTY, ...user, password: '', active: isNew ? true : !!user.active });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    const body = {
      name: form.name,
      email: form.email,
      role: form.role,
      department: form.department || '',
      location: form.location || '',
      active: form.active,
      ...(form.password ? { password: form.password } : {}),
    };
    try {
      await api(isNew ? '/users' : `/users/${user.id}`, { method: isNew ? 'POST' : 'PATCH', body });
      onSaved();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="modal card" onSubmit={submit}>
        <header className="modal-head">
          <h2>{isNew ? 'Novo usuário' : 'Editar usuário'}</h2>
          <button type="button" className="icon-btn" onClick={onClose}>{Icons.x}</button>
        </header>
        <div className="form-grid">
          <label className="field">
            <span>Nome</span>
            <input value={form.name} onChange={set('name')} required autoFocus />
          </label>
          <label className="field">
            <span>E-mail</span>
            <input type="email" value={form.email} onChange={set('email')} required />
          </label>
          <label className="field">
            <span>Perfil</span>
            <select value={form.role} onChange={set('role')} disabled={isSelf}>
              {Object.entries(ROLE).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Setor</span>
            <input value={form.department || ''} onChange={set('department')} placeholder="Ex.: Financeiro" />
          </label>
          <label className="field field-span">
            <span>Local de trabalho</span>
            <input value={form.location || ''} onChange={set('location')} placeholder="Ex.: 2º andar, sala 204" />
          </label>
          <label className="field field-span">
            <span>{isNew ? 'Senha inicial' : 'Nova senha (deixe em branco para manter)'}</span>
            <input type="text" value={form.password} onChange={set('password')} minLength={6} required={isNew} autoComplete="new-password" />
          </label>
          {!isNew && !isSelf && (
            <label className="check field-span">
              <input type="checkbox" checked={form.active} onChange={set('active')} />
              <span>Usuário ativo (pode entrar no sistema)</span>
            </label>
          )}
        </div>
        {error && <div className="alert alert-error">{error}</div>}
        <div className="form-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" disabled={busy}>{busy ? <Spinner /> : 'Salvar'}</button>
        </div>
      </form>
    </div>
  );
}

/** Um cadastro pendente: escolher o perfil e aprovar, ou recusar. */
function ApprovalCard({ u, i, onDone }) {
  const { push } = useToast();
  const [role, setRole] = useState('colaborador');
  const [busy, setBusy] = useState(null);
  const [leaving, setLeaving] = useState(false);

  const act = async (kind) => {
    if (kind === 'reject' && !window.confirm(`Recusar o cadastro de ${u.name}? A pessoa não vai conseguir entrar.`)) return;
    setBusy(kind);
    try {
      if (kind === 'approve') await api(`/users/${u.id}/approve`, { method: 'POST', body: { role } });
      else await api(`/users/${u.id}`, { method: 'DELETE' });
      setLeaving(true);
      push({
        tone: kind === 'approve' ? 'success' : 'info',
        title: kind === 'approve' ? `${u.name} aprovado(a)` : `Cadastro de ${u.name} recusado`,
        body: kind === 'approve' ? `Entrou como ${ROLE[role].toLowerCase()}.` : undefined,
        ttl: 3500,
      });
      setTimeout(onDone, 280);
    } catch (e) {
      push({ tone: 'error', title: 'Não foi possível concluir', body: e.message });
      setBusy(null);
    }
  };

  return (
    <div className={`approval card ${leaving ? 'is-leaving' : ''}`} style={{ '--i': i }}>
      <div className="approval-who">
        <Avatar name={u.name} size={40} />
        <div>
          <strong>{u.name}</strong>
          <span>{u.email}</span>
        </div>
      </div>
      <dl className="approval-info">
        <div><dt>Setor</dt><dd>{u.department || '—'}</dd></div>
        <div><dt>Local</dt><dd>{u.location || '—'}</dd></div>
        <div><dt>Pediu acesso</dt><dd>{timeAgo(u.created_at)}</dd></div>
      </dl>
      <div className="approval-actions">
        <select value={role} onChange={(e) => setRole(e.target.value)} aria-label="Perfil">
          {Object.entries(ROLE).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <button className="btn btn-ghost btn-sm btn-reject" disabled={!!busy} onClick={() => act('reject')}>
          {busy === 'reject' ? <Spinner /> : 'Recusar'}
        </button>
        <button className="btn btn-primary btn-sm" disabled={!!busy} onClick={() => act('approve')}>
          {busy === 'approve' ? <Spinner /> : <>{Icons.check} Aprovar</>}
        </button>
      </div>
    </div>
  );
}
