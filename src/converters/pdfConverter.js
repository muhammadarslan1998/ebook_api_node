'use strict';
/**
 * PDF → other format converters
 * Uses pdf-parse for text extraction.
 */
const fs       = require('fs');
const pdfParse = require('pdf-parse');
const { htmlToText } = require('html-to-text');
const { GOOGLE_FONTS_HTML_HEAD, UNIVERSAL_CSS_RULES } = require('./fontConfig');

/**
 * Extract plain text from a PDF file
 */
async function pdfToText(inputPath) {
  const dataBuffer = fs.readFileSync(inputPath);
  const data = await pdfParse(dataBuffer);
  return data.text;
}

/**
 * Convert PDF → HTML  (best-effort, text only — no graphics/layout)
 */
async function pdfToHtml(inputPath) {
  const text = await pdfToText(inputPath);
  // Preserve paragraph breaks by splitting on blank lines
  const paragraphs = text
    .split(/\n{2,}/)
    .map(p => p.replace(/\n/g, ' ').trim())
    .filter(Boolean)
    .map(p => `<p>${_esc(p)}</p>`)
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Converted from PDF</title>
${GOOGLE_FONTS_HTML_HEAD}
<style>
${UNIVERSAL_CSS_RULES}
</style>
</head>
<body>
${paragraphs}
</body>
</html>`;
}

function _esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

module.exports = { pdfToText, pdfToHtml };
