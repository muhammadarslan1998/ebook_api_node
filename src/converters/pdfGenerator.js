'use strict';
/**
 * Text / HTML → PDF generator
 * Uses PDFKit with dynamic multi-script font fallback to support all world languages
 * simultaneously in the same document (Thai, Chinese, Mandarin, Japanese, Amharic,
 * Korean, Arabic, Hebrew, Hindi/Devanagari, Russian/Cyrillic, Greek, European, etc.).
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

  // 2. Bundled script-specific fonts (Google Noto Fonts & Universal CJK)
  add('latin',      path.join(__dirname, '..', '..', 'assets', 'fonts', 'NotoSans.ttf'));
  add('thai',       path.join(__dirname, '..', '..', 'assets', 'fonts', 'NotoSansThai.ttf'));
  add('ethiopic',   path.join(__dirname, '..', '..', 'assets', 'fonts', 'NotoSansEthiopic.ttf'));
  add('arabic',     path.join(__dirname, '..', '..', 'assets', 'fonts', 'NotoSansArabic.ttf'));
  add('devanagari', path.join(__dirname, '..', '..', 'assets', 'fonts', 'NotoSansDevanagari.ttf'));
  add('hebrew',     path.join(__dirname, '..', '..', 'assets', 'fonts', 'NotoSansHebrew.ttf'));
  add('chinese',    path.join(__dirname, '..', '..', 'assets', 'fonts', 'Chinese.ttf'));
  add('japanese',   path.join(__dirname, '..', '..', 'assets', 'fonts', 'BIZUDGothic-Regular.ttf'));
  add('korean',     path.join(__dirname, '..', '..', 'assets', 'fonts', 'NotoSansKR.ttf'));

  // 3. Universal Unicode fonts
  add('arial_unicode',     '/System/Library/Fonts/Supplemental/Arial Unicode.ttf');
  add('arial_unicode_lib', '/Library/Fonts/Arial Unicode.ttf');
  add('arial_win',         'C:\\Windows\\Fonts\\arialuni.ttf');

  // 4. System fallbacks for Linux / Docker / macOS / Windows
  add('kefa_mac',            '/System/Library/Fonts/Supplemental/KefaIII.ttf');
  add('apple_gothic_mac',    '/System/Library/Fonts/Supplemental/AppleGothic.ttf');
  add('noto_gothic_mac',     '/System/Library/Fonts/Supplemental/NotoSansGothic-Regular.ttf');
  add('noto_cjk_linux',      '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc');
  add('noto_cjk_truetype',   '/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc');
  add('wqy_zenhei_linux',    '/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc');
  add('noto_thai_linux',     '/usr/share/fonts/truetype/noto/NotoSansThai-Regular.ttf');
  add('noto_ethiopic_linux', '/usr/share/fonts/truetype/noto/NotoSansEthiopic-Regular.ttf');
  add('ipafont_linux',       '/usr/share/fonts/truetype/ipafont-gothic/ipag.ttf');
  add('takao_linux',         '/usr/share/fonts/truetype/takao-gothic/TakaoPGothic.ttf');
  add('dejavu_linux',        '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf');
  add('liberation_linux',    '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf');
  add('nyala_win',           'C:\\Windows\\Fonts\\nyala.ttf');
  add('msgothic_win',        'C:\\Windows\\Fonts\\msgothic.ttc');
  add('msyh_win',            'C:\\Windows\\Fonts\\msyh.ttc');

  if (pool.length > 0) {
    logger.info(`PDF font pool initialized with ${pool.length} font(s): ${pool.map(p => p.label).join(', ')}`);
  } else {
    logger.warn('No custom TrueType fonts found in pool; falling back to Helvetica.');
  }

  cachedFontPool = pool;
  return pool;
}

/**
 * Find the font in the pool that best matches the script of codePoint.
 */
