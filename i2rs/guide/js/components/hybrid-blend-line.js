// @ts-check
// WP-235: the line at the head of the Blend tab: the blend of the target film with its numbers in it ("r̂ = β₀ + Σ α·p = −0.368 + 0.392·4.668 + ... = 4.049", util/hybrid-blend-line.js) - the weights the
// closed form learned against what each base says about the film, written as the sum the table below spells out. A panel that only listens to the trace (the page shows it from the step that
// reaches the contributions table on).

import { blendLine } from "../util/hybrid-blend-line.js";

/**
 * @param {HTMLElement} root
 * @param {{i18n: any}} ctx
 */
export function createHybridBlendLine(root, ctx) {
  return {
    /** @param {any} trace */
    reset(trace) {
      root.replaceChildren();
      const line = blendLine(trace.tables?.contributions?.rows);
      if (!line) return;
      const text = document.createElement("div");
      text.className = "hybrid-blend-line";
      const head = ctx.i18n.t(line.level ? "hybrid.walk.blend_line_level" : "hybrid.walk.blend_line_free");
      text.textContent = `${head} = ${line.terms} = ${line.sum.toFixed(3)}`;
      text.title = ctx.i18n.t("hybrid.walk.blend_line_tip");
      root.appendChild(text);
    },
    apply() {},
  };
}
