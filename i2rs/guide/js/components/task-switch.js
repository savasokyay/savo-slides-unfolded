// @ts-check
// WP-141 / WP-141a: the page-level task switch of a trace page, "Predict a rating | Recommend top-K" - the app's segmented control (`.miniseg`) one size up, because it is
// the PAGE's choice, not one parameter's. It stands in the title row (pages/trace-page.js `.trace-head`: the title at the left, the switch in the middle, the "Random pick"
// box at the right) on every trace page. The top-K choice is live only on a page whose engine offers it; on the others (uCF, iCF, content-based today) it is a
// placeholder: switched off - `aria-disabled`, out of the tab order, a click does nothing - and its tip says why (util/topk.js `taskSwitchFor` picks the words). The choice
// is not the switch's to make: a click on a live choice is reported to `onChoose`, the page navigates, and the route (not the switch) says which choice is pressed.

/**
 * @param {{i18n: {t: (key: string, params?: Record<string, unknown>) => string}, onChoose: (task: "predict" | "topk") => void}} opts
 * @returns {{el: HTMLElement, sync: (state: {shown: boolean, task: "predict" | "topk", topkEnabled: boolean, tipKey: string}) => void}}
 */
export function createTaskSwitch({ i18n, onChoose }) {
  const el = document.createElement("div");
  el.className = "trace-task";
  el.hidden = true;
  const seg = document.createElement("div");
  seg.className = "miniseg task-seg";
  seg.setAttribute("role", "group");
  seg.setAttribute("aria-label", i18n.t("task.group"));
  /** @type {"predict" | "topk"} */
  let current = "predict";
  /** @type {Record<string, HTMLButtonElement>} */
  const buttons = {};
  for (const value of /** @type {const} */ (["predict", "topk"])) {
    const b = document.createElement("button");
    b.type = "button";
    b.dataset.value = value;
    b.textContent = i18n.t(`task.${value}`);
    b.title = i18n.t(`task.${value}_tip`);
    b.addEventListener("click", () => {
      if (b.getAttribute("aria-disabled") === "true" || current === value) return; // a placeholder does nothing; the pressed choice is already the task
      onChoose(value);
    });
    buttons[value] = b;
    seg.appendChild(b);
  }
  el.appendChild(seg);

  return {
    el,
    sync({ shown, task, topkEnabled, tipKey }) {
      current = task;
      el.hidden = !shown;
      for (const value of /** @type {const} */ (["predict", "topk"])) {
        const b = buttons[value];
        const on = value === task;
        b.classList.toggle("active", on);
        b.setAttribute("aria-pressed", String(on));
      }
      const topk = buttons.topk;
      const off = !topkEnabled;
      topk.classList.toggle("is-future", off);
      topk.setAttribute("aria-disabled", String(off));
      topk.title = i18n.t(off ? tipKey : "task.topk_tip");
      if (off) {
        topk.setAttribute("tabindex", "-1"); // not selectable by keyboard
        topk.setAttribute("aria-label", `${i18n.t("task.topk")}: ${i18n.t(tipKey)}`); // the reason is read with the name
      } else {
        topk.removeAttribute("tabindex");
        topk.removeAttribute("aria-label");
      }
    },
  };
}
