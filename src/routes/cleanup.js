'use strict';
/**
 * Cleanup route
 *
 * GET /api/cleanup
 * GET /api/convert/cleanup
 *
 * Sweeps and deletes uploaded & converted files older than the specified TTL (default 1 hour),
 * and prunes completed/expired async jobs.
 *
 * Query parameters (optional):
 *  - ttlMinutes : number (e.g. ?ttlMinutes=60)
 *  - ttlHours   : number (e.g. ?ttlHours=1)
 */
const express   = require('express');
const router    = express.Router();
const config    = require('../config');
const { pruneOldJobs } = require('../jobStore');
const logger    = require('../logger');

router.get('/', (req, res) => {
  let ttlMs = config.output.ttlMs; // default: 1 hour (3600000 ms)

  if (req.query.ttlMinutes !== undefined) {
    const mins = parseFloat(req.query.ttlMinutes);
    if (!isNaN(mins) && mins >= 0) {
      ttlMs = mins * 60 * 1000;
    }
  } else if (req.query.ttlHours !== undefined) {
    const hrs = parseFloat(req.query.ttlHours);
    if (!isNaN(hrs) && hrs >= 0) {
      ttlMs = hrs * 60 * 60 * 1000;
    }
  }

  const result = pruneOldJobs(ttlMs);
  const ttlMinutes = Math.round(ttlMs / 60000);
  const mbFreed = (result.bytesFreed / (1024 * 1024)).toFixed(2);

  logger.info('Manual cleanup executed', {
    ttlMinutes,
    ...result,
  });

  res.json({
    status:     'success',
    message:    `Cleanup completed for files older than ${ttlMinutes} minute(s).`,
    ttlMinutes,
    summary: {
      prunedJobs:        result.prunedJobs,
      uploadsDeleted:    result.uploadsDeleted,
      convertedDeleted:  result.convertedDeleted,
      totalFilesDeleted: result.totalFilesDeleted,
      bytesFreed:        result.bytesFreed,
      megabytesFreed:    `${mbFreed} MB`,
    },
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
