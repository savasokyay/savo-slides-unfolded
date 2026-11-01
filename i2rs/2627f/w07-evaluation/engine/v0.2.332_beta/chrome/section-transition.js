// @ts-check
// WP-86 (D-156, D-159, D-161): the transition that opens a section, as the user chose it (B + C, with a plate behind the new name and a "New section" chip beside it; no pop). The strip answers first: the old
// name leaves upward and the new one arrives from below, a bar of the section colour is drawn along the strip's rule, a tint plate stands behind the new name and a chip says "New section" beside it; the progress
// map confirms 200 ms behind: it grows from its bottom-right corner, the ring of the section that ended is ticked, the ring of the new section is lit and a halo goes out. The slide's own entry starts 200 ms late.
// Prototype and numbers: prototypes/section-start/ (plans.mjs `BC`, `comboPlan('both')`); design: docs/design-wp86-section-transition.md.
//
// What this file is: PURE DATA and the DOM of the transient layers. `transitionEntries` is the plan as data (which part, what it looks like, when, for how long); `startTransition` builds the layers that
// only a transition needs, writes the first frame of every part, and returns the plan in the engine's own shape (`[element, keyframes, start, duration]`) for core/animations.js playPlan. It plays nothing and
// sets no timer: motion is the player's (D-039; chrome README rule). `finish()` takes the layers away and the first frames off the strip and the map, so what stays is exactly the DOM a deep link of the same
// page draws: the final frame is a pure function of (slide, step) (plan 3.2).
//
// Rules the numbers keep (D-039, D-156): only opacity and transform; a colour change is a cross-fade of two layers, never a colour keyframe (the ring layers); the strip's name carries its own
// `translate(-50%, -50%)` in EVERY keyframe (a bare translateY would drop the centring); WCAG 2.3.1: every transient part is faded in and out ONCE, at least 333 ms apart, and the biggest part, the
// enlarged map, is about 2.3 % of the stage. The transition does not draw the map's parts on the flat ring variant of the progress block or on `none`: those have no section rings to tick or light, so the
// map, the ring layers and the halo are left out (the strip's parts still play and the lock ends at 1300 ms instead of 1400).
import { h, s, num } from './dom.js';
import { buildSectionLabel } from './topbar.js';
import { progressLayout, PROGRESS } from './layout.js';
import { createT } from './strings.js';

/** @typedef {import('./model.js').ChromeModel} ChromeModel @typedef {import('../core/animations.js').Plan} Plan */

/**
 * The numbers (ms and stage px). The strip answers first, the map 200 ms behind it; the slide's own entry starts at `headAt`. Lock: the map's return, 1000 + 400 = 1400.
 *   label  the old name leaves 0 -> 260, the new one arrives 120 -> 400 (a first section has no old name: the new one arrives 0 -> 280)
 *   bar    drawn 0 -> 520, held, faded 900 -> 1300 (along the strip's rule, stage x 60 to 1860, y 135 to 140)
 *   map    grows 200 -> 480 (x1.6, from its bottom-right corner), back 1000 -> 1400; the ring that ended is ticked 200 -> 600, the new ring is lit 480 -> 880, the halo goes out 580 -> 1280
 *   plate  a tint of the section colour behind the new name, in 120 -> 400, out 800 -> 1200 (one pair, 400 ms apart); wider than the name by `padX` on each side
 *   chip   "New section" beside the name, in 300 -> 560 (sliding 10 px), out 1000 -> 1300 (one pair, 440 ms apart); `gap` px from the NAME's edge to the chip (the plate stands `padX` wider than the name, so 12 px of the gap lie between the plate and the chip)
 *   strip  the strip's own coordinates (it starts at stage x 60): the name's centre is x 900, y 55.5 (the middle of its padding box, 111 px high)
 */
