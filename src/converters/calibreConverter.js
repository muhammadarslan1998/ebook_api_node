'use strict';
/**
 * calibreConverter.js
 *
 * Wraps Calibre's conversion tools to support the full format matrix:
 *
 *  Input formats : epub, mobi, pdf, txt, azw3, lrf, fb2, tcr, rtf, pdb
 *  Output formats: azw3, lrf, mobi, oeb, pdb, pdf, rtf, txt
 *
 * Runs conversions via `calibre-debug src/converters/calibreWrapper.py`
 * which includes safety patches for BeautifulSoup 4.14.x (used during LRF / HTML
 * conversions), and falls back to `ebook-convert` directly if needed.
 */

const { execFile } = require('child_process');
const path         = require('path');
const fs           = require('fs');
const util         = require('util');
const logger       = require('../logger');

const execFileAsync = util.promisify(execFile);

// ─── Locate Calibre Binaries ─────────────────────────────────────────────────

const CALIBRE_DEBUG_CANDIDATES = [
  process.env.CALIBRE_DEBUG_BIN,
  '/Applications/calibre.app/Contents/MacOS/calibre-debug',
  '/opt/homebrew/bin/calibre-debug',
  '/usr/local/bin/calibre-debug',
  '/usr/bin/calibre-debug',
  'calibre-debug',
].filter(Boolean);

const EBOOK_CONVERT_CANDIDATES = [
  process.env.CALIBRE_BIN,
  '/Applications/calibre.app/Contents/MacOS/ebook-convert',
  '/opt/homebrew/bin/ebook-convert',
  '/usr/local/bin/ebook-convert',
  '/usr/bin/ebook-convert',
  'ebook-convert',
].filter(Boolean);

let _calibreDebugPath = null;
let _ebookConvertPath = null;

function getCalibreDebugPath() {
  if (_calibreDebugPath) return _calibreDebugPath;
  for (const candidate of CALIBRE_DEBUG_CANDIDATES) {
    try {
      if (candidate === 'calibre-debug') {
        _calibreDebugPath = 'calibre-debug';
        return _calibreDebugPath;
      }
      if (fs.existsSync(candidate)) {
        _calibreDebugPath = candidate;
        return _calibreDebugPath;
      }
    } catch (_) { /* ignore */ }
  }
  return null;
}

function getEbookConvertPath() {
  if (_ebookConvertPath) return _ebookConvertPath;
  for (const candidate of EBOOK_CONVERT_CANDIDATES) {
    try {
      if (candidate === 'ebook-convert') {
        _ebookConvertPath = 'ebook-convert';
        return _ebookConvertPath;
      }
      if (fs.existsSync(candidate)) {
        _ebookConvertPath = candidate;
        return _ebookConvertPath;
      }
    } catch (_) { /* ignore */ }
  }
  return null;
}

// ─── Core convert function ───────────────────────────────────────────────────

const WRAPPER_SCRIPT = path.join(__dirname, 'calibreWrapper.py');

/**
 * Run Calibre conversion on inputPath → outputPath.
 *
 * @param {string} inputPath   - source file (must exist)
 * @param {string} outputPath  - destination file (Calibre creates it)
 * @param {object} [extraArgs] - optional extra CLI args
 */
async function calibreConvert(inputPath, outputPath, extraArgs = {}) {
  const debugBin   = getCalibreDebugPath();
  const convertBin = getEbookConvertPath();

  if (!debugBin && !convertBin) {
    const err = new Error(
      'Calibre is not installed or not found. ' +
      'Install Calibre (https://calibre-ebook.com/download) and make sure ' +
      'ebook-convert is on your PATH, or set the CALIBRE_BIN environment variable.'
    );
    err.code = 'CALIBRE_NOT_FOUND';
    throw err;
  }

  // Use calibre-debug with wrapper script if available to benefit from bug patches
  let binToExecute;
  let args;

  if (debugBin && fs.existsSync(WRAPPER_SCRIPT)) {
    binToExecute = debugBin;
    args = [WRAPPER_SCRIPT, inputPath, outputPath];
  } else {
    binToExecute = convertBin || 'ebook-convert';
    args = [inputPath, outputPath];
  }

  for (const [key, value] of Object.entries(extraArgs)) {
    args.push(key);
    if (value !== null && value !== undefined && value !== '') args.push(String(value));
  }

  try {
    await execFileAsync(binToExecute, args, {
      timeout: 5 * 60 * 1000, // 5-minute hard limit
      maxBuffer: 20 * 1024 * 1024,
    });
  } catch (err) {
    if (err.code === 'ENOENT') {
      _calibreDebugPath = null;
      _ebookConvertPath = null;
      const missing = new Error(
        'Calibre is not installed or not on PATH. ' +
        'Install it from https://calibre-ebook.com/download (macOS: brew install --cask calibre), ' +
        'then restart the server. You can also set CALIBRE_BIN=/path/to/ebook-convert in your .env.'
      );
      missing.code = 'CALIBRE_NOT_FOUND';
      throw missing;
    }

    const rawError = (err.stderr || err.stdout || err.message || '').trim();
    logger.error('Calibre conversion error output', { error: rawError });

    const details = rawError.slice(0, 1000);
    const wrapped = new Error(
      `Calibre conversion failed (${path.extname(inputPath)} → ${path.extname(outputPath)}): ${details}`
    );
    wrapped.code  = 'CALIBRE_CONVERSION_FAILED';
    wrapped.cause = err;
    throw wrapped;
  }
}

/**
 * Convenience: convert inputPath to outputPath where the formats are
 * inferred from the file extensions.
 */
async function convertWithCalibre(inputPath, outputPath) {
  return calibreConvert(inputPath, outputPath);
}

/**
 * Returns true if Calibre appears to be available on this machine.
 */
function isCalibreAvailable() {
  return getCalibreDebugPath() !== null || getEbookConvertPath() !== null;
}

module.exports = {
  calibreConvert,
  convertWithCalibre,
  isCalibreAvailable,
  getCalibrePath: getEbookConvertPath,
};
