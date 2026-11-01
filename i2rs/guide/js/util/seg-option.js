// @ts-check
// WP-133: one choice of a segmented control (`.miniseg`), read from the tuple the page hands the builder.
//
// The tuple is `[value, label, tip?, flags?]`. `flags.fault` marks a choice that IS a named mistake (the item-mean centring: "item mean
// (fault)"): the button carries `is-fault` for as long as it exists and the stylesheet pulses it red ONLY while it is the pressed choice
// (`.miniseg button.is-fault.active`), so the lesson's one deliberate error cannot be selected without the room seeing it. The summary chip and
// the pitfall band keep their own static red - the pulse is the button's alone (instructor's decision 2026-10-10).
// Pure and shared by the two builders (components/param-form.js, pages/atlas-page.js), so tests/app/js/seg_option_check.mjs can pin it under node.

/**
 * @typedef {{ fault?: boolean }} SegFlags
 * @typedef {[string, string, (string | undefined)?, (SegFlags | undefined)?]} SegEntry
 */

/**
 * @param {SegEntry | [string, string]} entry value, label, tip, flags
 * @returns {{ value: string, label: string, tip: string, fault: boolean }} `tip` is "" when the choice has none
 */
export function segOption(entry) {
  const [value, label, tip, flags] = /** @type {SegEntry} */ (entry);
  return { value, label, tip: tip || "", fault: Boolean(flags && flags.fault) };
}
