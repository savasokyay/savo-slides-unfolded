// @ts-check
// WP-12c / D-073: the behaviour of the student page's display controls. The LOOK is engine/chrome/controls.js + engine/css/controls.css (ui-agent, WP-12b):
// a rail at the right edge, hidden at rest, revealed by the pointer over the edge zone or by keyboard focus inside it (CSS: :hover, :focus-within) and by
// `data-open="true"` on the root, which is the switch this module owns. What is here:
//   - the controls sit OUTSIDE the deck root (the stage host, in <body>): the 120 ms opacity transition of their panel is a CSS transition, and inside the deck
//     root it would count as one of the engine's own animations and hold the lock (measured by ui-agent: getAnimations 1)
//   - touch: a tap on the edge zone opens the panel (pointerdown of type touch -> data-open); a tap elsewhere or Esc closes it. The tap that OPENS must not also
//     press the button under the finger (an invisible panel still takes events), so the click that follows it is swallowed
//   - the buttons: language, theme and cues call `actions`; the state is only what `state()` says, so the page owns it and `refresh()` brings the controls in line
//     in place (attributes and labels, never a rebuild: focus, hover and the open state survive)
//   - a click with the pointer hands the keyboard back to the deck (blur): Space and Enter would otherwise press that button again, and :focus-within would keep
//     the panel on screen after the pointer left. A click that came from the keyboard (detail 0) keeps focus
// WP-59 (D-142, the user's choices of 2026-10-27):
//   - with `actions.next` the controls carry the Back / Next pair (data-action nav) and the "always show" pin (data-action pin) under the display controls
//   - pinned (data-pinned="true", written by the builder from state().pinned): the panel stays on screen and a tap never opens or closes it. The page decides the
//     default (boot.js: pinned on a touch screen, not pinned elsewhere) and remembers the reader's choice (core/prefs.js `pin`)
//   - where the controls stand (data-dock, from the stage's own fit on every resize): `band` when the window leaves a band of DOCK.bandMin px or more under the
//     slide (a phone held upright, a 4:3 screen): a row in that band, under the slide and never over it; `side` otherwise: the column at the right edge, which on a
//     phone held sideways stands in the side bar the stage leaves free
//   - a touch that CLOSES the open panel does nothing else: its pointer is remembered, and core/touch.js asks for it (`consumed`) before it reads a tap
//   - mountTouchHint: the one-time hint of a touch screen, gone at the first touch or key
// The audience window and the preview have no such element (zero UI, plan 3.3).
import { buildStudentControls, buildTouchHint } from '../chrome/controls.js';
import { STAGE } from '../chrome/layout.js';

/** @typedef {{lang: 'en'|'tr', theme: 'light'|'dark', cues: boolean, pinned?: boolean}} ControlsState */

/** The least band under the slide that takes the row of controls: a 44 px button in its segment and the panel's padding (52 px) and a little air. */
export const DOCK = Object.freeze({ bandMin: 64 });

/**
 * Where the controls stand: a row in the band under the slide when there is one, else the column at the right edge (D-073).
 * @param {{width: number, height: number}} area the stage's room (its wrapper) @param {{scale: number, left: number, top: number}} fit core/stage.js fitStage
 * @returns {{dock: 'band', top: number, height: number}|{dock: 'side'}}
 */
export function dockFor(area, fit) {
  const bottom = fit.top + Math.round(STAGE.height * fit.scale);
  const band = Math.floor(area.height - bottom);
  return band >= DOCK.bandMin ? { dock: 'band', top: bottom, height: band } : { dock: 'side' };
}

/** The live element's own attributes, which `refresh()` keeps: the open state and where the controls stand. */
const LIVE = new Set(['data-open', 'data-dock', 'style']);

/**
 * Bring `live` in line with `fresh`, a freshly built tree of the same shape: attributes and text, in place. The attributes in LIVE are the live element's
 * own. When the shapes differ (never expected: the builder draws the same tree every time) the children are replaced rather than a wrong state kept.
 * @param {Element} live @param {Element} fresh
 */
export function morph(live, fresh) {
  for (const a of [...live.attributes]) if (!fresh.hasAttribute(a.name) && !LIVE.has(a.name)) live.removeAttribute(a.name);
  for (const a of [...fresh.attributes]) if (live.getAttribute(a.name) !== a.value) live.setAttribute(a.name, a.value);
  if (live.children.length !== fresh.children.length) { live.replaceChildren(...fresh.childNodes); return; }
  [...live.children].forEach((c, i) => morph(c, fresh.children[i]));
  if (live.children.length === 0 && live.textContent !== fresh.textContent) live.textContent = fresh.textContent;
}

/**
 * @param {object} o
 * @param {Document} o.doc
 * @param {() => ControlsState} o.state  what is on screen now
 * @param {{lang: (lang: string) => void, theme: (theme: string) => void, cues: (on: boolean) => void, pin?: (on: boolean) => void, next?: () => void, back?: () => void}} o.actions
 *   what a button does (the page changes its state, remembers it and calls `refresh`); with `next` (WP-59) the controls carry the pin and the Back / Next pair
 * @param {() => {width: number, height: number, scale: number, left: number, top: number}} [o.geometry]  the stage's room and fit (boot.js); without it the
 *   controls stay at the side
 */