export const TRANSITION = Object.freeze({
  headAt: 200,
  label: Object.freeze({ dy: 14, outMs: 260, inAt: 120, inMs: 280 }),
  bar: Object.freeze({ drawMs: 520, fadeAt: 900, fadeMs: 400, left: 60, top: 135, width: 1800, height: 5 }),
  map: Object.freeze({ at: 200, zoomMs: 280, zoom: 1.6, zoomOutAt: 1000, zoomOutMs: 400, ringPrevMs: 400, ringNewAt: 480, ringNewMs: 400, haloAt: 580, haloMs: 700, haloTo: 2.6 }),
  plate: Object.freeze({ inAt: 120, inMs: 280, outAt: 800, outMs: 400, padX: 24, h: 56 }),
  chip: Object.freeze({ inAt: 300, inMs: 260, dx: -10, outAt: 1000, outMs: 300, gap: 36, h: 34 }),
  strip: Object.freeze({ centreX: 900, centreY: 55.5 }),
});

/** The part names a plan may use: every one is bound by `startTransition`, which throws on a plan that names another. */
export const PARTS = Object.freeze(['label', 'labelOld', 'plate', 'chip', 'rule', 'map', 'ringPrev', 'ringNew', 'halo']);

/**
 * One animation as data. `kf` holds the first and the last look of the part (opacity and transform only).
 * @typedef {{part: string, kf: [Record<string, string>, Record<string, string>], at: number, ms: number}} Entry
 */

const CENTRE = 'translate(-50%, -50%)';
const lift = (/** @type {number} */ dy) => `translate(-50%, calc(-50% + ${dy}px))`;
const HIDDEN = { opacity: '0' };
const SEEN = { opacity: '1' };

/**
 * The transition's motion as data. `first`: there is no section before (the contents page or the cover leads in): no old name to send away and no ring to tick. `mapParts`: the progress block has section rings
 * (the constellation variant): without them the map, the ring layers and the halo are left out. `ringPrev`: the layer of the ring that ended exists (default: there is a section before); `startTransition`
 * passes what it really built, so the plan never names a part that was not built (WP-86 port review, P2-1).
 * @param {{first: boolean, mapParts: boolean, ringPrev?: boolean}} o @returns {Entry[]}
 */
export function transitionEntries({ first, mapParts, ringPrev = !first }) {
  const T = TRANSITION;
  /** @type {Entry[]} */ const e = [];
  if (!first) e.push({ part: 'labelOld', kf: [{ opacity: '1', transform: CENTRE }, { opacity: '0', transform: lift(-T.label.dy) }], at: 0, ms: T.label.outMs });
  e.push({ part: 'label', kf: [{ opacity: '0', transform: lift(T.label.dy) }, { opacity: '1', transform: CENTRE }], at: first ? 0 : T.label.inAt, ms: T.label.inMs });
  e.push({ part: 'plate', kf: [HIDDEN, SEEN], at: T.plate.inAt, ms: T.plate.inMs });
  e.push({ part: 'plate', kf: [SEEN, HIDDEN], at: T.plate.outAt, ms: T.plate.outMs });
  e.push({ part: 'chip', kf: [{ opacity: '0', transform: `translateX(${T.chip.dx}px)` }, { opacity: '1', transform: 'none' }], at: T.chip.inAt, ms: T.chip.inMs });
  e.push({ part: 'chip', kf: [{ opacity: '1', transform: 'none' }, { opacity: '0', transform: 'none' }], at: T.chip.outAt, ms: T.chip.outMs });
  e.push({ part: 'rule', kf: [{ opacity: '1', transform: 'scaleX(0)' }, { opacity: '1', transform: 'scaleX(1)' }], at: 0, ms: T.bar.drawMs });
  e.push({ part: 'rule', kf: [{ opacity: '1', transform: 'scaleX(1)' }, { opacity: '0', transform: 'scaleX(1)' }], at: T.bar.fadeAt, ms: T.bar.fadeMs });
  if (mapParts) {
    e.push({ part: 'map', kf: [{ transform: 'scale(1)' }, { transform: `scale(${T.map.zoom})` }], at: T.map.at, ms: T.map.zoomMs });
    e.push({ part: 'map', kf: [{ transform: `scale(${T.map.zoom})` }, { transform: 'scale(1)' }], at: T.map.zoomOutAt, ms: T.map.zoomOutMs });
    if (ringPrev) e.push({ part: 'ringPrev', kf: [SEEN, HIDDEN], at: T.map.at, ms: T.map.ringPrevMs });
    e.push({ part: 'ringNew', kf: [SEEN, HIDDEN], at: T.map.ringNewAt, ms: T.map.ringNewMs });
    e.push({ part: 'halo', kf: [{ opacity: '0.85', transform: 'scale(1)' }, { opacity: '0', transform: `scale(${T.map.haloTo})` }], at: T.map.haloAt, ms: T.map.haloMs });
  }
  return e;
}

