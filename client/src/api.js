const TOKEN_KEY = 'helpdesk_token';
const MODE_KEY = 'helpdesk_mode';

/**
 * De onde vêm os dados:
 *  - 'server':   servidor Node desta pasta (padrão, uso numa empresa)
 *  - 'firebase': Firebase Auth + Firestore (GitHub Pages com contas de verdade)
 *  - 'demo':     tudo no navegador, para recrutadores (GitHub Pages)
 * No build com Firebase, o botão "Testar a demonstração" troca esta aba para 'demo'.
 */
export const BACKEND = import.meta.env.VITE_BACKEND || (import.meta.env.VITE_DEMO === '1' ? 'demo' : 'server');
export const HAS_DEMO = BACKEND !== 'server';
export const mode = () => (BACKEND === 'firebase' && sessionStorage.getItem(MODE_KEY) === 'demo' ? 'demo' : BACKEND);
/** Esta aba está na demonstração (dados só no navegador)? */
export const isDemoSession = () => mode() === 'demo';
export const enterDemo = () => sessionStorage.setItem(MODE_KEY, 'demo');
export const leaveDemo = () => sessionStorage.removeItem(MODE_KEY);
/** Compatibilidade: true quando o app inteiro é só a demonstração. */
export const IS_DEMO = BACKEND === 'demo';

// Cada aba guarda o próprio login (sessionStorage), assim dá pra ter o técnico numa aba
// e o colaborador em outra. O localStorage só serve para abrir abas novas já logado.
export const getToken = () => sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY);
export const setToken = (t) => {
  if (t) {
    sessionStorage.setItem(TOKEN_KEY, t);
    localStorage.setItem(TOKEN_KEY, t);
  } else {
    sessionStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_KEY);
  }
};
// Fixa nesta aba o login que ela está usando (vale para abas abertas antes desta mudança)
const current = getToken();
if (current) sessionStorage.setItem(TOKEN_KEY, current);
// Aba nova aberta a partir da demonstração continua na demonstração
if (BACKEND === 'firebase' && String(current).startsWith('demo:')) enterDemo();

/** Sair: no Firebase também encerra a sessão dele. */
export async function backendLogout() {
  if (mode() === 'firebase') (await import('./fb/server.js')).firebaseLogout();
  leaveDemo();
}

/**
 * Chamada à API. Use `body` para JSON ou `form` (FormData) para envio com arquivo.
 */
export async function api(path, { method = 'GET', body, form } = {}) {
  const headers = {};
  const token = getToken();

  // GitHub Pages: sem servidor Node, a "API" roda no navegador (demonstração) ou no Firebase
  const m = mode();
  if (m !== 'server') {
    try {
      if (m === 'demo') {
        const { demoRequest } = await import('./demo/server.js');
        return await demoRequest(path, { method, body, form, token });
      }
      const { firebaseRequest } = await import('./fb/server.js');
      return await firebaseRequest(path, { method, body, form });
    } catch (err) {
      if (err.status === 401 && token) {
        setToken(null);
        window.dispatchEvent(new Event('auth:logout'));
      }
      throw new Error(err.message || 'Algo deu errado. Tente novamente.');
    }
  }

  if (token) headers.Authorization = `Bearer ${token}`;
  let payload;
  if (form) payload = form;
  else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(`/api${path}`, { method, headers, body: payload });
  } catch {
    throw new Error('Sem conexão com o servidor.');
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401 && token) {
      setToken(null);
      window.dispatchEvent(new Event('auth:logout'));
    }
    throw new Error(data?.error || 'Algo deu errado. Tente novamente.');
  }
  return data;
}
