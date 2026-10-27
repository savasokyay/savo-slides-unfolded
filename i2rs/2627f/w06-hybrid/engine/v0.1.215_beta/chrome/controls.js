// @ts-check
// WP-12b / D-050, D-017, D-068: the LOOK and the accessible structure of the student build's display controls: language (EN | TR), theme
// (sun | half moon) and the non-colour cues. Pill segment controls in the manner of RS-lesson-material's `buildSeg` (inspired, not copied).
// The behaviour is not here (WP-12c, code-agent): every button carries `data-action` (lang | theme | cues) and `data-value`, and the state
// is only what the caller passes in. A real <button> with aria-pressed everywhere, labels in both languages from strings.js, icons as SVG.
// WP-59 (D-142): with `nav` the student page adds the "always show" pin (data-action pin) and the Back / Next pair (data-action nav, value back | next)
// under them, and buildTouchHint draws the one-time hint of a touch screen.
// The audience window has NO such control (plan section 3.3, D-068): this element is for the student page only.
import { createT } from './strings.js';
import { h, s } from './dom.js';

/** @typedef {'en'|'tr'} Lang */
/** @typedef {{lang: Lang, theme: 'light'|'dark', cues: boolean, pinned?: boolean}} ControlState */

/** Stroke icons on a 24 x 24 grid: [element, attributes]. The sun and the half moon are the console's own (engine/presenter/console-ui.js). */
const ICONS = /** @type {Record<string, Array<[string, Record<string, string>]>>} */ ({
  light: [['circle', { cx: '12', cy: '12', r: '4' }], ['path', { d: 'M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.4 1.4M17.6 17.6L19 19M5 19l1.4-1.4M17.6 6.4L19 5' }]],
  dark: [['circle', { cx: '12', cy: '12', r: '9' }], ['path', { d: 'M12 3a9 9 0 0 0 0 18z', fill: 'currentColor' }]],
  // the cues: a dotted line (term), a plain line (positive) and a wavy line (negative)
  cues: [['path', { d: 'M3 6h18', 'stroke-dasharray': '0.1 3.6' }], ['path', { d: 'M3 12h18' }],
    ['path', { d: 'M3 18c1.5-2.2 3-2.2 4.5 0s3 2.2 4.5 0 3-2.2 4.5 0 3 2.2 4.5 0' }]],
  // WP-59 (D-142): the pushpin of "always show" and the two chevrons of the slide pair
  pin: [['path', { d: 'M8 3h8M10 3v5l-3.5 4h11L14 8V3M12 12v9' }]],
  back: [['path', { d: 'M15 5l-7 7 7 7' }]],
  next: [['path', { d: 'M9 5l7 7-7 7' }]],
});

/** @param {Document} doc @param {string} name @returns {SVGElement} */
function icon(doc, name) {
  const svg = s(doc, 'svg', { class: 'savo-icon', viewBox: '0 0 24 24', 'aria-hidden': 'true', focusable: 'false' });
  for (const [tag, attrs] of ICONS[name]) svg.appendChild(s(doc, tag, attrs));
  return svg;
}

/**
 * @param {Document} doc
 * @param {ControlState} state  what is on screen now; the caller redraws (or patches aria-pressed) when it changes
 * @param {{placement?: 'strip'|'rail', nav?: boolean}} [opts]  `rail` (default, D-073): a column at the right edge, hidden at rest, revealed by the pointer over the edge zone or by keyboard
 *   focus; `strip`: a bar at the top right with the same reveal (the other layout offered to the user, kept in engine/chrome/options.html); written as data-placement.
 *   `nav` (WP-59, D-142; the student page sets it): two more segments under the three display controls, the "always show" pin (aria-pressed = state.pinned,
 *   written on the root as data-pinned) and the Back / Next pair (actions, not toggles: no aria-pressed). Without it the element is the WP-12b one (the
 *   options page and the site's copy of the rail, D-140, use that)
 * @returns {HTMLElement}
 */
