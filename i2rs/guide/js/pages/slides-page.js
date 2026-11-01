// @ts-check
// WP-66: host page for a lecture-board deck (config/slides/<id>.yaml; nav group "Slides"). The
// deck arrives as JSON (`api.slide(id)`), is turned into a TracePlayer trace on the client
// (`buildDeckTrace`: one step per deck step, phases = the chosen route's chapters) and drives two
// panels - the board (ghost map that inks itself) and the narration card - plus the shared
// transport controls. Nothing is computed on the server: the page works identically in a static
// export. The route is the single source of truth: `route` picks the narration order (the deck
// may define several - problem-first / textbook / board order for the RS tree), `step` mirrors the
// player position (router.replace, no history spam), so `#/rs_tree?route=textbook&step=6` is a
// deep link into the exact frame. Clicking a board element jumps to the step that inks it.
// WP-67: a second deck (rs_system, "From model to system") shares everything here; the legend and
// the reference-chip label come from the deck when it defines them.

import { createBoard } from "../components/board.js";
import { exportBoardSvg } from "../components/board-export.js"; // WP-82
import { createPlayerControls } from "../components/player-controls.js";
import { createSlideCard } from "../components/slide-card.js";
import { createSplitter } from "../components/splitter.js"; // WP-111
import { showToast } from "../components/toast.js";
import { createTracePlayer } from "../components/trace-player.js";
import { MIN_CARD_WIDTH, deckSplitKey, deckSplitRange } from "../util/deck-split.js"; // WP-111
import { createPanel } from "../util/panel.js";
import { showsSvgExport } from "../util/publication.js"; // WP-248: the students' edition has no SVG download
import { browserStorage } from "../util/safe-storage.js"; // WP-111

/** @type {Map<string, Promise<any>>} */
const deckCache = new Map();

/** WP-67: legend chips (role, label key) when the deck does not define its own. */
const DEFAULT_LEGEND = [
  ["user", "slides.legend_user"],
  ["item", "slides.legend_item"],
  ["model", "slides.legend_model"],
  ["rating", "slides.legend_rating"],
  ["dashed", "slides.legend_dashed"],
];

/**
 * @param {any} api
 * @param {string} id
 */
async function loadDeck(api, id) {
  if (!deckCache.has(id)) deckCache.set(id, api.slide(id));
  try {
    return await deckCache.get(id);
  } catch (err) {
    deckCache.delete(id); // a failed fetch must not poison later mounts
    throw err;
  }
}

/**
 * Deck + route -> the trace shape TracePlayer/buildFrame understand (`steps[]` with `node_id`,
 * `text_key`, `duration_ms`, numeric `substeps` = 1 + the deck's sub-steps, kept as `subs`;
 * `phases[]` with `first_step`; `tables` empty).
 * @param {any} deck
 * @param {any} route
 */
export function buildDeckTrace(deck, route) {
  const byId = new Map(deck.steps.map((s) => [s.id, s]));
  /** @type {any[]} */
  const steps = [];
  /** @type {any[]} */
  const phases = [];
  for (const phase of route.phases) {
    phases.push({ first_step: steps.length, label_key: phase.label_key });
    for (const sid of phase.steps) {
      const s = byId.get(sid);
      if (!s) continue;
      const subs = Array.isArray(s.substeps) ? s.substeps : [];
      steps.push({
        ...s,
        subs,
        substeps: 1 + subs.length,
        node_id: s.focus || s.id,
        detail: "full",
        duration_ms: s.duration_ms || 5000,
      });
    }
  }
  return { steps, phases, tables: {} };
}

/**
 * WP-82: the doors of a route in narration order, one per lab page (its first appearance wins),
 * for the wrap-up card's "doors on this board" list - "every leaf on this board is a door".
 * @param {any} tr  the trace built by `buildDeckTrace`
 * @returns {{page: string, params: Record<string, any>, index: number}[]}
 */
