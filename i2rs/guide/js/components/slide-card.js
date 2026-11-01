// @ts-check
// WP-66: the narration card next to the lecture board: chapter chip + step counter, the step's
// title and text (from i18n; `**bold**` is the only markup, rendered as <strong> - no HTML from
// the dictionary is ever injected), the textbook reference, an optional note and the DOOR: a
// deep link into the live lab page that shows this node for real (uCF trace, Metrics sweep, the
// atlas graph, ...). Panel contract `{ reset(trace), apply(frame) }` like every player panel.
// WP-75: under the narration, optional "seen in the wild" examples - the headline a real product
// shows for this idea ("Because you watched …"). Each one is drawn as a mini product row: the
// source as a small tag at the top right, the headline full width below it as a bold row title
// (round 2 - the first version copied the instructor's slide colours into a narrow chip and
// wrapped word by word; round 3 dropped a decorative poster strip that only cost height). i18n
// value "<headline> | <source>", the source part optional.

/**
 * Render `**bold**` spans as <strong>, everything else as text nodes.
 * @param {HTMLElement} el
 * @param {string} text
 */
export function renderMarkup(el, text) {
  el.textContent = "";
  const parts = String(text).split(/\*\*(.+?)\*\*/g);
  parts.forEach((part, i) => {
    if (!part) return;
    if (i % 2 === 1) {
      const b = document.createElement("strong");
      b.textContent = part;
      el.appendChild(b);
    } else {
      el.appendChild(document.createTextNode(part));
    }
  });
}

/**
 * @param {HTMLElement} root
 * @param {{i18n: any, router: any}} ctx
 */
