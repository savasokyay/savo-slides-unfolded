// @ts-check
// WP-41: ParamForm - the engine options as URL-synced controls. Every field maps to one route
// param (plan §3.4c): sim, mc, k, sw ("none" | n for min(c/n,1) | "raw" for c), den, clip,
// keepneg. Defaults come from /api/config/algorithms (never hardcoded here).
// WP-42 (item-based only): ctr ("item" = item-mean centring, the labelled fault; absent = user
// mean), pred ("baseline" = item-mean baseline; absent = Sarwar weighted average) and deg (the
// legacy Q2ij.m degree filter: a value < 1 is a fraction of users with a STRICT ">" rule, a value
// >= 1 is a minimum rater count; absent = off).
// WP-45 (content-based "cb" only): similarity/mean_convention/denominator/keep_negative are not
// shown at all - TF-IDF cosine has none of those choices (always non-negative, no active-user
// mean). mst (min shared tags), hyb ("weighted" | "switching", absent = content-only) and its one
// parameter, alpha (weighted) or mcfn (switching, min CF neighbours to trust it).
// WP-46 (MF "mf" only): alg + the MFConfig fields nf lr reg bias std lam bs ein mr seed and the
// trainer block ep pat vf; syncAlgorithm() hides what the chosen algorithm ignores; clip stays
// for the rating models. No k / significance / similarity controls - a factor model has none.
// WP-47 (DNN "dnn" only): arch + layers / drop / opt / wd / dev (DNNConfig fields) next to the shared
// nf lr bs std seed ep pat vf clip; syncArchitecture() hides the MLP fields for a pure GMF.
// WP-84 (D7, behind ui.features.attribute_filter): uCF fg (genres, comma-joined) fy (year range
// "min-max") ms ("segment" = segment mean); iCF ufc ("class" cohort) ufn (min ratings) cfg
// (candidate genre match any | all) cfy (candidate year window) ms. Absent = off; the controls
// render only while the flag is on, so a lecture before the exam debrief shows no trace of them.
// WP-109: every control has a hover tip (`param_tip.<key>`, a `title` on the field; a choice of a segmented control has its own); the long
// "keep negative similarities" text also sits behind an (i) bubble. The mean-convention chips follow the pair on the page: `setTargetRated`
// (called by the trace page once the trace is known) lets the two chips that are the same number say so (util/mean-chips.js).
// WP-109 (8)(9): a chip's label is its word with the parenthesis small under it (two lines at most); the user- / item-based pages lay the
// fields out as one wrapping row of natural widths with the two check boxes stacked at its right end; Apply / Defaults sit in the panel head.
// WP-110: the mean-convention chips follow the measure (`uses_centre` of /api/config/similarities: a measure without a user centre switches off the
// co-rated-only chip alone; on the item-based page the chips fade unless the measure centres and is not the user-centred adjusted cosine), the cosine
// has a "norms" choice (`cs`: full vectors | co-rated only; the space is kept while another measure is chosen) and the measure has an (i).
// WP-110 (b''): the constrained Pearson has a fixed centre z (`cz`, "centre (z)", shown only while it is chosen); its default and bounds come from
// the config response (`constrained_centre`), else from the dataset's scale (util/centre-field.js).
// WP-141 (MF and DNN pages in the top-K task, `task: "topk"`): two more controls - `k`, the list length (10 | 20; a deep link may name another, which then shows as a
// third choice), and `cand`, the candidate set (unseen | all: "all" keeps the rated films in the ranking, marked, for display). Both are REQUEST parameters; a default stays
// out of the URL. In the predict task the form is what it was.
// WP-176 (content-based "cb" only): the fields the item profiles are built from - `f` (a check box per field of the registry), `fw` (a weight beside each) and `tf` (the
// damping: raw | sqrt | log) next to `mst`; util/cb-fields.js parses and formats them, defaults stay out of the URL. The hybrid strategy / blend weight / CF threshold are NOT drawn
// any more (user decision, 2026-10-16: the content-based week does not push the reader toward hybrid mechanics); their controls still exist, detached, and hold the route's
// `hyb` / `alpha` / `mcfn`, so Apply and a deep link that names them keep working.
// WP-146 (MF and DNN pages, only while the server has the stored-model layer: `opts.modelSource`): one more field at the head of the grid, "Model" - `Pretrained | Train`, the line
// beside it saying which stored model that is - the route's `model` (absent = automatic; applied with Apply like every field). The page hands the form what it knows
// (`setModelState`: the stored model of these settings, the trace on screen's `meta.model`); components/model-source.js draws, util/model-source.js `rowView` decides.

import { infoTip } from "../util/info-tip.js"; // WP-109
import { richInfoTip } from "./rich-tip.js"; // WP-243: the glossary behind a labelled group's (i) on the neural pages
import { tipDefaults } from "../util/dnn-features.js"; // WP-246: the neural tips name the architecture's own default numbers
import { createModelSource } from "./model-source.js"; // WP-146
import { rowView, sourceFor, sourceParam } from "../util/model-source.js"; // WP-146
import { centreParam, centreSpec, centreValue } from "../util/centre-field.js"; // WP-110 (b'')
import { keepNegativeChecked, keepNegativeParam } from "../util/keep-negative.js"; // WP-115 (10)
import { icfMeanChipsInert, meanChipStates, meanSelection } from "../util/mean-chips.js"; // WP-109, WP-110
import { MEASURE_GROUPS, measureGroup } from "../util/measure-groups.js"; // WP-118 (1)
import { segOption } from "../util/seg-option.js"; // WP-133
import { candidatesFor, candidatesParam, kFor, kOptions, kParam } from "../util/topk.js"; // WP-141
import { TF_MODES, cbControlsFor, fieldsApplyWait, fieldsMasterState, fieldsMasterTarget, formatFieldList, formatFieldWeights, parseFieldList, parseFieldWeights } from "../util/cb-fields.js"; // WP-176; WP-176c; WP-176d; WP-208
import { createHybridParams } from "./hybrid-params.js"; // WP-222: the weighted hybrid's own Parameters panel

/**
 * @param {HTMLElement} root
 * @param {{
 *   i18n: any, similarities: any[], defaults: Record<string, any>,
 *   values: Record<string, string>, engine: "ucf" | "icf" | "cb" | "mf" | "dnn" | "hybrid",
 *   task?: "predict" | "topk", // WP-141: the task on screen (the model pages add the list length and the candidate set while it is top-K)
 *   features?: Record<string, boolean>, genres?: string[],
 *   modelSource?: boolean, // WP-146: the "Model" row (the model pages, on a server that has stored models)
 *   actionsHost?: HTMLElement, // WP-109 (9): where Apply / Defaults go (the panel head); default: the end of the form
 *   scale?: {min: number, max: number, step: number} | null, // WP-110 (b''): the dataset's rating scale - the fallback of the centre's default and bounds
 *   onApply: (params: Record<string, string | undefined>) => void, onKindChange?: (kind: "ridge" | "mlp") => void,
 * }} opts
 */
