// @ts-check
// WP-09: URL <-> state. Address `#/<slide-id>/<step>` plus `?lang=&theme=` (plan section 3.2). Pure parse/format
// functions first (tested with node --test), then a thin DOM binding.
//
// Slide ids are short lowercase slugs (the same rule the build enforces), never numbers, so inserting a slide does not
// break old links. Steps count from 0 (0 = the slide as it appears, deck JSON contract section 7). A link that cannot be
// read exactly is reported in `problems` instead of being silently rewritten; the caller decides what to show.

export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const STEP_DIGITS_MAX = 4;                      // steps beyond 9999 are not real: such a link is rejected, not clamped here
const PARAM_RE = /^[A-Za-z0-9_-]{1,16}$/;

/**
 * @typedef {object} Route
 * @property {string|null} slideId  null when the link names no slide
 * @property {number} step
 * @property {string|null} lang
 * @property {string|null} theme
 * @property {string|null} mode     'mirror' for the console preview iframe (plan section 3.3)
 * @property {Array<[string, string]>} extra  unknown parameters, sorted by key, kept so a rewrite does not drop them
 * @property {Array<{code: string, value: string}>} problems
 */

/**
 * Parse a location. `hash` includes the leading '#', `search` the leading '?'.
 * @param {{hash?: string, search?: string}} loc
 * @returns {Route}
 */
export function parseLocation({ hash = '', search = '' } = {}) {
  /** @type {Route['problems']} */
  const problems = [];
  let slideId = null, step = 0;
  const h = hash.startsWith('#') ? hash.slice(1) : hash;
  if (h !== '' && h !== '/') {
    if (!h.startsWith('/')) problems.push({ code: 'bad-route', value: h });
    else if (h.includes('?')) problems.push({ code: 'query-in-hash', value: h });
    else {
      const parts = h.slice(1).split('/');
      if (parts.length > 1 && parts[parts.length - 1] === '') parts.pop();            // a trailing slash is harmless
      if (parts.length > 2) problems.push({ code: 'extra-segments', value: h });
      if (SLUG_RE.test(parts[0])) {
        slideId = parts[0];
        const s = parts[1];
        if (s !== undefined && s !== '') {
          if (/^\d+$/.test(s) && s.length <= STEP_DIGITS_MAX) {
            step = Number(s);
            if (String(step) !== s) problems.push({ code: 'noncanonical-step', value: s });   // 007 reads as 7 but is flagged
          } else problems.push({ code: 'bad-step', value: s });
        }
      } else problems.push({ code: 'bad-slide-id', value: parts[0] });
    }
  }
  const q = new URLSearchParams(search);
  /** @param {string} key */
  const param = (key) => {
    const v = q.get(key);
    if (v === null) return null;
    if (!PARAM_RE.test(v)) { problems.push({ code: 'bad-param', value: `${key}=${v}` }); return null; }
    return v;
  };
  const lang = param('lang'), theme = param('theme'), mode = param('mode');
  /** @type {Array<[string, string]>} */
  const extra = [];
  for (const [k, v] of q) if (k !== 'lang' && k !== 'theme' && k !== 'mode') extra.push([k, v]);
  extra.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  return { slideId, step, lang, theme, mode, extra, problems };
}

/**
 * Canonical location of a state: always `#/<id>/<step>` (step 0 included), parameters in the fixed order lang, theme,
 * mode, then the extras sorted by key.
 * @param {{slideId: string|null, step?: number, lang?: string|null, theme?: string|null, mode?: string|null, extra?: Array<[string, string]>}} s
 * @returns {{hash: string, search: string}}
 */
export function formatLocation({ slideId, step = 0, lang = null, theme = null, mode = null, extra = [] }) {
  if (slideId !== null && !SLUG_RE.test(slideId)) throw new RangeError(`slide id is not a lowercase slug: ${slideId}`);
  if (!Number.isInteger(step) || step < 0) throw new RangeError(`step must be a non-negative integer: ${step}`);
  const q = new URLSearchParams();
  if (lang) q.set('lang', lang);
  if (theme) q.set('theme', theme);
  if (mode) q.set('mode', mode);
  for (const [k, v] of [...extra].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))) q.append(k, v);
  const qs = q.toString();
  return { hash: slideId === null ? '' : `#/${slideId}/${step}`, search: qs ? `?${qs}` : '' };
}

/** Parse then format: the canonical spelling of whatever was typed. */
export const canonicalize = (loc) => formatLocation(parseLocation(loc));

/**
 * DOM binding. `navigate` uses the History API (pushState/replaceState), which fires no hashchange, so the callback
 * only runs for changes the player did not make itself: Back/Forward and a hand-edited address.
 * @param {{window?: Window, onChange: (route: Route, source: string) => void}} o
 */
export function createRouter({ window: win = globalThis.window, onChange }) {
  let lastHref = win.location.href;
  const read = () => parseLocation({ hash: win.location.hash, search: win.location.search });
  const handle = (source) => () => {
    if (win.location.href === lastHref) return;           // hashchange and popstate both fire for one hash navigation
    lastHref = win.location.href;
    onChange(read(), source);
  };
  const onHash = handle('hashchange'), onPop = handle('popstate');
  win.addEventListener('hashchange', onHash);
  win.addEventListener('popstate', onPop);
  return {
    current: read,
    /** @param {Parameters<typeof formatLocation>[0]} state @param {{replace?: boolean}} [opts] */
    navigate(state, { replace = false } = {}) {
      const { hash, search } = formatLocation(state);
      const url = win.location.pathname + search + hash;
      win.history[replace ? 'replaceState' : 'pushState'](null, '', url);
      lastHref = win.location.href;
    },
    destroy() { win.removeEventListener('hashchange', onHash); win.removeEventListener('popstate', onPop); },
  };
}
