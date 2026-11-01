// @ts-check
// WP-222: the weighted hybrid's trajectory curve (the Weights tab): the held-out error after every gradient step, with three flat reference lines - the equal weights (where the descent starts),
// the best single base, and the closed form (where the descent is heading). Reads `trace.views.curve` (CurveView: `y` is the descent for step 0..K, `series` holds the three constants).
// The same job as components/curve-panel.js (the training curve of the model pages, the dnn-agent's), with this page's own rules, so neither has to know the other - the standard view key is
// shared, the drawing is not: curve-panel.js puts a series that is not `valid_*` on a second axis, here all three flat lines share the main axis with the descent:
//   * `curve` highlights say how many points of the descent to reveal (rows = [number of points]: steps 0..k = k + 1), the max over the persisted highlights of earlier steps and the current one;
//   * the equal-weights line and the best-single line are there from the first point (they are known before the descent starts); the closed-form line appears at the step that first lights the
//     `profile` view - the closed-form step - so the curve does not give the answer away before the walk has computed it;
//   * every axis range is fixed to the whole run, so the picture never rescales while the player advances.
// WP-235: what the learner reads off it (the user's walk of 2026-10-24: the descent was a flat line, the references sat on top of it, nothing said how much was gained):
//   * the y range is fitted to the DESCENT (and the closed-form level, its destination), a tenth of its span either side: the curve fills the plot. A reference that falls outside it - the best
//     single base usually does - is not drawn as a line but named at the plot's edge with its value and an arrow ("best recommender alone 0.957 ↑");
//   * every reference line is labelled with its VALUE at the plot's right edge (the labels are spread so none sits on another); the lines are drawn first, the descent over them;
//   * the point the walk has just placed is large, in the tone of what the step did - green ▼ the error fell, red ▲ it rose, grey = it moved by less than 1e-4 - with the glyph and the error
//     beside it; the next step moves it on (a temporary mark: the picture is redrawn at every step); the last value is labelled once the walk stands elsewhere;
//   * a line above the plot says how much the error has fallen since the equal start (the difference and the share); its hover sentence says what the 30 steps are and that there is no early stop;
//   * once the closed form is known, the first step at which no weight is further from it than `hybrid_notes.gd_tol` is starred ("reached the closed form at step k"), or the line says how far
//     the descent still is from it after the K steps.
// The numbers behind all of it are util/hybrid-curve-model.js (pure, pinned under node).

import { fmt } from "../util/format.js"; // WP-235: the figures, the signed fall, the numbers behind the descent (util/hybrid-curve-model.js)
import { signed } from "../util/heat-centred.js";
import { TREND_GLYPH, firstFlatStep, gainOf, reachedStep, spreadLevels, tickedRange, trendOf, widestGap } from "../util/hybrid-curve-model.js"; // WP-235a: tickedRange, firstFlatStep
import { firstHighlight } from "../util/hybrid-tabs.js";
import { createChart, themeColors } from "./chart.js";

/** the flat reference lines in the order they are drawn, with their dash, the name of the theme colour the line wears and the one its label wears (the muted grey of a dotted line is 3.5 : 1 as text) */
const FLAT = /** @type {const} */ ([ // WP-235: + the ink of each label
  { key: "equal", dash: "dot", color: "muted", text: "strong" },
  { key: "best_single", dash: "dash", color: "ink", text: "ink" },
  { key: "ridge", dash: "dash", color: "maroon", text: "maroon" },
]);

/** WP-235: the height in px that two labels at the plot's edge need between them (11 px text) */
const LABEL_GAP_PX = 15;

/** @param {string} name @param {string} fallback */
function token(name, fallback) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

/**
 * @param {HTMLElement} root
 * @param {{i18n: any, tol?: number}} ctx WP-235: `tol`: how close every weight must be to the closed form for the descent to have "reached" it (`config/algorithms.yaml: hybrid_notes.gd_tol`)
 */
