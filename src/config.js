/**
 * Application configuration
 */
const fs   = require('fs');
const path = require('path');

// Auto-load .env file if present
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath) && typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile(envPath);
  } catch (_) {}
}

// ─── Format definitions (mirroring the Flutter app constants) ────────────────

/** All accepted input formats */
const SUPPORTED_INPUT_FORMATS = [
  'epub', 'mobi', 'pdf', 'txt', 'azw3', 'lrf', 'fb2', 'tcr', 'rtf', 'pdb',
];

/**
 * Formats that can be produced from an EPUB source.
 * (epub → epub would be a no-op, so it's excluded.)
 */
const EPUB_OUTPUT_FORMATS = [
  'azw3', 'lrf', 'mobi', 'oeb', 'pdb', 'pdf', 'rtf', 'txt',
];

/**
 * Formats that can be produced from a non-EPUB source.
 * (includes epub itself as an output target)
 */
const NON_EPUB_OUTPUT_FORMATS = [
  'azw3', 'lrf', 'epub', 'mobi', 'oeb', 'pdb', 'pdf', 'rtf', 'txt',
];

/** Build the full conversions map automatically from the constants above. */
function buildSupportedConversions() {
  const map = {};
  for (const fmt of SUPPORTED_INPUT_FORMATS) {
    map[fmt] = fmt === 'epub' ? [...EPUB_OUTPUT_FORMATS] : [...NON_EPUB_OUTPUT_FORMATS];
  }
  // docx / html are accepted by the API even though not in the Flutter constants
  map.docx = ['epub', 'pdf', 'txt', 'html'];
  map.html  = ['epub', 'pdf', 'txt'];
  return map;
}

module.exports = {
  port: process.env.PORT || 3000,

  // Upload configuration
  upload: {
    dir: path.join(__dirname, '..', 'uploads'),
    maxFileSizeMB: parseInt(process.env.MAX_FILE_SIZE_MB || '100'),
    get maxFileSize() {
      return this.maxFileSizeMB * 1024 * 1024;
    },
  },

  // Output configuration
  output: {
    dir: path.join(__dirname, '..', 'converted'),
    // How long to keep converted files (ms) — default 1 hour
    ttlMs: parseInt(process.env.OUTPUT_TTL_MS || String(60 * 60 * 1000)),
  },

  // Supported format matrix (derived from the constants above)
  supportedConversions: buildSupportedConversions(),

  // Expose the raw constants for use in middleware / validation
  formats: {
    inputs:        SUPPORTED_INPUT_FORMATS,
    epubOutputs:   EPUB_OUTPUT_FORMATS,
    nonEpubOutputs: NON_EPUB_OUTPUT_FORMATS,
  },
};
