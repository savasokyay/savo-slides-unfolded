// @ts-check
// WP-95: the "i" next to a panel or chart title. It is the app's one help button - app.css `.help-tip`, first built
// for the RS-tree board's bottom-right corner (WP-82): a small circle with an italic "i" and a navy CSS bubble whose
// text is `data-tip`, shown on hover and on keyboard focus (WP-95 8a: no separate button style of its own).
// Only the bubble's side differs: next to a title it opens downwards and to the right; `place()` flips it to the
// left / upwards when it would leave the viewport. A click on the button never reaches the panel header it sits in
// (a header click folds the panel); Escape on the focused button closes the bubble.

const BUBBLE_W = 260; // app.css `.help-tip::after` width (it is also capped at 70vw)
const BUBBLE_LINE_PX = 17; // 12 px text at a line height of 1.4
const BUBBLE_CHARS = 38; // characters per line of its 240 px text column (an estimate - the bubble is a pseudo-element)

/**
 * @param {string} text the explanation (already translated)
 * @param {string} [label] accessible name of the button (already translated)
 * @param {string} [heading] WP-93b: a first line of the bubble (a title for a button that stands alone, with no
 *   title text beside it); the accessible name still reads `label: text`, the heading is not read twice
 * @returns {HTMLElement}
 */
export function infoTip(text, label = "Info", heading = "") {
  const shownText = heading ? `${heading}\n${text}` : text;
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "help-tip tip-down tip-right";
  btn.textContent = "i";
  btn.dataset.tip = shownText;
  btn.setAttribute("aria-label", `${label}: ${text}`);

  /** the bubble is not measurable (a pseudo-element): keep it in the viewport from the button's place and an estimate of its height */
  const place = () => {
    const r = btn.getBoundingClientRect();
    const width = Math.min(BUBBLE_W, window.innerWidth * 0.7);
    btn.classList.toggle("tip-right", r.left + width <= window.innerWidth - 8);
    const lines = Math.ceil(text.length / BUBBLE_CHARS) + (shownText.match(/\n/g)?.length ?? 0);
    const height = lines * BUBBLE_LINE_PX + 16;
    const fitsBelow = r.bottom + 8 + height <= window.innerHeight;
    const fitsAbove = r.top - 8 - height >= 0;
    btn.classList.toggle("tip-down", fitsBelow || !fitsAbove);
  };
  btn.addEventListener("mouseenter", place);
  btn.addEventListener("focus", place);
  btn.addEventListener("click", (e) => e.stopPropagation()); // not a click on the panel header (that folds the panel)
  btn.addEventListener("keydown", (e) => {
    e.stopPropagation(); // Enter / Space on the button must not fold the panel
    if (e.key === "Escape") btn.blur();
  });
  return btn;
}
