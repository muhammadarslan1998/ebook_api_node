'use strict';
/**
 * Text / HTML → PDF generator
 * Uses PDFKit for pure-JS PDF generation.
 */
const fs     = require('fs');
const PDFKit = require('pdfkit');
const { htmlToText } = require('html-to-text');

/**
 * Write plain text content to a PDF file at outputPath.
 */
function textToPdf(text, outputPath) {
  return new Promise((resolve, reject) => {
    const doc = new PDFKit({ margin: 60, size: 'A4' });
    const out  = fs.createWriteStream(outputPath);
    doc.pipe(out);

    doc.font('Helvetica')
       .fontSize(12)
       .text(text, { lineGap: 4, paragraphGap: 8 });

    doc.end();
    out.on('finish', resolve);
    out.on('error', reject);
  });
}

/**
 * Convert HTML content to PDF (strips HTML tags, renders as text).
 * For a full pixel-perfect render you'd need puppeteer — this is dependency-free.
 */
function htmlToPdf(htmlContent, outputPath) {
  const plainText = htmlToText(htmlContent, {
    wordwrap: 90,
    selectors: [
      { selector: 'h1', options: { uppercase: true } },
      { selector: 'h2', options: { uppercase: true } },
      { selector: 'img', format: 'skip' },
    ],
  });
  return textToPdf(plainText, outputPath);
}

module.exports = { textToPdf, htmlToPdf };
