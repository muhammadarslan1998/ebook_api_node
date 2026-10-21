'use strict';
/**
 * HTML ↔ Text converters
 */
const { htmlToText } = require('html-to-text');
const { GOOGLE_FONTS_HTML_HEAD, UNIVERSAL_CSS_RULES } = require('./fontConfig');

/**
 * Convert HTML file content to plain text
 */
function htmlContentToText(htmlContent) {
  return htmlToText(htmlContent, {
    wordwrap: 90,
    selectors: [
      { selector: 'img', format: 'skip' },
      { selector: 'a',   options: { ignoreHref: true } },
    ],
  });
}

/**
 * Convert plain text to minimal HTML
 */
function textContentToHtml(text, title = 'Document') {
  const paragraphs = text
    .split(/\n{2,}/)
    .map(p => p.trim())
    .filter(Boolean)
    .map(p => `<p>${_esc(p.replace(/\n/g, ' '))}</p>`)
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>${_esc(title)}</title>
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

module.exports = { htmlContentToText, textContentToHtml };
