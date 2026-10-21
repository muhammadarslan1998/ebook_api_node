'use strict';
/**
 * DOCX → various format converters
 * Uses mammoth for HTML/text extraction.
 */
const mammoth   = require('mammoth');
const { htmlToText } = require('html-to-text');
const { GOOGLE_FONTS_HTML_HEAD, UNIVERSAL_CSS_RULES } = require('./fontConfig');

/**
 * Extract raw HTML from DOCX
 */
async function docxToHtml(inputPath) {
  const result = await mammoth.convertToHtml({ path: inputPath });
  const bodyHtml = result.value;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Converted Document</title>
${GOOGLE_FONTS_HTML_HEAD}
<style>
${UNIVERSAL_CSS_RULES}
</style>
</head>
<body>
${bodyHtml}
</body>
</html>`;
}

/**
 * Extract plain text from DOCX
 */
async function docxToText(inputPath) {
  const result = await mammoth.extractRawText({ path: inputPath });
  return result.value;
}

/**
 * Convert DOCX → structured data for further EPUB generation
 */
async function docxToEpubContent(inputPath) {
  const result = await mammoth.convertToHtml({ path: inputPath });
  return {
    metadata: { title: 'Converted Document', author: 'Unknown', language: 'en' },
    chapters: [{ title: 'Chapter 1', html: result.value }],
  };
}

module.exports = { docxToHtml, docxToText, docxToEpubContent };
