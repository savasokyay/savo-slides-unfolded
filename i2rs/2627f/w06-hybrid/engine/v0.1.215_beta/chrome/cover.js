// @ts-check
// WP-14 / D-061, D-063 to D-066, D-071: the cover as one element, a pure function (document, model) -> Element. On the navy card (card.js): the faint network
// and the faint S; the emblem with the three institution lines at the top left (the content slides' position); the course, the topic, the title and the
// subtitle centred between the emblem and the information band; in the band the e-mail QR with the author on the left and the deck QR with its address on
// the right (drawn inline from its module path: the dark modules are the information band's colour, D-078); a one-line stamp of the build at the bottom. No page number, no progress (plan section 12, 20:14), no small S (D-071). The card is still: the
// cover transition of D-020 belongs to the player and finds its pieces by `data-part` (kicker, title, subtitle, course, band, qr-mail, qr-deck, net, mark).
// Layout: engine/css/cover.css (shares .savo-emblem with chrome.css). The model: cover-model.js.
import { assertCoverModel } from './cover-model.js';
import { buildCard } from './card.js';
import { COVER_CLEAR } from './net.js';
import { buildQrSvg } from './qr.js';
import { h } from './dom.js';

/** Each line of a multi-line text as its own block, so no markup (`<br>`) is needed. @param {Document} doc @param {string} cls @param {string[]} lines */
function lines(doc, cls, lines) {
  const box = h(doc, 'div', { class: cls });
  for (const line of lines) box.appendChild(h(doc, 'span', { class: 'savo-line' }, line));
  return box;
}

/**
 * @param {Document} doc
 * @param {import('./cover-model.js').CoverModel} model
 * @returns {HTMLElement}  `div.savo-card.savo-cover`, to be appended to the 1920 x 1080 stage (`.savo-stage`)
 */
export function buildCover(doc, model) {
  assertCoverModel(model);
  const { root, body } = buildCard(doc, {
    part: 'cover', variant: model.variant, band: true,
    net: { seed: model.net.seed, nodes: model.net.nodes, clear: COVER_CLEAR },
    watermark: model.watermark === 'none' ? null : { src: model.mark.src, pos: model.watermark },
  });
  root.setAttribute('class', 'savo-card savo-cover');

  // top left: the emblem on its white disc, the institution beside it
  const bar = h(doc, 'header', { class: 'savo-cover-bar' });
  const lockup = h(doc, 'div', { class: 'savo-cover-lockup' });
  const disc = h(doc, 'span', { class: 'savo-emblem', 'data-part': 'emblem' });
  disc.appendChild(h(doc, 'img', { src: model.emblem.src, alt: model.emblem.alt }));
  lockup.append(disc, lines(doc, 'savo-institution', model.institution));
  bar.appendChild(lockup);

  // the middle block, centred between the emblem and the band
  const mid = h(doc, 'div', { class: 'savo-cover-mid' });
  const course = h(doc, 'div', { class: 'savo-cover-course', 'data-part': 'course' });
  if (model.course.code) course.appendChild(h(doc, 'span', { class: 'savo-cover-code' }, model.course.code));
  course.appendChild(h(doc, 'span', { class: 'savo-cover-course-name' }, model.course.name));
  const titles = h(doc, 'div', { class: 'savo-cover-titles' });
  const big = model.topic === null;     // without a topic the title takes the big top slot (lead decision, 21:37) and the subtitle the title's slot
  if (!big) titles.appendChild(h(doc, 'p', { class: 'savo-cover-topic', 'data-part': 'kicker' }, /** @type {string} */ (model.topic)));
  const title = h(doc, 'h1', { class: 'savo-cover-title', 'data-part': 'title', 'data-slot': big ? 'big' : 'title' });
  title.appendChild(h(doc, 'span', { class: 'savo-cover-title-text' }, model.title));
  if (model.subtitle !== null && !big) title.appendChild(h(doc, 'small', { class: 'savo-cover-subtitle', 'data-part': 'subtitle' }, model.subtitle));
  titles.appendChild(title);
  if (model.subtitle !== null && big) titles.appendChild(h(doc, 'p', { class: 'savo-cover-subline', 'data-part': 'subtitle' }, model.subtitle));
  mid.append(course, titles);

  // the band: e-mail QR with the author on the left, deck QR with the address on the right (D-061, D-065)
  const mail = h(doc, 'div', { class: 'savo-qr-group savo-qr-mail', 'data-part': 'qr-mail' });
  const mailTile = h(doc, 'div', { class: 'savo-qr-tile' });
  mailTile.appendChild(h(doc, 'img', { src: model.qr.mail.src, alt: model.qr.mail.alt }));
  const who = h(doc, 'div', { class: 'savo-qr-text' });
  who.append(h(doc, 'div', { class: 'savo-who' }, model.author.name), h(doc, 'div', { class: 'savo-mail' }, model.author.mail));
  mail.append(mailTile, who);

  const stamp = h(doc, 'div', { class: 'savo-stamp', lang: 'en', 'data-part': 'stamp' }, `engine ${model.stamp.engine}, content ${model.stamp.content}, built ${model.stamp.built}`);

  body.append(bar, mid, mail);
  if (model.qr.deck && model.address) {
    const deck = h(doc, 'div', { class: 'savo-qr-group savo-qr-deck', 'data-part': 'qr-deck' });
    const deckTile = h(doc, 'div', { class: 'savo-qr-tile' });
    deckTile.appendChild(buildQrSvg(doc, { modules: model.qr.deck.modules, alt: model.qr.deck.alt, mark: model.mark.src }));   // inline, so the modules can wear the band's colour (D-078)
    deck.append(deckTile, lines(doc, 'savo-url', model.address));
    body.appendChild(deck);
  }
  body.appendChild(stamp);
  return root;
}