export function createSlideCard(root, ctx) {
  /** @type {Record<string, HTMLElement>} */
  let els = {};
  // WP-67: the RS tree's references are textbook chapters ("Textbook: Ch. 2"); the system board
  // cites papers, so the deck may relabel the chip ("Reading")
  let refLabelKey = "slides.textbook_ref";

  function build() {
    root.innerHTML = "";
    const top = document.createElement("div");
    top.className = "slide-card-top";
    const phase = document.createElement("span");
    phase.className = "chip on";
    const right = document.createElement("span");
    right.className = "slide-card-right"; // WP-82: counter + the SVG download, together on the right
    const pill = document.createElement("span");
    pill.className = "pill num";
    if (ctx.onExportSvg) {
      // WP-82: the board as a standalone SVG, exactly as it stands (for the instructor's slides);
      // a filled pill LEFT of the counter, so the corner keeps the counter and the call to action
      // stands out (user's call after the first, quiet version)
      const exportBtn = document.createElement("button");
      exportBtn.type = "button";
      exportBtn.className = "slide-export";
      exportBtn.innerHTML =
        '<svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.8" ' +
        'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<path d="M8 2.5v8M4.8 7.3 8 10.5l3.2-3.2M3 13.5h10"/></svg><span>SVG</span>';
      exportBtn.title = ctx.i18n.t("slides.export_svg");
      exportBtn.setAttribute("aria-label", ctx.i18n.t("slides.export_svg"));
      exportBtn.addEventListener("click", () => ctx.onExportSvg());
      right.appendChild(exportBtn);
    }
    right.appendChild(pill);
    top.append(phase, right);
    const title = document.createElement("h3");
    title.className = "slide-title";
    const text = document.createElement("p");
    text.className = "slide-text";
    const headlines = document.createElement("div");
    headlines.className = "slide-headlines"; // WP-75
    const doors = document.createElement("div");
    doors.className = "slide-doors"; // WP-82: the wrap-up's "doors on this board"
    const meta = document.createElement("div");
    meta.className = "slide-meta";
    root.append(top, title, text, headlines, doors, meta);
    els = { phase, pill, title, text, headlines, doors, meta };
  }

  /** @type {{page: string, params: Record<string, any>, index: number, sub: number}[]} */
  let doorsList = [];

  /**
   * WP-82: the list of every door on the board, in the current narration's order; shown on the
   * steps that ask for it (`doors_index`, the wrap-up). One row = one lab page: the page name on
   * the left, then - flush right - the page's sidebar emoji and the "take me there" arrow; the
   * whole row opens the page like the door button does. (Round 7's "step N" tag went: a step
   * number next to a page name asked "step of what?" - the instructor.)
   * @param {boolean} show
   */
  function renderDoors(show) {
    const { i18n, router } = ctx;
    els.doors.innerHTML = "";
    if (!show || !doorsList.length) return;
    const label = document.createElement("span");
    label.className = "slide-headlines-label";
    label.textContent = i18n.t("slides.doors_index");
    els.doors.appendChild(label);
    for (const d of doorsList) {
      const pageName = i18n.t(`nav.${d.page}`);
      const row = document.createElement("button");
      row.type = "button";
      row.className = "door-row";
      row.title = i18n.t("slides.door", { page: pageName });
      const name = document.createElement("span");
      name.className = "door-name";
      name.textContent = pageName;
      const icon = document.createElement("span");
      icon.className = "door-icon";
      icon.textContent = ctx.pageIcon ? ctx.pageIcon(d.page) : "";
      icon.setAttribute("aria-hidden", "true");
      const go = document.createElement("span");
      go.className = "door-go";
      go.textContent = "↗";
      go.setAttribute("aria-hidden", "true");
      row.append(name, icon, go);
      row.addEventListener("click", () => router.navigate(d.page, d.params));
      els.doors.appendChild(row);
    }
  }

  /**
   * WP-75: fill the "seen in the wild" strip; an empty key list hides it (CSS :empty).
   * @param {string[]} keys
   */
  function renderHeadlines(keys) {
    const { i18n } = ctx;
    els.headlines.innerHTML = "";
    if (!keys.length) return;
    const label = document.createElement("span");
    label.className = "slide-headlines-label";
    label.textContent = i18n.t("slides.headlines_label");
    els.headlines.appendChild(label);
    for (const key of keys) {
      const [headline, source] = String(i18n.t(key)).split("|");
      const card = document.createElement("div");
      card.className = "wild-card";
      if (source && source.trim()) {
        const tag = document.createElement("span");
        tag.className = "wild-tag"; // where you meet it: "NETFLIX", "ONBOARDING", ...
        tag.textContent = source.trim();
        card.appendChild(tag);
      }
      const title = document.createElement("div");
      title.className = "wild-title"; // the row title itself, full width (CSS adds the "›")
      title.textContent = headline.trim();
      card.appendChild(title); // round 3: no poster strip - decoration that only cost height
      els.headlines.appendChild(card);
    }
  }

  return {
    /** @param {{refLabelKey?: string | null}} opts */
    configure(opts) {
      refLabelKey = opts.refLabelKey || "slides.textbook_ref"; // WP-67
    },
    /**
     * WP-82: the route's doors (see `collectDoors` in slides-page.js).
     * @param {{page: string, params: Record<string, any>, index: number, sub: number}[]} list
     */
    setDoors(list) {
      doorsList = list;
    },
    reset() {
      build();
    },
    /** @param {import("./trace-player.js").Frame} frame */
    apply(frame) {
      const { i18n, router } = ctx;
      const { step, phase } = frame;
      const sub = frame.sub || 0;
      // sub 0 = the step itself; sub k = its (k-1)-th sub-step (an item of a side card)
      const current = sub > 0 && step.subs && step.subs[sub - 1] ? step.subs[sub - 1] : step;
      els.phase.textContent = phase ? i18n.t(phase.label_key) : "";
      const nSubs = step.subs ? step.subs.length : 0;
      els.pill.textContent =
        i18n.t("slides.step_pill", { i: frame.index + 1, n: frame.total }) + (nSubs ? ` · ${sub}/${nSubs}` : "");
      els.title.textContent = i18n.t(current.title_key || step.title_key);
      renderMarkup(els.text, i18n.t(current.text_key));
      els.text.classList.remove("fade-in");
      void els.text.offsetWidth; // restart the entrance animation on every step
      els.text.classList.add("fade-in");
      // WP-75: a sub-step shows only its own headlines; the step's own list shows at sub 0
      renderHeadlines((sub === 0 ? step.headline_keys : current.headline_keys) || []);
      renderDoors(sub === 0 && !!step.doors_index); // WP-82

      els.meta.innerHTML = "";
      const ref = current.ref || (sub === 0 ? step.ref : null);
      if (ref) {
        const refEl = document.createElement("span");
        refEl.className = "pill slide-ref";
        refEl.textContent = `${i18n.t(refLabelKey)}: ${ref}`;
        els.meta.appendChild(refEl);
      }
      if (current.note_key) {
        const note = document.createElement("span");
        note.className = "pill slide-note";
        note.textContent = i18n.t(current.note_key);
        els.meta.appendChild(note);
      }
      if (current.door && current.door.page) {
        const door = current.door;
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "btn btn-primary btn-sm slide-door";
        btn.textContent = `${i18n.t("slides.door", { page: i18n.t(`nav.${door.page}`) })} ↗`;
        btn.addEventListener("click", () => router.navigate(door.page, door.params || {}));
        els.meta.appendChild(btn);
      }
    },
  };
}
