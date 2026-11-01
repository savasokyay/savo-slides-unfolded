// @ts-check
// WP-46: the training curve of an MF trace - train loss (left axis) and the validation metric per
// epoch, revealed epoch by epoch. Reads `trace.views.curve` (CurveView). The frame's `curve`
// highlights say how far to reveal (the max row index over the persisted highlights of earlier
// steps + the current one), `view.marks.best` draws the epoch whose weights were kept. Axis ranges
// are fixed to the whole run so the picture never rescales while the player advances.

import { createChart, themeColors } from "./chart.js";
import { richInfoTip } from "./rich-tip.js"; // WP-244: the feature page's what-it-shows sentence is the (i) beside the legend
import { curveCaption, curveFacts } from "../util/curve-caption.js"; // WP-224: the stop-reason sentence and the "still improving" badge under the curve
import { comparisonHintKey, curveReference, hasEpochWalk, idsOnlyHistory, runMarks } from "../util/dnn-features.js"; // WP-243: the ids-only network's validation error, a reference line on the feature page's chart; WP-244: and its epochs, the run's marks, the reason a comparison is missing

/**
 * @param {HTMLElement} root
 * @param {{i18n: any, scale?: () => number, features?: boolean, column?: boolean}} ctx `scale`: WP-158 - the box's size step (1 = 12 px text), read at every draw: the Code panel's size group sizes the curve's text too; // WP-244
 *   WP-243 `features`: the feature-combination page - the whole run is drawn faint from the first step, the kept epoch is marked from the start and the ids-only network's error is a dashed line
 */
