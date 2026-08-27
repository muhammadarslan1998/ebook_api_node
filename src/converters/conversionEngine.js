'use strict';
/**
 * Central conversion engine — dispatches to the correct converter
 * based on (sourceFormat, targetFormat).
 *
 * All converters receive inputPath and write their output to outputPath.
 *
 * Format support matrix
 * ─────────────────────
 *  Input formats  : epub · mobi · pdf · txt · azw3 · lrf · fb2 · tcr · rtf · pdb
 *
 *  Output formats (epub source) : azw3 · lrf · mobi · oeb · pdb · pdf · rtf · txt
 *  Output formats (other source): azw3 · lrf · epub · mobi · oeb · pdb · pdf · rtf · txt
 *
 * Pure-JS converters handle the common epub/pdf/txt pairs.
 * Calibre's ebook-convert handles all remaining format pairs.
 */
const fs   = require('fs');
const path = require('path');
const os   = require('os');
const { v4: uuidv4 } = require('uuid');

const { epubToHtml, epubToText }                           = require('./epubConverter');
const { docxToHtml, docxToText, docxToEpubContent }        = require('./docxConverter');
const { pdfToText, pdfToHtml }                             = require('./pdfConverter');
const { textToPdf, htmlToPdf }                             = require('./pdfGenerator');
const { generateEpub, textToEpub, htmlToEpub }             = require('./epubGenerator');
const { htmlContentToText, textContentToHtml }             = require('./htmlConverter');
const { convertWithCalibre }                               = require('./calibreConverter');
const archiver = require('archiver');
const logger = require('../logger');

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Zip a directory into a single archive file.
 */
function zipDir(srcDir, destZip) {
  return new Promise((resolve, reject) => {
    const output  = fs.createWriteStream(destZip);
    const archive = archiver('zip', { zlib: { level: 6 } });
    output.on('close', resolve);
    archive.on('error', reject);
    archive.pipe(output);
    archive.directory(srcDir, false);
    archive.finalize();
  });
}

/**
 * Write inputPath to a temp file with the desired extension, run calibreConvert,
 * then move/copy result to outputPath.
 * This is needed when the input file on-disk has a UUID name without the right
 * extension — Calibre relies on extensions for format detection.
 *
 * NOTE: Calibre outputs OEB as a directory; we zip it automatically.
 */
async function calibreViaTemp(inputPath, inputExt, outputPath, outputExt) {
  const tmpDir   = os.tmpdir();
  const tmpIn    = path.join(tmpDir, `${uuidv4()}.${inputExt}`);
  const tmpOut   = path.join(tmpDir, `${uuidv4()}.${outputExt}`);

  // Hard-link or copy input to a file with the correct extension
  try { fs.linkSync(inputPath, tmpIn); } catch { fs.writeFileSync(tmpIn, fs.readFileSync(inputPath)); }

  try {
    await convertWithCalibre(tmpIn, tmpOut);

    // Calibre may produce a directory (e.g. OEB) — zip it into a single file
    const stat = fs.statSync(tmpOut);
    if (stat.isDirectory()) {
      const tmpZip = `${tmpOut}.zip`;
      await zipDir(tmpOut, tmpZip);
      // Replace tmpOut ref so the cleanup below removes the zip too
      try { fs.renameSync(tmpZip, outputPath); } catch { fs.writeFileSync(outputPath, fs.readFileSync(tmpZip)); fs.unlinkSync(tmpZip); }
    } else {
      // Use renameSync first (O(1) on same device); fall back to buffer copy
      // to avoid ENOTSUP from macOS clonefileat across filesystem boundaries
      // (e.g. /var/folders → project volume).
      try {
        fs.renameSync(tmpOut, outputPath);
      } catch {
        fs.writeFileSync(outputPath, fs.readFileSync(tmpOut));
      }
    }
  } finally {
    try { fs.unlinkSync(tmpIn); } catch {}
    // tmpOut could be a file or directory
    try {
      const s = fs.statSync(tmpOut);
      if (s.isDirectory()) fs.rmSync(tmpOut, { recursive: true, force: true });
      else fs.unlinkSync(tmpOut);
    } catch {}
  }
}

/** Build a calibre dispatcher for (fromExt, toExt). */
function calibre(fromExt, toExt) {
  return (inputPath, outputPath) => calibreViaTemp(inputPath, fromExt, outputPath, toExt);
}

