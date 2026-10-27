// @ts-check
// WP-12b / D-059, D-061, D-071: the top strip of a content slide. On the left the ESOGÜ emblem on its disc, in the middle the section label
// ("19.2 Supervised learning"), on the right the small gold S, and a thin rule underneath (engine/css/chrome.css). The cover and the closing
// page have their own pages (WP-14, WP-19) and no small S (D-071).
import { assertModel } from './model.js';
import { h } from './dom.js';

/**
 * @param {Document} doc
 * @param {import('./model.js').ChromeModel} model
 * @returns {HTMLElement}
 */
export function buildTopbar(doc, model) {
  assertModel(model);
  const bar = h(doc, 'header', { class: 'savo-topbar' });
  if (model.emblem) {
    const disc = h(doc, 'span', { class: 'savo-emblem' });
    disc.appendChild(h(doc, 'img', { src: model.emblem.src, alt: model.emblem.alt }));
    bar.appendChild(disc);
  }
  const label = h(doc, 'div', { class: 'savo-section', lang: model.section.lang && model.section.lang !== model.lang ? model.section.lang : undefined });
  if (model.section.number) label.appendChild(h(doc, 'span', { class: 'savo-num' }, model.section.number));
  label.appendChild(h(doc, 'span', { class: 'savo-sect-title' }, model.section.title));
  bar.appendChild(label);
  if (model.mark) bar.appendChild(h(doc, 'img', { class: 'savo-mark', src: model.mark.src, alt: model.mark.alt }));
  return bar;
}
