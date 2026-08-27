'use strict';
/**
 * Global error handling middleware
 */
const logger = require('../logger');

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  logger.error(err.message, { stack: err.stack, code: err.code });

  // Multer errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      error: 'File too large',
      message: `Maximum allowed size is ${require('../config').upload.maxFileSizeMB} MB`,
    });
  }

  if (err.code === 'INVALID_FILE_TYPE') {
    return res.status(400).json({ error: 'Invalid file type', message: err.message });
  }

  if (err.code === 'UNSUPPORTED_CONVERSION') {
    return res.status(422).json({ error: 'Unsupported conversion', message: err.message });
  }

  if (err.code === 'CALIBRE_NOT_FOUND') {
    return res.status(503).json({
      error: 'Calibre not installed',
      message: err.message,
      hint: 'Install Calibre from https://calibre-ebook.com/download and restart the server.',
    });
  }

  if (err.code === 'CALIBRE_CONVERSION_FAILED') {
    return res.status(422).json({ error: 'Conversion failed', message: err.message });
  }

  // Default 500
  return res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'production' ? 'Something went wrong' : err.message,
  });
}

module.exports = errorHandler;
