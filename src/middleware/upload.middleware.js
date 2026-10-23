import multer from 'multer';
import path from 'node:path';
import { v4 as uuid } from 'uuid';
import { env } from '../config/env.js';
import { INPUT_FORMATS } from '../utils/formats.js';
import { safeName } from '../utils/files.js';

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, env.uploads),
  filename: (_, file, cb) => cb(null, `${uuid()}-${safeName(file.originalname)}`)
});

export const upload = multer({
  storage,
  limits: { fileSize: env.maxFileSize, files: 1 },
  fileFilter: (_, file, cb) => {
    const ext = path.extname(file.originalname).slice(1).toLowerCase();
    const ok = INPUT_FORMATS.includes(ext);
    cb(ok ? null : new Error(`Unsupported input format: ${ext || 'unknown'}`), ok);
  }
});
