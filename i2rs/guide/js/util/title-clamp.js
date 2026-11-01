// @ts-check
// WP-135: a film title that does not fit its room is clamped in the NAME only; the "(Year)" is always the last thing written: "A Very Long Name … (1970)",
// never "A Very Long Name (19…". The title's last parenthesis holds the year (a title may carry other ones: "Film (Part 2) (1999)" has the year last).
// This module only decides WHERE the title splits; the clamp itself is CSS where the room is a layout box (the name is a shrinking, ellipsised span, the
// year a span that does not shrink: trace.css `.heat-title-name` / `.heat-title-year`), so it needs no measuring. The full title stays in the `title`
// attribute of whatever shows it. Pure, so tests/app/js/title_clamp_check.mjs can pin the rule under node.

/**
 * The name and the year of a "<name> (YYYY)" title: the year is the LAST parenthesis when it holds exactly four digits and is separated from a non-empty
 * name by white space. Any other title - no year, a parenthesis that is not a year ("(TV)", "(2001-2005)", "(12345)"), a year with no name - has no year and
 * is all name (a plain clamp applies to it).
 * @param {string | null | undefined} label
 * @returns {{ name: string, year: string | null }} `year` includes its parentheses, e.g. "(1999)"
 */
export function splitTitle(label) {
  const text = String(label ?? "").trim();
  const found = /^(.*\S)\s+(\(\d{4}\))$/.exec(text);
  return found ? { name: found[1], year: found[2] } : { name: text, year: null };
}

/**
 * Write a film title into `el` as the two spans the clamp needs: the NAME (`.heat-title-name`: it shrinks and ends in an ellipsis when the room is short)
 * and, when the title ends in a year, the YEAR (`.heat-title-year`: it never shrinks), with a space between them (a flex container does not render it, but
 * the text a reader copies is the title). `el` gets the class `title-clamp` (trace.css: a flex box that may shrink). A title without a year is the
 * name alone - a plain clamp. The caller sets the `title` (the full title) - this only fills the text.
 * @param {HTMLElement} el
 * @param {string | null | undefined} label
 * @returns {HTMLElement} `el`
 */
export function fillClampedTitle(el, label) {
  const { name, year } = splitTitle(label);
  el.classList.add("title-clamp");
  el.textContent = "";
  const nameEl = document.createElement("span");
  nameEl.className = "heat-title-name";
  nameEl.textContent = name;
  el.appendChild(nameEl);
  if (year) {
    const yearEl = document.createElement("span");
    yearEl.className = "heat-title-year";
    yearEl.textContent = year;
    el.append(" ", yearEl);
  }
  return el;
}
