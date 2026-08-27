'use strict';
/**
 * /api/convert routes
 *
 * POST /api/convert        — upload + convert synchronously (small files)
 * POST /api/convert/async  — upload + convert asynchronously (returns jobId)
 * GET  /api/convert/job/:id — poll async job status
 * GET  /api/convert/download/:id — download converted file
 * GET  /api/convert/formats — list supported conversion formats
 */
const express = require('express');
const fs      = require('fs');
const path    = require('path');
const { v4: uuidv4 } = require('uuid');

const router    = express.Router();
const upload    = require('../middleware/upload');
const { convert, getAllSupportedConversions } = require('../converters/conversionEngine');
const { createJob, getJob, updateJob }        = require('../jobStore');
const config    = require('../config');
const logger    = require('../logger');

// Ensure output directory exists
fs.mkdirSync(config.output.dir, { recursive: true });

/**
 * Derive normalised format string from multer file object
 */
function getFormat(file) {
  let ext = path.extname(file.originalname).slice(1).toLowerCase();
  if (ext === 'htm') ext = 'html';
  return ext;
}

/**
 * Build the output file path for a given job/format
 */
function buildOutputPath(jobId, targetFormat) {
  // All formats use their own extension as-is; this map handles any special cases.
  const extMap = {
    txt:  'txt',
    html: 'html',
    pdf:  'pdf',
    epub: 'epub',
    mobi: 'mobi',
    azw3: 'azw3',
    lrf:  'lrf',
    oeb:  'zip',   // Calibre outputs OEB as a directory; we deliver it zipped
    pdb:  'pdb',
    rtf:  'rtf',
    fb2:  'fb2',
    tcr:  'tcr',
  };
  const ext = extMap[targetFormat] || targetFormat;
  return path.join(config.output.dir, `${jobId}.${ext}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/convert/formats
// ─────────────────────────────────────────────────────────────────────────────
router.get('/formats', (req, res) => {
  res.json({
    supportedConversions: getAllSupportedConversions(),
    maxFileSizeMB: config.upload.maxFileSizeMB,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/convert/cleanup
// ─────────────────────────────────────────────────────────────────────────────
router.get('/cleanup', (req, res) => {
  const { pruneOldJobs } = require('../jobStore');
  let ttlMs = config.output.ttlMs;

  if (req.query.ttlMinutes !== undefined) {
    const mins = parseFloat(req.query.ttlMinutes);
    if (!isNaN(mins) && mins >= 0) ttlMs = mins * 60 * 1000;
  } else if (req.query.ttlHours !== undefined) {
    const hrs = parseFloat(req.query.ttlHours);
    if (!isNaN(hrs) && hrs >= 0) ttlMs = hrs * 60 * 60 * 1000;
  }

  const result = pruneOldJobs(ttlMs);
  const ttlMinutes = Math.round(ttlMs / 60000);
  const mbFreed = (result.bytesFreed / (1024 * 1024)).toFixed(2);

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

/**
 * Get base URL respecting reverse proxy headers (e.g. on Render)
 */
function getBaseUrl(req) {
  const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  const host     = req.headers['x-forwarded-host'] || req.get('host');
  return `${protocol}://${host}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/convert   (synchronous — converts & returns downloadUrl)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * @openapi
 * /api/convert:
 *   post:
 *     summary: Convert an eBook synchronously
 *     description: Converts the file and returns a JSON response with the downloadUrl.
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file, targetFormat]
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *               targetFormat:
 *                 type: string
 *                 example: pdf
 *     responses:
 *       200:
 *         description: Conversion completed successfully with downloadUrl
 */
router.post('/', upload.single('file'), async (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded', message: 'Provide a file via the "file" field.' });
  }

  const targetFormat = (req.body.targetFormat || '').toLowerCase().trim();
  if (!targetFormat) {
    return res.status(400).json({ error: 'Missing targetFormat', message: 'Provide "targetFormat" in the request body.' });
  }

  const sourceFormat = getFormat(req.file);
  const jobId        = uuidv4();
  const outputPath   = buildOutputPath(jobId, targetFormat);

  // Register in job store
  createJob({
    id: jobId,
    sourceFile: req.file.originalname,
    from: sourceFormat,
    to: targetFormat,
  });

  try {
    await convert(req.file.path, sourceFormat, targetFormat, outputPath);

    // Mark job as done so download endpoint works
    updateJob(jobId, { status: 'done', outputFile: outputPath });

    // Clean up temporary upload file immediately
    fs.unlink(req.file.path, () => {});

    const fileStat     = fs.existsSync(outputPath) ? fs.statSync(outputPath) : { size: 0 };
    const originalBase = path.basename(req.file.originalname, path.extname(req.file.originalname));
    const fileExtMap   = { oeb: 'zip' };
    const fileExt      = fileExtMap[targetFormat] || targetFormat;
    const downloadName = `${originalBase}.${fileExt}`;

    // Optional direct binary stream if requested via ?direct=true
    if (req.query.direct === 'true') {
      const mimeMap = {
        pdf:  'application/pdf',
        epub: 'application/epub+zip',
        html: 'text/html',
        txt:  'text/plain',
        mobi: 'application/x-mobipocket-ebook',
        azw3: 'application/vnd.amazon.ebook',
        lrf:  'application/x-lrf',
        pdb:  'application/vnd.palm',
        rtf:  'application/rtf',
        oeb:  'application/zip',
        fb2:  'application/x-fictionbook+xml',
        tcr:  'application/octet-stream',
      };
      const mime = mimeMap[targetFormat] || 'application/octet-stream';
      res.set('Content-Disposition', `attachment; filename="${downloadName}"`);
      res.set('Content-Type', mime);
      return res.sendFile(outputPath, { root: '/' });
    }

    // Default: Return JSON containing download URL and metadata
    const baseUrl      = getBaseUrl(req);
    const downloadPath = `/api/convert/download/${jobId}`;
    const downloadUrl  = `${baseUrl}${downloadPath}`;

    return res.status(200).json({
      status:         'success',
      message:        'Conversion completed successfully.',
      jobId:          jobId,
      sourceFile:     req.file.originalname,
      from:           sourceFormat,
      to:             targetFormat,
      outputFileName: downloadName,
      fileSizeBytes:  fileStat.size,
      downloadUrl:    downloadUrl,
      downloadPath:   downloadPath,
      expiresIn:      `${Math.round(config.output.ttlMs / 60000)} minutes`,
    });
  } catch (err) {
    fs.unlink(req.file.path, () => {});
    updateJob(jobId, { status: 'failed', error: err.message });
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/convert/async
// ─────────────────────────────────────────────────────────────────────────────
router.post('/async', upload.single('file'), async (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded', message: 'Provide a file via the "file" field.' });
  }

  const targetFormat = (req.body.targetFormat || '').toLowerCase().trim();
  if (!targetFormat) {
    return res.status(400).json({ error: 'Missing targetFormat' });
  }

  const sourceFormat = getFormat(req.file);
  const jobId        = uuidv4();
  const outputPath   = buildOutputPath(jobId, targetFormat);

  // Create job record & respond immediately
  const job = createJob({
    id: jobId,
    sourceFile: req.file.originalname,
    from: sourceFormat,
    to: targetFormat,
  });

  const baseUrl      = getBaseUrl(req);
  const downloadPath = `/api/convert/download/${job.id}`;
  const pollPath     = `/api/convert/job/${job.id}`;

  res.status(202).json({
    jobId:        job.id,
    status:       job.status,
    pollUrl:      `${baseUrl}${pollPath}`,
    pollPath:     pollPath,
    downloadUrl:  `${baseUrl}${downloadPath}`,
    downloadPath: downloadPath,
    message:      'Conversion started. Poll the pollUrl for status.',
  });

  // Run conversion in background
  setImmediate(async () => {
    updateJob(jobId, { status: 'processing' });
    try {
      await convert(req.file.path, sourceFormat, targetFormat, outputPath);
      updateJob(jobId, { status: 'done', outputFile: outputPath });
    } catch (err) {
      logger.error('Async conversion failed', { jobId, error: err.message });
      updateJob(jobId, { status: 'failed', error: err.message });
    } finally {
      fs.unlink(req.file.path, () => {});
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/convert/job/:id
// ─────────────────────────────────────────────────────────────────────────────
router.get('/job/:id', (req, res) => {
  const job = getJob(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found' });

  const baseUrl      = getBaseUrl(req);
  const downloadPath = `/api/convert/download/${job.id}`;

  const response = {
    jobId:        job.id,
    status:       job.status,
    sourceFile:   job.sourceFile,
    from:         job.from,
    to:           job.to,
    createdAt:    job.createdAt,
    updatedAt:    job.updatedAt,
  };
  if (job.status === 'done') {
    response.downloadUrl  = `${baseUrl}${downloadPath}`;
    response.downloadPath = downloadPath;
  }
  if (job.status === 'failed') response.error = job.error;

  res.json(response);
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/convert/download/:id
// ─────────────────────────────────────────────────────────────────────────────
router.get('/download/:id', (req, res) => {
  const job = getJob(req.params.id);
  if (!job)                    return res.status(404).json({ error: 'Job not found' });
  if (job.status !== 'done')   return res.status(409).json({ error: 'Not ready', status: job.status });
  if (!job.outputFile)         return res.status(500).json({ error: 'Output file missing' });
  if (!fs.existsSync(job.outputFile)) {
    return res.status(410).json({ error: 'File expired or deleted' });
  }

  const mimeMap = {
    pdf:  'application/pdf',
    epub: 'application/epub+zip',
    html: 'text/html',
    txt:  'text/plain',
    mobi: 'application/x-mobipocket-ebook',
    azw3: 'application/vnd.amazon.ebook',
    lrf:  'application/x-lrf',
    pdb:  'application/vnd.palm',
    rtf:  'application/rtf',
    oeb:  'application/zip',  // OEB delivered as a zip archive
    fb2:  'application/x-fictionbook+xml',
    tcr:  'application/octet-stream',
  };
  const ext  = path.extname(job.outputFile).slice(1);
  const mime = mimeMap[ext] || 'application/octet-stream';
  const name = `${path.basename(job.sourceFile, path.extname(job.sourceFile))}.${ext}`;

  res.set('Content-Type', mime);
  res.set('Content-Disposition', `attachment; filename="${name}"`);
  res.sendFile(job.outputFile, { root: '/' });
});

module.exports = router;