export function buildStudentControls(doc, state, opts = {}) {
  const t = createT(state.lang);
  const root = h(doc, 'div', { class: 'savo-controls', role: 'group', 'aria-label': t('controls.label'), 'data-placement': opts.placement ?? 'rail',
    'data-pinned': opts.nav ? String(state.pinned === true) : undefined });

  /** @param {string} action @param {string} value @param {boolean} pressed @param {string} label @param {Lang} [lang] @param {string} [extra] */
  const button = (action, value, pressed, label, lang, extra) =>
    h(doc, 'button', { type: 'button', class: extra ? `savo-btn ${extra}` : 'savo-btn', 'data-action': action, 'data-value': value, 'aria-pressed': String(pressed), 'aria-label': label, title: label, lang });

  const langSeg = h(doc, 'div', { class: 'savo-seg', role: 'group', 'aria-label': t('lang.label') });
  for (const code of /** @type {Lang[]} */ (['en', 'tr'])) {
    const b = button('lang', code, state.lang === code, t(`lang.${code}`), code);
    b.appendChild(h(doc, 'span', { class: 'savo-btn-text', 'aria-hidden': 'true' }, code.toUpperCase()));
    langSeg.appendChild(b);
  }
  const themeSeg = h(doc, 'div', { class: 'savo-seg', role: 'group', 'aria-label': t('theme.label') });
  for (const name of ['light', 'dark']) {
    const b = button('theme', name, state.theme === name, t(`theme.${name}`));
    b.appendChild(icon(doc, name));
    themeSeg.appendChild(b);
  }
  const cues = button('cues', 'toggle', state.cues, t('cues.label'), undefined, 'savo-btn-cues');
  cues.setAttribute('title', `${t('cues.label')}: ${t('cues.hint')}`);
  cues.appendChild(icon(doc, 'cues'));
  const cuesSeg = h(doc, 'div', { class: 'savo-seg' });
  cuesSeg.appendChild(cues);

  // root = the hit zone and the place (engine/css/controls.css); panel = what is drawn and revealed (D-073: hidden at rest)
  const panel = h(doc, 'div', { class: 'savo-panel' });
  panel.append(langSeg, themeSeg, cuesSeg);
  if (opts.nav) {
    const pin = button('pin', 'toggle', state.pinned === true, t('pin.label'), undefined, 'savo-btn-pin');
    pin.setAttribute('title', `${t('pin.label')}: ${t('pin.hint')}`);
    pin.appendChild(icon(doc, 'pin'));
    const pinSeg = h(doc, 'div', { class: 'savo-seg' });
    pinSeg.appendChild(pin);
    // the pair the user asked for under the display controls (D-142): last in the column, so in the row under a phone's slide it is the right-hand end
    const navSeg = h(doc, 'div', { class: 'savo-seg savo-seg-nav', role: 'group', 'aria-label': t('nav.label') });
    for (const value of /** @type {const} */ (['back', 'next'])) {
      const b = h(doc, 'button', { type: 'button', class: 'savo-btn', 'data-action': 'nav', 'data-value': value, 'aria-label': t(`nav.${value}`), title: t(`nav.${value}`) });
      b.appendChild(icon(doc, value));
      navSeg.appendChild(b);
    }
    panel.append(pinSeg, navSeg);
  }
  root.appendChild(panel);
  return root;
}

/**
 * WP-59 (D-142): the one-time hint of a touch screen: the two tap zones of core/touch.js (the left 30 % goes back, the rest goes on) and a word on
 * swiping. Decorative for assistive technology (the Back / Next buttons are the accessible way); the behaviour (when it shows, how it goes) is
 * core/student-controls.js, the look engine/css/controls.css.
 * @param {Document} doc @param {Lang} lang @returns {HTMLElement}
 */
export function buildTouchHint(doc, lang) {
  const t = createT(lang);
  const root = h(doc, 'div', { class: 'savo-hint', 'aria-hidden': 'true' });
  const back = h(doc, 'div', { class: 'savo-hint-zone', 'data-zone': 'back' });
  back.append(icon(doc, 'back'), h(doc, 'span', { class: 'savo-hint-text' }, t('hint.back')));
  const next = h(doc, 'div', { class: 'savo-hint-zone', 'data-zone': 'next' });
  next.append(icon(doc, 'next'), h(doc, 'span', { class: 'savo-hint-text' }, t('hint.next')), h(doc, 'span', { class: 'savo-hint-small' }, t('hint.swipe')));
  root.append(back, next);
  return root;
}
