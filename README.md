# Helpdesk T.I

App web de chamados de T.I: o colaborador abre um chamado, um técnico assume, os dois conversam por chat em tempo real e o técnico resolve **online** ou **agenda uma visita presencial**. No fim, o colaborador avalia o atendimento.

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
