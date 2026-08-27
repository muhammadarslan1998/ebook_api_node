'use strict';
/**
 * File upload middleware using multer.
 * Validates file type and size before accepting the upload.
 */
const multer = require('multer');
const path   = require('path');
const fs     = require('fs');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');

// Ensure upload directory exists
fs.mkdirSync(config.upload.dir, { recursive: true });

/**
 * Accepted input extensions — matches config.formats.inputs plus docx/html.
 * Normalise .htm → html, .azw → azw3 at the filter stage.
 */
const ALLOWED_EXTENSIONS = new Set([
  // From the Flutter supportedInputFormats constant
  'epub', 'mobi', 'pdf', 'txt', 'azw3', 'lrf', 'fb2', 'tcr', 'rtf', 'pdb',
  // Extra formats supported by the pure-JS converters
  'docx', 'html', 'htm',
]);

/**
 * MIME type allow-list.
 * For less-common eBook formats we also accept application/octet-stream
 * as a fallback because many HTTP clients send a generic binary type.
 */
const ALLOWED_MIME_TYPES = new Set([
  // Common document / eBook types
  'application/epub+zip',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'text/plain',
  'text/html',
  // Mobipocket / Kindle
  'application/x-mobipocket-ebook',
  'application/vnd.amazon.ebook',       // AZW3
  // Sony LRF
  'application/x-lrf',
  'application/vnd.palm',               // PDB
  // FictionBook
  'application/x-fictionbook+xml',
  'application/x-fictionbook',
  'text/xml', 'application/xml',        // fb2 / oeb / tcr (XML-based)
  // RTF
  'application/rtf',
  'text/rtf',
  // Generic binary fallback — Calibre-backed formats often arrive as this
  'application/octet-stream',
]);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, config.upload.dir),
  filename:    (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uuidv4()}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  let ext = path.extname(file.originalname).slice(1).toLowerCase();
  // Normalise aliases
  if (ext === 'htm') ext = 'html';
  if (ext === 'azw') ext = 'azw3';   // older Kindle format stored as .azw

  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return cb(
      Object.assign(
        new Error(`File type ".${ext}" is not supported. Allowed: ${[...ALLOWED_EXTENSIONS].join(', ')}`),
        { code: 'INVALID_FILE_TYPE' }
      ),
      false
    );
  }
  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: config.upload.maxFileSize },
});

module.exports = upload;
