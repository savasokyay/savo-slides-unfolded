// @ts-check
// WP-20: the renderers of the generated pages by kind (`cover`, `toc`, `references`, `evidence`, `colophon`, `closing`). A kind that is not here is drawn by the placeholder page
// (core/renderers.js) until its renderer is written: the cover (WP-14) first, then references, colophon, closing, contents and evidence. An entry is `{create(slide, ctx),
// problems?(deck, slide)}`: `problems` lists, at load, what the page cannot be drawn without (the data its model reads), so a deck that lacks it stops the page then, not on the first slide.
import { createCover, coverProblems } from './cover.js';
import { createToc, tocProblems } from './toc.js';
import { createColophon, colophonProblems } from './colophon.js';
import { createClosing, closingProblems } from './closing.js';

/** @type {Readonly<Record<string, Readonly<{create: (slide: import('../core/deck.js').Slide, ctx: import('../core/placeholder.js').RenderContext) => import('../core/placeholder.js').SlideRenderer, problems?: (deck: import('../core/deck.js').Deck) => string[]}>>>} */
export const PAGES = Object.freeze({
  cover: Object.freeze({ create: createCover, problems: coverProblems }),
  toc: Object.freeze({ create: createToc, problems: tocProblems }),                  // WP-15 (D-106)
  colophon: Object.freeze({ create: createColophon, problems: colophonProblems }),   // WP-18 (D-110)
  closing: Object.freeze({ create: createClosing, problems: closingProblems }),      // WP-19 (D-021, D-117)
});
