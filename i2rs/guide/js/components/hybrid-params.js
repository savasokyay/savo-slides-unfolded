// @ts-check
// WP-222: the Parameters panel of the weighted hybrid (`#/combine?m=weighted`) - the ParamForm of the hybrid page. components/param-form.js hands the engine "hybrid" to this module (one line at
// its head); the form is the same panel in look and behaviour (the app's `.param-field`, segmented controls and check boxes, Apply / Defaults in the panel head, Enter applies, every control has
// a hover tip `param_tip.hybrid_*`, defaults come from /api/config/algorithms `hybrid` and stay out of the URL), with its own controls:
//   * the bases (a check box per base: uCF, iCF, MF, CB - the default is all four; fewer than two is no blend, so Apply waits and says why) - route `bases`;
//   * which weight vector predicts the target - closed form (ridge), gradient steps, equal 1/q (`w`);
//   * the constraint - the weights add up to one (the default: a weighted average) or are free, which can also rescale the level (`wc`);
//   * where the weights are fitted - the held-out entries (the right way) or the training entries (the foil: every base has seen them), the two side by side, both labelled (`fo`);
//   * the held-out share, the per-user cap, the smallest user that keeps a share held out, the number of gradient steps, the step scale, the ridge penalty (`hf`, `hc`, `mr`, `gs`, `gss`, `rl`);
//   * clip (`clip`).
// The route <-> config translation is util/hybrid-config.js (pure, pinned under node); this file only draws and collects.
// WP-222b: the switching walk (`#/combine?m=switching`) has a form of its own in the same look (`createSwitchParams`, chosen by the route's `m`), built from the widgets the two forms share:
//   * the rule - a bucket of models (one winner for the user, picked on the user's own newest ratings) or the cold-start neighbour rule (one choice per film) - route `sr`;
//   * the bucket's controls: the bases (the same check boxes), the error that picks the winner (RMSE or MAE: `cr`), where the winner is picked - the held-out ratings (the right way) or the
//     training ratings (the foil), side by side and both labelled (`so`); WP-239: under the error's choice, faded chips for the selection rules the literature uses and the lab does not
//     have (precision@K, a confidence threshold, a rating-count threshold, a learned selector) - not selectable, never read by the form;
//   * the rule's controls: the collaborative base (iCF or uCF: `cfb`) and how many neighbours it needs for a film (`mn`). The other rule's controls are hidden: a rule has no winner to pick
//     and a bucket no neighbour count;
//   * the user's held-out share (`sh`: the newest share of the ACTIVE user's own ratings, the switching walk's own split), the per-user cap (`hc`), the smallest user that keeps a share held
//     out (`mr`), clip (`clip`).

import { HYBRID_BASES, basesFromParam, basesParam } from "../util/hybrid-config.js";
import { segOption } from "../util/seg-option.js";

/** labels that start with a symbol the page writes in lower case keep their case (trace.css upper-cases the other captions) */
const KEEP_CASE = new Set(["params.hybrid_ridge"]);

/**
 * WP-222b: the widgets the two forms share - a captioned field, a chip label, a segmented control, a number box, a check box field, the row of base check boxes, the Apply / Defaults pair,
 * the "a number that differs from its default" reading - each in the app's own look (components/param-form.js), closed over the language.
 * @param {any} i18n
 */