export function createHybridCurve(root, ctx) {
  /** @type {any} */
  let view = null;
  /** @type {any} */
  let chart = null;
  /** the index of the first step that lights the weights view: from there on the closed-form line is drawn @type {number} */
  let ridgeAt = -1;
  /** @type {string | null} */
  let lastKey = null;
  /** @type {ResizeObserver | null} */
  let observer = null;
  /** WP-235: the picture takes its colours when it is drawn, so a change of theme draws it again @type {MutationObserver | null} */
  let themeObserver = null;
  /** the line above the plot @type {HTMLElement | null} */
  let note = null;
  /** the chart's own box (the plot's height is read off it) @type {HTMLElement | null} */
  let hostEl = null;
  /** the first step at which every weight is within the tolerance of the closed form (null: never, or not known) @type {number | null} */
  let reachedAt = null;
  /** how far the last step's weights are from the closed form (null: not known) @type {number | null} */
  let finalGap = null;
  /** WP-235a: the first step that moves the error by less than 1e-4 (null: none does) @type {number | null} */
  let flatAt = null;

  /** @param {(number | null)[]} values */
  function finite(values) {
    return values.filter((v) => v !== null && v !== undefined && Number.isFinite(v)).map((v) => /** @type {number} */ (v));
  }

  /** WP-235: the frame the picture was last drawn for: a change of the box's height draws it again (the labels beside the plot are spread by the plot's height) @type {import("./trace-player.js").Frame | null} */
  let lastFrame = null;
  /** the chart box changed size (the tab was opened, the window moved): take its size, and draw again if its height is not the one the picture was drawn for */
  function resized() {
    chart?.resize();
    if (lastFrame) api.apply(lastFrame);
  }

  const api = {
    /** @param {any} trace */
    reset(trace) {
      view = trace.views?.curve || null;
      lastFrame = null; // WP-235
      ridgeAt = firstHighlight(trace.steps, "profile");
      lastKey = null;
      reachedAt = null; // WP-235
      finalGap = null;
      flatAt = null; // WP-235a
      observer?.disconnect();
      observer = null;
      themeObserver?.disconnect(); // WP-235
      themeObserver = null;
      if (chart) {
        chart.destroy();
        chart = null;
      }
      root.innerHTML = "";
      note = null; // WP-235
      hostEl = null;
      if (!view || !view.x?.length) {
        const p = document.createElement("p");
        p.className = "formula-idle";
        p.textContent = ctx.i18n.t("hybrid.walk.no_curve");
        root.appendChild(p);
        return;
      }
      flatAt = firstFlatStep(view.y.map(Number)); // WP-235a
      // WP-235: the descent's weights against the closed form's: where it arrives, and how far from it it ends
      const rows = /** @type {Record<string, any>[]} */ (trace.tables?.trajectory?.rows || []);
      const keys = (trace.tables?.trajectory?.columns || []).map((/** @type {{key: string}} */ c) => c.key).filter((/** @type {string} */ k) => k.startsWith("a_"));
      const baseRows = /** @type {Record<string, any>[]} */ (trace.tables?.bases?.rows || []);
      const star = keys.map((/** @type {string} */ k) => Number(baseRows.find((b) => `a_${b.id}` === k)?.alpha_ridge));
      if (rows.length && keys.length && star.every(Number.isFinite)) {
        reachedAt = reachedStep(rows, keys, star, ctx.tol ?? 0);
        finalGap = widestGap(rows[rows.length - 1], keys, star);
      }
      note = document.createElement("div");
      note.className = "hybrid-curve-note";
      note.title = ctx.i18n.t("hybrid.walk.curve.steps_hint", { K: view.x.length - 1 });
      root.appendChild(note);
      const host = document.createElement("div");
      host.className = "hybrid-curve-host";
      root.appendChild(host);
      hostEl = host; // WP-235
      chart = createChart(host);
      // the chart is the Weights tab's body: drawn while the tab is closed it has no size, and the box can change (the window, presenting mode): the host's size is followed
      if (typeof ResizeObserver !== "undefined") {
        observer = new ResizeObserver(resized); // WP-235
        observer.observe(host);
      }
      if (typeof MutationObserver !== "undefined") { // WP-235: a change of theme draws the picture again (it takes its colours when drawn)
        themeObserver = new MutationObserver(() => lastFrame && api.apply(lastFrame)); // the key of `apply` holds the theme: a changed one draws again
        themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
      }
    },
    /** the tab was opened: take the box's size */
    resize() {
      resized(); // WP-235
    },
    /** @param {import("./trace-player.js").Frame} frame */
    apply(frame) {
      if (!view || !chart) return;
      lastFrame = frame; // WP-235
      let upto = 0;
      for (const h of frame.highlights) {
        if (h.view !== "curve") continue;
        for (const r of h.rows || []) upto = Math.max(upto, r);
      }
      const showRidge = ridgeAt >= 0 && frame.index >= ridgeAt;
      const placing = frame.step?.node_id === "gd"; // WP-235: a gradient step has just put (or folded up to) a point
      const key = `${upto}|${showRidge ? 1 : 0}|${placing ? 1 : 0}|${document.documentElement.dataset.theme ?? ""}|${Math.round(hostEl?.clientHeight ?? 0)}`;
      if (key === lastKey) return;
      lastKey = key;
      const { i18n } = ctx;
      const c = themeColors();
      const red = token("--red", "#c0392b"); // WP-235
      const n = Math.min(upto, view.x.length);
      const x = view.x.slice(0, n);
      const first = view.x[0];
      const last = view.x[view.x.length - 1];
      const ys = /** @type {number[]} */ (view.y); // WP-235
      const refs = FLAT.map((flat) => ({ flat, level: finite(view.series?.[flat.key] || [])[0] })).filter((r) => r.level !== undefined);
      // the y range holds the descent and where it is heading (the closed form's level), nothing else: the curve fills the plot
      const ridge = refs.find((r) => r.flat.key === "ridge");
      const { lo, hi, dtick } = tickedRange([...finite(ys), ...(ridge ? [ridge.level] : [])], 0.1); // WP-235a: the bottom is one tick under the lowest value: the flat tail stands clear of the x axis
      const width = root.clientWidth || 600;
      const plotPx = Math.max(60, (hostEl?.clientHeight || 160) - 48); // the plot's height: the box less the margins (top 10, bottom 38)

      /** @type {any[]} */
      const traces = [];
      /** @type {any[]} */
      const annotations = []; // WP-235
      /** the reference labels waiting for their place at the right edge: where each wants to stand, and what it says @type {{key: string, y: number, text: string, color: string}[]} */
      const labels = [];
      for (const { flat, level } of refs) {
        if (n < 1 || (flat.key === "ridge" && !showRidge)) continue; // nothing is drawn before the descent has a first point; the closed form waits for its step
        const name = i18n.t(view.series_label_keys?.[flat.key] || `curve.hybrid_${flat.key}`);
        const value = fmt(level, 4);
        const textColor = flat.text === "strong" ? token("--strong", c.ink) : flat.text === "maroon" ? c.maroon : c.ink; // WP-235: the label's own ink (the dotted line's grey is too light as text)
        if (level >= lo && level <= hi) {
          traces.push({ x: [first, last], y: [level, level], mode: "lines", name, line: { color: c[flat.color], dash: flat.dash, width: 1.5 }, hoverinfo: "y+name" });
          labels.push({ key: flat.key, y: level, text: i18n.t("hybrid.walk.curve.ref", { name, value }), color: textColor });
        } else {
          // off the plot: named at its edge, with the way to it (the best single base is usually above the whole descent)
          const above = level > hi;
          labels.push({ key: flat.key, y: above ? hi : lo, text: i18n.t(above ? "hybrid.walk.curve.off_up" : "hybrid.walk.curve.off_down", { name, value }), color: textColor });
        }
      }
      // WP-235: the labels stand beside the plot, a line each, in the plot's own extent (0 = its bottom, 1 = its top: Plotly draws no annotation whose data position is off the axis, and one in the margin
      // may be cut); two levels close together are pushed apart
      const spread = spreadLevels(labels.map((l) => ({ key: l.key, y: (l.y - lo) / (hi - lo) })), LABEL_GAP_PX / plotPx, [0, 1]);
      for (const l of labels) {
        annotations.push({ xref: "paper", x: 1, xanchor: "left", xshift: 6, yref: "paper", y: spread[l.key], yanchor: "middle", text: l.text, showarrow: false, align: "left", font: { size: 11, color: l.color } });
      }
      const widest = Math.max(0, ...labels.map((l) => l.text.length));

      // the descent: the points the walk has placed, over the lines; the point just placed is large and wears the tone of what the step did
      const sizes = x.map(() => 5);
      const fills = x.map(() => c.navy);
      const move = placing && n >= 2 ? trendOf(ys[n - 2], ys[n - 1]) : null;
      if (move) {
        sizes[n - 1] = 11;
        fills[n - 1] = move === "down" ? c.green : move === "up" ? red : c.muted;
      }
      traces.push({
        x,
        y: ys.slice(0, n),
        mode: "lines+markers",
        name: i18n.t(view.y_label_key || "curve.hybrid_rmse"),
        line: { color: c.navy },
        marker: { color: fills, size: sizes, line: { color: c.navy, width: move ? 2 : 0 } },
      });
      if (move) {
        // the glyph carries the tone (the colour is not the only cue) and the number beside it is the error the step reached
        const tone = move === "down" ? c.green : move === "up" ? red : c.muted;
        annotations.push({ x: x[n - 1], y: ys[n - 1], xref: "x", yref: "y", showarrow: false, xanchor: "left", yanchor: "bottom", xshift: 8, yshift: 6, text: `<span style="color:${tone}">${TREND_GLYPH[move]}</span> ${fmt(ys[n - 1], 4)}`, font: { size: 12, color: c.ink } });
      } else if (n >= 2) {
        // the walk stands elsewhere (the closed form, the comparison ...): the last value of the descent is still named, once
        annotations.push({ x: x[n - 1], y: ys[n - 1], xref: "x", yref: "y", showarrow: false, xanchor: "left", yanchor: "bottom", xshift: 6, yshift: 4, text: fmt(ys[n - 1], 4), font: { size: 11, color: c.ink } });
      }
      // once the closed form is known: the step at which the descent got there (every weight within the tolerance), starred
      if (showRidge && reachedAt !== null && reachedAt < n) {
        traces.push({ x: [reachedAt], y: [ys[reachedAt]], mode: "markers", name: i18n.t("hybrid.walk.curve.reached", { k: reachedAt }), marker: { symbol: "star", size: 13, color: c.maroon, line: { color: c.maroon, width: 1 } }, hoverinfo: "skip", showlegend: false });
        annotations.push({ x: reachedAt, y: ys[reachedAt], xref: "x", yref: "y", showarrow: true, arrowhead: 0, arrowcolor: c.maroon, ax: reachedAt < (first + last) / 2 ? 46 : -46, ay: -34, text: i18n.t("hybrid.walk.curve.reached", { k: reachedAt }), font: { size: 11, color: c.maroon } });
      }

      // WP-235a: where the descent stops paying: from the first step that moves the error by less than 1e-4 a dotted line marks the start of the flat tail and a short label under the tail names it
      /** @type {any[]} */
      const shapes = [];
      if (flatAt !== null && flatAt < n) {
        shapes.push({ type: "line", xref: "x", yref: "y", x0: flatAt, x1: flatAt, y0: lo, y1: ys[flatAt], line: { color: c.muted, width: 1, dash: "dot" } });
        annotations.push({ x: flatAt, y: 0, xref: "x", yref: "paper", xanchor: "left", yanchor: "bottom", xshift: 5, yshift: 2, showarrow: false, text: i18n.t("hybrid.walk.curve.diminishing", { k: flatAt }), font: { size: 11, color: token("--strong", c.ink) } });
      }

      // the line above the plot: the fall since the equal start, and where the descent ended against the closed form
      if (note) {
        const parts = [];
        if (n >= 2) {
          const { delta, pct } = gainOf(ys[0], ys[n - 1]);
          const glyph = Math.abs(delta) < 1e-4 ? TREND_GLYPH.flat : delta < 0 ? TREND_GLYPH.down : TREND_GLYPH.up;
          parts.push(i18n.t("hybrid.walk.curve.gain", { glyph, delta: signed(delta, 4), pct: pct === null ? "—" : signed(pct, 2), step: x[n - 1] }));
        }
        if (showRidge && reachedAt === null && finalGap !== null) parts.push(i18n.t("hybrid.walk.curve.not_reached", { K: last - first, gap: fmt(finalGap, 4) }));
        note.textContent = parts.join(" · ");
      }

      /** @type {Record<string, any>} */
      const layout = {
        font: { color: c.ink, size: 12 },
        showlegend: false, // WP-235: no legend - the lines are named where they end
        annotations,
        shapes, // WP-235a
        margin: { l: 70, r: Math.min(Math.round(width * 0.42), 20 + Math.round(widest * 6.4)), t: 10, b: 38 },
        xaxis: {
          title: { text: i18n.t(view.x_label_key || "curve.hybrid_step"), standoff: 6 },
          range: [first - 0.5, last + 0.5],
          dtick: view.x.length > 20 ? 5 : 1,
        },
        yaxis: {
          title: { text: i18n.t("hybrid.walk.curve.y_title"), standoff: 4, font: { size: 11 } }, // WP-235: the axis keeps its name; the engine's long one ("RMSE on the held-out ratings") is cut by a plot a hundred px high
          range: [lo, hi],
          tick0: 0, // WP-235a: the ticks are the multiples of the step the range was made with
          dtick,
          tickformat: `.${Math.min(4, Math.max(2, Math.ceil(-Math.log10(dtick) - 1e-9)))}f`,
          exponentformat: "none",
        },
      };
      chart.render(traces, layout);
    },
    destroy() {
      observer?.disconnect();
      observer = null;
      themeObserver?.disconnect(); // WP-235
      themeObserver = null;
      if (chart) chart.destroy();
      chart = null;
    },
  };
  return api; // WP-235
}
