// @ts-check
// WP-192: the switch beside "Random pick" - the disk icon (docs/plans/2610171557-precomputed-walks-design.md). WP-196: it is a toggle button (`aria-pressed`) on the SAME line as the pick - it was a
// tick box with its words on a second line, which made the title row 16 px taller; the words are its accessible name, the state is its look (faint off, filled on).
// WP-203: with the switch ON, Random pick goes THROUGH the walks saved for the page and task, one after another (the order, the counter "i/N" and the form each walk writes are util/saved-walks.js),
// instead of drawing among the walks of the form as it stands. This file is the element and the state around the logic:
//   - two questions, each asked once per distinct question and kept: the inventory (`/api/trace/precomputed/forms`: every saved form with its walks; asked per page, task and method) and the
//     exact one (`/api/trace/precomputed`: the walks of the form on screen; asked per form - it finds the form on screen when a deep link spells it another way, and it is all an older server
//     without the inventory can answer). A failed question is an EMPTY answer (null), never an error;
//   - the walk-through's state (`cycle`): kept here, handed back to the page after every press and restored into the next element (a press that writes the model's kind rebuilds the page);
//   - the tip: what is on disk for this page and task - per form its fields, k, lambda, model kind and how many pairs (users) - a bubble that opens on hover and focus like the (i) bubbles,
//     as short as a scroll box needs not be (INVENTORY_ROWS rows, "+n more" after them, FIELDS_SHOWN fields a row, "+k" after them).
// The state of the switch is remembered per page in localStorage. Content-based page only.

import { placeBubble } from "../util/bubble-place.js";
import { counterNow, counterText, formWasLoaded, inventoryOf, planWalks, pressWalk, readTick, savedForms, savedWalks, savedWalksKey, walkPatch, writeTick } from "../util/saved-walks.js";

/**
 * @param {{
 *   i18n: {t: (key: string, params?: Record<string, unknown>) => string},
 *   api: {precomputed: (query: Record<string, string>) => Promise<unknown>, precomputedForms?: (query: Record<string, string>) => Promise<unknown>},
 *   page: string,
 *   storage?: Storage | null,
 *   onChange?: () => void,
 *   cycle?: import("../util/saved-walks.js").WalkCycle | null,
 * }} opts `page` keys the remembered tick; `storage` is the browser's localStorage by default (a stub under node, none when the browser blocks it); `onChange` runs when the tick or an answer
 *   changes (the page re-syncs the pick button, the counter and the note); `cycle` is the walk-through of the element this one replaces (the page keeps it across a rebuild)
 */
