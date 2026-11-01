// @ts-check
// WP-40: Data page - data card, distributions (rating histogram, per-user/per-item count
// histograms with quantile chips), long-tail/Lorenz curve, class-vs-ML cohort comparison, free
// user/item browsing (EntityPicker with every guard off) with a profile card, and a split + k-core
// preview form. Page object contract: `{mount(root, ctx), update(state), unmount()}` (WP-32).
//
// WP-95 (the instructor's Data tour, 2026-10-04):
//   * a response that arrives after the page moved on is DROPPED: `loadAll` (card + stats), the Browse
//     profiles (user / item) and the split preview each carry a sequence token that is checked after
//     every `await` - a slow answer for dataset B used to paint over dataset A after A -> B -> A;
//   * the card and Distributions panels fold (header click, state in localStorage), the card shows the
//     build facts and the Caveats side by side, the long-tail curve is the fourth chart of the
//     Distributions row, every chart has a one-sentence caption, the cohort comparison only exists when
//     there are two cohorts;
//   * histogram bin labels are laid out from the MEASURED chart width (flat when they fit, 45 degrees or
//     vertical when they do not, thinned as a last resort) and the page re-plots when the panel width
//     changes (window, fold / unfold);
//   * Browse profiles list Recent / Top / Bottom ratings (segment control) and name the entity once; the
//     list is a fixed-column grid (title | date | rating);
//   * every panel and chart title carries an ⓘ with a short explanation (util/info-tip.js); the
//     raters-per-item chart has a logarithmic count axis (a zero bin stays on the baseline: y = n + 1).

import { createChart, themeColors } from "../components/chart.js";
import { createEntityPicker } from "../components/entity-picker.js";
import { fmtMedian, histStats, markerLegend } from "../components/sparkline-hist.js";
import { fmt, fmtDate } from "../util/format.js";
import { infoTip } from "../util/info-tip.js";
import { createPanel } from "../util/panel.js";
import { entityLabel, isLinkUrl } from "../util/user-link.js"; // WP-96 / WP-99

const SPLIT_METHODS = [
  "per_user_temporal",
  "global_temporal",
  "leave_last_one_out",
  "legacy_random",
  "per_user_random", // WP-43: the temporal split's random twin (pitfall foil)
];

const PANEL_KEY = "i2rs.dataPanels"; // WP-95: which panels the user folded (id -> true)
const TICK_PX = 11; // x-axis tick font of the histograms
const TAIL_MARGIN = { l: 50, r: 14, t: 8, b: 46 }; // WP-95: the long-tail plot - room for both axis titles
const PLOT_PAD_Y = 56; // WP-95: top + bottom margin of a chart plot (the tick labels live in it) - the log ticks are spaced from the rest
const PLOT_PAD_X = 56; // chart.js layoutDefaults margin l 44 + r 12: the plot area is the box minus this
const MIN_PLOT_W = 50; // a panel narrower than this is folded / not laid out: do not plot into it
const PROFILE_ROWS = 10; // rows of a Browse profile list
const ORDERS = /** @type {const} */ (["recent", "top", "bottom"]);

/** @returns {Record<string, boolean>} */
function readFolds() {
  try {
    const parsed = JSON.parse(localStorage.getItem(PANEL_KEY) || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {}; // private mode / blocked storage: the panels simply start open
  }
}

/**
 * @param {string} id
 * @param {boolean} collapsed
 */
function writeFold(id, collapsed) {
  try {
    localStorage.setItem(PANEL_KEY, JSON.stringify({ ...readFolds(), [id]: collapsed }));
  } catch {
    /* the fold still works for this page view */
  }
}

/**
 * Make a panel's header fold it and remember the choice (`createPanel(..., collapsible)` already
 * toggles `.collapsed` on a header click; this restores the stored state and keeps it).
 * @param {{box: HTMLElement}} panel
 * @param {string} id
 */
function persistFold(panel, id) {
  const head = /** @type {HTMLElement | null} */ (panel.box.querySelector(".panel-head"));
  if (!head) return;
  if (readFolds()[id]) panel.box.classList.add("collapsed");
  head.tabIndex = 0;
  head.setAttribute("role", "button");
  const sync = () => head.setAttribute("aria-expanded", String(!panel.box.classList.contains("collapsed")));
  sync();
  head.addEventListener("click", () => {
    writeFold(id, panel.box.classList.contains("collapsed")); // createPanel's own listener ran first
    sync();
  });
  head.addEventListener("keydown", (e) => {
    if (e.target !== head) return; // Enter on the ⓘ button inside the header must not fold the panel
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      head.click();
    }
  });
}

/**
 * Put an ⓘ with `text` right after a panel's title (before the fold caret).
 * @param {{box: HTMLElement}} panel
 * @param {string} text
 * @param {string} label
 */
function addPanelInfo(panel, text, label) {
  panel.box.querySelector(".panel-head h3")?.after(infoTip(text, label));
}

/** Count for a tick: 999 -> "999", 4999 -> "4.9k" (rounded down, so ranges never overlap). @param {number} v */
function compactCount(v) {
  return v < 1000 ? String(v) : `${Math.floor(v / 100) / 10}k`;
}

/**
 * The first of 1, 2, 5, 10, 20, 50, ... that reaches `v` (WP-95: the top tick of a log count axis, so the tallest
 * bar can be read off): 4996 -> 5000, 1500 -> 2000, 1000 -> 1000, 101 -> 200.
 * @param {number} v
 */
function niceCeil(v) {
  if (v <= 1) return 1;
  const decade = 10 ** Math.floor(Math.log10(v));
  return [1, 2, 5, 10].map((m) => m * decade).find((c) => c >= v) ?? v;
}

