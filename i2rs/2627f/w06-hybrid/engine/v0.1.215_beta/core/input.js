// @ts-check
// WP-09: keyboard mapping (plan section 3.3 input guards). Pure: a key event becomes a command or null, so the mapping is
// tested with plain `node --test`. There is NO click-to-advance anywhere in the engine.
//
//   next   ArrowRight, ArrowDown, PageDown, Space          Shift+ArrowRight = the same command with force (D-027: cut and go)
//   back   ArrowLeft, ArrowUp, PageUp, Shift+Space
//   first  Home          last  End
//   presenter windows only ({presenter: true}; a student page leaves these keys alone):
//   next   Enter, N        back  Backspace, P        blackout  B, "."
// Ignored: auto-repeat (holding a key must not run the deck), Ctrl/Alt/Meta combinations (browser shortcuts), an event that
// somebody already handled, any key typed into an editable element (the console's notes field, plan section 3.3), and Space,
// Enter and Backspace on a focused button or link (Space and Enter activate that control; a second meaning would press "next"
// behind its back).
//
// WP-10 (presentation remotes): a clicker is a keyboard that sends keys. Sources of this list (engine/README.md "Keys" has the
// detail and what is unverified): PowerPoint's published slide-show shortcuts, read 2026-10-22 (next: N, Enter, PageDown, Right,
// Down, Space; previous: P, PageUp, Left, Up, Backspace; black screen: B and "."), and a third-party test of the Logitech R400
// (left = PageUp, right = PageDown, blank screen = ".", play = F5 then Esc). PowerPoint's W / "," (white screen) is not a v1
// feature (D-029 names blackout only). F5 and Esc are deliberately NOT mapped: F5 reloads the page like anywhere else (the
// console survives that, WP-10) and Esc is not destructive.

const EDITABLE_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);
const ACTIVATABLE_TAGS = new Set(['BUTTON', 'A', 'SUMMARY']);
const ACTIVATABLE_ROLES = new Set(['button', 'link', 'tab', 'menuitem', 'switch', 'checkbox', 'radio']);

/** @param {any} target @returns {boolean} */
export function isEditable(target) {
  return !!target && (EDITABLE_TAGS.has(String(target.tagName ?? '').toUpperCase()) || target.isContentEditable === true);
}
/** A control that Space or Enter activates. @param {any} target @returns {boolean} */
export function isActivatable(target) {
  if (!target) return false;
  if (ACTIVATABLE_TAGS.has(String(target.tagName ?? '').toUpperCase())) return true;
  const role = typeof target.getAttribute === 'function' ? target.getAttribute('role') : null;
  return role !== null && ACTIVATABLE_ROLES.has(role);
}

/**
 * @param {{key: string, shiftKey?: boolean, ctrlKey?: boolean, altKey?: boolean, metaKey?: boolean, repeat?: boolean, defaultPrevented?: boolean, target?: any}} e
 * @param {{presenter?: boolean}} [o]  presenter: the console and audience windows (adds the blackout keys)
 * @returns {{cmd: 'next'|'back'|'first'|'last'|'blackout', force: boolean}|null}
 */
export function keyToCommand(e, { presenter = false } = {}) {
  if (e.defaultPrevented || e.repeat || e.ctrlKey || e.altKey || e.metaKey || isEditable(e.target)) return null;
  const shift = e.shiftKey === true;
  const next = { cmd: /** @type {const} */ ('next'), force: false }, back = { cmd: /** @type {const} */ ('back'), force: false };
  switch (e.key) {
    case 'ArrowRight': return { cmd: 'next', force: shift };
    case 'ArrowDown': case 'PageDown': return shift ? null : next;
    case ' ': case 'Spacebar':
      if (isActivatable(e.target)) return null;
      return shift ? back : next;
    case 'ArrowLeft': case 'ArrowUp': case 'PageUp': return shift ? null : back;
    case 'Home': return shift ? null : { cmd: 'first', force: false };
    case 'End': return shift ? null : { cmd: 'last', force: false };
    case 'Enter': return presenter && !shift && !isActivatable(e.target) ? next : null;
    case 'Backspace': return presenter && !shift && !isActivatable(e.target) ? back : null;
    case 'n': case 'N': return presenter ? next : null;
    case 'p': case 'P': return presenter ? back : null;
    case 'b': case 'B': case '.': return presenter ? { cmd: 'blackout', force: false } : null;
    default: return null;
  }
}

/**
 * Attach the mapping to a player. Returns the function that detaches it. With a `blackout` handler the target is a presenter
 * window and B and "." work; without one (the student page) they are not keys of the deck.
 * @param {EventTarget} target
 * @param {{next: (o?: {force?: boolean}) => unknown, prev: () => unknown, first: () => unknown, last: () => unknown}} player
 * @param {{blackout?: () => unknown}} [extra]
 */
export function bindKeys(target, player, extra = {}) {
  const presenter = typeof extra.blackout === 'function';
  /** @param {Event} ev */
  const onKey = (ev) => {
    const e = /** @type {KeyboardEvent} */ (ev);
    const c = keyToCommand(e, { presenter });
    if (!c) return;
    e.preventDefault();                                                 // Space and the Page keys would scroll otherwise
    if (c.cmd === 'next') player.next({ force: c.force });
    else if (c.cmd === 'back') player.prev();
    else if (c.cmd === 'first') player.first();
    else if (c.cmd === 'last') player.last();
    else extra.blackout?.();
  };
  target.addEventListener('keydown', onKey);
  return () => target.removeEventListener('keydown', onKey);
}
