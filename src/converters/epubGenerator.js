'use strict';
/**
 * EPUB generator — creates a valid EPUB 3 file from chapter content.
 * Uses epub-gen-memory (pure-JS, no Calibre dependency).
 *
 * Key settings to prevent "Only absolute URLs are supported" errors:
 *  - fonts: []                  → no external font downloads
 *  - css: '<inline>'            → no external CSS fetch
 *  - ignoreFailedDownloads: true → silently skip any image download failures
 *  - Content is sanitised to remove <img> tags with non-http srcs
 */
const fs       = require('fs');
const { EPub } = require('epub-gen-memory');

/**
 * Strip <img> tags whose src is not an absolute http(s) URL,
 * and strip any <link> / <script> tags that point to external resources.
 */
function sanitiseHtml(html) {
  return html
    // Remove <img> with relative/empty/data src (keep only absolute http URLs)
    .replace(/<img[^>]*>/gi, (tag) => {
      const srcMatch = tag.match(/src=["']([^"']*)/i);
      if (!srcMatch) return '';
      const src = srcMatch[1];
      if (/^https?:\/\//i.test(src)) return tag; // absolute URL — keep
      return ''; // relative/data/empty — remove
    })
    // Remove <link rel="stylesheet"> tags
    .replace(/<link[^>]*>/gi, '')
    // Remove <script> tags
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    // Remove <style> blocks (we provide our own CSS)
    .replace(/<style[\s\S]*?<\/style>/gi, '');
}

/**
 * Generate an EPUB file.
 * @param {object} opts
 * @param {string} opts.title
 * @param {string} opts.author
 * @param {string} opts.lang
 * @param {Array<{title:string, content:string}>} opts.chapters  - HTML content
 * @param {string} outputPath  - where to write the .epub
 */
async function generateEpub(opts, outputPath) {
  const { title = 'Untitled', author = 'Unknown', lang = 'en', chapters = [] } = opts;

  const epubOptions = {
    title,
    author,
    lang,
    fonts: [],                  // no external font downloads
    ignoreFailedDownloads: true, // silently skip any image that fails to download
    css: `
      body  { font-family: Georgia, serif; line-height: 1.7; margin: 1em 2em; color: #222; }
      h1, h2, h3 { color: #111; margin: 1em 0 0.5em; }
      p    { margin: 0.8em 0; }
      pre  { background: #f4f4f4; padding: 0.5em; white-space: pre-wrap; }
      code { font-family: monospace; }
    `,
  };

  const epubChapters = chapters.map((ch, i) => ({
    title:   ch.title || `Chapter ${i + 1}`,
    // sanitise: remove relative <img> and external resources that would trigger network fetches
    content: sanitiseHtml(ch.content || ch.html || '<p>Empty chapter</p>'),
  }));

  const epubBuffer = await new EPub(epubOptions, epubChapters).genEpub();
  fs.writeFileSync(outputPath, epubBuffer);
}

/**
 * Convert plain text to EPUB
 */
async function textToEpub(text, outputPath, meta = {}) {
  // Split into sections on 4+ blank lines or form-feeds
  const rawSections = text.split(/\f|\n{4,}/).map(s => s.trim()).filter(s => s.length > 0);

  const chapters = rawSections.length > 0
    ? rawSections.map((section, i) => ({
        title:   `Section ${i + 1}`,
        content: '<p>' + section.replace(/\n{2,}/g, '</p><p>').replace(/\n/g, '<br/>') + '</p>',
      }))
    : [{
        title:   'Content',
        content: '<p>' + text.replace(/\n{2,}/g, '</p><p>').replace(/\n/g, '<br/>') + '</p>',
      }];

  await generateEpub(
    { title: meta.title || 'Converted', author: meta.author || 'Unknown', lang: 'en', chapters },
    outputPath
  );
}

/**
 * Convert HTML to EPUB
 */
async function htmlToEpub(htmlContent, outputPath, meta = {}) {
  await generateEpub({
    title:    meta.title  || 'Converted Document',
    author:   meta.author || 'Unknown',
    lang:     'en',
    chapters: [{ title: 'Content', content: htmlContent }],
  }, outputPath);
}

module.exports = { generateEpub, textToEpub, htmlToEpub };
