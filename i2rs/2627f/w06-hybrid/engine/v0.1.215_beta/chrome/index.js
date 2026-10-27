// @ts-check
// WP-12b: the chrome of a content slide as one element: the top strip, the footer and, when the deck asks for it, a watermark. A pure
// function (document, model) -> Element: no global state, no timer, no animation. The caller (the player, WP-12c) puts the element
// into the stage and replaces it when the model changes; nothing here knows the deck, the router or the player.
// Layout: engine/css/chrome.css. Tokens: docs/design-brief.md section 4, written into the page by the build (WP-12a).
import { assertModel } from './model.js';
import { buildTopbar } from './topbar.js';
import { buildFooter } from './footer.js';
import { h } from './dom.js';

export { validateModel, assertModel, ChromeModelError } from './model.js';
export { buildTopbar } from './topbar.js';
export { buildFooter } from './footer.js';
export { buildProgress } from './progress.js';
export { buildStudentControls, buildTouchHint } from './controls.js';
export { progressLayout, drawnExtent, pageParts, PROGRESS, STAGE } from './layout.js';
export { STRINGS, createT } from './strings.js';
// WP-14: the cover; WP-19: the closing page shares card.js and net.js
export { buildCover } from './cover.js';
export { coverModel, validateCoverModel, assertCoverModel, CoverModelError } from './cover-model.js';
export { buildClosing } from './closing.js';
export { closingModel, validateClosingModel, assertClosingModel, ClosingModelError } from './closing-model.js';
export { buildCard, buildNet } from './card.js';
export { NET, COVER_CLEAR, CLOSING_CLEAR, mulberry32, nearestEdges, netGeometry } from './net.js';

/**
 * @param {Document} doc
 * @param {import('./model.js').ChromeModel} model
 * @returns {HTMLElement}  `div.savo-chrome`, to be appended to the 1920 x 1080 stage (`.savo-stage`)
 */
export function buildChrome(doc, model) {
  assertModel(model);
  const root = h(doc, 'div', { class: 'savo-chrome', 'data-savo-part': 'chrome' });
  // the watermark is a config option (chrome.watermark); `auto` and `none` draw nothing on a content slide (D-061)
  if ((model.watermark === 'center' || model.watermark === 'corner') && model.mark) {
    root.appendChild(h(doc, 'img', { class: 'savo-watermark', 'data-pos': model.watermark, src: model.mark.src, alt: '', 'aria-hidden': 'true' }));
  }
  root.appendChild(buildTopbar(doc, model));
  root.appendChild(buildFooter(doc, model));
  return root;
}
