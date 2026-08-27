'use strict';
/**
 * EPUB → other format converters
 * Parses EPUB (ZIP archive) and extracts spine content + metadata.
 */
const fs   = require('fs');
const path = require('path');
const JSZip = require('jszip');
const xml2js = require('xml2js');
const { htmlToText } = require('html-to-text');
const logger = require('../logger');

/**
 * Parse an EPUB file and return { metadata, chapters }
 * chapters = [{ title, html }]
 */
async function parseEpub(inputPath) {
  const data = fs.readFileSync(inputPath);
  const zip  = await JSZip.loadAsync(data);

  // 1. Find container.xml to locate OPF file
  const containerXml = await zip.file('META-INF/container.xml').async('string');
  const container    = await xml2js.parseStringPromise(containerXml);
  const opfPath      = container.container.rootfiles[0].rootfile[0].$['full-path'];
  const opfDir       = path.dirname(opfPath);

  // 2. Parse OPF for metadata & spine
  const opfXml  = await zip.file(opfPath).async('string');
  const opf     = await xml2js.parseStringPromise(opfXml);
  const pkg     = opf.package;

  // Metadata
  const dcMeta  = pkg.metadata[0];
  const metadata = {
    title:    _first(dcMeta['dc:title'])   || 'Untitled',
    author:   _first(dcMeta['dc:creator']) || 'Unknown',
    language: _first(dcMeta['dc:language'])|| 'en',
    publisher:_first(dcMeta['dc:publisher'])|| '',
    description: _first(dcMeta['dc:description']) || '',
  };

  // Build id → href manifest map
  const manifest = {};
  for (const item of pkg.manifest[0].item) {
    manifest[item.$.id] = {
      href:      item.$.href,
      mediaType: item.$['media-type'],
    };
  }

  // Spine order
  const spineItems = pkg.spine[0].itemref.map(i => i.$.idref);

  // 3. Extract chapter HTML in spine order
  const chapters = [];
  for (const idref of spineItems) {
    const manifestItem = manifest[idref];
    if (!manifestItem) continue;
    const href = manifestItem.href;
    const filePath = opfDir ? `${opfDir}/${href}` : href;
    try {
      const htmlContent = await zip.file(filePath).async('string');
      chapters.push({ title: idref, html: htmlContent });
    } catch (e) {
      logger.warn(`Could not read spine item: ${filePath}`, { error: e.message });
    }
  }

  return { metadata, chapters };
}

function _first(arr) {
  if (!arr || !arr.length) return '';
  const v = arr[0];
  return typeof v === 'string' ? v : (v._ || '');
}

/**
 * Combine all chapter HTML into a single HTML document
 */
function chaptersToHtml(metadata, chapters) {
  const body = chapters.map(ch => ch.html).join('\n<hr/>\n');
  return `<!DOCTYPE html>
<html lang="${metadata.language}">
<head>
<meta charset="UTF-8"/>
<title>${_esc(metadata.title)}</title>
<style>
  body { font-family: Georgia, serif; line-height: 1.7; max-width: 800px; margin: 40px auto; padding: 0 20px; color: #222; }
  h1,h2,h3 { color: #111; }
  p { margin: 0.8em 0; }
</style>
</head>
<body>
<h1>${_esc(metadata.title)}</h1>
<p><em>by ${_esc(metadata.author)}</em></p>
<hr/>
${body}
</body>
</html>`;
}

function _esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

/**
 * Convert EPUB → HTML string
 */
async function epubToHtml(inputPath) {
  const { metadata, chapters } = await parseEpub(inputPath);
  return chaptersToHtml(metadata, chapters);
}

/**
 * Convert EPUB → plain text
 */
async function epubToText(inputPath) {
  const { metadata, chapters } = await parseEpub(inputPath);
  const lines = [
    `Title: ${metadata.title}`,
    `Author: ${metadata.author}`,
    `Language: ${metadata.language}`,
    '',
    '='.repeat(60),
    '',
  ];
  for (const ch of chapters) {
    lines.push(htmlToText(ch.html, { wordwrap: 80 }));
    lines.push('\n' + '-'.repeat(40) + '\n');
  }
  return lines.join('\n');
}

module.exports = { parseEpub, epubToHtml, epubToText, chaptersToHtml };
