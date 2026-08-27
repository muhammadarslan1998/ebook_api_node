'use strict';
/**
 * Express application setup (no server.listen here — that is in server.js)
 */
const express      = require('express');
const cors         = require('cors');
const helmet       = require('helmet');
const morgan       = require('morgan');
const swaggerUi    = require('swagger-ui-express');

const convertRouter  = require('./routes/convert');
const healthRouter   = require('./routes/health');
const refreshRouter  = require('./routes/refresh');
const cleanupRouter  = require('./routes/cleanup');
const errorHandler   = require('./middleware/errorHandler');
const swaggerSpec    = require('./swaggerSpec');
const logger         = require('./logger');

const app = express();

// Trust reverse proxy (Render, Heroku, Cloudflare, etc.)
app.set('trust proxy', 1);

// ─── Security & utility middleware ────────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc:  ["'self'", "'unsafe-inline'"],
      styleSrc:   ["'self'", "'unsafe-inline'", 'https:'],
      imgSrc:     ["'self'", 'data:', 'https:'],
      fontSrc:    ["'self'", 'https:', 'data:'],
    },
  },
}));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// HTTP request logging
app.use(morgan('combined', {
  stream: { write: (msg) => logger.info(msg.trim()) },
}));

// ─── Swagger UI ───────────────────────────────────────────────────────────────
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customSiteTitle: 'eBook Converter API',
  customCss: `
    .swagger-ui .topbar { background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%); }
    .swagger-ui .topbar-wrapper img { display:none; }
    .swagger-ui .info .title { color: #e94560; }
  `,
}));

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/health',  healthRouter);
app.use('/api/convert', convertRouter);
app.use('/api/refresh', refreshRouter);
app.use('/api/cleanup', cleanupRouter);
app.use('/api/ping',    refreshRouter);
app.use('/ping',        refreshRouter);

// Root redirect to docs
app.get('/', (req, res) => res.redirect('/api/docs'));

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error:   'Not found',
    message: `Cannot ${req.method} ${req.path}`,
    docs:    '/api/docs',
  });
});

// Global error handler (must be last)
app.use(errorHandler);

module.exports = app;
