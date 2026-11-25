export const STATUS = {
  aberto: { label: 'Aberto', tone: 'amber', live: true },
  em_atendimento: { label: 'Em atendimento', tone: 'blue', live: true },
  aguardando: { label: 'Aguardando item', tone: 'pink', live: true },
  visita_agendada: { label: 'Visita agendada', tone: 'violet', live: true },
  resolvido: { label: 'Resolvido', tone: 'green' },
  fechado: { label: 'Fechado', tone: 'gray' },
  cancelado: { label: 'Cancelado', tone: 'gray' },
};

/** Textos pensados para quem não é de T.I. */
export const PRIORITY = {
  baixa: { label: 'Baixa', tone: 'gray', ask: 'Dá pra esperar', hint: 'Incomoda, mas consigo trabalhar' },
  media: { label: 'Média', tone: 'blue', ask: 'Está atrapalhando', hint: 'Estou contornando por enquanto' },
  alta: { label: 'Alta', tone: 'amber', ask: 'Parei de trabalhar', hint: 'Não consigo fazer minhas tarefas' },
  urgente: { label: 'Urgente', tone: 'red', ask: 'Afeta muita gente', hint: 'Setor parado ou cliente esperando' },
};

export const UNCLASSIFIED = 'A classificar';
export const CATEGORIES = [UNCLASSIFIED, 'Hardware', 'Software', 'Rede / Internet', 'Acesso / Senha', 'Impressora', 'E-mail', 'Telefonia', 'Outros'];

export const ROLE = { colaborador: 'Colaborador', tecnico: 'Técnico', admin: 'Administrador' };

export const ACTIVE = ['aberto', 'em_atendimento', 'aguardando', 'visita_agendada'];

/** O que o chamado pode estar aguardando. */
export const PENDING = {
  compra: { label: 'Compra', waiting: 'Aguardando compra', item: 'O que vai ser comprado?', placeholder: 'Ex.: mouse sem fio, fonte 500W, licença do Office' },
  terceirizado: { label: 'Serviço terceirizado', waiting: 'Aguardando terceiro', item: 'Qual serviço foi acionado?', placeholder: 'Ex.: técnico da operadora de internet, assistência da impressora' },
};

const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const todayYmd = () => ymd(new Date());
export const addDaysYmd = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return ymd(d);
};

/** "sex., 28/11" a partir de AAAA-MM-DD */
export const fmtDay = (v) =>
  v ? new Date(`${v}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }) : '';

/** Quanto falta para o prazo: { days, text, overdue } */
export function dueInfo(due) {
  if (!due) return null;
  const days = Math.round((new Date(`${due}T12:00:00`) - new Date(`${todayYmd()}T12:00:00`)) / 864e5);
  if (days < 0) return { days, overdue: true, text: `atrasado ${-days} ${days === -1 ? 'dia' : 'dias'}` };
  if (days === 0) return { days, text: 'chega hoje', today: true };
  if (days === 1) return { days, text: 'chega amanhã' };
  return { days, text: `chega em ${days} dias` };
}

export const isStaff = (user) => user?.role === 'tecnico' || user?.role === 'admin';

export const fmtDate = (iso) =>
  iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '';

export const fmtTime = (iso) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

/** "hoje às 14:00", "amanhã às 09:00", "sex., 28/11 às 10:30" */
export function fmtWhen(iso) {
  const d = new Date(iso);
  const day = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(d) - day(new Date())) / 864e5);
  const time = fmtTime(iso);
  if (diff === 0) return `hoje às ${time}`;
  if (diff === 1) return `amanhã às ${time}`;
  return `${d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })} às ${time}`;
}

export function timeAgo(iso) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'agora';
  if (s < 3600) return `há ${Math.floor(s / 60)} min`;
  if (s < 86400) return `há ${Math.floor(s / 3600)} h`;
  const d = Math.floor(s / 86400);
  return d === 1 ? 'ontem' : d < 30 ? `há ${d} dias` : fmtDate(iso).split(' ')[0];
}

export const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
};

// Aceitam null/undefined: chamado novo ainda não tem técnico
export const firstName = (name) => String(name ?? '').split(/\s+/)[0];

export const initials = (name) =>
  String(name ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('');

export function fmtDuration(h) {
  if (h == null) return '—';
  if (h < 1) return `${Math.max(1, Math.round(h * 60))} min`;
  if (h < 48) return `${h.toFixed(1).replace('.', ',')} h`;
  return `${(h / 24).toFixed(1).replace('.', ',')} dias`;
}
