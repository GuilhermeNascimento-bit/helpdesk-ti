import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import express from 'express';
import multer from 'multer';
import { UPLOAD_DIR } from './db.js';
import { initRealtime } from './realtime.js';
import { authRouter } from './routes/auth.js';
import { ticketsRouter } from './routes/tickets.js';
import { usersRouter } from './routes/users.js';
import { statsRouter } from './routes/stats.js';
import { discardUpload } from './uploads.js';

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));

// Arquivos anexados (nomes aleatórios, não adivinháveis)
app.use(
  '/uploads',
  express.static(UPLOAD_DIR, {
    setHeaders: (res) => res.setHeader('X-Content-Type-Options', 'nosniff'),
  })
);

app.use('/api/auth', authRouter);
app.use('/api/tickets', ticketsRouter);
app.use('/api/users', usersRouter);
app.use('/api/stats', statsRouter);
app.use('/api', (_req, res) => res.status(404).json({ error: 'Rota não encontrada.' }));

// Em produção, o próprio servidor entrega o frontend compilado
const dist = path.resolve(import.meta.dirname, '..', '..', 'client', 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get('/{*splat}', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.use((err, req, res, _next) => {
  discardUpload(req);
  if (err instanceof multer.MulterError) {
    const msg = err.code === 'LIMIT_FILE_SIZE' ? 'Arquivo muito grande (máximo 10 MB).' : 'Falha no envio do arquivo.';
    return res.status(400).json({ error: msg });
  }
  if (err.status && err.status < 500) return res.status(err.status).json({ error: err.message });
  console.error(err);
  res.status(500).json({ error: 'Erro interno no servidor.' });
});

const server = http.createServer(app);
initRealtime(server);

const PORT = Number(process.env.PORT) || 3001;
server.listen(PORT, () => console.log(`[helpdesk] API rodando em http://localhost:${PORT}`));
