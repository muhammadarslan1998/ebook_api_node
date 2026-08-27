'use strict';
/**
 * DOCX → various format converters
 * Uses mammoth for HTML/text extraction.
 */
const mammoth   = require('mammoth');
const { htmlToText } = require('html-to-text');

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
<title>Converted Document</title>
<style>
  body { font-family: Arial, sans-serif; line-height: 1.7; max-width: 800px; margin: 40px auto; padding: 0 20px; color: #222; }
  h1,h2,h3 { color: #111; }
  p { margin: 0.8em 0; }
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
