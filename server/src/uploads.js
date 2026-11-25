import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import multer from 'multer';
import { UPLOAD_DIR } from './db.js';

const ALLOWED = /^(image\/(png|jpe?g|gif|webp)|application\/pdf|text\/plain)$/;

export const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase().replace(/[^.a-z0-9]/g, '').slice(0, 8);
      cb(null, crypto.randomUUID() + ext);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED.test(file.mimetype)) return cb(null, true);
    const err = new Error('Tipo de arquivo não permitido. Envie imagem (PNG, JPG, GIF, WEBP), PDF ou TXT.');
    err.status = 400;
    cb(err);
  },
});

export function fileInfo(file) {
  if (!file) return null;
  return {
    url: `/uploads/${file.filename}`,
    // multer entrega o nome original em latin1
    name: Buffer.from(file.originalname, 'latin1').toString('utf8'),
    type: file.mimetype,
  };
}

export function discardUpload(req) {
  if (req.file) fs.rm(req.file.path, { force: true }, () => {});
}
