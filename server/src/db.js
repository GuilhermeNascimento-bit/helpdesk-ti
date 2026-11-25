import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import bcrypt from 'bcryptjs';

export const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(import.meta.dirname, '..', 'data'));
export const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

export const db = new DatabaseSync(path.join(DATA_DIR, 'helpdesk.db'));

function ticketsTable(name, ifNotExists = true) {
  return `
CREATE TABLE ${ifNotExists ? 'IF NOT EXISTS ' : ''}${name} (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  title           TEXT NOT NULL,
  description     TEXT NOT NULL,
  category        TEXT NOT NULL,
  priority        TEXT NOT NULL CHECK (priority IN ('baixa','media','alta','urgente')),
  status          TEXT NOT NULL DEFAULT 'aberto'
                  CHECK (status IN ('aberto','em_atendimento','aguardando','visita_agendada','resolvido','fechado','cancelado')),
  location        TEXT,
  requester_id    INTEGER NOT NULL REFERENCES users(id),
  technician_id   INTEGER REFERENCES users(id),
  resolution_type TEXT CHECK (resolution_type IN ('online','presencial')),
  resolution_note TEXT,
  visit_at        TEXT,
  pending_type    TEXT CHECK (pending_type IN ('compra','terceirizado')), -- o que está sendo aguardado
  pending_item    TEXT,
  pending_due     TEXT,  -- prazo de chegada (AAAA-MM-DD)
  pending_since   TEXT,
  rating          INTEGER CHECK (rating BETWEEN 1 AND 5),
  rating_comment  TEXT,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL,
  resolved_at     TEXT,
  closed_at       TEXT
);`;
}

const TICKET_INDEXES = `
CREATE INDEX IF NOT EXISTS idx_tickets_requester  ON tickets(requester_id);
CREATE INDEX IF NOT EXISTS idx_tickets_technician ON tickets(technician_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status     ON tickets(status);`;

/** Bancos criados antes das pendências: recria a tabela com o novo status, mantendo os dados. */
function migrateTickets() {
  const row = db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'tickets'").get();
  if (!row || row.sql.includes("'aguardando'")) return;
  const cols = db.prepare('PRAGMA table_info(tickets)').all().map((c) => c.name).join(', ');
  db.exec('PRAGMA foreign_keys = OFF');
  db.exec('BEGIN');
  try {
    db.exec(ticketsTable('tickets_new', false));
    db.exec(`INSERT INTO tickets_new (${cols}) SELECT ${cols} FROM tickets`);
    db.exec('DROP TABLE tickets');
    db.exec('ALTER TABLE tickets_new RENAME TO tickets');
    db.exec(TICKET_INDEXES);
    db.exec('COMMIT');
    console.log('[db] Tabela de chamados atualizada (pendências de compra/terceiro).');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  } finally {
    db.exec('PRAGMA foreign_keys = ON');
  }
}
migrateTickets();

db.exec(`
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('colaborador','tecnico','admin')),
  department    TEXT,
  location      TEXT,
  active        INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL
);

${ticketsTable('tickets')}
${TICKET_INDEXES}

CREATE TABLE IF NOT EXISTS messages (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_id       INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  user_id         INTEGER REFERENCES users(id),
  body            TEXT NOT NULL DEFAULT '',
  attachment_url  TEXT,
  attachment_name TEXT,
  attachment_type TEXT,
  is_system       INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_messages_ticket ON messages(ticket_id);
`);

// Cadastro pelo próprio usuário: fica aguardando aprovação do admin (approved = 0).
// Bancos antigos ganham a coluna com todos os usuários já aprovados.
if (!db.prepare('PRAGMA table_info(users)').all().some((c) => c.name === 'approved')) {
  db.exec('ALTER TABLE users ADD COLUMN approved INTEGER NOT NULL DEFAULT 1');
}

// Foto de perfil (opcional)
if (!db.prepare('PRAGMA table_info(users)').all().some((c) => c.name === 'avatar_url')) {
  db.exec('ALTER TABLE users ADD COLUMN avatar_url TEXT');
}

export const nowIso = () => new Date().toISOString();

// Usuários de demonstração na primeira execução
if (db.prepare('SELECT COUNT(*) AS n FROM users').get().n === 0) {
  const insert = db.prepare(
    'INSERT INTO users (name, email, password_hash, role, department, location, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );
  const seed = [
    ['Administrador', 'admin@empresa.com', 'admin123', 'admin', 'T.I', 'Sala da T.I'],
    ['Carlos Técnico', 'tecnico@empresa.com', 'tecnico123', 'tecnico', 'T.I', 'Sala da T.I'],
    ['Ana Colaboradora', 'ana@empresa.com', 'ana123', 'colaborador', 'Financeiro', '2º andar - sala 204'],
  ];
  for (const [name, email, pass, role, dept, loc] of seed) {
    insert.run(name, email, bcrypt.hashSync(pass, 10), role, dept, loc, nowIso());
  }
  console.log('[db] Usuários de demonstração criados (veja o README).');
}
