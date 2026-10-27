// @ts-check
// WP-146: the "Model" row of the Parameters form of the matrix-factorization and neural pages - where the model of the trace comes from. A segmented control, the app's own
// (`.miniseg`: the same buttons, border and pressed look as every other choice of the form), `Pretrained | Train`, and the line beside it that says what the choice means now
// ("fitted 2026-10-11 13:50 · 11 epochs · 98 s"). Nothing pressed is AUTOMATIC (the default: the server picks the stored model where it may answer and trains where it must); a click
// presses a choice, a click on the pressed choice gives it back to automatic.
// WP-155: the source IN USE is what the row shows first (the user, 2026-10-12: "it recognised the pretrained one, but it is not prominent at all"). The segment of the source in use
// is FILLED with the app's primary colour and carries a check mark - pressed or came out of automatic alike - the state line starts with a bold head ("Pretrained model in use",
// "Trained on this page", "Held-out refit") and, when nothing is pressed, a small "auto" tag stands beside the control. Every segment reserves the check mark's width (hidden on the
// one that is not in use), and the tag keeps its place when it is not shown, so nothing in the row moves when the source changes.
// The component draws and reports; it does not decide. What the row shows is util/model-source.js `rowView` (checked under node with hand-derived cases); the form owns the
// choice, applies it with Apply like every other field, and hands the component the view. A held-out cell (the target is a rating of the user's: the model is trained again
// without it - the lesson's rule, not an error) fades the whole control and says why in its tip; the choice made before still applies to top-K and to films the user has not rated.

import { infoTip } from "../util/info-tip.js"; // WP-153

/** @typedef {import("../util/model-source.js").Source} Source */
/** @typedef {import("../util/model-source.js").RowView} RowView */

/**
 * @param {{i18n: {t: (key: string, params?: Record<string, unknown>) => string}, onPick: (choice: Source | null) => void}} opts
 * @returns {{el: HTMLElement, sync: (view: RowView, choice: Source | null) => void}}
 */
export function createModelSource({ i18n, onPick }) {
  const el = document.createElement("div");
  el.className = "param-field model-field";
  el.hidden = true;
  el.setAttribute("role", "group");
  el.setAttribute("aria-label", i18n.t("params.model_source"));
  const caption = document.createElement("span");
  caption.textContent = i18n.t("params.model_source");
  caption.title = i18n.t("params.model_source_tip");
  // WP-153: the (i) at the end of the caption (the form's own pattern, `field()` with an (i)): the model is GLOBAL - one P, one Q and the biases from all the ratings, none per user -
  // and why a film the user has rated costs a training run while one they have not rated does not. The text carries no number (a time depends on the machine); an empty title keeps the
  // caption's own tooltip from opening beside the bubble
  const globalInfo = infoTip(i18n.t("params.model_global_tip"), i18n.t("params.model_source"), i18n.t("params.model_source"));
  globalInfo.title = "";
  caption.append(globalInfo);
  const row = document.createElement("div");
  row.className = "param-row model-row";
  const seg = document.createElement("div");
  seg.className = "miniseg model-seg";
  /** @type {Record<string, HTMLButtonElement>} */
  const buttons = {};
  /** @type {Source | null} */
  let pressed = null;
  for (const value of /** @type {const} */ (["pretrained", "fit"])) {
    const b = document.createElement("button");
    b.type = "button";
    b.dataset.value = value;
    b.textContent = i18n.t(`params.model_source_${value}`);
    b.addEventListener("click", () => {
      if (b.getAttribute("aria-disabled") === "true") return; // faded (a held-out refit) or not available: a click changes nothing
      onPick(pressed === value ? null : value);
    });
    buttons[value] = b;
    seg.appendChild(b);
  }
  // WP-155: "auto" beside the control while nothing is pressed (the page picked the source); its place is kept when it is not shown
  const autoTag = document.createElement("span");
  autoTag.className = "model-auto";
  autoTag.textContent = i18n.t("params.model_source_auto");
  autoTag.title = i18n.t("params.model_source_auto_tip");
  const state = document.createElement("span");
  state.className = "model-state";
  row.append(seg, autoTag, state);
  el.append(caption, row);

  return {
    el,
    /**
     * @param {RowView} view
     * @param {Source | null} choice the choice made (pressed)
     */
    sync(view, choice) {
      pressed = view.refit ? null : choice;
      el.hidden = false;
      seg.classList.toggle("disabled", view.refit);
      for (const value of /** @type {const} */ (["pretrained", "fit"])) {
        const b = buttons[value];
        const on = pressed === value;
        b.classList.toggle("active", on);
        b.classList.toggle("is-auto", view.auto === value);
        b.classList.toggle("is-resolved", view.resolved === value); // WP-155: the source in use - filled, with a check mark (model-seg rules, trace.css)
        b.setAttribute("aria-pressed", String(on));
        const off = view.refit || (value === "pretrained" && view.pretrainedDisabled);
        b.setAttribute("aria-disabled", String(off));
        b.title = i18n.t(
          view.refit
            ? "params.model_source_tip_refit"
            : value === "pretrained" && view.pretrainedDisabled
              ? view.pretrainedWhy === "ease"
                ? "params.model_source_tip_ease"
                : "params.model_source_tip_missing"
              : view.auto === value
                ? `params.model_source_tip_auto_${value}`
                : `params.model_source_tip_${value}`
        );
      }
      // WP-155: the bold head, then the detail
      const head = document.createElement("strong");
      head.className = "model-head";
      head.textContent = i18n.t(view.state.head);
      state.replaceChildren(head, ` — ${i18n.t(view.state.key, view.state.params)}`);
      row.classList.toggle("is-auto-mode", view.auto !== null);
    },
  };
}
