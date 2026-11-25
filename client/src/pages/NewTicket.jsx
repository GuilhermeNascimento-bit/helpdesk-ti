import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../context.jsx';
import { PRIORITY } from '../constants.js';
import { DrawnCheck, Icons, PriorityIcon, Spinner } from '../components/ui.jsx';

export function useFilePreview(file) {
  const url = useMemo(() => (file?.type.startsWith('image/') ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => url && URL.revokeObjectURL(url), [url]);
  return url;
}

/** Extrai uma imagem colada (Ctrl+V de um print). */
export function pastedImage(e) {
  const item = [...(e.clipboardData?.items || [])].find((i) => i.type.startsWith('image/'));
  if (!item) return null;
  const blob = item.getAsFile();
  return new File([blob], `print-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.png`, { type: blob.type });
}

const EXAMPLES = ['A internet não está funcionando', 'Esqueci minha senha', 'A impressora não imprime', 'O computador está muito lento'];

export default function NewTicket() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { state } = useLocation();
  const [description, setDescription] = useState(state?.description || '');
  const [priority, setPriority] = useState('media');
  const [location, setLocation] = useState(user.location || '');
  const [editLocation, setEditLocation] = useState(!user.location);
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  const preview = useFilePreview(file);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    const fd = new FormData();
    fd.append('description', description);
    fd.append('priority', priority);
    fd.append('location', location);
    if (file) fd.append('file', file);
    try {
      const t = await api('/tickets', { method: 'POST', form: fd });
      setDone(t);
      setTimeout(() => navigate(`/chamados/${t.id}`, { replace: true }), 1700);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  if (done)
    return (
      <div className="page page-narrow">
        <div className="sent">
          <DrawnCheck size={88} />
          <h1>Chamado #{done.id} enviado</h1>
          <p className="muted">A equipe de T.I já foi avisada. Abrindo a conversa…</p>
        </div>
      </div>
    );

  return (
    <div className="page page-new">
      <header className="page-head">
        <div>
          <h1>Abrir chamado</h1>
          <p className="muted">Explique do seu jeito. O técnico entende e organiza o resto.</p>
        </div>
      </header>

      <div className="new-layout">
      <form
        className={`card form ${dragging ? 'is-dragging' : ''}`}
        onSubmit={submit}
        onDragOver={(e) => (e.preventDefault(), setDragging(true))}
        onDragLeave={(e) => e.currentTarget.contains(e.relatedTarget) || setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (e.dataTransfer.files[0]) setFile(e.dataTransfer.files[0]);
        }}
      >
        <label className="field">
          <span className="field-q">O que está acontecendo?</span>
          <textarea
            className="big-input"
            rows={5}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onPaste={(e) => {
              const img = pastedImage(e);
              if (img) {
                e.preventDefault();
                setFile(img);
              }
            }}
            placeholder="Ex.: Desde hoje cedo o computador não conecta na internet. Aparece um globo com um X no canto da tela."
            required
            autoFocus
            onFocus={(e) => e.target.setSelectionRange(e.target.value.length, e.target.value.length)}
          />
        </label>
        {!description && (
          <div className="examples">
            {EXAMPLES.map((ex) => (
              <button type="button" key={ex} className="chip chip-soft" onClick={() => setDescription(ex + '. ')}>
                {ex}
              </button>
            ))}
          </div>
        )}

        <div className="field">
          <span className="field-q">Quanto isso está te atrapalhando?</span>
          <div className="prio-grid">
            {Object.entries(PRIORITY).map(([key, p]) => (
              <button
                type="button"
                key={key}
                className={`prio-option prio-${p.tone} ${priority === key ? 'selected' : ''}`}
                onClick={() => setPriority(key)}
                aria-pressed={priority === key}
              >
                <strong>
                  <PriorityIcon priority={key} /> {p.ask}
                </strong>
                <small>{p.hint}</small>
              </button>
            ))}
          </div>
        </div>

        <div className="form-row">
          <div className="field">
            <span className="field-q">Print ou foto do problema</span>
            {file ? (
              <div className="attach-preview pop-in">
                {preview ? <img src={preview} alt="" /> : <span className="file-icon">{Icons.file}</span>}
                <span className="attach-name">{file.name}</span>
                <button type="button" className="icon-btn" onClick={() => setFile(null)} title="Remover anexo">
                  {Icons.x}
                </button>
              </div>
            ) : (
              <label className="dropzone">
                {Icons.image}
                <span>
                  <b>Escolher arquivo</b> ou cole com Ctrl+V
                </span>
                <input type="file" accept="image/*,.pdf,.txt" hidden onChange={(e) => setFile(e.target.files[0] || null)} />
              </label>
            )}
          </div>

          <div className="field">
            <span className="field-q">Onde você está</span>
            {editLocation ? (
              <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Ex.: 2º andar, sala 204" autoFocus={!!user.location} />
            ) : (
              <button type="button" className="location-pill" onClick={() => setEditLocation(true)}>
                {Icons.pin}
                <span>{location}</span>
                <small>alterar</small>
              </button>
            )}
          </div>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <div className="form-actions">
          <button type="button" className="btn btn-ghost" onClick={() => navigate(-1)}>
            Voltar
          </button>
          <button className="btn btn-primary btn-lg" disabled={busy || description.trim().length < 5}>
            {busy ? <Spinner /> : <>{Icons.send} Enviar chamado</>}
          </button>
        </div>
        {dragging && <div className="drop-overlay">{Icons.image} Solte o arquivo para anexar</div>}
      </form>

      <aside className="new-aside">
        <div className="aside-block">
          <h3>Depois de enviar</h3>
          <ol className="steps">
            <li><b>A T.I recebe na hora</b><span>Um técnico assume e você é avisado.</span></li>
            <li><b>Vocês conversam pelo chat</b><span>Ele pode pedir um print ou te orientar.</span></li>
            <li><b>Resolve à distância ou vai até você</b><span>Você acompanha cada passo na tela inicial.</span></li>
          </ol>
        </div>
        <div className="aside-block aside-tips">
          <h3>Ajuda a resolver mais rápido</h3>
          <ul>
            <li>A mensagem de erro, se aparecer</li>
            <li>Desde quando acontece</li>
            <li>O que você já tentou</li>
          </ul>
        </div>
      </aside>
      </div>
    </div>
  );
}
