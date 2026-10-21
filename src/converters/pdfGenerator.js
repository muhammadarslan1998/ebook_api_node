'use strict';
/**
 * Text / HTML → PDF generator
 * Uses PDFKit with dynamic multi-script font fallback to support ALL world languages
 * simultaneously in the same document:
 *  - Indic / South Asian: Tamil, Malayalam, Telugu, Kannada, Bengali, Gujarati,
 *    Gurmukhi (Punjabi), Odia, Sinhala, Devanagari (Hindi, Marathi, Sanskrit, Nepali)
 *  - Southeast Asian: Thai, Myanmar (Burmese), Khmer, Lao
 *  - Middle Eastern / Central Asian: Arabic, Persian, Urdu, Hebrew, Armenian, Georgian, Tibetan
 *  - East Asian: Chinese (Simplified & Traditional), Japanese, Korean
 *  - African: Ethiopic (Amharic, Tigrinya)
 *  - European / Global: Latin, Cyrillic (Russian, Ukrainian, etc.), Greek, Vietnamese
 */
const fs       = require('fs');
const path     = require('path');
const PDFKit   = require('pdfkit');
const fontkit  = require('fontkit');
const { htmlToText } = require('html-to-text');
const logger   = require('../logger');

// Ensure fontkit handles null GPOS anchors gracefully for complex scripts
try {
  require('../../scripts/patch-fontkit');
} catch (_) {}

let cachedFontPool = null;

