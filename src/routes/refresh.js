'use strict';
/**
 * Refresh / Keep-Alive route
 *
 * GET  /api/refresh
 * HEAD /api/refresh
 * GET  /api/ping
 * HEAD /api/ping
 *
 * Used to keep the server awake on free-tier platforms (Render, Railway, etc.)
 * or to wake the server up when your client app launches.
 */
const express = require('express');
const router  = express.Router();

function formatUptime(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const parts = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.join(' ');
}

function handleRefresh(req, res) {
  const uptimeSeconds = Math.floor(process.uptime());
  res.json({
    status:          'alive',
    message:         'Server is awake and active',
    timestamp:       new Date().toISOString(),
    uptimeSeconds,
    uptimeFormatted: formatUptime(uptimeSeconds),
  });
}

router.get('/', handleRefresh);
router.head('/', (req, res) => res.status(200).end());

module.exports = router;
