export const ROLES = ['colaborador', 'tecnico', 'admin'];
export const UNCLASSIFIED = 'A classificar';
export const CATEGORIES = [UNCLASSIFIED, 'Hardware', 'Software', 'Rede / Internet', 'Acesso / Senha', 'Impressora', 'E-mail', 'Telefonia', 'Outros'];
export const PRIORITIES = ['baixa', 'media', 'alta', 'urgente'];
export const ACTIVE_STATUSES = ['aberto', 'em_atendimento', 'aguardando', 'visita_agendada'];
export const ACTIVE_SQL = `(${ACTIVE_STATUSES.map((s) => `'${s}'`).join(',')})`;
export const DISPLAY_TZ = process.env.DISPLAY_TZ || 'America/Sao_Paulo';

/** "sex., 28/11" a partir de AAAA-MM-DD */
export const fmtDay = (ymd) =>
  new Date(`${ymd}T12:00:00Z`).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', timeZone: 'UTC' });

/** Data de hoje (AAAA-MM-DD) no fuso da empresa */
export const todayYmd = () => new Date().toLocaleDateString('en-CA', { timeZone: DISPLAY_TZ });

export const fmtDateTime = (d) =>
  new Date(d).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: DISPLAY_TZ });