function widgets(i18n) { // WP-222b
  /** @param {string} key a `param_tip.<key>` */
  const tipText = (key) => i18n.t(`param_tip.${key}`);

  /**
   * @param {string} labelKey
   * @param {HTMLElement} control
   * @param {string} [tipKey] the hover tip of the caption and the control
   */
  function field(labelKey, control, tipKey) {
    const wrap = document.createElement("label");
    wrap.className = "param-field";
    const span = document.createElement("span");
    span.textContent = i18n.t(labelKey);
    if (KEEP_CASE.has(labelKey)) span.classList.add("keep-case");
    wrap.append(span, control);
    if (tipKey) wrap.title = tipText(tipKey);
    return wrap;
  }

  /**
   * A chip is two lines at most - "training entries (foil)" is the word, then the parenthesis small under it (the app's chip label, as components/param-form.js `setChipLabel`).
   * @param {HTMLElement} b
   * @param {string} text
   */
  function setChipLabel(b, text) {
    const m = /^(.*\S)\s+(\(.+\))$/.exec(text);
    if (!m) {
      b.textContent = text;
      return;
    }
    const word = document.createElement("span");
    word.textContent = m[1];
    const note = document.createElement("small");
    note.textContent = m[2];
    b.append(word, " ", note); // the space keeps the accessible name "training entries (foil)"
  }

  /**
   * A segmented control of mutually exclusive values (the app's `.miniseg`): the pressed choice is `aria-pressed`, a choice may carry its own tip.
   * @param {import("../util/seg-option.js").SegEntry[]} options value, label, tip
   * @param {string} value
   */
  function miniseg(options, value) {
    const seg = document.createElement("div");
    seg.className = "miniseg";
    seg.dataset.value = value;
    for (const entry of options) {
      const { value: choice, label, tip } = segOption(entry);
      const b = document.createElement("button");
      b.type = "button";
      setChipLabel(b, label);
      b.dataset.value = choice;
      if (tip) b.title = tip;
      b.classList.toggle("active", choice === value);
      b.setAttribute("aria-pressed", String(choice === value));
      b.addEventListener("click", () => {
        seg.dataset.value = choice;
        for (const other of seg.querySelectorAll("button")) {
          other.classList.toggle("active", other === b);
          other.setAttribute("aria-pressed", String(other === b));
        }
        seg.dispatchEvent(new Event("change"));
      });
      seg.appendChild(b);
    }
    return seg;
  }

  /**
   * @param {{min?: string, max?: string, step?: string, value: string, placeholder?: string}} o
   * @returns {HTMLInputElement}
   */
  function numberBox(o) {
    const el = document.createElement("input");
    el.type = "number";
    if (o.min !== undefined) el.min = o.min;
    if (o.max !== undefined) el.max = o.max;
    el.step = o.step ?? "any";
    el.value = o.value;
    if (o.placeholder) el.placeholder = o.placeholder;
    return el;
  }

  /** @param {string} labelKey @param {HTMLInputElement} box @param {string} tipKey */
  function checkboxField(labelKey, box, tipKey) {
    const wrap = document.createElement("label");
    wrap.className = "param-field param-check";
    const span = document.createElement("span");
    span.textContent = i18n.t(labelKey);
    wrap.append(box, span);
    wrap.title = tipText(tipKey);
    return wrap;
  }

  /**
   * The bases: a check box per base (uCF, iCF, MF, CB), the route's choice ticked. A div, not a span: `.param-field > span` is the caption's style (trace.css).
   * @param {readonly string[]} chosen
   * @returns {{row: HTMLElement, boxes: Map<string, HTMLInputElement>}}
   */
  function basesRow(chosen) {
    /** @type {Map<string, HTMLInputElement>} */
    const boxes = new Map();
    const row = document.createElement("div");
    row.className = "hybrid-bases";
    row.setAttribute("role", "group");
    row.setAttribute("aria-label", i18n.t("params.hybrid_bases"));
    for (const id of HYBRID_BASES) {
      const wrap = document.createElement("label");
      wrap.className = "hybrid-base";
      wrap.title = tipText(`hybrid_base_${id}`);
      const box = document.createElement("input");
      box.type = "checkbox";
      box.checked = chosen.includes(id);
      boxes.set(id, box);
      const word = document.createElement("span");
      word.textContent = i18n.t(`params.hybrid_base_${id}`);
      wrap.append(box, word);
      row.appendChild(wrap);
    }
    return { row, boxes };
  }

  /** the Apply and Defaults buttons of the panel head; a click on them is not a click on the head (which folds the panel) */
  function actionButtons() {
    const actions = document.createElement("div");
    actions.className = "param-actions";
    const apply = document.createElement("button");
    apply.type = "button";
    apply.className = "btn btn-primary btn-sm";
    apply.textContent = i18n.t("params.apply");
    const reset = document.createElement("button");
    reset.type = "button";
    reset.className = "btn btn-sm";
    reset.textContent = i18n.t("params.reset");
    actions.append(apply, reset);
    actions.addEventListener("click", (e) => e.stopPropagation()); // in the panel head: a click is not a click on the head (it folds the panel)
    return { actions, apply, reset };
  }

  /** `undefined` for a number that equals the default or is no usable number: defaults stay out of the URL @param {HTMLInputElement} el @param {number} dflt @param {(n: number) => boolean} ok */
  function numberParam(el, dflt, ok) {
    if (el.value.trim() === "") return undefined;
    const n = Number(el.value);
    return Number.isFinite(n) && ok(n) && n !== dflt ? String(n) : undefined;
  }

  /**
   * WP-239: choices the lab does not have, drawn under the real ones so that the reader sees what else a system could choose by: faded chips with no value, which a click does not
   * select (the app's `aria-disabled`: the chip stays focusable and its tip readable). The form never reads them. The row cancels the click's default action: inside the field's
   * `<label>` a click on the gap between two chips would otherwise be passed on to the label's first control and select it.
   * @param {string[]} labels already translated
   * @param {string} tip the sentence of every chip and of the row
   */
  function placeholders(labels, tip) {
    const row = document.createElement("div");
    row.className = "param-placeholders";
    row.setAttribute("role", "group");
    row.title = tip;
    for (const label of labels) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "param-placeholder";
      b.setAttribute("aria-disabled", "true");
      b.textContent = label; // one line: a two-line chip ("precision@K" over "(ranking)") made the field taller than the bases column beside it
      b.title = tip;
      row.appendChild(b);
    }
    row.addEventListener("click", (e) => e.preventDefault());
    return row;
  }

  return { tipText, field, miniseg, numberBox, checkboxField, basesRow, actionButtons, numberParam, placeholders }; // WP-239: placeholders
}

