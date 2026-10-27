// @ts-check
// WP-104: the ONE open search-result list. An EntityPicker's list opens on focus, on typing and on a filter-chip
// click; before this helper it closed only when its own input lost focus, so a list opened by a chip click (focus on
// the chip, then on <body> once the chip was redrawn) stayed open for good - over other panels, next to the other
// picker's list, while keys were pressed elsewhere. Now at most one list is open (opening one closes the previous),
// and a pointer press / focus move OUTSIDE the open list's picker, or Escape, closes it. The helper is plain logic
// (no DOM calls but `owner.contains(target)`), so it is checked under node with stand-in nodes
// (tests/app/js/open_list_check.mjs); entity-picker.js wires it to the document once.

/**
 * @typedef {{ contains: (other: any) => boolean }} Owner an element that may contain the event target
 */

/**
 * @returns {{
 *   claim: (owner: Owner, close: () => void) => void,
 *   release: (owner: Owner) => void,
 *   dismissOutside: (target: any) => boolean,
 *   dismiss: () => boolean,
 *   current: () => Owner | null,
 * }}
 */
export function createOpenList() {
  /** @type {{ owner: Owner, close: () => void } | null} */
  let open = null;

  /** close and forget the open list; true when there was one */
  function closeOpen() {
    if (!open) return false;
    const { close } = open;
    open = null; // forget first: `close` calls back into release()
    close();
    return true;
  }

  return {
    /** `owner` opened its list: any OTHER open list closes first */
    claim(owner, close) {
      if (open && open.owner !== owner) closeOpen();
      open = { owner, close };
    },
    /** `owner` closed its own list (a no-op for anyone but the open list's owner) */
    release(owner) {
      if (open && open.owner === owner) open = null;
    },
    /** a pointer press or a focus move landed on `target`: close the open list unless the target is inside its owner */
    dismissOutside(target) {
      if (!open) return false;
      if (target && open.owner.contains(target)) return false;
      return closeOpen();
    },
    /** Escape: close the open list wherever the focus is */
    dismiss() {
      return closeOpen();
    },
    current() {
      return open ? open.owner : null;
    },
  };
}