// ─────────────────────────────────────────────────────────────────────────────
// Conversion dispatch table
// Each entry: `${from}:${to}` → async (inputPath, outputPath) => void
// ─────────────────────────────────────────────────────────────────────────────
const CONVERTERS = {

  // ── EPUB as source ────────────────────────────────────────────────────────
  'epub:html': async (i, o) => {
    const html = await epubToHtml(i);
    fs.writeFileSync(o, html, 'utf8');
  },
  'epub:txt': async (i, o) => {
    const text = await epubToText(i);
    fs.writeFileSync(o, text, 'utf8');
  },
  'epub:pdf': async (i, o) => {
    const html = await epubToHtml(i);
    await htmlToPdf(html, o);
  },
  // Calibre-backed EPUB outputs
  'epub:azw3': calibre('epub', 'azw3'),
  'epub:lrf':  calibre('epub', 'lrf'),
  'epub:mobi': calibre('epub', 'mobi'),
  'epub:oeb':  calibre('epub', 'oeb'),
  'epub:pdb':  calibre('epub', 'pdb'),
  'epub:rtf':  calibre('epub', 'rtf'),

  // ── MOBI as source ────────────────────────────────────────────────────────
  'mobi:epub': calibre('mobi', 'epub'),
  'mobi:txt':  calibre('mobi', 'txt'),
  'mobi:pdf':  calibre('mobi', 'pdf'),
  'mobi:azw3': calibre('mobi', 'azw3'),
  'mobi:lrf':  calibre('mobi', 'lrf'),
  'mobi:oeb':  calibre('mobi', 'oeb'),
  'mobi:pdb':  calibre('mobi', 'pdb'),
  'mobi:rtf':  calibre('mobi', 'rtf'),

  // ── AZW3 as source ────────────────────────────────────────────────────────
  'azw3:epub': calibre('azw3', 'epub'),
  'azw3:mobi': calibre('azw3', 'mobi'),
  'azw3:pdf':  calibre('azw3', 'pdf'),
  'azw3:txt':  calibre('azw3', 'txt'),
  'azw3:lrf':  calibre('azw3', 'lrf'),
  'azw3:oeb':  calibre('azw3', 'oeb'),
  'azw3:pdb':  calibre('azw3', 'pdb'),
  'azw3:rtf':  calibre('azw3', 'rtf'),

  // ── LRF as source ─────────────────────────────────────────────────────────
  'lrf:epub':  calibre('lrf', 'epub'),
  'lrf:mobi':  calibre('lrf', 'mobi'),
  'lrf:azw3':  calibre('lrf', 'azw3'),
  'lrf:pdf':   calibre('lrf', 'pdf'),
  'lrf:txt':   calibre('lrf', 'txt'),
  'lrf:oeb':   calibre('lrf', 'oeb'),
  'lrf:pdb':   calibre('lrf', 'pdb'),
  'lrf:rtf':   calibre('lrf', 'rtf'),

  // ── FB2 as source ─────────────────────────────────────────────────────────
  'fb2:epub':  calibre('fb2', 'epub'),
  'fb2:mobi':  calibre('fb2', 'mobi'),
  'fb2:azw3':  calibre('fb2', 'azw3'),
  'fb2:pdf':   calibre('fb2', 'pdf'),
  'fb2:txt':   calibre('fb2', 'txt'),
  'fb2:lrf':   calibre('fb2', 'lrf'),
  'fb2:oeb':   calibre('fb2', 'oeb'),
  'fb2:pdb':   calibre('fb2', 'pdb'),
  'fb2:rtf':   calibre('fb2', 'rtf'),

  // ── TCR as source ─────────────────────────────────────────────────────────
  'tcr:epub':  calibre('tcr', 'epub'),
  'tcr:mobi':  calibre('tcr', 'mobi'),
  'tcr:azw3':  calibre('tcr', 'azw3'),
  'tcr:pdf':   calibre('tcr', 'pdf'),
  'tcr:txt':   calibre('tcr', 'txt'),
  'tcr:lrf':   calibre('tcr', 'lrf'),
  'tcr:oeb':   calibre('tcr', 'oeb'),
  'tcr:pdb':   calibre('tcr', 'pdb'),
  'tcr:rtf':   calibre('tcr', 'rtf'),

  // ── RTF as source ─────────────────────────────────────────────────────────
  'rtf:epub':  calibre('rtf', 'epub'),
  'rtf:mobi':  calibre('rtf', 'mobi'),
  'rtf:azw3':  calibre('rtf', 'azw3'),
  'rtf:pdf':   calibre('rtf', 'pdf'),
  'rtf:txt':   calibre('rtf', 'txt'),
  'rtf:lrf':   calibre('rtf', 'lrf'),
  'rtf:oeb':   calibre('rtf', 'oeb'),
  'rtf:pdb':   calibre('rtf', 'pdb'),

  // ── PDB as source ─────────────────────────────────────────────────────────
  'pdb:epub':  calibre('pdb', 'epub'),
  'pdb:mobi':  calibre('pdb', 'mobi'),
  'pdb:azw3':  calibre('pdb', 'azw3'),
  'pdb:pdf':   calibre('pdb', 'pdf'),
  'pdb:txt':   calibre('pdb', 'txt'),
  'pdb:lrf':   calibre('pdb', 'lrf'),
  'pdb:oeb':   calibre('pdb', 'oeb'),
  'pdb:rtf':   calibre('pdb', 'rtf'),

  // ── PDF as source ─────────────────────────────────────────────────────────
  'pdf:txt': async (i, o) => {
    const text = await pdfToText(i);
    fs.writeFileSync(o, text, 'utf8');
  },
  'pdf:html': async (i, o) => {
    const html = await pdfToHtml(i);
    fs.writeFileSync(o, html, 'utf8');
  },
  'pdf:epub': async (i, o) => {
    const text = await pdfToText(i);
    await textToEpub(text, o, { title: path.basename(i, '.pdf') });
  },
  // Calibre-backed PDF outputs
  'pdf:azw3': calibre('pdf', 'azw3'),
  'pdf:lrf':  calibre('pdf', 'lrf'),
  'pdf:mobi': calibre('pdf', 'mobi'),
  'pdf:oeb':  calibre('pdf', 'oeb'),
  'pdf:pdb':  calibre('pdf', 'pdb'),
  'pdf:rtf':  calibre('pdf', 'rtf'),

  // ── TXT as source ─────────────────────────────────────────────────────────
  'txt:html': async (i, o) => {
    const text = fs.readFileSync(i, 'utf8');
    const html = textContentToHtml(text);
    fs.writeFileSync(o, html, 'utf8');
  },
  'txt:pdf': async (i, o) => {
    const text = fs.readFileSync(i, 'utf8');
    await textToPdf(text, o);
  },
  'txt:epub': async (i, o) => {
    const text = fs.readFileSync(i, 'utf8');
    await textToEpub(text, o, { title: path.basename(i, '.txt') });
  },
  // Calibre-backed TXT outputs
  'txt:azw3': calibre('txt', 'azw3'),
  'txt:lrf':  calibre('txt', 'lrf'),
  'txt:mobi': calibre('txt', 'mobi'),
  'txt:oeb':  calibre('txt', 'oeb'),
  'txt:pdb':  calibre('txt', 'pdb'),
  'txt:rtf':  calibre('txt', 'rtf'),

  // ── DOCX as source ────────────────────────────────────────────────────────
  'docx:html': async (i, o) => {
    const html = await docxToHtml(i);
    fs.writeFileSync(o, html, 'utf8');
  },
  'docx:txt': async (i, o) => {
    const text = await docxToText(i);
    fs.writeFileSync(o, text, 'utf8');
  },
  'docx:pdf': async (i, o) => {
    const html = await docxToHtml(i);
    await htmlToPdf(html, o);
  },
  'docx:epub': async (i, o) => {
    const { metadata, chapters } = await docxToEpubContent(i);
    await generateEpub({
      title:    metadata.title,
      author:   metadata.author,
      lang:     metadata.language,
      chapters: chapters.map(c => ({ title: c.title, content: c.html })),
    }, o);
  },

  // ── HTML as source ────────────────────────────────────────────────────────
  'html:txt': async (i, o) => {
    const html = fs.readFileSync(i, 'utf8');
    const text = htmlContentToText(html);
    fs.writeFileSync(o, text, 'utf8');
  },
  'html:pdf': async (i, o) => {
    const html = fs.readFileSync(i, 'utf8');
    await htmlToPdf(html, o);
  },
  'html:epub': async (i, o) => {
    const html = fs.readFileSync(i, 'utf8');
    await htmlToEpub(html, o, { title: path.basename(i, '.html') });
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Convert a file.
 * @param {string} inputPath   - absolute path to uploaded file
 * @param {string} sourceFormat  - e.g. 'epub', 'pdf', 'mobi', 'azw3', 'rtf', …
 * @param {string} targetFormat  - e.g. 'epub', 'pdf', 'mobi', 'azw3', 'rtf', …
 * @param {string} outputPath  - absolute path to write the result
 */
async function convert(inputPath, sourceFormat, targetFormat, outputPath) {
  const key = `${sourceFormat.toLowerCase()}:${targetFormat.toLowerCase()}`;
  const converterFn = CONVERTERS[key];

  if (!converterFn) {
    const err = new Error(`Conversion from "${sourceFormat}" to "${targetFormat}" is not supported.`);
    err.code = 'UNSUPPORTED_CONVERSION';
    throw err;
  }

  logger.info(`Starting conversion`, { from: sourceFormat, to: targetFormat, input: path.basename(inputPath) });
  await converterFn(inputPath, outputPath);
  logger.info(`Conversion complete`, { output: path.basename(outputPath) });
}

/**
 * Return supported conversion targets for a given source format.
 */
function getSupportedTargets(sourceFormat) {
  return Object.keys(CONVERTERS)
    .filter(k => k.startsWith(sourceFormat.toLowerCase() + ':'))
    .map(k => k.split(':')[1]);
}

/**
 * Return all supported conversions as { from → [to, ...] }
 */
function getAllSupportedConversions() {
  const map = {};
  for (const key of Object.keys(CONVERTERS)) {
    const [from, to] = key.split(':');
    if (!map[from]) map[from] = [];
    map[from].push(to);
  }
  return map;
}

module.exports = { convert, getSupportedTargets, getAllSupportedConversions };
