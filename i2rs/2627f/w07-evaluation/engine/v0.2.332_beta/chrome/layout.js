// @ts-check
// WP-12b: the pure geometry of the chrome. No DOM, no clock, no globals: numbers in, numbers out, so every figure can be checked by hand
// (tests/js/chrome-layout.test.mjs) and the builders (progress.js, topbar.js, footer.js) only turn it into elements.
//
// Source of the numbers: the A+B content slide of prototypes/directions/ (D-059, D-061, D-069) as measured in
// runs/2610221919-ui-cover-v4/metrics.json. All lengths are STAGE pixels (the stage is 1920 x 1080 and is scaled to the window).

/** The stage every slide is drawn on (design-brief section 2). */
export const STAGE = Object.freeze({ width: 1920, height: 1080 });

/**
 * The progress block, B style (D-069): one ring per section, one 12 x 5 pill per slide below it. Colours are not here: the
 * builders mark each item with `data-state` and engine/css/chrome.css paints it from the tokens `done`, `todo` and `cur`.
 */
export const PROGRESS = Object.freeze({
  slot: 62,                    // width of one section's slot
  slotMin: 40,                 // a deck with many sections narrows the slots down to this
  maxWidth: 744,               // ... so the whole block stays within 12 slots' worth
  ringR: 14, ringStroke: 3.5, curRingStroke: 4, dotRatio: 0.42, ringCy: 16,
  pillW: 12, pillH: 5, pillRx: 2.5, pillPitch: 15, pillCy: 46, pillGap: 3, pillMinW: 4, pillOutline: 1.6,
  margin: 4,                   // pills of one section stay this far inside the slot
  tickStroke: 2.6,
  height: 50,                  // svg height: rings and pills only, no underline below the current section (D-069)
  // the "ring" variant of a flat deck (low priority): one small ring per slide
  flatR: 9, flatStroke: 3, flatCy: 25, flatPitch: 30, flatPitchMin: 21, flatMaxWidth: 560,
});

/**
 * @typedef {'done'|'cur'|'todo'} State
 * @typedef {{kind: 'ring', cx: number, cy: number, r: number, stroke: number, state: State}
 *   | {kind: 'dot', cx: number, cy: number, r: number}
 *   | {kind: 'tick', d: string}
 *   | {kind: 'pill', x: number, y: number, w: number, h: number, rx: number, state: State, section: number, slide: number}} Item
 * @typedef {{width: number, height: number, variant: 'constellation'|'ring', items: Item[], problems: string[]}} ProgressLayout
 */

/** @param {number} section @param {number} cur @returns {State} */
const sectionState = (section, cur) => (section < cur ? 'done' : section === cur ? 'cur' : 'todo');

/**
 * The geometry of the progress block.
 * @param {number[]} sections  slide count of each section, in order
 * @param {{section: number, slide: number}} position  zero-based: the current section and the current slide inside it
 * @param {'constellation'|'ring'} [variant]  `constellation` is the hierarchical block; `ring` one ring per slide (a flat deck)
 * @returns {ProgressLayout}
 */
export function progressLayout(sections, position, variant = 'constellation') {
  return variant === 'ring' ? flatLayout(sections, position) : constellationLayout(sections, position);
}

