'use strict';

/**
 * Universal font configurations and CSS typography rules
 * ensuring consistent glyph rendering across all formats (PDF, EPUB, HTML, DOCX, MOBI, AZW3, etc.)
 * for all world languages (Thai, Chinese, Japanese, Korean, Amharic/Ethiopic, Arabic,
 * Hindi/Devanagari, Hebrew, Russian/Cyrillic, Greek, Latin).
 */

const UNIVERSAL_FONT_FAMILY = [
  '-apple-system',
  'BlinkMacSystemFont',
  '"Segoe UI"',
  'Roboto',
  '"Noto Sans"',
  '"Noto Sans Thai"',
  '"Thonburi"',
  '"Leelawadee UI"',
  '"DokChampa"',
  '"Noto Sans Ethiopic"',
  '"Nyala"',
  '"Kefa"',
  '"Abyssinica SIL"',
  '"Noto Sans Arabic"',
  '"Geeza Pro"',
  '"Traditional Arabic"',
  '"Noto Sans Devanagari"',
  '"Kohinoor Devanagari"',
  '"Mangal"',
  '"Noto Sans Hebrew"',
  '"Arial Hebrew"',
  '"David"',
  '"Hiragino Sans"',
  '"Hiragino Kaku Gothic ProN"',
  '"Yu Gothic"',
  '"Meiryo"',
  '"Noto Sans CJK SC"',
  '"Noto Sans SC"',
  '"PingFang SC"',
  '"Microsoft YaHei"',
  '"Noto Sans CJK TC"',
  '"Noto Sans TC"',
  '"PingFang TC"',
  '"Microsoft JhengHei"',
  '"Noto Sans CJK JP"',
  '"Noto Sans JP"',
  '"Noto Sans CJK KR"',
  '"Noto Sans KR"',
  '"Apple SD Gothic Neo"',
  '"Malgun Gothic"',
  'Arial',
  'sans-serif'
].join(', ');

const GOOGLE_FONTS_HTML_HEAD = `
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans:ital,wght@0,400;0,700;1,400&family=Noto+Sans+Arabic:wght@400;700&family=Noto+Sans+Devanagari:wght@400;700&family=Noto+Sans+Ethiopic:wght@400;700&family=Noto+Sans+Hebrew:wght@400;700&family=Noto+Sans+JP:wght@400;700&family=Noto+Sans+KR:wght@400;700&family=Noto+Sans+SC:wght@400;700&family=Noto+Sans+TC:wght@400;700&family=Noto+Sans+Thai:wght@400;700&display=swap" rel="stylesheet">
`.trim();

const UNIVERSAL_CSS_RULES = `
  body, p, div, span, h1, h2, h3, h4, h5, h6, li {
    font-family: ${UNIVERSAL_FONT_FAMILY};
    line-height: 1.7;
    color: #222;
  }
  body {
    max-width: 800px;
    margin: 40px auto;
    padding: 0 20px;
  }
  h1, h2, h3, h4, h5, h6 {
    color: #111;
    margin: 1em 0 0.5em;
  }
  p {
    margin: 0.8em 0;
  }
  pre, code {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  }
`.trim();

module.exports = {
  UNIVERSAL_FONT_FAMILY,
  GOOGLE_FONTS_HTML_HEAD,
  UNIVERSAL_CSS_RULES,
};
