# Helpdesk T.I

App web de chamados de T.I: o colaborador abre um chamado, um técnico assume, os dois conversam por chat em tempo real e o técnico resolve **online** ou **agenda uma visita presencial**. No fim, o colaborador avalia o atendimento.

## Demonstração online

**https://guilhermenascimento-bit.github.io/helpdesk-ti/**: entre com um clique como Colaborador, Técnico ou Admin.

Essa versão roda inteira no navegador, publicada no GitHub Pages pelo workflow `.github/workflows/pages.yml` (`VITE_DEMO=1`). A "API" (`client/src/demo/server.js`) segue as mesmas regras do servidor Node e guarda os dados no navegador de cada visitante. O tempo real funciona entre abas do mesmo navegador. Um técnico robô assume os chamados novos e responde no chat, para quem testa numa aba só. Na tela de login dá pra restaurar os dados de exemplo.

## Publicar no Render (servidor de verdade)

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/GuilhermeNascimento-bit/helpdesk-ti)

O `render.yaml` cria um serviço web gratuito que compila o frontend e serve tudo pelo mesmo servidor (API, chat em tempo real e páginas). Com `DEMO_MODE=1`:

- o banco começa com chamados de exemplo em todas as situações, mais técnicos, colaboradores e um cadastro aguardando aprovação;
- na tela de login, os botões Colaborador / Técnico / Admin entram com um clique;
- as contas de demonstração não podem ter senha, e-mail, perfil ou status alterados.

No plano gratuito o servidor "dorme" depois de 15 minutos parado, e o primeiro acesso leva cerca de 1 minuto. A cada reinício o disco é apagado e os dados voltam ao estado inicial.

## Como rodar

```bash
npm run install:all   # só na primeira vez
npm run dev           # API em :3001 + frontend em http://localhost:5173
```

Para outras pessoas da rede acessarem durante o desenvolvimento, use `http://<IP-da-sua-máquina>:5173`.

### Produção (um único servidor)

```bash
npm run build         # compila o frontend em client/dist
npm start             # serve API + frontend em http://localhost:3001
```

Variáveis opcionais: `PORT`, `JWT_SECRET`, `DATA_DIR` (onde ficam o banco e os anexos; padrão `server/data`), `DISPLAY_TZ` (padrão `America/Sao_Paulo`).

## Contas de demonstração

Elas são criadas na primeira execução. **Troque as senhas ou desative essas contas antes de usar de verdade.**

| Perfil        | E-mail                | Senha        |
|---------------|-----------------------|--------------|
| Colaborador   | ana@empresa.com       | ana123       |
| Técnico       | tecnico@empresa.com   | tecnico123   |
| Administrador | admin@empresa.com     | admin123     |

## Fluxo do chamado

```
Aberto ──assumir──▶ Em atendimento ──agendar visita──▶ Visita agendada
                          │                                  │
                          └────────── resolver ──────────────┘
                                         ▼
                 Resolvido ──colaborador avalia (1–5★)──▶ Fechado
                     └──"não resolveu"──▶ volta para Em atendimento
Qualquer status ativo ──▶ Cancelado
```

## O que cada perfil faz

- **Colaborador**: abre chamados só descrevendo o problema e dizendo quanto isso atrapalha (o print pode ser colado com Ctrl+V ou arrastado), conversa com o técnico, confirma a solução e avalia, ou reabre o chamado.
- **Técnico**: vê a fila em tempo real, assume chamados, classifica a categoria, conversa, marca a visita com um clique ("Estou indo agora", "Em 30 min"…), registra quando precisa **comprar um item ou acionar um serviço terceirizado**, com prazo de chegada (o chamado fica "Aguardando item", aparece na tela **Pendências** e fica vermelho se o prazo vencer), marca como resolvido (à distância ou presencial) e acompanha o próprio desempenho (atendimentos, notas e comentários).
- **Admin**: tudo o que o técnico faz, mais o painel de métricas (fila, tempo médio, % resolvido online, satisfação, desempenho por técnico), a atribuição de chamados a técnicos e o cadastro de usuários.

## Estrutura

```
server/   Node + Express + Socket.IO + SQLite (node:sqlite, embutido no Node 22+)
  src/routes/   auth, tickets (chamados + chat), users, stats
  data/         banco helpdesk.db + anexos (criado automaticamente)
client/   React + Vite
  src/pages/    Login, TicketList, NewTicket, TicketDetail (chat), AdminDashboard, AdminUsers
```

## Próximos passos sugeridos

- Versão desktop (Electron empacotando o mesmo frontend)
- Notificações por e-mail ou do navegador
- Proteger os anexos com autenticação (hoje eles usam nomes aleatórios e impossíveis de adivinhar)
- SLA por prioridade e alertas de chamados parados
