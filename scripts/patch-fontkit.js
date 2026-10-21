'use strict';
/**
 * Automatically patch FontKit to safely handle null GPOS anchors
 * in complex script fonts (such as Malayalam, Bengali, Tamil, etc.).
 */
const fs   = require('fs');
const path = require('path');

const fontkitPath = path.join(__dirname, '..', 'node_modules', 'fontkit', 'dist', 'main.cjs');

if (fs.existsSync(fontkitPath)) {
  let content = fs.readFileSync(fontkitPath, 'utf8');

  let modified = false;

  // Patch getAnchor
  if (!content.includes('if (!anchor) return { x: 0, y: 0 };')) {
    content = content.replace(
      'getAnchor(anchor) {',
      'getAnchor(anchor) {\n        if (!anchor) return { x: 0, y: 0 };'
    );
    modified = true;
  }

  // Patch applyAnchor
  if (!content.includes('if (!markRecord || !baseAnchor) return;')) {
    content = content.replace(
      'applyAnchor(markRecord, baseAnchor, baseGlyphIndex) {',
      'applyAnchor(markRecord, baseAnchor, baseGlyphIndex) {\n        if (!markRecord || !baseAnchor) return;'
    );
    modified = true;
  }

  if (modified) {
    fs.writeFileSync(fontkitPath, content, 'utf8');
    console.log('Successfully patched FontKit GPOS anchor handling.');
  } else {
    console.log('FontKit already patched.');
  }
}