/** The static length of the transition itself (the latest end among its entries), ms: what the lock waits for besides the slide's own entry. @param {Entry[]} entries */
export const entriesMs = (entries) => entries.reduce((m, e) => Math.max(m, e.at + e.ms), 0);

/** @param {Element} el @param {Record<string, string>} look  written as inline style: the base DOM of a part is the FIRST frame of its plan, as a layout's mount() writes it */
const put = (el, look) => { for (const [k, v] of Object.entries(look)) /** @type {any} */ (el).style[k] = v; };

/**
 * Build the layers a section transition needs on top of the chrome that was just mounted, write the first frame of every part and hand back the plan.
 * @param {Document} doc
 * @param {Element} chrome  the `div.savo-chrome` of the slide that opens the section
 * @param {{first: boolean, model: ChromeModel, prevModel: ChromeModel|null, measure?: (el: Element) => number}} o
 *   `model`: the chrome model of the new slide (its section ring, its language); `prevModel`: the model of the slide the press leaves, for the old name (null when `first`);
 *   `measure`: the width of the new name in stage px (default `offsetWidth`: layout width, not changed by the stage's scale or the name's own transform), read at the start of EVERY transition, because the
 *   language, the theme and the loading of the font change it
 * @returns {{plan: Plan, headAt: number, finish: () => void, parts: Record<string, Element>}|null}  null when this page has no strip with a section name (a page without chrome)
 */
