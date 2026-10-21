'use strict';
/**
 * Server entry point — starts the HTTP server and schedules cleanup tasks.
 */
const app    = require('./src/app');
const config = require('./src/config');
const logger = require('./src/logger');
const { pruneOldJobs } = require('./src/jobStore');

const PORT = config.port;

const server = app.listen(PORT, () => {
  logger.info(`🚀 eBook Converter API is running!`);
  logger.info(`   Local:     http://localhost:${PORT}`);
  logger.info(`   Docs:      http://localhost:${PORT}/api/docs`);
  logger.info(`   Health:    http://localhost:${PORT}/api/health`);
  logger.info(`   Refresh:   http://localhost:${PORT}/api/refresh`);
  logger.info(`   Max size:  ${config.upload.maxFileSizeMB} MB`);
});

// Periodically clean up old converted files
setInterval(() => {
  pruneOldJobs(config.output.ttlMs);
}, 15 * 60 * 1000); // every 15 minutes

// Optional automated self-ping to prevent sleep on free hosts (Render, etc.)
// Render provides RENDER_EXTERNAL_URL (e.g. https://my-app.onrender.com) automatically.
const selfPingUrl = process.env.SELF_PING_URL || (
  (process.env.ENABLE_SELF_PING === 'true' || process.env.ENABLE_SELF_PING === '1') && process.env.RENDER_EXTERNAL_URL
    ? `${process.env.RENDER_EXTERNAL_URL}/api/refresh`
    : null
);

if (selfPingUrl) {
  const pingIntervalMs = parseInt(process.env.SELF_PING_INTERVAL_MS || String(13 * 60 * 1000)); // default: 13 min
  logger.info(`🔄 Automated self-ping active: ${selfPingUrl} (every ${Math.round(pingIntervalMs / 60000)}m)`);
  setInterval(() => {
    fetch(selfPingUrl)
      .then((res) => logger.info(`🔄 Keep-alive ping sent [${res.status}]`))
      .catch((err) => logger.warn(`🔄 Keep-alive ping failed: ${err.message}`));
  }, pingIntervalMs);
}

// Graceful shutdown
function shutdown(signal) {
  logger.info(`Received ${signal}. Shutting down gracefully...`);
  server.close(() => {
    logger.info('HTTP server closed.');
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception', { message: err.message, stack: err.stack });
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection', { reason: String(reason) });
});
