/**
 * Tradução PT → EN.
 * O app é escrito em português; quando o idioma é inglês, uma camada observa a tela
 * e troca os textos (e placeholders/títulos) pelos equivalentes em inglês.
 * Textos digitados pelas pessoas (títulos, mensagens, descrições) nunca são traduzidos.
 */

const EN = {
  // Navegação e estrutura
  'Helpdesk T.I': 'IT Helpdesk',
  'Abrir chamado': 'New ticket',
  'Meus chamados': 'My tickets',
  'Painel': 'Dashboard',
  'Fila': 'Queue',
  'Meus atendimentos': 'My assignments',
  'Todos os chamados': 'All tickets',
  'Meu desempenho': 'My performance',
  'Usuários': 'Users',
  'Pendências': 'Pending items',
  'Sair': 'Sign out',
  'Voltar': 'Back',
  'Colaborador': 'Employee',
  'Técnico': 'Technician',
  'Administrador': 'Administrator',
  'Admin': 'Admin',
  'Reconectando…': 'Reconnecting…',
  'Conectado': 'Connected',
  'Preferências': 'Preferences',
  'Tema': 'Theme',
  'Claro': 'Light',
  'Escuro': 'Dark',
  'Sistema': 'System',
  'Idioma': 'Language',
  'Visual': 'Visual style',
  'Completo': 'Full',
  'Leve': 'Lite',
  'Animações, efeitos e transições': 'Animations, effects and transitions',
  'Sem animações nem efeitos, mais rápido': 'No animations or effects, faster',
  'Segue o tema do computador': 'Follows your computer theme',

  // Login
  'Entrar': 'Sign in',
  'Use seu e-mail da empresa.': 'Use your company email.',
  'E-mail': 'Email',
  'Senha': 'Password',
  'Contas de demonstração': 'Demo accounts',
  'Equipe de T.I interna': 'In-house IT team',
  'Deu problema? A T.I resolve.': 'Something broke? IT fixes it.',
  'Descreva o problema, converse com o técnico pelo chat e acompanhe cada passo até a solução.':
    'Describe the problem, chat with a technician and follow every step until it is fixed.',
  'A internet caiu no meu computador': 'My computer lost internet',
  'Chamado enviado para a T.I': 'Ticket sent to IT',
  'Carlos assumiu e está no chat': 'Carlos took it and is on the chat',
  'Carlos está a caminho da sua mesa': 'Carlos is on the way to your desk',
  'Cabo de rede trocado, tudo certo': 'Network cable replaced, all good',
  'Avaliado com 5 estrelas': 'Rated 5 stars',
  'E-mail ou senha incorretos.': 'Wrong email or password.',
  'Usuário desativado. Fale com o administrador.': 'User disabled. Contact the administrator.',

  // Status e prioridade
  'Aberto': 'Open',
  'Em atendimento': 'In progress',
  'Visita agendada': 'Visit scheduled',
  'Resolvido': 'Resolved',
  'Fechado': 'Closed',
  'Cancelado': 'Cancelled',
  'Com técnico': 'With tech',
  'Visita': 'Visit',
  'Aguardando': 'Waiting',
  'Aguardando item': 'Waiting for item',
  'Baixa': 'Low',
  'Média': 'Medium',
  'Alta': 'High',
  'Urgente': 'Urgent',
  'Dá pra esperar': 'It can wait',
  'Está atrapalhando': 'It gets in the way',
  'Parei de trabalhar': "I can't work",
  'Afeta muita gente': 'Affects many people',
  'Incomoda, mas consigo trabalhar': "Annoying, but I can work",
  'Estou contornando por enquanto': "I'm working around it for now",
  'Não consigo fazer minhas tarefas': "I can't do my tasks",
  'Setor parado ou cliente esperando': 'Team blocked or customer waiting',
  'A classificar': 'Unclassified',
  'Hardware': 'Hardware',
  'Software': 'Software',
  'Rede / Internet': 'Network / Internet',
  'Acesso / Senha': 'Access / Password',
  'Impressora': 'Printer',
  'Telefonia': 'Phones',
  'Outros': 'Other',

  // Tela inicial do colaborador
  'Bom dia': 'Good morning',
  'Boa tarde': 'Good afternoon',
  'Boa noite': 'Good evening',
  'Algo não está funcionando? Conte aqui e a T.I recebe na hora.': "Something isn't working? Tell us here and IT gets it right away.",
  'Continuar': 'Continue',
  'A internet não está funcionando': "The internet isn't working",
  'Esqueci minha senha': 'I forgot my password',
  'A impressora não imprime': "The printer won't print",
  'O computador está lento': 'The computer is slow',
  'O computador está muito lento': 'The computer is very slow',
  'Esperando sua confirmação': 'Waiting for your confirmation',
  'Em andamento': 'In progress',
  'Histórico': 'History',
  'Avaliar e encerrar': 'Rate and close',
  'Nada pendente': 'Nothing pending',
  'Quando você abrir um chamado, ele aparece aqui com cada passo do atendimento.': 'When you open a ticket, it shows up here with every step.',
  'Na fila, esperando um técnico': 'In the queue, waiting for a technician',
  'Você ainda não abriu nenhum chamado': "You haven't opened any tickets yet",
  'Use a caixa lá em cima: descreva o problema do seu jeito.': 'Use the box above: describe the problem in your own words.',

  // Abrir chamado
  'Explique do seu jeito. O técnico entende e organiza o resto.': 'Explain it your way. The technician sorts out the rest.',
  'O que está acontecendo?': "What's happening?",
  'Quanto isso está te atrapalhando?': 'How much is this getting in your way?',
  'Print ou foto do problema': 'Screenshot or photo',
  'Escolher arquivo': 'Choose file',
  'ou cole com Ctrl+V': 'or paste with Ctrl+V',
  'Onde você está': 'Where you are',
  'alterar': 'change',
  'Enviar chamado': 'Send ticket',
  'Solte o arquivo para anexar': 'Drop the file to attach',
  'Depois de enviar': 'After you send it',
  'A T.I recebe na hora': 'IT gets it right away',
  'Um técnico assume e você é avisado.': 'A technician takes it and you get notified.',
  'Vocês conversam pelo chat': 'You talk on the chat',
  'Ele pode pedir um print ou te orientar.': 'They may ask for a screenshot or guide you.',
  'Resolve à distância ou vai até você': 'Fixed remotely or at your desk',
  'Você acompanha cada passo na tela inicial.': 'You follow every step on the home screen.',
  'Ajuda a resolver mais rápido': 'Helps fix it faster',
  'A mensagem de erro, se aparecer': 'The error message, if any',
  'Desde quando acontece': 'Since when it happens',
  'O que você já tentou': "What you've already tried",
  'A equipe de T.I já foi avisada. Abrindo a conversa…': 'The IT team has been notified. Opening the chat…',

  // Listas
  'Chamado': 'Ticket',
  'Prioridade': 'Priority',
  'Local': 'Location',
  'Andamento': 'Progress',
  'Situação': 'Status',
  'Esperando há': 'Waiting for',
  'Assumir': 'Take',
  'Ninguém': 'Nobody',
  'Sem categoria': 'Unclassified',
  'Aguardando confirmação': 'Awaiting confirmation',
  'Encerrados': 'Closed',
  'Todos': 'All',
  'Tudo que chegou para a T.I.': 'Everything that reached IT.',
  'Esperando alguém assumir. Os mais urgentes ficam no topo.': 'Waiting for someone to take it. Most urgent on top.',
  'Chamados que estão com você agora.': 'Tickets assigned to you right now.',
  'Chamados que eu abri': 'Tickets I opened',
  'Pedidos que você mesmo fez para a T.I.': 'Requests you made to IT yourself.',
  'Fila zerada': 'Queue is empty',
  'Nada encontrado': 'Nothing found',
  'Nenhum chamado aqui': 'No tickets here',
  'Ninguém esperando atendimento. Chamados novos aparecem aqui na hora.': 'Nobody waiting. New tickets show up here instantly.',
  'Troque o filtro acima para ver outros chamados.': 'Change the filter above to see other tickets.',

  // Detalhe / chat
  'Agora': 'Now',
  'Atendimento': 'Handling',
  'Detalhes': 'Details',
  'Quem abriu': 'Opened by',
  'Aberto em': 'Opened',
  'Atualizado': 'Updated',
  'Ninguém ainda': 'Nobody yet',
  'Escreva uma mensagem': 'Write a message',
  'Enter envia · Shift+Enter pula linha · Ctrl+V cola print': 'Enter sends · Shift+Enter new line · Ctrl+V pastes screenshot',
  'Chamado encerrado. Se o problema voltar, abra um novo chamado.': 'Ticket closed. If the problem comes back, open a new ticket.',
  'Assumir chamado': 'Take ticket',
  'Assumir para mim': 'Take it myself',
  'Classifique este chamado': 'Classify this ticket',
  'Categoria': 'Category',
  'À distância ou já fui até lá': "Remotely, or I've already been there",
  'Vou até lá': "I'll go there",
  'Mudar horário da visita': 'Change visit time',
  'Ir até o colaborador': 'Go to the employee',
  'Quando você vai? Um clique e o colaborador já é avisado.': 'When are you going? One click and the employee is notified.',
  'Estou indo agora': "I'm going now",
  'Em 30 min': 'In 30 min',
  'Em 1 hora': 'In 1 hour',
  'Hoje às 14h': 'Today at 2pm',
  'Hoje às 16h': 'Today at 4pm',
  'Amanhã às 9h': 'Tomorrow at 9am',
  'Outro horário': 'Other time',
  'Agendar': 'Schedule',
  'Recado para o colaborador (opcional)': 'Note for the employee (optional)',
  'À distância': 'Remote',
  'Presencial': 'On site',
  'O que você fez para resolver?': 'What did you do to fix it?',
  'Marcar como resolvido': 'Mark as resolved',
  'Cancelar chamado': 'Cancel ticket',
  'Reabrir chamado': 'Reopen ticket',
  'Funcionou?': 'Did it work?',
  'Dê uma nota para o atendimento e encerre o chamado.': 'Rate the service and close the ticket.',
  'Encerrar chamado': 'Close ticket',
  'Ainda não funcionou': 'Still not working',
  'O que ainda está errado?': "What's still wrong?",
  'Obrigado pela avaliação!': 'Thanks for the rating!',
  'Chamado encerrado.': 'Ticket closed.',
  'Chamado cancelado.': 'Ticket cancelled.',
  'Seu chamado está na fila. Um técnico vai assumir em breve.': 'Your ticket is in the queue. A technician will take it soon.',
  'Esperando um técnico assumir.': 'Waiting for a technician.',
  'está cuidando do seu chamado. Fale com ele(a) pelo chat.': 'is handling your ticket. Talk to them on the chat.',
  'está cuidando deste chamado.': 'is handling this ticket.',
  'descreveu o problema': 'described the problem',
  'Quer deixar um elogio? (opcional)': 'Want to leave a compliment? (optional)',
  'O que poderia ter sido melhor? (opcional)': 'What could have been better? (optional)',
  'Anexar print ou arquivo': 'Attach screenshot or file',
  'Remover anexo': 'Remove attachment',
  'Enviar (Enter)': 'Send (Enter)',
  'Chamado não encontrado': 'Ticket not found',
  'Esta tela teve um problema': 'This screen hit a problem',
  'O resto do sistema continua funcionando. Volte para a página anterior ou recarregue.': 'The rest of the system still works. Go back or reload.',
  'Recarregar': 'Reload',

  // Métricas
  'Atendidos no total': 'Handled in total',
  'atendidos no total': 'handled in total',
  'em andamento agora': 'in progress now',
  'tempo médio até resolver': 'average time to resolve',
  'Tempo médio até resolver': 'Average time to resolve',
  'Resolvidos por dia': 'Resolved per day',
  'Últimos 14 dias': 'Last 14 days',
  'Como você resolveu': 'How you solved them',
  'Chamados resolvidos e fechados': 'Resolved and closed tickets',
  'Suas notas': 'Your ratings',
  'Quantas vezes recebeu cada nota': 'How often you got each rating',
  'O que disseram': 'What people said',
  'Sem comentário': 'No comment',
  'Nenhum atendimento ainda': 'No tickets handled yet',
  'Ver a fila': 'See the queue',
  'Assuma um chamado da fila e seus números aparecem aqui.': 'Take a ticket from the queue and your numbers show up here.',
  'Na fila, sem técnico': 'In queue, unassigned',
  'Ver fila': 'See queue',
  'Satisfação': 'Satisfaction',
  'Chamados abertos por dia': 'Tickets opened per day',
  'Resolvidos à distância': 'Resolved remotely',
  'Quanto menos visitas, mais rápido': 'Fewer visits, faster fixes',
  'Por status': 'By status',
  'Por categoria': 'By category',
  'Definida pelo técnico': 'Set by the technician',
  'Equipe técnica': 'Tech team',
  'Resolvidos': 'Resolved',
  'Nota': 'Rating',
  'Sem dados ainda.': 'No data yet.',

  // Usuários
  'Novo usuário': 'New user',
  'Editar usuário': 'Edit user',
  'Colaboradores, técnicos e administradores.': 'Employees, technicians and administrators.',
  'Nome': 'Name',
  'Perfil': 'Role',
  'Setor': 'Department',
  'Abriu': 'Opened',
  'Atendeu': 'Handled',
  'Status': 'Status',
  'Editar': 'Edit',
  'Ativo': 'Active',
  'Inativo': 'Inactive',
  'Local de trabalho': 'Workplace',
  'Senha inicial': 'Initial password',
  'Nova senha (deixe em branco para manter)': 'New password (leave blank to keep)',
  'Usuário ativo (pode entrar no sistema)': 'Active user (can sign in)',
  'Cancelar': 'Cancel',
  'Salvar': 'Save',

  // Compras e serviços terceirizados
  'Compra': 'Purchase',
  'Serviço terceirizado': 'Outsourced service',
  'Aguardando compra': 'Waiting for purchase',
  'Aguardando terceiro': 'Waiting for vendor',
  'Aguardando compra ou terceiro': 'Waiting for purchase or vendor',
  'O que vai ser comprado?': 'What will be purchased?',
  'Precisa comprar ou terceirizar': 'Need to buy or outsource',
  'Registrar o item ou serviço e o prazo': 'Log the item or service and the due date',
  'Prazo para chegar': 'Expected by',
  'Prazo': 'Due',
  'Chegou, retomar atendimento': 'It arrived, resume',
  'Serviço feito, retomar': 'Service done, resume',
  'Tem pendência atrasada': 'There is an overdue item',
  'Seu chamado está aguardando um item ou serviço. Veja o prazo.': 'Your ticket is waiting for an item or service. Check the due date.',
  'O prazo passou. O técnico já foi avisado; você pode perguntar pelo chat.': 'The due date has passed. The technician was notified; you can ask on the chat.',
  'Tempo decorrido até o prazo': 'Time elapsed until due date',
  'Chamados esperando uma compra ou um serviço terceirizado. Os prazos mais próximos ficam no topo.':
    'Tickets waiting for a purchase or outsourced service. Nearest due dates on top.',
  'Nenhum chamado esperando compra ou serviço terceirizado.': 'No tickets waiting for a purchase or outsourced service.',

  // Cadastro e aprovação
  'Criar conta': 'Create account',
  'O administrador da T.I aprova o seu acesso.': 'The IT administrator approves your access.',
  'Nome completo': 'Full name',
  'Setor': 'Department',
  'Onde você trabalha': 'Where you work',
  'E-mail da empresa': 'Company email',
  'Crie uma senha': 'Create a password',
  'Pelo menos 6 caracteres.': 'At least 6 characters.',
  'Enviar cadastro': 'Send sign-up',
  'Já tem conta?': 'Already have an account?',
  'Ainda não tem conta?': "Don't have an account?",
  'Cadastro enviado': 'Sign-up sent',
  'Voltar para o login': 'Back to sign in',
  'Seu cadastro ainda está aguardando a aprovação do administrador.': 'Your sign-up is still waiting for administrator approval.',
  'Informe seu nome e sobrenome.': 'Enter your first and last name.',
  'Informe o seu setor.': 'Enter your department.',
  'Informe onde você trabalha (andar, sala ou mesa).': 'Enter where you work (floor, room or desk).',
  'Já existe uma conta com esse e-mail. Tente entrar.': 'An account with this email already exists. Try signing in.',
  'Esse e-mail já tem um cadastro aguardando aprovação.': 'This email already has a sign-up waiting for approval.',
  'Cadastros aguardando aprovação': 'Sign-ups waiting for approval',
  'Pediu acesso': 'Requested',
  'Recusar': 'Decline',
  'Aprovar': 'Approve',
  'Perfil': 'Role',
  'Novo cadastro para aprovar': 'New sign-up to approve',
  'Conectado em tempo real': 'Connected in real time',

  'Entre com um clique para conhecer o sistema:': 'Sign in with one click to try the system:',
  'Site de demonstração: os dados voltam ao estado inicial de tempos em tempos.': 'Demo site: data resets to its initial state from time to time.',
  'Esta é uma conta de demonstração: e-mail, perfil, senha e status não podem ser alterados.':
    "This is a demo account: email, role, password and status can't be changed.",

  // Configurações
  'Configurações': 'Settings',
  'Todas as configurações': 'All settings',
  'Minhas configurações': 'My settings',
  'Ajuste sua conta e o sistema do seu jeito. As mudanças são salvas na hora.': 'Set up your account and the system your way. Changes are saved instantly.',
  'Perfil': 'Profile',
  'Foto, nome, setor e local': 'Photo, name, department and location',
  'Segurança': 'Security',
  'Trocar a senha': 'Change password',
  'Aparência': 'Appearance',
  'Tema, idioma, cor e visual': 'Theme, language, color and style',
  'Notificações': 'Notifications',
  'Avisos, som e Windows': 'Alerts, sound and desktop',
  'É assim que a equipe de T.I e os colegas veem você nos chamados.': 'This is how the IT team and coworkers see you on tickets.',
  'Trocar foto': 'Change photo',
  'Adicionar foto': 'Add photo',
  'Remover': 'Remove',
  'Já vem preenchido quando você abre um chamado.': 'Pre-filled when you open a ticket.',
  'E-mail': 'Email',
  'Para trocar o e-mail, fale com o administrador.': 'To change your email, contact the administrator.',
  'Desfazer': 'Undo',
  'Salvar perfil': 'Save profile',
  'Perfil salvo': 'Profile saved',
  'Foto atualizada': 'Photo updated',
  'Escolha uma imagem': 'Choose an image',
  'Imagem muito grande': 'Image too large',
  'Troque a sua senha sempre que achar necessário.': 'Change your password whenever you need to.',
  'Senha atual': 'Current password',
  'Nova senha': 'New password',
  'Confirme a nova senha': 'Confirm the new password',
  'As senhas não são iguais.': "Passwords don't match.",
  'A confirmação não é igual à nova senha.': "The confirmation doesn't match the new password.",
  'Trocar senha': 'Change password',
  'Senha alterada': 'Password changed',
  'Use a nova senha no próximo login.': 'Use the new password next time you sign in.',
  'Senha atual incorreta.': 'Current password is incorrect.',
  'A senha das contas de demonstração não pode ser trocada.': "Demo account passwords can't be changed.",
  'Curta demais (mínimo 6)': 'Too short (min. 6)',
  'Fraca': 'Weak',
  'Razoável': 'Fair',
  'Boa': 'Good',
  'Forte': 'Strong',
  'Vale só para este navegador. Em outro computador, você escolhe de novo.': 'Applies to this browser only. On another computer, choose again.',
  'Escolha como quer ser avisado quando algo acontece nos seus chamados.': 'Choose how you want to be alerted when something happens on your tickets.',
  'Avisos na tela': 'On-screen alerts',
  'Novos chamados, mensagens e mudanças aparecem no canto da tela.': 'New tickets, messages and changes show up in the corner of the screen.',
  'Testar': 'Test',
  'Assim é um aviso': 'This is what an alert looks like',
  'Clique nele para abrir o chamado.': 'Click it to open the ticket.',
  'Som ao receber um aviso': 'Sound on new alerts',
  'Um toque curto, útil quando você está em outra janela.': "A short chime, handy when you're in another window.",
  'Ouvir': 'Play',
  'Notificações do Windows': 'Desktop notifications',
  'Avisa mesmo quando a aba do Helpdesk está minimizada ou em segundo plano.': 'Alerts you even when the Helpdesk tab is minimized or in the background.',
  'Bloqueadas pelo navegador. Libere no cadeado ao lado do endereço do site.': 'Blocked by the browser. Allow them from the lock icon next to the address.',
  'Este navegador não suporta notificações.': "This browser doesn't support notifications.",
  'O navegador bloqueou as notificações': 'The browser blocked notifications',
  'Abrir chamado ': 'New ticket ',

  'Demonstração: tudo roda no seu navegador e as mudanças ficam só aqui. Abra duas abas, uma como Técnico e outra como Colaborador, para ver o chat em tempo real.':
    'Demo: everything runs in your browser and changes stay here. Open two tabs, one as Technician and one as Employee, to see the real-time chat.',
  'Restaurar dados de exemplo': 'Restore sample data',
  'Na demonstração, PDFs e textos podem ter até 1,5 MB.': 'In the demo, PDFs and text files can be up to 1.5 MB.',
  'O armazenamento do navegador encheu. Restaure os dados da demonstração na tela de login.': 'Browser storage is full. Restore the demo data on the sign-in screen.',

  // Cores do site
  'Cor do site': 'Site color',
  'Petróleo': 'Petrol',
  'Azul': 'Blue',
  'Índigo': 'Indigo',
  'Roxo': 'Purple',
  'Rosa': 'Pink',
  'Vermelho': 'Red',
  'Laranja': 'Orange',
  'Mostarda': 'Mustard',
  'Verde': 'Green',
  'Grafite': 'Graphite',
  'Escolher outra cor': 'Pick another color',
  'Cor personalizada': 'Custom color',
  'voltar ao padrão': 'reset to default',

  // Placeholders
  'Buscar por assunto, nome ou número': 'Search by subject, name or number',
  'Buscar por nome, e-mail ou setor': 'Search by name, email or department',
  'Ex.: minha internet caiu e não consigo abrir o sistema': "e.g. my internet dropped and I can't open the system",
  'Ex.: Desde hoje cedo o computador não conecta na internet. Aparece um globo com um X no canto da tela.':
    "e.g. Since this morning my computer can't connect to the internet. A globe with an X shows in the corner.",
  'Ex.: 2º andar, sala 204': 'e.g. 2nd floor, room 204',
  'Ex.: Financeiro': 'e.g. Finance',
  'Comentário (opcional)': 'Comment (optional)',
};

