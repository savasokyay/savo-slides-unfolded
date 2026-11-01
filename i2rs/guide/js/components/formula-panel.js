// @ts-check
// WP-32: three stacked KaTeX layers (symbolic -> expanded -> numeric) revealed by sub-step. The
// server already substituted the numbers and wrapped each in `\htmlClass{v}{...}`; KaTeX needs
// `trust` for that command, nothing else. KaTeX is vendored and loaded lazily on first use.

import { noteSentences } from "../util/diag-notes.js"; // WP-188
import { loadVendorCss, loadVendorScript } from "../vendor-loader.js";

/**
 * @param {HTMLElement} root
 * @param {{i18n: any, formulas?: Record<string, any>}} ctx
 */
export function createFormulaPanel(root, ctx) {
  /** @type {Promise<void> | null} */
  let katexReady = null;
  /** @type {string | null} */
  let renderedKey = null;

  function ensureKatex() {
    if (!katexReady) {
      katexReady = Promise.all([
        loadVendorCss("katex", "katex.min.css"),
        loadVendorScript("katex", "katex.min.js"),
      ]).then(() => undefined);
    }
    return katexReady;
  }

  /**
   * @param {string} tex
   * @param {HTMLElement} el
   */
  function render(tex, el) {
    const katex = /** @type {any} */ (window).katex;
    if (!katex) {
      el.textContent = tex;
      return;
    }
    katex.render(tex, el, {
      displayMode: true,
      throwOnError: false,
      strict: "ignore",
      trust: (/** @type {{command: string}} */ c) => c.command === "\\htmlClass",
    });
    for (const v of el.querySelectorAll(".v")) {
      const span = /** @type {HTMLElement} */ (v);
      span.title = span.textContent || "";
    }
  }

  function idle() {
    root.innerHTML = "";
    const p = document.createElement("p");
    p.className = "formula-idle";
    p.textContent = ctx.i18n.t("player.no_formula");
    root.appendChild(p);
    renderedKey = null;
  }

  /**
   * WP-188: the step's notes as one quote block - a small quiet heading, then one paragraph per sentence (the engine's `steps[i].notes`, written in the viewer's language by
   * util/diag-notes.js). Null when there is nothing to say (no notes, or none that can be written).
   * @param {import("./trace-player.js").Frame} frame
   * @returns {HTMLElement | null}
   */
  function notesBlock(frame) {
    const texts = noteSentences(/** @type {any} */ (frame.step).notes, (key) => ctx.i18n.t(key));
    if (!texts.length) return null;
    const quote = document.createElement("blockquote");
    quote.className = "formula-notes";
    const head = document.createElement("div");
    head.className = "formula-notes-head";
    head.textContent = ctx.i18n.t("panel.formula_notes_head");
    quote.appendChild(head);
    for (const text of texts) {
      const p = document.createElement("p");
      p.textContent = text;
      quote.appendChild(p);
    }
    return quote;
  }

  return {
    reset() {
      idle();
      ensureKatex().catch(() => {});
    },
    /** @param {import("./trace-player.js").Frame} frame */
    async apply(frame) {
      const f = frame.step.formula;
      if (!f) {
        // WP-188: a step with no formula but with notes (the closing step of a content-based predict trace) shows them in the quote block instead of "No formula at this step"
        const quote = notesBlock(frame);
        if (!quote) {
          idle();
          return;
        }
        root.innerHTML = "";
        root.appendChild(quote);
        renderedKey = null;
        return;
      }
      const key = `${frame.index}`;
      const layers = [
        ["symbolic", f.symbolic],
        ["expanded", frame.sub >= 1 ? f.expanded : null],
        ["numeric", frame.sub >= 2 || (frame.sub >= 1 && !f.expanded) ? f.numeric : null],
      ].filter(([, tex]) => !!tex);
      await ensureKatex().catch(() => {});
      if (renderedKey !== key) {
        root.innerHTML = "";
        const head = document.createElement("div");
        head.className = "formula-head";
        const label = ctx.formulas?.[f.template_id]?.label_key;
        head.textContent = label ? ctx.i18n.t(label) : f.template_id;
        if (f.variant) {
          const badge = document.createElement("span");
          badge.className = "pill";
          // WP-110: a variant that changes what the formula means (the cosine's co-rated norms) has a label in the viewer's language; the
          // other variants keep their name
          const named = ctx.i18n.t(`formula.variant.${f.variant}`);
          badge.textContent = named !== `formula.variant.${f.variant}` ? named : f.variant;
          head.appendChild(badge);
        }
        root.appendChild(head);
        renderedKey = key;
      }
      const existing = new Set([...root.querySelectorAll(".formula-layer")].map((el) => el.getAttribute("data-layer")));
      for (const [name, tex] of layers) {
        if (existing.has(name)) continue;
        const layer = document.createElement("div");
        layer.className = `formula-layer layer-${name} fade-in`;
        layer.setAttribute("data-layer", name);
        render(/** @type {string} */ (tex), layer);
        root.appendChild(layer);
      }
      for (const el of root.querySelectorAll(".formula-layer")) {
        const name = el.getAttribute("data-layer");
        if (!layers.some(([n]) => n === name)) el.remove();
      }
      // WP-108 (a): a line under the numeric layer ("the same rule for the other N neighbours"): the engine names the key and its numbers
      // (`Formula.note_key` / `note_params`), the viewer's language writes it; it appears with the numeric layer, not before
      const sameRule = root.querySelector(".formula-same-rule");
      if (f.note_key && layers.some(([n]) => n === "numeric")) {
        const line = sameRule || document.createElement("div");
        line.className = "formula-same-rule";
        line.textContent = ctx.i18n.t(f.note_key, f.note_params || {});
        if (!sameRule) root.appendChild(line);
      } else if (sameRule) {
        sameRule.remove();
      }
      if (f.truncated_terms) {
        let note = root.querySelector(".formula-note");
        if (!note) {
          note = document.createElement("div");
          note.className = "formula-note";
          root.appendChild(note);
        }
        note.textContent = ctx.i18n.t("player.truncated_terms", { n: f.truncated_terms });
      }
      // WP-188: a step with a formula AND notes (the design note's WP-189) shows the formula first and the quote under it, always last
      root.querySelector(".formula-notes")?.remove();
      const quote = notesBlock(frame);
      if (quote) root.appendChild(quote);
    },
  };
}