export function createParamForm(root, opts) {
  // WP-222: the weighted hybrid page (`#/combine`) has controls of its own (bases, weights, constraint, where they are fitted, the split and the descent): components/hybrid-params.js
  if (opts.engine === "hybrid") return createHybridParams(root, opts);
  const { i18n, similarities, defaults } = opts;
  const d = defaults || {};
  const sigDefault = d.sig_weight || {};

  root.innerHTML = "";
  opts.actionsHost?.replaceChildren(); // a rebuilt form brings its own buttons
  opts.actionsHost?.parentElement?.querySelector(".param-hint")?.remove(); // WP-176d: and its own hint line
  opts.actionsHost?.parentElement?.querySelector(".param-kind")?.remove(); // WP-195c stage 2: and its own model-kind choice
  root.classList.add("param-form");

  // WP-109: captions that start with a symbol the page writes in lower case (n in the formula, k in the flowchart) keep their case;
  // the other captions stay upper case (trace.css `.param-field > span`)
  const KEEP_CASE = new Set(["params.k", "params.k_top", "params.sig_n", "params.mmr_lambda", "params.centre", "params.cb_alpha"]); // WP-110 (b''): "centre (z)" - z is a symbol too; WP-195c: "Ridge penalty α" - an upper-case Α is the Latin A to the eye; WP-176 (stage 4): "MMR λ" - an upper-case Λ is another letter

  /** @param {string} key a `param_tip.<key>` */
  // WP-176a (a): the tip of the term weighting names the constant `a` of g(w) = a - Gini(w) as the engine reports it (`feature_weighting_a`), not a number typed into the text
  // WP-246: and the neural tips name the architecture's own defaults (the feature network's recipe is not the plain page's): `{lr}`, `{weight_decay}`, `{batch_size}`, `{dropout}`, `{max_epochs}`
  const tipText = (key) => i18n.t(`param_tip.${key}`, { a: String(d.feature_weighting_a ?? ""), ...tipDefaults(d, typeof i18n.lang === "function" ? i18n.lang() : "en") });

  /**
   * @param {string} labelKey
   * @param {HTMLElement} control
   * @param {string} [tipKey] WP-109: `param_tip.<tipKey>`, the hover tip of the caption and the control
   * @param {boolean} [withInfo] WP-110 (a'): the text sits behind an (i) bubble at the end of the caption (the app's own tip, like the
   *   keep-negative box) instead of a native tooltip
   */
  function field(labelKey, control, tipKey, withInfo = false) {
    const wrap = document.createElement("label");
    wrap.className = "param-field";
    const span = document.createElement("span");
    span.textContent = i18n.t(labelKey);
    if (KEEP_CASE.has(labelKey)) span.classList.add("keep-case");
    wrap.append(span, control);
    if (tipKey && withInfo) {
      const text = tipText(tipKey);
      const info = infoTip(text, i18n.t(labelKey), i18n.t(labelKey));
      info.title = "";
      span.append(info);
    } else if (tipKey) {
      wrap.title = tipText(tipKey);
    }
    return wrap;
  }

  /**
   * @param {[string, string][]} options value, label
   * @param {string} value
   */
  function select(options, value) {
    const el = document.createElement("select");
    for (const [v, text] of options) {
      const opt = document.createElement("option");
      opt.value = v;
      opt.textContent = text;
      opt.selected = v === value;
      el.appendChild(opt);
    }
    return el;
  }

  /**
   * WP-109 (8): a chip is two lines at most - "dynamic (target excluded)" is the word, then the parenthesis small under it.
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
    b.append(word, " ", note); // the space keeps the accessible name "dynamic (target excluded)"
  }

  /**
   * Segmented control of mutually exclusive values (mean convention, denominator).
   * WP-109: a choice may carry its own hover tip (third entry); the pressed choice is `aria-pressed`, and the group says "change"
   * on its own element when the choice moves.
   * WP-133: a choice may be flagged `{ fault: true }` (the fourth entry): its button carries `is-fault`, and the stylesheet pulses it red while it
   * is the pressed choice (util/seg-option.js).
   * @param {import("../util/seg-option.js").SegEntry[]} options value, label, tip, flags
   * @param {string} value
   */
  function miniseg(options, value) {
    const seg = document.createElement("div");
    seg.className = "miniseg";
    seg.dataset.value = value;
    for (const entry of options) {
      const { value: v, label: text, tip, fault } = segOption(entry); // WP-133
      const b = document.createElement("button");
      b.type = "button";
      setChipLabel(b, text);
      b.dataset.value = v;
      if (tip) b.title = tip;
      b.classList.toggle("is-fault", fault); // WP-133: a standing marker; the pulse needs `.active` as well
      b.classList.toggle("active", v === value);
      b.setAttribute("aria-pressed", String(v === value));
      b.addEventListener("click", () => {
        if (b.getAttribute("aria-disabled") === "true") return; // WP-110: switched off (kept focusable so its tip can be read)
        seg.dataset.value = v;
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
   * WP-110 (d): the measure selector in groups - the course's measures, the foils (valid statistics a recommender should not use, shown next
   * to the course measure so the difference is visible) and the faults (a named mistake of the legacy code) - instead of a "(foil)" suffix on
   * the option. The tag is the catalogue's (`tags`, one of core | foil | fault per measure); an empty group is not drawn.
   * WP-118 (1): on the item-based page only the user-centred adjusted cosine is the course's measure; the other "core" measures (raw cosine,
   * Pearson, ...) go into a group of their own, "Other measures: not centred by the user's mean", so the rule "centre every rating by its
   * USER's mean" is visible in the selector itself. The user-based page keeps its groups.
   * @param {any[]} items the catalogue's measures
   * @param {string} value the chosen measure
   * @param {boolean} [itemBased] the item-based page
   */
  function measureSelect(items, value, itemBased = false) {
    const el = document.createElement("select");
    for (const group of MEASURE_GROUPS) {
      const members = items.filter((s) => measureGroup(s, itemBased) === group); // WP-118 (1): util/measure-groups.js
      if (!members.length) continue;
      const optgroup = document.createElement("optgroup");
      optgroup.label = i18n.t(`params.sim_group_${group}`);
      for (const s of members) {
        const opt = document.createElement("option");
        opt.value = s.name;
        opt.textContent = i18n.t(s.label_key);
        opt.selected = s.name === value;
        optgroup.appendChild(opt);
      }
      el.appendChild(optgroup);
    }
    return el;
  }

  const v = opts.values;
  const simSel = measureSelect(
    // WP-42: the item-centred fault is the centring switch below, not a separate measure
    similarities.filter((s) => !s.name.endsWith("_item_centred")),
    v.sim || d.similarity || "pearson",
    opts.engine === "icf" // WP-118 (1)
  );
  // WP-110 (a): which measures centre on a user mean; a measure the catalogue does not flag claims nothing (stays enabled)
  const usesCentre = new Map(similarities.map((s) => [s.name, s.uses_centre !== false]));
  const mcSeg = miniseg(
    [
      ["dynamic", i18n.t("params.mc_dynamic")],
      ["static", i18n.t("params.mc_static")],
      ["corated_only", i18n.t("params.mc_corated_only")],
    ],
    v.mc || d.mean_convention || "dynamic"
  );
  const kIn = document.createElement("input");
  kIn.type = "number";
  kIn.min = "1";
  kIn.value = v.k ?? (d.k === null || d.k === undefined ? "" : String(d.k));
  kIn.placeholder = "∞";
  const sigModeSel = select(
    [
      ["none", i18n.t("params.sig_none")],
      ["min_ratio", i18n.t("params.sig_min_ratio")],
      ["raw_count", i18n.t("params.sig_raw_count")],
    ],
    v.sw === undefined ? sigDefault.mode || "min_ratio" : v.sw === "none" ? "none" : v.sw === "raw" ? "raw_count" : "min_ratio"
  );
  const sigNIn = document.createElement("input");
  sigNIn.type = "number";
  sigNIn.min = "1";
  sigNIn.value = v.sw && v.sw !== "none" && v.sw !== "raw" ? v.sw : String(sigDefault.n ?? 50);
  const denSeg = miniseg(
    [
      ["abs", i18n.t("params.den_abs"), tipText("den_abs")],
      ["signed", i18n.t("params.den_signed"), tipText("den_signed")],
    ],
    v.den || d.denominator || "abs"
  );
  const clipIn = document.createElement("input");
  clipIn.type = "checkbox";
  clipIn.checked = v.clip !== undefined ? v.clip === "1" || v.clip === "true" : !!d.clip;
  const negIn = document.createElement("input");
  negIn.type = "checkbox";
  negIn.checked = keepNegativeChecked(v.keepneg, d.keep_negative); // WP-115 (10): the page's own default (user-based: true, item-based: false)

  // WP-42: item-based controls (centring switch, prediction form, degree filter)
  const isItem = opts.engine === "icf";
  // WP-45: content-based controls (min shared tags, hybrid strategy + its one parameter)
  const isContent = opts.engine === "cb";
  // WP-195c: the content page's third method, the per-user model (`m=model`): its one extra field is the ridge penalty
  const isModel = isContent && opts.method === "model";
  // WP-208: the content page draws only the method-bound controls the chosen method READS (util/cb-fields.js `cbControlsFor`: the taste profile has no neighbours, the per-user model learns its own weights).
  // A control that is not drawn keeps its default and is NOT written to the route (`collect`), so a hidden setting can neither change a trace nor split its cache key. The other pages draw all of theirs.
  const cbShown = isContent ? cbControlsFor(opts.method, opts.task) : null;
  /** @param {import("../util/cb-fields.js").CbControl} key @returns {boolean} */
  const cbShows = (key) => cbShown === null || cbShown.has(key);
  const ctrSeg = miniseg(
    [
      ["user", i18n.t("params.ctr_user"), tipText("ctr_user")],
      ["item", i18n.t("params.ctr_item"), tipText("ctr_item"), { fault: true }], // WP-133: the lesson's deliberate mistake pulses while chosen
    ],
    v.ctr === "item" || (v.ctr === undefined && d.centering === "item_mean") ? "item" : "user"
  );
  const predSeg = miniseg(
    [
      ["wavg", i18n.t("params.pred_wavg"), tipText("pred_wavg")],
      ["baseline", i18n.t("params.pred_baseline"), tipText("pred_baseline")],
    ],
    v.pred === "baseline" || (v.pred === undefined && d.prediction === "item_mean_baseline") ? "baseline" : "wavg"
  );
  const degDefault = d.degree_filter || {};
  const degFromUrl = v.deg === undefined ? null : v.deg === "none" ? "none" : Number(v.deg) < 1 ? "fraction" : "count";
  const degModeSel = select(
    [
      ["none", i18n.t("params.deg_none")],
      ["fraction", i18n.t("params.deg_fraction")],
      ["count", i18n.t("params.deg_count")],
    ],
    degFromUrl || degDefault.mode || "none"
  );
  const degValueIn = document.createElement("input");
  degValueIn.type = "number";
  degValueIn.min = "0";
  degValueIn.step = "any";
  degValueIn.value =
    v.deg !== undefined && v.deg !== "none" ? v.deg : String(degDefault.value ?? 0.5);
  function syncDegree() {
    const mode = degModeSel.value;
    degValueIn.disabled = mode === "none";
    degValueIn.placeholder = mode === "count" ? "5" : "0.5";
    const current = Number(degValueIn.value);
    // switching the mode makes the old number meaningless (0.5 raters / a 5-users fraction)
    if (mode === "count" && (!Number.isFinite(current) || current < 1)) degValueIn.value = "5";
    if (mode === "fraction" && (!Number.isFinite(current) || current >= 1)) degValueIn.value = "0.5";
  }
  degModeSel.addEventListener("change", syncDegree);
  syncDegree();
  function syncCentering() {
    const on = simSel.value === "adjusted_cosine";
    ctrSeg.classList.toggle("disabled", !on);
    for (const b of ctrSeg.querySelectorAll("button")) b.disabled = !on;
  }
  if (isItem) {
    simSel.addEventListener("change", syncCentering);
    syncCentering();
  }

  // WP-84 (D7): attribute-filter controls - built always, appended to the grid only while the flag is on
  const filterOn = Boolean(opts.features && opts.features.attribute_filter);
  const isUser = opts.engine === "ucf";

  // WP-109 (6): the user-based mean-convention chips follow the pair on the page. `null` = no trace seen yet (nothing is claimed).
  /** @type {boolean | null} */
  let targetRated = null;
  /** the chosen measure carries a user centre (WP-110 a) */
  const centred = () => usesCentre.get(simSel.value) ?? true;
  function syncMeanChips() {
    if (!isUser) return; // item-based pages: the convention acts on the item vectors; their chips keep the caption's tip
    const states = meanChipStates({ selected: mcSeg.dataset.value || "", targetRated, usesCentre: centred() });
    for (const b of mcSeg.querySelectorAll("button")) {
      const state = states[/** @type {"dynamic" | "static" | "corated_only"} */ (b.dataset.value)];
      if (!state) continue;
      b.classList.toggle("equivalent", state.equivalent);
      b.setAttribute("aria-disabled", String(state.disabled)); // WP-110 (a): only the co-rated-only chip, only without a user centre
      b.title = tipText(state.tipKey);
    }
  }
  /**
   * WP-110 (a): the chips follow the measure. User-based: a measure without a user centre switches off the co-rated-only chip alone (there it is
   * the same number as dynamic; dynamic / static still move the prediction's baseline) and, when it was chosen, the choice falls back to dynamic.
   * Item-based: all three fade unless the measure centres and is not the user-centred adjusted cosine (`icf_mc_note` says why).
   */
  function syncMeanGate() {
    if (isUser) {
      const want = meanSelection({ selected: mcSeg.dataset.value || "", usesCentre: centred() });
      const target = /** @type {HTMLButtonElement | null} */ (mcSeg.querySelector(`button[data-value="${want}"]`));
      if (want !== mcSeg.dataset.value && target) target.click(); // its change event re-draws the chips
      else syncMeanChips();
    } else if (isItem) {
      const inert = icfMeanChipsInert({
        usesCentre: centred(),
        similarity: simSel.value,
        centering: ctrSeg.dataset.value === "item" ? "item_mean" : "user_mean",
      });
      mcSeg.classList.toggle("disabled", inert);
      for (const b of mcSeg.querySelectorAll("button")) b.setAttribute("aria-disabled", String(inert));
    }
  }
  simSel.addEventListener("change", syncMeanGate);
  ctrSeg.addEventListener("change", syncMeanGate);
  mcSeg.addEventListener("change", syncMeanChips);
  syncMeanGate();
  /** @param {boolean | null} rated the active user has rated the target (`trace.result.actual` is a number) */
  function setTargetRated(rated) {
    targetRated = rated;
    syncMeanChips();
    syncModelRow(); // WP-146: a rated target is the held-out cell (the model is trained again without it)
  }

  const genres = opts.genres || [];
  const fgSel = document.createElement("select");
  fgSel.multiple = true;
  fgSel.size = Math.min(Math.max(genres.length, 2), 5);
  const fgChosen = new Set(String(v.fg || "").split(",").filter(Boolean));
  for (const g of genres) {
    const opt = document.createElement("option");
    opt.value = g;
    opt.textContent = g;
    opt.selected = fgChosen.has(g);
    fgSel.appendChild(opt);
  }
  fgSel.disabled = genres.length === 0;
  const [fyLo, fyHi] = String(v.fy || "").split("-");
  const fyMinIn = document.createElement("input");
  fyMinIn.type = "number";
  fyMinIn.step = "1";
  fyMinIn.placeholder = "1900";
  fyMinIn.value = fyLo || "";
  const fyMaxIn = document.createElement("input");
  fyMaxIn.type = "number";
  fyMaxIn.step = "1";
  fyMaxIn.placeholder = "2030";
  fyMaxIn.value = fyHi || "";
  const msSeg = miniseg(
    [
      ["global", i18n.t("params.ms_global")],
      ["segment", i18n.t("params.ms_segment")],
    ],
    v.ms === "segment" ? "segment" : "global"
  );
  const ufcSel = select(
    [
      ["all", i18n.t("params.uf_all")],
      ["class", i18n.t("params.uf_class")],
    ],
    v.ufc === "class" ? "class" : "all"
  );
  const ufnIn = document.createElement("input");
  ufnIn.type = "number";
  ufnIn.min = "0";
  ufnIn.step = "1";
  ufnIn.placeholder = "0";
  ufnIn.value = v.ufn ?? "";
  const cfgSel = select(
    [
      ["none", i18n.t("params.cf_none")],
      ["any", i18n.t("params.cf_any")],
      ["all", i18n.t("params.cf_all")],
    ],
    v.cfg === "any" || v.cfg === "all" ? v.cfg : "none"
  );
  const cfyIn = document.createElement("input");
  cfyIn.type = "number";
  cfyIn.min = "0";
  cfyIn.step = "1";
  cfyIn.placeholder = "—";
  cfyIn.value = v.cfy ?? "";
  /** A matrix-restricting filter is chosen (the segment mean needs one; the server rejects it otherwise). */
  function filterChosen() {
    if (isUser) return fgSel.selectedOptions.length > 0 || fyMinIn.value !== "" || fyMaxIn.value !== "";
    return ufcSel.value === "class" || Number(ufnIn.value) > 0;
  }
  function syncScope() {
    const on = filterChosen();
    msSeg.classList.toggle("disabled", !on);
    for (const b of msSeg.querySelectorAll("button")) b.disabled = !on;
  }
  for (const el of [fgSel, fyMinIn, fyMaxIn, ufcSel, ufnIn]) el.addEventListener("input", syncScope);
  for (const el of [fgSel, ufcSel]) el.addEventListener("change", syncScope);
  syncScope();

  // WP-45: content-based controls
  const mstIn = document.createElement("input");
  mstIn.type = "number";
  mstIn.min = "0";
  mstIn.value = v.mst ?? String(d.min_shared_terms ?? 1);
  // WP-195c: the ridge penalty alpha of the per-user model (route `ma`; the engine's `cb.model.alpha`, > 0; `alpha` is the hybrid's blend weight)
  const modelAlphaDefault = Number(d.model?.alpha ?? 1);
  const maIn = document.createElement("input");
  maIn.type = "number";
  maIn.min = "0";
  maIn.step = "0.1";
  maIn.value = v.ma ?? String(modelAlphaDefault);
  // WP-195c stage 2: the per-user model's kind - the regression (the default; it stays out of the URL) or the small network (route `mk=mlp`, the engine's `cb.model.kind`); a network has no
  // ridge penalty, so the penalty's field is the regression's only
  const kindSeg = miniseg(
    [
      ["ridge", i18n.t("params.cb_kind_ridge"), tipText("cb_kind_ridge")],
      ["mlp", i18n.t("params.cb_kind_mlp"), tipText("cb_kind_mlp")],
    ],
    v.mk === "mlp" ? "mlp" : "ridge"
  );
  const hybDefault = d.hybrid || {};
  const hybSel = select(
    [
      ["none", i18n.t("params.hyb_none")],
      ["weighted", i18n.t("params.hyb_weighted")],
      ["switching", i18n.t("params.hyb_switching")],
    ],
    v.hyb || hybDefault.mode || "none"
  );
  const alphaIn = document.createElement("input");
  alphaIn.type = "number";
  alphaIn.min = "0";
  alphaIn.max = "1";
  alphaIn.step = "0.05";
  alphaIn.value = v.alpha !== undefined ? v.alpha : String(hybDefault.alpha ?? 0.5);
  const mcfnIn = document.createElement("input");
  mcfnIn.type = "number";
  mcfnIn.min = "1";
  mcfnIn.value = v.mcfn !== undefined ? v.mcfn : String(hybDefault.min_cf_neighbours ?? 1);
  function syncHybrid() {
    const mode = hybSel.value;
    alphaIn.disabled = mode !== "weighted";
    mcfnIn.disabled = mode !== "switching";
  }
  if (isContent) {
    hybSel.addEventListener("change", syncHybrid);
    syncHybrid();
  }

  // WP-176: the content page's FIELDS - a check box and a weight for each field of the registry, and the tf damping. `d.fields_available` is the registry (algorithms.yaml; never listed
  // here); the numeric columns are no fields (they never enter the similarity). The route's names are `f`, `fw`, `tf` (util/cb-fields.js); a default stays out of the URL.
  const fieldRegistry = isContent ? Object.entries(d.fields_available || {}).filter(([, spec]) => spec && spec.type !== "numeric") : [];
  const fieldOrder = fieldRegistry.map(([name]) => name);
  const fieldDefaults = Array.isArray(d.fields) && d.fields.length ? d.fields.map(String) : ["genres"];
  const routeFields = parseFieldList(v.f);
  const fieldChosen = new Set(routeFields.length ? routeFields : fieldDefaults);
  const routeWeights = parseFieldWeights(v.fw);
  const defaultWeights = d.weights && typeof d.weights === "object" ? d.weights : {};
  /** @type {Map<string, {box: HTMLInputElement, weight: HTMLInputElement}>} */
  const fieldInputs = new Map();
  const fieldsRow = document.createElement("div");
  fieldsRow.className = "param-fields";
  fieldsRow.setAttribute("role", "group");
  fieldsRow.setAttribute("aria-label", i18n.t("params.fields"));
  const fieldsCaption = document.createElement("span");
  fieldsCaption.className = "param-fields-caption";
  fieldsCaption.textContent = i18n.t("params.fields");
  fieldsCaption.title = tipText("fields");
  // WP-176c (user): the master box beside the caption - ticked: every field of the registry; unticked: none; the square (`indeterminate`): a partial choice. It sits on the caption's own
  // line (`.param-fields-head`, the box 12 px with no margin), so the line keeps its height and no chip moves when the box changes state; the chips drive it, it drives the chips.
  const fieldsAll = document.createElement("label");
  fieldsAll.className = "param-fields-all";
  fieldsAll.title = tipText("fields_all"); // WP-109: every control has a hover tip
  const fieldsAllBox = document.createElement("input");
  fieldsAllBox.type = "checkbox";
  const fieldsAllWord = document.createElement("span");
  fieldsAllWord.textContent = i18n.t("params.fields_all");
  fieldsAll.append(fieldsAllBox, fieldsAllWord);
  const fieldsHead = document.createElement("div");
  fieldsHead.className = "param-fields-head";
  fieldsHead.append(fieldsCaption, fieldsAll);
  const fieldChips = document.createElement("div");
  fieldChips.className = "param-fieldchips";
  for (const [name, spec] of fieldRegistry) {
    const chip = document.createElement("label");
    chip.className = "param-fieldchip";
    chip.title = tipText(`field_${name}`); // WP-109: every control has a hover tip
    const box = document.createElement("input");
    box.type = "checkbox";
    box.checked = fieldChosen.has(name);
    const word = document.createElement("span");
    word.textContent = i18n.t(`params.field_${name}`);
    const weight = document.createElement("input");
    weight.type = "number";
    weight.min = "0";
    weight.step = "0.5";
    weight.className = "param-fieldw";
    weight.value = String(routeWeights[name] ?? defaultWeights[name] ?? spec.weight ?? 1);
    weight.title = isModel ? `${tipText("field_weight")} ${tipText("field_weight_model")}` : tipText("field_weight"); // WP-208: the per-user model learns a weight per term - what a field weight is there
    weight.setAttribute("aria-label", `${i18n.t("params.field_weight")}: ${i18n.t(`params.field_${name}`)}`);
    const syncChip = () => {
      weight.disabled = !box.checked; // the box keeps its room (no jitter): only its look and its say change
      chip.classList.toggle("is-on", box.checked);
    };
    box.addEventListener("change", syncChip);
    syncChip();
    chip.append(box, word, weight);
    fieldChips.appendChild(chip);
    fieldInputs.set(name, { box, weight });
  }
  fieldsRow.append(fieldsHead, fieldChips); // WP-176c: the caption and the master box share one line
  const tfSeg = miniseg(
    TF_MODES.map((m) => [m, i18n.t(`params.tf_${m}`), tipText(`tf_${m}`)]),
    TF_MODES.includes(v.tf ?? "") ? /** @type {string} */ (v.tf) : TF_MODES.includes(d.tf) ? d.tf : "raw"
  );

  // WP-176a (a): the supervised term weighting g(w) = a - Gini(w) (request key `feature_weighting`, route `gw`; the engine's default `none` leaves the URL, a ticked box writes `gw=gini`)
  const gwDefault = d.feature_weighting === "gini";
  const gwIn = document.createElement("input");
  gwIn.type = "checkbox";
  gwIn.checked = v.gw !== undefined ? v.gw === "gini" : gwDefault;

  // WP-46: MF controls - one form for four algorithms; only the chosen one's fields are shown
  const isMF = opts.engine === "mf";
  const mfTrainer = d.trainer || {};
  const algSel = select(
    [
      ["funk_svd", i18n.t("params.alg_funk_svd")],
      ["als", i18n.t("params.alg_als")],
      ["bpr", i18n.t("params.alg_bpr")],
      ["ease", i18n.t("params.alg_ease")],
    ],
    v.alg || d.algorithm || "funk_svd"
  );
  // WP-124 (d'): the option's label stays short ("FunkSVD (biased MF, SGD)" - the summary chip says the same); what FunkSVD is, and is not, is the select's hover text
  const algTip = () => {
    algSel.title = algSel.value === "funk_svd" ? tipText("alg_funk_svd") : "";
  };
  algSel.addEventListener("change", algTip);
  algTip();
  /**
   * @param {string | undefined} raw route value
   * @param {unknown} fallback engine default
   * @param {Record<string, string>} attrs
   */
  function numberInput(raw, fallback, attrs) {
    const el = document.createElement("input");
    el.type = "number";
    for (const [k, val] of Object.entries(attrs)) el.setAttribute(k, val);
    el.value = raw !== undefined && raw !== "" ? raw : fallback === null || fallback === undefined ? "" : String(fallback);
    return el;
  }
  const nfIn = numberInput(v.nf, d.n_factors ?? 2, { min: "1", step: "1" });
  const lrIn = numberInput(v.lr, d.lr ?? 0.02, { min: "0", step: "any" });
  const regIn = numberInput(v.reg, d.reg ?? 0.02, { min: "0", step: "any" });
  const stdIn = numberInput(v.std, d.init_std ?? 0.1, { min: "0", step: "any" });
  const lamIn = numberInput(v.lam, d.lam ?? 1, { min: "0", step: "any" });
  const bsIn = numberInput(v.bs, d.batch_size ?? 16, { min: "1", step: "1" });
  const mrIn = numberInput(v.mr, d.min_raters ?? 1, { min: "1", step: "1" });
  const seedIn = numberInput(v.seed, d.seed ?? 0, { min: "0", step: "1" });
  const epIn = numberInput(v.ep, mfTrainer.max_epochs ?? 40, { min: "1", step: "1" });
  const patIn = numberInput(v.pat === "none" ? "" : v.pat, v.pat === "none" ? null : mfTrainer.patience ?? null, {
    min: "1",
    step: "1",
  });
  patIn.placeholder = "∞";
  const vfIn = numberInput(v.vf, mfTrainer.valid_frac ?? 0.1, { min: "0", max: "0.9", step: "0.05" });
  const biasIn = document.createElement("input");
  biasIn.type = "checkbox";
  const biasDefault = d.biases !== false;
  biasIn.checked = v.bias !== undefined ? v.bias === "1" || v.bias === "true" : biasDefault;
  const einSel = select(
    [
      ["binary", i18n.t("params.ease_binary")],
      ["ratings", i18n.t("params.ease_ratings")],
    ],
    v.ein || d.ease_input || "binary"
  );
  // WP-141: the two pages share their controls (nf, lr, std, bs, seed, ep, pat, vf are ONE element each): a field wraps its control, and an element has one parent, so the second
  // wrapper (the neural page's) took every shared control out of the first (the MF page's fields were left empty). Each page builds only its own fields.
  /** @type {Record<string, HTMLElement>} */
  const mfFields = !isMF ? {} : {
    nf: field("params.n_factors", nfIn),
    lr: field("params.lr", lrIn),
    reg: field("params.reg", regIn),
    bias: checkboxField("params.biases", biasIn),
    std: field("params.init_std", stdIn),
    lam: field("params.lam", lamIn),
    bs: field("params.batch_size", bsIn),
    ein: field("params.ease_input", einSel),
    mr: field("params.min_raters", mrIn),
    seed: field("params.seed", seedIn),
    ep: field("params.max_epochs", epIn),
    pat: field("params.patience", patIn),
    vf: field("params.valid_frac", vfIn),
  };
  const clipField = checkboxField("params.clip", clipIn, opts.engine === "dnn" ? "net_clip" : undefined); // WP-243: the neural pages' tip (the MF page's box has none)
  /** @type {Record<string, string[]>} */
  const MF_VISIBLE = {
    funk_svd: ["nf", "lr", "reg", "bias", "std", "seed", "ep", "pat", "vf", "clip"],
    als: ["nf", "lam", "std", "seed", "ep", "pat", "vf", "clip"],
    bpr: ["nf", "lr", "reg", "bias", "std", "bs", "seed", "ep", "pat", "vf"],
    ease: ["lam", "ein", "mr"],
  };
  function syncAlgorithm() {
    const show = new Set(MF_VISIBLE[algSel.value] || MF_VISIBLE.funk_svd);
    for (const [key, el] of Object.entries(mfFields)) el.hidden = !show.has(key);
    clipField.hidden = !show.has("clip");
  }
  if (isMF) {
    algSel.addEventListener("change", syncAlgorithm);
    syncAlgorithm();
  }

  // WP-47: DNN controls (architecture + the network recipe; shared numeric fields are reused)
  const isDNN = opts.engine === "dnn";
  const archSel = select(
    [
      ["mlp", i18n.t("params.arch_mlp")],
      ["gmf", i18n.t("params.arch_gmf")],
      ["neumf", i18n.t("params.arch_neumf")],
      ["hybrid", i18n.t("params.arch_hybrid")],
      ["features", i18n.t("params.arch_features")], // WP-223: the hybrid week's feature-combination network
    ],
    v.arch || d.architecture || "neumf"
  );
  const layersDefault = Array.isArray(d.mlp_layers) ? d.mlp_layers.join(",") : "32,16";
  const layersIn = document.createElement("input");
  layersIn.type = "text";
  layersIn.value = v.layers ? String(v.layers).replace(/-/g, ",") : layersDefault;
  layersIn.placeholder = layersDefault;
  const dropIn = numberInput(v.drop, d.dropout ?? 0, { min: "0", max: "0.9", step: "0.05" });
  const wdIn = numberInput(v.wd, d.weight_decay ?? 0, { min: "0", step: "any" });
  const optSel = select([["adam", "Adam"], ["sgd", "SGD"]], v.opt || d.optimizer || "adam");
  const devSel = select(
    [
      ["cpu", i18n.t("params.dev_cpu")],
      ["cuda", i18n.t("params.dev_cuda")],
      ["auto", i18n.t("params.dev_auto")],
    ],
    v.dev || d.device || "cpu"
  );
  // WP-223: the feature network's side inputs - the input groups (five boxes; a group that is off is absent from the network), the content fields, the vocabulary cap and the two
  // towers' widths (route `groups`, `if`, `imt`, `il`, `ul`; a default stays out of the URL). Drawn while the architecture is `features`.
  const GROUPS = ["ids", "item_content", "item_numeric", "user_profile", "user_stats"];
  const groupsDefault = Array.isArray(d.groups) && d.groups.length ? d.groups.map(String) : GROUPS;
  const groupsChosen = v.groups ? String(v.groups).split(",").filter((g) => GROUPS.includes(g)) : groupsDefault;
  const groupsRow = document.createElement("div");
  groupsRow.className = "param-groups";
  /** @type {Map<string, HTMLInputElement>} */
  const groupBoxes = new Map();
  /** @type {Record<string, string>} */
  const GROUP_TIPS = { ids: tipText("group_ids"), item_content: tipText("group_item_content"), item_numeric: tipText("group_item_numeric"), user_profile: tipText("group_user_profile"), user_stats: tipText("group_user_stats") };
  for (const g of GROUPS) {
    const box = document.createElement("input");
    box.type = "checkbox";
    box.checked = groupsChosen.includes(g);
    const wrap = document.createElement("label");
    wrap.className = "param-check param-group-box";
    wrap.title = GROUP_TIPS[g];
    const span = document.createElement("span");
    span.textContent = i18n.t(`params.group_${g}`);
    wrap.append(box, span);
    groupsRow.appendChild(wrap);
    groupBoxes.set(g, box);
  }
  /** @param {string} key @param {string} fallback @returns {string} a width list of the engine defaults as "32,16" */
  const widthsDefault = (key, fallback) => (Array.isArray(d[key]) && d[key].length ? d[key].join(",") : fallback);
  /** @param {string | undefined} raw @param {string} dflt @returns {HTMLInputElement} a comma-list box ("32-16" in the URL) */
  function listInput(raw, dflt) {
    const el = document.createElement("input");
    el.type = "text";
    el.value = raw ? String(raw).replace(/-/g, ",") : dflt;
    el.placeholder = dflt;
    return el;
  }
  const ilDefault = widthsDefault("item_layers", "32,16");
  const ulDefault = widthsDefault("user_layers", "32,16");
  const ifDefault = Array.isArray(d.item_fields) && d.item_fields.length ? d.item_fields.join(",") : "genres,keywords,themes";
  const ilIn = listInput(v.il, ilDefault);
  const ulIn = listInput(v.ul, ulDefault);
  const ifIn = listInput(v.if, ifDefault);
  const imtIn = numberInput(v.imt, d.item_max_terms ?? 2000, { min: "1", step: "1" });
  // WP-224: the early-stopping switch of the neural page - on (the usual practice): `pat` epochs of patience; off (the labelled foil): `pat=none`, the run goes to its epoch budget and the
  // last epoch predicts. The patience box follows the switch.
  const esDefaultOn = (mfTrainer.patience ?? null) !== null;
  const esIn = document.createElement("input");
  esIn.type = "checkbox";
  esIn.checked = v.pat === "none" ? false : v.pat !== undefined && v.pat !== "" ? true : esDefaultOn;
  const esField = checkboxField("params.early_stopping", esIn, "net_early_stopping"); // WP-243: the neural page's own tip (the validation share is each user's remaining ratings)
  const syncEs = () => {
    patIn.disabled = !esIn.checked;
    esField.classList.toggle("is-foil", !esIn.checked);
  };
  esIn.addEventListener("change", syncEs);
  /**
   * WP-223 / WP-224: a labelled block of fields (`<fieldset>`), drawn under the first row like the item-based page's filters
   * WP-243: with `glossary` it is one of the neural pages' three groups (Architecture, Side inputs, Training): one grid, so their columns line up, and an (i) in the legend whose bubble is the
   * group's glossary (`param_group_tip.<glossary>`: what a tower, an embedding, the join, the MLP, the validation share ... are, and what each does to the result)
   * @param {string} labelKey
   * @param {HTMLElement[]} fields
   * @param {string} [glossary]
   */
  function groupBlock(labelKey, fields, glossary) {
    const box = document.createElement("fieldset");
    box.className = glossary ? "param-group param-group-grid" : "param-group";
    const legend = document.createElement("legend");
    legend.textContent = i18n.t(labelKey);
    if (glossary) legend.append(" ", richInfoTip(i18n.t(`param_group_tip.${glossary}`), i18n.t(labelKey)));
    box.append(legend, ...fields);
    return box;
  }
  /** WP-243: a field that takes `n` columns of its group's grid (a select, a text list, a row of check boxes) @param {HTMLElement} el @param {number} n @returns {HTMLElement} */
  const span = (el, n) => {
    el.classList.add(`param-span-${n}`);
    return el;
  };
  /** @type {Record<string, HTMLElement>} */
  const dnnFields = !isDNN ? {} : {
    arch: span(field("params.architecture", archSel, "net_architecture"), 2),
    nf: field("params.embedding_size", nfIn, "net_embedding_size"),
    layers: field("params.mlp_layers", layersIn, "net_mlp_layers"),
    drop: field("params.dropout", dropIn, "net_dropout"),
    opt: field("params.optimizer", optSel, "net_optimizer"),
    lr: field("params.lr", lrIn, "net_lr"),
    wd: field("params.weight_decay", wdIn, "net_weight_decay"),
    bs: field("params.batch_size", bsIn, "net_batch_size"),
    std: field("params.init_std", stdIn, "net_init_std"),
    seed: field("params.seed", seedIn, "net_seed"),
    ep: field("params.max_epochs", epIn, "net_max_epochs"),
    pat: field("params.patience_es", patIn, "net_patience"),
    vf: field("params.valid_frac", vfIn, "net_valid_frac"),
    dev: field("params.device", devSel, "net_device"),
  };
  // WP-243: the two towers' widths are the network's shape, so they stand in the Architecture group (drawn while the architecture is `features`); the Side inputs group keeps WHICH inputs the
  // network reads: the five groups, the content fields and the vocabulary cap
  const towerFields = !isDNN ? [] : [field("params.item_layers", ilIn, "item_layers"), field("params.user_layers", ulIn, "user_layers")];
  const featureGroup = !isDNN
    ? null
    : groupBlock("params.features_group", [span(field("params.groups", groupsRow, "groups"), 4), span(field("params.item_fields", ifIn, "item_fields"), 2), field("params.item_max_terms", imtIn, "item_max_terms")], "side");
  // WP-243: the Architecture group: the network type, the embedding size, the two towers, the MLP after the join, the dropout (the form's top block used to hold some of these, some under Training)
  const archGroup = !isDNN ? null : groupBlock("params.arch_group", [dnnFields.arch, dnnFields.nf, ...towerFields, dnnFields.layers, dnnFields.drop], "architecture");
  const dnnTraining = !isDNN
    ? null
    : groupBlock("params.training_group", [dnnFields.ep, span(esField, 2), dnnFields.pat, dnnFields.vf, dnnFields.opt, dnnFields.lr, dnnFields.wd, dnnFields.bs, dnnFields.std, dnnFields.seed, dnnFields.dev, span(clipField, 2)], "training");
  function syncArchitecture() {
    const pureGmf = archSel.value === "gmf";
    dnnFields.layers.hidden = pureGmf;
    dnnFields.drop.hidden = pureGmf;
    for (const tower of towerFields) tower.hidden = archSel.value !== "features"; // WP-243
    if (featureGroup) featureGroup.hidden = archSel.value !== "features"; // WP-223
  }
  if (isDNN) {
    archSel.addEventListener("change", syncArchitecture);
    syncArchitecture();
    syncEs();
  }
  // WP-224: the per-user network's training controls (the content page, method model, kind mlp): hidden units, the epoch budget, early stopping and its patience, the learning rate, the
  // validation share and the seed (route `hid`, `ep`, `es`, `pat`, `lr`, `vf`, `seed` -> `cb.model.mlp.*`); the engine's defaults come from the config response, a default stays out of the URL
  const mlpD = (d.model && d.model.mlp) || {};
  const mlpEsDefaultOn = !(mlpD.early_stopping && mlpD.early_stopping.enabled === false);
  const mlpPatDefault = (mlpD.early_stopping && mlpD.early_stopping.patience) ?? 5;
  const mlpHidIn = numberInput(v.hid, mlpD.hidden ?? 16, { min: "1", step: "1" });
  const mlpEpIn = numberInput(v.ep, mlpD.epochs ?? 30, { min: "1", step: "1" });
  const mlpLrIn = numberInput(v.lr, mlpD.lr ?? 0.01, { min: "0", step: "any" });
  const mlpVfIn = numberInput(v.vf, mlpD.val_fraction ?? 0.2, { min: "0", max: "0.9", step: "0.05" });
  const mlpSeedIn = numberInput(v.seed, mlpD.seed ?? 0, { min: "0", step: "1" });
  const mlpPatIn = numberInput(v.pat, mlpPatDefault, { min: "1", step: "1" });
  const mlpEsIn = document.createElement("input");
  mlpEsIn.type = "checkbox";
  mlpEsIn.checked = v.es === "0" ? false : v.es === "1" ? true : mlpEsDefaultOn;
  const mlpEsField = checkboxField("params.early_stopping", mlpEsIn, "early_stopping");
  const syncMlpEs = () => {
    mlpPatIn.disabled = !mlpEsIn.checked;
    mlpEsField.classList.toggle("is-foil", !mlpEsIn.checked);
  };
  mlpEsIn.addEventListener("change", syncMlpEs);
  const mlpTraining = !(isContent && isModel)
    ? null
    : groupBlock("params.training_group", [
        field("params.hidden_units", mlpHidIn, "hidden_units"),
        field("params.max_epochs", mlpEpIn),
        mlpEsField,
        field("params.patience_es", mlpPatIn, "patience_es"),
        field("params.lr", mlpLrIn),
        field("params.valid_frac", mlpVfIn),
        field("params.seed", mlpSeedIn),
      ]);
  if (mlpTraining) syncMlpEs();
  const noKnn = isContent || isMF || isDNN;

  // WP-141: the top-K task's controls (the model pages only, while the task is top-K): the list length and the candidate set
  // WP-176 (stage 4): the content page too - its list length and the MMR lambda (`lam`: a request parameter, 0 to 1; the engine's default is `cb.mmr.lambda`). The candidate set is not
  // offered there (the content page lists the films the user has not rated), and the neighbour count `k` goes while the task is top-K: the route's `k` is the list length then
  const isTopk = (isMF || isDNN || isContent) && opts.task === "topk";
  const topkK = kFor(v.k);
  const kSeg = miniseg(
    kOptions(topkK).map((n) => [String(n), String(n)]),
    String(topkK)
  );
  const candSeg = miniseg(
    [
      ["unseen", i18n.t("params.candidates_unseen"), tipText("candidates_unseen")],
      ["all", i18n.t("params.candidates_all"), tipText("candidates_all")],
    ],
    candidatesFor(v.cand)
  );
  const lamDefault = d.mmr && typeof d.mmr.lambda === "number" ? d.mmr.lambda : 0.7;
  const mmrIn = numberInput(v.lam, lamDefault, { min: "0", max: "1", step: "0.05" });
  const topkFields = isTopk
    ? isContent
      ? [field("params.k_top", kSeg, "k_top"), field("params.mmr_lambda", mmrIn, "mmr_lambda", true)]
      : [field("params.k_top", kSeg, "k_top"), field("params.candidates", candSeg, "candidates")]
    : [];
  /** `k` and `cand` travel only in the top-K task, and a default stays out of the URL (the content page: `k` and `lam`) */
  const topkParams = () =>
    !isTopk
      ? {}
      : isContent
        ? { k: kParam(Number(kSeg.dataset.value)), lam: mmrIn.value === "" || Number(mmrIn.value) === lamDefault ? undefined : String(Number(mmrIn.value)) }
        : { k: kParam(Number(kSeg.dataset.value)), cand: candidatesParam(/** @type {"unseen" | "all"} */ (candSeg.dataset.value)) };

  // WP-146: the "Model" row. `modelChoice` is what the person has pressed (null: automatic); it travels as the route's `model` when Apply is pressed. The row shows the APPLIED
  // settings' stored model and the trace on screen's source (`setModelState`), not an unapplied edit of the fields beside it.
  const modelOffered = (isMF || isDNN) && Boolean(opts.modelSource);
  /** @type {import("../util/model-source.js").Source | null} */
  let modelChoice = sourceFor(v.model);
  /** @type {{match: import("../util/model-source.js").ModelInfo | null, listKnown: boolean, last: import("../util/model-source.js").ModelMeta | null}} */
  let modelState = { match: null, listKnown: false, last: null };
  const modelRow = modelOffered
    ? createModelSource({
        i18n,
        onPick: (choice) => {
          modelChoice = choice;
          syncModelRow();
        },
      })
    : null;
  function syncModelRow() {
    if (!modelRow) return;
    const view = rowView({
      choice: modelChoice,
      ...modelState,
      task: isTopk ? "topk" : "predict",
      rated: targetRated,
      algorithm: isMF ? v.alg || d.algorithm || "funk_svd" : undefined,
      lang: i18n.lang(),
    });
    modelRow.sync(view, modelChoice);
  }
  /** `model` travels only when a choice is pressed; EASE is never stored, so a pretrained choice does not go with it */
  const modelParam = () => (modelOffered ? sourceParam(isMF && algSel.value === "ease" && modelChoice === "pretrained" ? null : modelChoice) : undefined);

  // WP-110 (c): the (i) beside the measure selector says what the selected measure is (`measure_info.<key>`); the slot keeps its place when
  // a measure has no text; the item-based page adds one sentence (the measure then compares two items, not two users)
  const simInfo = document.createElement("span");
  simInfo.className = "param-info-slot";
  function renderMeasureInfo() {
    const name = simSel.value;
    const text = i18n.t(`measure_info.${name}`);
    if (text === `measure_info.${name}`) {
      simInfo.replaceChildren();
      return;
    }
    const labelKey = similarities.find((s) => s.name === name)?.label_key;
    const full = isItem && name !== "adjusted_cosine" ? `${text} ${i18n.t("params.measure_icf_note")}` : text;
    const info = infoTip(full, i18n.t("params.measure_info"), labelKey ? i18n.t(labelKey) : name);
    info.title = ""; // the caption's own tooltip must not open next to the bubble
    simInfo.replaceChildren(info);
  }
  simSel.addEventListener("change", renderMeasureInfo);
  renderMeasureInfo();
  const simRow = document.createElement("span");
  simRow.className = "param-row";
  simRow.append(simSel, simInfo);

  /**
   * WP-110 (b''): an (i) at the end of the row opens to the LEFT, on hover too. `infoTip`'s own `place()` picks the right side wherever the viewport has
   * room, and from a button this far right the bubble then reaches past the panel: the page scrolled sideways by 24 px while it was shown (measured with
   * the centre field at 1536 px). The listener is added after `infoTip`'s, so it runs after `place()`.
   * @param {Element} info
   */
  function opensLeft(info) {
    info.classList.remove("tip-right");
    for (const type of ["mouseenter", "focus"]) info.addEventListener(type, () => info.classList.remove("tip-right"));
  }

  // WP-110 (b): the cosine's norms - over the full vectors (the classic definition, a missing rating = 0) or over the co-rated items only; route
  // `cs`. Shown only while the cosine is chosen. It is the LAST field of the row, so on a wide row nothing before it moves when it appears; on a
  // narrow one it may wrap to a second line (measured: not at 1536 px with the sidebar folded, EN and TR)
  const csDefault = d.cosine_support || "full";
  const csSeg = miniseg(
    [
      ["full", i18n.t("params.cs_full")],
      ["corated", i18n.t("params.cs_corated")],
    ],
    v.cs === "corated" || v.cs === "full" ? v.cs : csDefault
  );
  const csInfo = infoTip(tipText("cosine_support"), i18n.t("params.cosine_support"), i18n.t("params.cosine_support"));
  csInfo.title = "";
  opensLeft(csInfo); // it is the last field of the row: a hidden bubble to its right would widen the page (a narrow Turkish row measured 24 px)
  const csRow = document.createElement("span");
  csRow.className = "param-row";
  csRow.append(csSeg, csInfo);
  const csField = field("params.cosine_support", csRow, "cosine_support");
  function syncCosine() {
    csField.hidden = simSel.value !== "cosine"; // `.param-field[hidden]` is display: none (mf.css): no gap of its own, the row packs without it
  }
  simSel.addEventListener("change", syncCosine);
  syncCosine();
  /** `cs` travels only while the cosine is chosen and the choice is not the default */
  const csParam = () => (simSel.value === "cosine" && csSeg.dataset.value !== csDefault ? csSeg.dataset.value : undefined);

  // WP-110 (b''): the constrained Pearson's fixed centre z (route `cz`), a small number box + an (i) (`param_tip.centre`, the reading of the formula: above z
  // positive, below z negative). Same place as the cosine's norms - the last field of the row, shown only while its measure is chosen - so nothing
  // before it moves when it appears; the cosine's field and this one are never visible together. The default and the bounds are served, else the
  // scale's midpoint; no usable source = no field (the engine then uses the midpoint itself).
  const CENTRE_MEASURE = "constrained_pearson";
  const czSpec = noKnn ? null : centreSpec(d.constrained_centre, opts.scale);
  /** @type {HTMLInputElement | null} */
  let czIn = null;
  /** @type {HTMLElement | null} */
  let czField = null;
  if (czSpec) {
    czIn = numberInput(String(centreValue(v.cz, czSpec)), null, { min: String(czSpec.min), max: String(czSpec.max), step: String(czSpec.step) });
    czField = field("params.centre", czIn, "centre", true);
    const czInfo = czField.querySelector(".help-tip");
    if (czInfo) opensLeft(czInfo); // the last field of the row, like the cosine's
  }
  function syncCentre() {
    if (czField) czField.hidden = simSel.value !== CENTRE_MEASURE;
  }
  simSel.addEventListener("change", syncCentre);
  syncCentre();
  /** `cz` travels only while the constrained Pearson is chosen and the centre is not the default */
  const czParam = () => (czIn && czSpec ? centreParam(simSel.value === CENTRE_MEASURE, czIn.value, czSpec) : undefined);

  // WP-109 (9): the user- / item-based pages (`knn`) lay their controls out as one wrapping row of natural-width fields - a number box is as
  // wide as its number - with the two check boxes stacked right after the denominator (WP-109 10: not at the far right end, where they stood
  // 305 px from it at 1536 px); the item-based and filter fields form a second block
  const knn = !noKnn;
  const clipBox = isMF || isDNN || !cbShows("clip") ? null : checkboxField("params.clip", clipIn, "clip"); // WP-208: the content page offers it where it can move a number (the per-user model)
  // WP-109 (7): + the (i) bubble; sources: docs/significance-weighting-literature.md (verified 2026-10-05)
  const negBox = noKnn ? null : checkboxField("params.keep_negative", negIn, isItem ? "keep_negative_icf" : "keep_negative", true);
  const boxes = /** @type {HTMLElement[]} */ ([clipBox, negBox].filter((box) => box !== null));
  const stack = document.createElement("div");
  stack.className = "param-stack";
  stack.append(...boxes);

  const grid = document.createElement("div");
  grid.className = knn ? "param-grid param-grid-knn" : "param-grid";
  grid.append(
    ...(modelRow ? [modelRow.el] : []), // WP-146: where the model comes from, first: it decides how long the next trace takes
    ...topkFields, // WP-141
    ...(noKnn
      ? []
      : [
          field("params.similarity", simRow, "similarity"),
          field("params.mean_convention", mcSeg, isItem ? "mean_convention_icf" : "mean_convention", true), // WP-110 (a'): an (i) bubble
        ]),
    ...(isMF
      ? [field("params.algorithm", algSel)]
      : isDNN
        ? [] // WP-243: the network type is the first field of the Architecture group below
        : [...(cbShows("k") ? [field("params.k", kIn, "k")] : []), ...(cbShows("sw") ? [field("params.sig_mode", sigModeSel, "sig_mode"), field("params.sig_n", sigNIn, "sig_n")] : [])]), // WP-208: on the content page by method (in top-K `k` is the list length: not drawn here)
    ...(noKnn ? [] : [field("params.denominator", denSeg, "denominator")]),
    ...(knn ? [stack] : boxes),
    ...(noKnn ? [] : [csField, ...(czField ? [czField] : [])]) // WP-109 (10): opens to the right of the check boxes; the free space of the row stays at its end
  );
  // the item-based controls and the attribute filters: a second block under the first row
  const extra = document.createElement("div");
  extra.className = "param-grid param-grid-knn param-extra";
  if (isMF) grid.append(...Object.values(mfFields), clipField);
  if (isDNN) {
    // WP-223 / WP-224: the side-input group (features only) and the training group as labelled blocks; WP-243: the first row holds only the Model row and the top-K choices, and the three groups
    // follow in the order of the story - the network's shape (Architecture), what it reads (Side inputs), how it learns (Training) - one grid style, so their columns line up
    if (archGroup) extra.appendChild(archGroup);
    if (featureGroup) extra.appendChild(featureGroup);
    if (dnnTraining) extra.appendChild(dnnTraining);
  }
  if (isItem) {
    extra.append(
      field("params.centering", ctrSeg, "centering"),
      field("params.prediction", predSeg, "prediction"),
      field("params.degree", degModeSel, "degree"),
      field("params.deg_value", degValueIn, "deg_value")
    );
  }
  if (filterOn && isUser) {
    // WP-84 (D7): the item scope of the user-user similarity
    extra.append(
      field("params.filter_genres", fgSel, "filter_genres"),
      field("params.filter_year_min", fyMinIn, "filter_year_min"),
      field("params.filter_year_max", fyMaxIn, "filter_year_max"),
      field("params.mean_scope", msSeg, "mean_scope")
    );
  }
  if (filterOn && isItem) {
    // WP-84 (D7): the user scope of the item-item similarity + the candidate cut
    extra.append(
      field("params.user_filter", ufcSel, "user_filter"),
      field("params.uf_min_ratings", ufnIn, "uf_min_ratings"),
      field("params.cand_genres", cfgSel, "cand_genres"),
      field("params.cand_year_window", cfyIn, "cand_year_window"),
      field("params.mean_scope", msSeg, "mean_scope")
    );
  }
  if (isContent) {
    // WP-176 (user decision, 2026-10-16): the content-based week does not push the reader toward hybrid mechanics - the strategy, the blend weight and the CF threshold
    // are NOT drawn (hybrid has its own section two lectures later). Their controls still exist (detached) and hold the route's `hyb` / `alpha` / `mcfn`, so Apply and a
    // deep link that names them keep working; the API and the engine are untouched.
    if (isModel) {
      // WP-195c: first, as the one control only the per-user model has in the grid: the penalty. Stage 2: the model's KIND (the regression | the small network) is not a grid cell - a ninth cell
      // made the form a row taller at 1100 px (+51 px for every panel below, on the regression page too) - it is a setting of the panel's head, like the held-out setting (`.param-kind`, built
      // below with the head's other items); choosing the network takes the penalty's field away at once (a network has no penalty)
      const penaltyField = field("params.cb_alpha", maIn, "cb_alpha");
      grid.append(penaltyField);
      if (mlpTraining) extra.appendChild(mlpTraining); // WP-224: the network's training group, under the first row (hidden while the regression is chosen)
      const syncKind = () => {
        penaltyField.hidden = kindSeg.dataset.value === "mlp";
        if (mlpTraining) mlpTraining.hidden = kindSeg.dataset.value !== "mlp"; // WP-224
      };
      kindSeg.addEventListener("change", syncKind); kindSeg.addEventListener("change", () => opts.onKindChange?.(kindSeg.dataset.value === "mlp" ? "mlp" : "ridge")); // WP-216: the page's tab strip follows the choice at once, before Apply
      syncKind();
    }
    grid.append(...(cbShows("mst") ? [field("params.min_shared_terms", mstIn)] : []), field("params.tf", tfSeg, "tf"), checkboxField("params.feature_weighting", gwIn, "feature_weighting", true)); // WP-176a (a); WP-208: "min shared tags" is the item method's alone
    extra.append(fieldsRow); // WP-176: the fields stand in the block under the first row, as the item-based page's filters do
  }
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
  // WP-176c: the master box and Apply follow the chips. Apply waits while no field is ticked: the engine builds the profiles from at least one field (an empty list is a 422), and the route
  // cannot carry an empty choice - `f` absent means the default - so Apply used to put `genres` back without a word. The button keeps its box and its focus (WP-110's `aria-disabled`: a
  // click does nothing, the tip says what is missing); Defaults is never blocked.
  // WP-176d: a second reason - every TICKED field has a weight of 0 (the engine answers 422 `cb_weights_invalid`: at least one ticked field above 0) - and a visible line: the same sentence as
  // the tip, in the panel head beside Apply / Defaults (`.param-hint`, it takes the head's free room, so it moves nothing and the head's height does not change; empty while Apply is free).
  const fieldsTicked = () => fieldOrder.filter((name) => fieldInputs.get(name)?.box.checked).length;
  const tickedWeights = () => fieldOrder.filter((name) => fieldInputs.get(name)?.box.checked).map((name) => Number(fieldInputs.get(name)?.weight.value));
  const applyWait = () => (isContent ? fieldsApplyWait(fieldsTicked(), fieldOrder.length, tickedWeights()) : null);
  const applyBlocked = () => applyWait() !== null;
  const hint = document.createElement("span");
  hint.className = "param-hint";
  hint.setAttribute("role", "status"); // read out when it appears; nothing is announced while it is empty
  /** WP-203: the page's note in the hint's place while Apply is free (a chip: "form loaded from saved walk"); a reason why Apply waits is the more urgent word and takes the place first @type {{text: string, title: string} | null} */
  let note = null;
  const syncFieldsState = () => {
    const ticked = fieldsTicked();
    const state = fieldsMasterState(ticked, fieldOrder.length);
    fieldsAllBox.checked = state === "all";
    fieldsAllBox.indeterminate = state === "some";
    const wait = applyWait();
    const text = wait === "no_field" ? i18n.t("params.fields_none") : wait === "zero_weights" ? i18n.t("params.weights_zero") : "";
    apply.setAttribute("aria-disabled", String(wait !== null));
    apply.title = text; // an empty title is no tip: the button says what is missing only while something is
    hint.replaceChildren();
    if (text || !note) {
      hint.textContent = text;
      hint.title = text; // a long sentence in a narrow head ends in an ellipsis: the whole of it on hover
    } else {
      const chip = document.createElement("span");
      chip.className = "param-note-chip";
      chip.textContent = note.text;
      hint.append(chip);
      hint.title = note.title;
    }
  };
  if (isContent) {
    opts.actionsHost?.after(hint); // a direct child of the panel head: it takes the free room between Apply / Defaults and the held-out setting
    if (isModel && opts.actionsHost) {
      // WP-195c stage 2: the model's kind, in the head after the hint (before the held-out setting): the label and the app's segmented control at the height of a small button, like `.param-reveal`
      const kindHead = document.createElement("span");
      kindHead.className = "param-kind";
      kindHead.title = tipText("cb_kind");
      const kindLabel = document.createElement("span");
      kindLabel.textContent = i18n.t("params.cb_kind");
      kindSeg.setAttribute("role", "group");
      kindSeg.setAttribute("aria-label", i18n.t("params.cb_kind"));
      kindHead.append(kindLabel, kindSeg);
      kindHead.addEventListener("click", (e) => e.stopPropagation()); // in the panel head: a click is not a click on the head (it folds the panel)
      hint.after(kindHead);
    }
    for (const { box, weight } of fieldInputs.values()) {
      box.addEventListener("change", syncFieldsState);
      weight.addEventListener("input", syncFieldsState); // typing a weight, or the spinner's arrows
      weight.addEventListener("change", syncFieldsState);
    }
    fieldsAllBox.addEventListener("change", () => {
      const target = fieldsMasterTarget(fieldsTicked(), fieldOrder.length); // read from the chips, not from the box the browser has just flipped
      for (const { box } of fieldInputs.values()) {
        if (box.checked === target) continue;
        box.checked = target;
        box.dispatchEvent(new Event("change")); // the chip's own look and its weight box follow (syncChip), then the master
      }
      syncFieldsState();
    });
    syncFieldsState();
  }
  actions.addEventListener("click", (e) => e.stopPropagation()); // in the panel head: a click is not a click on the head (it folds the panel)
  if (grid.children.length || !isDNN) root.append(grid); // WP-243: an empty first row of the neural pages (no Model row, predict task) would only add a gap
  if (extra.children.length) root.append(extra);
  if (isItem) {
    const note = document.createElement("p");
    note.className = "sub param-note";
    note.textContent = i18n.t("params.icf_mc_note");
    root.appendChild(note);
  }
  if (filterOn && (isUser || isItem)) {
    const note = document.createElement("p");
    note.className = "sub param-note";
    note.textContent = i18n.t("params.filter_note"); // WP-84
    root.appendChild(note);
  }
  if (isContent) {
    const note = document.createElement("p");
    note.className = "sub param-note";
    note.textContent = i18n.t("params.cb_note");
    root.appendChild(note);
  }
  if (isMF) {
    const note = document.createElement("p");
    note.className = "sub param-note";
    note.textContent = i18n.t("params.mf_note");
    root.appendChild(note);
  }
  if (isDNN) {
    const note = document.createElement("p");
    note.className = "sub param-note";
    note.textContent = i18n.t("params.dnn_note");
    root.appendChild(note);
  }
  (opts.actionsHost || root).appendChild(actions);

  /**
   * @param {string} labelKey
   * @param {HTMLInputElement} box
   * @param {string} [tipKey] WP-109: `param_tip.<tipKey>`, the hover tip of the box and its caption
   * @param {boolean} [withInfo] WP-109 (7): the same text behind an (i) bubble headed by the caption (a long text with citations)
   */
  function checkboxField(labelKey, box, tipKey, withInfo = false) {
    const wrap = document.createElement("label");
    wrap.className = "param-field param-check";
    const span = document.createElement("span");
    span.textContent = i18n.t(labelKey);
    wrap.append(box, span);
    if (tipKey) {
      const text = tipText(tipKey);
      wrap.title = text;
      if (withInfo) {
        const info = infoTip(text, i18n.t(labelKey), i18n.t(labelKey));
        info.title = ""; // an empty title keeps the label's own tooltip from opening next to the bubble
        info.classList.remove("tip-right"); // the bubble opens to the left by default (a hidden one to the right could widen the page); a hover re-places it where it fits
        wrap.append(info);
      }
    }
    return wrap;
  }

  function collect() {
    if (isDNN) {
      // WP-47: defaults stay out of the URL; layer widths travel as "32-16"
      /**
       * @param {HTMLInputElement} el
       * @param {unknown} dflt
       */
      const num = (el, dflt) => (el.value !== "" && Number(el.value) !== Number(dflt) ? String(Number(el.value)) : undefined);
      const widths = layersIn.value.split(/[,\s-]+/).map((w) => Number(w)).filter((w) => Number.isFinite(w) && w > 0);
      const layers = widths.length && widths.join(",") !== layersDefault ? widths.join("-") : undefined;
      const patDefault = mfTrainer.patience ?? null;
      /** @type {string | undefined} */
      let pat;
      if (patIn.value === "") pat = patDefault === null ? undefined : "none";
      else pat = Number(patIn.value) === Number(patDefault) ? undefined : String(Math.max(1, Math.round(Number(patIn.value))));
      if (!esIn.checked) pat = patDefault === null ? undefined : "none"; // WP-224: the switch off = no patience (the foil)
      // WP-223: the feature network's side inputs travel only with that architecture, and only when they differ from the engine defaults
      const features = archSel.value === "features";
      const groups = GROUPS.filter((g) => groupBoxes.get(g)?.checked);
      /** @param {HTMLInputElement} el @param {string} dflt */
      const list = (el, dflt) => {
        const parts = el.value.split(/[,\s-]+/).map((s) => s.trim()).filter(Boolean);
        return parts.length && parts.join(",") !== dflt ? parts.join("-") : undefined;
      };
      return {
        arch: archSel.value === (d.architecture || "neumf") ? undefined : archSel.value,
        groups: features && groups.join(",") !== groupsDefault.join(",") ? groups.join(",") : undefined,
        if: features ? list(ifIn, ifDefault) : undefined,
        imt: features ? num(imtIn, d.item_max_terms ?? 2000) : undefined,
        il: features ? list(ilIn, ilDefault) : undefined,
        ul: features ? list(ulIn, ulDefault) : undefined,
        nf: num(nfIn, d.n_factors ?? 8),
        layers: archSel.value === "gmf" ? undefined : layers,
        drop: archSel.value === "gmf" ? undefined : num(dropIn, d.dropout ?? 0),
        opt: optSel.value === (d.optimizer || "adam") ? undefined : optSel.value,
        lr: num(lrIn, d.lr ?? 0.01),
        wd: num(wdIn, d.weight_decay ?? 0),
        bs: num(bsIn, d.batch_size ?? 16),
        std: num(stdIn, d.init_std ?? 0.1),
        seed: num(seedIn, d.seed ?? 0),
        ep: num(epIn, mfTrainer.max_epochs ?? 40),
        pat,
        vf: num(vfIn, mfTrainer.valid_frac ?? 0.1),
        dev: devSel.value === (d.device || "cpu") ? undefined : devSel.value,
        clip: clipIn.checked ? "1" : undefined,
        ...topkParams(), // WP-141
        model: modelParam(), // WP-146
      };
    }
    if (isMF) {
      // WP-46: only the chosen algorithm's fields travel, and defaults stay out of the URL
      const alg = algSel.value;
      const show = new Set(MF_VISIBLE[alg] || []);
      /**
       * @param {HTMLInputElement} el
       * @param {string} key
       * @param {unknown} dflt
       */
      const num = (el, key, dflt) =>
        show.has(key) && el.value !== "" && Number(el.value) !== Number(dflt) ? String(Number(el.value)) : undefined;
      const patDefault = mfTrainer.patience ?? null;
      /** @type {string | undefined} */
      let pat;
      if (!show.has("pat")) pat = undefined;
      else if (patIn.value === "") pat = patDefault === null ? undefined : "none";
      else pat = Number(patIn.value) === Number(patDefault) ? undefined : String(Math.max(1, Math.round(Number(patIn.value))));
      return {
        alg: alg === (d.algorithm || "funk_svd") ? undefined : alg,
        nf: num(nfIn, "nf", d.n_factors ?? 2),
        lr: num(lrIn, "lr", d.lr ?? 0.02),
        reg: num(regIn, "reg", d.reg ?? 0.02),
        bias: show.has("bias") && biasIn.checked !== biasDefault ? (biasIn.checked ? "1" : "0") : undefined,
        std: num(stdIn, "std", d.init_std ?? 0.1),
        lam: num(lamIn, "lam", d.lam ?? 1),
        bs: num(bsIn, "bs", d.batch_size ?? 16),
        ein: show.has("ein") && einSel.value !== (d.ease_input || "binary") ? einSel.value : undefined,
        mr: num(mrIn, "mr", d.min_raters ?? 1),
        seed: num(seedIn, "seed", d.seed ?? 0),
        ep: num(epIn, "ep", mfTrainer.max_epochs ?? 40),
        pat,
        vf: num(vfIn, "vf", mfTrainer.valid_frac ?? 0.1),
        clip: show.has("clip") && clipIn.checked ? "1" : undefined,
        ...topkParams(), // WP-141
        model: modelParam(), // WP-146
      };
    }
    const mode = sigModeSel.value;
    /** @type {Record<string, string | undefined>} */
    const params = {
      ...(isContent ? {} : { sim: simSel.value, mc: mcSeg.dataset.value }),
      k: kIn.value && cbShows("k") ? String(Number(kIn.value)) : undefined, // WP-208: a control that is not drawn is not written
      sw: !cbShows("sw") ? undefined : mode === "none" ? "none" : mode === "raw_count" ? "raw" : String(Number(sigNIn.value) || sigDefault.n || 50),
      ...(isContent ? {} : { den: denSeg.dataset.value, cs: csParam(), cz: czParam() }),
      clip: clipIn.checked && cbShows("clip") ? "1" : undefined,
      // WP-115 (10): sent in BOTH directions, whenever the box differs from the page's default (it used to send `0` only: on the item-based page, whose default is
      // false, ticking the box sent nothing and the engine used its default - the box did nothing)
      ...(isContent ? {} : { keepneg: keepNegativeParam(negIn.checked, d.keep_negative) }),
    };
    if (isItem) {
      // WP-42: defaults are left out of the URL so a plain deep link stays short
      params.ctr = simSel.value === "adjusted_cosine" && ctrSeg.dataset.value === "item" ? "item" : undefined;
      params.pred = predSeg.dataset.value === "baseline" ? "baseline" : undefined;
      const degMode = degModeSel.value;
      let raw = Number(degValueIn.value);
      if (degMode === "fraction" && raw >= 1) raw /= 100; // "50" typed as a percentage
      params.deg =
        degMode === "none" || !Number.isFinite(raw) || raw <= 0 || (degMode === "fraction" && raw >= 1)
          ? undefined
          : degMode === "fraction"
            ? String(raw)
            : String(Math.max(1, Math.round(raw)));
    }
    if (filterOn) {
      // WP-84: defaults stay out of the URL; the segment mean only with a matrix-restricting filter
      if (isUser) {
        const chosen = [...fgSel.selectedOptions].map((o) => o.value);
        params.fg = chosen.length ? chosen.join(",") : undefined;
        const lo = fyMinIn.value.trim();
        const hi = fyMaxIn.value.trim();
        params.fy = lo || hi ? `${lo}-${hi}` : undefined;
      }
      if (isItem) {
        params.ufc = ufcSel.value === "class" ? "class" : undefined;
        const n = Math.round(Number(ufnIn.value));
        params.ufn = Number.isFinite(n) && n > 0 ? String(n) : undefined;
        params.cfg = cfgSel.value === "none" ? undefined : cfgSel.value;
        const w = cfyIn.value.trim() === "" ? NaN : Math.round(Number(cfyIn.value));
        params.cfy = Number.isFinite(w) && w >= 0 ? String(w) : undefined;
      }
      params.ms = msSeg.dataset.value === "segment" && filterChosen() ? "segment" : undefined;
    }
    if (isContent) {
      // WP-45: defaults are left out of the URL so a plain deep link stays short
      const mst = Number(mstIn.value);
      params.mst = cbShows("mst") && Number.isFinite(mst) && mst !== 1 ? String(Math.max(0, Math.round(mst))) : undefined;
      const hybMode = hybSel.value;
      params.hyb = hybMode === "none" ? undefined : hybMode;
      params.alpha = hybMode === "weighted" ? String(Number(alphaIn.value)) : undefined;
      params.mcfn =
        hybMode === "switching" ? String(Math.max(1, Math.round(Number(mcfnIn.value)))) : undefined;
      // WP-176: the fields in registry order; the default selection, the default weights and `raw` stay out of the URL
      const selected = fieldOrder.filter((name) => fieldInputs.get(name)?.box.checked);
      /** @type {Record<string, number>} */
      const weights = {};
      for (const name of fieldOrder) weights[name] = Number(fieldInputs.get(name)?.weight.value);
      params.f = formatFieldList(selected, fieldDefaults, fieldOrder);
      params.fw = formatFieldWeights(weights, selected, fieldOrder);
      params.tf = tfSeg.dataset.value === "raw" ? undefined : tfSeg.dataset.value;
      params.gw = gwIn.checked === gwDefault ? undefined : gwIn.checked ? "gini" : "none"; // WP-176a (a)
      // WP-195c: the penalty - only the per-user model has one; the default (and anything that is no positive number: the engine wants alpha > 0) stays out of the URL
      const penalty = Number(maIn.value);
      const network = isModel && kindSeg.dataset.value === "mlp"; // WP-195c stage 2: the regression is the default (`mk` stays out of the URL); a network has no penalty
      params.mk = network ? "mlp" : undefined;
      params.ma = isModel && !network && Number.isFinite(penalty) && penalty > 0 && penalty !== modelAlphaDefault ? String(penalty) : undefined;
      // WP-224: the network's training controls travel only with the network; a default stays out of the URL; `es` only when the switch differs from the engine's default
      /** @param {HTMLInputElement} el @param {unknown} dflt */
      const mlpNum = (el, dflt) => (network && el.value !== "" && Number(el.value) !== Number(dflt) ? String(Number(el.value)) : undefined);
      params.hid = mlpNum(mlpHidIn, mlpD.hidden ?? 16);
      params.ep = mlpNum(mlpEpIn, mlpD.epochs ?? 30);
      params.lr = mlpNum(mlpLrIn, mlpD.lr ?? 0.01);
      params.vf = mlpNum(mlpVfIn, mlpD.val_fraction ?? 0.2);
      params.seed = mlpNum(mlpSeedIn, mlpD.seed ?? 0);
      params.pat = mlpEsIn.checked ? mlpNum(mlpPatIn, mlpPatDefault) : undefined;
      params.es = network && mlpEsIn.checked !== mlpEsDefaultOn ? (mlpEsIn.checked ? "1" : "0") : undefined;
      Object.assign(params, topkParams()); // WP-176 (stage 4): in the top-K task `k` is the list length (it replaces the neighbour count above) and `lam` the MMR lambda
    }
    return params;
  }

  apply.addEventListener("click", () => {
    if (applyBlocked()) return; // WP-176c: no field ticked - nothing to apply (the tip on the button says so)
    opts.onApply(collect());
  });
  reset.addEventListener("click", () =>
    opts.onApply({
      sim: undefined,
      mc: undefined,
      k: undefined,
      cand: undefined, // WP-141
      model: undefined, // WP-146: back to automatic
      sw: undefined,
      den: undefined,
      cs: undefined, // WP-110
      cz: undefined, // WP-110 (b'')
      clip: undefined,
      keepneg: undefined,
      ctr: undefined,
      pred: undefined,
      deg: undefined,
      // WP-84
      fg: undefined,
      fy: undefined,
      ms: undefined,
      ufc: undefined,
      ufn: undefined,
      cfg: undefined,
      cfy: undefined,
      mst: undefined,
      hyb: undefined,
      alpha: undefined,
      mcfn: undefined,
      f: undefined, // WP-176
      fw: undefined,
      tf: undefined,
      gw: undefined, // WP-176a (a)
      ma: undefined, // WP-195c
      mk: undefined, // WP-195c stage 2
      hid: undefined, // WP-224: the per-user network's training controls (ep, pat, lr, vf, seed are cleared below with the model pages')
      es: undefined,
      // WP-223: the feature network's side inputs
      groups: undefined,
      if: undefined,
      imt: undefined,
      il: undefined,
      ul: undefined,
      // WP-46
      alg: undefined,
      nf: undefined,
      lr: undefined,
      reg: undefined,
      bias: undefined,
      std: undefined,
      lam: undefined,
      bs: undefined,
      ein: undefined,
      mr: undefined,
      seed: undefined,
      ep: undefined,
      pat: undefined,
      vf: undefined,
      // WP-47
      arch: v.arch === "features" ? "features" : undefined, // WP-246: Defaults are THIS page's defaults - on the Hybrid DNN page the network stays the feature network (the route's `arch` is what makes it that page), with the recipe of that architecture
      groups: undefined, // WP-246: the feature network's side inputs back to all on, the widths and the term cap to the engine's
      if: undefined,
      imt: undefined,
      il: undefined,
      ul: undefined,
      layers: undefined,
      drop: undefined,
      opt: undefined,
      wd: undefined,
      dev: undefined,
    })
  );
  root.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && /** @type {HTMLElement} */ (e.target).tagName === "INPUT") {
      e.preventDefault();
      if (applyBlocked()) return; // WP-176c: the same wait as the button's
      opts.onApply(collect());
    }
  });

  syncModelRow(); // WP-146: the row is drawn from the first frame (the page's `setModelState` refines it once the list of stored models has arrived)
  return {
    collect,
    setTargetRated,
    /**
     * WP-203: a short note in the head beside Apply / Defaults (the content page: "form loaded from saved walk"); null takes it away. It uses the room of the hint that says why Apply waits, so
     * the head's height and every control in it stay where they are, and gives way to that hint while it has something to say.
     * @param {{text: string, title: string} | null} next
     */
    setNote(next) {
      note = next;
      if (isContent) syncFieldsState();
    },
    /**
     * WP-146: what the page knows about the model: the stored model of the applied settings (null: none, or not asked yet - `listKnown` tells which), and the trace on screen's
     * `meta.model`.
     * @param {{match: import("../util/model-source.js").ModelInfo | null, listKnown: boolean, last: import("../util/model-source.js").ModelMeta | null}} state
     */
    setModelState(state) {
      modelState = state;
      syncModelRow();
    },
  };
}
