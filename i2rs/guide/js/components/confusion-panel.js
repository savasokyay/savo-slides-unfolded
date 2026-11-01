// @ts-check
// WP-48: the 2 x 2 confusion matrix of the threshold sweep. Reads the step's status values
// (`tp`, `fp`, `fn`, `tn`, and the rates when present); keeps the last matrix on screen while the
// player moves through steps that carry none (the AUC step, the result), so the picture never
// blinks. Idle text until the sweep reaches its first threshold.

import { fmt } from "../util/format.js";

/**
 * @param {HTMLElement} root
 * @param {{i18n: any}} ctx
 */
export function createConfusionPanel(root, ctx) {
  let shown = false;

  function idle() {
    root.innerHTML = "";
    const p = document.createElement("p");
    p.className = "formula-idle";
    p.textContent = ctx.i18n.t("metrics.no_confusion");
    root.appendChild(p);
    shown = false;
  }

  /** @param {Record<string, any>} v */
  function render(v) {
    const { i18n } = ctx;
    root.innerHTML = "";
    const table = document.createElement("table");
    table.className = "confusion";
    const thead = document.createElement("thead");
    const hr = document.createElement("tr");
    const corner = document.createElement("th");
    corner.textContent = `${i18n.t("metrics.confusion_predicted")} ↓ · ${i18n.t("metrics.confusion_actual")} →`;
    const hPos = document.createElement("th");
    hPos.textContent = i18n.t("metrics.confusion_pos");
    const hNeg = document.createElement("th");
    hNeg.textContent = i18n.t("metrics.confusion_neg");
    hr.append(corner, hPos, hNeg);
    thead.appendChild(hr);
    const tbody = document.createElement("tbody");
    for (const [label, cells] of [
      [i18n.t("metrics.confusion_pos"), [["TP", v.tp, "tp"], ["FP", v.fp, "fp"]]],
      [i18n.t("metrics.confusion_neg"), [["FN", v.fn, "fn"], ["TN", v.tn, "tn"]]],
    ]) {
      const tr = document.createElement("tr");
      const th = document.createElement("th");
      th.textContent = /** @type {string} */ (label);
      tr.appendChild(th);
      for (const [name, value, cls] of /** @type {any[]} */ (cells)) {
        const td = document.createElement("td");
        td.className = `cell-${cls}`;
        const big = document.createElement("span");
        big.className = "num big";
        big.textContent = String(value);
        const small = document.createElement("span");
        small.className = "sub";
        small.textContent = name;
        td.append(big, small);
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
    table.append(thead, tbody);
    root.appendChild(table);
    const strip = document.createElement("div");
    strip.className = "status-strip";
    for (const [k, key] of [
      ["tpr", "TPR"],
      ["fpr", "FPR"],
      ["precision", "precision"],
      ["t", "t"],
    ]) {
      if (v[k] === undefined) continue;
      const chip = document.createElement("span");
      chip.className = "chip";
      chip.textContent = `${key} ${fmt(v[k])}`;
      strip.appendChild(chip);
    }
    root.appendChild(strip);
    shown = true;
  }

  return {
    reset() {
      idle();
    },
    /** @param {import("./trace-player.js").Frame} frame */
    apply(frame) {
      const v = frame.step.values || {};
      const has = ["tp", "fp", "fn", "tn"].every((k) => typeof v[k] === "number");
      if (has) render(v);
      else if (!shown) idle();
    },
  };
}