export function startTransition(doc, chrome, { first, model, prevModel, measure = (el) => /** @type {HTMLElement} */ (el).offsetWidth }) {
  const T = TRANSITION;
  const label = chrome.querySelector('[data-part="section-label"]');
  const topbar = label ? label.parentElement : null;
  if (!label || !topbar) return null;
  const hasPrev = !first && prevModel !== null;
  const progress = chrome.querySelector('[data-part="progress"]');
  const mapParts = model.progress.variant === 'constellation' && progress !== null;
  const width = measure(label);
  const t = createT(model.lang);
  /** @type {Record<string, Element>} */ const parts = { label };
  /** @type {Element[]} */ const layers = [];
  const add = (/** @type {Element} */ parent, /** @type {string} */ part, /** @type {Element} */ el) => { parent.appendChild(el); parts[part] = el; layers.push(el); return el; };

  if (hasPrev && prevModel) {                                           // the old name: the same label as the strip's own, aria-hidden, gone when the transition ends (a screen reader must not read two names)
    const old = buildSectionLabel(doc, prevModel.section, model.lang);
    old.setAttribute('data-part', 'section-label-old');
    old.setAttribute('class', 'savo-section savo-tr-ghost');
    old.setAttribute('aria-hidden', 'true');
    add(topbar, 'labelOld', old);
  }
  const plate = h(doc, 'div', { class: 'savo-tr-plate', 'data-part': 'section-plate', 'aria-hidden': 'true' });
  put(plate, { left: `${num(T.strip.centreX - width / 2 - T.plate.padX)}px`, top: `${num(T.strip.centreY - T.plate.h / 2)}px`, width: `${num(width + 2 * T.plate.padX)}px`, height: `${T.plate.h}px` });
  add(topbar, 'plate', plate);
  const chip = h(doc, 'div', { class: 'savo-tr-chip', 'data-part': 'section-chip', 'aria-hidden': 'true' }, t('section.new'));
  put(chip, { left: `${num(T.strip.centreX + width / 2 + T.chip.gap)}px`, top: `${num(T.strip.centreY - T.chip.h / 2)}px`, height: `${T.chip.h}px` });
  add(topbar, 'chip', chip);
  add(chrome, 'rule', h(doc, 'div', { class: 'savo-tr-rule', 'data-part': 'section-rule', 'aria-hidden': 'true' }));
  let ringPrev = false;                                                  // WP-86 (P2-1): whether the layer of the ring that ended was built; the plan below names it only then
  if (mapParts && progress) {
    parts.map = progress;
    const rings = progressLayout(model.progress.sections, { section: model.progress.section, slide: model.progress.slide }, 'constellation').items.filter((i) => i.kind === 'ring');
    const at = (/** @type {number} */ i) => /** @type {{cx: number, cy: number}} */ (/** @type {unknown} */ (rings[i]));
    const here = at(model.progress.section);
    const todo = s(doc, 'g', { class: 'savo-tr-ghost', 'data-part': 'ring-new', 'aria-hidden': 'true' });
    todo.appendChild(s(doc, 'circle', { class: 'savo-tr-todo', cx: num(here.cx), cy: num(here.cy), r: num(PROGRESS.ringR) }));
    add(progress, 'ringNew', todo);
    // WP-86 (port review P2-1): the ring that ended is the ring of the section the press LEAVES, whatever its place in the order of the sections (the slides need not be in the order of their sections: a press may
    // leave a later section for an earlier one, or skip one). The plan names this layer only when it was built (`ringPrev`), so no press can end in "the plan names the part ringPrev, which was not built".
    const there = hasPrev && prevModel ? /** @type {{cx: number, cy: number}|undefined} */ (/** @type {unknown} */ (rings[prevModel.progress.section])) : undefined;
    if (there) {
      const g = s(doc, 'g', { class: 'savo-tr-ghost', 'data-part': 'ring-prev', 'aria-hidden': 'true' });
      g.appendChild(s(doc, 'circle', { class: 'savo-tr-cur', cx: num(there.cx), cy: num(there.cy), r: num(PROGRESS.ringR) }));
      g.appendChild(s(doc, 'circle', { class: 'savo-tr-dot', cx: num(there.cx), cy: num(there.cy), r: num(PROGRESS.ringR * PROGRESS.dotRatio) }));
      add(progress, 'ringPrev', g);
      ringPrev = true;
    }
    add(progress, 'halo', s(doc, 'circle', { class: 'savo-tr-ghost savo-tr-halo', 'data-part': 'ring-halo', 'aria-hidden': 'true', cx: num(here.cx), cy: num(here.cy), r: num(PROGRESS.ringR) }));
  }

  const entries = transitionEntries({ first: !hasPrev, mapParts, ringPrev });
  const written = new Set();
  /** @type {Plan} */
  const plan = entries.map((e) => {
    const el = parts[e.part];
    if (!el) throw new Error(`section transition: the plan names the part "${e.part}", which was not built`);
    if (!written.has(e.part)) { put(el, e.kf[0]); written.add(e.part); }     // the first frame of every part, before the first animation frame (a delayed entry stands in it until it starts)
    return [el, e.kf, e.at, e.ms];
  });

  let finished = false;
  return {
    plan, headAt: T.headAt, parts,
    finish() {
      if (finished) return;
      finished = true;
      for (const el of layers) el.remove();                              // the old name, the plate, the chip, the bar, the ring layers and the halo
      for (const el of [label, ...(mapParts && progress ? [progress] : [])]) {   // the name and the map stand on their own look again: the first frames written above come off, and an empty style attribute goes
        const st = /** @type {any} */ (el).style;
        st.removeProperty('opacity'); st.removeProperty('transform');
        if (!el.getAttribute('style')) el.removeAttribute('style');
      }
    },
  };
}
