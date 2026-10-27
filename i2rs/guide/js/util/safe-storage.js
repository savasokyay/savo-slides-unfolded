// @ts-check
// WP-107 (g): `window.localStorage`, or nothing. Merely reading the property throws in a private window or with site data blocked, and
// a page must render correctly without it: a reader's choice (the formula's text size, the Formula | Code divider) is a convenience,
// never state anything else depends on. The users of this (util/zoom-steps.js, util/split-ratio.js) catch the errors of getItem /
// setItem themselves; this only keeps the property access from throwing.

/** @returns {Storage | null} */
export function browserStorage() {
  try {
    return typeof window === "undefined" ? null : (window.localStorage ?? null);
  } catch {
    return null;
  }
}
