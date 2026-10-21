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
 * Locate a file entry inside a JSZip archive regardless of leading slashes,
 * leading './', URL percent-encoding, or casing differences.
 */
function findZipFile(zip, targetPath) {
  if (!targetPath) return null;

  // 1. Strip anchor/query fragments (e.g. href="chapter1.xhtml#sec1")
  let clean = targetPath.split('#')[0].split('?')[0];

  // 2. Normalize posix path and remove leading './' or '/'
  clean = path.posix.normalize(clean).replace(/^(\.\/|\/)+/, '');

  // Direct hit
  let entry = zip.file(clean);
  if (entry) return entry;

  // 3. Try URL-decoded path (e.g. %20 -> space)
  try {
    const decoded = decodeURIComponent(clean);
    entry = zip.file(decoded);
    if (entry) return entry;
  } catch (_) {}

  // 4. Case-insensitive match across zip entries
  const cleanLower = clean.toLowerCase();
  for (const name of Object.keys(zip.files)) {
    const normName = name.replace(/^(\.\/|\/)+/, '');
    if (normName.toLowerCase() === cleanLower && !zip.files[name].dir) {
      return zip.files[name];
    }
  }

  // 5. Basename fallback if path was slightly mismatched
  const baseTarget = path.posix.basename(clean).toLowerCase();
  const candidates = Object.keys(zip.files).filter(name => {
    return !zip.files[name].dir && path.posix.basename(name).toLowerCase() === baseTarget;
  });
  if (candidates.length === 1) {
    return zip.files[candidates[0]];
  }

  return null;
}

/**
 * Extract clean HTML body content from a full XHTML/HTML document.
 */
function extractBodyContent(html) {
  if (!html) return '';
  const match = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (match) return match[1];
  return html
    .replace(/<\?xml[^>]*\?>/gi, '')
    .replace(/<!DOCTYPE[^>]*>/gi, '')
    .replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '')
    .replace(/<\/?(html|body)[^>]*>/gi, '');
}

/**
 * Parse an EPUB file and return { metadata, chapters }
 * chapters = [{ title, html }]
 */
async function parseEpub(inputPath) {
  const data = fs.readFileSync(inputPath);
  const zip  = await JSZip.loadAsync(data);

  // 1. Find container.xml to locate OPF file
  const containerEntry = findZipFile(zip, 'META-INF/container.xml');
  if (!containerEntry) {
    throw new Error('Invalid EPUB: META-INF/container.xml not found.');
  }
  const containerXml = await containerEntry.async('string');
  const container    = await xml2js.parseStringPromise(containerXml);
  const rootfile     = container?.container?.rootfiles?.[0]?.rootfile?.[0];
  const opfPath      = rootfile?.$?.['full-path'];
  if (!opfPath) {
    throw new Error('Invalid EPUB: OPF rootfile path not found in container.xml.');
  }

  const cleanOpfPath = path.posix.normalize(opfPath).replace(/^(\.\/|\/)+/, '');
  const opfDir       = path.posix.dirname(cleanOpfPath);

  // 2. Parse OPF for metadata & spine
  const opfEntry = findZipFile(zip, cleanOpfPath);
  if (!opfEntry) {
    throw new Error(`Invalid EPUB: OPF file not found at "${opfPath}".`);
  }
  const opfXml  = await opfEntry.async('string');
  const opf     = await xml2js.parseStringPromise(opfXml);
  const pkg     = opf.package || {};

  // Metadata
  const dcMeta   = (pkg.metadata && pkg.metadata[0]) || {};
  const metadata = {
    title:       _first(dcMeta['dc:title']) || _first(dcMeta['title']) || 'Untitled',
    author:      _first(dcMeta['dc:creator']) || _first(dcMeta['creator']) || 'Unknown',
    language:    _first(dcMeta['dc:language']) || _first(dcMeta['language']) || 'en',
    publisher:   _first(dcMeta['dc:publisher']) || _first(dcMeta['publisher']) || '',
    description: _first(dcMeta['dc:description']) || _first(dcMeta['description']) || '',
  };

  // Build id → href manifest map
  const manifest = {};
  if (pkg.manifest && pkg.manifest[0] && pkg.manifest[0].item) {
    for (const item of pkg.manifest[0].item) {
      if (item && item.$ && item.$.id) {
        manifest[item.$.id] = {
          href:      item.$.href,
          mediaType: item.$['media-type'],
        };
      }
    }
  }

  // Spine order
  const spine = pkg.spine && pkg.spine[0];
  const spineItems = (spine && spine.itemref)
    ? spine.itemref.map(i => i?.$?.idref).filter(Boolean)
    : [];

  // 3. Extract chapter HTML in spine order
  const chapters = [];
  for (const idref of spineItems) {
    const manifestItem = manifest[idref];
    if (!manifestItem || !manifestItem.href) continue;

    const href = manifestItem.href;
    let fileEntry = null;

    if (opfDir && opfDir !== '.') {
      fileEntry = findZipFile(zip, path.posix.join(opfDir, href));
    }
    if (!fileEntry) {
      fileEntry = findZipFile(zip, href);
    }

    if (!fileEntry) {
      logger.warn(`Could not read spine item: ${href}`);
      continue;
    }

    try {
      const htmlContent = await fileEntry.async('string');
      chapters.push({ title: idref, html: htmlContent });
    } catch (e) {
      logger.warn(`Could not read spine item: ${href}`, { error: e.message });
    }
  }

  // Fallback: If no chapters extracted from spine, look for all HTML/XHTML items in manifest
  if (chapters.length === 0) {
    for (const [id, item] of Object.entries(manifest)) {
      if (!item.href) continue;
      const mt = (item.mediaType || '').toLowerCase();
      const h  = item.href.toLowerCase();
      if (mt.includes('html') || mt.includes('xhtml') || h.endsWith('.html') || h.endsWith('.xhtml') || h.endsWith('.htm')) {
        let fileEntry = null;
        if (opfDir && opfDir !== '.') {
          fileEntry = findZipFile(zip, path.posix.join(opfDir, item.href));
        }
        if (!fileEntry) {
          fileEntry = findZipFile(zip, item.href);
        }
        if (fileEntry) {
          try {
            const htmlContent = await fileEntry.async('string');
            chapters.push({ title: id, html: htmlContent });
          } catch (_) {}
        }
      }
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
  const body = chapters
    .map(ch => extractBodyContent(ch.html).trim())
    .filter(Boolean)
    .join('\n<hr/>\n');

  return `<!DOCTYPE html>
<html lang="${metadata.language}">
<head>
<meta charset="UTF-8"/>
<title>${_esc(metadata.title)}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans Ethiopic", "Kefa", "Nyala", "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic", "Meiryo", "Noto Sans CJK JP", "Noto Sans", Arial, sans-serif; line-height: 1.7; max-width: 800px; margin: 40px auto; padding: 0 20px; color: #222; }
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
    const cleanBody = extractBodyContent(ch.html);
    lines.push(htmlToText(cleanBody || ch.html, { wordwrap: 80 }));
    lines.push('\n' + '-'.repeat(40) + '\n');
  }
  return lines.join('\n');
}

module.exports = { parseEpub, epubToHtml, epubToText, chaptersToHtml };