export function mountStudentControls({ doc, state, actions, geometry }) {
  const nav = typeof actions.next === 'function';
  const build = () => buildStudentControls(doc, state(), { placement: 'rail', nav });
  const root = build();
  doc.body.appendChild(root);
  const win = doc.defaultView;
  const isOpen = () => root.getAttribute('data-open') === 'true';
  const isPinned = () => root.getAttribute('data-pinned') === 'true';
  const open = () => root.setAttribute('data-open', 'true');
  const close = () => {
    root.removeAttribute('data-open');
    const a = doc.activeElement;
    if (a && root.contains(a)) /** @type {HTMLElement} */ (a).blur();          // :focus-within would keep the panel shown
  };
  let swallow = false;                                                           // the next click is the tail of the tap that opened the panel
  let closedBy = -1;                                                             // the pointer whose touch closed the panel (core/touch.js asks for it)

  const place = () => {
    if (!geometry) return;
    const g = geometry();
    const d = dockFor(g, g);
    root.setAttribute('data-dock', d.dock);
    if (d.dock === 'band') { root.style.setProperty('--dock-top', `${d.top}px`); root.style.setProperty('--dock-height', `${d.height}px`); }
    else { root.style.removeProperty('--dock-top'); root.style.removeProperty('--dock-height'); }
  };
  place();

  /** @param {Event} ev */
  const onPointerDown = (ev) => {
    swallow = false;
    const type = /** @type {PointerEvent} */ (ev).pointerType;
    if ((type === 'touch' || type === 'pen') && !isOpen() && !isPinned()) { open(); swallow = true; }
  };
  /** @param {Event} ev */
  const onClickCapture = (ev) => {
    if (swallow) { swallow = false; ev.preventDefault(); ev.stopPropagation(); }
  };
  /** @param {Event} ev */
  const onClick = (ev) => {
    const b = /** @type {HTMLElement|null} */ (/** @type {Element} */ (ev.target).closest('button[data-action]'));
    if (!b || !root.contains(b)) return;
    const { action, value } = b.dataset;
    if (action === 'lang' && value) actions.lang(value);
    else if (action === 'theme' && value) actions.theme(value);
    else if (action === 'cues') actions.cues(!state().cues);
    else if (action === 'pin') actions.pin?.(!state().pinned);
    else if (action === 'nav' && value === 'next') actions.next?.();
    else if (action === 'nav' && value === 'back') actions.back?.();
    if (/** @type {MouseEvent} */ (ev).detail > 0) b.blur();
  };
  /** A touch or click outside the zone closes an open panel; a touch that did so is remembered. @param {Event} ev */
  const onDocPointerDown = (ev) => {
    if (!isOpen() || root.contains(/** @type {Node} */ (ev.target))) return;
    close();
    if (!isPinned()) closedBy = /** @type {PointerEvent} */ (ev).pointerId;
  };
  /** @param {KeyboardEvent} ev */
  const onKey = (ev) => { if (ev.key === 'Escape' && (isOpen() || root.contains(doc.activeElement))) close(); };

  root.addEventListener('pointerdown', onPointerDown);
  root.addEventListener('click', onClickCapture, true);
  root.addEventListener('click', onClick);
  doc.addEventListener('pointerdown', onDocPointerDown, true);
  doc.addEventListener('keydown', onKey);
  win?.addEventListener('resize', place);

  return {
    root,
    isOpen, open, close, isPinned,
    /** Did this pointer's touch close the open panel? Asked once per gesture by core/touch.js. @param {number} pointerId */
    consumed(pointerId) { const hit = pointerId === closedBy; if (hit) closedBy = -1; return hit; },
    /** Bring the controls in line with the page's state (after a button, after the language changed some other way). */
    refresh() { morph(root, build()); if (isPinned()) root.removeAttribute('data-open'); },
    destroy() {
      root.removeEventListener('pointerdown', onPointerDown);
      root.removeEventListener('click', onClickCapture, true);
      root.removeEventListener('click', onClick);
      doc.removeEventListener('pointerdown', onDocPointerDown, true);
      doc.removeEventListener('keydown', onKey);
      win?.removeEventListener('resize', place);
      root.remove();
    },
  };
}

/**
 * WP-59 (D-142): the one-time hint of a touch screen: the two tap zones and a word on swiping, over the page and under the controls. It goes at the
 * first touch, click or key anywhere (that touch still does its job: the hint takes no events), with the 260 ms fade of engine/css/controls.css (a CSS
 * transition outside the deck root, so the lock never sees it; instant under reduced motion), and `onDone` remembers that it was seen.
 * @param {{doc: Document, lang: 'en'|'tr', onDone: () => void}} o
 * @returns {{root: HTMLElement, dismiss: () => void}}
 */
export function mountTouchHint({ doc, lang, onDone }) {
  const root = buildTouchHint(doc, lang);
  doc.body.appendChild(root);
  let done = false;
  const dismiss = () => {
    if (done) return;
    done = true;
    doc.removeEventListener('pointerdown', dismiss, true);
    doc.removeEventListener('keydown', dismiss, true);
    const reduce = doc.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
    if (reduce) root.remove();
    else {
      root.addEventListener('transitionend', () => root.remove(), { once: true });
      root.setAttribute('data-gone', 'true');
    }
    onDone();
  };
  doc.addEventListener('pointerdown', dismiss, true);
  doc.addEventListener('keydown', dismiss, true);
  return { root, dismiss };
}