/**
 * @param {HTMLElement} root
 * @param {{i18n: any, defaults: Record<string, any>, values: Record<string, string>, actionsHost?: HTMLElement, onApply: (params: Record<string, string | undefined>) => void}} opts
 */
export function createHybridParams(root, opts) {
  if (opts.values?.m === "switching") return createSwitchParams(root, opts); // WP-222b: the switching walk's own form
  const { i18n } = opts;
  const d = opts.defaults || {};
  const v = opts.values;

  root.innerHTML = "";
  opts.actionsHost?.replaceChildren(); // a rebuilt form brings its own buttons
  opts.actionsHost?.parentElement?.querySelector(".param-hint")?.remove(); // and its own hint line
  root.classList.add("param-form");
  const { tipText, field, miniseg, numberBox, checkboxField, basesRow, actionButtons, numberParam } = widgets(i18n);

  // ── the controls ─────────────────────────────────────────────────────────────────────────────
  // the bases: the route's choice, else all four (the engine's default)
  const chosen = basesFromParam(v.bases) ?? [...HYBRID_BASES];
  const { row: basesRowEl, boxes: baseBoxes } = basesRow(chosen); // WP-222b

  const weightsSeg = miniseg(
    [
      ["ridge", i18n.t("params.hybrid_w_ridge"), tipText("hybrid_w_ridge")],
      ["gd", i18n.t("params.hybrid_w_gd"), tipText("hybrid_w_gd")],
      ["equal", i18n.t("params.hybrid_w_equal"), tipText("hybrid_w_equal")],
    ],
    v.w === "gd" || v.w === "equal" ? v.w : String(d.weights || "ridge")
  );
  const constraintSeg = miniseg(
    [
      ["sum_to_one", i18n.t("params.hybrid_c_sum"), tipText("hybrid_c_sum")],
      ["none", i18n.t("params.hybrid_c_none"), tipText("hybrid_c_none")],
    ],
    v.wc === "none" ? "none" : String(d.constraint || "sum_to_one")
  );
  // the foil and the right way, side by side and both named in their labels ("(right way)" / "(foil)"): weights fitted where the bases were trained flatter them, weights fitted on the held-out
  // entries do not. No pulsing choice (`fault`): the red pulse is the instructor's for the item-mean centring alone (tests/app/test_fault_pulse.py)
  const fitSeg = miniseg(
    [
      ["heldout", i18n.t("params.hybrid_fit_heldout"), tipText("hybrid_fit_heldout")],
      ["train", i18n.t("params.hybrid_fit_train"), tipText("hybrid_fit_train")],
    ],
    v.fo === "train" ? "train" : String(d.fit_on || "heldout")
  );
  const hfDefault = Number(d.holdout_frac ?? 0.2);
  const hfIn = numberBox({ min: "0.05", max: "0.5", step: "0.05", value: v.hf ?? String(hfDefault) });
  // the cap: a number of ratings per user, or empty for no cap (the engine's null); the route's `none` is the empty box
  const hcDefault = d.holdout_max_per_user === null || d.holdout_max_per_user === undefined ? null : Number(d.holdout_max_per_user);
  const hcIn = numberBox({ min: "1", step: "1", value: v.hc === "none" ? "" : (v.hc ?? (hcDefault === null ? "" : String(hcDefault))), placeholder: "∞" });
  const mrDefault = Number(d.min_ratings ?? 5);
  const mrIn = numberBox({ min: "2", step: "1", value: v.mr ?? String(mrDefault) });
  const gsDefault = Number(d.gd_steps ?? 30);
  const gsIn = numberBox({ min: "1", max: "200", step: "1", value: v.gs ?? String(gsDefault) });
  const gssDefault = Number(d.gd_step_scale ?? 1);
  const gssIn = numberBox({ min: "0.1", max: "1.9", step: "0.1", value: v.gss ?? String(gssDefault) });
  const rlDefault = Number(d.ridge_lambda ?? 0.01);
  const rlIn = numberBox({ min: "0", step: "any", value: v.rl ?? String(rlDefault) });
  const clipIn = document.createElement("input");
  clipIn.type = "checkbox";
  clipIn.checked = v.clip !== undefined ? v.clip === "1" || v.clip === "true" : !!d.clip;

  // ── layout: the choices that change the walk in a first row, the numbers under it ────────────
  const grid = document.createElement("div");
  grid.className = "param-grid";
  grid.append(
    field("params.hybrid_bases", basesRowEl, "hybrid_bases"), // WP-222b
    field("params.hybrid_weights", weightsSeg, "hybrid_weights"),
    field("params.hybrid_constraint", constraintSeg, "hybrid_constraint"),
    field("params.hybrid_fit_on", fitSeg, "hybrid_fit_on")
  );
  const extra = document.createElement("div");
  extra.className = "param-grid param-grid-knn param-extra";
  extra.append(
    field("params.hybrid_holdout_frac", hfIn, "hybrid_holdout_frac"),
    field("params.hybrid_holdout_cap", hcIn, "hybrid_holdout_cap"),
    field("params.hybrid_min_ratings", mrIn, "hybrid_min_ratings"),
    field("params.hybrid_gd_steps", gsIn, "hybrid_gd_steps"),
    field("params.hybrid_gd_scale", gssIn, "hybrid_gd_scale"),
    field("params.hybrid_ridge", rlIn, "hybrid_ridge"),
    checkboxField("params.clip", clipIn, "hybrid_clip")
  );
  const { actions, apply, reset } = actionButtons(); // WP-222b

  // Apply waits while fewer than two bases are ticked (a blend of one is no blend: the engine would answer 422); the button keeps its box and focus (`aria-disabled`: a click does nothing,
  // the tip says what is missing) and the same sentence stands in the head beside it (`.param-hint`). Defaults is never blocked.
  const hint = document.createElement("span");
  hint.className = "param-hint";
  hint.setAttribute("role", "status");
  const ticked = () => HYBRID_BASES.filter((id) => baseBoxes.get(id)?.checked);
  const blocked = () => ticked().length < 2;
  const syncApply = () => {
    const wait = blocked();
    const text = wait ? i18n.t("params.hybrid_bases_min") : "";
    apply.setAttribute("aria-disabled", String(wait));
    apply.title = text;
    hint.textContent = text;
    hint.title = text;
  };
  for (const box of baseBoxes.values()) box.addEventListener("change", syncApply);
  opts.actionsHost?.after(hint);
  syncApply();

  root.append(grid, extra);
  const note = document.createElement("p");
  note.className = "sub param-note";
  note.textContent = i18n.t("params.hybrid_note");
  root.appendChild(note);
  (opts.actionsHost || root).appendChild(actions);

  function collect() {
    const cap = hcIn.value.trim() === "" ? "none" : String(Math.round(Number(hcIn.value)));
    const capNumber = Number(hcIn.value);
    return {
      bases: basesParam(ticked()),
      w: weightsSeg.dataset.value === String(d.weights || "ridge") ? undefined : weightsSeg.dataset.value,
      wc: constraintSeg.dataset.value === "none" ? "none" : undefined,
      fo: fitSeg.dataset.value === "train" ? "train" : undefined,
      hf: numberParam(hfIn, hfDefault, (n) => n > 0 && n < 1),
      // the cap: empty is "no cap" (written `none`, unless that is the default too); a number is written unless it is the default
      hc: hcIn.value.trim() === "" ? (hcDefault === null ? undefined : cap) : Number.isFinite(capNumber) && capNumber >= 1 && Math.round(capNumber) !== hcDefault ? cap : undefined,
      mr: numberParam(mrIn, mrDefault, (n) => n >= 2),
      gs: numberParam(gsIn, gsDefault, (n) => n >= 1 && n <= 200),
      gss: numberParam(gssIn, gssDefault, (n) => n > 0 && n < 2),
      rl: numberParam(rlIn, rlDefault, (n) => n >= 0),
      clip: clipIn.checked ? "1" : undefined,
    };
  }

  apply.addEventListener("click", () => {
    if (blocked()) return; // fewer than two bases: nothing to apply (the tip on the button says so)
    opts.onApply(collect());
  });
  reset.addEventListener("click", () => opts.onApply({ bases: undefined, w: undefined, wc: undefined, fo: undefined, hf: undefined, hc: undefined, mr: undefined, gs: undefined, gss: undefined, rl: undefined, clip: undefined }));
  root.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && /** @type {HTMLElement} */ (e.target).tagName === "INPUT") {
      e.preventDefault();
      if (blocked()) return;
      opts.onApply(collect());
    }
  });

  return {
    collect,
    /** the page tells the form whether the active user has rated the target: nothing in this form depends on it */
    setTargetRated() {},
    /** a note beside Apply / Defaults (saved walks): this page has none */
    setNote() {},
    /** the stored-model row: the hybrid has no stored model */
    setModelState() {},
  };
}

