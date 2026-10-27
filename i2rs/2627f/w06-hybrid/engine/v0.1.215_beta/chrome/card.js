// @ts-check
// WP-14 / plan section 12 (2026-10-22 21:16): the navy card the cover and (WP-19) the closing page are drawn on. The card is a box of its own with
// the PAGE theme's `card` colour behind it; the dark token set is switched on by a wrapper INSIDE the card (`[data-surface="dark"]`), never by the card
// itself, so the card's ground follows the page theme while the text, the network and the QR text use the dark set in both themes.
// The wrapper has no box of its own (display: contents, engine/css/cover.css): the information band, which belongs to the card and so to the page theme,
// sits between the network and the text by z-index. Pure builders (document, spec) -> elements, no global state, no animation, textContent only.
import { h, s, num } from './dom.js';
import { NET, netGeometry } from './net.js';

/**
 * The network as an SVG on the 1920 x 1080 stage. Colours are CSS (engine/css/cover.css), coordinates are rounded to whole pixels as in the prototype.
 * @param {Document} doc
 * @param {{seed: number, nodes: number, clear?: ReadonlyArray<readonly [number, number, number, number]>}} spec
 * @returns {SVGElement}
 */
export function buildNet(doc, spec) {
  const { points, edges } = netGeometry(spec);
  const svg = s(doc, 'svg', { class: 'savo-net', 'data-part': 'net', viewBox: `0 0 ${NET.width} ${NET.height}`, 'aria-hidden': 'true' });
  const lines = s(doc, 'g', { class: 'savo-net-lines' });
  for (const [i, j] of edges) {
    lines.appendChild(s(doc, 'line', { x1: Math.round(points[i][0]), y1: Math.round(points[i][1]), x2: Math.round(points[j][0]), y2: Math.round(points[j][1]) }));
  }
  const dots = s(doc, 'g', { class: 'savo-net-dots' });
  for (const [x, y] of points) dots.appendChild(s(doc, 'circle', { cx: Math.round(x), cy: Math.round(y), r: num(NET.dotRadius) }));
  svg.append(lines, dots);
  return svg;
}

/**
 * The card: `div.savo-card` > [`div.savo-band` when asked] + `div[data-surface="dark"].savo-card-body` (the network and the faint S first; the caller appends the
 * page's own elements to `body`).
 * @param {Document} doc
 * @param {{part: string, variant: string, net: {seed: number, nodes: number, clear?: ReadonlyArray<readonly [number, number, number, number]>},
 *          watermark: {src: string, pos: string}|null, band: boolean}} spec
 * @returns {{root: HTMLElement, body: HTMLElement}}
 */
export function buildCard(doc, spec) {
  const root = h(doc, 'div', { class: 'savo-card', 'data-savo-part': spec.part, 'data-variant': spec.variant });
  if (spec.band) root.appendChild(h(doc, 'div', { class: 'savo-band', 'data-part': 'band', 'aria-hidden': 'true' }));
  const body = h(doc, 'div', { class: 'savo-card-body', 'data-surface': 'dark' });
  body.appendChild(buildNet(doc, spec.net));
  if (spec.watermark) body.appendChild(h(doc, 'img', { class: 'savo-watermark', 'data-part': 'mark', 'data-pos': spec.watermark.pos, src: spec.watermark.src, alt: '', 'aria-hidden': 'true' }));
  root.appendChild(body);
  return { root, body };
}
