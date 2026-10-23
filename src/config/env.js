import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, '../..');

export const env = {
  port: Number(process.env.PORT || 3000),
  nodeEnv: process.env.NODE_ENV || 'production',
  apiToken: process.env.API_AUTH_TOKEN || '',
  maxFileSize: Number(process.env.MAX_FILE_SIZE_MB || 100) * 1024 * 1024,
  ttlMs: Number(process.env.OUTPUT_TTL_MS || 3600000),
  timeout: Number(process.env.CONVERSION_TIMEOUT_MS || 300000),
  cleanupIntervalMs: Math.min(Number(process.env.OUTPUT_TTL_MS || 3600000), 10 * 60_000),
  calibreBin: process.env.CALIBRE_BIN || '/usr/bin/ebook-convert',
  calibreDebugBin: process.env.CALIBRE_DEBUG_BIN || '/usr/bin/calibre-debug',
  enableSelfPing: String(process.env.ENABLE_SELF_PING || 'false').toLowerCase() === 'true',
  trustProxy: String(process.env.RENDER || '').toLowerCase() === 'true',
  uploads: path.join(ROOT, 'storage/uploads'),
  outputs: path.join(ROOT, 'storage/outputs'),
  tmp: path.join(ROOT, 'storage/tmp')
};
