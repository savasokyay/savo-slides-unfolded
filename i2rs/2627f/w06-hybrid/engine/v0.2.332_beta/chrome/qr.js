// @ts-check
// WP-14 / D-065, D-066, D-078: the deck QR of the cover, drawn INLINE. The dark modules take the information band's colour (D-078, user, 2026-10-22 21:57: light page #1A2363, dark page
// #111843), so they must read the page theme's CSS variable, and an SVG inside an <img> cannot see one. The build (segno) therefore hands over the module PATH, not a finished
// picture: `{n, quiet, d, cut}`, and this builder draws it with elements (attributes only, no markup is parsed). The colours are CSS (engine/css/cover.css): the modules
// `fill: var(--info-band)`; the white behind them is the tile's own `--qr-ground`.
//
// The numbers, in module units with the origin at the outer corner of the quiet zone:
//   n      modules per side of the symbol (41 for version 6)         quiet  modules of white round it (4, the standard's minimum)
//   d      one run per horizontal stretch of dark modules: `M{col+quiet} {row+quiet}h{len}v1h-{len}z`, none inside the centre cut-out
//   cut    side of the square cut out of the centre (13 of 41 modules is 10 %, which error correction Q recovers, D-066); odd, so it is centred on the module grid
// The gold S sits in the cut-out, one module smaller than it (12 of 13), centred; it is the deck's own mark file (assets/brand/savo-mark.svg), not a copy of its paths.
import { s, num } from './dom.js';

/** Characters a module path may contain: path commands for straight runs, numbers and separators. Anything else is not drawn. */
const PATH_OK = /^[MmHhVvLlZz0-9.,\s-]+$/;
const isInt = (/** @type {unknown} */ v) => typeof v === 'number' && Number.isInteger(v);

/**
 * @typedef {{n: number, quiet: number, d: string, cut: number}} QrModules
 */

/**
 * Every problem of a module description; an empty list means it can be drawn.
 * @param {any} m
 * @returns {string[]}
 */
export function validateModules(m) {
  /** @type {string[]} */ const bad = [];
  if (!m || typeof m !== 'object') return ['modules_missing'];
  if (!isInt(m.n) || m.n < 21 || m.n > 177 || m.n % 4 !== 1) bad.push(`modules_n_invalid: ${m.n} (a QR symbol is 17 + 4 x version modules, 21 to 177)`);
  if (!isInt(m.quiet) || m.quiet < 4) bad.push(`modules_quiet_invalid: ${m.quiet} (at least 4 modules of quiet zone)`);
  if (typeof m.d !== 'string' || m.d.trim() === '' || !PATH_OK.test(m.d)) bad.push('modules_path_invalid: only straight path commands, numbers and separators');
  if (!isInt(m.cut) || m.cut < 1 || m.cut % 2 === 0 || (isInt(m.n) && (m.cut >= m.n || (m.n - m.cut) % 2 !== 0))) bad.push(`modules_cut_invalid: ${m.cut} (an odd side smaller than ${m.n})`);
  return bad;
}

/**
 * Where everything lies, in module units: the viewBox side, the cut-out square and the S inside it. Pure; the hand-computed test checks it.
 * @param {QrModules} m
 * @returns {{total: number, cut: {x: number, y: number, size: number}, mark: {x: number, y: number, size: number}}}
 */
export function qrLayout(m) {
  const total = m.n + 2 * m.quiet, a = ((m.n - m.cut) >> 1) + m.quiet, markSize = m.cut - 1;
  return { total, cut: { x: a, y: a, size: m.cut }, mark: { x: a + (m.cut - markSize) / 2, y: a + (m.cut - markSize) / 2, size: markSize } };
}

/**
 * @param {Document} doc
 * @param {{modules: QrModules, alt: string, mark: string}} spec  `mark` is the url of the S file
 * @returns {SVGElement}  `svg.savo-qr-svg`, to fill its 240 px tile
 */
export function buildQrSvg(doc, spec) {
  const bad = validateModules(spec.modules);
  if (bad.length) throw new Error(`deck QR: ${bad.join('; ')}`);
  const { total, mark } = qrLayout(spec.modules);
  const svg = s(doc, 'svg', { class: 'savo-qr-svg', viewBox: `0 0 ${total} ${total}`, 'shape-rendering': 'crispEdges', role: 'img', 'aria-label': spec.alt });
  svg.appendChild(s(doc, 'path', { class: 'savo-qr-modules', d: spec.modules.d }));
  svg.appendChild(s(doc, 'image', { class: 'savo-qr-mark', href: spec.mark, x: num(mark.x), y: num(mark.y), width: num(mark.size), height: num(mark.size), preserveAspectRatio: 'xMidYMid meet', 'aria-hidden': 'true' }));
  return svg;
}
