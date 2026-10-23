import { env } from '../config/env.js';

export function apiToken(req, res, next) {
  if (!env.apiToken) {
    return res.status(500).json({ status: 'error', message: 'API_AUTH_TOKEN is not configured on the server.' });
  }

  const apiKey = req.get('x-api-key') || '';
  const queryToken = typeof req.query.token === 'string' ? req.query.token : '';
  const credential = apiKey || queryToken;

  if (credential !== env.apiToken) {
    return res.status(401).json({ status: 'error', message: 'Unauthorized. Invalid or missing API token.' });
  }

  next();
}