/** @param {number[]} sections @param {{section: number, slide: number}} position @returns {ProgressLayout} */
function constellationLayout(sections, position) {
  const P = PROGRESS, n = sections.length;
  const slot = n <= 12 ? P.slot : Math.max(P.slotMin, P.maxWidth / n);
  /** @type {Item[]} */ const items = [];
  /** @type {string[]} */ const problems = [];
  sections.forEach((count, s) => {
    const cx = slot * (s + 0.5), state = sectionState(s, position.section);
    items.push({ kind: 'ring', cx, cy: P.ringCy, r: P.ringR, stroke: state === 'done' ? 0 : state === 'cur' ? P.curRingStroke : P.ringStroke, state });
    if (state === 'done') items.push({ kind: 'tick', d: `M${cx - 5.5} ${P.ringCy} l3.8 3.8 l7 -7.6` });
    if (state === 'cur') items.push({ kind: 'dot', cx, cy: P.ringCy, r: P.ringR * P.dotRatio });
    // the pills of this section: the designed size when they fit the slot, narrower when the section is long
    const avail = slot - P.margin, full = (count - 1) * P.pillPitch + P.pillW;
    let w = P.pillW, pitch = P.pillPitch;
    if (full > avail) {
      w = Math.max(P.pillMinW, (avail - P.pillGap * (count - 1)) / count);
      pitch = w + P.pillGap;
      if ((count - 1) * pitch + w > avail + 1e-9) problems.push(`progress_crowded: section ${s + 1} has ${count} slides and does not fit its slot`);
    }
    const x0 = cx - ((count - 1) * pitch) / 2;
    for (let k = 0; k < count; k++) {
      const pillState = state === 'done' ? 'done' : state === 'todo' ? 'todo' : k < position.slide ? 'done' : k === position.slide ? 'cur' : 'todo';
      items.push({ kind: 'pill', x: x0 + k * pitch - w / 2, y: P.pillCy - P.pillH / 2, w, h: P.pillH, rx: P.pillRx, state: pillState, section: s, slide: k });
    }
  });
  return { width: slot * n, height: P.height, variant: 'constellation', items, problems };
}

/** @param {number[]} sections @param {{section: number, slide: number}} position @returns {ProgressLayout} */
function flatLayout(sections, position) {
  const P = PROGRESS, total = sections.reduce((a, b) => a + b, 0);
  let current = position.slide;
  for (let s = 0; s < position.section; s++) current += sections[s];
  const pitch = Math.max(P.flatPitchMin, Math.min(P.flatPitch, P.flatMaxWidth / total));
  /** @type {Item[]} */ const items = [];
  /** @type {string[]} */ const problems = [];
  if (pitch * total > P.flatMaxWidth + 1e-9) problems.push(`progress_crowded: ${total} slides do not fit ${P.flatMaxWidth} px as single rings`);
  for (let i = 0; i < total; i++) {
    const cx = pitch * (i + 0.5), state = i < current ? 'done' : i === current ? 'cur' : 'todo';
    items.push({ kind: 'ring', cx, cy: P.flatCy, r: P.flatR, stroke: state === 'done' ? 0 : P.flatStroke, state });
    if (state === 'cur') items.push({ kind: 'dot', cx, cy: P.flatCy, r: P.flatR * P.dotRatio });
  }
  return { width: pitch * total, height: P.height, variant: 'ring', items, problems };
}

/**
 * The vertical and horizontal extent that the block really draws (strokes included), in the svg's own coordinates.
 * The footer centres this extent, not the svg box, on the page number (D-069).
 * @param {ProgressLayout} layout
 * @returns {{top: number, bottom: number, left: number, right: number, centre: number}}
 */
export function drawnExtent(layout) {
  let top = Infinity, bottom = -Infinity, left = Infinity, right = -Infinity;
  const grow = (/** @type {number} */ t, /** @type {number} */ b, /** @type {number} */ l, /** @type {number} */ r) => {
    top = Math.min(top, t); bottom = Math.max(bottom, b); left = Math.min(left, l); right = Math.max(right, r);
  };
  for (const it of layout.items) {
    if (it.kind === 'ring') { const e = it.r + it.stroke / 2; grow(it.cy - e, it.cy + e, it.cx - e, it.cx + e); }
    else if (it.kind === 'pill') { const e = it.state === 'todo' ? PROGRESS.pillOutline / 2 : 0; grow(it.y - e, it.y + it.h + e, it.x - e, it.x + it.w + e); }
  }
  return { top, bottom, left, right, centre: (top + bottom) / 2 };
}

/**
 * The page number of the footer: the reading-order position and the total of all pages (plan section 12, 2026-10-22 20:14).
 * @param {{index: number, total: number}} page
 * @returns {{current: string, total: string}}
 */
export function pageParts(page) {
  return { current: String(page.index), total: `/ ${page.total}` };
}
