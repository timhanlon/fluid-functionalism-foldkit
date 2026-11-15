import { createHighlighterCore } from 'shiki/core';
import { createOnigurumaEngine } from 'shiki/engine/oniguruma';
/** Same engine, grammar and dual themes as the reference; only TSX and the
 * two required themes are loaded into the browser. The instance is shared. */
let highlighter: ReturnType<typeof createHighlighterCore> | undefined;
function getHighlighter() {
  return (highlighter ??= createHighlighterCore({
    themes: [import('shiki/themes/github-light.mjs'), import('shiki/themes/github-dark.mjs')],
    langs: [import('shiki/langs/tsx.mjs')],
    engine: createOnigurumaEngine(import('shiki/wasm')),
  }));
}
export async function warm(): Promise<void> {
  await getHighlighter();
}
export async function highlight(source: string): Promise<string> {
  const h = await getHighlighter();
  return h.codeToHtml(source.trim(), {
    lang: 'tsx',
    themes: { dark: 'github-dark', light: 'github-light' },
    defaultColor: false,
  });
}
