'use strict';
/**
 * Health check route
 * GET /api/health
 */
const express = require('express');
const { getAllJobs } = require('../jobStore');
const { getAllSupportedConversions } = require('../converters/conversionEngine');
const router = express.Router();

router.get('/', (req, res) => {
  const jobs = getAllJobs();
  const jobStats = jobs.reduce((acc, j) => {
    acc[j.status] = (acc[j.status] || 0) + 1;
    return acc;
  }, {});

  res.json({
    status:    'ok',
    timestamp: new Date().toISOString(),
    version:   require('../../package.json').version,
    uptime:    Math.floor(process.uptime()),
    memory:    process.memoryUsage(),
    jobs:      jobStats,
    supportedFormats: Object.keys(getAllSupportedConversions()),
  });
});

module.exports = router;
