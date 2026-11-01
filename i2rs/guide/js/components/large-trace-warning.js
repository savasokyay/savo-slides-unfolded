// @ts-check
// WP-146: the inline warning under the Parameters panel when a trace would TRAIN a model on more ratings than the page allows (the server's 413 `trace_too_large`): it says what
// that costs ("Training NeuMF on 108,873 ratings takes about 100 s on the lecture machine.") and offers the ways on - train anyway (the request repeats with the person's word,
// `confirm_large`; the loading strip then counts against the estimate), use the stored model (only when one could answer), switch to the class set (small enough to train in the
// page). A data set above the hard ceiling cannot be trained here at all: no "train anyway", the message says so. Not a modal and not a toast: it stays until a choice is made or
// the route changes, and the lecture never loses it behind a sentence that fades. What it offers is util/model-source.js `largeOffer` (checked under node); this file draws it.

import { countText } from "../util/topk.js";

/**
 * @param {{i18n: {t: (key: string, params?: Record<string, unknown>) => string, lang: () => string}}} opts
 * @returns {{
 *   el: HTMLElement,
 *   show: (spec: {
 *     algorithm: string | null, params: Record<string, any>, offer: ReturnType<typeof import("../util/model-source.js").largeOffer>,
 *     onTrain: () => void, onPretrained: () => void, onClass: () => void,
 *   }) => void,
 *   hide: () => void,
 *   shown: () => boolean,
 * }}
 */
export function createLargeTraceWarning({ i18n }) {
  const el = document.createElement("div");
  el.className = "warn-banner model-large";
  el.hidden = true;
  el.setAttribute("role", "alert");
  const text = document.createElement("p");
  text.className = "model-large-text";
  const actions = document.createElement("div");
  actions.className = "model-large-actions";
  const command = document.createElement("p");
  command.className = "model-large-cmd";
  el.append(text, actions, command);

  /**
   * @param {string} key
   * @param {boolean} primary
   * @param {() => void} onClick
   */
  function button(key, primary, onClick) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = primary ? "btn btn-primary btn-sm" : "btn btn-sm";
    b.textContent = i18n.t(key);
    b.addEventListener("click", onClick);
    actions.appendChild(b);
  }

  return {
    el,
    shown: () => !el.hidden,
    show({ algorithm, params, offer, onTrain, onPretrained, onClass }) {
      const lang = i18n.lang();
      const { reason, estimate } = offer;
      if (reason === "hard_limit") {
        text.textContent = i18n.t("trace.large_hard", { n_ratings: countText(Number(params.n_ratings), lang) });
      } else if (reason === "items") {
        text.textContent = i18n.t("trace.large_items", { algorithm: algorithm ?? "", n_items: countText(Number(params.n_items), lang), max_items: countText(Number(params.max_ease_items), lang) });
      } else if (estimate !== null) {
        // rounded the way the server rounds it (the plan's D9: 5 s steps): "about 100 s", never "about 98.4 s". WP-153: the smallest bucket (every size up to 5 s reads "5") is
        // "a few seconds" - an "about 5 s" would sound like a measurement - and both wordings say it is an estimate from the size of the data set
        text.textContent = offer.few
          ? i18n.t("trace.large_ratings_few", { algorithm: algorithm ?? "", n_ratings: countText(Number(params.n_ratings), lang) })
          : i18n.t("trace.large_ratings", { algorithm: algorithm ?? "", n_ratings: countText(Number(params.n_ratings), lang), seconds: countText(Math.round(estimate), lang) });
      } else {
        text.textContent = i18n.t("trace.large_ratings_unknown", { algorithm: algorithm ?? "", n_ratings: countText(Number(params.n_ratings), lang) });
      }
      // WP-146: the one extra sentence (util/model-source.js `largeOffer`): why no stored model is offered for a film the user has rated, or the way on above the hard ceiling
      if (offer.note === "held_out") text.textContent += ` ${i18n.t("trace.large_held_out")}`;
      else if (offer.note === "fit_first") text.textContent += ` ${i18n.t("trace.large_hard_next")}`;
      actions.replaceChildren();
      if (offer.canTrain) button("trace.large_train", true, onTrain);
      if (offer.canPretrained) button("trace.large_pretrained", !offer.canTrain, onPretrained);
      if (offer.canClass) button("trace.large_class", false, onClass);
      command.replaceChildren();
      if (offer.command) {
        const code = document.createElement("code");
        code.textContent = offer.command;
        command.append(`${i18n.t("trace.large_command")} `, code);
      }
      command.hidden = !offer.command;
      el.hidden = false;
    },
    hide() {
      el.hidden = true;
      actions.replaceChildren();
    },
  };
}