// Textos com partes variáveis (nomes, números, horários)
const PATTERNS = [
  [/^há (\d+) min$/, (m) => `${m[1]} min ago`],
  [/^há (\d+) h$/, (m) => `${m[1]} h ago`],
  [/^há (\d+) dias$/, (m) => `${m[1]} days ago`],
  [/^ontem$/, () => 'yesterday'],
  [/^agora$/, () => 'just now'],
  [/^hoje às (.+)$/, (m) => `today at ${m[1]}`],
  [/^amanhã às (.+)$/, (m) => `tomorrow at ${m[1]}`],
  [/^descreveu o problema hoje às (.+)$/, (m) => `described the problem today at ${m[1]}`],
  [/^descreveu o problema (.+)$/, (m) => `described the problem ${m[1].replace('às', 'at')}`],
  [/^Você tem (\d+) chamados? em andamento\.$/, (m) => `You have ${m[1]} ticket${m[1] === '1' ? '' : 's'} in progress.`],
  [/^Nenhum chamado em andamento\. Se algo der problema, é só abrir um\.$/, () => 'No tickets in progress. If something breaks, just open one.'],
  [/^com (.+)$/, (m) => `with ${m[1]}`],
  [/^(.+) está cuidando$/, (m) => `${m[1]} is on it`],
  [/^(.+) vai até você$/, (m) => `${m[1]} is coming to you`],
  [/^(.+) está a caminho$/, (m) => `${m[1]} is on the way`],
  [/^(.+) vai (hoje|amanhã) às (.+)$/, (m) => `${m[1]} comes ${m[2] === 'hoje' ? 'today' : 'tomorrow'} at ${m[3]}`],
  [/^(.+) marcou como resolvido\. Funcionou\?$/, (m) => `${m[1]} marked it as resolved. Did it work?`],
  [/^Chamado #(\d+) enviado$/, (m) => `Ticket #${m[1]} sent`],
  [/^Chamado aberto por (.+)\.$/, (m) => `Ticket opened by ${m[1]}.`],
  [/^(.+) assumiu o chamado\.$/, (m) => `${m[1]} took the ticket.`],
  [/^(.+) atribuiu o chamado a (.+)\.$/, (m) => `${m[1]} assigned the ticket to ${m[2]}.`],
  [/^(.+) está a caminho( \(.+\))?\.$/, (m) => `${m[1]} is on the way${m[2] || ''}.`],
  [/^(.+) agendou uma visita presencial para (.+?)( \(.+\))?\.$/, (m) => `${m[1]} scheduled an on-site visit for ${m[2]}${m[3] || ''}.`],
  [/^Resolvido à distância por (.+)$/, (m) => `Resolved remotely by ${m[1]}`],
  [/^Resolvido presencialmente por (.+)$/, (m) => `Resolved on site by ${m[1]}`],
  [/^Esperando (.+) confirmar e avaliar\.$/, (m) => `Waiting for ${m[1]} to confirm and rate.`],
  [/^Resolvidos em (.+)$/, (m) => `Resolved in ${m[1]}`],
  [/^(\d+) avaliaç(ão|ões)$/, (m) => `${m[1]} rating${m[1] === '1' ? '' : 's'}`],
  [/^(\d+) urgentes?$/, (m) => `${m[1]} urgent`],
  [/^Como está o atendimento da T\.I, ao vivo\. (\d+) chamados no total\.$/, (m) => `How IT support is doing, live. ${m[1]} tickets in total.`],
  [/^Seus atendimentos, (.+)\. Atualiza sozinho a cada chamado\.$/, (m) => `Your work, ${m[1]}. Updates on every ticket.`],
  [/^Nenhum chamado combina com "(.+)"\.$/, (m) => `No ticket matches "${m[1]}".`],
  [/^(.+) no #(\d+)$/, (m) => `${m[1]} on #${m[2]}`],
  [/^Novo chamado #(\d+)$/, (m) => `New ticket #${m[1]}`],
  [/^Chamado urgente #(\d+)$/, (m) => `Urgent ticket #${m[1]}`],
  [/^(Colaborador|Técnico|Administrador) · conta criada em (.+)$/, (m) => `${{ Colaborador: 'Employee', 'Técnico': 'Technician', Administrador: 'Administrator' }[m[1]]} · account created on ${m[2]}`],
  [/^Obrigado, (.+)\. Assim que o administrador aprovar, você já consegue entrar com o seu e-mail e senha\.$/,
    (m) => `Thanks, ${m[1]}. As soon as the administrator approves it, you can sign in with your email and password.`],
  [/^(.+) aprovado\(a\)$/, (m) => `${m[1]} approved`],
  [/^Cadastro de (.+) recusado$/, (m) => `${m[1]}'s sign-up declined`],
  [/^Entrou como (.+)\.$/, (m) => `Joined as ${{ colaborador: 'employee', 'técnico': 'technician', administrador: 'administrator' }[m[1]] || m[1]}.`],
  [/^Recusar o cadastro de (.+)\? A pessoa não vai conseguir entrar\.$/, (m) => `Decline ${m[1]}'s sign-up? They won't be able to sign in.`],
];

// Conteúdo escrito por pessoas: nunca traduzir
const SKIP = '.bubble, .problem p, .ticket-title strong, .tcard-title, .history-title, .detail-title h1, .quote, .resolution p, .review p, .tcard-note, textarea, input, select option[data-raw], [data-no-i18n], code';
const ATTRS = ['placeholder', 'title', 'aria-label'];

let lang = 'pt';
let observer = null;
const originals = new WeakMap(); // nó → texto original em PT

function translate(text) {
  const trimmed = text.trim();
  if (!trimmed) return null;
  let out = EN[trimmed];
  if (out == null) {
    for (const [re, fn] of PATTERNS) {
      const m = trimmed.match(re);
      if (m) {
        out = fn(m);
        break;
      }
    }
  }
  if (out == null) return null;
  return text.replace(trimmed, out);
}

function skip(node) {
  const el = node.nodeType === 1 ? node : node.parentElement;
  return !el || !!el.closest(SKIP);
}

function translateTextNode(node) {
  if (skip(node)) return;
  const current = node.nodeValue;
  // React pode ter reescrito o texto: guardamos sempre o original em PT
  const known = originals.get(node);
  const source = known && (current === known.en) ? known.pt : current;
  const en = translate(source);
  if (en != null && en !== current) {
    originals.set(node, { pt: source, en });
    node.nodeValue = en;
  }
}

function translateAttrs(el) {
  if (el.closest('[data-no-i18n]')) return;
  for (const a of ATTRS) {
    const v = el.getAttribute(a);
    if (!v) continue;
    const key = `data-i18n-${a}`;
    const pt = el.getAttribute(key) && el.getAttribute(`${key}-en`) === v ? el.getAttribute(key) : v;
    const en = translate(pt);
    if (en != null && en !== v) {
      el.setAttribute(key, pt);
      el.setAttribute(`${key}-en`, en);
      el.setAttribute(a, en);
    }
  }
}

function walk(root) {
  if (root.nodeType === 3) return translateTextNode(root);
  if (root.nodeType !== 1) return;
  translateAttrs(root);
  const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  let n;
  while ((n = tw.nextNode())) {
    if (n.nodeType === 3) translateTextNode(n);
    else translateAttrs(n);
  }
}

function restoreAll() {
  // volta os textos originais em português
  const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  let n;
  while ((n = tw.nextNode())) {
    if (n.nodeType === 3) {
      const o = originals.get(n);
      if (o && n.nodeValue === o.en) n.nodeValue = o.pt;
      originals.delete(n);
    } else {
      for (const a of ATTRS) {
        const pt = n.getAttribute(`data-i18n-${a}`);
        if (pt != null) {
          if (n.getAttribute(a) === n.getAttribute(`data-i18n-${a}-en`)) n.setAttribute(a, pt);
          n.removeAttribute(`data-i18n-${a}`);
          n.removeAttribute(`data-i18n-${a}-en`);
        }
      }
    }
  }
}

export function setLanguage(next) {
  lang = next === 'en' ? 'en' : 'pt';
  document.documentElement.lang = lang === 'en' ? 'en' : 'pt-BR';
  observer?.disconnect();
  observer = null;
  if (lang === 'pt') return restoreAll();
  walk(document.body);
  observer = new MutationObserver((muts) => {
    for (const m of muts) {
      if (m.type === 'characterData') translateTextNode(m.target);
      else if (m.type === 'attributes') translateAttrs(m.target);
      else m.addedNodes.forEach(walk);
    }
  });
  observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
}

export const getLanguage = () => lang;