/** A film title as Plotly hover text: its small markup characters must not be read as tags. @param {string} s */
function hoverSafe(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Integer-count bin [lo, hi) as the values it holds: [1, 5) -> "1–4", [0, 1) -> "0".
 * @param {number} lo
 * @param {number} hi
 * @param {(v: number) => string} format
 */
function binLabel(lo, hi, format) {
  return hi - 1 <= lo ? format(lo) : `${format(lo)}–${format(hi - 1)}`;
}

const measureCtx = document.createElement("canvas").getContext("2d");

/**
 * @param {string} text
 * @param {string} family
 */
function textWidth(text, family) {
  if (!measureCtx) return text.length * TICK_PX * 0.6;
  measureCtx.font = `${TICK_PX}px ${family}`;
  return measureCtx.measureText(text).width;
}

/**
 * How to draw one tick label per bin in `widthPx`: flat when the widest label fits its bin, tilted 45
 * degrees when a bin is at least 1.45 line heights wide, vertical when it is a line wide, and thinned
 * (every n-th label) when even that does not fit - flat when that keeps at least as many labels as
 * standing them up (short numbers: "1" ... "22"), vertical otherwise.
 * @param {string[]} labels
 * @param {number} widthPx the plot area's width
 * @param {string} family
 * @returns {{angle: number, text: string[]}}
 */
export function tickPlan(labels, widthPx, family) {
  const bin = Math.max(1, widthPx) / Math.max(1, labels.length);
  const line = TICK_PX * 1.3;
  const widest = Math.max(...labels.map((l) => textWidth(l, family)));
  if (widest + 6 <= bin) return { angle: 0, text: labels };
  if (line * 1.45 <= bin) return { angle: -45, text: labels };
  if (line + 1 <= bin) return { angle: -90, text: labels };
  // WP-95: unit bins ("1" ... "22") are short - thinned flat labels read better than standing ones
  const flatEvery = Math.ceil((widest + 6) / bin);
  const standEvery = Math.ceil((line + 1) / bin);
  const [angle, every] = flatEvery <= standEvery ? [0, flatEvery] : [-90, standEvery];
  return { angle, text: labels.map((l, i) => (i % every === 0 ? l : "")) };
}

export function createDataPage() {
  /** @type {HTMLElement | null} */
  let root = null;
  /** @type {any} */
  let ctx = null;
  let dataset = "";
  let lang = "";
  let theme = "";
  /** charts of the split preview (rebuilt with every result) @type {{destroy(): void}[]} */
  let liveCharts = [];
  /** charts of the Distributions row (rebuilt on a width change) @type {{destroy(): void}[]} */
  let distCharts = [];
  /** @type {any} */
  let els = null;
  // WP-95: sequence tokens. `loadSeq` changes with every (re)load and with unmount; a response that
  // carries an older value is dropped. The per-profile / split counters do the same for what a user
  // clicks INSIDE one load (two quick picks, a second preview).
  let loadSeq = 0;
  const profileSeq = { user: 0, item: 0 };
  let splitSeq = 0;
  /** @type {any} */
  let lastStats = null;
  let drawnWidth = -1;
  /** @type {ResizeObserver | null} */
  let distObserver = null;
  /** @type {number | undefined} */
  let redrawTimer;

  /** Is the response of load generation `gen` still wanted? @param {number} gen */
  function isLive(gen) {
    return gen === loadSeq && root !== null && ctx !== null && els !== null;
  }

  /**
   * @param {HTMLElement} rootEl
   * @param {any} context
   */
  function mount(rootEl, context) {
    root = rootEl;
    ctx = context;
    dataset = "";
    lastStats = null;
    drawnWidth = -1;
    root.innerHTML = "";
    const { i18n } = context;

    const page = document.createElement("div");
    page.className = "data-page";

    const title = document.createElement("h2");
    page.appendChild(title);

    const statStrip = document.createElement("div");
    statStrip.className = "trace-summary";
    page.appendChild(statStrip);

    const cardPanel = createPanel("card", "", i18n.t("data.card_title"), true);
    const distPanel = createPanel("dist", "", i18n.t("data.dist_title"), true);
    const cohortPanel = createPanel("cohort", "", i18n.t("data.cohort_title"));
    const browsePanel = createPanel("browse", "", i18n.t("data.browse_title"));
    const splitPanel = createPanel("split", "", i18n.t("data.split_title"));
    persistFold(cardPanel, "card");
    persistFold(distPanel, "dist");
    const infoLabel = i18n.t("data.info_label");
    addPanelInfo(cardPanel, i18n.t("data.card_info"), infoLabel);
    addPanelInfo(distPanel, i18n.t("data.dist_info"), infoLabel);
    addPanelInfo(cohortPanel, i18n.t("data.cohort_info"), infoLabel);
    addPanelInfo(browsePanel, i18n.t("data.browse_info"), infoLabel);
    addPanelInfo(splitPanel, i18n.t("data.split_info"), infoLabel);
    cohortPanel.box.hidden = true; // only a dataset with two cohorts has anything to compare
    page.append(cardPanel.box, distPanel.box, cohortPanel.box, browsePanel.box, splitPanel.box);
    root.appendChild(page);

    els = {
      title,
      statStrip,
      card: cardPanel.body,
      dist: distPanel.body,
      cohortBox: cohortPanel.box,
      cohort: cohortPanel.body,
      browse: browsePanel.body,
      split: splitPanel.body,
    };

    // the Distributions row re-plots when its panel changes width: a window resize, or unfolding the
    // panel (a folded panel is 0 px wide and plots nothing until it is shown)
    if (typeof ResizeObserver !== "undefined") {
      distObserver = new ResizeObserver(() => {
        window.clearTimeout(redrawTimer);
        redrawTimer = window.setTimeout(() => {
          if (!els || !lastStats) return;
          const w = els.dist.clientWidth;
          if (w >= MIN_PLOT_W && Math.abs(w - drawnWidth) >= 24) drawDistributions();
        }, 150);
      });
      distObserver.observe(distPanel.body);
    }
  }

  /** @param {any} state */
  function update(state) {
    if (!root || !ctx) return;
    const nextDataset = state.dataset || "";
    const nextLang = state.lang || "en";
    const nextTheme = state.theme || "light";
    if (nextDataset === dataset && nextLang === lang && nextTheme === theme && dataset) return;
    dataset = nextDataset;
    lang = nextLang;
    theme = nextTheme;
    if (!dataset) return;
    // Plotly bakes literal colours into each figure at render time (it doesn't follow CSS
    // variables), so a theme toggle needs the same reload as a dataset/language change to repaint
    // the charts - found live: after switching theme, the previous colours stayed frozen and
    // became unreadable against the new background.
    loadAll();
  }

  function unmount() {
    loadSeq += 1; // whatever is still in flight is for a page that is gone
    window.clearTimeout(redrawTimer);
    if (distObserver) distObserver.disconnect();
    distObserver = null;
    for (const c of [...liveCharts, ...distCharts]) c.destroy();
    liveCharts = [];
    distCharts = [];
    lastStats = null;
    root = null;
    ctx = null;
    els = null;
  }

  async function loadAll() {
    const { api, i18n } = ctx;
    const gen = (loadSeq += 1);
    for (const c of [...liveCharts, ...distCharts]) c.destroy();
    liveCharts = [];
    distCharts = [];
    lastStats = null;
    els.title.textContent = i18n.t("data.title", { dataset });

    let card;
    let stats;
    try {
      [card, stats] = await Promise.all([api.card(dataset), api.stats(dataset)]);
    } catch (err) {
      if (!isLive(gen)) return;
      els.card.innerHTML = "";
      const p = document.createElement("p");
      p.className = "muted";
      p.textContent = err && err.messageKey ? i18n.t(err.messageKey, err.params) : String(err);
      els.card.appendChild(p);
      return;
    }
    if (!isLive(gen)) return; // a newer load (another dataset, language or theme) took over
    renderStatStrip(stats, i18n);
    renderCard(card, i18n);
    lastStats = stats;
    drawDistributions();
    renderCohorts(stats, i18n);
    renderBrowse(i18n, gen);
    renderSplit(i18n, gen);
  }

  /** @param {any} stats @param {any} i18n */
  function renderStatStrip(stats, i18n) {
    els.statStrip.innerHTML = "";
    const texts = [
      i18n.t("data.stat_users", { n: stats.n_users }),
      i18n.t("data.stat_items", { n: stats.n_items }),
      i18n.t("data.stat_ratings", { n: stats.n_ratings }),
      i18n.t("data.stat_sparsity", { pct: (stats.sparsity * 100).toFixed(1) }),
    ];
    for (const text of texts) {
      const chip = document.createElement("span");
      chip.className = "chip";
      chip.textContent = text;
      els.statStrip.appendChild(chip);
    }
  }

  /** @param {any} cardResponse @param {any} i18n */
  function renderCard(cardResponse, i18n) {
    els.card.innerHTML = "";
    const data = cardResponse.card || {};
    const fingerprint = String(cardResponse.fingerprint || "").slice(0, 12);
    if (Object.keys(data).length === 0) {
      const p = document.createElement("p");
      p.className = "muted";
      p.textContent = i18n.t("data.no_card");
      const fp = document.createElement("p");
      fp.className = "muted mono";
      fp.textContent = `fingerprint ${fingerprint}`;
      els.card.append(p, fp);
      return;
    }
    // WP-95: two inner panels side by side - what the dataset IS (build facts + the command that
    // rebuilds it) and its Caveats - instead of one tall column that left the right half empty
    const grid = document.createElement("div");
    grid.className = "data-card-grid";
    const build = document.createElement("div");
    build.className = "data-subpanel";
    const buildHead = document.createElement("h4");
    buildHead.textContent = i18n.t("data.card_build");
    build.appendChild(buildHead);
    const dl = document.createElement("dl");
    dl.className = "data-dl";
    /** @param {string} labelKey @param {unknown} value */
    const row = (labelKey, value) => {
      if (value === undefined || value === null || value === "") return;
      const dt = document.createElement("dt");
      dt.textContent = i18n.t(labelKey);
      const dd = document.createElement("dd");
      dd.textContent = String(value);
      dl.append(dt, dd);
    };
    row("data.card_kind", data.kind);
    row("data.card_version", data.version);
    row("data.card_release", data.release); // WP-88: export tag (pre / final); hidden when untagged
    row("data.card_cohort", data.cohort);
    row("data.card_built_at", data.built_at);
    build.appendChild(dl);
    if (data.reproduction) {
      const pre = document.createElement("pre");
      pre.className = "data-repro";
      pre.textContent = data.reproduction;
      build.appendChild(pre);
    }
    grid.appendChild(build);
    if (Array.isArray(data.caveats) && data.caveats.length) {
      const caveats = document.createElement("div");
      caveats.className = "data-subpanel";
      const h4 = document.createElement("h4");
      h4.textContent = i18n.t("data.card_caveats");
      const ul = document.createElement("ul");
      for (const caveat of data.caveats) {
        const li = document.createElement("li");
        li.textContent = String(caveat);
        ul.appendChild(li);
      }
      caveats.append(h4, ul);
      grid.appendChild(caveats);
    } else {
      grid.classList.add("single");
    }
    els.card.appendChild(grid);
  }

  /**
   * One chart cell of the Distributions row: title, one-sentence caption, plot, footer chips.
   * @param {HTMLElement} parent
   * @param {string} title
   * @param {string} note
   * @param {string} tip the longer explanation behind the chart's ⓘ
   */
  function chartBox(parent, title, note, tip) {
    const box = document.createElement("div");
    box.className = "data-chart";
    const h4 = document.createElement("h4");
    h4.append(title, infoTip(tip, ctx.i18n.t("data.info_label")));
    const cap = document.createElement("p");
    cap.className = "data-chart-note";
    cap.textContent = note;
    const plot = document.createElement("div");
    plot.className = "data-chart-plot";
    const foot = document.createElement("div");
    foot.className = "trace-summary";
    box.append(h4, cap, plot, foot);
    parent.appendChild(box);
    return { plot, foot };
  }

  /**
   * @param {HTMLElement} foot
   * @param {Record<string, number>} quantiles
   * @param {any} i18n
   */
  function addQuantileChips(foot, quantiles, i18n) {
    const entries = /** @type {const} */ ([
      ["data.quantile_p10", "0.1"],
      ["data.quantile_p50", "0.5"],
      ["data.quantile_p90", "0.9"],
    ]);
    for (const [key, q] of entries) {
      const chip = document.createElement("span");
      chip.className = "pill";
      chip.textContent = i18n.t(key, { v: fmt(quantiles[q], 1) });
      foot.appendChild(chip);
    }
  }

  /**
   * The mean (solid), median (dashed) and mean ± std (dotted) lines over the rating histogram, as
   * Plotly line traces with a hover text each, plus the legend in the chart's footer. Empty unless
   * `ui.cohort_tables.hist_markers` is `card` or `all`, and for a dataset without ratings.
   * @param {number[]} counts
   * @param {[number, number][]} entries (rating value, count) per scale value, ascending
   * @param {any} i18n
   * @param {HTMLElement} foot
   * @returns {any[]}
   */
  function markerTraces(counts, entries, i18n, foot) {
    const mode = ctx.store.get().meta?.cohort_tables?.hist_markers;
    if (mode === "none" || !counts.some((c) => c > 0)) return [];
    const step = entries.length > 1 ? entries[1][0] - entries[0][0] : 1;
    const h = histStats(counts, { min: entries[0][0], step });
    const labels = {
      mean: i18n.t("cohort.card.marker.mean"),
      median: i18n.t("cohort.card.marker.median"),
      std: i18n.t("cohort.card.marker.std"),
    };
    foot.appendChild(markerLegend({ mean: h.mean, median: h.median, std: h.std, labels }));
    const css = getComputedStyle(document.documentElement);
    const color = (/** @type {string} */ name, /** @type {string} */ fallback) => css.getPropertyValue(name).trim() || fallback;
    const card = color("--card", "#fff");
    const styles = {
      mean: { color: color("--navy", "#1a237e"), width: 2, dash: "solid" },
      median: { color: color("--maroon", "#800000"), width: 2, dash: "dash" },
      std: { color: color("--strong", "#555"), width: 1.25, dash: "dot" },
    };
    const top = Math.max(...counts) * 1.04;
    const ys = Array.from({ length: 25 }, (_, k) => (k / 24) * top); // hover needs points along the line
    /** @type {[keyof typeof styles, number, string][]} */
    const lines = [];
    if (h.mean !== null && h.std !== null) {
      lines.push(["std", h.mean - h.std, `${labels.mean} − ${labels.std} ${(h.mean - h.std).toFixed(2)}`]);
      lines.push(["std", h.mean + h.std, `${labels.mean} + ${labels.std} ${(h.mean + h.std).toFixed(2)}`]);
    }
    if (h.median !== null) lines.push(["median", h.median, `${labels.median} ${fmtMedian(h.median)}`]);
    if (h.mean !== null) lines.push(["mean", h.mean, `${labels.mean} ${h.mean.toFixed(2)}`]);
    /** @type {any[]} */
    const traces = [];
    for (const [kind, value, text] of lines) {
      const x = ((value - entries[0][0]) / step); // position on the bars' axis: bin i is centred on i
      const xs = ys.map(() => x);
      const st = styles[kind];
      // halo first: a card-coloured wider line so the marker stays visible over a solid bar
      traces.push({ type: "scatter", mode: "lines", x: xs, y: ys, hoverinfo: "skip", line: { color: card, width: st.width + 3 } });
      traces.push({
        type: "scatter",
        mode: "lines",
        x: xs,
        y: ys,
        hovertemplate: `${text}<extra></extra>`,
        line: { color: st.color, width: st.width, dash: st.dash },
      });
    }
    return traces;
  }

  /**
   * A count histogram (per-user / per-item bins) on a LINEAR axis with one tick per bin: the bars sit at
   * 0..n-1 and `tickPlan` decides from the measured plot width whether the labels lie flat, tilt or
   * stand, so none overlaps or is cut (Plotly's own thinning of a category axis dropped labels).
   * @param {{plot: HTMLElement, foot: HTMLElement}} box a chart cell that is already in the grid
   * @param {{hist: {lo: number, hi: number, n: number, items?: string[]}[], quantiles: Record<string, number>, hoverKey: string, log?: boolean}} spec
   *   a bin's `items` (the server fills it for small bins only) are the titles its hover lists, one per line
   *   `log`: logarithmic count axis. A log axis cannot show 0 (an empty bin would vanish), so the bars are
   *   drawn at n + 1 from a baseline of 1 and the ticks are labelled with n (0, 1, 10, 100, 1k, ...): a bin
   *   of 0 sits on the baseline, the labels are honest counts, only the spacing is logarithmic, and the
   *   hovers show the real n.
   * @param {any} i18n
   */
  function binnedChart(box, spec, i18n) {
    const { plot, foot } = box;
    const chart = createChart(plot);
    distCharts.push(chart);
    if (drawnWidth >= MIN_PLOT_W) {
      const family = getComputedStyle(plot).fontFamily;
      const positions = spec.hist.map((_, i) => i);
      const counts = spec.hist.map((b) => b.n);
      const top = Math.max(0, ...counts);
      /** @type {Record<string, any>} */
      let yaxis = {};
      if (spec.log) {
        const ticks = [];
        for (let v = 1; v <= top; v *= 10) ticks.push(v);
        // WP-95: one more tick above the last power of ten - the first of 2 / 5 / 10 x that reaches the tallest bar
        // (4996 -> "5k") - so the bar can be read off; skipped when it would sit on the last label
        const topTick = niceCeil(top);
        const lastTick = ticks.length ? ticks[ticks.length - 1] : 0;
        const rangeTop = top > lastTick ? topTick : top;
        const span = Math.log10(rangeTop + 1) + (top > lastTick ? 0.06 : 0.12);
        const innerPx = Math.max(1, plot.clientHeight - PLOT_PAD_Y);
        if (
          top > lastTick &&
          topTick > lastTick &&
          ((Math.log10(topTick + 1) - Math.log10(lastTick + 1)) / span) * innerPx >= TICK_PX * 1.3 + 2
        ) {
          ticks.push(topTick);
        }
        // the "0" tick (the baseline, y = 1) sits log10(2) = 0.3 decades below the "1" tick (y = 2): on a short axis
        // (few decades) they clear each other, over 3.7 decades only ~11 px apart - then the baseline stays unlabelled
        // (no bar = 0, said in the chart's caption) instead of printing "0" and "1" over each other
        const gap01 = (Math.log10(2) / span) * innerPx;
        if (gap01 >= TICK_PX * 1.3 + 2) ticks.unshift(0);
        yaxis = {
          type: "log",
          range: [0, span],
          tickmode: "array",
          tickvals: ticks.map((n) => n + 1),
          ticktext: ticks.map((n) => compactCount(n)),
          tickfont: { size: TICK_PX },
        };
      }
      const plan = tickPlan(
        spec.hist.map((b) => binLabel(b.lo, b.hi, compactCount)),
        plot.clientWidth - PLOT_PAD_X,
        family
      );
      chart.render(
        [
          {
            type: "bar",
            x: positions,
            y: spec.log ? counts.map((n) => n + 1) : counts,
            // WP-95: a small bin also names its items (the server sends `items` for it only), one title per line
            hovertext: spec.hist.map(
              (b) =>
                i18n.t(b.n === 1 ? `${spec.hoverKey}_one` : spec.hoverKey, { bin: binLabel(b.lo, b.hi, String), n: b.n }) +
                (b.items?.length ? `<br>${b.items.map(hoverSafe).join("<br>")}` : "")
            ),
            hoverinfo: "text",
          },
        ],
        {
          xaxis: {
            tickmode: "array",
            tickvals: positions,
            ticktext: plan.text,
            tickangle: plan.angle,
            tickfont: { size: TICK_PX },
            automargin: true, // a tilted label gets the room it needs instead of being cut
            range: [-0.5, positions.length - 0.5],
          },
          yaxis,
        }
      );
    }
    addQuantileChips(foot, spec.quantiles, i18n);
  }

  /**
   * The Distributions row: rating values, ratings per user, raters per item, and the long tail -
   * four charts of one height. Drawn from `lastStats`; called again when the panel's width changes.
   */
  function drawDistributions() {
    if (!els || !lastStats) return;
    const { i18n } = ctx;
    const stats = lastStats;
    for (const c of distCharts) c.destroy();
    distCharts = [];
    els.dist.innerHTML = "";
    const grid = document.createElement("div");
    grid.className = "data-chart-grid";
    els.dist.appendChild(grid);
    drawnWidth = els.dist.clientWidth; // 0 while the panel is folded: boxes without plots until it is shown

    const ratingEntries = Object.entries(/** @type {Record<string, number>} */ (stats.rating_hist))
      .map(([k, v]) => /** @type {[number, number]} */ ([Number(k), v]))
      .sort((a, b) => a[0] - b[0]);
    // all four cells first: the grid sizes its columns from the number of cells, so a plot measured
    // while only one or two exist is wider than it will be and its tick labels would be planned for that
    const ratingBox = chartBox(grid, i18n.t("data.dist_ratings"), i18n.t("data.dist_ratings_note"), i18n.t("data.dist_ratings_info"));
    const usersBox = chartBox(grid, i18n.t("data.dist_users"), i18n.t("data.dist_users_note"), i18n.t("data.dist_users_info"));
    const itemsBox = chartBox(grid, i18n.t("data.dist_items"), i18n.t("data.dist_items_note"), i18n.t("data.dist_items_info"));
    const tailBox = chartBox(grid, i18n.t("data.longtail_title"), i18n.t("data.longtail_note"), i18n.t("data.longtail_info"));
    const { plot: ratingPlot, foot: ratingFoot } = ratingBox;
    const ratingChart = createChart(ratingPlot);
    distCharts.push(ratingChart);
    const ratingLabels = ratingEntries.map(([k]) => String(k));
    // WP-83: bars sit at the integer positions 0..n-1 of a LINEAR axis (ticks carry the star
    // labels) so the mean / median / ± std lines can sit between them - bin i spans i ± 0.5, the same
    // continuous axis the Users / Items histograms use (sparkline-hist.js)
    const positions = ratingEntries.map((_, i) => i);
    const counts = ratingEntries.map(([, v]) => v);
    const ratingTraces = markerTraces(counts, ratingEntries, i18n, ratingFoot);
    if (drawnWidth >= MIN_PLOT_W) {
      ratingChart.render(
        [
          {
            type: "bar",
            x: positions,
            y: counts,
            // WP-95: "★ 5: 269 ratings" - never Plotly's "trace 0 (5, 269)"
            hovertext: ratingEntries.map(([star, n]) => i18n.t(n === 1 ? "data.hover_rating_one" : "data.hover_rating", { star, n })),
            hoverinfo: "text",
          },
          ...ratingTraces,
        ],
        // every half-star value gets its own tick (Plotly's auto-thinning would otherwise hide the
        // rare ones, e.g. the toy fixture's single 4.5 - the point of this chart is the granularity)
        {
          xaxis: {
            tickmode: "array",
            tickvals: positions,
            ticktext: ratingLabels,
            tickfont: { size: TICK_PX },
            range: [-0.5, positions.length - 0.5],
          },
        }
      );
    }

    binnedChart(
      usersBox,
      {
        hist: stats.user_count_hist,
        quantiles: stats.user_count_quantiles,
        hoverKey: "data.hover_users",
      },
      i18n
    );
    binnedChart(
      itemsBox,
      {
        hist: stats.item_count_hist,
        quantiles: stats.item_count_quantiles,
        hoverKey: "data.hover_items",
        log: true, // WP-95: in a class set the first bin holds nearly every item - the rest must stay visible
      },
      i18n
    );
    drawLongtail(tailBox, stats, i18n);
  }

  /** The long-tail (Lorenz) curve in the fourth cell of the row. @param {{plot: HTMLElement, foot: HTMLElement}} box @param {any} stats @param {any} i18n */
  function drawLongtail(box, stats, i18n) {
    const { plot, foot } = box;
    const chart = createChart(plot);
    distCharts.push(chart);
    if (drawnWidth >= MIN_PLOT_W) {
      // WP-95: the chart explains itself, without a legend (two items do not earn the room): axis titles, a small
      // "equal" at the end of the dotted diagonal, and the 80 % point of the curve - the same number as the
      // "Items for 80% of ratings" chip below - marked and named by a short leader line
      const colors = themeColors();
      const family = getComputedStyle(plot).fontFamily;
      const n80 = stats.items_for_80pct_ratings;
      const x80 = n80 / Math.max(1, stats.n_items);
      const lines = [i18n.t("data.longtail_p80_a"), i18n.t("data.longtail_p80_b", { n: n80 })];
      const innerW = Math.max(1, plot.clientWidth - TAIL_MARGIN.l - TAIL_MARGIN.r);
      const half = Math.max(...lines.map((l) => textWidth(l, family))) / 2 + 4;
      // the text sits below-right of the point (under the diagonal, clear of the curve); kept inside the plot
      const ax = Math.max(half - x80 * innerW, Math.min(30, innerW - x80 * innerW - half));
      const axisTitle = (/** @type {string} */ text) => ({ text, font: { size: TICK_PX, color: colors.muted }, standoff: 2 });
      chart.render(
        [
          {
            type: "scatter",
            mode: "lines",
            x: stats.lorenz.x,
            y: stats.lorenz.y,
            // "top 15 % of items hold 33.1 % of ratings" at every sampled point of the curve
            hovertext: stats.lorenz.x.map((/** @type {number} */ x, /** @type {number} */ i) =>
              i18n.t("data.hover_longtail", { x: Math.round(x * 100), y: (stats.lorenz.y[i] * 100).toFixed(1) })
            ),
            hoverinfo: "text",
          },
          { type: "scatter", mode: "lines", x: [0, 1], y: [0, 1], line: { dash: "dot" }, hoverinfo: "skip" },
          {
            type: "scatter",
            mode: "markers",
            x: [x80],
            y: [0.8],
            marker: { color: colors.maroon, size: 7 },
            hoverinfo: "skip",
          },
        ],
        {
          margin: TAIL_MARGIN,
          xaxis: { title: axisTitle(i18n.t("data.longtail_x")), tickfont: { size: TICK_PX } },
          yaxis: { title: axisTitle(i18n.t("data.longtail_y")), tickfont: { size: TICK_PX } },
          annotations: [
            {
              x: x80,
              y: 0.8,
              ax,
              ay: 46,
              axref: "pixel",
              ayref: "pixel",
              text: lines.join("<br>"),
              showarrow: true,
              arrowhead: 0,
              arrowwidth: 1,
              arrowcolor: colors.muted,
              font: { size: TICK_PX, color: colors.ink },
              align: "center",
            },
            {
              x: 1,
              y: 0.86,
              xanchor: "right",
              yanchor: "top",
              text: i18n.t("data.longtail_equal"),
              showarrow: false,
              font: { size: TICK_PX - 1, color: colors.muted },
            },
          ],
        }
      );
    }
    const texts = [
      i18n.t("data.gini", { v: fmt(stats.gini_item_popularity, 3) }),
      i18n.t("data.items_for_80pct", { v: stats.items_for_80pct_ratings }),
      i18n.t("data.long_tail_share", { v: `${(stats.long_tail_share * 100).toFixed(1)}%` }),
    ];
    for (const text of texts) {
      const chip = document.createElement("span");
      chip.className = "pill";
      chip.textContent = text;
      foot.appendChild(chip);
    }
  }

  /**
   * Only a dataset with two cohorts (class + MovieLens) has anything to compare: the panel stays
   * hidden otherwise (WP-95 - "only one cohort" is no content).
   * @param {any} stats @param {any} i18n
   */
  function renderCohorts(stats, i18n) {
    els.cohort.innerHTML = "";
    const cohorts = stats.cohorts || {};
    const present = ["class", "ml"].filter((name) => cohorts[name]);
    els.cohortBox.hidden = present.length < 2;
    if (present.length < 2) return;
    const metrics = /** @type {const} */ ([
      ["data.cohort_metric_users", "n_users", 0],
      ["data.cohort_metric_ratings", "n_ratings", 0],
      ["data.cohort_metric_mean", "mean_rating", 2],
      ["data.cohort_metric_median", "median_rating", 2],
      ["data.cohort_metric_per_user", "ratings_per_user", 1],
    ]);
    const table = document.createElement("table");
    table.className = "data-table-plain";
    const head = document.createElement("tr");
    head.appendChild(document.createElement("th"));
    for (const name of present) {
      const th = document.createElement("th");
      th.className = "num";
      th.textContent = i18n.t(name === "class" ? "data.cohort_class" : "data.cohort_ml");
      head.appendChild(th);
    }
    table.appendChild(head);
    for (const [labelKey, field, decimals] of metrics) {
      const tr = document.createElement("tr");
      const th = document.createElement("th");
      th.textContent = i18n.t(labelKey);
      tr.appendChild(th);
      for (const name of present) {
        const td = document.createElement("td");
        td.className = "num";
        td.textContent = fmt(cohorts[name][field], decimals);
        tr.appendChild(td);
      }
      table.appendChild(tr);
    }
    els.cohort.appendChild(table);
  }

  /** One sentence under a panel title: what the panel is for. @param {string} text */
  function lede(text) {
    const p = document.createElement("p");
    p.className = "sub data-lede";
    p.textContent = text;
    return p;
  }

  /** @param {any} i18n @param {number} gen load generation these pickers belong to */
  function renderBrowse(i18n, gen) {
    els.browse.innerHTML = "";
    const grid = document.createElement("div");
    grid.className = "data-browse-grid";
    const userCol = document.createElement("div");
    const itemCol = document.createElement("div");
    const userPickerRoot = document.createElement("div");
    const itemPickerRoot = document.createElement("div");
    const userProfile = document.createElement("div");
    userProfile.className = "data-profile";
    const itemProfile = document.createElement("div");
    itemProfile.className = "data-profile";
    userCol.append(userPickerRoot, userProfile);
    itemCol.append(itemPickerRoot, itemProfile);
    grid.append(userCol, itemCol);
    els.browse.append(lede(i18n.t("data.browse_note")), grid);

    renderProfilePlaceholder(userProfile, i18n);
    renderProfilePlaceholder(itemProfile, i18n);

    const noGuards = { minRatings: 0, requireClass: false, minRaters: 0, ratedByUser: false };
    /** the list order each column last used - kept across picks while the page lives */
    const orders = { user: "recent", item: "recent" };
    /**
     * @param {"user" | "item"} kind
     * @param {HTMLElement} pickerRoot
     * @param {HTMLElement} profile
     */
    const column = (kind, pickerRoot, profile) => {
      /** @type {number | null} */
      let selected = null;
      async function load() {
        if (selected === null) return;
        const mine = (profileSeq[kind] += 1);
        // stale = the page reloaded, was left, or this column was asked again since
        const stale = () => !isLive(gen) || mine !== profileSeq[kind];
        try {
          const detail = await ctx.api[kind](dataset, selected, { limit: PROFILE_ROWS, order: orders[kind] });
          if (stale()) return;
          renderProfile(profile, kind, detail, i18n, orders[kind], (order) => {
            orders[kind] = order;
            load();
          });
        } catch (err) {
          if (stale()) return;
          renderProfileError(profile, err, i18n);
        }
      }
      createEntityPicker(pickerRoot, {
        i18n: ctx.i18n,
        api: ctx.api,
        kind,
        dataset,
        guards: noGuards,
        showSelected: false, // the profile below names the entity; the picker would say it twice
        onSelect: (index) => {
          selected = index;
          load();
        },
      });
    };
    column("user", userPickerRoot, userProfile);
    column("item", itemPickerRoot, itemProfile);
  }

  /** @param {HTMLElement} container @param {any} i18n */
  function renderProfilePlaceholder(container, i18n) {
    container.innerHTML = "";
    const p = document.createElement("p");
    p.className = "muted";
    p.textContent = i18n.t("data.profile_no_selection");
    container.appendChild(p);
  }

  /** @param {HTMLElement} container @param {any} err @param {any} i18n */
  function renderProfileError(container, err, i18n) {
    container.innerHTML = "";
    const p = document.createElement("p");
    p.className = "muted";
    p.textContent = err && err.messageKey ? i18n.t(err.messageKey, err.params) : String(err);
    container.appendChild(p);
  }

  /**
   * One line names the entity (chip + its rating count), then the ratings list with a Recent / Top /
   * Bottom switch: newest first, highest first, lowest first (ties: newest) - the same number of rows.
   * @param {HTMLElement} container
   * @param {"user" | "item"} kind
   * @param {any} detail
   * @param {any} i18n
   * @param {string} order the list order shown now
   * @param {(order: string) => void} onOrder
   */
  function renderProfile(container, kind, detail, i18n, order, onOrder) {
    container.innerHTML = "";
    const head = document.createElement("div");
    head.className = "trace-summary";
    const nameChip = document.createElement("span");
    nameChip.className = "chip on";
    const t = (/** @type {string} */ k, /** @type {Record<string, unknown> | undefined} */ p) => i18n.t(k, p);
    if (kind === "user" && isLinkUrl(detail.profile_url)) {
      // WP-96 (Browse): the user's name opens the Letterboxd profile - the server fills `profile_url` only while the
      // real handle is shown; without it the chip is the plain text it always was
      nameChip.appendChild(entityLabel({ label: detail.label, profile_url: detail.profile_url }, { t }));
    } else if (kind === "item" && isLinkUrl(detail.film_url)) {
      // WP-99 (Browse): the film's title opens its Letterboxd / TMDB page (public data: every mode)
      nameChip.appendChild(entityLabel({ label: detail.title, film_url: detail.film_url }, { t }));
    } else {
      nameChip.textContent = kind === "user" ? detail.label : detail.title;
    }
    const countChip = document.createElement("span");
    countChip.className = "pill";
    countChip.textContent = i18n.t("data.profile_total_ratings", { n: detail.total_ratings });
    head.append(nameChip, countChip);
    container.appendChild(head);

    const bar = document.createElement("div");
    bar.className = "data-profile-bar";
    const h5 = document.createElement("h5");
    h5.textContent = i18n.t("data.profile_ratings");
    const seg = document.createElement("div");
    seg.className = "miniseg data-order";
    seg.setAttribute("role", "group");
    for (const o of ORDERS) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = i18n.t(`data.profile_order_${o}`);
      btn.title = i18n.t(`data.profile_order_${o}_tip`);
      btn.dataset.order = o;
      btn.classList.toggle("active", o === order);
      btn.setAttribute("aria-pressed", String(o === order));
      btn.addEventListener("click", () => {
        if (o === order) return;
        for (const other of seg.querySelectorAll("button")) other.classList.toggle("active", other === btn);
        onOrder(o);
      });
      seg.appendChild(btn);
    }
    bar.append(h5, seg);
    container.appendChild(bar);

    // fixed columns (title | date | rating): the date column has one width in every row, the rating is
    // right-aligned with tabular digits, so a long title never moves the other two
    const table = document.createElement("table");
    table.className = "data-table-plain data-ratings";
    const cols = document.createElement("colgroup");
    for (const c of ["dr-title", "dr-date", "dr-rating"]) {
      const col = document.createElement("col");
      col.className = c;
      cols.appendChild(col);
    }
    table.appendChild(cols);
    for (const r of detail.ratings.slice(0, PROFILE_ROWS)) {
      const tr = document.createElement("tr");
      const tdLabel = document.createElement("td");
      tdLabel.className = "dr-title";
      if (kind === "item" && isLinkUrl(r.profile_url)) {
        tdLabel.appendChild(entityLabel(r, { t })); // WP-96 (Browse): an item's rater row links its user
      } else if (kind === "user" && isLinkUrl(r.film_url)) {
        tdLabel.appendChild(entityLabel(r, { t })); // WP-99 (Browse): a user's rating row links its film
      } else {
        tdLabel.textContent = r.label;
        tdLabel.title = r.label;
      }
      const tdDate = document.createElement("td");
      tdDate.className = "dr-date";
      tdDate.textContent = fmtDate(r.timestamp);
      const tdRating = document.createElement("td");
      tdRating.className = "num";
      tdRating.textContent = fmt(r.rating, 1);
      tr.append(tdLabel, tdDate, tdRating);
      table.appendChild(tr);
    }
    container.appendChild(table);
  }

  /**
   * @param {number} value
   * @param {number} min
   * @param {number} max
   * @param {number} step
   */
  function numberInput(value, min, max, step) {
    const input = document.createElement("input");
    input.type = "number";
    input.value = String(value);
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    return input;
  }

  /**
   * @param {string} labelKey
   * @param {HTMLElement} input
   * @param {any} i18n
   */
  function labeled(labelKey, input, i18n) {
    const wrap = document.createElement("label");
    wrap.className = "field";
    const span = document.createElement("span");
    span.textContent = i18n.t(labelKey);
    wrap.append(span, input);
    return wrap;
  }

  /** @param {any} i18n @param {number} gen load generation this form belongs to */
  function renderSplit(i18n, gen) {
    els.split.innerHTML = "";
    const form = document.createElement("div");
    form.className = "trace-form";

    const methodSel = document.createElement("select");
    for (const m of SPLIT_METHODS) {
      const opt = document.createElement("option");
      opt.value = m;
      opt.textContent = m;
      methodSel.appendChild(opt);
    }
    const testFrac = numberInput(0.2, 0, 0.9, 0.05);
    const validFrac = numberInput(0, 0, 0.9, 0.05);
    const minRatings = numberInput(5, 1, 1000, 1);
    const kUser = numberInput(0, 0, 1000, 1);
    const kItem = numberInput(0, 0, 1000, 1);
    const seed = numberInput(42, 0, 1000000, 1);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn btn-primary btn-sm";
    btn.textContent = i18n.t("data.split_preview_btn");

    form.append(
      labeled("data.split_method", methodSel, i18n),
      labeled("data.split_test_frac", testFrac, i18n),
      labeled("data.split_valid_frac", validFrac, i18n),
      labeled("data.split_min_ratings", minRatings, i18n),
      labeled("data.split_kcore_user", kUser, i18n),
      labeled("data.split_kcore_item", kItem, i18n),
      labeled("data.split_seed", seed, i18n),
      btn
    );
    const result = document.createElement("div");
    els.split.append(lede(i18n.t("data.split_note")), form, result);

    btn.addEventListener("click", async () => {
      result.innerHTML = "";
      const mine = (splitSeq += 1);
      const stale = () => !isLive(gen) || mine !== splitSeq; // the dataset changed, or a newer preview was asked
      try {
        const res = await ctx.api.splitPreview(dataset, {
          method: methodSel.value,
          test_frac: Number(testFrac.value),
          valid_frac: Number(validFrac.value),
          min_ratings: Number(minRatings.value),
          k_core_user: Number(kUser.value),
          k_core_item: Number(kItem.value),
          seed: Number(seed.value),
        });
        if (stale()) return;
        renderSplitResult(result, res, i18n);
      } catch (err) {
        if (stale()) return;
        const p = document.createElement("p");
        p.className = "muted";
        p.textContent =
          err && err.messageKey ? i18n.t(err.messageKey, err.params) : i18n.t("data.split_unavailable");
        result.appendChild(p);
      }
    });
  }

  /** @param {HTMLElement} container @param {any} res @param {any} i18n */
  function renderSplitResult(container, res, i18n) {
    const c = themeColors();
    const plot = document.createElement("div");
    plot.className = "data-chart-plot small";
    container.appendChild(plot);
    const chart = createChart(plot);
    liveCharts.push(chart);
    // WP-95: "Train: 5,000 ratings" (Plotly fills %{x}); the trace-name box is switched off with <extra>
    const splitHover = (/** @type {string} */ key) =>
      `${i18n.t("data.hover_split", { part: i18n.t(key), n: "%{x:,}" })}<extra></extra>`;
    chart.render(
      [
        {
          type: "bar",
          orientation: "h",
          y: [""],
          x: [res.sizes.train],
          name: i18n.t("data.split_train"),
          hovertemplate: splitHover("data.split_train"),
          marker: { color: c.navy },
        },
        {
          type: "bar",
          orientation: "h",
          y: [""],
          x: [res.sizes.valid],
          name: i18n.t("data.split_valid"),
          hovertemplate: splitHover("data.split_valid"),
          marker: { color: c.green },
        },
        {
          type: "bar",
          orientation: "h",
          y: [""],
          x: [res.sizes.test],
          name: i18n.t("data.split_test"),
          hovertemplate: splitHover("data.split_test"),
          marker: { color: c.maroon },
        },
      ],
      { barmode: "stack", showlegend: true, margin: { l: 8, r: 12, t: 8, b: 28 } }
    );
    const chips = document.createElement("div");
    chips.className = "trace-summary";
    if (res.k_core) {
      const chip = document.createElement("span");
      chip.className = "pill";
      chip.textContent = i18n.t("data.split_kcore_delta", {
        users: res.k_core.users_kept,
        items: res.k_core.items_kept,
        iters: res.k_core.iterations,
        before: res.n_before_kcore.test,
        after: res.sizes.test,
      });
      chips.appendChild(chip);
    }
    const leak = document.createElement("span");
    leak.className = res.leakage.ok ? "pill" : "pill tag-fault";
    leak.textContent = res.leakage.ok
      ? i18n.t("data.split_leakage_ok")
      : i18n.t("data.split_leakage_bad", { n: res.leakage.n_train_test_overlap });
    chips.appendChild(leak);
    container.appendChild(chips);
  }

  return { mount, update, unmount };
}
