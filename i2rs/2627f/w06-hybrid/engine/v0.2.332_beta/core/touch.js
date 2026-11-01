// @ts-check
// WP-59 (D-142): touch navigation on the student page. A finger (or a pen) gives the same two commands as the keys of core/input.js; the
// mouse is left alone: a click on a slide still advances nothing (plan section 3.3), on the student page as everywhere else. Pure first:
// `classifyGesture` turns a finished gesture into a command or null, so every threshold is checked by hand with `node --test`
// (tests/js/touch.test.mjs); then a thin binding (`bindTouch`) feeds it pointer events.
//
//   tap     the finger lifts within TAP_MS and moved less than TAP_SLOP: the left BACK_ZONE of the visible width goes back, the rest goes on
//           (the reading apps' convention: Kindle, Apple Books, story viewers)
//   swipe   the finger travels SWIPE_MIN or more, mostly sideways (|dx| > SWIPE_RATIO * |dy|), within SWIPE_MS: to the left goes on, to the
//           right goes back (a page turned by hand)
// Ignored (cmd null, with the reason):
//   controls     the gesture started on the display controls: a tap there is a button's (or opens the hidden rail), a stroke there is not the page's
//   control      a TAP that started on a link, a button or a field: that element does its own job (a contents row, a progress pill). A SWIPE that
//                starts on one still turns the page: the browser sends no click after a stroke, and on the contents page the rows (full-width
//                links) cover most of the slide (measured headless 2026-10-27)
//   consumed     the tap that closed the open rail (core/student-controls.js says so): closing is all it does, as opening is
//   multi-touch  two fingers or more: a pinch zoom
//   long-press   a finger held TAP_MS or longer without moving: text selection
//   zoomed       a swipe while the page is pinch-zoomed in: the finger pans the zoomed page (a tap still works)
//   edge         a swipe that starts within EDGE of the left or right edge: the phone's own back gesture
//   neither      a movement that is neither a tap nor a swipe (a slow drag, a vertical stroke)
// Positions are CSS pixels of the VISIBLE area (the visual viewport), so the zones follow what the reader sees when the page is zoomed.
// No timer anywhere: the duration is the difference of the two events' times (D-039; tests/js/wapi-only.test.mjs).
// The click after a tap: a browser follows every tap with a click at the same point, AFTER pointerup, so after a tap has moved the deck that
// click lands on the NEW slide. Measured headless on 2026-10-27 (runs/<stamp>-touch-nav, row t03): a tap on the right of the cover went to the
// contents page and its click opened the contents link under the finger (`#/cascade/0`). So the one click that follows a tap which pressed
// next or back is stopped in the capture phase; any pointerdown clears that, and a click from the keyboard (detail 0) is never stopped.
//
// touch-action (engine/css/controls.css): the student surround is `pinch-zoom` while the page is not zoomed, so one finger belongs to this
// module and two fingers to the browser; when the reader has zoomed in it becomes `manipulation`, so one finger pans the zoomed page. The
// switch is the attribute `data-savo-zoomed` on <html>, written here from visualViewport. Double-tap zoom is off in both (only `auto` has it):
// two quick taps are two presses.
import { isActivatable, isEditable } from './input.js';

export const TOUCH = Object.freeze({ TAP_SLOP: 10, TAP_MS: 500, SWIPE_MIN: 40, SWIPE_RATIO: 1.5, SWIPE_MS: 800, EDGE: 20, BACK_ZONE: 0.3, ZOOMED: 1.01 });

/**
 * @typedef {object} Gesture
 * @property {number} x0 @property {number} y0  where the first finger went down (CSS px of the visible area)
 * @property {number} x1 @property {number} y1  where it came up
 * @property {number} ms        how long it was down
 * @property {number} fingers   the most fingers that were down at once during the gesture
 * @property {number} width     the visible width when it went down
 * @property {boolean} [zoomed] the page was pinch-zoomed in
 * @property {boolean} [onControls] it started on the display controls
 * @property {boolean} [onControl] it started on a link, a button or a field elsewhere on the page
 * @property {boolean} [consumed] it closed the open rail
 */

/**
 * @param {Gesture} g
 * @returns {{cmd: 'next'|'back'|null, kind: 'tap'|'swipe'|null, why: string}}
 */
export function classifyGesture(g) {
  /** @param {string} why */
  const none = (why) => ({ cmd: null, kind: null, why });
  if (g.onControls) return none('controls');
  if (g.consumed) return none('consumed');
  if (g.fingers > 1) return none('multi-touch');
  const dx = g.x1 - g.x0, dy = g.y1 - g.y0;
  if (Math.hypot(dx, dy) < TOUCH.TAP_SLOP) {
    if (g.ms >= TOUCH.TAP_MS) return none('long-press');
    if (g.onControl) return none('control');
    return { cmd: g.x0 < g.width * TOUCH.BACK_ZONE ? 'back' : 'next', kind: 'tap', why: 'tap' };
  }
  if (Math.abs(dx) >= TOUCH.SWIPE_MIN && Math.abs(dx) > TOUCH.SWIPE_RATIO * Math.abs(dy) && g.ms < TOUCH.SWIPE_MS) {
    if (g.zoomed) return none('zoomed');
    if (g.x0 < TOUCH.EDGE || g.x0 > g.width - TOUCH.EDGE) return none('edge');
    return { cmd: dx < 0 ? 'next' : 'back', kind: 'swipe', why: 'swipe' };
  }
  return none('neither');
}

