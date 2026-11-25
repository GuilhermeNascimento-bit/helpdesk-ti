/**
 * Banco de dados da demonstração: fica no localStorage do navegador de quem está testando.
 * Cada visitante tem a sua cópia; "restaurar" apaga e recria os dados de exemplo.
 */
const KEY = 'helpdesk_demo_v1';

export function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s?.users?.length) return s;
  } catch {
    /* dados corrompidos: recria */
  }
  const s = seed();
  save(s);
  return s;
}

export function save(s) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    const err = new Error('O armazenamento do navegador encheu. Restaure os dados da demonstração na tela de login.');
    err.status = 507;
    throw err;
  }
}

export function resetDemo() {
  localStorage.removeItem(KEY);
  save(seed());
}

export const nextId = (s, kind) => (s.seq[kind] = (s.seq[kind] || 0) + 1);

// ---------------------------------------------------------------- dados de exemplo

const H = 3600e3;
const D = 24 * H;

function seed() {
  const now = Date.now();
  const iso = (ms) => new Date(ms).toISOString();
  const ymd = (ms) => {
    const d = new Date(ms);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const s = { users: [], tickets: [], messages: [], seq: {} };

  const user = (name, email, password, role, department, location, approved = 1, createdMs = now - 30 * D) => {
    const id = nextId(s, 'user');
    s.users.push({ id, name, email, password, role, department, location, active: 1, approved, avatar_url: null, created_at: iso(createdMs) });
    return id;
  };
  const admin = user('Administrador', 'admin@empresa.com', 'admin123', 'admin', 'T.I', 'Sala da T.I');
  const carlos = user('Carlos Técnico', 'tecnico@empresa.com', 'tecnico123', 'tecnico', 'T.I', 'Sala da T.I');
  const ana = user('Ana Colaboradora', 'ana@empresa.com', 'ana123', 'colaborador', 'Financeiro', '2º andar - sala 204');
  const juliana = user('Juliana Rocha', 'juliana@empresa.com', 'juliana123', 'tecnico', 'T.I', 'Sala da T.I');
  const marcos = user('Marcos Pereira', 'marcos@empresa.com', 'marcos123', 'colaborador', 'Comercial', '1º andar, mesa 12');
  const fernanda = user('Fernanda Dias', 'fernanda@empresa.com', 'fernanda123', 'colaborador', 'RH', '3º andar, sala 301');
  const rafael = user('Rafael Costa', 'rafael@empresa.com', 'rafael123', 'colaborador', 'Logística', 'Galpão, expedição');
  user('Lucas Martins', 'lucas@empresa.com', 'lucas123', 'colaborador', 'Financeiro', '2º andar, sala 207', 0, now - 2 * H);
  void admin;

  const u = (id) => s.users.find((x) => x.id === id);
  const first = (id) => u(id).name.split(' ')[0];
  const msg = (ticket_id, user_id, body, ms) =>
    s.messages.push({
      id: nextId(s, 'message'), ticket_id, user_id, body, attachment_url: null, attachment_name: null, attachment_type: null,
      is_system: user_id ? 0 : 1, created_at: iso(ms),
    });

  /** Chamado com a sua conversa. `events`: [minutosDepoisDeAbrir, autor|null, texto] */
  function ticket(t, events = []) {
    const created = now - t.ago;
    const last = events.length ? created + events[events.length - 1][0] * 60e3 : created;
    const id = nextId(s, 'ticket');
    s.tickets.push({
      id, title: t.title, description: t.description, category: t.category ?? 'A classificar', priority: t.priority, status: t.status,
      location: u(t.requester).location, requester_id: t.requester, technician_id: t.tech ?? null,
      resolution_type: t.resolution_type ?? null, resolution_note: t.resolution_note ?? null, visit_at: t.visit_at ?? null,
      pending_type: t.pending_type ?? null, pending_item: t.pending_item ?? null, pending_due: t.pending_due ?? null, pending_since: t.pending_since ?? null,
      rating: t.rating ?? null, rating_comment: t.rating_comment ?? null,
      created_at: iso(created), updated_at: iso(Math.min(now, last)),
      resolved_at: t.resolvedMin != null ? iso(created + t.resolvedMin * 60e3) : null,
      closed_at: t.closedMin != null ? iso(created + t.closedMin * 60e3) : null,
    });
    msg(id, null, `Chamado aberto por ${u(t.requester).name}.`, created);
    for (const [min, who, body] of events) msg(id, who, body, Math.min(now - 60e3, created + min * 60e3));
    return id;
  }
  const took = (id) => `${u(id).name} assumiu o chamado.`;
  const loc = (id) => u(id).location;

  ticket(
    { title: 'Outlook pedindo senha toda hora', description: 'Desde ontem o Outlook fica pedindo a minha senha a cada poucos minutos.', category: 'E-mail', priority: 'media', status: 'fechado', requester: fernanda, tech: carlos, ago: 9 * D, resolution_type: 'online', resolution_note: 'Credencial antiga removida do Gerenciador de Credenciais e perfil do Outlook recriado.', resolvedMin: 95, closedMin: 180, rating: 5, rating_comment: 'Resolveu rapidinho pelo chat, obrigada!' },
    [[12, null, took(carlos)], [14, carlos, 'Oi Fernanda! Consigo acessar sua máquina remotamente agora?'], [16, fernanda, 'Pode sim!'], [95, null, `${u(carlos).name} marcou o chamado como resolvido remotamente (online).`], [180, null, `${u(fernanda).name} avaliou o atendimento com 5 estrelas e encerrou o chamado.`]]
  );
  ticket(
    { title: 'Monitor piscando', description: 'O segundo monitor fica piscando e apagando.', category: 'Hardware', priority: 'alta', status: 'fechado', requester: rafael, tech: juliana, ago: 6 * D, resolution_type: 'presencial', resolution_note: 'Cabo HDMI com mau contato substituído.', resolvedMin: 240, closedMin: 300, rating: 4 },
    [[30, null, took(juliana)], [45, null, `${u(juliana).name} está a caminho (${loc(rafael)}).`], [240, null, `${u(juliana).name} marcou o chamado como resolvido presencialmente.`]]
  );
  ticket(
    { title: 'Não consigo acessar a pasta do financeiro', description: 'Aparece "acesso negado" na pasta compartilhada do financeiro.', category: 'Acesso / Senha', priority: 'media', status: 'fechado', requester: ana, tech: carlos, ago: 3 * D, resolution_type: 'online', resolution_note: 'Usuária adicionada ao grupo de acesso da pasta.', resolvedMin: 40, closedMin: 70, rating: 5, rating_comment: 'Perfeito!' },
    [[8, null, took(carlos)], [40, null, `${u(carlos).name} marcou o chamado como resolvido remotamente (online).`]]
  );
  ticket(
    { title: 'Impressora atolando papel', description: 'A impressora do RH atola papel em quase toda impressão.', category: 'Impressora', priority: 'baixa', status: 'fechado', requester: fernanda, tech: juliana, ago: 12 * D, resolution_type: 'presencial', resolution_note: 'Rolete de tração limpo e bandeja ajustada.', resolvedMin: 600, closedMin: 1500, rating: 3, rating_comment: 'Resolveu, mas demorou um pouco.' },
    [[120, null, took(juliana)], [600, null, `${u(juliana).name} marcou o chamado como resolvido presencialmente.`]]
  );
  ticket(
    { title: 'Teclado com teclas falhando', description: 'Algumas teclas não funcionam, principalmente o A e o S.', category: 'Hardware', priority: 'media', status: 'fechado', requester: marcos, tech: carlos, ago: 5 * D, resolution_type: 'presencial', resolution_note: 'Teclado trocado por um novo do estoque.', resolvedMin: 90, closedMin: 120, rating: 5 },
    [[15, null, took(carlos)], [90, null, `${u(carlos).name} marcou o chamado como resolvido presencialmente.`]]
  );
  ticket(
    { title: 'Wi-Fi caindo na sala de reunião', description: 'A internet sem fio cai toda vez que começa uma chamada de vídeo na sala de reunião.', category: 'Rede / Internet', priority: 'alta', status: 'resolvido', requester: ana, tech: carlos, ago: 1 * D, resolution_type: 'online', resolution_note: 'Canal do roteador da sala alterado para evitar interferência. Teste uma chamada e me avise.', resolvedMin: 120 },
    [[10, null, took(carlos)], [12, carlos, 'Oi Ana! Em qual sala exatamente? Vou olhar o roteador daqui.'], [15, ana, 'Na sala de reunião grande do 2º andar.'], [120, null, `${u(carlos).name} marcou o chamado como resolvido remotamente (online).\nSolução: Canal do roteador da sala alterado para evitar interferência.`]]
  );
  ticket(
    { title: 'Excel travando ao abrir planilhas grandes', description: 'Quando abro a planilha de vendas o Excel trava e fecha sozinho.', category: 'Software', priority: 'media', status: 'em_atendimento', requester: ana, tech: carlos, ago: 3 * H },
    [[20, null, took(carlos)], [22, carlos, 'Oi Ana! Você sabe quantas linhas essa planilha tem, mais ou menos?'], [30, ana, 'Umas 200 mil linhas, com vários gráficos.'], [33, carlos, 'Entendi. Vou atualizar o Office aí e ativar a versão de 64 bits. Me avisa quando puder fechar o Excel.']]
  );
  ticket(
    { title: 'Computador desligando sozinho', description: 'O computador desliga do nada várias vezes por dia.', category: 'Hardware', priority: 'alta', status: 'aguardando', requester: marcos, tech: carlos, ago: 2 * D, pending_type: 'compra', pending_item: 'Fonte de alimentação 500W', pending_due: ymd(now + 3 * D), pending_since: iso(now - 2 * D + 3 * H) },
    [[25, null, took(carlos)], [90, null, `${u(carlos).name} está a caminho (${loc(marcos)}).`], [170, null, `${u(carlos).name} solicitou a compra de Fonte de alimentação 500W.\nPrazo de chegada: ${ymd(now + 3 * D)}.`], [175, carlos, 'Marcos, a fonte está queimando. Enquanto a nova não chega, deixei um notebook reserva na sua mesa.']]
  );
  ticket(
    { title: 'Internet muito lenta no galpão', description: 'A internet da expedição está muito lenta, não carrega o sistema de notas.', category: 'Rede / Internet', priority: 'urgente', status: 'aguardando', requester: rafael, tech: juliana, ago: 4 * D, pending_type: 'terceirizado', pending_item: 'Técnico da operadora de internet', pending_due: ymd(now - 1 * D), pending_since: iso(now - 4 * D + 2 * H) },
    [[15, null, took(juliana)], [120, null, `${u(juliana).name} solicitou um serviço terceirizado: Técnico da operadora de internet.\nPrazo de chegada: ${ymd(now - 1 * D)}.`]]
  );
  ticket(
    { title: 'Telefone do ramal 214 mudo', description: 'O telefone da minha mesa não dá linha.', category: 'Telefonia', priority: 'media', status: 'visita_agendada', requester: fernanda, tech: juliana, ago: 5 * H, visit_at: iso(now + 2 * H) },
    [[30, null, took(juliana)], [40, null, `${u(juliana).name} agendou uma visita presencial para hoje (${loc(fernanda)}).`], [41, juliana, `Oi ${first(fernanda)}! Passo aí hoje à tarde para testar o cabo e a porta da rede.`]]
  );
  ticket({ title: 'Sistema de vendas fora do ar para todo o comercial', description: 'Ninguém do comercial consegue entrar no sistema de vendas, aparece erro de conexão.', priority: 'urgente', status: 'aberto', requester: marcos, ago: 20 * 60e3 });
  ticket({ title: 'Impressora imprimindo tudo borrado', description: 'A impressora do 3º andar está imprimindo com manchas.', priority: 'media', status: 'aberto', requester: fernanda, ago: 2 * H });
  ticket({ title: 'Mouse dando clique duplo', description: 'Quando clico uma vez o mouse clica duas.', priority: 'baixa', status: 'aberto', requester: rafael, ago: 1 * D });
  ticket(
    { title: 'Computador lento', description: 'O computador está muito lento hoje.', priority: 'baixa', status: 'cancelado', requester: ana, ago: 8 * D, closedMin: 50 },
    [[50, null, `${u(ana).name} cancelou o chamado.\nMotivo: voltou a funcionar depois de reiniciar.`]]
  );
  return s;
}
