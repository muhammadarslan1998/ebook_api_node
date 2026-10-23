export const INPUT_FORMATS = ['epub','mobi','pdf','txt','azw3','lrf','fb2','tcr','rtf','pdb'];
export const EPUB_OUTPUT_FORMATS = ['azw3','lrf','mobi','oeb','pdb','pdf','rtf','txt'];
export const NON_EPUB_OUTPUT_FORMATS = ['azw3','lrf','epub','mobi','oeb','pdb','pdf','rtf','txt'];
export function outputsFor(input) { return input === 'epub' ? EPUB_OUTPUT_FORMATS : NON_EPUB_OUTPUT_FORMATS; }
export function isAllowed(input, output) { return INPUT_FORMATS.includes(input) && outputsFor(input).includes(output); }