function getFontForChar(pool, codePoint) {
  // 1. Thai (U+0E00–U+0E7F)
  if (codePoint >= 0x0E00 && codePoint <= 0x0E7F) {
    const f = pool.find(p => p.label === 'thai' || p.label.includes('thai'));
    if (f && f.fontkit && f.fontkit.hasGlyphForCodePoint(codePoint)) return f;
  }

  // 2. Ethiopic / Amharic
  if ((codePoint >= 0x1200 && codePoint <= 0x137F) ||
      (codePoint >= 0x1380 && codePoint <= 0x139F) ||
      (codePoint >= 0x2D80 && codePoint <= 0x2DDF) ||
      (codePoint >= 0xAB00 && codePoint <= 0xAB2F)) {
    const f = pool.find(p => p.label === 'ethiopic' || p.label.includes('ethiopic') || p.label === 'kefa_mac');
    if (f && f.fontkit && f.fontkit.hasGlyphForCodePoint(codePoint)) return f;
  }

  // 3. Arabic / Persian / Urdu
  if ((codePoint >= 0x0600 && codePoint <= 0x06FF) ||
      (codePoint >= 0x0750 && codePoint <= 0x077F) ||
      (codePoint >= 0x08A0 && codePoint <= 0x08FF) ||
      (codePoint >= 0xFB50 && codePoint <= 0xFDFF) ||
      (codePoint >= 0xFE70 && codePoint <= 0xFEFF)) {
    const f = pool.find(p => p.label === 'arabic' || p.label.includes('arabic'));
    if (f && f.fontkit && f.fontkit.hasGlyphForCodePoint(codePoint)) return f;
  }

  // 4. Devanagari (Hindi, Marathi, Sanskrit, Nepali)
  if ((codePoint >= 0x0900 && codePoint <= 0x097F) ||
      (codePoint >= 0xA8E0 && codePoint <= 0xA8FF)) {
    const f = pool.find(p => p.label === 'devanagari' || p.label.includes('devanagari'));
    if (f && f.fontkit && f.fontkit.hasGlyphForCodePoint(codePoint)) return f;
  }

  // 5. Hebrew
  if ((codePoint >= 0x0590 && codePoint <= 0x05FF) ||
      (codePoint >= 0xFB1D && codePoint <= 0xFB4F)) {
    const f = pool.find(p => p.label === 'hebrew' || p.label.includes('hebrew'));
    if (f && f.fontkit && f.fontkit.hasGlyphForCodePoint(codePoint)) return f;
  }

  // 6. Korean (Hangul)
  if ((codePoint >= 0xAC00 && codePoint <= 0xD7AF) ||
      (codePoint >= 0x1100 && codePoint <= 0x11FF) ||
      (codePoint >= 0x3130 && codePoint <= 0x318F)) {
    const f = pool.find(p => (p.label === 'korean' || p.label.includes('kr') || p.label === 'arial_unicode') && p.fontkit && p.fontkit.hasGlyphForCodePoint(codePoint));
    if (f) return f;
  }

  // 7. Japanese Hiragana & Katakana
  if ((codePoint >= 0x3040 && codePoint <= 0x309F) ||
      (codePoint >= 0x30A0 && codePoint <= 0x30FF) ||
      (codePoint >= 0xFF65 && codePoint <= 0xFF9F)) {
    const f = pool.find(p => (p.label === 'japanese' || p.label === 'arial_unicode') && p.fontkit && p.fontkit.hasGlyphForCodePoint(codePoint));
    if (f) return f;
  }

  // 8. CJK Ideographs (Hanzi / Kanji / Hanja)
  if ((codePoint >= 0x4E00 && codePoint <= 0x9FFF) ||
      (codePoint >= 0x3400 && codePoint <= 0x4DBF)) {
    const f = pool.find(p => (p.label === 'chinese' || p.label === 'japanese' || p.label === 'korean' || p.label === 'arial_unicode') && p.fontkit && p.fontkit.hasGlyphForCodePoint(codePoint));
    if (f) return f;
  }

  // 9. Cyrillic & Greek
  if ((codePoint >= 0x0400 && codePoint <= 0x052F) ||
      (codePoint >= 0x0370 && codePoint <= 0x03FF) ||
      (codePoint >= 0x1F00 && codePoint <= 0x1FFF)) {
    const f = pool.find(p => (p.label === 'latin' || p.label === 'japanese' || p.label === 'arial_unicode') && p.fontkit && p.fontkit.hasGlyphForCodePoint(codePoint));
    if (f) return f;
  }

  // 10. Latin / Western
  if (codePoint <= 0x024F) {
    const f = pool.find(p => (p.label === 'latin' || p.label === 'arial_unicode') && p.fontkit && p.fontkit.hasGlyphForCodePoint(codePoint));
    if (f) return f;
  }

  // 11. General search: any font having the glyph
  for (const f of pool) {
    if (f.fontkit && f.fontkit.hasGlyphForCodePoint(codePoint)) {
      return f;
    }
  }

  return pool[0] || null;
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

    // If current font is already active and supports this basic ASCII / punctuation character,
    // stay in current font to avoid micro-fragmenting sentences
    if (curFont && curFont.fontkit && cp <= 0x7F && curFont.fontkit.hasGlyphForCodePoint(cp)) {
      curBuf += ch;
      continue;
    }

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
