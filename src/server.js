import app from './app.js';
import { env } from './config/env.js';
import { ensureDirs } from './utils/files.js';
import { cleanupExpired } from './services/cleanup.service.js';

await ensureDirs(env.uploads, env.outputs, env.tmp);
await cleanupExpired();
const timer = setInterval(() => cleanupExpired().catch(console.error), env.cleanupIntervalMs);
timer.unref();

app.listen(env.port, '0.0.0.0', () => {
  console.log(`Ebook Converter API running on 0.0.0.0:${env.port}`);
});
