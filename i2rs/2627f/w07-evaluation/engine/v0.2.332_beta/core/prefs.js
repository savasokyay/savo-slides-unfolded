// @ts-check
// WP-12c: what the student page remembers of its reader's display choices (D-073: language, theme and the non-colour cues of D-068), in localStorage.
//   - The key carries the deck id (`savo:<deck>:prefs`), so one deck's choices never touch another's, and the value carries a version.
//   - Only what the reader CHOSE is stored (the buttons write; the page does not write at load), so a deck whose default theme changes later
//     still reaches everyone who never touched the button.
//   - Every access is in try/catch (a private window, blocked site data and a full quota all throw somewhere: the accessor, getItem or setItem): when storage
//     cannot be used the page runs on the defaults and the address, as if nothing had been remembered.
//   - What comes back is checked against the deck (a language it does not have, a theme that is not one) and anything else is dropped, so a stale or hand-edited
//     value cannot put the page in a state the deck does not know.
//   - The address wins over memory: `?lang=`, `?theme=` and `?cues=on|off` are the reader's explicit choice of THIS link (initialView).
//   - WP-59 (D-142): two more of the reader's own acts, with no address of their own: `pin` (the "always show" button of the controls) and `hint` (true once the
//     one-time touch hint was dismissed). Optional keys of the same version: an older page drops them, as it drops anything it does not know.
// The console keeps its own state in sessionStorage (per tab, presenter/console.js); the audience window follows the console and remembers nothing.
import { THEMES } from './deck.js';

export const PREFS_VERSION = 1;
/** @param {string} deckId */
export const prefsKey = (deckId) => `savo:${deckId}:prefs`;

/** @typedef {{lang?: string, theme?: string, cues?: boolean, pin?: boolean, hint?: boolean}} Prefs */

/**
 * The valid part of a stored value.
 * @param {unknown} raw the stored text (or an already parsed object) @param {{langs: string[]}} deck
 * @returns {Prefs}
 */
export function parsePrefs(raw, deck) {
  if (raw === null || raw === undefined) return {};
  let o = raw;
  if (typeof raw === 'string') { try { o = JSON.parse(raw); } catch (e) { return {}; } }
  if (!o || typeof o !== 'object' || Array.isArray(o) || /** @type {any} */ (o).v !== PREFS_VERSION) return {};
  const p = /** @type {any} */ (o);
  /** @type {Prefs} */
  const out = {};
  if (typeof p.lang === 'string' && deck.langs.includes(p.lang)) out.lang = p.lang;
  if (typeof p.theme === 'string' && THEMES.includes(p.theme)) out.theme = p.theme;
  if (typeof p.cues === 'boolean') out.cues = p.cues;
  if (typeof p.pin === 'boolean') out.pin = p.pin;
  if (p.hint === true) out.hint = true;
  return out;
}

/**
 * The view the page starts in: the address first, then what the reader chose before, then the deck's defaults. `from` says where each value came from.
 * @param {{langs: string[], defaultLang: string, chrome: {theme_default: string}}} deck @param {URLSearchParams} params the query of the address
 * @param {{lang?: string, theme?: string, cues?: boolean}} saved
 * @returns {{lang: string, theme: string, cues: boolean, from: {lang: 'address'|'saved'|'default', theme: 'address'|'saved'|'default', cues: 'address'|'saved'|'default'}}}
 */
export function initialView(deck, params, saved) {
  const urlLang = params.get('lang'), urlTheme = params.get('theme'), urlCues = params.get('cues');
  const lang = urlLang && deck.langs.includes(urlLang) ? { v: urlLang, from: /** @type {const} */ ('address') } : saved.lang !== undefined ? { v: saved.lang, from: /** @type {const} */ ('saved') } : { v: deck.defaultLang, from: /** @type {const} */ ('default') };
  const theme = urlTheme && THEMES.includes(urlTheme) ? { v: urlTheme, from: /** @type {const} */ ('address') } : saved.theme !== undefined ? { v: saved.theme, from: /** @type {const} */ ('saved') } : { v: deck.chrome.theme_default, from: /** @type {const} */ ('default') };
  const cues = urlCues === 'on' || urlCues === 'off' ? { v: urlCues === 'on', from: /** @type {const} */ ('address') } : saved.cues !== undefined ? { v: saved.cues, from: /** @type {const} */ ('saved') } : { v: false, from: /** @type {const} */ ('default') };
  return { lang: lang.v, theme: theme.v, cues: cues.v, from: { lang: lang.from, theme: theme.from, cues: cues.from } };
}

/**
 * The store of one deck on one window.
 * @param {{localStorage?: Storage}} win @param {{id: string, langs: string[]}} deck
 * @returns {{key: string, read: () => Prefs, write: (patch: Prefs) => boolean}}
 */
export function createPrefs(win, deck) {
  const key = prefsKey(deck.id);
  /** @returns {Storage|null} */
  const store = () => { try { return win.localStorage ?? null; } catch (e) { return null; } };
  /** `ok` is false when storage could not be READ at all: a write would then overwrite choices it could not see. */
  const load = () => { try { const s = store(); return s ? { ok: true, prefs: parsePrefs(s.getItem(key), deck) } : { ok: false, prefs: {} }; } catch (e) { return { ok: false, prefs: {} }; } };
  const read = () => load().prefs;
  /** Merge a choice into what is stored. Returns false when storage could not be read or written: the choice then lasts until the page is closed. */
  const write = (/** @type {Prefs} */ patch) => {
    try {
      const s = store(), cur = load();
      if (!s || !cur.ok) return false;
      const next = parsePrefs({ v: PREFS_VERSION, ...cur.prefs, ...patch }, deck);     // never store what the next read would drop
      s.setItem(key, JSON.stringify({ v: PREFS_VERSION, ...next }));
      return true;
    } catch (e) { return false; }
  };
  return { key, read, write };
}