/**
 * Initialize and cache the universal font pool.
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

  // 2. Bundled universal fonts (Google Noto Fonts & Universal CJK in assets/fonts/)
  const fontsDir = path.join(__dirname, '..', '..', 'assets', 'fonts');
  add('latin',      path.join(fontsDir, 'NotoSans.ttf'));
  add('tamil',      path.join(fontsDir, 'NotoSansTamil.ttf'));
  add('malayalam',  path.join(fontsDir, 'NotoSansMalayalam.ttf'));
  add('telugu',     path.join(fontsDir, 'NotoSansTelugu.ttf'));
  add('kannada',    path.join(fontsDir, 'NotoSansKannada.ttf'));
  add('bengali',    path.join(fontsDir, 'NotoSansBengali.ttf'));
  add('gujarati',   path.join(fontsDir, 'NotoSansGujarati.ttf'));
  add('gurmukhi',   path.join(fontsDir, 'NotoSansGurmukhi.ttf'));
  add('oriya',      path.join(fontsDir, 'NotoSansOriya.ttf'));
  add('sinhala',    path.join(fontsDir, 'NotoSansSinhala.ttf'));
  add('myanmar',    path.join(fontsDir, 'NotoSansMyanmar.ttf'));
  add('khmer',      path.join(fontsDir, 'NotoSansKhmer.ttf'));
  add('lao',        path.join(fontsDir, 'NotoSansLao.ttf'));
  add('tibetan',    path.join(fontsDir, 'NotoSerifTibetan.ttf'));
  add('georgian',   path.join(fontsDir, 'NotoSansGeorgian.ttf'));
  add('armenian',   path.join(fontsDir, 'NotoSansArmenian.ttf'));
  add('thai',       path.join(fontsDir, 'NotoSansThai.ttf'));
  add('ethiopic',   path.join(fontsDir, 'NotoSansEthiopic.ttf'));
  add('arabic',     path.join(fontsDir, 'NotoSansArabic.ttf'));
  add('devanagari', path.join(fontsDir, 'NotoSansDevanagari.ttf'));
  add('hebrew',     path.join(fontsDir, 'NotoSansHebrew.ttf'));
  add('chinese',    path.join(fontsDir, 'Chinese.ttf'));
  add('japanese',   path.join(fontsDir, 'BIZUDGothic-Regular.ttf'));
  add('korean',     path.join(fontsDir, 'NotoSansKR.ttf'));

  // 3. System Unicode fallbacks
  add('arial_unicode',     '/System/Library/Fonts/Supplemental/Arial Unicode.ttf');
  add('arial_unicode_lib', '/Library/Fonts/Arial Unicode.ttf');
  add('arial_win',         'C:\\Windows\\Fonts\\arialuni.ttf');
  add('noto_cjk_linux',    '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc');
  add('noto_cjk_truetype', '/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc');

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
  // 1. Tamil (U+0B80–U+0BFF)
  if (codePoint >= 0x0B80 && codePoint <= 0x0BFF) {
    const f = pool.find(p => p.label === 'tamil');
    if (f && f.fontkit && f.fontkit.hasGlyphForCodePoint(codePoint)) return f;
  }

  // 2. Malayalam (U+0D00–U+0D7F)
  if (codePoint >= 0x0D00 && codePoint <= 0x0D7F) {
    const f = pool.find(p => p.label === 'malayalam');
    if (f && f.fontkit && f.fontkit.hasGlyphForCodePoint(codePoint)) return f;
  }

  // 3. Telugu (U+0C00–U+0C7F)
  if (codePoint >= 0x0C00 && codePoint <= 0x0C7F) {
    const f = pool.find(p => p.label === 'telugu');
    if (f && f.fontkit && f.fontkit.hasGlyphForCodePoint(codePoint)) return f;
  }

  // 4. Kannada (U+0C80–U+0CFF)
  if (codePoint >= 0x0C80 && codePoint <= 0x0CFF) {
    const f = pool.find(p => p.label === 'kannada');
    if (f && f.fontkit && f.fontkit.hasGlyphForCodePoint(codePoint)) return f;
  }

  // 5. Bengali & Assamese (U+0980–U+09FF)
  if (codePoint >= 0x0980 && codePoint <= 0x09FF) {
    const f = pool.find(p => p.label === 'bengali');
    if (f && f.fontkit && f.fontkit.hasGlyphForCodePoint(codePoint)) return f;
  }

  // 6. Gujarati (U+0A80–U+0AFF)
  if (codePoint >= 0x0A80 && codePoint <= 0x0AFF) {
    const f = pool.find(p => p.label === 'gujarati');
    if (f && f.fontkit && f.fontkit.hasGlyphForCodePoint(codePoint)) return f;
  }

  // 7. Gurmukhi / Punjabi (U+0A00–U+0A7F)
  if (codePoint >= 0x0A00 && codePoint <= 0x0A7F) {
    const f = pool.find(p => p.label === 'gurmukhi');
    if (f && f.fontkit && f.fontkit.hasGlyphForCodePoint(codePoint)) return f;
  }

  // 8. Odia / Oriya (U+0B00–U+0B7F)
  if (codePoint >= 0x0B00 && codePoint <= 0x0B7F) {
    const f = pool.find(p => p.label === 'oriya');
    if (f && f.fontkit && f.fontkit.hasGlyphForCodePoint(codePoint)) return f;
  }

  // 9. Sinhala (U+0D80–U+0DFF)
  if (codePoint >= 0x0D80 && codePoint <= 0x0DFF) {
    const f = pool.find(p => p.label === 'sinhala');
    if (f && f.fontkit && f.fontkit.hasGlyphForCodePoint(codePoint)) return f;
  }

  // 10. Myanmar / Burmese (U+1000–U+109F, U+A9E0–U+A9FF)
  if ((codePoint >= 0x1000 && codePoint <= 0x109F) || (codePoint >= 0xA9E0 && codePoint <= 0xA9FF)) {
    const f = pool.find(p => p.label === 'myanmar');
    if (f && f.fontkit && f.fontkit.hasGlyphForCodePoint(codePoint)) return f;
  }

  // 11. Khmer / Cambodian (U+1780–U+17FF, U+19E0–U+19FF)
  if ((codePoint >= 0x1780 && codePoint <= 0x17FF) || (codePoint >= 0x19E0 && codePoint <= 0x19FF)) {
    const f = pool.find(p => p.label === 'khmer');
    if (f && f.fontkit && f.fontkit.hasGlyphForCodePoint(codePoint)) return f;
  }

  // 12. Lao (U+0E80–U+0EFF)
  if (codePoint >= 0x0E80 && codePoint <= 0x0EFF) {
    const f = pool.find(p => p.label === 'lao');
    if (f && f.fontkit && f.fontkit.hasGlyphForCodePoint(codePoint)) return f;
  }

  // 13. Tibetan (U+0F00–U+0FFF)
  if (codePoint >= 0x0F00 && codePoint <= 0x0FFF) {
    const f = pool.find(p => p.label === 'tibetan');
    if (f && f.fontkit && f.fontkit.hasGlyphForCodePoint(codePoint)) return f;
  }

  // 14. Georgian (U+10A0–U+10FF, U+1C90–U+1CBF, U+2D00–U+2D2F)
  if ((codePoint >= 0x10A0 && codePoint <= 0x10FF) ||
      (codePoint >= 0x1C90 && codePoint <= 0x1CBF) ||
      (codePoint >= 0x2D00 && codePoint <= 0x2D2F)) {
    const f = pool.find(p => p.label === 'georgian');
    if (f && f.fontkit && f.fontkit.hasGlyphForCodePoint(codePoint)) return f;
  }

  // 15. Armenian (U+0530–U+058F, U+FB13–U+FB17)
  if ((codePoint >= 0x0530 && codePoint <= 0x058F) || (codePoint >= 0xFB13 && codePoint <= 0xFB17)) {
    const f = pool.find(p => p.label === 'armenian');
    if (f && f.fontkit && f.fontkit.hasGlyphForCodePoint(codePoint)) return f;
  }

  // 16. Thai (U+0E00–U+0E7F)
  if (codePoint >= 0x0E00 && codePoint <= 0x0E7F) {
    const f = pool.find(p => p.label === 'thai');
    if (f && f.fontkit && f.fontkit.hasGlyphForCodePoint(codePoint)) return f;
  }

  // 17. Ethiopic / Amharic (U+1200–U+137F, U+1380–U+139F, U+2D80–U+2DDF, U+AB00–U+AB2F)
  if ((codePoint >= 0x1200 && codePoint <= 0x137F) ||
      (codePoint >= 0x1380 && codePoint <= 0x139F) ||
      (codePoint >= 0x2D80 && codePoint <= 0x2DDF) ||
      (codePoint >= 0xAB00 && codePoint <= 0xAB2F)) {
    const f = pool.find(p => p.label === 'ethiopic');
    if (f && f.fontkit && f.fontkit.hasGlyphForCodePoint(codePoint)) return f;
  }

  // 18. Arabic / Persian / Urdu (U+0600–U+06FF, U+0750–U+077F, U+08A0–U+08FF, U+FB50–U+FDFF, U+FE70–U+FEFF)
  if ((codePoint >= 0x0600 && codePoint <= 0x06FF) ||
      (codePoint >= 0x0750 && codePoint <= 0x077F) ||
      (codePoint >= 0x08A0 && codePoint <= 0x08FF) ||
      (codePoint >= 0xFB50 && codePoint <= 0xFDFF) ||
      (codePoint >= 0xFE70 && codePoint <= 0xFEFF)) {
    const f = pool.find(p => p.label === 'arabic');
    if (f && f.fontkit && f.fontkit.hasGlyphForCodePoint(codePoint)) return f;
  }

  // 19. Devanagari (Hindi, Marathi, Sanskrit, Nepali) (U+0900–U+097F, U+A8E0–U+A8FF)
  if ((codePoint >= 0x0900 && codePoint <= 0x097F) ||
      (codePoint >= 0xA8E0 && codePoint <= 0xA8FF)) {
    const f = pool.find(p => p.label === 'devanagari');
    if (f && f.fontkit && f.fontkit.hasGlyphForCodePoint(codePoint)) return f;
  }

  // 20. Hebrew (U+0590–U+05FF, U+FB1D–U+FB4F)
  if ((codePoint >= 0x0590 && codePoint <= 0x05FF) ||
      (codePoint >= 0xFB1D && codePoint <= 0xFB4F)) {
    const f = pool.find(p => p.label === 'hebrew');
    if (f && f.fontkit && f.fontkit.hasGlyphForCodePoint(codePoint)) return f;
  }

  // 21. Korean Hangul (U+AC00–U+D7AF, U+1100–U+11FF, U+3130–U+318F)
  if ((codePoint >= 0xAC00 && codePoint <= 0xD7AF) ||
      (codePoint >= 0x1100 && codePoint <= 0x11FF) ||
      (codePoint >= 0x3130 && codePoint <= 0x318F)) {
    const f = pool.find(p => p.label === 'korean');
    if (f && f.fontkit && f.fontkit.hasGlyphForCodePoint(codePoint)) return f;
  }

  // 22. Japanese Hiragana & Katakana (U+3040–U+309F, U+30A0–U+30FF, U+FF65–U+FF9F)
  if ((codePoint >= 0x3040 && codePoint <= 0x309F) ||
      (codePoint >= 0x30A0 && codePoint <= 0x30FF) ||
      (codePoint >= 0xFF65 && codePoint <= 0xFF9F)) {
    const f = pool.find(p => p.label === 'japanese');
    if (f && f.fontkit && f.fontkit.hasGlyphForCodePoint(codePoint)) return f;
  }

  // 23. CJK Ideographs (Hanzi / Kanji / Hanja)
  if ((codePoint >= 0x4E00 && codePoint <= 0x9FFF) ||
      (codePoint >= 0x3400 && codePoint <= 0x4DBF)) {
    const f = pool.find(p => (p.label === 'chinese' || p.label === 'japanese' || p.label === 'korean') && p.fontkit && p.fontkit.hasGlyphForCodePoint(codePoint));
    if (f) return f;
  }

  // 24. Cyrillic & Greek
  if ((codePoint >= 0x0400 && codePoint <= 0x052F) ||
      (codePoint >= 0x0370 && codePoint <= 0x03FF) ||
      (codePoint >= 0x1F00 && codePoint <= 0x1FFF)) {
    const f = pool.find(p => p.label === 'latin');
    if (f && f.fontkit && f.fontkit.hasGlyphForCodePoint(codePoint)) return f;
  }

  // 25. Latin / Western & common symbols
  if (codePoint <= 0x024F) {
    const f = pool.find(p => p.label === 'latin');
    if (f && f.fontkit && f.fontkit.hasGlyphForCodePoint(codePoint)) return f;
  }

  // 26. General search: any font having the glyph
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
 * Write plain text content to a PDF file with universal multi-font fallback.
 */
function textToPdf(text, outputPath) {
  return new Promise((resolve, reject) => {
    const doc = new PDFKit({ margin: 50, size: 'A4' });
    const out  = fs.createWriteStream(outputPath);
    doc.pipe(out);

    const pool = initFontPool();
    const rawLines = text.split(/\r?\n/);

    for (const rawLine of rawLines) {
      if (!rawLine.trim()) {
        doc.moveDown(0.5);
        continue;
      }

      const runs = segmentText(rawLine, pool);
      for (let i = 0; i < runs.length; i++) {
        const isLastInLine = (i === runs.length - 1);
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

        doc.fontSize(11).text(run.text, {
          lineGap: 4,
          continued: !isLastInLine,
        });
      }
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

module.exports = { textToPdf, htmlToPdf, initFontPool, getFontForChar, segmentText };
