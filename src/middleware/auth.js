'use strict';
/**
 * auth.js
 *
 * Middleware to authenticate requests to the Convert API using a static token.
 * Supports:
 *  - Header: `x-api-key: <token>`
 *  - Header: `Authorization: Bearer <token>`
 *  - Query:  `?apiKey=<token>` or `?token=<token>`
 */
const config = require('../config');

function authMiddleware(req, res, next) {
  const expectedToken = config.authToken;

  // Extract token from various sources
  let providedToken = null;

  // 1. Check x-api-key header
  if (req.headers['x-api-key']) {
    providedToken = req.headers['x-api-key'];
  }
  // 2. Check Authorization: Bearer <token>
  else if (req.headers['authorization']) {
    const parts = req.headers['authorization'].split(' ');
    if (parts.length === 2 && /^bearer$/i.test(parts[0])) {
      providedToken = parts[1];
    } else {
      providedToken = req.headers['authorization'];
    }
  }
  // 3. Check query parameters (?apiKey=... or ?token=...)
  else if (req.query.apiKey) {
    providedToken = req.query.apiKey;
  } else if (req.query.token) {
    providedToken = req.query.token;
  }

  if (!providedToken || providedToken !== expectedToken) {
    return res.status(401).json({
      error:   'Unauthorized',
      message: 'Invalid or missing API authentication token. Provide it via "x-api-key" header, "Authorization: Bearer <token>", or "?apiKey=<token>".',
    });
  }

  next();
}

module.exports = authMiddleware;
