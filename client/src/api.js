const TOKEN_KEY = 'helpdesk_token';

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

/**
 * Chamada à API. Use `body` para JSON ou `form` (FormData) para envio com arquivo.
 */
export async function api(path, { method = 'GET', body, form } = {}) {
  const headers = {};
  const token = getToken();
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
