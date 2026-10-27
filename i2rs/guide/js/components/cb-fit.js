// @ts-check
// WP-195c: the "Fit" tab of the per-user content model (docs/plans/2610171557-per-user-content-model-design.md) - what the model trained for this request is: its kind, the ridge penalty,
// the solver, the films and terms it learned from, its error on those films and how long it took. A panel that only listens: it reads `trace.result.model` once, at the trace's reset
// (the numbers belong to the trace, not to a step - the walk's `fit` step points at this tab, util/cb-tabs.js), and says so in one sentence when the user has nothing else to train on.
// The rows are util/cb-fit.js `fitSummary` (checked under node); this file draws them.
// WP-195c stage 2: for the small network (`result.model.kind === "mlp"`) the tab also holds the training CURVE (the DNN page's curve panel: the training RMSE after each epoch, drawn whole
// when the fit step highlights it) and the `epochs` table under it (every row, scrolling inside); the summary stands at the left of the curve, so the three fit in the panel's fixed box.

import { createCurvePanel } from "./curve-panel.js";
import { createDataTable } from "./data-table.js";
import { fitMilliseconds, fitSummary } from "../util/cb-fit.js";

/**
 * @param {HTMLElement} root the tab's body host
 * @param {{i18n: {t: (key: string, params?: Record<string, unknown>) => string, lang?: () => string}}} ctx
 */
export function createCbFit(root, { i18n }) {
  /** @param {string} tag @param {string} className @param {string} [text] @returns {HTMLElement} */
  function el(tag, className, text) {
    const node = document.createElement(tag);
    node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  /** the network's two children, none for the regression @type {{curve: ReturnType<typeof createCurvePanel>, table: ReturnType<typeof createDataTable>} | null} */
  let network = null;

  /** @param {NonNullable<ReturnType<typeof fitSummary>>} summary @returns {HTMLElement} the kind's heading, the rows and the note */
  function summaryBlock(summary) {
    const block = el("div", "cb-fit-summary");
    block.appendChild(el("h4", "cb-fit-kind", summary.heading));
    const list = el("dl", "cb-fit-list");
    for (const row of summary.rows) {
      const dt = el("dt", "cb-fit-label", row.label);
      const dd = el("dd", "cb-fit-value num", row.value);
      dd.dataset.key = row.key;
      list.append(dt, dd);
    }
    block.appendChild(list);
    if (summary.note) block.appendChild(el("p", "cb-fit-note", summary.note));
    return block;
  }

  function release() {
    network?.curve.destroy();
    network = null;
  }

  return {
    /** @param {any} trace */
    reset(trace) {
      release();
      root.classList.remove("is-network");
      const lang = typeof i18n.lang === "function" ? i18n.lang() : "en";
      const model = trace?.result?.model;
      const fitMs = fitMilliseconds(trace?.steps); // the training's own time (the `fit` step's `values.fit_seconds`); without it the row is the whole trace's
      const summary = fitSummary(model && fitMs !== null ? { ...model, fit_ms: fitMs } : model, trace?.meta?.timing_ms, (key, params) => i18n.t(key, params), lang);
      if (!summary) {
        root.replaceChildren(el("p", "heat-note", i18n.t("cbmodel.idle")));
        return;
      }
      const wrap = el("div", "cb-fit");
      // the small network: the summary and the curve side by side, the epochs table under them (a flat history has no curve and no table: the summary and its note alone)
      const hasCurve = model?.kind === "mlp" && !!trace?.views?.curve?.x?.length;
      if (hasCurve) {
        root.classList.add("is-network");
        wrap.classList.add("cb-fit-network");
        const top = el("div", "cb-fit-top");
        const curveHost = el("div", "cb-fit-curve");
        top.append(summaryBlock(summary), curveHost);
        const tableHost = el("div", "cb-fit-epochs");
        wrap.append(top, tableHost);
        root.replaceChildren(wrap);
        network = {
          curve: createCurvePanel(curveHost, { i18n }),
          table: createDataTable(tableHost, { i18n, tableId: "epochs", showAll: true }),
        };
        network.curve.reset(trace);
        network.table.reset(trace);
        return;
      }
      wrap.appendChild(summaryBlock(summary));
      root.replaceChildren(wrap);
    },
    /** @param {import("./trace-player.js").Frame} frame the network's curve opens when the fit step highlights it */
    apply(frame) {
      network?.curve.apply(frame);
      network?.table.apply(frame);
    },
    /** the tab was opened: a chart drawn while it was closed has no size, it takes the box's now */
    resize() {
      network?.curve.resize();
    },
    destroy() {
      release();
    },
  };
}