export function collectDoors(tr) {
  /** @type {{page: string, params: Record<string, any>, index: number, sub: number}[]} */
  const out = [];
  const seen = new Set();
  tr.steps.forEach((/** @type {any} */ s, /** @type {number} */ index) => {
    // sub 0 = the step's own door, sub k = its (k-1)-th sub-step's door (the player's position)
    const doors = [s.door, ...(s.subs || []).map((/** @type {any} */ x) => x.door)];
    doors.forEach((d, sub) => {
      if (!d || !d.page || seen.has(d.page)) return;
      seen.add(d.page);
      out.push({ page: d.page, params: d.params || {}, index, sub });
    });
  });
  return out;
}

/**
 * Board element id -> the (step id, sub index) that inks it (first one wins; sub 0 = the step
 * itself, sub k = its (k-1)-th sub-step). A figure id maps to the first click inking any of its
 * parts, so clicking anywhere on a sketch works. Route independent because every route visits
 * every step exactly once (validated server-side).
 * @param {any} deck
 * @returns {Map<string, {step: string, sub: number}>}
 */
export function elementStepMap(deck) {
  /** @type {Map<string, {step: string, sub: number}>} */
  const map = new Map();
  /**
   * @param {string} id
   * @param {{step: string, sub: number}} target
   */
  const put = (id, target) => {
    if (!map.has(id)) map.set(id, target);
    const dot = id.indexOf(".");
    if (dot > 0) {
      const fig = id.slice(0, dot);
      if (!map.has(fig)) map.set(fig, target);
    }
  };
  for (const step of deck.steps) {
    for (const id of step.ink || []) put(id, { step: step.id, sub: 0 });
    (step.substeps || []).forEach((sub, k) => {
      for (const id of sub.ink || []) put(id, { step: step.id, sub: k + 1 });
    });
  }
  return map;
}

/**
 * `step` route param ("6" or "3.2") -> [index, sub].
 * @param {string | undefined} raw
 * @returns {[number, number]}
 */
export function parseStepParam(raw) {
  if (!raw) return [0, 0];
  const [a, b] = String(raw).split(".");
  return [Math.max(0, Number(a) || 0), Math.max(0, Number(b) || 0)];
}

/**
 * @param {string} deckId  deck file stem; also the nav page id by convention (main.js)
 * @param {string} [pageId]
 */