export function createSavedWalks({ i18n, api, page, storage = defaultStorage(), onChange = () => {}, cycle: carried = null }) {
  const el = document.createElement("button");
  el.type = "button";
  el.className = "random-saved";
  const icon = document.createElement("span");
  icon.className = "random-saved-icon";
  icon.textContent = "\u{1F4BE}"; // the floppy disk: "saved"
  icon.setAttribute("aria-hidden", "true");
  el.append(icon);
  el.setAttribute("aria-label", i18n.t("picker.saved_only")); // the icon has no text: the words are the name; the state is aria-pressed
  // WP-203: the hover is a bubble with the inventory (below), not a native title: the title cannot hold a list
  const bubble = document.createElement("div");
  bubble.className = "rich-tip saved-inventory";
  bubble.id = `saved-inventory-${page}`;
  bubble.setAttribute("role", "tooltip");
  bubble.hidden = true;
  el.setAttribute("aria-describedby", bubble.id);
  let on = readTick(storage, page);
  const paint = () => el.setAttribute("aria-pressed", String(on));
  paint();

  /** WP-203: the walk-through in progress (null: none yet) @type {import("../util/saved-walks.js").WalkCycle | null} */
  let cycle = carried;
  /** WP-203: what the page last told us: the task, the walk-through's key (page, task and method) and the form and pair on screen @type {{task: string, key: string, route: import("../util/saved-walks.js").FormRoute}} */
  let now = { task: "predict", key: "", route: { params: {}, extras: false, u: null, i: null } };

  /**
   * One question: asked once per distinct query, its answer kept; the answer of an older question that comes late is dropped.
   * @param {(query: Record<string, string>) => Promise<unknown>} call
   */
  function makeAsk(call) {
    /** @type {string | null} */
    let asked = null;
    /** @type {unknown} `undefined`: not here yet */
    let answer = undefined;
    /** @type {Promise<unknown> | null} */
    let pending = null;
    let token = 0;
    return {
      /** @param {Record<string, string>} query */
      refresh(query) {
        const key = savedWalksKey(query);
        if (key === asked) return;
        asked = key;
        answer = undefined;
        const mine = ++token;
        /** @type {Promise<unknown>} */
        let asking;
        try {
          asking = Promise.resolve(call(query)); // (asked now, not a microtask later)
        } catch (error) {
          asking = Promise.reject(error);
        }
        pending = asking
          .then(
            (raw) => raw,
            () => null, // a failed question is an empty answer
          )
          .then((raw) => {
            if (mine === token) {
              answer = raw ?? null;
              onChange();
            }
            return answer;
          });
      },
      value: () => answer,
      loaded: () => answer !== undefined,
      wait: () => pending ?? Promise.resolve(),
    };
  }
  const forms = makeAsk((query) => (api.precomputedForms ? api.precomputedForms(query) : Promise.resolve(null)));
  const exact = makeAsk((query) => api.precomputed(query));

  /** @returns {boolean} whether both answers for the current questions are here */
  const loaded = () => forms.loaded() && exact.loaded();
  const plan = () =>
    planWalks({
      forms: savedForms(forms.value(), now.task), // null: no inventory (an older server, a failure): the exact answer stands in
      exact: savedWalks(exact.value(), now.task),
      route: now.route,
      key: now.key,
      cycle,
    });

  el.addEventListener("click", () => {
    on = !on;
    paint();
    writeTick(storage, page, on);
    if (on) cycle = null; // a walk-through begins when the switch is turned on (turning it off keeps what it wrote: the note stays true)
    onChange();
  });
  // WP-204: the icon keeps ONLY what is its own. It used to stop every key (WP-196: the player's window-level Space cancelled the button's press, so the icon swallowed Space - and with it
  // the arrows, Home / End and P, which then did nothing while the icon had the focus). The player now leaves Space to a focused button (components/trace-player.js spaceBelongsToControl):
  // Space and Enter press the icon (the browser's own activation), the other keys go on to the player, and Escape closes the bubble.
  el.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeBubble();
  });

  // -- the tip: the inventory ------------------------------------------------------------------------------------------------------------------------------------------------------
  /** @type {number} */
  let closeTimer = 0;
  function placeNow() {
    bubble.style.visibility = "hidden";
    bubble.style.maxHeight = "none";
    const size = bubble.getBoundingClientRect();
    const at = placeBubble({ anchor: el.getBoundingClientRect(), vw: window.innerWidth, vh: window.innerHeight, width: size.width, height: size.height, align: "start" });
    bubble.style.left = `${at.left}px`;
    bubble.style.top = `${at.top}px`;
    bubble.style.maxHeight = `${at.maxHeight}px`;
    bubble.style.visibility = "visible";
  }
  function openBubble() {
    window.clearTimeout(closeTimer);
    if (!bubble.hidden) return;
    paintInventory();
    bubble.hidden = false;
    placeNow();
  }
  function closeBubble() {
    window.clearTimeout(closeTimer);
    bubble.hidden = true;
  }
  function closeSoon() {
    window.clearTimeout(closeTimer);
    closeTimer = window.setTimeout(closeBubble, 180); // long enough to cross the gap between the icon and the bubble
  }
  el.addEventListener("mouseenter", openBubble);
  el.addEventListener("mouseleave", closeSoon);
  el.addEventListener("focus", openBubble);
  el.addEventListener("blur", closeSoon);
  bubble.addEventListener("mouseenter", () => window.clearTimeout(closeTimer));
  bubble.addEventListener("mouseleave", closeSoon);

  /** @param {string} name a field's id @returns {string} its name on the page's own Fields box (the id when the page has no word for it) */
  const fieldName = (name) => {
    const key = `params.field_${name}`;
    const text = i18n.t(key);
    return text === key ? name : text;
  };
  /**
   * @param {string} tag
   * @param {string} [text]
   * @param {string} [className]
   * @returns {HTMLElement}
   */
  function node(tag, text = "", className = "") {
    const made = document.createElement(tag);
    if (text) made.textContent = text;
    if (className) made.className = className;
    return made;
  }
  /** (re)draw the bubble's content: the words, then what is on disk for this page and task (the form on screen marked) */
  function paintInventory() {
    bubble.replaceChildren();
    bubble.append(node("div", i18n.t("picker.saved_only"), "saved-inv-head"), node("p", i18n.t("picker.saved_only_tip")));
    if (!loaded()) {
      bubble.append(node("p", i18n.t("picker.inv_loading"), "saved-inv-note"));
      return;
    }
    const { forms: known, now: here } = plan();
    const inv = inventoryOf(known, here);
    if (!inv.forms) {
      bubble.append(node("p", i18n.t("picker.inv_none"), "saved-inv-note"));
      return;
    }
    bubble.append(node("div", i18n.t("picker.inv_total", { forms: inv.forms, walks: inv.walks }), "saved-inv-total"));
    const topk = now.task === "topk";
    const hasKind = known.some((form) => form.kind !== null);
    const hasTerms = known.some((form) => form.tf !== null || form.gini); // forms that differ only in the term damping or the Gini weighting must not look alike
    const table = node("table", "", "saved-inv");
    const head = node("tr");
    /** the column heads; the numbers' columns (k, lambda, the walks) are right-aligned, so a head stands over its figures */
    const heads = [
      ["", ""],
      [i18n.t("picker.inv_fields"), ""],
      ...(hasTerms ? [[i18n.t("picker.inv_terms"), ""]] : []),
      [i18n.t("picker.inv_k"), "saved-inv-num"],
      ...(topk ? [[i18n.t("picker.inv_lam"), "saved-inv-num"]] : []),
      ...(hasKind ? [[i18n.t("picker.inv_kind"), ""]] : []),
      [i18n.t(topk ? "picker.inv_users" : "picker.inv_pairs"), "saved-inv-num"],
    ];
    for (const [text, className] of heads) head.append(node("th", text, className));
    table.append(head);
    for (const row of inv.rows) {
      const tr = node("tr", "", row.current ? "is-current" : "");
      const mark = node("td", row.current ? "▸" : "", "saved-inv-mark"); // a small right-pointing triangle: the form on screen
      if (row.current) mark.title = i18n.t("picker.inv_current");
      // a field whose weight is not the default carries it ("keywords ×2"), so two forms with the same fields and other weights are two rows that read differently
      const fields = row.fields.length ? row.fields.map((name) => (row.weights[name] === undefined ? fieldName(name) : `${fieldName(name)} ×${row.weights[name]}`)).join(", ") : i18n.t("picker.inv_default");
      tr.append(mark, node("td", row.more ? `${fields} +${row.more}` : fields, "saved-inv-fields"));
      if (hasTerms) tr.append(node("td", [row.tf === "sqrt" || row.tf === "log" ? i18n.t(`params.tf_${row.tf}`) : "", row.gini ? i18n.t("picker.inv_gini") : ""].filter(Boolean).join(" · "), "saved-inv-terms"));
      tr.append(node("td", row.k === null ? i18n.t("picker.inv_all") : String(row.k), "saved-inv-num"));
      if (topk) tr.append(node("td", row.lam === null ? "" : String(row.lam), "saved-inv-num"));
      if (hasKind) tr.append(node("td", row.kind === null ? "" : i18n.t(`params.cb_kind_${row.kind}`)));
      tr.append(node("td", String(row.count), "saved-inv-num"));
      table.append(tr);
    }
    bubble.append(table);
    if (inv.hidden) bubble.append(node("p", i18n.t("picker.inv_more", { n: inv.hidden }), "saved-inv-note"));
  }

  return {
    el,
    bubble,
    /** @returns {boolean} whether the switch is on */
    ticked: () => on,
    /**
     * The page as it stands changed (or was built): ask again - once per distinct question - and remember the form and pair on screen. The answer of an older question that comes late is dropped.
     * @param {{task: string, key: string, route: import("../util/saved-walks.js").FormRoute, forms: Record<string, string>, exact: Record<string, string>}} next the task, the walk-through's key
     *   (page, task, method), the form and pair on screen and the two questions (`savedFormsQuery`, `savedWalksQuery`)
     */
    refresh(next) {
      now = { task: next.task, key: next.key, route: next.route };
      forms.refresh(next.forms);
      exact.refresh(next.exact);
      if (!bubble.hidden) paintInventory(); // the form on screen is marked in it
    },
    /** @returns {boolean} whether the answers for the current questions are here */
    loaded,
    /** @returns {number} how many saved walks the walk-through has (0 while unknown) */
    count: () => (loaded() ? plan().steps.length : 0),
    /** @returns {boolean} whether Random pick must be greyed now: the switch is on, the answers are here and nothing at all is saved for this page and task */
    blocked: () => on && loaded() && plan().steps.length === 0,
    /**
     * One press of Random pick with the switch on (waits for the answers when they are still on their way): the next walk of the walk-through, its form's route patch and what the page says.
     * @returns {Promise<{patch: Record<string, string | undefined>, label: string, count: number, changed: boolean, step: import("../util/saved-walks.js").SavedStep} | null>} null: nothing is saved
     */
    async press() {
      await Promise.all([forms.wait(), exact.wait()]);
      if (!loaded()) return null;
      const out = pressWalk(plan(), { route: now.route, key: now.key, cycle });
      if (!out) return null;
      cycle = out.cycle;
      return { patch: walkPatch(out.form, out.step), label: counterText(out.cursor, out.count), count: out.count, changed: out.changed, step: out.step };
    },
    /** @returns {import("../util/saved-walks.js").WalkCycle | null} the walk-through so far (the page keeps it across a rebuild) */
    cycle: () => cycle,
    /** @returns {string} "i/N" while the page shows the walk the last press opened, "" otherwise (and while the switch is off, and for another task or method: the same form and pair there is no walk of this one) */
    counter: () => (on && cycle?.key === now.key ? counterNow(cycle, now.route) : ""),
    /** @returns {{n: number, count: number} | null} set while the form on screen is the one a press wrote into the page (on the same page, task and method) */
    loadedNote: () => (cycle && cycle.key === now.key && formWasLoaded(cycle, now.route) ? { n: cycle.cursor + 1, count: cycle.count } : null),
  };
}

/** @returns {Storage | null} the browser's localStorage, or none when the browser blocks it */
function defaultStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
