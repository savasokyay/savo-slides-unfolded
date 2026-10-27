// @ts-check
// WP-168c: the "i" whose bubble is a small page - bold headings, paragraphs, lists - for an explanation that is longer than one column of plain text (the neural network diagram's guide:
// how to read it, how to present it, how the advanced versions differ). The app's plain help bubble (`.help-tip`, util/info-tip.js) is a pseudo-element of 260 px width that cannot
// scroll, and a 2 k-character text ran 70 - 180 px past the bottom of the window; this one is a real element (`.rich-tip`, mf.css) placed by util/bubble-place.js inside the window, as
// tall as the room there is, with its own scroll. The text is an i18n string in the line format of util/rich-text.js. It opens on hover and on keyboard focus, STAYS open while the
// pointer is on it (so that it can be scrolled), a click pins it (click again, Escape or a click elsewhere closes it), and its size follows the page's root font size (presenting mode).
// The button is the app's `.help-tip` look; its own pseudo-element bubble is switched off (mf.css `.rich-tip-btn::after`).

import { placeBubble } from "../util/bubble-place.js";
import { parseRichText } from "../util/rich-text.js";

let counter = 0;

/**
 * @param {import("../util/rich-text.js").Part[]} parts
 * @param {HTMLElement} into
 */
function appendParts(parts, into) {
  for (const part of parts) {
    if (part.strong) {
      const strong = document.createElement("strong");
      strong.textContent = part.text;
      into.appendChild(strong);
    } else into.appendChild(document.createTextNode(part.text));
  }
}

/**
 * @param {string} text the explanation, already translated (the line format of util/rich-text.js)
 * @param {string} label accessible name of the button, already translated
 * @returns {HTMLElement} the element to put where the "i" goes (the button and its bubble)
 */
export function richInfoTip(text, label) {
  const id = `rich-tip-${++counter}`;
  const wrap = document.createElement("span");
  wrap.className = "rich-tip-wrap";
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "help-tip rich-tip-btn";
  btn.textContent = "i";
  btn.setAttribute("aria-label", label);
  btn.setAttribute("aria-describedby", id);
  btn.setAttribute("aria-expanded", "false");
  const pop = document.createElement("div");
  pop.className = "rich-tip";
  pop.id = id;
  pop.setAttribute("role", "tooltip");
  pop.tabIndex = -1; // reachable by script (a click on it), not a tab stop
  pop.hidden = true;
  for (const block of parseRichText(text)) {
    if (block.type === "h") {
      const head = document.createElement("div");
      head.className = "rich-tip-head";
      appendParts(block.parts, head);
      pop.appendChild(head);
    } else if (block.type === "p") {
      const p = document.createElement("p");
      appendParts(block.parts, p);
      pop.appendChild(p);
    } else {
      const list = document.createElement(block.type);
      for (const item of block.items) {
        const li = document.createElement("li");
        appendParts(item, li);
        list.appendChild(li);
      }
      pop.appendChild(list);
    }
  }
  wrap.append(btn, pop);

  let pinned = false;
  /** @type {number} */
  let closeTimer = 0;

  /** put the bubble where it fits: its natural height is measured first (hidden), then it is placed and capped at the room there is */
  function place() {
    pop.style.visibility = "hidden";
    pop.style.maxHeight = "none";
    const size = pop.getBoundingClientRect();
    const at = placeBubble({ anchor: btn.getBoundingClientRect(), vw: window.innerWidth, vh: window.innerHeight, width: size.width, height: size.height, align: "start" });
    pop.style.left = `${at.left}px`;
    pop.style.top = `${at.top}px`;
    pop.style.maxHeight = `${at.maxHeight}px`;
    pop.style.visibility = "visible";
  }
  function open() {
    window.clearTimeout(closeTimer);
    if (!pop.hidden) return;
    pop.hidden = false;
    btn.setAttribute("aria-expanded", "true");
    place();
  }
  function close() {
    window.clearTimeout(closeTimer);
    pinned = false;
    pop.hidden = true;
    btn.setAttribute("aria-expanded", "false");
  }
  function closeSoon() {
    window.clearTimeout(closeTimer);
    if (pinned) return;
    closeTimer = window.setTimeout(close, 180); // long enough to cross the gap between the button and the bubble
  }

  btn.addEventListener("mouseenter", open);
  btn.addEventListener("mouseleave", closeSoon);
  btn.addEventListener("focus", open);
  btn.addEventListener("blur", closeSoon);
  pop.addEventListener("mouseenter", () => window.clearTimeout(closeTimer));
  pop.addEventListener("mouseleave", closeSoon);
  btn.addEventListener("click", (e) => {
    e.stopPropagation(); // not a click on the panel head (that folds the panel)
    if (pinned) close();
    else {
      pinned = true;
      open();
    }
  });
  btn.addEventListener("keydown", (e) => {
    e.stopPropagation(); // Enter / Space on the button must not fold the panel
    if (e.key === "Escape") close();
  });
  pop.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
  });
  // a click elsewhere un-pins; the bubble follows the window (it is `position: fixed`). These two listeners belong to the window, so they take themselves away once the page has
  // dropped the button (the page is mounted again for every route change that rebuilds its head).
  let attached = false;
  /** @param {PointerEvent} e */
  const onDown = (e) => {
    if (!alive()) return;
    if (pinned && !wrap.contains(/** @type {Node} */ (e.target))) close();
  };
  const onResize = () => {
    if (alive() && !pop.hidden) place();
  };
  function alive() {
    if (wrap.isConnected) {
      attached = true;
      return true;
    }
    if (attached) {
      document.removeEventListener("pointerdown", onDown);
      window.removeEventListener("resize", onResize);
    }
    return false;
  }
  document.addEventListener("pointerdown", onDown);
  window.addEventListener("resize", onResize);
  return wrap;
}
