// @ts-check
// WP-19 / D-021, D-061, D-064, D-117, D-121, D-125: the closing page as one element, a pure function (document, model) -> Element, like the cover (cover.js). On the navy card (card.js) with the faint
// network: the gold S big in the middle (the savo mark, the same image the top strip and the cover use), and the identity at the bottom, one line under the other: the name (gold) and the e-mail address
// as a mailto link (D-125: the one exception to D-088's https-only rule; an address that is not a plain one stays text). The institution lines are gone (D-125; the cover has them). No "Thank you": this
// is a lecture deck (D-061, D-117). No page number and no progress (D-118). The page is STILL (D-121): the assembly of the S from its pieces, the sheen and the 3-D bevel of the old closing slide are left
// for later. The renderer (engine/pages/closing.js) finds the parts by `data-part` (mark, identity, name, mail). Every colour is the stylesheet's (engine/css/pages.css, tokens only); the S is the asset's
// own picture. The only listener is the link's: after a click it gives the keyboard focus back (chrome/mailto.js), so the next Space is "next" again.
// The model: closing-model.js. Layout: engine/css/pages.css (shares the card and the network with cover.css).
import { assertClosingModel } from './closing-model.js';
import { buildCard } from './card.js';
import { CLOSING_CLEAR } from './net.js';
import { h } from './dom.js';
import { releaseFocusAfterClick } from './mailto.js';

/**
 * @param {Document} doc
 * @param {import('./closing-model.js').ClosingModel} model
 * @returns {HTMLElement}  `div.savo-card.savo-closing`, to be appended to the 1920 x 1080 stage (`.savo-stage`)
 */
export function buildClosing(doc, model) {
  assertClosingModel(model);
  const { root, body } = buildCard(doc, {
    part: 'closing', variant: model.variant, band: false,
    net: { seed: model.net.seed, nodes: model.net.nodes, clear: CLOSING_CLEAR },
    watermark: null,
  });
  root.setAttribute('class', 'savo-card savo-closing');
  const mark = h(doc, 'img', { class: 'savo-closing-mark', 'data-part': 'mark', src: model.mark.src, alt: model.mark.alt });
  const id = h(doc, 'div', { class: 'savo-closing-id', 'data-part': 'identity' });
  const mail = h(doc, 'p', { class: 'savo-closing-mail', 'data-part': 'mail' });
  if (model.author.mailHref) {
    const link = h(doc, 'a', { class: 'savo-closing-link', href: model.author.mailHref }, model.author.mail);
    releaseFocusAfterClick(link);
    mail.appendChild(link);
  } else mail.textContent = model.author.mail;
  id.append(h(doc, 'p', { class: 'savo-closing-name', 'data-part': 'name' }, model.author.name), mail);
  body.append(mark, id);
  return root;
}
