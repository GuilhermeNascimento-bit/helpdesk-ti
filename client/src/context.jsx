import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { api, getToken, setToken } from './api.js';

// ---------- Autenticação ----------
const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(() => !!getToken());

  useEffect(() => {
    if (!getToken()) return;
    api('/auth/me')
      .then(setUser)
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const onLogout = () => setUser(null);
    window.addEventListener('auth:logout', onLogout);
    return () => window.removeEventListener('auth:logout', onLogout);
  }, []);

  const login = async (email, password) => {
    const { token, user } = await api('/auth/login', { method: 'POST', body: { email, password } });
    setToken(token);
    setUser(user);
    return user;
  };
  const logout = () => {
    setToken(null);
    setUser(null);
  };

  return <AuthCtx.Provider value={{ user, loading, login, logout, updateUser: setUser }}>{children}</AuthCtx.Provider>;
}

// ---------- Tempo real ----------
const SocketCtx = createContext(null);
export const useSocket = () => useContext(SocketCtx);

export function SocketProvider({ children }) {
  const { user } = useAuth();
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    if (!user) return;
    const s = io({ auth: { token: getToken() } });
    setSocket(s);
    return () => {
      s.disconnect();
      setSocket(null);
    };
  }, [user?.id]);

  return <SocketCtx.Provider value={socket}>{children}</SocketCtx.Provider>;
}

/** Assina um evento do socket; o handler sempre vê o estado mais recente. */
export function useSocketEvent(event, handler) {
  const socket = useSocket();
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    if (!socket) return;
    const fn = (...args) => ref.current(...args);
    socket.on(event, fn);
    return () => socket.off(event, fn);
  }, [socket, event]);
}

// ---------- Avisos (toasts) ----------
const ToastCtx = createContext(null);
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const dismiss = useCallback((id) => {
    // marca como "saindo" para animar, depois remove
    setToasts((t) => t.map((x) => (x.id === id ? { ...x, leaving: true } : x)));
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 260);
  }, []);
  const push = useCallback(
    (toast) => {
      const id = Math.random().toString(36).slice(2);
      const ttl = toast.ttl ?? 6500;
      setToasts((t) => [...t.slice(-3), { id, tone: 'info', ttl, ...toast }]);
      setTimeout(() => dismiss(id), ttl);
    },
    [dismiss]
  );
  return (
    <ToastCtx.Provider value={{ toasts, push, dismiss }}>
      {children}
    </ToastCtx.Provider>
  );
}
