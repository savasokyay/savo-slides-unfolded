// @ts-check
// WP-12b / D-061, D-069: the footer, one line on the bottom edge. Left: the source (deck.yaml chrome.source: the book and chapter, a course or a
// conference). Right: the progress block, then the page number (none on the contents page: `model.page` is null there, D-118), all on the same bottom line. Alignment is a CSS rule (engine/css/chrome.css:
// the source and the page number share their last baseline, the progress block is centred on the number's ink), so it holds for any
// font that is loaded; tests and the visible-tab run measure it.
import { assertModel } from './model.js';
import { buildProgress } from './progress.js';
import { pageParts } from './layout.js';
import { createT } from './strings.js';
import { h } from './dom.js';

/**
 * @param {Document} doc
 * @param {import('./model.js').ChromeModel} model
 * @returns {HTMLElement}
 */
export function buildFooter(doc, model) {
  assertModel(model);
  const t = createT(model.lang);
  const foot = h(doc, 'footer', { class: 'savo-foot' });
  // D-072: a thin rule above the whole footer band, the same line as the one under the top strip (engine/css/chrome.css). Decorative.
  foot.appendChild(h(doc, 'div', { class: 'savo-foot-rule', 'aria-hidden': 'true' }));
  if (model.source) {
    foot.appendChild(h(doc, 'div', { class: 'savo-src', lang: model.source.lang && model.source.lang !== model.lang ? model.source.lang : undefined }, model.source.text));
  }
  if (model.progress.variant !== 'none') foot.appendChild(buildProgress(doc, model));
  if (model.page) {                                                                    // D-118, D-122: the contents page and the colophon have the footer without the number group
    const parts = pageParts(model.page);
    const page = h(doc, 'div', { class: 'savo-pageno', role: 'img', 'aria-label': t('page.label', { index: model.page.index, total: model.page.total }) });
    page.appendChild(h(doc, 'b', {}, parts.current));
    page.appendChild(h(doc, 'span', {}, parts.total));
    foot.appendChild(page);
  }
  return foot;
}
