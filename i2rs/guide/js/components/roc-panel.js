// @ts-check
// WP-48: ROC and precision-recall curves of a metrics sweep, revealed point by point. Reads
// `trace.views.roc` / `.pr` (the walked user's rank path, or the threshold sweep) and, when present,
// `trace.views.roc_mean` / `.pr_mean` (the legacy example_ROC.m average over the test users).
// Reveal comes from the frame's `curve` highlights: `rows=[n]` = the first n points of the main
// curves, `cols=[n]` = the first n points of the mean curves, `style: "result"` = draw the
// "binarised at τ" operating point (`views.roc.marks.tau_fpr / tau_tpr`). Random baselines: the
// ROC diagonal and the PR horizontal at the prevalence (`views.pr.marks.prevalence`).

import { fmt } from "../util/format.js";
import { createChart, themeColors } from "./chart.js";

/**
 * @param {HTMLElement} root
 * @param {{i18n: any}} ctx
 */
export function createRocPanel(root, ctx) {
  /** @type {any} */
  let views = null;
  /** @type {{roc: any, pr: any}} */
  let charts = { roc: null, pr: null };
  /** @type {string | null} */
  let lastKey = null;

  function destroyCharts() {
    for (const key of /** @type {const} */ (["roc", "pr"])) {
      if (charts[key]) charts[key].destroy();
      charts[key] = null;
    }
  }

  /** @param {string} key */
  function idle(key) {
    root.innerHTML = "";
    const p = document.createElement("p");
    p.className = "formula-idle";
    p.textContent = ctx.i18n.t(key);
    root.appendChild(p);
  }

  /**
   * @param {any} view
   * @param {number} n
   */
  function slice(view, n) {
    return { x: (view.x || []).slice(0, n), y: (view.y || []).slice(0, n) };
  }

  return {
    /** @param {any} trace */
    reset(trace) {
      destroyCharts();
      lastKey = null;
      views = {
        roc: trace.views?.roc || null,
        pr: trace.views?.pr || null,
        rocMean: trace.views?.roc_mean || null,
        prMean: trace.views?.pr_mean || null,
      };
      root.innerHTML = "";
      if (!views.roc || !views.roc.x?.length) {
        idle("metrics.no_curve");
        return;
      }
      const grid = document.createElement("div");
      grid.className = "roc-grid";
      for (const [key, titleKey] of [
        ["roc", "metrics.roc_title"],
        ["pr", "metrics.pr_title"],
      ]) {
        const box = document.createElement("div");
        box.className = "roc-box";
        const h = document.createElement("div");
        h.className = "table-head";
        h.textContent = ctx.i18n.t(/** @type {string} */ (titleKey));
        const host = document.createElement("div");
        host.className = "roc-host";
        box.append(h, host);
        grid.appendChild(box);
        charts[/** @type {"roc" | "pr"} */ (key)] = createChart(host);
      }
      root.appendChild(grid);
    },
    /** @param {import("./trace-player.js").Frame} frame */
    apply(frame) {
      if (!views || !views.roc || !charts.roc || !charts.pr) return;
      let uptoMain = 0;
      let uptoMean = 0;
      let showTau = false;
      for (const h of frame.highlights) {
        if (h.view !== "curve") continue;
        for (const r of h.rows || []) uptoMain = Math.max(uptoMain, r);
        for (const c of h.cols || []) uptoMean = Math.max(uptoMean, c);
        if (h.style === "result") showTau = true;
      }
      const key = `${uptoMain}|${uptoMean}|${showTau}|${ctx.i18n.lang()}`;
      if (key === lastKey) return;
      lastKey = key;
      const { i18n } = ctx;
      const c = themeColors();
      const isThreshold = !views.rocMean;
      const mainName = i18n.t(isThreshold ? "metrics.curve_system" : "metrics.curve_user");
      const meanName = i18n.t("metrics.curve_mean");
      const randomName = i18n.t("metrics.curve_random");

      // ---- ROC ----
      const roc = slice(views.roc, uptoMain);
      const rocTraces = [
        {
          x: [0, 1],
          y: [0, 1],
          mode: "lines",
          name: randomName,
          line: { dash: "dash", color: c.muted, width: 1.5 },
          hoverinfo: "skip",
        },
        {
          x: roc.x,
          y: roc.y,
          mode: "lines+markers",
          name: mainName,
          text: (views.roc.labels || []).slice(0, uptoMain),
          hovertemplate: "%{text}<br>FPR %{x:.4f} · TPR %{y:.4f}<extra></extra>",
          line: { color: c.navy, width: 2.5 },
          marker: { color: c.navy, size: 7 },
        },
      ];
      if (uptoMain > 0) {
        const last = uptoMain - 1;
        rocTraces.push({
          x: [views.roc.x[last]],
          y: [views.roc.y[last]],
          mode: "markers",
          name: mainName,
          showlegend: false,
          hoverinfo: "skip",
          marker: { color: c.maroon, size: 13, line: { color: c.card || "#fff", width: 2 } },
        });
      }
      if (views.rocMean && uptoMean > 0) {
        const m = slice(views.rocMean, uptoMean);
        rocTraces.push({
          x: m.x,
          y: m.y,
          mode: "lines+markers",
          name: meanName,
          text: (views.rocMean.labels || []).slice(0, uptoMean),
          hovertemplate: "k = %{text}<br>mean FPR %{x:.4f} · mean TPR %{y:.4f}<extra></extra>",
          line: { color: c.green, width: 2, dash: "dot" },
          marker: { color: c.green, size: 6, symbol: "diamond" },
        });
      }
      const marks = views.roc.marks || {};
      if (showTau && marks.tau_fpr !== undefined && marks.tau_tpr !== undefined) {
        rocTraces.push({
          x: [marks.tau_fpr],
          y: [marks.tau_tpr],
          mode: "markers",
          name: i18n.t("metrics.curve_tau"),
          hovertemplate: "FPR %{x:.4f} · TPR %{y:.4f}<extra></extra>",
          marker: { color: "#c0392b", size: 16, symbol: "x", line: { width: 3 } },
        });
      }
      const annotations = [];
      if (marks.auc !== undefined && uptoMain >= (views.roc.x || []).length) {
        annotations.push({
          x: 0.98,
          y: 0.06,
          xref: "paper",
          yref: "paper",
          xanchor: "right",
          showarrow: false,
          text: `AUC = ${fmt(marks.auc)}`,
          font: { size: 13, color: c.ink },
        });
      }
      charts.roc.render(rocTraces, {
        showlegend: true,
        legend: { orientation: "h", y: 1.16, x: 0, font: { size: 10 } },
        margin: { l: 44, r: 10, t: 24, b: 40 },
        xaxis: { title: { text: i18n.t(views.roc.x_label_key || "metrics.roc_x"), standoff: 4 }, range: [-0.03, 1.03], dtick: 0.25 },
        yaxis: { title: { text: i18n.t(views.roc.y_label_key || "metrics.roc_y"), standoff: 4 }, range: [-0.03, 1.03], dtick: 0.25 },
        annotations,
      });

      // ---- PR ----
      const pr = slice(views.pr || { x: [], y: [] }, uptoMain);
      const prevalence = views.pr?.marks?.prevalence;
      const prTraces = [];
      if (prevalence !== undefined && prevalence !== null) {
        prTraces.push({
          x: [0, 1],
          y: [prevalence, prevalence],
          mode: "lines",
          name: randomName,
          line: { dash: "dash", color: c.muted, width: 1.5 },
          hoverinfo: "skip",
        });
      }
      prTraces.push({
        x: pr.x,
        y: pr.y,
        mode: "lines+markers",
        name: mainName,
        text: (views.pr?.labels || []).slice(0, uptoMain),
        hovertemplate: "%{text}<br>recall %{x:.4f} · precision %{y:.4f}<extra></extra>",
        line: { color: c.navy, width: 2.5 },
        marker: { color: c.navy, size: 7 },
        connectgaps: false,
      });
      if (uptoMain > 0 && views.pr && views.pr.y[uptoMain - 1] !== null) {
        const last = uptoMain - 1;
        prTraces.push({
          x: [views.pr.x[last]],
          y: [views.pr.y[last]],
          mode: "markers",
          name: mainName,
          showlegend: false,
          hoverinfo: "skip",
          marker: { color: c.maroon, size: 13, line: { color: c.card || "#fff", width: 2 } },
        });
      }
      if (views.prMean && uptoMean > 0) {
        const m = slice(views.prMean, uptoMean);
        prTraces.push({
          x: m.x,
          y: m.y,
          mode: "lines+markers",
          name: meanName,
          text: (views.prMean.labels || []).slice(0, uptoMean),
          hovertemplate: "k = %{text}<br>mean recall %{x:.4f} · mean precision %{y:.4f}<extra></extra>",
          line: { color: c.green, width: 2, dash: "dot" },
          marker: { color: c.green, size: 6, symbol: "diamond" },
          connectgaps: false,
        });
      }
      charts.pr.render(prTraces, {
        showlegend: true,
        legend: { orientation: "h", y: 1.16, x: 0, font: { size: 10 } },
        margin: { l: 44, r: 10, t: 24, b: 40 },
        xaxis: { title: { text: i18n.t(views.pr?.x_label_key || "metrics.pr_x"), standoff: 4 }, range: [-0.03, 1.03], dtick: 0.25 },
        yaxis: { title: { text: i18n.t(views.pr?.y_label_key || "metrics.pr_y"), standoff: 4 }, range: [-0.03, 1.03], dtick: 0.25 },
      });
    },
    destroy() {
      destroyCharts();
    },
  };
}