export function createCurvePanel(root, ctx) {
  /** @type {any} */
  let view = null;
  /** @type {any} */
  let chart = null;
  /** @type {string | null} */
  let lastKey = null;
  /** @type {import("./trace-player.js").Frame | null} */
  let lastFrame = null;
  /** @type {ResizeObserver | null} */
  let observer = null;
  /** WP-243: the ids-only network's validation error of this trace (feature page only) @type {{value: number, epoch: number | null} | null} */
  let reference = null;
  /** WP-244: the ids-only network's epoch history (a faint pair of curves; the dashed reference line is what an older stored variant leaves) @type {ReturnType<typeof idsOnlyHistory>} */
  let idsHistory = null;
  /** WP-244: the epoch with the lowest validation error and the epoch whose weights predict @type {{best: number | null, kept: number | null} | null} */
  let marks = null;
  /** WP-244: the stored history of a pretrained network is ONE step that reveals the whole curve: it is drawn whole and solid from the first step (a live epoch walk keeps the dotted ghost) */
  let wholeRun = false;

  /**
   * WP-244: the feature page's legend, a row of keys above the chart (Plotly's own took a row per entry in this narrow box): this network's two lines, the ids-only network's two faint dashed ones
   * (or its one dashed reference line), and the (i) that says what the chart shows. It is made once per trace: which lines there are does not change with a step.
   * @returns {HTMLElement}
   */
  function buildLegend() {
    const { i18n } = ctx;
    const row = document.createElement("div");
    row.className = "curve-legend";
    const keys = document.createElement("div");
    keys.className = "curve-keys";
    /** @param {string} kind @param {string} label */
    const key = (kind, label) => {
      const node = document.createElement("span");
      node.className = "curve-key";
      const swatch = document.createElement("i");
      swatch.className = `curve-swatch ${kind}`;
      node.append(swatch, document.createTextNode(label));
      keys.appendChild(node);
    };
    key("own", i18n.t(view.y_label_key || "curve.loss"));
    for (const [name, ys] of Object.entries(view.series || {})) {
      if (finite(/** @type {(number | null)[]} */ (ys)).length) key("own valid", i18n.t(view.series_label_keys?.[name] || `curve.${name}`));
    }
    if (idsHistory) {
      key("ids", i18n.t("curve.ids_only_train"));
      key("ids valid", i18n.t("curve.ids_only_valid"));
    } else if (reference) key("ref", i18n.t("curve.ids_only", { rmse: reference.value.toFixed(4) }));
    row.appendChild(keys);
    // WP-244: three sentences for a whole stored run (with the ids-only history, with its one number, without), the two older ones for a live epoch walk (the faint whole run the walk draws in)
    const readingKey = wholeRun ? (idsHistory ? "curve.reading_whole_hist" : reference ? "curve.reading_whole_ref" : "curve.reading_whole") : reference ? "curve.reading_features_ids" : "curve.reading_features";
    // WP-246: the lecture data's readings (dnn-agent's measured sentences, under a heading that says whose they are: the default settings and the two foils) follow the what-it-shows sentence
    if (ctx.features) row.appendChild(richInfoTip(`${i18n.t(readingKey)}\n## ${i18n.t("curve.lecture_head")}\n${i18n.t("curve.lecture_readings")}`, i18n.t("curve.info_label"))); // WP-244: the feature page's what-it-shows sentence; the other pages have no such sentence
    return row;
  }

  /** @param {string} key */
  function idle(key) {
    root.innerHTML = "";
    const p = document.createElement("p");
    p.className = "formula-idle";
    p.textContent = ctx.i18n.t(key);
    root.appendChild(p);
  }

  /** @param {(number | null)[]} values */
  function finite(values) {
    return values.filter((v) => v !== null && v !== undefined && Number.isFinite(v)).map((v) => /** @type {number} */ (v));
  }

  return {
    /** @param {any} trace */
    reset(trace) {
      view = trace.views?.curve || null;
      reference = ctx.features ? curveReference(trace) : null; // WP-243
      idsHistory = ctx.features ? idsOnlyHistory(trace) : null; // WP-244
      marks = ctx.features ? runMarks(trace) : null;
      wholeRun = ctx.features && !hasEpochWalk(trace);
      lastKey = null;
      lastFrame = null;
      observer?.disconnect();
      observer = null;
      if (chart) {
        chart.destroy();
        chart = null;
      }
      root.innerHTML = "";
      if (!view || !view.x?.length) {
        idle("mf.no_curve");
        return;
      }
      root.classList.toggle("curve-column", Boolean(ctx.column)); // WP-244: the box of a trained page is a column (keys, chart, sentences): mf.css `.curve-column`
      const host = document.createElement("div");
      host.className = "curve-host";
      if (ctx.column) root.appendChild(buildLegend()); // WP-244: the keys are a row above the chart, not Plotly's legend (a row per entry in the 270 px box)
      root.appendChild(host);
      // WP-224: under the chart, how training ended and which epoch's weights predict (both network pages and the MF pages carry the facts in their result); the badge when the run
      // ended on its epoch budget while the validation error was still falling - the instructor's 30-epoch case
      const caption = curveCaption(curveFacts(trace));
      if (caption) {
        const line = document.createElement("div");
        line.className = "curve-caption";
        const text = document.createElement("span");
        text.textContent = ctx.i18n.t(caption.key, caption.params);
        line.appendChild(text);
        if (caption.badge) {
          const badge = document.createElement("span");
          badge.className = "curve-badge";
          badge.textContent = ctx.i18n.t("curve.still_improving");
          line.appendChild(badge);
        }
        root.appendChild(line);
      }
      if (ctx.features) {
        // WP-243: what the chart shows (the reader asked: "what am I looking at") - WP-244: it is the (i) beside the legend now, the box has no room for four more lines
        const hintKey = comparisonHintKey(trace); // WP-244: why there is no ids-only line (the trace says it with a code)
        if (hintKey) {
          const hint = document.createElement("div");
          hint.className = "curve-caption curve-hint";
          hint.textContent = ctx.i18n.t(hintKey);
          root.appendChild(hint);
        }
      }
      chart = createChart(host);
      // WP-158: the chart is a tab of the Code panel: drawn while the tab is closed it has no size, and the box can change (the window, presenting mode): the host's size is followed
      if (typeof ResizeObserver !== "undefined") {
        observer = new ResizeObserver(() => chart?.resize());
        observer.observe(host);
      }
    },
    /** WP-158: the size step changed: draw the last frame again at the new text size */
    setScale() {
      lastKey = null;
      if (lastFrame) this.apply(lastFrame);
    },
    /** WP-158: the tab was opened: take the box's size */
    resize() {
      chart?.resize();
    },
    /** @param {import("./trace-player.js").Frame} frame */
    apply(frame) {
      if (!view || !chart) return;
      lastFrame = frame;
      let upto = 0;
      for (const h of frame.highlights) {
        if (h.view !== "curve") continue;
        for (const r of h.rows || []) upto = Math.max(upto, r);
      }
      if (wholeRun) upto = view.x.length; // WP-244: a stored history is whole from the first step
      const key = String(upto);
      if (key === lastKey) return;
      lastKey = key;
      const { i18n } = ctx;
      const n = Math.min(upto, view.x.length);
      const x = view.x.slice(0, n);
      const lossKey = view.y_label_key || "curve.loss";
      const lossName = lossKey.replace("curve.", "");
      const colour = themeColors();
      // WP-243: the feature page draws the WHOLE run first, dotted (the walk's reveal then draws the solid lines over it): the curve is there before the first epoch step. The dotted lines carry
      // the legend (an empty solid trace has no entry), the solid ones share their group and stay out of it
      /** @type {any[]} */
      const faint = [];
      const ghostOn = ctx.features && !wholeRun; // WP-244: the dotted ghost is for a live walk only
      const ghost = (/** @type {any[]} */ ys, /** @type {string} */ ink, /** @type {string} */ name) => ({ x: view.x, y: ys, mode: "lines", name, legendgroup: name, line: { color: ink, width: 1.5, dash: "dot" }, hoverinfo: "skip", connectgaps: true });
      if (ghostOn) faint.push(ghost(view.y, colour.navy, i18n.t(lossKey))); // WP-244
      const traces = [
        { x, y: view.y.slice(0, n), mode: "lines+markers", name: i18n.t(lossKey), legendgroup: i18n.t(lossKey), showlegend: !ghostOn, line: { color: colour.navy }, marker: { color: colour.navy } }, // WP-244: the solid trace carries the legend when there is no ghost
      ];
      const yAll = finite(view.y);
      const y2All = [];
      for (const [name, ys] of Object.entries(view.series || {})) {
        const pts = /** @type {(number | null)[]} */ (ys).slice(0, n);
        if (!finite(/** @type {(number | null)[]} */ (ys)).length) continue;
        const labelKey = view.series_label_keys?.[name] || `curve.${name}`;
        // the validation RMSE shares the loss axis; a metric in other units (AUC) gets its own
        const sameAxis = labelKey.replace("curve.valid_", "") === lossName;
        if (sameAxis) yAll.push(...finite(/** @type {(number | null)[]} */ (ys)));
        else y2All.push(...finite(/** @type {(number | null)[]} */ (ys)));
        if (ghostOn) faint.push({ ...ghost(/** @type {any[]} */ (ys), colour.maroon, i18n.t(labelKey)), ...(sameAxis ? {} : { yaxis: "y2" }) }); // WP-244
        traces.push({
          x,
          y: pts,
          mode: "lines+markers",
          name: i18n.t(labelKey),
          legendgroup: i18n.t(labelKey),
          showlegend: !ghostOn, // WP-244
          ...(sameAxis ? {} : { yaxis: "y2" }),
          connectgaps: true,
          line: { color: colour.maroon },
          marker: { color: colour.maroon },
        });
      }
      if (idsHistory) {
        // WP-244: the ids-only network's own epochs, a faint dashed pair in the same two hues (training, validation) under the page's own solid lines, labelled in the legend: a validation line below the
        // faint one means the content features help. The two runs have their own number of epochs: the x axis is wide enough for both
        const idsLine = (/** @type {(number | null)[]} */ ys, /** @type {string} */ ink, /** @type {string} */ name) => ({ x: idsHistory?.epochs, y: ys, mode: "lines", name, line: { color: ink, width: 1.6, dash: "dash" }, opacity: 0.5, connectgaps: true, hoverinfo: "skip" });
        traces.push(idsLine(idsHistory.train, colour.navy, i18n.t("curve.ids_only_train")), idsLine(idsHistory.valid, colour.maroon, i18n.t("curve.ids_only_valid")));
        yAll.push(...finite(idsHistory.train), ...finite(idsHistory.valid));
      } else if (reference) {
        // WP-243: the ids-only network's validation error at its kept epoch (the trace carries that one number, not its curve): a dashed line across the whole chart, on the validation axis
        yAll.push(reference.value);
        traces.push({
          x: [Math.min(...view.x) - 0.5, Math.max(...view.x) + 0.5],
          y: [reference.value, reference.value],
          mode: "lines",
          name: i18n.t("curve.ids_only", { rmse: reference.value.toFixed(4) }),
          line: { color: colour.muted, dash: "dash", width: 2 },
          hoverinfo: "skip",
        });
      }
      const pad = (lo, hi) => {
        const span = hi - lo || Math.abs(hi) || 1;
        return [lo - 0.08 * span, hi + 0.08 * span];
      };
      const shapes = [];
      /** @type {any[]} */
      const annotations = []; // WP-244
      const best = view.marks?.best;
      if (ctx.features && marks && (marks.best !== null || marks.kept !== null)) {
        // WP-244: the best epoch (dotted: the lowest validation error) and the epoch whose weights predict (solid green) - one line when early stopping kept the best, two when it did not (the foil: kept 60,
        // best 3); each is named at its line, pointing inward so the label stays inside the chart
        const zNow = ctx.scale?.() || 1;
        const markAt = (/** @type {number} */ at, /** @type {string} */ dash, /** @type {string} */ ink, /** @type {number} */ width) => shapes.push({ type: "line", x0: at, x1: at, y0: 0, y1: 1, yref: "paper", line: { dash, width, color: ink } });
        const name = (/** @type {number} */ at, /** @type {string} */ labelKey, /** @type {"left" | "right"} */ side, /** @type {string} */ ink, /** @type {number} */ level = 1, /** @type {"top" | "middle"} */ anchor = "top") => annotations.push({ x: at, y: level, yref: "paper", xanchor: side, yanchor: anchor, xshift: side === "left" ? 3 : -3, showarrow: false, text: i18n.t(labelKey, { epoch: at }), font: { size: 10 * zNow, color: ink } });
        if (marks.best !== null && marks.kept !== null && marks.best !== marks.kept) {
          markAt(marks.best, "dot", colour.ink, 1.5);
          markAt(marks.kept, "solid", colour.green, 2);
          name(marks.best, "curve.mark_best", "left", colour.ink);
          name(marks.kept, "curve.mark_kept", "right", colour.green, 0.5, "middle"); // mid-height: the two curves part there, the top and the bottom of the far right are theirs
        } else {
          const at = /** @type {number} */ (marks.kept ?? marks.best);
          markAt(at, "dot", colour.ink, 1.5);
          name(at, "curve.mark_best_kept", "left", colour.ink);
        }
      } else if (best !== undefined && best !== null && (best <= upto || ctx.features)) { // WP-243: the feature page marks the kept epoch from the start (the whole run is drawn)
        shapes.push({
          type: "line",
          x0: best,
          x1: best,
          y0: 0,
          y1: 1,
          yref: "paper",
          line: { dash: "dot", width: 1.5 },
        });
      }
      const z = ctx.scale?.() || 1; // WP-158: text and margins follow the box's size step
      // WP-158: the chart is a tab of the Code panel (a narrow box): its legend takes one line when the entries fit the width and two when they do not, and the plot starts under it
      // (the margin follows), so the legend never lies over the lines; the box's height is a row of the block, every pixel counts
      const width = root.clientWidth || 600;
      // WP-243: the third entry (the ids-only line) needs the room of two lines in a narrow box; WP-244: with the ids-only pair (four entries) the lines needed follow the entries' own widths
      const legendNames = [i18n.t(lossKey), ...Object.keys(view.series || {}).map((name) => i18n.t(view.series_label_keys?.[name] || `curve.${name}`)), ...(idsHistory ? [i18n.t("curve.ids_only_train"), i18n.t("curve.ids_only_valid")] : [])];
      const legendNeed = legendNames.reduce((sum, label) => sum + (label.length * 5.8 + 30) * z, 0);
      const legendLines = idsHistory ? Math.max(1, Math.ceil(legendNeed / Math.max(width - 16, 1))) : width < (reference ? 520 : 360) * z ? 2 : 1;
      /** @type {Record<string, any>} */
      const layout = {
        font: { color: themeColors().ink, size: 12 * z },
        showlegend: !ctx.column, // WP-244: a trained page draws its legend as a row of keys above the chart (buildLegend)
        legend: { orientation: "h", x: 0, y: 1, yanchor: "bottom", font: { size: 11 * z } },
        margin: { l: 48 * z, r: (y2All.length ? 48 : 16) * z, t: (ctx.column ? 14 : 10 + 16 * legendLines) * z, b: 38 * z }, // WP-244: no legend inside the chart on a trained page
        xaxis: {
          title: { text: i18n.t(view.x_label_key || "curve.epoch"), standoff: 6 },
          range: [Math.min(...view.x, ...(idsHistory?.epochs ?? [])) - 0.5, Math.max(...view.x, ...(idsHistory?.epochs ?? [])) + 0.5], // WP-244: wide enough for the ids-only run too
          dtick: Math.max(view.x.length, idsHistory?.epochs.length ?? 0) > 20 ? 5 : 1,
        },
        yaxis: { range: yAll.length ? pad(Math.min(...yAll), Math.max(...yAll)) : undefined },
        shapes,
        annotations, // WP-244: the best and the kept epoch named at their lines
      };
      if (y2All.length) {
        layout.yaxis2 = {
          overlaying: "y",
          side: "right",
          showgrid: false,
          automargin: true, // WP-170: the metric axis' tick labels set the right margin when 48 px is not enough ("0.06752": 3-4 px of each label past the svg's edge in the 278 px chart)
          range: pad(Math.min(...y2All), Math.max(...y2All)),
        };
      }
      chart.render([...faint, ...traces], layout); // WP-243: the whole run (feature page) under the revealed part
    },
    destroy() {
      observer?.disconnect();
      observer = null;
      if (chart) chart.destroy();
      chart = null;
    },
  };
}
