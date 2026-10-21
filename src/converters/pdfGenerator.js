'use strict';
/**
 * Text / HTML → PDF generator
 * Uses PDFKit with dynamic multi-script font fallback to support all languages
 * simultaneously in the same document (Chinese, Mandarin, Japanese, Amharic,
 * Korean, Arabic, Hebrew, Hindi, Russian/Cyrillic, Greek, European, etc.).
 */
const fs       = require('fs');
const path     = require('path');
const PDFKit   = require('pdfkit');
const fontkit  = require('fontkit');
const { htmlToText } = require('html-to-text');
const logger   = require('../logger');

let cachedFontPool = null;

/**
 * Initialize and cache the font pool in order of script breadth.
 */
function initFontPool() {
  if (cachedFontPool) return cachedFontPool;

  const pool = [];

  function add(label, fontPath, family = null) {
    if (!fontPath || !fs.existsSync(fontPath)) return;
    try {
      const ext = path.extname(fontPath).toLowerCase();
      let fkObj;
      if (ext === '.ttc') {
        const coll = fontkit.openSync(fontPath);
        if (!coll || !coll.fonts || !coll.fonts.length) return;
        fkObj = coll.fonts[0];
        family = fkObj.postscriptName;
      } else {
        fkObj = fontkit.openSync(fontPath);
      }
      pool.push({ label, path: fontPath, family, fontkit: fkObj });
    } catch (_) {}
  }

  // 1. User-configured custom font via environment variable
  if (process.env.PDF_FONT_PATH) {
    add('custom', process.env.PDF_FONT_PATH);
  }

  // 2. Universal Unicode font (covers 27 languages: Chinese, Japanese, Korean, Arabic, Hebrew, Hindi, Cyrillic, Latin)
  add('arial_unicode', '/System/Library/Fonts/Supplemental/Arial Unicode.ttf');
  add('arial_unicode_lib', '/Library/Fonts/Arial Unicode.ttf');
  add('arial_win', 'C:\\Windows\\Fonts\\arialuni.ttf');

  // 3. Bundled script-specific fonts (Amharic, Japanese, Chinese)
  add('ethiopic', path.join(__dirname, '..', '..', 'assets', 'fonts', 'NotoSansEthiopic.ttf'));
  add('japanese', path.join(__dirname, '..', '..', 'assets', 'fonts', 'BIZUDGothic-Regular.ttf'));
  add('chinese',  path.join(__dirname, '..', '..', 'assets', 'fonts', 'Chinese.ttf'));

  // 4. System fallbacks for Linux / Docker / macOS / Windows (only if needed)
  if (!pool.some(p => p.label.startsWith('arial'))) {
    add('wqy_zenhei_linux', '/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc');
    add('noto_cjk_linux', '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc');
    add('noto_cjk_truetype', '/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc');
    add('noto_ethiopic_linux', '/usr/share/fonts/truetype/noto/NotoSansEthiopic-Regular.ttf');
    add('kefa_mac', '/System/Library/Fonts/Supplemental/KefaIII.ttf');
    add('apple_gothic_mac', '/System/Library/Fonts/Supplemental/AppleGothic.ttf');
    add('noto_gothic_mac', '/System/Library/Fonts/Supplemental/NotoSansGothic-Regular.ttf');
    add('ipafont_linux', '/usr/share/fonts/truetype/ipafont-gothic/ipag.ttf');
    add('takao_linux', '/usr/share/fonts/truetype/takao-gothic/TakaoPGothic.ttf');
    add('dejavu_linux', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf');
    add('liberation_linux', '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf');
    add('nyala_win', 'C:\\Windows\\Fonts\\nyala.ttf');
    add('msgothic_win', 'C:\\Windows\\Fonts\\msgothic.ttc');
    add('msyh_win', 'C:\\Windows\\Fonts\\msyh.ttc');
  }

  if (pool.length > 0) {
    logger.info(`PDF font pool initialized with ${pool.length} font(s): ${pool.map(p => p.label).join(', ')}`);
  } else {
    logger.warn('No custom TrueType fonts found in pool; falling back to Helvetica.');
  }

  cachedFontPool = pool;
  return pool;
}

// In-memory cache for character-to-font mapping to ensure O(1) lookups
const charFontCache = new Map();

/**
 * Find the font in the pool that has a glyph for codePoint (memoized).
 */
function getFontForChar(pool, codePoint) {
  let cached = charFontCache.get(codePoint);
  if (cached !== undefined) return cached;

  for (const f of pool) {
    if (f.fontkit && f.fontkit.hasGlyphForCodePoint(codePoint)) {
      charFontCache.set(codePoint, f);
      return f;
    }
  }
  const fallback = pool[0] || null;
  charFontCache.set(codePoint, fallback);
  return fallback;
}

/**
 * Segment text into consecutive runs sharing the same font.
 */
function segmentText(text, pool) {
  if (!pool || !pool.length) {
    return [{ font: null, text }];
  }

  const runs = [];
  let curFont = null;
  let curBuf = '';

  for (const ch of text) {
    // Keep whitespace in the current run to minimize font-switching overhead
    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
      curBuf += ch;
      continue;
    }

    const cp = ch.codePointAt(0);
    const chosen = getFontForChar(pool, cp);

    if (curFont === null) {
      curFont = chosen;
      curBuf += ch;
    } else if (curFont.path === (chosen ? chosen.path : null)) {
      curBuf += ch;
    } else {
      runs.push({ font: curFont, text: curBuf });
      curFont = chosen;
      curBuf = ch;
    }
  }

  if (curBuf) {
    runs.push({ font: curFont, text: curBuf });
  }

  return runs;
}

/**
 * Write plain text content to a PDF file with multi-font fallback.
 */
function textToPdf(text, outputPath) {
  return new Promise((resolve, reject) => {
    const doc = new PDFKit({ margin: 60, size: 'A4' });
    const out  = fs.createWriteStream(outputPath);
    doc.pipe(out);

    const pool = initFontPool();
    const runs = segmentText(text, pool);

    for (let i = 0; i < runs.length; i++) {
      const isLast = (i === runs.length - 1);
      const run = runs[i];

      if (run.font) {
        if (run.font.family) {
          doc.font(run.font.path, run.font.family);
        } else {
          doc.font(run.font.path);
        }
      } else {
        doc.font('Helvetica');
      }

      doc.fontSize(12).text(run.text, {
        lineGap: 4,
        paragraphGap: 8,
        continued: !isLast,
      });
    }

    doc.end();
    out.on('finish', resolve);
    out.on('error', reject);
  });
}

/**
 * Convert HTML content to PDF with multi-script Unicode support.
 */
function htmlToPdf(htmlContent, outputPath) {
  const plainText = htmlToText(htmlContent, {
    wordwrap: 90,
    selectors: [
      { selector: 'h1', options: { uppercase: false } },
      { selector: 'h2', options: { uppercase: false } },
      { selector: 'img', format: 'skip' },
    ],
  });
  return textToPdf(plainText, outputPath);
}

module.exports = { textToPdf, htmlToPdf, initFontPool };
