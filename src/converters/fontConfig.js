'use strict';

/**
 * Universal font configurations and CSS typography rules
 * covering ALL human writing systems (Tamil, Malayalam, Telugu, Kannada, Bengali,
 * Gujarati, Gurmukhi/Punjabi, Odia, Sinhala, Myanmar/Burmese, Khmer, Lao, Tibetan,
 * Georgian, Armenian, Thai, Ethiopic/Amharic, Arabic/Persian/Urdu, Devanagari/Hindi,
 * Hebrew, Chinese, Japanese, Korean, Cyrillic, Greek, Latin, etc.)
 */

const UNIVERSAL_FONT_FAMILY = [
  '-apple-system',
  'BlinkMacSystemFont',
  '"Segoe UI"',
  'Roboto',
  '"Noto Sans"',
  '"Noto Sans Tamil"',
  '"Tamil Sangam MN"',
  '"Tamil MN"',
  '"Noto Sans Malayalam"',
  '"Malayalam Sangam MN"',
  '"Malayalam MN"',
  '"Noto Sans Telugu"',
  '"Telugu Sangam MN"',
  '"Noto Sans Kannada"',
  '"Kannada Sangam MN"',
  '"Noto Sans Bengali"',
  '"Bangla Sangam MN"',
  '"Noto Sans Gujarati"',
  '"Gujarati Sangam MN"',
  '"Noto Sans Gurmukhi"',
  '"Gurmukhi Sangam MN"',
  '"Noto Sans Oriya"',
  '"Oriya Sangam MN"',
  '"Noto Sans Sinhala"',
  '"Sinhala Sangam MN"',
  '"Noto Sans Myanmar"',
  '"Myanmar Sangam MN"',
  '"Noto Sans Khmer"',
  '"Khmer Sangam MN"',
  '"Noto Sans Lao"',
  '"Lao Sangam MN"',
  '"Noto Serif Tibetan"',
  '"Kailasa"',
  '"Noto Sans Georgian"',
  '"Noto Sans Armenian"',
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
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans:ital,wght@0,400;0,700;1,400&family=Noto+Sans+Arabic:wght@400;700&family=Noto+Sans+Armenian:wght@400;700&family=Noto+Sans+Bengali:wght@400;700&family=Noto+Sans+Devanagari:wght@400;700&family=Noto+Sans+Ethiopic:wght@400;700&family=Noto+Sans+Georgian:wght@400;700&family=Noto+Sans+Gujarati:wght@400;700&family=Noto+Sans+Gurmukhi:wght@400;700&family=Noto+Sans+Hebrew:wght@400;700&family=Noto+Sans+JP:wght@400;700&family=Noto+Sans+KR:wght@400;700&family=Noto+Sans+Kannada:wght@400;700&family=Noto+Sans+Khmer:wght@400;700&family=Noto+Sans+Lao:wght@400;700&family=Noto+Sans+Malayalam:wght@400;700&family=Noto+Sans+Myanmar:wght@400;700&family=Noto+Sans+SC:wght@400;700&family=Noto+Sans+Sinhala:wght@400;700&family=Noto+Sans+TC:wght@400;700&family=Noto+Sans+Tamil:wght@400;700&family=Noto+Sans+Telugu:wght@400;700&family=Noto+Sans+Thai:wght@400;700&family=Noto+Serif+Tibetan:wght@400;700&display=swap" rel="stylesheet">
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