/**
 * WP-222b: the Parameters panel of the switching hybrid (`#/combine?m=switching`): the rule, the bucket's controls or the rule's, the user's held-out share and the shared numbers. The
 * controls of the rule that is not chosen are hidden (`hidden` on the field; the stylesheet honours it), so the panel shows only what the walk reads; Apply waits while the bucket has fewer
 * than two bases ticked, as the weighted form does - the neighbour rule's two bases are its own, so there it never waits.
 * @param {HTMLElement} root
 * @param {{i18n: any, defaults: Record<string, any>, values: Record<string, string>, actionsHost?: HTMLElement, onApply: (params: Record<string, string | undefined>) => void}} opts
 */
function createSwitchParams(root, opts) {
  const { i18n } = opts;
  const d = opts.defaults || {};
  const v = opts.values;

  root.innerHTML = "";
  opts.actionsHost?.replaceChildren(); // a rebuilt form brings its own buttons
  opts.actionsHost?.parentElement?.querySelector(".param-hint")?.remove(); // and its own hint line
  root.classList.add("param-form", "hybrid-switch-form");
  const { tipText, field, miniseg, numberBox, checkboxField, basesRow, actionButtons, numberParam, placeholders } = widgets(i18n); // WP-239: placeholders

  // ── the controls ─────────────────────────────────────────────────────────────────────────────
  // the bucket's bases: the route's choice, else all four (the engine's default); the neighbour rule's are the collaborative base and the content base, nothing to tick
  const chosen = basesFromParam(v.bases) ?? [...HYBRID_BASES];
  const { row: basesRowEl, boxes: baseBoxes } = basesRow(chosen);
  const ruleSeg = miniseg(
    [
      ["bucket", i18n.t("params.hybrid_sw_rule_bucket"), tipText("hybrid_sw_rule_bucket")],
      ["neighbours", i18n.t("params.hybrid_sw_rule_neighbours"), tipText("hybrid_sw_rule_neighbours")],
    ],
    v.sr === "neighbours" ? "neighbours" : String(d.switch_rule || "bucket")
  );
  const crSeg = miniseg(
    [
      ["rmse", i18n.t("params.hybrid_sw_cr_rmse"), tipText("hybrid_sw_cr_rmse")],
      ["mae", i18n.t("params.hybrid_sw_cr_mae"), tipText("hybrid_sw_cr_mae")],
    ],
    v.cr === "mae" ? "mae" : String(d.criterion || "rmse")
  );
  // the foil and the right way, side by side and both named in their labels ("(right way)" / "(foil)"): a winner picked on ratings every recommender has learned from is the one that
  // memorised them; picked on the user's held-out ratings it is the one that predicts best. No pulsing choice (`fault`): the red pulse is the instructor's for the item-mean centring alone
  const selectSeg = miniseg(
    [
      ["heldout", i18n.t("params.hybrid_sw_select_heldout"), tipText("hybrid_sw_select_heldout")],
      ["train", i18n.t("params.hybrid_sw_select_train"), tipText("hybrid_sw_select_train")],
    ],
    v.so === "train" ? "train" : String(d.select_on || "heldout")
  );
  const cfSeg = miniseg(
    [
      ["icf", i18n.t("params.hybrid_sw_cf_icf"), tipText("hybrid_sw_cf_icf")],
      ["ucf", i18n.t("params.hybrid_sw_cf_ucf"), tipText("hybrid_sw_cf_ucf")],
    ],
    v.cfb === "ucf" ? "ucf" : String(d.cf_base || "icf")
  );
  const shDefault = Number(d.switch_holdout_frac ?? 0.25);
  const shIn = numberBox({ min: "0.05", max: "0.5", step: "0.05", value: v.sh ?? String(shDefault) });
  const mnDefault = Number(d.min_neighbours ?? 1);
  const mnIn = numberBox({ min: "1", step: "1", value: v.mn ?? String(mnDefault) });
  // the cap: a number of ratings, or empty for no cap (the engine's null); the route's `none` is the empty box
  const hcDefault = d.holdout_max_per_user === null || d.holdout_max_per_user === undefined ? null : Number(d.holdout_max_per_user);
  const hcIn = numberBox({ min: "1", step: "1", value: v.hc === "none" ? "" : (v.hc ?? (hcDefault === null ? "" : String(hcDefault))), placeholder: "∞" });
  const mrDefault = Number(d.min_ratings ?? 5);
  const mrIn = numberBox({ min: "2", step: "1", value: v.mr ?? String(mrDefault) });
  const clipIn = document.createElement("input");
  clipIn.type = "checkbox";
  clipIn.checked = v.clip !== undefined ? v.clip === "1" || v.clip === "true" : !!d.clip;

  // ── layout: the rule and its choices in a first row, the numbers under it ───────────────────
  const grid = document.createElement("div");
  grid.className = "param-grid";
  const basesField = field("params.hybrid_bases", basesRowEl, "hybrid_sw_bases");
  const crField = field("params.hybrid_sw_criterion", crSeg, "hybrid_sw_criterion");
  // WP-239: the selection rules the literature uses and the lab does not have, under MAE / RMSE: faded, not selectable, and their tip says so (the form's value stays the segmented control's)
  crField.appendChild(placeholders(["precision", "confidence", "counts", "learned"].map((name) => i18n.t(`params.hybrid_sw_cr_${name}`)), tipText("hybrid_sw_cr_not_in_lab")));
  const selectField = field("params.hybrid_sw_select_on", selectSeg, "hybrid_sw_select_on");
  const cfField = field("params.hybrid_sw_cf_base", cfSeg, "hybrid_sw_cf_base");
  grid.append(field("params.hybrid_sw_rule", ruleSeg, "hybrid_sw_rule"), basesField, crField, selectField, cfField);
  const extra = document.createElement("div");
  extra.className = "param-grid param-grid-knn param-extra";
  const mnField = field("params.hybrid_sw_min_neighbours", mnIn, "hybrid_sw_min_neighbours");
  extra.append(
    field("params.hybrid_sw_holdout", shIn, "hybrid_sw_holdout"),
    field("params.hybrid_holdout_cap", hcIn, "hybrid_sw_holdout_cap"),
    field("params.hybrid_min_ratings", mrIn, "hybrid_sw_min_ratings"),
    mnField,
    checkboxField("params.clip", clipIn, "hybrid_sw_clip")
  );
  const { actions, apply, reset } = actionButtons();

  // the bucket shows the bases, the criterion and where the winner is picked; the neighbour rule shows its base and its neighbour count: the other rule's controls are hidden
  const bucket = () => ruleSeg.dataset.value !== "neighbours";
  const hint = document.createElement("span");
  hint.className = "param-hint";
  hint.setAttribute("role", "status");
  const ticked = () => HYBRID_BASES.filter((id) => baseBoxes.get(id)?.checked);
  const blockedSwitch = () => bucket() && ticked().length < 2; // the rule's bases are its own two: nothing to tick, nothing to wait for
  const syncApply = () => {
    const wait = blockedSwitch();
    const text = wait ? i18n.t("params.hybrid_bases_min") : "";
    apply.setAttribute("aria-disabled", String(wait));
    apply.title = text;
    hint.textContent = text;
    hint.title = text;
  };
  const byRule = () => {
    const b = bucket();
    basesField.hidden = !b;
    crField.hidden = !b;
    selectField.hidden = !b;
    cfField.hidden = b;
    mnField.hidden = b;
    syncApply();
  };
  for (const box of baseBoxes.values()) box.addEventListener("change", syncApply);
  ruleSeg.addEventListener("change", byRule);
  opts.actionsHost?.after(hint);
  byRule();

  root.append(grid, extra);
  const note = document.createElement("p");
  note.className = "sub param-note";
  note.textContent = i18n.t("params.hybrid_sw_note");
  root.appendChild(note);
  (opts.actionsHost || root).appendChild(actions);

  function collectSwitch() {
    const b = bucket();
    const cap = hcIn.value.trim() === "" ? "none" : String(Math.round(Number(hcIn.value)));
    const capNumber = Number(hcIn.value);
    // the engine's own constants are the defaults the route leaves out (util/hybrid-config.js reads `sr`, `cr`, `so`, `cfb` only for the other value), as the weighted form's `w` / `wc` / `fo`
    return {
      sr: ruleSeg.dataset.value === "neighbours" ? "neighbours" : undefined,
      bases: b ? basesParam(ticked()) : undefined,
      cr: b && crSeg.dataset.value === "mae" ? "mae" : undefined,
      so: b && selectSeg.dataset.value === "train" ? "train" : undefined,
      cfb: !b && cfSeg.dataset.value === "ucf" ? "ucf" : undefined,
      mn: b ? undefined : numberParam(mnIn, mnDefault, (n) => n >= 1),
      sh: numberParam(shIn, shDefault, (n) => n > 0 && n <= 0.5),
      // the cap: empty is "no cap" (written `none`, unless that is the default too); a number is written unless it is the default
      hc: hcIn.value.trim() === "" ? (hcDefault === null ? undefined : cap) : Number.isFinite(capNumber) && capNumber >= 1 && Math.round(capNumber) !== hcDefault ? cap : undefined,
      mr: numberParam(mrIn, mrDefault, (n) => n >= 2),
      clip: clipIn.checked ? "1" : undefined,
    };
  }

  apply.addEventListener("click", () => {
    if (blockedSwitch()) return; // the bucket with fewer than two bases: nothing to apply (the tip on the button says so)
    opts.onApply(collectSwitch());
  });
  reset.addEventListener("click", () => opts.onApply({ sr: undefined, bases: undefined, cr: undefined, so: undefined, cfb: undefined, mn: undefined, sh: undefined, hc: undefined, mr: undefined, clip: undefined }));
  root.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && /** @type {HTMLElement} */ (e.target).tagName === "INPUT") {
      e.preventDefault();
      if (blockedSwitch()) return;
      opts.onApply(collectSwitch());
    }
  });

  return {
    collect: collectSwitch,
    /** the page tells the form whether the active user has rated the target: nothing in this form depends on it */
    setTargetRated() {},
    /** a note beside Apply / Defaults (saved walks): this page has none */
    setNote() {},
    /** the stored-model row: the hybrid has no stored model */
    setModelState() {},
  };
}
