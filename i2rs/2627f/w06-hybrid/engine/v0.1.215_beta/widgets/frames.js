// @ts-check
// WP-20 (brief 04, moved here from prototypes/story-widgets after the visual acceptance there; the engine's own CSS is css/widgets.css): from a pure frame function to kit steps.
//
// A widget describes ONE thing per key (an element it built): its final style in every step, as a map
// frame(k) -> Map<key, style>. This helper derives the two things the kit wants from that single source:
//   steps[k].final()  sets frame(k) instantly (idempotent, independent of the DOM's current state);
//   steps[k].plan()   animates the keys whose style differs between frame(k-1) and frame(k), from the first
//                     style to the second, timed by timing(key, k). `extra(k)` adds transient entries (an element that
//                     is invisible before AND after the step, e.g. the numbers that travel into a sum).
// plan() is pure (it writes nothing). Because every animation ends exactly on frame(k), "a jump to k shows what the
// step k-1 -> k ends in" holds by construction; the page's self-test still measures it on the real DOM.
//
// Motion rules (engine/widgets/kit.js ALLOWED_PROPS): only opacity, transform, strokeDashoffset and clipPath are
// animated. A colour change is a crossfade of two stacked layers (opacity), never a colour keyframe.
//
// Migration: this file moves to engine/widgets/frames.js unchanged (the widget modules import it from there).

/** @typedef {Record<string, string>} Style  camelCase CSS property -> value */
/** @typedef {Style & {offset: number, easing?: string}} Via */
/** @typedef {{start: number, duration: number, fill?: FillMode, easing?: string, via?: Via[], firstEasing?: string}} Timing  `firstEasing`: the curve of the first segment of a `via` path (default: the engine's) */
/** @typedef {[Element, Keyframe[], number, number, FillMode?, string?]} PlanEntry  the engine's Plan entry (core/animations.js) */
/** @typedef {{final: () => void, plan: () => PlanEntry[]}} Step */

export const ANIMATED = Object.freeze(['opacity', 'transform', 'strokeDashoffset', 'clipPath']);

/** @param {Style} a @param {Style} b */
const same = (a, b) => {
  const ka = Object.keys(a);
  return ka.length === Object.keys(b).length && ka.every((p) => a[p] === b[p]);
};

/**
 * @param {object} o
 * @param {number} o.n                                   number of steps, k = 0..n
 * @param {Map<string, Element>} o.els                   every animated element by key
 * @param {(k: number) => Map<string, Style>} o.frame
 * @param {(key: string, k: number) => Timing} o.timing
 * @param {(k: number) => PlanEntry[]} [o.extra]
 * @param {string} o.easing                              the engine's default curve (ctx.defaults.easing); only entries with `via` need it written
 * @returns {Step[]}
 */
export function stepsFromFrames({ n, els, frame, timing, extra, easing }) {
  const keys0 = [...frame(0).keys()].sort();
  /** @type {Map<string, string>} */
  const props = new Map();
  for (let k = 0; k <= n; k++) {
    const f = frame(k);
    const ks = [...f.keys()].sort();
    if (ks.length !== keys0.length || ks.some((x, i) => x !== keys0[i])) throw new Error(`frame ${k} has another key set than frame 0`);
    for (const [key, st] of f) {
      if (!els.has(key)) throw new Error(`frame ${k}: no element for key "${key}"`);
      const sig = Object.keys(st).sort().join(',');
      if (props.has(key) && props.get(key) !== sig) throw new Error(`key "${key}" changes its property set at frame ${k}`);
      props.set(key, sig);
      for (const p of Object.keys(st)) if (!ANIMATED.includes(p)) throw new Error(`key "${key}" frame ${k}: ${p} is not an animated property (${ANIMATED.join(', ')})`);
    }
  }
  const apply = (/** @type {number} */ k) => {
    for (const [key, st] of frame(k)) Object.assign(/** @type {HTMLElement|SVGElement} */ (els.get(key)).style, st);
  };
  /** @param {number} k @returns {PlanEntry[]} */
  const derive = (k) => {
    const a = frame(k - 1);
    const out = /** @type {PlanEntry[]} */ ([]);
    for (const [key, to] of frame(k)) {
      const from = /** @type {Style} */ (a.get(key));
      if (same(from, to)) continue;
      const t = timing(key, k);
      /** @type {Keyframe[]} */
      const kf = t.via
        ? [{ ...from, easing: t.firstEasing ?? easing }, ...t.via.map((v) => ({ ...v, easing: v.easing ?? easing })), { ...to }]
        : [{ ...from }, { ...to }];
      out.push([/** @type {Element} */ (els.get(key)), kf, t.start, t.duration, t.fill, t.via ? 'linear' : t.easing]);
    }
    return out;
  };
  return Array.from({ length: n + 1 }, (_, k) => ({
    final: () => apply(k),
    plan: () => (k === 0 ? [] : [...derive(k), ...(extra ? extra(k) : [])]),
  }));
}

/**
 * Minimal DOM helper: element with class and attributes.
 * @param {Document} doc @param {string} tag @param {string} [cls] @param {Record<string, string>} [attrs]
 * @returns {HTMLElement}
 */
export function h(doc, tag, cls = '', attrs = {}) {
  const el = doc.createElement(tag);
  if (cls) el.className = cls;
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

const SVG = 'http://www.w3.org/2000/svg';
/**
 * @param {Document} doc @param {string} tag @param {Record<string, string>} [attrs]
 * @returns {SVGElement}
 */
export function s(doc, tag, attrs = {}) {
  const el = doc.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

/**
 * Fit factor of a design box into the room the widget is given: the widget draws in design pixels and scales once, statically,
 * when its room differs (never animated). Reads ctx.size; the slot's own size is the fallback.
 * @param {{slot: HTMLElement, size?: {width: number, height: number}}} ctx @param {number} w @param {number} hh
 */
export function fit(ctx, w, hh) {
  const size = ctx.size ?? { width: ctx.slot.clientWidth || w, height: ctx.slot.clientHeight || hh };
  return Math.min(size.width / w, size.height / hh);
}
