/**
 * Modo demonstração (DEMO_MODE=1): usado no site público do portfólio.
 *  - preenche o banco vazio com chamados de exemplo em todas as situações;
 *  - impede que visitantes alterem as contas de demonstração.
 * Em hospedagem gratuita o disco é apagado a cada reinício, então tudo volta ao estado inicial sozinho.
 */
import bcrypt from 'bcryptjs';
import { db } from './db.js';

export const DEMO_MODE = process.env.DEMO_MODE === '1';

export const DEMO_EMAILS = [
  'admin@empresa.com',
  'tecnico@empresa.com',
  'ana@empresa.com',
  'juliana@empresa.com',
  'marcos@empresa.com',
  'fernanda@empresa.com',
  'rafael@empresa.com',
];
export const isDemoAccount = (email) => DEMO_MODE && DEMO_EMAILS.includes(String(email).toLowerCase());

const H = 3600e3;
const D = 24 * H;

export function seedDemo() {
  if (!DEMO_MODE) return;
  if (db.prepare('SELECT COUNT(*) AS n FROM tickets').get().n > 0) return;

  const now = Date.now();
  const iso = (ms) => new Date(ms).toISOString();
  const ymd = (ms) => new Date(ms).toISOString().slice(0, 10);

  // ---------- pessoas ----------
  const addUser = (name, email, pass, role, dept, loc, approved = 1, createdMs = now - 30 * D) => {
    const found = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (found) return found.id;
    const r = db
      .prepare(
        'INSERT INTO users (name, email, password_hash, role, department, location, active, approved, created_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)'
      )
      .run(name, email, bcrypt.hashSync(pass, 10), role, dept, loc, approved, iso(createdMs));
    return Number(r.lastInsertRowid);
  };
  const id = (email) => db.prepare('SELECT id FROM users WHERE email = ?').get(email).id;

  const carlos = id('tecnico@empresa.com');
  const ana = id('ana@empresa.com');
  const juliana = addUser('Juliana Rocha', 'juliana@empresa.com', 'juliana123', 'tecnico', 'T.I', 'Sala da T.I');
  const marcos = addUser('Marcos Pereira', 'marcos@empresa.com', 'marcos123', 'colaborador', 'Comercial', '1º andar, mesa 12');
  const fernanda = addUser('Fernanda Dias', 'fernanda@empresa.com', 'fernanda123', 'colaborador', 'RH', '3º andar, sala 301');
  const rafael = addUser('Rafael Costa', 'rafael@empresa.com', 'rafael123', 'colaborador', 'Logística', 'Galpão, expedição');
  addUser('Lucas Martins', 'lucas@empresa.com', 'lucas123', 'colaborador', 'Financeiro', '2º andar, sala 207', 0, now - 2 * H);

  const names = Object.fromEntries(db.prepare('SELECT id, name FROM users').all().map((u) => [u.id, u.name]));
  const first = (uid) => names[uid].split(' ')[0];

  // ---------- chamados ----------
  const insTicket = db.prepare(`
    INSERT INTO tickets (title, description, category, priority, status, location, requester_id, technician_id,
      resolution_type, resolution_note, visit_at, pending_type, pending_item, pending_due, pending_since,
      rating, rating_comment, created_at, updated_at, resolved_at, closed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const insMsg = db.prepare(
    'INSERT INTO messages (ticket_id, user_id, body, is_system, created_at) VALUES (?, ?, ?, ?, ?)'
  );
  const loc = (uid) => db.prepare('SELECT location FROM users WHERE id = ?').get(uid).location;

  /** Cria um chamado com a sua conversa. `events`: [minutosDepoisDeAbrir, autor|null, texto] */
  function ticket(t, events = []) {
    const created = now - t.ago;
    const last = events.length ? created + events[events.length - 1][0] * 60e3 : created;
    const r = insTicket.run(
      t.title, t.description, t.category ?? 'A classificar', t.priority, t.status, loc(t.requester), t.requester, t.tech ?? null,
      t.resolution_type ?? null, t.resolution_note ?? null, t.visit_at ?? null,
      t.pending_type ?? null, t.pending_item ?? null, t.pending_due ?? null, t.pending_since ?? null,
      t.rating ?? null, t.rating_comment ?? null,
      iso(created), iso(Math.min(now, last)),
      t.resolvedMin != null ? iso(created + t.resolvedMin * 60e3) : null,
      t.closedMin != null ? iso(created + t.closedMin * 60e3) : null
    );
    const tid = Number(r.lastInsertRowid);
    insMsg.run(tid, null, `Chamado aberto por ${names[t.requester]}.`, 1, iso(created));
    for (const [min, who, body] of events) insMsg.run(tid, who, body, who ? 0 : 1, iso(Math.min(now - 60e3, created + min * 60e3)));
    return tid;
  }
  const took = (uid) => `${names[uid]} assumiu o chamado.`;

  // Encerrados e avaliados (alimentam o painel e o desempenho dos técnicos)
  ticket(
    { title: 'Outlook pedindo senha toda hora', description: 'Desde ontem o Outlook fica pedindo a minha senha a cada poucos minutos.', category: 'E-mail', priority: 'media', status: 'fechado', requester: fernanda, tech: carlos, ago: 9 * D, resolution_type: 'online', resolution_note: 'Credencial antiga removida do Gerenciador de Credenciais e perfil do Outlook recriado.', resolvedMin: 95, closedMin: 180, rating: 5, rating_comment: 'Resolveu rapidinho pelo chat, obrigada!' },
    [[12, null, took(carlos)], [14, carlos, 'Oi Fernanda! Consigo acessar sua máquina remotamente agora?'], [16, fernanda, 'Pode sim!'], [95, null, `${names[carlos]} marcou o chamado como resolvido remotamente (online).`], [180, null, `${names[fernanda]} avaliou o atendimento com 5 estrelas e encerrou o chamado.`]]
  );
  ticket(
    { title: 'Monitor piscando', description: 'O segundo monitor fica piscando e apagando.', category: 'Hardware', priority: 'alta', status: 'fechado', requester: rafael, tech: juliana, ago: 6 * D, resolution_type: 'presencial', resolution_note: 'Cabo HDMI com mau contato substituído.', resolvedMin: 240, closedMin: 300, rating: 4 },
    [[30, null, took(juliana)], [45, null, `${names[juliana]} está a caminho (${loc(rafael)}).`], [240, null, `${names[juliana]} marcou o chamado como resolvido presencialmente.`]]
  );
  ticket(
    { title: 'Não consigo acessar a pasta do financeiro', description: 'Aparece "acesso negado" na pasta compartilhada do financeiro.', category: 'Acesso / Senha', priority: 'media', status: 'fechado', requester: ana, tech: carlos, ago: 3 * D, resolution_type: 'online', resolution_note: 'Usuária adicionada ao grupo de acesso da pasta.', resolvedMin: 40, closedMin: 70, rating: 5, rating_comment: 'Perfeito!' },
    [[8, null, took(carlos)], [40, null, `${names[carlos]} marcou o chamado como resolvido remotamente (online).`]]
  );
  ticket(
    { title: 'Impressora atolando papel', description: 'A impressora do RH atola papel em quase toda impressão.', category: 'Impressora', priority: 'baixa', status: 'fechado', requester: fernanda, tech: juliana, ago: 12 * D, resolution_type: 'presencial', resolution_note: 'Rolete de tração limpo e bandeja ajustada.', resolvedMin: 600, closedMin: 1500, rating: 3, rating_comment: 'Resolveu, mas demorou um pouco.' },
    [[120, null, took(juliana)], [600, null, `${names[juliana]} marcou o chamado como resolvido presencialmente.`]]
  );
  ticket(
    { title: 'Teclado com teclas falhando', description: 'Algumas teclas não funcionam, principalmente o A e o S.', category: 'Hardware', priority: 'media', status: 'fechado', requester: marcos, tech: carlos, ago: 5 * D, resolution_type: 'presencial', resolution_note: 'Teclado trocado por um novo do estoque.', resolvedMin: 90, closedMin: 120, rating: 5 },
    [[15, null, took(carlos)], [90, null, `${names[carlos]} marcou o chamado como resolvido presencialmente.`]]
  );

  // Resolvido, esperando a Ana avaliar (o recrutador pode avaliar entrando como colaboradora)
  ticket(
    { title: 'Wi-Fi caindo na sala de reunião', description: 'A internet sem fio cai toda vez que começa uma chamada de vídeo na sala de reunião.', category: 'Rede / Internet', priority: 'alta', status: 'resolvido', requester: ana, tech: carlos, ago: 1 * D, resolution_type: 'online', resolution_note: 'Canal do roteador da sala alterado para evitar interferência. Teste uma chamada e me avise.', resolvedMin: 120 },
    [[10, null, took(carlos)], [12, carlos, 'Oi Ana! Em qual sala exatamente? Vou olhar o roteador daqui.'], [15, ana, 'Na sala de reunião grande do 2º andar.'], [120, null, `${names[carlos]} marcou o chamado como resolvido remotamente (online).\nSolução: Canal do roteador da sala alterado para evitar interferência.`]]
  );

  // Em atendimento, com conversa (a Ana vê o chat ativo)
  ticket(
    { title: 'Excel travando ao abrir planilhas grandes', description: 'Quando abro a planilha de vendas o Excel trava e fecha sozinho.', category: 'Software', priority: 'media', status: 'em_atendimento', requester: ana, tech: carlos, ago: 3 * H },
    [[20, null, took(carlos)], [22, carlos, 'Oi Ana! Você sabe quantas linhas essa planilha tem, mais ou menos?'], [30, ana, 'Umas 200 mil linhas, com vários gráficos.'], [33, carlos, 'Entendi. Vou atualizar o Office aí e ativar a versão de 64 bits. Me avisa quando puder fechar o Excel.']]
  );

  // Aguardando compra e aguardando terceiro (um com prazo vencido)
  ticket(
    { title: 'Computador desligando sozinho', description: 'O computador desliga do nada várias vezes por dia.', category: 'Hardware', priority: 'alta', status: 'aguardando', requester: marcos, tech: carlos, ago: 2 * D, pending_type: 'compra', pending_item: 'Fonte de alimentação 500W', pending_due: ymd(now + 3 * D), pending_since: iso(now - 2 * D + 3 * H) },
    [[25, null, took(carlos)], [90, null, `${names[carlos]} está a caminho (${loc(marcos)}).`], [170, null, `${names[carlos]} solicitou a compra de Fonte de alimentação 500W.\nPrazo de chegada: ${ymd(now + 3 * D)}.`], [175, carlos, 'Marcos, a fonte está queimando. Enquanto a nova não chega, deixei um notebook reserva na sua mesa.']]
  );
  ticket(
    { title: 'Internet muito lenta no galpão', description: 'A internet da expedição está muito lenta, não carrega o sistema de notas.', category: 'Rede / Internet', priority: 'urgente', status: 'aguardando', requester: rafael, tech: juliana, ago: 4 * D, pending_type: 'terceirizado', pending_item: 'Técnico da operadora de internet', pending_due: ymd(now - 1 * D), pending_since: iso(now - 4 * D + 2 * H) },
    [[15, null, took(juliana)], [120, null, `${names[juliana]} solicitou um serviço terceirizado: Técnico da operadora de internet.\nPrazo de chegada: ${ymd(now - 1 * D)}.`]]
  );

  // Visita agendada
  ticket(
    { title: 'Telefone do ramal 214 mudo', description: 'O telefone da minha mesa não dá linha.', category: 'Telefonia', priority: 'media', status: 'visita_agendada', requester: fernanda, tech: juliana, ago: 5 * H, visit_at: iso(now + 2 * H) },
    [[30, null, took(juliana)], [40, null, `${names[juliana]} agendou uma visita presencial para hoje (${loc(fernanda)}).`], [41, juliana, `Oi ${first(fernanda)}! Passo aí hoje à tarde para testar o cabo e a porta da rede.`]]
  );

  // Na fila, esperando um técnico (o recrutador pode assumir entrando como técnico)
  ticket({ title: 'Sistema de vendas fora do ar para todo o comercial', description: 'Ninguém do comercial consegue entrar no sistema de vendas, aparece erro de conexão.', priority: 'urgente', status: 'aberto', requester: marcos, ago: 20 * 60e3 });
  ticket({ title: 'Impressora imprimindo tudo borrado', description: 'A impressora do 3º andar está imprimindo com manchas.', priority: 'media', status: 'aberto', requester: fernanda, ago: 2 * H });
  ticket({ title: 'Mouse dando clique duplo', description: 'Quando clico uma vez o mouse clica duas.', priority: 'baixa', status: 'aberto', requester: rafael, ago: 1 * D });

  // Cancelado
  ticket(
    { title: 'Computador lento', description: 'O computador está muito lento hoje.', priority: 'baixa', status: 'cancelado', requester: ana, ago: 8 * D, closedMin: 50 },
    [[50, null, `${names[ana]} cancelou o chamado.\nMotivo: voltou a funcionar depois de reiniciar.`]]
  );

  console.log('[demo] Dados de demonstração criados.');
}