export function createSlidesPage(deckId, pageId = deckId) {
  /** @type {HTMLElement | null} */
  let root = null;
  /** @type {any} */
  let ctx = null;
  /** @type {any} */
  let els = null;
  /** @type {any} */
  let deck = null;
  /** @type {any} */
  let trace = null;
  /** @type {any} */
  let player = null;
  /** @type {any} */
  let controls = null;
  /** @type {any} */
  let board = null;
  /** @type {any} */
  let card = null;
  let routeId = "";
  let mounted = false;
  /** @type {Map<string, {step: string, sub: number}>} */
  let elementToStep = new Map();
  /** @type {ResizeObserver | null} */
  let resizeObserver = null;
  /** @type {ReturnType<typeof createSplitter> | null} WP-111: the board | card divider (made once the deck is known) */
  let splitter = null;

  /** the gap between the board and the card, px (the divider's handle sits in it) */
  function rowGap() {
    return parseFloat(getComputedStyle(els.top).columnGap) || 12;
  }

  /** the board and the card side by side (the narrow layout stacks them and has no divider) */
  function sideBySide() {
    return getComputedStyle(els.top).flexDirection !== "column";
  }

  /** the pair's combined width, px: the row minus the gap. The divider moves the line between the two, never this total. */
  function pairWidth() {
    return els.top.getBoundingClientRect().width - rowGap();
  }

  /**
   * The width the board's height allows (the deck's viewBox ratio), px, held between 240 and what leaves the card MIN_CARD_WIDTH;
   * 0 when the row is not laid out. This is the divider's DEFAULT - "today's ratio" - so the drawing is never letterboxed inside a
   * panel sized by something else (the legend row was deciding the width before). A flex/aspect-ratio-only solution cannot do
   * this: the panel's flex basis is computed before its stretched height is known.
   */
  function naturalWidth() {
    const hostH = els.boardHost.getBoundingClientRect().height;
    if (!(hostH > 0)) return 0;
    const chrome = els.boardPanel.getBoundingClientRect().width - els.boardHost.getBoundingClientRect().width;
    const wanted = hostH * (deck.board.width / deck.board.height) + chrome;
    return Math.max(240, Math.min(wanted, pairWidth() - MIN_CARD_WIDTH));
  }

  /**
   * WP-111: the divider's limits and default, percent of the pair (the arithmetic is util/deck-split.js, hand-checked under node).
   * @returns {import("../util/split-ratio.js").SplitRange}
   */
  function boardShareRange() {
    const total = pairWidth();
    return deckSplitRange(total, total > 0 ? naturalWidth() : 0);
  }

  /**
   * Draw a share of the pair as the board panel's width (the card takes the rest). The narrow layout, which stacks the two and has
   * no divider, keeps the width its height allows, as before.
   * @param {number} pct
   */
  function drawBoardShare(pct) {
    const width = sideBySide() ? (pct / 100) * pairWidth() : naturalWidth();
    if (width > 0) els.boardPanel.style.width = `${width}px`;
  }

  /**
   * Size the board panel: the width its height allows, or - when the reader has dragged the divider - their share. Re-run on every
   * resize of the row (window, sidebar fold, presenting mode) and twice per pass, because a narrower panel can re-wrap the legend
   * and change the height available to the board.
   */
  function fitBoard() {
    if (!deck || !els || !els.top || !mounted) return;
    for (let pass = 0; pass < 2; pass += 1) {
      if (!(els.boardHost.getBoundingClientRect().height > 0)) return;
      if (splitter) splitter.refresh();
      else drawBoardShare(boardShareRange().def);
    }
  }

  /**
   * WP-111: the draggable divider between the board and the narration card, per deck in localStorage. The player's strip below spans
   * both panels, so it does not move with the divider.
   */
  function mountSplitter() {
    const { i18n } = ctx;
    splitter = createSplitter({
      axis: "x",
      before: els.boardPanel,
      after: els.cardBox,
      range: boardShareRange,
      apply: drawBoardShare,
      storage: browserStorage(),
      storageKey: deckSplitKey(deckId),
      label: i18n.t("slides.split"),
      hint: i18n.t("slides.split_hint"),
    });
  }

  function layout() {
    if (!root) return;
    const { i18n } = ctx;
    root.innerHTML = "";
    const page = document.createElement("div");
    page.className = "slides-page";

    // No page header: the sidebar already names the deck, the cover step carries its purpose, and
    // the narration-order select lives inside the player bar (`mountRouteSelect`) - every vertical
    // pixel goes to the board (instructor's request).
    const routeLabel = document.createElement("label");
    routeLabel.className = "slides-route";
    const routeText = document.createElement("span");
    routeText.textContent = i18n.t("slides.route_label");
    const routeSel = document.createElement("select");
    routeSel.addEventListener("change", () => {
      // a new narration order restarts from its first step (a real navigation: Back returns)
      ctx.router.navigate(pageId, { route: routeSel.value });
    });
    routeLabel.append(routeText, routeSel);

    const boardPanel = createPanel("slides-board", "slides-board-panel");
    const boardHost = document.createElement("div");
    boardHost.className = "board-host";
    const legend = document.createElement("div");
    legend.className = "board-legend"; // filled once the deck is known (WP-67: deck-specific chips)
    boardPanel.body.append(boardHost, legend);

    const cardPanel = createPanel("slides-card", "slides-card-panel");
    cardPanel.body.classList.add("slide-card");

    const controlsEl = document.createElement("div");
    controlsEl.className = "slides-controls";
    // the usage hint (click / right-click / keys) lives in a tooltip on this ⓘ, not in a text row
    const help = document.createElement("button");
    help.type = "button";
    help.className = "help-tip";
    help.textContent = "i";
    // WP-82: a CSS tooltip (app.css `.help-tip::after`, WP-95 8a: shared with the Data page) instead of the
    // native title - the button sits in the bottom-right corner, so the bubble opens up and to the left, narrow
    help.dataset.tip = `${i18n.t("slides.hint")}\n${i18n.t("player.keys")}`;
    help.setAttribute("aria-label", i18n.t("slides.hint"));
    const sep = document.createElement("span");
    sep.className = "bar-sep";
    sep.setAttribute("aria-hidden", "true");

    // board + card fill the height the main area offers (the board scales by height, the card
    // takes the remaining width); the player strip sits directly below - no dead space
    const top = document.createElement("div");
    top.className = "slides-top";
    top.append(boardPanel.box, cardPanel.box);
    page.append(top, controlsEl);
    root.appendChild(page);
    els = {
      routeLabel,
      routeSel,
      help,
      sep,
      top,
      boardPanel: boardPanel.box,
      cardBox: cardPanel.box,
      boardHost,
      legend,
      card: cardPanel.body,
      controls: controlsEl,
    };
    if (typeof ResizeObserver === "function") {
      resizeObserver = new ResizeObserver(() => fitBoard());
      resizeObserver.observe(top);
    }

    board = createBoard(boardHost, {
      i18n,
      onElementClick: (id) => {
        const target = elementToStep.get(id);
        if (!target || !player || !trace) return;
        const index = trace.steps.findIndex((/** @type {any} */ s) => s.id === target.step);
        if (index >= 0) player.goto(index, target.sub);
      },
    });
    /** @type {Map<string, string>} page id -> sidebar emoji (WP-82, the doors list) */
    const pageIcons = new Map();
    const walkNav = (/** @type {any[]} */ nodes) => {
      for (const node of nodes || []) {
        if (node.page && node.icon) pageIcons.set(node.page, node.icon);
        walkNav(node.children);
      }
    };
    walkNav(ctx.nav && ctx.nav.tree);
    card = createSlideCard(cardPanel.body, {
      i18n,
      router: ctx.router,
      // WP-82: "SVG ↓" on the card downloads the board as it stands (see board-export.js)
      // WP-111: the file carries the app version and the time of the export (name, <metadata>, a line under the drawing)
      // WP-248: the lab only - the card draws the button when it is given a handler (`ctx.publication` is null in the lab, the edition's manifest in a students' package)
      onExportSvg: !showsSvgExport(ctx.publication) ? undefined : () => {
        const svg = els.boardHost.querySelector("svg.board-svg");
        if (!svg) return;
        const st = player ? player.state() : { index: 0, sub: 0 };
        const meta = ctx.store.get().meta || {};
        void exportBoardSvg(/** @type {SVGSVGElement} */ (svg), {
          deck: deckId,
          route: routeId || "route",
          index: st.index,
          sub: st.sub,
          version: meta.version || "",
          buildVersion: meta.build_version || "",
          now: new Date(),
        });
      },
      // WP-82: the doors list shows each page's sidebar emoji (config/nav.yaml `icon`, via the
      // shell's nav tree) so a row is recognisably the same thing as its sidebar entry
      pageIcon: (/** @type {string} */ page) => pageIcons.get(page) || "",
    });
  }

  /**
   * WP-67: the legend says what each colour means ON THIS BOARD (the deck's `legend`, else the
   * generic chips); built after the deck loads, before fitBoard() measures the panel.
   * @param {any} loaded
   */
  function fillLegend(loaded) {
    const { i18n } = ctx;
    els.legend.innerHTML = "";
    const chips = Array.isArray(loaded.legend) && loaded.legend.length ? loaded.legend.map((c) => [c.role, c.label_key]) : DEFAULT_LEGEND;
    for (const [role, key] of chips) {
      const chip = document.createElement("span");
      chip.className = "chip legend-chip";
      const swatch = document.createElement("i");
      swatch.className = `legend-swatch swatch-${role}`;
      const text = document.createElement("span");
      text.textContent = i18n.t(key);
      chip.append(swatch, text);
      els.legend.appendChild(chip);
    }
  }

  /** WP-76: the deck's `default_route` (an explicit choice), else the first route listed. */
  function defaultRouteId() {
    return deck.default_route || deck.routes[0].id;
  }

  /** @param {Record<string, string>} params */
  function routeFor(params) {
    const wanted = params.route || defaultRouteId();
    return deck.routes.find((/** @type {any} */ r) => r.id === wanted) || deck.routes[0];
  }

  /**
   * (Re)start the player on a route. Frames are pure, so the position is simply re-applied.
   * @param {any} route
   * @param {number} step
   * @param {number} sub
   */
  function start(route, step, sub) {
    if (player) {
      player.destroy();
      player = null;
    }
    routeId = route.id;
    trace = buildDeckTrace(deck, route);
    card.setDoors(collectDoors(trace)); // WP-82: the wrap-up's door list
    const isDefault = route.id === defaultRouteId(); // WP-76: the URL omits `route=` for it
    player = createTracePlayer({
      trace,
      panels: [board, card],
      onPosition: (index, subIndex) => {
        if (!mounted) return; // WP-43 lesson: never rewrite the URL once the page is gone
        if (controls) controls.apply(frameLite(trace, index, subIndex));
        ctx.router.replace(pageId, {
          route: isDefault ? undefined : routeId,
          step: subIndex ? `${index}.${subIndex}` : String(index),
        });
      },
    });
    controls = createPlayerControls(els.controls, { i18n: ctx.i18n, player, trace });
    controls.reset();
    arrangeBar();
    els.routeSel.value = route.id;
    player.goto(step, sub);
  }

  /**
   * Re-order the shared player bar for the lecture board, left to right: the narration order
   * (the setting that frames everything else) set off by a thin rule, then the playback cluster
   * (transport buttons + speed), the position (step counter + sub-step dots), the phase select
   * (jump within the chosen order), and an ⓘ with the usage hint at the far right. The generic
   * key-hint text is removed (it is in the tooltip). The bar is rebuilt on every `controls.reset()`,
   * so this runs after each one; the route select, the rule and the ⓘ are created once in
   * `layout()` and simply moved.
   *
   * WP-67: the strip must not jitter while stepping. The counter ("Step 3 / 14") and the sub-step
   * dots ("●●○○○") change width from step to step, which used to push the phase select around
   * (instructor's complaint, both decks). The phase select stays where it is - right after the
   * counter / dots block, a fixed gap away (pinning it to the right edge was rejected) - and the
   * two variable spans reserve the width of their widest possible content, measured once per route
   * with both dot glyphs, so nothing after them ever moves.
   */
  function arrangeBar() {
    const bar = els.controls.querySelector(".player-controls");
    if (!bar) return;
    const buttons = [...bar.querySelectorAll(":scope > button.btn")];
    const selects = [...bar.querySelectorAll(":scope > select")]; // [phase, speed] as built
    const phaseSel = selects[0] || null;
    const speedSel = selects[1] || null;
    const counter = bar.querySelector(".player-counter");
    const dots = bar.querySelector(".player-dots");
    const keys = bar.querySelector(".player-keys");
    if (keys) keys.remove();
    const showRoute = !!deck && deck.routes.length > 1;
    const order = [
      showRoute ? els.routeLabel : null,
      showRoute ? els.sep : null,
      ...buttons,
      speedSel,
      counter,
      dots,
      phaseSel,
      els.help,
    ];
    if (!showRoute) {
      els.routeLabel.remove();
      els.sep.remove();
    }
    for (const node of order) if (node) bar.appendChild(node);
    if (phaseSel) phaseSel.classList.add("slides-phase");
    if (trace) {
      const n = trace.steps.length;
      reserveWidth(counter, [ctx.i18n.t("player.step_of", { i: n, n })]);
      const maxSubs = Math.max(1, ...trace.steps.map((/** @type {any} */ s) => Number(s.substeps) || 1));
      // ● and ○ differ by a pixel or two in most fonts: reserve the wider of the two runs
      reserveWidth(dots, maxSubs > 1 ? ["●".repeat(maxSubs), "○".repeat(maxSubs)] : [""]);
    }
  }

  /**
   * Give an inline span the width of its widest content (WP-67): render each candidate once,
   * measure, restore, keep the maximum. A zero measurement (page not laid out yet) leaves the span
   * alone.
   * @param {Element | null} el
   * @param {string[]} candidates
   */
  function reserveWidth(el, candidates) {
    if (!(el instanceof HTMLElement)) return;
    const keep = el.textContent;
    el.style.minWidth = "";
    let width = 0;
    for (const text of candidates) {
      el.textContent = text;
      width = Math.max(width, el.getBoundingClientRect().width);
    }
    el.textContent = keep;
    if (width > 0) el.style.minWidth = `${Math.ceil(width)}px`;
  }

  /**
   * @param {any} tr
   * @param {number} index
   * @param {number} sub
   */
  function frameLite(tr, index, sub) {
    const phase = tr.phases.reduce(
      (/** @type {any} */ acc, /** @type {any} */ p) => (p.first_step <= index ? p : acc),
      tr.phases[0]
    );
    return { index, sub, total: tr.steps.length, step: tr.steps[index], phase };
  }

  /**
   * WP-77: the position a URL without `step` opens on - the cover, or with `open_at: last` the
   * end of the route's last step (the whole map inked: the summary lecture starts from the picture).
   * @param {any} route
   * @returns {[number, number]}
   */
  function openingPosition(route) {
    if (deck.open_at !== "last") return [0, 0];
    const ids = route.phases.flatMap((/** @type {any} */ p) => p.steps);
    const last = deck.steps.find((/** @type {any} */ s) => s.id === ids[ids.length - 1]);
    return [ids.length - 1, last && last.substeps ? last.substeps.length : 0];
  }

  /** @param {any} state */
  function applyState(state) {
    if (!deck || !mounted) return;
    const params = state.route.params || {};
    const route = routeFor(params);
    const [step, sub] = params.step === undefined ? openingPosition(route) : parseStepParam(params.step);
    if (route.id !== routeId || !player) {
      start(route, step, sub);
      return;
    }
    const st = player.state();
    if (st.index !== step || st.sub !== sub) player.goto(step, sub);
  }

  return {
    // WP-78: the board never reads the header's dataset - its doors carry their own `ds`
    // (the toy matrix the narration quotes), so main.js greys the selector while this page is up
    usesDataset: false,
    /**
     * @param {HTMLElement} rootEl
     * @param {any} context
     */
    mount(rootEl, context) {
      root = rootEl;
      ctx = context;
      mounted = true;
      deck = null;
      trace = null;
      routeId = "";
      splitter = null;
      layout();
      loadDeck(ctx.api, deckId)
        .then((loaded) => {
          if (!mounted) return;
          deck = loaded;
          const { i18n } = ctx;
          els.routeSel.innerHTML = "";
          for (const r of deck.routes) {
            const opt = document.createElement("option");
            opt.value = r.id;
            opt.textContent = i18n.t(r.label_key);
            els.routeSel.appendChild(opt);
          }
          elementToStep = elementStepMap(deck);
          fillLegend(deck);
          card.configure({ refLabelKey: deck.ref_label_key }); // WP-67
          board.setDeck(deck, { clickable: elementToStep.keys() });
          mountSplitter(); // WP-111: after the legend is filled - its wrap decides the board's natural width
          fitBoard();
          applyState(ctx.store.get());
        })
        .catch((err) => {
          const message = err && err.messageKey ? ctx.i18n.t(err.messageKey, err.params) : String(err);
          if (els) els.card.textContent = message;
          showToast(message, "error");
        });
    },
    /** @param {any} state */
    update(state) {
      applyState(state);
    },
    unmount() {
      mounted = false;
      splitter = null;
      if (resizeObserver) {
        resizeObserver.disconnect();
        resizeObserver = null;
      }
      if (player) {
        player.destroy();
        player = null;
      }
      if (board) board.dispose();
      if (root) root.innerHTML = "";
      root = null;
    },
  };
}