/**
 * What a gesture starts on: `controls` anywhere in the display controls (their hidden zone opens them), `control` on a link, a button or an editable
 * field elsewhere (an SVG <a> counts: its tagName is "a" and isActivatable compares in upper case), null on the page itself.
 * @param {any} target @returns {'controls'|'control'|null}
 */
export function controlOf(target) {
  /** @type {'control'|null} */
  let found = null;
  for (let el = target; el && el.nodeType === 1; el = el.parentNode) {
    if (typeof el.getAttribute === 'function' && (el.getAttribute('class') ?? '').split(/\s+/).includes('savo-controls')) return 'controls';
    if (found === null && (isActivatable(el) || isEditable(el))) found = 'control';
  }
  return found;
}

/**
 * Attach touch navigation to a student page. Returns the function that detaches it.
 * @param {Document} doc
 * @param {{next: () => unknown, prev: () => unknown}} player
 * @param {{win: Window, consumed?: (pointerId: number) => boolean, onGesture?: (r: ReturnType<typeof classifyGesture>) => void}} o
 *   consumed: asked when a finger lifts: did this pointer close the open rail? (core/student-controls.js)
 *   onGesture: told every classified gesture (the harness reads it)
 * @returns {() => void}
 */
export function bindTouch(doc, player, { win, consumed = () => false, onGesture }) {
  /** @type {Set<number>} */
  const down = new Set();
  /** @type {null|{id: number, x0: number, y0: number, t0: number, fingers: number, width: number, zoomed: boolean, onControls: boolean, onControl: boolean}} */
  let g = null;
  const view = () => {
    const v = win.visualViewport;
    return v ? { left: v.offsetLeft, top: v.offsetTop, width: v.width, scale: v.scale } : { left: 0, top: 0, width: win.innerWidth, scale: 1 };
  };
  /** @param {PointerEvent} e */
  const isFinger = (e) => e.pointerType === 'touch' || e.pointerType === 'pen';
  let stopClick = false;                                               // the next click is the tail of a tap that moved the deck (see the header)

  /** @param {Event} ev */
  const onDown = (ev) => {
    const e = /** @type {PointerEvent} */ (ev);
    stopClick = false;
    if (!isFinger(e)) return;
    down.add(e.pointerId);
    if (down.size === 1) {
      const v = view(), on = controlOf(e.target);
      g = { id: e.pointerId, x0: e.clientX - v.left, y0: e.clientY - v.top, t0: e.timeStamp, fingers: 1, width: v.width, zoomed: v.scale > TOUCH.ZOOMED,
        onControls: on === 'controls', onControl: on === 'control' };
    } else if (g) g.fingers = Math.max(g.fingers, down.size);
  };
  /** @param {Event} ev */
  const onUp = (ev) => {
    const e = /** @type {PointerEvent} */ (ev);
    if (!down.delete(e.pointerId) || !g || e.pointerId !== g.id) return;
    const v = view(), start = g;
    g = null;
    const r = classifyGesture({ x0: start.x0, y0: start.y0, x1: e.clientX - v.left, y1: e.clientY - v.top, ms: e.timeStamp - start.t0, fingers: start.fingers,
      width: start.width, zoomed: start.zoomed, onControls: start.onControls, onControl: start.onControl, consumed: consumed(e.pointerId) });
    if (r.cmd === 'next') player.next();
    else if (r.cmd === 'back') player.prev();
    if (r.cmd !== null && r.kind === 'tap') stopClick = true;
    onGesture?.(r);
  };
  /** @param {Event} ev */
  const onClick = (ev) => {
    if (!stopClick) return;
    stopClick = false;
    if (/** @type {MouseEvent} */ (ev).detail === 0) return;                       // a keyboard click: not the tail of a tap
    ev.preventDefault();
    ev.stopPropagation();
  };
  /** The browser took the gesture over (a pan of the zoomed page, a system gesture): nothing to classify. @param {Event} ev */
  const onCancel = (ev) => {
    const e = /** @type {PointerEvent} */ (ev);
    down.delete(e.pointerId);
    if (g && e.pointerId === g.id) g = null;
  };
  const root = doc.documentElement;
  const onViewport = () => {
    const v = win.visualViewport;
    if (v && v.scale > TOUCH.ZOOMED) root.setAttribute('data-savo-zoomed', 'true'); else root.removeAttribute('data-savo-zoomed');
  };

  doc.addEventListener('pointerdown', onDown, true);
  doc.addEventListener('pointerup', onUp, true);
  doc.addEventListener('pointercancel', onCancel, true);
  doc.addEventListener('click', onClick, true);
  win.visualViewport?.addEventListener('resize', onViewport);
  onViewport();
  return () => {
    doc.removeEventListener('pointerdown', onDown, true);
    doc.removeEventListener('pointerup', onUp, true);
    doc.removeEventListener('pointercancel', onCancel, true);
    doc.removeEventListener('click', onClick, true);
    win.visualViewport?.removeEventListener('resize', onViewport);
    root.removeAttribute('data-savo-zoomed');
  };
}
