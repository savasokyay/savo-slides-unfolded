// @ts-check
// WP-12b / D-059, D-061, D-071: the top strip of a content slide. On the left the ESOGÜ emblem on its disc, in the middle the section label
// ("19.2 Supervised learning"), on the right the small gold S, and a thin rule underneath (engine/css/chrome.css). The cover and the closing
// page have their own pages (WP-14, WP-19) and no small S (D-071).
import { assertModel } from './model.js';
import { h } from './dom.js';

/**
 * WP-86 (D-161): the section label of the strip, one builder for the strip and for the OLD label that the section-start transition sends away (section-transition.js), so the two can never differ in
 * what they say or how they are marked up. `data-part="section-label"` is what the transition binds to (the label centres itself with its own `translate(-50%, -50%)`, chrome.css).
 * @param {Document} doc @param {import('./model.js').ChromeModel['section']} section @param {import('./model.js').ChromeModel['lang']} lang
 * @returns {HTMLElement}
 */
export function buildSectionLabel(doc, section, lang) {
  const label = h(doc, 'div', { class: 'savo-section', 'data-part': 'section-label', lang: section.lang && section.lang !== lang ? section.lang : undefined });
  if (section.number) label.appendChild(h(doc, 'span', { class: 'savo-num' }, section.number));
  label.appendChild(h(doc, 'span', { class: 'savo-sect-title' }, section.title));
  return label;
}

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
  bar.appendChild(buildSectionLabel(doc, model.section, model.lang));
  if (model.mark) bar.appendChild(h(doc, 'img', { class: 'savo-mark', src: model.mark.src, alt: model.mark.alt }));
  return bar;
}
