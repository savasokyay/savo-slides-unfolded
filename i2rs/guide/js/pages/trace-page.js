// @ts-check
// WP-32/WP-41: host page for the uCF / iCF / cb explain trace. The route is the single source of
// truth: `ds`, `u`, `i` (dense indices) plus the engine options (`sim`, `mc`, `k`, `sw`, `den`,
// `clip`, `keepneg`) select the trace; `step` mirrors the player position (router.replace keeps the
// store in sync). WP-41 added the EntityPicker pair with the legacy demo_lecture.m guards, the
// seeded random pick, the ParamForm and the "all similarities for this pair" table. WP-42 (iCF):
// `ctr` / `pred` / `deg` route params (centring switch, prediction form, legacy degree filter), the
// item-pair similarity table and the centring / degree-filter summary chips. WP-45 (content-based,
// route engine "cb", nav page id "content"): `mst` (min shared tags), `hyb`/`alpha`/`mcfn` (hybrid
// strategy + its one parameter); no pair-similarity table (content similarity is not part of the
// rating-based catalogue that table shows) and no `sim`/`mc`/`den`/`keepneg` controls (TF-IDF
// cosine has none of those choices - always non-negative, no mean convention).
// WP-176 (the content page is layout F, `cbPage`): the profile matrix (films x terms) over formula | code, the flowchart over the candidate table, role colours, the candidate
// counter, the held-out rating opened by the prediction PHASE (its table has no cell for it), `f` / `fw` / `tf` (the fields, their weights, the tf damping: util/cb-fields.js)
// and one coverage chip per selected field. No hybrid control is drawn (user decision, 2026-10-16); `hyb` / `alpha` / `mcfn` in the route still reach the request.
// WP-46 (MF / implicit, route engine + nav page id "mf"): `alg` selects FunkSVD / ALS / BPR / EASE,
// `nf` `lr` `reg` `bias` `std` `lam` `bs` `ein` `mr` `seed` are MFConfig fields and `ep` `pat` `vf`
// its trainer block. The flowchart comes from `trace.flowchart_id` (three flowcharts behind one
// route), two extra panels show the training curve and the 2-D latent space, the table is the
// epoch log (or EASE's weight table), and implicit models report a score + rank, not a rating.
// WP-47 (DNN, route engine + nav page id "dnn"): the same training panels as mf plus an architecture
// panel (`network` view); `arch` `layers` `drop` `opt` `wd` `dev` are DNNConfig fields, the shared
// `nf` `lr` `bs` `std` `seed` `ep` `pat` `vf` `clip` params keep their MF meaning.
// WP-141 (MF and DNN pages, only when `/api/meta` `engine_tasks` says the engine offers it): a page-level task switch under the title, "Predict a rating | Recommend top-K".
// `task` (topk; absent = predict), `k` (the list length) and `cand` (unseen | all) are REQUEST parameters - part of the trace key, sent to the API - not view state. In the
// top-K task the film selector is hidden (there is no film), the request names none, the Ranked list stands where the sub-matrix stands, the factor panel is one row of
// scores, the summary bar reads `meta.topk` and the held-out reveal setting does not exist (no rating is held out). `k` is the neighbour count on the user-based pages
// and the list length here: it never reaches a model's engine config (util/topk.js `configParams`).

import { createCodePanel } from "../components/code-panel.js";
import { createCurvePanel } from "../components/curve-panel.js";
import { createDataTable } from "../components/data-table.js";
import { createEmbeddingPanel } from "../components/embedding-panel.js";
import { createEntityPicker } from "../components/entity-picker.js";
import { createFactorPanel } from "../components/factor-panel.js"; // WP-122
import { createFlowchart } from "../components/flowchart.js";
import { createFormulaPanel } from "../components/formula-panel.js";
import { createHeatGrid } from "../components/heat-grid.js";
import { modeFor, valsParam } from "../util/heat-centred.js"; // WP-132
import { heldOutCell, revealsCell } from "../util/heat-orient.js"; // WP-137a
import { statsModeFor, statsParam } from "../util/heat-stats.js"; // WP-136
import {
  drivenTab,
  LOWER_BOXES,
  lowerFromParam,
  lowerOpeningTab,
  lowerStepTab,
  lowerTabBefore,
  nextLowerTab,
  nextPanelTab,
  panelParam,
  secondTabFor,
  tabBefore,
  tabFromParam,
} from "../util/panel-tab.js"; // WP-152; WP-154; WP-158
import { ratedChipFor } from "../util/picker-defaults.js"; // WP-153
import { DEFAULT_PICK_SEED, architectureDefaults, openingTabs, sideGroups, sideRows, wantsDefaultPair } from "../util/dnn-features.js"; // WP-243: the feature page opens on its diagram and its curve, and on a pair; WP-244: and its side inputs // WP-246
import { sideDrivenTab, sideTabBefore, sideTabFromParam } from "../util/side-tab.js"; // WP-244: the Side inputs tab of the sub-matrix panel
import { createSideInputsPanel } from "../components/side-inputs-panel.js"; // WP-244
import { createValuesPanel } from "../components/values-panel.js"; // WP-248: the Values tab
import { isHidden, paintChip, paintFigures, revealModeFor, revealParam } from "../util/reveal.js"; // WP-137a
import { fieldConfigFromParams, fieldParamsFromConfig } from "../util/cb-fields.js"; // WP-176
import { numericItems } from "../util/cb-numeric.js"; // WP-176a (b)
import { CB_TABLES, cbDrivenTab, cbTabBefore, cbTabFromParam, cbTableBefore, cbTableDriven, cbTableFromParam, cbTablesFor, cbTabsFor } from "../util/cb-tabs.js"; // WP-176 (stages 2 and 3); WP-195c: cbTablesFor
import { createCbFit } from "../components/cb-fit.js"; // WP-195c
import { createHybridCurve } from "../components/hybrid-curve.js"; // WP-222: the weighted hybrid's trajectory curve (the Weights tab)
import { createHybridBoard } from "../components/hybrid-board.js"; // WP-222b: the switching hybrid's leaderboard bars (the Leaderboard tab)
import { hybridConfigFromParams, isHybridMethod } from "../util/hybrid-config.js"; // WP-222: the hybrid route <-> engine config
import { baseNames, hybridAlias } from "../util/hybrid-bases.js"; // WP-233: the bases are the methods of the earlier pages (their names, the engine's abbreviations in the page's words)
import { dressBaseCell } from "../components/hybrid-base-cell.js"; // WP-233: the bases table's name cell (badge, link to the page, settings in effect)
import { dataRowFor } from "../util/data-row.js"; // WP-242: what the page trained, validated and tested on, in words and numbers
import { scopeOf, scopeTexts } from "../util/hybrid-scope.js"; // WP-239: the scope each decision step states (whole class, this user, user x film, this pair)
import { TREND_GLYPH, largestChange, trendOf } from "../util/hybrid-curve-model.js"; // WP-235: which way a gradient step moved the error, and which weight moved the most
import { createHybridBlendLine } from "../components/hybrid-blend-line.js"; // WP-235: the blend of the target film with its numbers in it (the Blend tab's first line)
import { HYBRID_BURST_MS, HYBRID_TABS, firstReference, hybridBurstsFor, hybridDrivenTab, hybridLoopsFor, hybridTabBefore, hybridTabFromParam, hybridTabsFor } from "../util/hybrid-tabs.js"; // WP-235a: hybridBurstsFor, HYBRID_BURST_MS // WP-222: the tabs of the weighted hybrid's panel and its two loops; WP-222b: the switching walk's tabs and loops, by the method
import { changesParams, configParams, ilsParams, openingTask, requestExtras, summaryParams, taskChoiceParam, taskFor, taskSwitchFor, topkOffered } from "../util/topk.js"; // WP-141; WP-141a; WP-166; WP-176 (stage 4); WP-176a
import { orientationFor } from "../util/heat-orient.js"; // WP-131
import { createNarration, showIdleNarration } from "../components/narration.js"; // WP-109 (10)
import { createNetworkPanel } from "../components/network-panel.js";
import { richInfoTip } from "../components/rich-tip.js"; // WP-168c: the network (i) is a small scrolling page, not a 260 px column
import { createPairFilms } from "../components/pair-films.js"; // WP-105: the sub-matrix panel's second tab
import { createPairSimilarities } from "../components/pair-similarities.js";
import { createDataRow } from "../components/data-row.js"; // WP-242: the "Data" row at the top of the Parameters panel
import { createParamForm } from "../components/param-form.js";
import { createRankedList } from "../components/ranked-list.js"; // WP-141
import { createTaskSwitch } from "../components/task-switch.js"; // WP-141a
import { createTraceLoading } from "../components/trace-loading.js"; // WP-140
import { algorithmName, loadingWords } from "../util/trace-loading.js"; // WP-140
import { newProgressId, reportsProgress } from "../util/progress-format.js"; // WP-191
import { createSavedWalks } from "../components/saved-walks.js"; // WP-192
import { routeForm, routeHasExtras, savedFormsQuery, savedWalksQuery } from "../util/saved-walks.js"; // WP-192; WP-203: the inventory's question and the form on screen
import { createLargeTraceWarning } from "../components/large-trace-warning.js"; // WP-146
import { classSetFor, confirmCovers, confirmScope, isTooLarge, largeOffer, matchModel, modelChip, modelRequestFields, pretrainedOffered } from "../util/model-source.js"; // WP-146
import { createPlayerControls } from "../components/player-controls.js";
import { createSplitter } from "../components/splitter.js"; // WP-107
import { showToast } from "../components/toast.js";
import { createTracePlayer } from "../components/trace-player.js";
import { createZoomControl } from "../components/zoom-control.js"; // WP-107 (g / g2)
import { fmt } from "../util/format.js";
import { infoTip } from "../util/info-tip.js"; // WP-108
import { etaKey as etaKeyOf } from "../util/trace-eta.js"; // WP-210: the kind of a request, for the strip's estimate of the whole wait
import { createPanel } from "../util/panel.js";
import { browserStorage } from "../util/safe-storage.js"; // WP-107
import { linkedText } from "../util/user-link.js"; // WP-96
import { followDataset, routeForDataset } from "../util/dataset-follow.js"; // WP-115 (12)
import { layoutScope, migrateLayout, splitKey } from "../util/layout-scope.js"; // WP-115 (13)

/** WP-158: one of the two lower boxes (the Formula panel, the Code panel) with its two tabs: `firstBody` is the panel's own body, `body` the second tab's (latent space / training curve) */
/** @typedef {{side: "formula" | "code", box: HTMLElement, buttons: Record<string, HTMLButtonElement>, firstBody: HTMLElement, body: HTMLElement}} LowerBox */

/**
 * Route params -> engine config understood by the API (UserKNNConfig / ItemKNNConfig fields).
 * WP-84: the attribute-filter params (fg fy ms ufc ufn cfg cfy) are translated only while
 * `features.attribute_filter` is on; a deep link carrying them is ignored otherwise (the server
 * would answer 403 anyway), so a lecture before the exam debrief shows no trace of the feature.
 * @param {Record<string, string>} params
 * @param {Record<string, boolean>} [features]
 */
export function configFromParams(params, features = {}) {
  // WP-222: a hybrid route (`m` is weighted | switching | meta) is the weighted hybrid page's: its keys (`bases`, `w`, `hf`, `hc`, `mr`, `wc`, `gs`, `gss`, `rl`, `fo`) are its own and some collide
  // with the model pages' (`mr` = min raters there), so the hybrid's config is built whole by util/hybrid-config.js and the generic translation below never sees them
  if (isHybridMethod(params.m)) return hybridConfigFromParams(params);
  /** @type {Record<string, unknown>} */
  const config = {};
  if (params.sim) config.similarity = params.sim;
  if (params.mc) config.mean_convention = params.mc;
  if (params.k !== undefined && params.k !== "") config.k = Number(params.k);
  if (params.sw) {
    config.sig_weight =
      params.sw === "none"
        ? { mode: "none" }
        : params.sw === "raw"
          ? { mode: "raw_count" }
          : { mode: "min_ratio", n: Number(params.sw) };
  }
  if (params.den) config.denominator = params.den;
  // WP-110 (b): the cosine's norms (absent = the engine default `full`; the engine collapses it to `full` for every other measure)
  if (params.cs === "corated" || params.cs === "full") config.cosine_support = params.cs;
  // WP-110 (b''): the constrained Pearson's fixed centre z - a number (anything else is dropped: the server would answer 422); absent = the scale midpoint
  if (params.cz !== undefined && String(params.cz).trim() !== "" && Number.isFinite(Number(params.cz))) config.constrained_centre = Number(params.cz);
  if (params.clip) config.clip = params.clip === "1" || params.clip === "true";
  if (params.keepneg !== undefined) config.keep_negative = params.keepneg === "1" || params.keepneg === "true";
  // WP-42: item-based options (ItemKNNConfig fields); absent = the engine default
  if (params.ctr) config.centering = params.ctr === "item" ? "item_mean" : "user_mean";
  if (params.pred) config.prediction = params.pred === "baseline" ? "item_mean_baseline" : "weighted_average";
  const degree = degreeFromParam(params.deg);
  if (degree) config.degree_filter = degree;
  // WP-84 (D7): attribute filters - only while the feature flag is on
  if (features && features.attribute_filter) {
    if (params.fg || params.fy) {
      /** @type {Record<string, unknown>} */
      const flt = {};
      if (params.fg) flt.genres = String(params.fg).split(",").filter(Boolean);
      if (params.fy) {
        const [lo, hi] = String(params.fy).split("-");
        if (lo) flt.year_min = Number(lo);
        if (hi) flt.year_max = Number(hi);
      }
      config.item_filter = flt;
    }
    if (params.ufc === "class" || (params.ufn !== undefined && params.ufn !== "")) {
      /** @type {Record<string, unknown>} */
      const uf = {};
      if (params.ufc === "class") uf.cohort = "class";
      if (params.ufn !== undefined && params.ufn !== "") uf.min_ratings = Number(params.ufn);
      config.user_filter = uf;
    }
    if ((params.cfg && params.cfg !== "none") || (params.cfy !== undefined && params.cfy !== "")) {
      /** @type {Record<string, unknown>} */
      const cf = {};
      if (params.cfg && params.cfg !== "none") cf.genres = params.cfg;
      if (params.cfy !== undefined && params.cfy !== "") cf.year_window = Number(params.cfy);
      config.candidate_filter = cf;
    }
    if (params.ms === "segment") config.mean_scope = "segment";
  }
  // WP-45: content-based (cb) options
  if (params.mst !== undefined && params.mst !== "") config.min_shared_terms = Number(params.mst);
  Object.assign(config, fieldConfigFromParams(params)); // WP-176: the fields, their weights and the tf damping (`f`, `fw`, `tf`)
  // WP-176 (stage 3): the content page's second method (`m=profile`, the engine's `cb.method`; the default `item` stays out of the request). The feature-selection step has no route
  // parameter (design note 7a: it stays on in the lecture; the request key `feature_selection` still switches it)
  if (params.m === "profile") config.method = "profile";
  // WP-195c: the third method, the per-user content model (`m=model`: a regressor learned from the user's own films); its ridge penalty is the route's `ma` (the engine's `cb.model.alpha`;
  // `alpha` is the hybrid's blend). A penalty that is no number is dropped (the server would answer 422); absent = the engine's own
  else if (params.m === "model") {
    config.method = "model";
    // WP-195c stage 2: the model's second kind, a small network (`mk=mlp`; any other `mk` is the regression): `config.model.kind`; a network has no ridge penalty, so `ma` is not sent with it
    if (params.mk === "mlp") {
      config.model = { kind: "mlp" };
      // WP-224: the network's training controls (`cb.model.mlp.*`): hidden units, the epoch budget, the learning rate, the validation share, the seed; `pat` is its early-stopping
      // patience and `es=0` switches early stopping off (the labelled foil). A value that is no number is dropped (the server would answer 422); absent = the engine's own
      /** @param {unknown} raw @returns {number | undefined} */
      const numOf = (raw) => (raw !== undefined && String(raw).trim() !== "" && Number.isFinite(Number(raw)) ? Number(raw) : undefined);
      /** @type {Record<string, unknown>} */
      const mlp = {};
      if (numOf(params.hid) !== undefined) mlp.hidden = numOf(params.hid);
      if (numOf(params.ep) !== undefined) mlp.epochs = numOf(params.ep);
      if (numOf(params.lr) !== undefined) mlp.lr = numOf(params.lr);
      if (numOf(params.vf) !== undefined) mlp.val_fraction = numOf(params.vf);
      if (numOf(params.seed) !== undefined) mlp.seed = numOf(params.seed);
      /** @type {Record<string, unknown>} */
      const early = {};
      if (params.es === "0" || params.es === "1") early.enabled = params.es === "1";
      if (numOf(params.pat) !== undefined && Number(params.pat) >= 1) early.patience = Math.round(Number(params.pat));
      if (Object.keys(early).length) mlp.early_stopping = early;
      if (Object.keys(mlp).length) config.model.mlp = mlp;
    } else if (params.ma !== undefined && String(params.ma).trim() !== "" && Number.isFinite(Number(params.ma))) config.model = { alpha: Number(params.ma) };
  }
  if (params.hyb && params.hyb !== "none") {
    /** @type {Record<string, unknown>} */
    const hybrid = { mode: params.hyb };
    if (params.hyb === "weighted" && params.alpha !== undefined && params.alpha !== "") {
      hybrid.alpha = Number(params.alpha);
    }
    if (params.hyb === "switching" && params.mcfn !== undefined && params.mcfn !== "") {
      hybrid.min_cf_neighbours = Number(params.mcfn);
    }
    config.hybrid = hybrid;
  }
  // WP-46: MF options (MFConfig fields; absent = algorithms.yaml default)
  if (params.alg) config.algorithm = params.alg;
  if (params.nf !== undefined && params.nf !== "") config.n_factors = Number(params.nf);
  if (params.lr !== undefined && params.lr !== "") config.lr = Number(params.lr);
  if (params.reg !== undefined && params.reg !== "") config.reg = Number(params.reg);
  if (params.bias !== undefined) config.biases = params.bias === "1" || params.bias === "true";
  if (params.std !== undefined && params.std !== "") config.init_std = Number(params.std);
  if (params.lam !== undefined && params.lam !== "") config.lam = Number(params.lam);
  if (params.bs !== undefined && params.bs !== "") config.batch_size = Number(params.bs);
  if (params.ein) config.ease_input = params.ein;
  if (params.mr !== undefined && params.mr !== "") config.min_raters = Number(params.mr);
  if (params.seed !== undefined && params.seed !== "") config.seed = Number(params.seed);
  /** @type {Record<string, unknown>} */
  const trainer = {};
  if (params.ep !== undefined && params.ep !== "") trainer.max_epochs = Number(params.ep);
  if (params.pat !== undefined) trainer.patience = params.pat === "" || params.pat === "none" ? null : Number(params.pat);
  // WP-225: the early-stopping switch off (`pat=none`) is the teaching foil on the neural page too: no patience AND no best-weight restore, so the last epoch's weights
  // predict (the per-user network's foil means the same; the merged set's stored 60-epoch variant is this config). Patience off with the restore on is not a form state.
  if (params.pat === "none") trainer.restore_best = false;
  if (params.vf !== undefined && params.vf !== "") trainer.valid_frac = Number(params.vf);
  if (Object.keys(trainer).length) config.trainer = trainer;
  // WP-47: DNN options (DNNConfig fields)
  if (params.arch) config.architecture = params.arch;
  if (params.layers) {
    const widths = String(params.layers).split(/[-,]/).map((w) => Number(w)).filter((w) => Number.isFinite(w) && w > 0);
    if (widths.length) config.mlp_layers = widths;
  }
  if (params.drop !== undefined && params.drop !== "") config.dropout = Number(params.drop);
  if (params.opt) config.optimizer = params.opt;
  if (params.wd !== undefined && params.wd !== "") config.weight_decay = Number(params.wd);
  if (params.dev) config.device = params.dev;
  // WP-223: the feature network's input groups, content fields, vocabulary cap and tower widths (DNNConfig fields); absent = the engine default
  if (params.groups) {
    const groups = String(params.groups).split(/[,\s-]+/).filter(Boolean);
    if (groups.length) config.groups = groups;
  }
  if (params.if) {
    const fields = String(params.if).split(/[,\s-]+/).filter(Boolean);
    if (fields.length) config.item_fields = fields;
  }
  if (params.imt !== undefined && params.imt !== "") config.item_max_terms = Number(params.imt);
  for (const [key, name] of /** @type {[string, string][]} */ ([["il", "item_layers"], ["ul", "user_layers"]])) {
    if (!params[key]) continue;
    const widths = String(params[key]).split(/[-,]/).map((w) => Number(w)).filter((w) => Number.isFinite(w) && w > 0);
    if (widths.length) config[name] = widths;
  }
  if (params.m === "model" && params.mk === "mlp") {
    // WP-224: the per-user network reads `ep` / `pat` / `lr` / `vf` / `seed` under `config.model.mlp` (above); the model pages' copies of the same names would be unknown keys of the content engine
    delete config.lr;
    delete config.seed;
    delete config.trainer;
  }
  return config;
}

/**
 * WP-43: the inverse of `configFromParams` - an engine config (as echoed by the API) -> the route
 * params of the uCF/iCF page, so the pitfall gallery can deep-link into either trace. Keys with
 * no URL counterpart (e.g. `sim_options`) are dropped: the link then shows the nearest configuration.
 * @param {Record<string, any>} config
 * @returns {Record<string, string>}
 */
export function paramsFromConfig(config) {
  /** @type {Record<string, string>} */
  const p = {};
  if (config.similarity) p.sim = String(config.similarity);
  if (config.mean_convention) p.mc = String(config.mean_convention);
  if (config.k !== undefined && config.k !== null) p.k = String(config.k);
  if (config.sig_weight) {
    const sw = config.sig_weight;
    p.sw = sw.mode === "none" ? "none" : sw.mode === "raw_count" ? "raw" : String(sw.n ?? 50);
  }
  if (config.denominator) p.den = String(config.denominator);
  if (config.cosine_support === "corated") p.cs = "corated"; // WP-110 (b): `full` is the default and stays out of the URL
  if (typeof config.constrained_centre === "number") p.cz = String(config.constrained_centre); // WP-110 (b''): null / absent = the scale midpoint
  if (config.clip) p.clip = "1";
  if (config.keep_negative === false) p.keepneg = "0";
  if (config.keep_negative === true) p.keepneg = "1";
  if (config.centering === "item_mean") p.ctr = "item";
  if (config.prediction === "item_mean_baseline") p.pred = "baseline";
  const d = config.degree_filter;
  if (d && d.mode && d.mode !== "none") p.deg = String(d.value);
  // WP-84: attribute filters (the pitfall gallery never sets them; the inverse stays total)
  const f = config.item_filter;
  if (f && Array.isArray(f.genres) && f.genres.length) p.fg = f.genres.join(",");
  if (f && (f.year_min != null || f.year_max != null)) p.fy = `${f.year_min ?? ""}-${f.year_max ?? ""}`;
  const uf = config.user_filter;
  if (uf && uf.cohort === "class") p.ufc = "class";
  if (uf && uf.min_ratings) p.ufn = String(uf.min_ratings);
  const cf = config.candidate_filter;
  if (cf && cf.genres && cf.genres !== "none") p.cfg = String(cf.genres);
  if (cf && cf.year_window != null) p.cfy = String(cf.year_window);
  if (config.mean_scope === "segment") p.ms = "segment";
  // WP-45: content-based (cb) options
  if (config.min_shared_terms !== undefined && config.min_shared_terms !== null) {
    p.mst = String(config.min_shared_terms);
  }
  if (Array.isArray(config.fields)) Object.assign(p, fieldParamsFromConfig(config)); // WP-176
  const h = config.hybrid;
  if (h && h.mode && h.mode !== "none") {
    p.hyb = String(h.mode);
    if (h.alpha !== undefined && h.alpha !== null) p.alpha = String(h.alpha);
    if (h.min_cf_neighbours !== undefined && h.min_cf_neighbours !== null) {
      p.mcfn = String(h.min_cf_neighbours);
    }
  }
  // WP-46: MF options
  if (config.algorithm) p.alg = String(config.algorithm);
  if (config.n_factors !== undefined && config.n_factors !== null) p.nf = String(config.n_factors);
  if (config.lr !== undefined && config.lr !== null) p.lr = String(config.lr);
  if (config.reg !== undefined && config.reg !== null) p.reg = String(config.reg);
  if (config.biases === false) p.bias = "0";
  if (config.init_std !== undefined && config.init_std !== null) p.std = String(config.init_std);
  if (config.lam !== undefined && config.lam !== null) p.lam = String(config.lam);
  if (config.batch_size !== undefined && config.batch_size !== null) p.bs = String(config.batch_size);
  if (config.ease_input) p.ein = String(config.ease_input);
  if (config.min_raters !== undefined && config.min_raters !== null) p.mr = String(config.min_raters);
  if (config.seed !== undefined && config.seed !== null) p.seed = String(config.seed);
  const t = config.trainer;
  if (t) {
    if (t.max_epochs !== undefined && t.max_epochs !== null) p.ep = String(t.max_epochs);
    if (t.patience !== undefined) p.pat = t.patience === null ? "none" : String(t.patience);
    if (t.restore_best === false) p.pat = "none"; // WP-225: the foil's inverse (no restore = the switch off)
    if (t.valid_frac !== undefined && t.valid_frac !== null) p.vf = String(t.valid_frac);
  }
  // WP-47: DNN options
  if (config.architecture) p.arch = String(config.architecture);
  if (Array.isArray(config.mlp_layers) && config.mlp_layers.length) p.layers = config.mlp_layers.join("-");
  if (config.dropout !== undefined && config.dropout !== null) p.drop = String(config.dropout);
  if (config.optimizer) p.opt = String(config.optimizer);
  if (config.weight_decay !== undefined && config.weight_decay !== null) p.wd = String(config.weight_decay);
  if (config.device) p.dev = String(config.device);
  // WP-223: the feature network's side inputs
  if (Array.isArray(config.groups) && config.groups.length) p.groups = config.groups.join(",");
  if (Array.isArray(config.item_fields) && config.item_fields.length) p.if = config.item_fields.join(",");
  if (config.item_max_terms !== undefined && config.item_max_terms !== null) p.imt = String(config.item_max_terms);
  if (Array.isArray(config.item_layers) && config.item_layers.length) p.il = config.item_layers.join("-");
  if (Array.isArray(config.user_layers) && config.user_layers.length) p.ul = config.user_layers.join("-");
  // WP-224: the per-user network's training controls
  const mlp = config.model && typeof config.model === "object" ? config.model.mlp : undefined;
  if (mlp && typeof mlp === "object") {
    if (mlp.hidden !== undefined && mlp.hidden !== null) p.hid = String(mlp.hidden);
    if (mlp.epochs !== undefined && mlp.epochs !== null) p.ep = String(mlp.epochs);
    if (mlp.lr !== undefined && mlp.lr !== null) p.lr = String(mlp.lr);
    if (mlp.val_fraction !== undefined && mlp.val_fraction !== null) p.vf = String(mlp.val_fraction);
    if (mlp.seed !== undefined && mlp.seed !== null) p.seed = String(mlp.seed);
    const early = mlp.early_stopping;
    if (early && typeof early === "object") {
      if (early.enabled === false) p.es = "0";
      if (early.patience !== undefined && early.patience !== null) p.pat = String(early.patience);
    }
  }
  return p;
}

/**
 * `deg` route param -> DegreeFilter config. A value in (0, 1) is a fraction of the users (legacy
 * Q2ij.m rule `raters > value * n_users`, strict); a value >= 1 is a minimum rater count.
 * @param {string | undefined} raw
 * @returns {{mode: "fraction" | "count", value: number} | null}
 */
export function degreeFromParam(raw) {
  if (raw === undefined || raw === "" || raw === "none") return null;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return null;
  return value < 1 ? { mode: "fraction", value } : { mode: "count", value: Math.round(value) };
}

/** Shared config fetched once per session (catalogue + engine defaults). */
/** @type {Promise<{similarities: any[], algorithms: any, formulas: any}> | null} */
let configPromise = null;

/** @param {any} api */
function loadConfig(api) {
  if (!configPromise) {
    configPromise = Promise.all([api.similarities(), api.algorithms(), api.formulas()]).then(
      ([similarities, algorithms, formulas]) => ({ similarities, algorithms, formulas })
    );
  }
  return configPromise;
}

/**
 * @param {"ucf" | "icf" | "cb" | "mf" | "dnn" | "hybrid"} engine
 */
export function createTracePage(engine) {
  // WP-47: mf and dnn share the training panels (curve, embedding, epoch table)
  const trained = engine === "mf" || engine === "dnn";
  // WP-105: layout F (one sticky player strip, a block of fixed height) and the compact vertical flowchart belong to the
  // uCF and iCF pages; the content page keeps its grid and its charts (WP-123: MF and DNN have layout F too, below)
  const framed = engine === "ucf" || engine === "icf";
  // WP-123: the third mode. MF and DNN get layout F - one sticky player strip, a block of fixed height (the sub-matrix over formula | code, the compact flowchart
  // over the epoch table), the training panels below it - and every feature that belongs to a LAYOUT rather than to a pair of users or films: the size group and the
  // divider of each panel, the coloured code, the finish-step button and key, the macro step counter with the epoch / stage counter under it, the idle strip.
  // `framed` keeps the meanings it has had since WP-105: the two pair tabs of the sub-matrix, the candidate table and counter, the layout scope
  // the two pages share, the significance-weighting tip - none of them exists on a trained page. A feature of those is written with `framed`, a feature of the
  // layout with `layoutF`.
  const framedTrained = trained;
  // WP-176: the content page is the fourth page with layout F (and the third mode: neither a pair of users / films - `framed` - nor a fitted model - `framedTrained`): the candidates
  // are FILMS and the sub-matrix is a film x term table. `cbPage` names it where a feature belongs to this page; it has no pair tabs, no pair panel and no shared layout scope.
  const cbPage = engine === "cb";
  // WP-222: the weighted hybrid page (`#/combine?m=weighted`, trace engine alias "hybrid") is the fifth page with layout F: its sub-matrix panel holds three tabs of its own (Bases | Weights | Blend:
  // the base recommenders and the held-out entries, the weights and their trajectory, the blend of the target) and its flowchart column has no table panel (the tables live in the tabs)
  const hybPage = engine === "hybrid";
  const layoutF = framed || framedTrained || cbPage || hybPage;
  // WP-45: the nav/route page id ("content") and the trace engine alias ("cb") differ for this
  // page - every router.navigate/replace call must use pageId, api.trace()/i18n keys use engine. WP-222: the hybrid's page id is "combine" (alias "hybrid").
  const pageId = engine === "cb" ? "content" : engine === "hybrid" ? "combine" : engine;
  /**
   * WP-222: the hybrid page's method - "weighted" (the learned blend: the walk the page has) or one of its planned siblings ("switching", "meta"); the route's `m`, "weighted" when it names none.
   * Null on the other pages. The title and the page's idle name follow it.
   * @returns {"weighted" | "switching" | "meta" | null}
   */
  const hybMethod = () => (!hybPage ? null : routeParams.m === "switching" ? "switching" : routeParams.m === "meta" ? "meta" : "weighted");
  /**
   * WP-177b: the content page's method - "item" (the TF-IDF item profiles and their cosine predict a rating: the walk the page always had) or "profile" (the user's taste profile and
   * the relevance score of a film); the route's `m`, "item" when it names none or something else. Null on the other pages. The title and the page's idle name follow it;
   * the engine's own `method` option comes with the engine (until then both methods open the same trace).
   * WP-195c: and "model" - the per-user content model (a regressor learned from one user's own rated films).
   * @returns {"item" | "profile" | "model" | null}
   */
  const cbMethod = () => (engine !== "cb" ? null : routeParams.m === "profile" ? "profile" : routeParams.m === "model" ? "model" : "item");
  /**
   * WP-195c stage 2: the per-user model's kind - "mlp" (the small network: the route's `mk=mlp`) or "ridge" (the regression, the default and what any other `mk` means); null on the other methods.
   * @returns {"ridge" | "mlp" | null}
   */
  const cbKind = () => (cbMethod() !== "model" ? null : routeParams.mk === "mlp" ? "mlp" : "ridge");
  /** WP-195c stage 2: what the page's layout is built for - the method, and for the per-user model its kind too (the tabs' texts and the Weights tab's table are the kind's own) @returns {string | null} */
  const cbLayout = () => (cbMethod() === "model" ? `model:${cbKind()}` : cbMethod());
  /** WP-223: the neural page on its feature architecture (`#/dnn?arch=features`, the hybrid week's child `combine.dnn`): its title and its idle name are the sidebar row's, not the plain neural page's */
  const dnnFeatures = () => engine === "dnn" && routeParams.arch === "features";
  /** WP-245: what the neural page's layout is built for - the feature page puts its Network tab in the flowchart panel, the others in the sub-matrix panel @returns {"features" | "plain"} */
  const dnnLayout = () => (dnnFeatures() ? "features" : "plain");
  /** WP-177b: the i18n key of the page's title sentence (`trace.title_<engine>`; the content page's profile and model methods have their own) */
  const titleKey = () => (cbMethod() === "profile" ? "trace.title_cb_profile" : cbMethod() === "model" ? "trace.title_cb_model" : hybPage ? `trace.title_hybrid_${hybMethod()}` : dnnFeatures() ? "trace.title_dnn_features" : `trace.title_${engine}`); // WP-222: the hybrid's title per method; WP-223: the feature network's own
  /**
   * WP-176b: the i18n key of the top-K task's title sentence. The model pages name the model ("{algorithm}: top-K recommendations for {user}"); the content page names its method by the
   * sidebar's own word (nav.content_item / nav.content_profile) and drops "recommendations" - the shorter sentence leaves the title's column room for the task switch beside it.
   */
  const topkTitleKey = () => (engine !== "cb" ? "trace.topk_title" : cbMethod() === "profile" ? "trace.topk_title_cb_profile" : cbMethod() === "model" ? "trace.topk_title_cb_model" : "trace.topk_title_cb");
  /** WP-176 (stage 3): the phase that opens what is held out on the content page - the item method's prediction, the user-profile method's own score */
  const cbRevealPhase = () => (cbMethod() === "profile" ? "user_profile" : "prediction");
  /** @type {HTMLElement | null} */
  let root = null;
  /** @type {any} */
  let ctx = null;
  /** @type {any} */
  let player = null;
  /** @type {string | null} */
  let loadedKey = null;
  /** @type {Record<string, HTMLElement>} */
  let els = {};
  /** @type {any} */
  let userPicker = null;
  /** @type {any} */
  let itemPicker = null;
  /** WP-192: the tick box under "Random pick" (content-based page only) @type {ReturnType<typeof createSavedWalks> | null} */
  let savedWalks = null;
  /** WP-192: the Random pick button (WP-203: greyed only when nothing at all is saved for the page and task) @type {HTMLButtonElement | null} */
  let randomBtn = null;
  /** WP-203: the span beside the icon: the ordinary pick's seed, or - with the switch on - the walk-through's counter "i/N" @type {HTMLElement | null} */
  let seedNode = null;
  /** WP-203: the ordinary pick's seed text (shown while the switch is off) */
  let seedText = "";
  /** WP-203: the walk-through of the saved walks. It lives with the page OBJECT, not with a mount: a press that writes the per-user model's kind changes the layout and the page is mounted
   *  again (`update`), and the count must go on; leaving the page (or a reload) starts it again @type {import("../util/saved-walks.js").WalkCycle | null} */
  let walkCycle = null;
  /** @type {any} */
  let pairPanel = null;
  // WP-105: the sub-matrix panel of the uCF / iCF pages has three tabs - the matrix, all similarities of the chosen pair
  // (the pair panel's table) and the film sets of that pair
  /** @type {any} */
  let pairFilms = null;
  /** @type {{buttons: Record<string, HTMLButtonElement>, simsBody: HTMLElement, simsHost: HTMLElement, filmsBody: HTMLElement, filmsHost: HTMLElement} | null} */
  let heatTabs = null;
  let heatTab = "matrix"; // "matrix" | "sims" | "films"; every trace load starts on the matrix
  // WP-152 / WP-154: the sub-matrix panel of the MF and the neural page has two tabs - the matrix (the Ranked list in the top-K task) and the page's second one: the Factor
  // matrices (MF) or the Network diagram (neural). The player opens the one the step is about (util/panel-tab.js); a click holds until the walk leaves the flowchart node it
  // was made on. `panelTab` is the one on screen, `manualTab` the reader's standing click, `panelNode` the node of the step on screen.
  // WP-245: on the feature page the strip is the FLOWCHART panel's (Flowchart | Network) and the sub-matrix panel has no tabs: `first` is the strip's first tab, `box` its panel
  /** @type {{buttons: Record<string, HTMLButtonElement>, body: HTMLElement, second: "factors" | "network", first: "matrix" | "flow", box: HTMLElement} | null} */
  let panelTabs = null;
  /** WP-245: the first tab of the page's strip - "matrix" (every page with one) or "flow" (the feature page) @type {"matrix" | "flow"} */
  let panelFirst = "matrix";
  // WP-244: and the feature page's sub-matrix panel has a second tab of its own, "Side inputs" (the numbers each side input hands the network): `sideTab` is the one on screen, `sideManual` the reader's standing click,
  // `sideNode` the node of the step on screen, `sideHas` whether the trace carries any side input (an ids-only network does not: the tab is hidden)
  // WP-248: and a third, "Values" (the vectors the network passes on, stage by stage): `valuesHas` whether the trace carries a network view, `valuesRef` its panel
  /** @type {{buttons: Record<string, HTMLButtonElement>, body: HTMLElement, valuesBody: HTMLElement} | null} */
  let sideTabs = null;
  /** @type {import("../util/side-tab.js").SideTab} */
  let sideTab = "matrix";
  /** @type {{tab: import("../util/side-tab.js").SideTab, node: string | null} | null} */
  let sideManual = null;
  /** @type {string | null} */
  let sideNode = null;
  let sideHas = false;
  let valuesHas = false; // WP-248
  /** @type {ReturnType<typeof createValuesPanel> | null} */
  let valuesRef = null; // WP-248
  /** @type {import("../util/panel-tab.js").PanelTab} */
  let panelTab = "matrix";
  /** @type {import("../util/panel-tab.js").ManualChoice | null} */
  let manualTab = null;
  /** @type {string | null} */
  let panelNode = null;
  // WP-176 (stage 2): the content page's sub-matrix panel has tabs of its own, per method (util/cb-tabs.js: item similarity "Profile matrix | TF-IDF", user profile "Taste profile |
  // TF-IDF"). The player opens the one the step carries; a click holds until the walk leaves the flowchart node it was made on. `cbTabs` is the built strip (null on every other page),
  // `cbTab` the tab on screen, `cbManual` the reader's standing click, `cbNode` the node of the step on screen, `layoutMethod` the method the strip was built for (the sidebar's two
  // rows are one page: a change of `m` builds the page again).
  /** @type {{tabs: import("../util/cb-tabs.js").CbTab[], buttons: Record<string, HTMLButtonElement>, bodies: Record<string, HTMLElement>, heads: Record<string, HTMLElement>, hosts: Record<string, HTMLElement>, base: HTMLElement, idle: HTMLElement | null, featuresIdle: HTMLElement | null, strip: HTMLElement, title: HTMLElement, topkGroup: HTMLElement} | null} */
  let cbTabs = null;
  /** @type {import("../util/cb-tabs.js").CbTab} */
  let cbTab = "matrix";
  /** @type {{tab: import("../util/cb-tabs.js").CbTab, node: string | null} | null} */
  let cbManual = null;
  /** @type {string | null} */
  let cbNode = null;
  /** WP-245: and, on the neural page, "features" | "plain" (the feature page's Network tab is the flowchart panel's: a change of `arch` builds the page again) @type {string | null} */
  let layoutMethod = null;
  /** WP-231: repaints the Network tab's (i) when the route's `arch` changes - the two neural rows of the sidebar are ONE page, so a click between them does not rebuild it (null off the neural page) @type {(() => void) | null} */
  let repaintNetworkTip = null;
  /** WP-195c stage 2: the Fit tab's panel (the network's curve is resized when the tab opens) @type {{resize: () => void} | null} */
  let cbFitRef = null;
  // WP-222: the weighted hybrid's sub-matrix panel has three tabs of its own - Bases | Weights | Blend (util/hybrid-tabs.js). The player opens the one the step carries; a click holds until the
  // walk leaves the flowchart node it was made on. `hybTabs` is the built strip (null on every other page), `hybTab` the tab on screen, `hybManual` the reader's standing click, `hybNode` the node
  // of the step on screen, `hybCurveRef` the trajectory curve (resized when its tab opens: a chart drawn in a closed tab has no size).
  // WP-222b: the switching walk (`m=switching`) builds the same strip with its own three tabs - Bases | Leaderboard | Answer (`hybTabs.tabs` says which strip is on screen) - and
  // `hybBoardRef` is its leaderboard bars.
  /** @type {{buttons: Record<string, HTMLButtonElement>, bodies: Record<string, HTMLElement>, hosts: Record<string, HTMLElement>, base: HTMLElement, tabs: readonly import("../util/hybrid-tabs.js").HybridTab[], repaintBridge: () => void} | null} */
  let hybTabs = null; // WP-239: repaintBridge - the switching walk's bridge sentence follows the rule
  /** @type {import("../util/hybrid-tabs.js").HybridTab} */
  let hybTab = "bases";
  /** @type {{tab: import("../util/hybrid-tabs.js").HybridTab, node: string | null} | null} */
  let hybManual = null;
  /** @type {string | null} */
  let hybNode = null;
  /** @type {{resize: () => void} | null} */
  let hybCurveRef = null;
  /** WP-235: the Blend tab's weights grid (resized, i.e. its label column measured again, when the tab opens) @type {{remeasure: () => void} | null} */
  let hybProfileRef = null;
  /** WP-222b: the switching walk's leaderboard bars (components/hybrid-board.js); null on the weighted walk @type {{reset: (trace: any) => void, apply: (frame: any) => void} | null} */
  let hybBoardRef = null;
  // WP-176 (stage 3): the lower-right table panel has a strip of its own - the candidates | what each field adds to the similarity | what each neighbour adds to the prediction. The step
  // decides which table is on screen (util/cb-tabs.js `cbTableDriven`); `cbTableStrip` is the built strip (null on every other page), `cbTable` the table on screen, `cbTableManual` the
  // reader's standing click (held while the walk stays on its flowchart node), `cbTablesHave` the tables the loaded trace has, `cbTableRef` the data table the strip drives and
  // `cbFrame` the step on screen (a click on the strip draws the new table at that step).
  /** @type {{strip: HTMLElement, buttons: Record<string, HTMLButtonElement>} | null} */
  let cbTableStrip = null;
  /** @type {import("../util/cb-tabs.js").CbTable} */
  let cbTable = "items";
  /** @type {{tab: import("../util/cb-tabs.js").CbTable, node: string | null} | null} */
  let cbTableManual = null;
  /** @type {string[]} */
  let cbTablesHave = [];
  /** @type {ReturnType<typeof createDataTable> | null} */
  let cbTableRef = null;
  /** @type {any} */
  let cbFrame = null;
  /** @type {(string | null)[]} */
  let stepNodes = []; // the flowchart node of every step of the loaded trace: a link's `panel` is the reader's choice AT the node of the step the link names
  // WP-158: the two lower panels of the MF and the neural page have a second tab each - the Formula panel's "Latent space", the Code panel's "Training curve" (they were two panels
  // under the block). Each box is driven on its own by the step (util/panel-tab.js `formulaBoxTab` / `codeBoxTab`); a click holds until the walk leaves the node it was made on.
  /** @type {{formula: LowerBox, code: LowerBox} | null} */
  let lowerTabs = null;
  /** @type {Record<"formula" | "code", import("../util/panel-tab.js").LowerTab>} */
  let lowerShown = { formula: "formula", code: "code" };
  /** @type {Record<"formula" | "code", import("../util/panel-tab.js").LowerManual | null>} */
  let lowerManual = { formula: null, code: null };
  /** @type {string | null} */
  let lowerNode = null;
  /** @type {{latent: boolean, curve: boolean}} */
  let lowerOff = { latent: false, curve: false }; // the loaded trace has no such view (a closed form, a top-K trace): the tab is greyed and the box keeps its first tab
  /** @type {{setScale: () => void, resize: () => void} | null} */
  let curveRef = null;
  // WP-107 (e2): the flowchart column stacks the flowchart panel over the candidate table, a draggable divider between them
  /** @type {ReturnType<typeof createSplitter> | null} */
  let flowSplit = null;
  /** @type {HTMLElement | null} */
  let sigTip = null; // WP-108 (b): the (i) in the Formula head, shown on the significance-weighting steps
  /** @type {ResizeObserver | null} */
  let flowObserver = null;
  // WP-107 (g2): the reader's size factors of the flowchart and of the candidate table (the other two panels use a CSS variable only)
  /** @type {HTMLElement | null} */
  let tableZoomEl = null;
  let flowZoomValue = 1;
  let tableZoomValue = 1;
  /** @type {{relayout: () => void} | null} */
  let flowchartRef = null;
  /** @type {{mode: () => string, setMode: (mode: "raw" | "centred") => void, setReveal: (mode: "step" | "start") => void, statsMode: () => string, setStatsMode: (mode: "raw" | "centred") => void} | null} */
  let heatRef = null; // WP-132: the sub-matrix grid, so a `vals` the URL changes reaches its cells; WP-137a: and a `reveal`
  // WP-137a: the held-out reveal setting. `revealMode` follows the URL (`reveal`: step | start); `heldCell` is the cell [user row, film column] the loaded trace
  // reveals at its prediction step (null: nothing to hide - the content page, a view without the cell); `revealedNow` says the step on screen opens it; `hideable` are
  // the summary bar's figures that give the prediction away (their real text is kept here); `revealChip` is the picker chip's rating while it is hidden-able.
  /** @type {"step" | "start"} */
  let revealMode = "step";
  /** @type {[number, number] | null} */
  let heldCell = null;
  let revealedNow = false;
  /** @type {{el: HTMLElement, text: string}[]} */
  let hideable = [];
  /** @type {{rating: string, convention: string} | null} */
  let revealChip = null;
  /** @type {HTMLElement | null} */
  let revealWrap = null;
  // WP-141: the task of the page - "predict" (the walk the page always had) or "topk" (the ranked list); topk only while the server offers it for this engine.
  /** @type {"predict" | "topk"} */
  let task = "predict";
  // WP-140: the strip and the look of a trace on its way (util/trace-loading.js: idle / loading / ready / stale / error), and the engine's defaults the strip's words fall back to
  /** @type {ReturnType<typeof createTraceLoading> | null} */
  let traceLoading = null;
  /** @type {Record<string, any> | null} */
  let engineDefaults = null;
  // WP-146: where the model of a trace comes from. `largeWarning`: the inline warning of a trace that would train on more ratings than the page allows; `confirmed`: the person's
  // "train anyway" - its scope (data set + engine + resolved settings, util/model-source.js `confirmScope`) and the server's estimate of that fit, for the rest of the page's session;
  // `modelList`: the models fitted at home for the data set (null: not asked, or the request failed); `lastModel`: the trace on screen's `meta.model`.
  /** @type {ReturnType<typeof createLargeTraceWarning> | null} */
  let largeWarning = null;
  /** @type {{scope: string, estimate: number | null} | null} */
  let confirmed = null;
  /** @type {any[] | null} */
  let modelList = null;
  /** @type {string | null} */
  let modelsFor = null; // the data set `modelList` was asked for
  /** @type {any[]} */
  let datasetList = []; // `/api/meta` `datasets`: the class set the "too large" warning leads to
  /** @type {number | undefined} */
  let trainLimit; // `/api/meta` `trace_limits.max_train_ratings`
  /** @type {import("../util/model-source.js").ModelMeta | null} */
  let lastModel = null;
  /** @type {ReturnType<typeof createTaskSwitch> | null} */
  let taskSwitch = null; // WP-141a: the switch in the title row, on every trace page (hidden while the server reports no tasks; its top-K choice is a placeholder where the engine has none)
  /** @type {{dataset: string, a: number, b: number} | null} */
  let pairState = null; // the pair the pair panel shows (null: no neighbour chosen / none to choose)
  /** @type {string | null} */
  let filmsKey = null; // the pair the films tab last asked for
  /** @type {string | null} */
  let paramsKey = null;
  // WP-109 (6): the Parameters form is told whether the active user has rated the target (`trace.result.actual`): when not, the
  // mean-convention chips dynamic / static are the same number and say so. `null` = no trace seen (or it failed): nothing is claimed.
  /** @type {{setTargetRated: (rated: boolean | null) => void} | null} */
  let paramForm = null;
  /** WP-242: the Data row of the Parameters panel, and the trace whose counts it shows (null: none yet, or the settings changed since: the row then shows the settings alone) @type {ReturnType<typeof createDataRow> | null} */
  let dataRow = null;
  /** @type {any} */
  let dataTrace = null;
  /** @type {boolean | null} */
  let targetRated = null;
  /** WP-84: ui.features from /api/meta (the attribute filter stays hidden while off) */
  /** @type {Record<string, boolean>} */
  let features = {};
  /** WP-84: genre vocabulary per dataset (keys of /stats genre_counts) */
  /** @type {Record<string, Promise<string[]>>} */
  const genreCache = {};
  /** @type {string | null} */
  let prefillKey = null; // WP-83c: what the pickers were last prefilled from
  /** @type {Record<string, string>} */
  let routeParams = {};
  let dataset = "";
  /** WP-122: the dataset's rating scale (the factor panel's tint of a rated value) @type {{min: number, max: number, step: number} | null} */
  let ratingScale = null;
  /** WP-115 (12): the header selector's dataset this page last looked at; null until its first update after it was mounted (util/dataset-follow.js) @type {string | null} */
  let storeDataset = null;
  let mounted = false;
  // WP-97: request tokens. An async continuation compares the token it took when it started with the live
  // one and drops its result when they differ - `mounted` alone cannot tell "the page is gone" from "the
  // page was left and entered again, and a newer request owns the screen", nor an old trace of the same
  // page from the current one (A -> B -> A with B's answer arriving last). Mount and unmount bump all three.
  let traceSeq = 0; // loadTrace: the trace of the route on screen
  let paramsSeq = 0; // the parameter form (config + genre vocabulary of the dataset in the route)
  let pickSeq = 0; // the random-pair button
  let stripRevealed = false; // WP-105: the deep-link scroll to the player strip happens once per mount
  let defaultPairTried = false; // WP-243: the feature page's opening on the default pair is asked once per mount

  function layout() {
    if (!root) return;
    // WP-115 (13): the uCF and iCF pages keep their dividers and panel zoom under one scope; what the reader already chose on the uCF page (else iCF) is taken over, once
    if (framed) migrateLayout(browserStorage());
    root.innerHTML = "";
    const wrap = document.createElement("div");
    wrap.className = "trace-page";
    const title = document.createElement("h2");
    title.className = "trace-title";

    // WP-104: the random-pick box leaves the selection row (it was its third column) and shares the title's row, at
    // the right: the user and item boxes get the width, the page one row less
    const head = document.createElement("div");
    head.className = "trace-head";
    const selection = document.createElement("div");
    selection.className = "trace-selection";
    const userBox = createPanel("user-picker", "trace-panel");
    const itemBox = createPanel("item-picker", "trace-panel");
    const randomBox = createPanel("random", "trace-panel trace-random");
    randomBox.body.className = "panel-body random-pick";
    // WP-141a: the task switch takes the middle of the title row - the title at the left, the "Random pick" box at the right (a narrow page drops it under the title, trace.css)
    taskSwitch = createTaskSwitch({
      i18n: ctx.i18n,
      onChoose: (value) => navigateWith(value === "topk" ? { task: "topk" } : { task: taskChoiceParam(engine, value, routeParams), k: undefined, cand: undefined }), // WP-166: the neural page writes predict
    });
    const headRow = document.createElement("div"); // the grid inside the query container `.trace-head`
    headRow.className = "trace-head-row";
    headRow.append(title, taskSwitch.el, randomBox.box);
    head.appendChild(headRow);
    selection.append(userBox.box, itemBox.box);

    const params = createPanel("params", "trace-panel", ctx.i18n.t("params.title"), true);
    // WP-109 (9): Apply / Defaults stand in the panel head, beside the title (one row less than under the fields)
    const paramActions = document.createElement("span");
    paramActions.className = "param-head-actions";
    params.box.querySelector(".panel-head h3")?.after(paramActions);
    // WP-137a: the held-out reveal setting stands at the far right of the same head, level with Apply / Defaults, before the fold caret; hidden while no trace has a held-out cell
    revealWrap = buildRevealSwitch();
    params.box.querySelector(".panel-head .caret")?.before(revealWrap);
    const summary = document.createElement("div");
    summary.className = "trace-summary";
    // WP-105: the uCF / iCF pages use layout F: ONE player strip (narration + controls) that stays on top while the page
    // scrolls, then a block of fixed height - the sub-matrix over formula | code at the left, the flowchart as a narrow
    // vertical column at the right - then the candidate table and the pair panel. WP-123: the MF and DNN pages have the same
    // block (the flowchart over the epoch table) with the training panels - curve, embedding - below it. The
    // content page keeps its grid: its narration and controls stay two panels.
    const grid = document.createElement("div");
    grid.className = framedTrained
      ? "trace-layout layout-f has-training" // WP-46 / WP-47; WP-123: layout F, the training panels below the block; WP-154: the network is the sub-matrix panel's second tab, no row
      : framed || cbPage || hybPage
        ? "trace-layout layout-f"
        : "trace-layout";
    const narration = layoutF ? null : createPanel("narration", "trace-panel area-narration");
    const controls = layoutF ? null : createPanel("controls", "trace-panel area-controls");
    const strip = layoutF ? createPanel("strip", "trace-panel area-strip") : null;
    /** the two hosts of the strip: the narration at the left, the transport at the right.
     * WP-145: the narration is a query container (`.strip-narration`: what is left of the strip beside the transport, which never gives way) around ONE flow
     * (`.strip-narration-flow`: the phase, the sentence, the chips) that the CSS lays out again when that width is too small for the three side by side. */
    const narrationBox = document.createElement("div");
    narrationBox.className = "strip-narration";
    const narrationHost = document.createElement("div");
    narrationHost.className = "strip-narration-flow";
    narrationBox.appendChild(narrationHost);
    const controlsHost = document.createElement("div");
    controlsHost.className = "strip-controls";
    if (strip) {
      strip.body.className = "panel-body strip-body";
      strip.body.append(narrationBox, controlsHost);
    }
    const block = layoutF ? document.createElement("div") : null;
    if (block) block.className = "trace-block";
    const heat = createPanel("heat", "trace-panel area-heat", ctx.i18n.t(cbPage ? "panel.profile_matrix" : "panel.submatrix")); // WP-176: the content page's table is films x terms
    const heatHead = /** @type {HTMLElement} */ (heat.box.querySelector("h3"));
    heatTabs = framed ? buildHeatTabs(heat.box) : null; // WP-105
    const second = secondTabFor(engine); // WP-152 / WP-154: "factors" (MF), "network" (neural), null (the other pages: no tabs)
    // WP-245: the feature page's Network is the second tab of the FLOWCHART panel (built below, once that panel exists); its sub-matrix panel shows the matrix alone
    const featureLayout = dnnFeatures();
    panelFirst = featureLayout ? "flow" : "matrix";
    panelTabs = second && !featureLayout ? buildPanelTabs(heat.box, second) : null;
    sideTab = "matrix"; // WP-244
    sideManual = null;
    sideNode = null;
    sideHas = false;
    valuesHas = false; // WP-248
    valuesRef = null;
    sideTabs = featureLayout ? buildSideTabs(heat.box) : null;
    cbTabs = cbPage ? buildCbTabs(heat.box, heat.body) : null; // WP-176 (stage 2)
    hybTabs = hybPage ? buildHybridTabs(heat.box, heat.body) : null; // WP-222
    layoutMethod = hybPage ? hybMethod() : engine === "dnn" ? dnnLayout() : cbLayout(); // WP-222b: the hybrid page's layout is its method's too (the switching walk's strip is not the weighted walk's); WP-245: and the neural page's is its architecture's
    cbTableStrip = cbPage ? buildCbTableTabs() : null; // WP-176 (stage 3)
    cbTable = cbTablesFor(cbMethod())[0]; // WP-195c: the model's strip opens on its own first table
    cbTableManual = null;
    cbTablesHave = [];
    cbTableRef = null;
    cbFrame = null;
    // WP-117: the (i) of the grid's mean / median / std group sits in the panel head, OUTSIDE the grid's scroll box: its bubble is a
    // pseudo-element and the box (overflow: auto) would clip it. Empty - and hidden by CSS - until a trace with that group is shown.
    const heatInfo = document.createElement("span");
    heatInfo.className = "heat-info-slot";
    heat.box.querySelector(".panel-head")?.appendChild(heatInfo);
    // WP-152 (was WP-122's panel head): the factor tab's frame chips, the target's value and the (i) stand in the same head, next to the matrix tab's group; each group
    // shows only on its own tab (the matrix tab's is hidden by `.is-covered` in trace.css), so the two are never on the head together. WP-154: the network tab's group is
    // the size group (- / +) and the (i)
    const secondHead = document.createElement("span");
    secondHead.className = second === "network" ? "network-head-slot" : "factor-head-slot";
    secondHead.hidden = true;
    if (panelTabs) heat.box.querySelector(".panel-head")?.appendChild(secondHead);
    // WP-107 (e2): on the framed pages the flowchart and the candidate table are two panels in ONE column (`flowCol`, the grid's flow
    // area); the other pages keep the flowchart as the grid item and the table as a panel of its own
    const flow = createPanel("flow", layoutF ? "trace-panel flow-panel" : "trace-panel area-flow", ctx.i18n.t("panel.flowchart"));
    if (second && featureLayout) {
      // WP-245: Flowchart | Network - the diagram is as tall as the right column (the table steps aside while it shows) and as wide as the flowchart (467 px)
      panelTabs = buildPanelTabs(flow.box, second, "flow");
      flow.box.querySelector(".panel-head")?.appendChild(secondHead);
    }
    const formula = createPanel("formula", "trace-panel area-formula", ctx.i18n.t("panel.formula"));
    /**
     * WP-107 (g / g2): a panel's size group, - / + at the right of its head (a head is not redrawn by a step, so the group stays put);
     * one choice per panel and page. The CSS variable on the panel does the sizing; the flowchart and the table also tell the divider.
     * @param {"formula" | "code" | "flow" | "table" | "network"} panelName
     * @param {HTMLElement} box the panel
     * @param {HTMLElement | null} host the head to put the group in (null: the caller places it)
     * @param {(zoom: number) => void} [onChange]
     */
    const zoomGroup = (panelName, box, host, onChange) =>
      createZoomControl(host, {
        i18n: ctx.i18n,
        panel: panelName,
        page: layoutScope(engine), // WP-115 (13): ucf and icf share one choice per panel
        target: box,
        cssVar: `--${panelName}-zoom`,
        storage: browserStorage(),
        onChange,
      });
    if (layoutF) zoomGroup("formula", formula.box, /** @type {HTMLElement} */ (formula.box.querySelector(".panel-head")));
    if (second === "network" && panelTabs) {
      // WP-154: the network tab's head group, like the other panels' (the size group at the head, nothing moves with a step): the size (`--network-zoom` on the tab's body turns the
      // diagram's pixel size - its text is 10.5 / 9 px at 1.0x) and the (i) that says how to read the diagram
      zoomGroup("network", panelTabs.body, secondHead);
      // WP-231: on the feature-combination page the guide opens with what the network is (the sidebar row's tooltip, nav.tip_combine_dnn); the other architectures' guide is untouched
      const tipHost = document.createElement("span");
      tipHost.style.display = "contents"; // WP-231: the holder adds no box to the head
      /** @type {boolean | null} */
      let tipFeatures = null;
      const paintNetworkTip = () => { // WP-231
        tipFeatures = dnnFeatures();
        // WP-243: the feature page's guide is the lecture's story of this network (one network, what each part adds, how to read the diagram, the comparison and the curve, likely questions); the plain page keeps the NeuMF-centred guide
        tipHost.replaceChildren(richInfoTip(tipFeatures ? ctx.i18n.t("trace.dnn_features_guide") : ctx.i18n.t("mf.network_info"), ctx.i18n.t("mf.network_info_label"))); // WP-168c: headings, lists and an inner scroll (the plain bubble ran past the window)
      };
      paintNetworkTip();
      secondHead.appendChild(tipHost); // WP-231
      repaintNetworkTip = () => { // WP-231: the guide follows the route's `arch`
        if (tipFeatures !== dnnFeatures()) paintNetworkTip();
      };
    }
    sigTip = null;
    if (framed || cbPage) {
      // WP-108 (b): significance weighting is explained where it happens: the (i) beside the Formula title, on its steps only. It keeps
      // its place (hidden, not removed) on the others, so the head never changes with a step.
      // WP-186: the content page has its own weighting node and sig step too (Parameters -> sw), but `framed` is the user- / item-based pages only: it had no (i). Its text is the content-based
      // one - the count is the number of terms the two films share, not co-rated items (`formula.sig_weight_info_text_cb`).
      const head = /** @type {HTMLElement} */ (formula.box.querySelector(".panel-head"));
      const sigText = cbPage ? "formula.sig_weight_info_text_cb" : "formula.sig_weight_info_text";
      sigTip = infoTip(ctx.i18n.t(sigText), ctx.i18n.t("formula.sig_weight_info_label"), ctx.i18n.t("formula.sig_weight_info_title"));
      sigTip.style.visibility = "hidden";
      head.querySelector("h3")?.after(sigTip);
    }
    if (layoutF) {
      // the chart is an svg: a new factor draws it again (the active node stays in view) and moves the divider's default (the natural height)
      zoomGroup("flow", flow.box, /** @type {HTMLElement} */ (flow.box.querySelector(".panel-head")), (z) => {
        flowZoomValue = z;
        flowchartRef?.relayout();
        flowSplit?.refresh();
      });
    }
    const code = createPanel("code", "trace-panel area-code", ctx.i18n.t("panel.code"));
    // WP-158: the size group of the Code panel also sizes its second tab, the training curve (its text: `curveRef.setScale` redraws it); the Formula panel's sizes the latent space (css)
    if (layoutF) zoomGroup("code", code.box, /** @type {HTMLElement} */ (code.box.querySelector(".panel-head")), () => curveRef?.setScale());
    const table = createPanel("table", "trace-panel area-table");
    // the table redraws its title row with every trace: the group is made once and handed over (`headExtra`)
    tableZoomEl = layoutF
      ? zoomGroup("table", table.box, null, (z) => {
          tableZoomValue = z;
          flowSplit?.refresh(); // a row is taller or shorter: the five rows the default keeps need another height
        }).element
      : null;
    const flowCol = layoutF ? document.createElement("div") : null;
    if (flowCol) {
      flowCol.className = "flow-column area-flow";
      flowCol.append(flow.box, table.box);
    }
    // WP-46: the MF page adds the training curve and the latent-space scatter. WP-158: they are the second tabs of the Code and the Formula panel - the bodies are made here and
    // the tabs put them in their panels - no panels of their own under the block
    const curve = trained ? { body: lowerBody("curve-body") } : null;
    const embedding = trained ? { body: lowerBody("embedding-body") } : null;
    lowerShown = { formula: "formula", code: "code" };
    lowerManual = { formula: null, code: null };
    lowerNode = null;
    lowerOff = { latent: false, curve: false };
    curveRef = null;
    lowerTabs = curve && embedding ? { formula: buildLowerTabs(formula.box, "formula", embedding.body), code: buildLowerTabs(code.box, "code", curve.body) } : null;
    // WP-47: the architecture diagram of the neural model. WP-154: it is the second tab of the sub-matrix panel (`panelTabs`, above), no panel of its own
    // WP-122 / WP-152: the MF page's factor matrices (P, Q^T, biases, the predicted matrix) are the second tab of the sub-matrix panel (`panelTabs`, above), no panel of their own
    // WP-42: the pair table exists for ucf (user pairs) and icf (item pairs). WP-45: cb has no
    // pair-similarity table at all - content similarity is not part of the rating-based catalogue
    // that table shows (docs/teaching-invariants.md §11), so it is simply not created. WP-105: it is no panel of its own any
    // more - the framed (ucf / icf) pages, the only ones that have it, show it as the sub-matrix panel's third tab
    // (buildHeatTabs), so nothing is created here.
    if (block && strip) block.append(heat.box, flowCol ?? flow.box, formula.box, code.box);
    if (block) {
      // WP-107 (h2): a draggable divider between the Formula and Code panels; 60 : 40 until the reader moves it (kept per page)
      createSplitter({
        axis: "x",
        before: formula.box,
        after: code.box,
        range: () => ({ min: 30, max: 80, def: 60 }),
        apply: (pct) => {
          block.style.setProperty("--fc-formula", `${pct}fr`);
          block.style.setProperty("--fc-code", `${100 - pct}fr`);
        },
        storage: browserStorage(),
        storageKey: splitKey("fc", engine), // WP-115 (13): `i2rs.split.fc.cf` on both pages
        label: ctx.i18n.t("panel.split_fc"),
        hint: ctx.i18n.t("panel.split_fc_hint"),
      });
    }
    if (flowCol) {
      // WP-107 (e2): a draggable horizontal divider between the flowchart and the candidate table. Until the reader moves it the
      // flowchart gets its NATURAL height, capped so that the table keeps FIVE rows (the cap is what the table needs, measured); the
      // limits are a flowchart of at least 200 px and a table of at least three rows. A taller chart scrolls inside (and follows the
      // active node, flowchart.js `follow`). The share is the flowchart's part of the column minus the 12 px gap.
      const GAP = 12;
      const rowHeight = () => 25 * tableZoomValue; // a table row, px (measured at 1.0x: the compact table; the reader's factor scales it)
      /**
       * the table panel's height without its rows: the frame, the body's padding, everything in the body but the scrolling wrap (the
       * title row, the "N more rows not shown" note - with their margins) and the head row. The head row is taken at its tallest
       * (two lines, 34 px): before the rows are revealed the columns are as wide as their heads, which then do not wrap (21 px), and
       * the share must not depend on which step the page happens to be on.
       */
      const tableChrome = () => {
        const headEl = table.body.querySelector("thead");
        if (!headEl) return 80; // the table is not built yet: what it measures to be
        const style = getComputedStyle(table.body);
        let others = 0;
        for (const child of Array.from(table.body.children)) {
          if (child.classList.contains("table-wrap")) continue;
          const childStyle = getComputedStyle(child);
          others += child.getBoundingClientRect().height + (parseFloat(childStyle.marginTop) || 0) + (parseFloat(childStyle.marginBottom) || 0);
        }
        return 2 + parseFloat(style.paddingTop) + parseFloat(style.paddingBottom) + others + Math.max(34, headEl.getBoundingClientRect().height);
      };
      /** the flowchart panel as tall as its chart is drawn: head + body padding + the svg + the panel's border */
      const naturalFlow = () => {
        const svg = flow.body.querySelector("svg");
        if (!svg) return 0;
        const style = getComputedStyle(flow.body);
        const headEl = flow.box.querySelector(".panel-head");
        return (
          (headEl ? headEl.getBoundingClientRect().height : 40) +
          parseFloat(style.paddingTop) +
          parseFloat(style.paddingBottom) +
          svg.getBoundingClientRect().height +
          2
        );
      };
      flowSplit = createSplitter({
        axis: "y",
        before: flow.box,
        after: table.box,
        range: () => {
          const room = flowCol.clientHeight - GAP;
          if (!(room > 0)) return { min: 20, max: 80, def: 60 };
          const chrome = tableChrome();
          const min = (200 / room) * 100;
          const max = Math.max(min, ((room - (chrome + 3 * rowHeight())) / room) * 100);
          const natural = naturalFlow();
          const want = natural > 0 ? Math.min(natural, room - (chrome + 5 * rowHeight())) : room * 0.6;
          return { min, max, def: Math.min(max, Math.max(min, (want / room) * 100)) };
        },
        apply: (pct) => flowCol.style.setProperty("--flow-share", String(pct / 100)),
        storage: browserStorage(),
        storageKey: splitKey("flow", engine), // WP-115 (13)
        label: ctx.i18n.t("panel.split_flow"),
        hint: ctx.i18n.t("panel.split_flow_hint"),
      });
      // the column changes size with the window / presenting mode: the default follows (a chosen share stays inside the limits)
      flowObserver?.disconnect();
      if (typeof ResizeObserver !== "undefined") {
        flowObserver = new ResizeObserver(() => flowSplit?.refresh());
        flowObserver.observe(flowCol);
      }
    }
    grid.append(
      ...(block && strip ? [strip.box, block] : []),
      ...(narration && controls ? [narration.box, controls.box, heat.box, flow.box, formula.box, code.box] : []),
      ...(table && !flowCol ? [table.box] : [])
    );
    // WP-140: the strip sits between the summary bar and the trace panels; the look (placeholders, a faded trace) goes on the panels' grid and the summary bar
    // WP-161: the held-out chip beside the title belongs to the trace on screen too: it fades with it while that trace is stale or the previous pair's
    traceLoading = createTraceLoading({ i18n: ctx.i18n, infoTip, host: { grid, summary, extra: () => [els.random?.querySelector('[data-role="held-out"]')] }, progress: (id) => ctx.api.progress(id) }); // WP-191: the strip reads the request's progress record
    largeWarning = createLargeTraceWarning({ i18n: ctx.i18n }); // WP-146: under the Parameters panel, above the trace: a trace that waits for the person's word
    wrap.append(head, selection, params.box, largeWarning.el, summary, traceLoading.el, grid);
    root.appendChild(wrap);
    els = {
      title,
      summary,
      user: userBox.body,
      item: itemBox.body,
      itemBox: itemBox.box, // WP-141: hidden in the top-K task
      tableBox: table.box, // WP-141: hidden when the top-K trace has no table for it
      ...(flowCol ? { flowCol } : {}),
      random: randomBox.body,
      params: params.body,
      paramActions,
      narration: strip ? narrationHost : /** @type {HTMLElement} */ (narration).body,
      controls: strip ? controlsHost : /** @type {HTMLElement} */ (controls).body,
      ...(strip ? { strip: strip.box } : {}),
      heat: heat.body,
      heatInfo, // WP-117
      ...(sideTabs ? { side: sideTabs.body, values: sideTabs.valuesBody } : {}), // WP-244: the Side inputs tab's body; WP-248: and the Values tab's
      flow: flow.body,
      formula: formula.body,
      code: code.body,
      table: table.body,
      ...(curve ? { curve: curve.body } : {}),
      ...(embedding ? { embedding: embedding.body } : {}),
      ...(panelTabs ? { [panelTabs.second]: panelTabs.body, secondHead } : {}), // WP-122; WP-152 / WP-154: the second tab's body (`factors` | `network`) and its head group
      heatHead,
    };
  }

  /**
   * WP-141 / WP-141a: the server's word on the tasks and the route's choice. The switch (components/task-switch.js, in the title row) is drawn on every page once the
   * server reports its tasks per engine (a server that reports none draws no switch, the page stays what it was); its top-K choice is live only where the engine offers
   * it, else a placeholder with its reason. A choice navigates (the trace is a new request: `step` goes, every other parameter stays); leaving top-K drops `k` and `cand`
   * (they mean nothing to a prediction). The pressed choice follows the route, and the film selector goes while the task is top-K.
   * @param {any} meta `/api/meta`
   * @param {"predict" | "topk"} current
   */
  function syncTask(meta, current) {
    task = current;
    taskSwitch?.sync({ ...taskSwitchFor(meta, engine), task });
    if (els.itemBox) els.itemBox.hidden = task === "topk";
  }

  /**
   * WP-105: the sub-matrix panel's head becomes a tab strip - "Co-rated sub-matrix" | "All similarities for this pair" | "Films
   * of this pair" (iCF: "... item pair" | "Users of this item pair") - and one more body per extra tab: the pair table and the
   * film sets. The matrix body (`.panel-body`, the heat grid's root) stays where it is and is only covered (invisible, inert)
   * while another tab shows - the other bodies lie over it - so the panel's size never changes with the tab.
   * @param {HTMLElement} box the heat panel
   */
  function buildHeatTabs(box) {
    const { i18n } = ctx;
    const head = /** @type {HTMLElement} */ (box.querySelector(".panel-head"));
    head.classList.add("heat-tabs-head");
    const strip = document.createElement("div");
    strip.className = "heat-tabs";
    strip.setAttribute("role", "tablist");
    /** @param {string} key @param {string} label */
    const tab = (key, label) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "heat-tab";
      b.dataset.tab = key;
      b.setAttribute("role", "tab");
      b.setAttribute("aria-selected", "false");
      b.textContent = label;
      b.addEventListener("click", () => {
        if (b.getAttribute("aria-disabled") !== "true") setHeatTab(key);
      });
      return b;
    };
    const icf = engine === "icf";
    const matrix = tab("matrix", i18n.t("panel.submatrix"));
    const sims = tab("sims", i18n.t(icf ? "pairsim.title_item" : "pairsim.title"));
    const films = tab("films", i18n.t(icf ? "pairraters.title" : "pairfilms.title"));
    for (const b of [sims, films]) {
      b.setAttribute("aria-disabled", "true"); // until the trace has a pair (a neighbour / a candidate item) to show
      b.title = i18n.t(icf ? "panel.tab_pair_item_hint" : "panel.tab_pair_hint");
    }
    // WP-115 (1): the data first (the film sets of the pair), then the similarities computed from it; the order is the tab order, the arrow-key order and the focus order
    const order = [matrix, films, sims];
    strip.append(...order);
    strip.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      const usable = order.filter((b) => b.getAttribute("aria-disabled") !== "true");
      const at = usable.findIndex((b) => b === document.activeElement);
      if (at < 0) return;
      const next = usable[Math.min(usable.length - 1, Math.max(0, at + (e.key === "ArrowRight" ? 1 : -1)))];
      e.preventDefault();
      e.stopPropagation(); // WP-152a: the arrow keys step the player (a button is no text field): on the tab strip they move between the tabs only
      setHeatTab(next.dataset.tab ?? "matrix");
      next.focus();
    });
    head.replaceChildren(strip);
    /** @param {string} name @returns {{body: HTMLElement, host: HTMLElement}} */
    const overlay = (name) => {
      const body = document.createElement("div");
      body.className = `panel-body ${name}-body`;
      body.hidden = true;
      const host = document.createElement("div");
      host.className = `${name}-host`;
      body.appendChild(host);
      box.appendChild(body);
      return { body, host };
    };
    const simsOverlay = overlay("sims");
    const filmsOverlay = overlay("films");
    matrix.classList.add("active");
    matrix.setAttribute("aria-selected", "true");
    return {
      buttons: { matrix, sims, films },
      simsBody: simsOverlay.body,
      simsHost: simsOverlay.host,
      filmsBody: filmsOverlay.body,
      filmsHost: filmsOverlay.host,
    };
  }

  /**
   * WP-105: show the matrix, the pair table or the film sets in the sub-matrix panel; the last two need a pair.
   * @param {string} name "matrix" | "sims" | "films"
   */
  function setHeatTab(name) {
    if (!heatTabs) return;
    const tab = (name === "sims" || name === "films") && pairState ? name : "matrix";
    heatTab = tab;
    for (const [key, btn] of Object.entries(heatTabs.buttons)) {
      btn.classList.toggle("active", key === tab);
      btn.setAttribute("aria-selected", String(key === tab));
      btn.tabIndex = key === tab ? 0 : -1;
    }
    // the matrix body stays in the layout (it gives the panel its height) and is only covered - see trace.css `.is-covered`
    els.heat.classList.toggle("is-covered", tab !== "matrix");
    els.heat.inert = tab !== "matrix";
    heatTabs.simsBody.hidden = tab !== "sims";
    heatTabs.filmsBody.hidden = tab !== "films";
    if (pairPanel) pairPanel.setActive(tab === "sims"); // the pair table is asked for only while its tab is the one on screen
    if (tab === "films") showFilms();
  }

  /** WP-105: ask the film sets of the chosen pair - once per pair, and only while the tab is the one on screen */
  function showFilms() {
    if (!pairFilms || !pairState) return;
    const key = JSON.stringify(pairState);
    if (key === filmsKey) return;
    filmsKey = key;
    pairFilms.show(pairState);
  }

  /**
   * WP-105: the pair panel tells which pair it shows (a neighbour chosen, changed from the URL, or none). The two pair tabs
   * are enabled only with a pair, the open one follows a change, and the matrix comes back when the pair goes away. (The pair
   * table follows by itself: it is the pair panel's own.)
   * @param {{dataset: string, a: number, b: number} | null} pair
   */
  function onPair(pair) {
    pairState = pair;
    if (heatTabs) {
      for (const b of [heatTabs.buttons.sims, heatTabs.buttons.films]) {
        b.setAttribute("aria-disabled", String(!pair));
        b.title = pair ? "" : ctx.i18n.t(engine === "icf" ? "panel.tab_pair_item_hint" : "panel.tab_pair_hint");
      }
    }
    if (!pair) {
      filmsKey = null;
      if (pairFilms) pairFilms.clear();
      if (heatTab !== "matrix") setHeatTab("matrix");
    } else if (heatTab === "films") {
      showFilms();
    }
  }

  /**
   * WP-152: the MF page's sub-matrix panel head becomes a tab strip - "Co-rated sub-matrix" (the Ranked list in the top-K task, the Gram matrix of EASE: the label follows
   * the trace) | "Factor matrices" - and the factor panel's body lies over the matrix body like the pair tabs' bodies of the uCF / iCF pages (`.factors-body`, trace.css /
   * mf.css): the matrix body stays in the layout (covered, inert) so the panel never changes its size with the tab. Which tab is open is the player's call
   * (`applyPanelTab`); a click on a tab is the reader's. WP-154: the same for the neural page, the second tab being the "Network" diagram (`.network-body`).
   * @param {HTMLElement} box the heat panel (WP-245: the flowchart panel on the feature page)
   * @param {"factors" | "network"} second the page's second tab
   * @param {"matrix" | "flow"} [first] WP-245: the strip's first tab - the matrix, or the flowchart on the feature page
   * @returns {{buttons: Record<string, HTMLButtonElement>, body: HTMLElement, second: "factors" | "network", first: "matrix" | "flow", box: HTMLElement}}
   */
  function buildPanelTabs(box, second, first = "matrix") { // WP-245
    const { i18n } = ctx;
    const head = /** @type {HTMLElement} */ (box.querySelector(".panel-head"));
    head.classList.add("heat-tabs-head");
    box.classList.add("has-panel-tabs");
    const strip = document.createElement("div");
    strip.className = "heat-tabs";
    strip.setAttribute("role", "tablist");
    /** @param {"matrix" | "factors" | "network" | "flow"} key @param {string} label */ // WP-245
    const tab = (key, label) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "heat-tab";
      b.dataset.tab = key;
      b.setAttribute("role", "tab");
      b.setAttribute("aria-selected", "false");
      b.textContent = label;
      b.addEventListener("click", () => {
        if (b.getAttribute("aria-disabled") !== "true") chooseTab(key);
      });
      return b;
    };
    const matrix = tab(first, i18n.t(first === "flow" ? "panel.flowchart" : "panel.submatrix")); // WP-245: the first tab (named `matrix` below for the history of the code) is the flowchart on the feature page
    const other = tab(second, i18n.t(`panel.${second}`));
    strip.append(matrix, other);
    strip.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      const usable = [matrix, other].filter((b) => b.getAttribute("aria-disabled") !== "true" && !b.hidden);
      const at = usable.findIndex((b) => b === document.activeElement);
      if (at < 0) return;
      const next = usable[Math.min(usable.length - 1, Math.max(0, at + (e.key === "ArrowRight" ? 1 : -1)))];
      e.preventDefault();
      e.stopPropagation(); // the arrow keys step the player (a button is no text field): on the tab strip they move between the tabs only
      chooseTab(/** @type {"matrix" | "factors" | "network" | "flow"} */ (next.dataset.tab)); // WP-245
      next.focus();
    });
    head.replaceChildren(strip);
    const body = document.createElement("div");
    body.className = `panel-body ${second}-body`;
    body.hidden = true;
    box.appendChild(body);
    matrix.classList.add("active");
    matrix.setAttribute("aria-selected", "true");
    return { buttons: { [first]: matrix, [second]: other }, body, second, first, box }; // WP-245
  }

  /**
   * WP-152: put a tab on screen: the pressed tab, the covered matrix body (inert, still in the layout), the second tab's body and its head group.
   * @param {import("../util/panel-tab.js").PanelTab} tab
   */
  function showPanelTab(tab) {
    if (!panelTabs) return;
    panelTab = tab;
    for (const [key, btn] of Object.entries(panelTabs.buttons)) {
      btn.classList.toggle("active", key === tab);
      btn.setAttribute("aria-selected", String(key === tab));
      btn.tabIndex = key === tab ? 0 : -1;
    }
    if (panelTabs.first === "flow") {
      // WP-245: the feature page: while the Network shows, the flowchart's body is out of the way and the right column gives the diagram its whole height (the epoch table steps aside, trace.css
      // `.net-open`); the flowchart is drawn again when it comes back (its box has a new height)
      const network = tab === panelTabs.second;
      panelTabs.box.classList.toggle("net-open", network);
      els.flowCol?.classList.toggle("net-open", network);
      els.flow.hidden = network;
      if (!network) flowchartRef?.relayout();
    } else {
      els.heat.classList.toggle("is-covered", tab !== "matrix"); // the matrix body keeps its place (and so the panel its height); trace.css hides the matrix tab's head group with it
      els.heat.inert = tab !== "matrix";
    }
    panelTabs.body.hidden = tab !== panelTabs.second;
    els.secondHead.hidden = tab !== panelTabs.second;
  }

  /**
   * WP-152: the reader's click on a tab. It holds until the walk leaves the node it was made on (`nextPanelTab`); the choice goes to the URL (`panel`).
   * @param {import("../util/panel-tab.js").PanelTab} tab
   */
  function chooseTab(tab) {
    manualTab = { tab, node: panelNode };
    showPanelTab(tab);
    ctx.router.replace(pageId, { ...routeParams, ds: dataset, panel: panelParam(tab) });
  }

  /**
   * WP-244: the feature page's sub-matrix panel head becomes a tab strip - "Co-rated sub-matrix" | "Side inputs" - and the side inputs' body lies over the matrix body like every other second tab's
   * (`.side-body`, trace.css): the matrix body stays in the layout (covered, inert), so the panel never changes its size with the tab. Which tab is open is the player's call (util/side-tab.js); a click
   * on a tab is the reader's and holds until the walk leaves the node it was made on. WP-248: a third tab, "Values", with a body of its own over the matrix body (`.values-body`, trace.css).
   * @param {HTMLElement} box the heat panel
   * @returns {{buttons: Record<string, HTMLButtonElement>, body: HTMLElement, valuesBody: HTMLElement}}
   */
  function buildSideTabs(box) {
    const { i18n } = ctx;
    const head = /** @type {HTMLElement} */ (box.querySelector(".panel-head"));
    head.classList.add("heat-tabs-head");
    box.classList.add("has-panel-tabs");
    const strip = document.createElement("div");
    strip.className = "heat-tabs";
    strip.setAttribute("role", "tablist");
    /** @param {"matrix" | "side" | "values"} key @param {string} label */
    const tab = (key, label) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "heat-tab";
      b.dataset.tab = key;
      b.setAttribute("role", "tab");
      b.setAttribute("aria-selected", "false");
      b.textContent = label;
      b.addEventListener("click", () => {
        if (!b.hidden) chooseSideTab(key);
      });
      return b;
    };
    const matrix = tab("matrix", i18n.t("panel.submatrix"));
    const side = tab("side", i18n.t("panel.side_inputs"));
    side.hidden = true;
    const values = tab("values", i18n.t("panel.values")); // WP-248
    values.hidden = true;
    strip.append(matrix, side, values);
    strip.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      const usable = [matrix, side, values].filter((b) => !b.hidden);
      const at = usable.findIndex((b) => b === document.activeElement);
      if (at < 0) return;
      const next = usable[Math.min(usable.length - 1, Math.max(0, at + (e.key === "ArrowRight" ? 1 : -1)))];
      e.preventDefault();
      e.stopPropagation(); // the arrow keys step the player: on the tab strip they move between the tabs only
      chooseSideTab(/** @type {"matrix" | "side" | "values"} */ (next.dataset.tab));
      next.focus();
    });
    head.replaceChildren(strip);
    const body = document.createElement("div");
    body.className = "panel-body side-body";
    body.hidden = true;
    box.appendChild(body);
    const valuesBody = document.createElement("div"); // WP-248
    valuesBody.className = "panel-body values-body";
    valuesBody.hidden = true;
    box.appendChild(valuesBody);
    matrix.classList.add("active");
    matrix.setAttribute("aria-selected", "true");
    return { buttons: { matrix, side, values }, body, valuesBody };
  }

  /** WP-244: put a tab of the sub-matrix panel's strip on screen (the pressed tab, the covered matrix body, the side inputs' body). @param {import("../util/side-tab.js").SideTab} tab */
  function showSideTab(tab) {
    if (!sideTabs) return;
    sideTab = tab;
    for (const [key, btn] of Object.entries(sideTabs.buttons)) {
      btn.classList.toggle("active", key === tab);
      btn.setAttribute("aria-selected", String(key === tab));
      btn.tabIndex = key === tab ? 0 : -1;
    }
    els.heat.classList.toggle("is-covered", tab !== "matrix"); // the matrix body keeps its place (and so the panel its height); trace.css hides the matrix tab's head group with it
    els.heat.inert = tab !== "matrix";
    sideTabs.body.hidden = tab !== "side";
    sideTabs.valuesBody.hidden = tab !== "values"; // WP-248
    if (tab === "values") valuesRef?.shown(); // WP-248: the lit row may be out of the body's view
  }

  /** WP-244: the reader's click on a tab of that strip: it holds until the walk leaves the node it was made on; the choice goes to the URL (`hbox`). @param {import("../util/side-tab.js").SideTab} tab */
  function chooseSideTab(tab) {
    sideManual = { tab, node: sideNode };
    showSideTab(tab);
    ctx.router.replace(pageId, { ...routeParams, ds: dataset, hbox: tab });
  }

  /**
   * WP-176 (stage 2): the content page's sub-matrix panel head becomes a tab strip, per method (util/cb-tabs.js): "Profile matrix | TF-IDF" (item similarity) or "Taste profile | TF-IDF"
   * (user profile). The matrix tab is the panel's own body, kept in the layout and covered while another tab shows (the panel never changes its size with the tab: trace.css
   * `.has-panel-tabs`); every other tab is a body that lies over it (`.tfidf-body`, `.profile-body`) with a head group of its own - the (i) of the tab, shown only while the tab is. The
   * profile method has no matrix tab: its matrix body stays covered for good. Which tab is open is the player's call (`cbDrivenTab`); a click on a tab is the reader's.
   * @param {HTMLElement} box the heat panel
   * @param {HTMLElement} base the panel's own body (the matrix grid's root)
   */
  function buildCbTabs(box, base) {
    const { i18n } = ctx;
    const tabs = cbTabsFor(cbMethod(), cbKind()); // WP-199: the small network has a fourth tab (the diagram)
    // WP-216: the model page draws the network tab for BOTH kinds and hides it for the regression (`showNetworkTab`): the tab follows the form's choice of kind at once, before Apply
    // (the route, and with it `tabs`, only changes at Apply); `tabs` stays the list of the tabs on screen, changed in place
    const built = cbMethod() === "model" ? cbTabsFor("model", "mlp") : tabs;
    const head = /** @type {HTMLElement} */ (box.querySelector(".panel-head"));
    head.classList.add("heat-tabs-head");
    box.classList.add("has-panel-tabs");
    const strip = document.createElement("div");
    strip.className = "heat-tabs";
    strip.setAttribute("role", "tablist");
    // WP-195c: the per-user model's panel is `Profile matrix | Weights | Fit`: its `profile` tab is the learned WEIGHTS (the profile view of the trace: the weights over the film's terms), and
    // its tab (i)s are its own (`trace.cb_model_weights_info` / `trace.cb_model_fit_info`)
    const model = cbMethod() === "model";
    /** @type {Record<string, string>} */
    const labelKey = { matrix: "panel.profile_matrix", profile: model ? "panel.model_weights" : "panel.profile", tfidf: "panel.tfidf", features: "panel.features", fit: "panel.model_fit", network: "panel.model_network" };
    /** @param {string} key @returns {string} the stem of the tab's (i) keys */
    const network = cbKind() === "mlp"; // WP-195c stage 2: the small network has its own (i) texts
    const infoStem = (key) => (key === "fit" ? (network ? "model_mlp_fit" : "model_fit") : key === "profile" && model ? (network ? "model_mlp_weights" : "model_weights") : key === "network" ? "model_network" : key);
    /** @type {Record<string, HTMLButtonElement>} */
    const buttons = {};
    for (const key of built) {
      const b = document.createElement("button");
      b.type = "button";
      b.hidden = !tabs.includes(key); // WP-216: the network tab of a regression page is built and hidden
      b.className = "heat-tab";
      b.dataset.tab = key;
      b.setAttribute("role", "tab");
      b.setAttribute("aria-selected", "false");
      b.textContent = i18n.t(labelKey[key]);
      if (model && key === "profile") b.title = i18n.t(network ? "panel.model_effects_tip" : "panel.model_weights_tip"); // WP-195c: the one number a reader remembers - a film of unseen terms scores exactly the user's mean (the network: what an effect is)
      b.addEventListener("click", () => chooseCbTab(key));
      buttons[key] = b;
      strip.appendChild(b);
    }
    strip.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      const list = tabs.map((key) => buttons[key]);
      const at = list.findIndex((b) => b === document.activeElement);
      if (at < 0) return;
      const next = list[Math.min(list.length - 1, Math.max(0, at + (e.key === "ArrowRight" ? 1 : -1)))];
      e.preventDefault();
      e.stopPropagation(); // the arrow keys step the player (a button is no text field): on the tab strip they move between the tabs only
      chooseCbTab(/** @type {import("../util/cb-tabs.js").CbTab} */ (next.dataset.tab));
      next.focus();
    });
    head.replaceChildren(strip);
    // WP-176 (stage 4): in the top-K task the panel shows the ranked list and none of the tabs: the strip gives way to a title in a tab's look and the (i) of the whole view
    const title = document.createElement("span");
    title.className = "heat-tab active heat-tab-static";
    title.textContent = i18n.t("panel.ranked");
    title.hidden = true;
    head.appendChild(title);
    /** @type {Record<string, HTMLElement>} */
    const bodies = {};
    /** @type {Record<string, HTMLElement>} */
    const heads = {};
    /** @type {Record<string, HTMLElement>} */
    const hosts = {};
    /** @type {HTMLElement | null} */
    let idle = null;
    /** @type {HTMLElement | null} */
    let featuresIdle = null;
    for (const key of built) {
      if (key === "matrix") continue;
      const body = document.createElement("div");
      body.className = `panel-body ${key}-body`;
      body.hidden = true;
      box.appendChild(body);
      bodies[key] = body;
      const group = document.createElement("span");
      group.className = "profile-head-slot";
      group.hidden = true;
      group.appendChild(richInfoTip(i18n.t(`trace.cb_${infoStem(key)}_info`), i18n.t(`trace.cb_${infoStem(key)}_info_label`))); // WP-168c: headings, lists and an inner scroll
      head.appendChild(group);
      heads[key] = group;
      if (key === "tfidf") {
        hosts.tfidf = document.createElement("div");
        hosts.tfidf.className = "tfidf-table-host";
        body.appendChild(hosts.tfidf);
      } else if (key === "features") {
        // WP-176 (stage 3): the supervised feature selection - the scores of every term of the user's films, sorted by the engine; a pair whose scores are undefined (too few liked or
        // disliked films) says why instead, in the step's own sentence
        featuresIdle = document.createElement("p");
        featuresIdle.className = "heat-note";
        featuresIdle.hidden = true;
        hosts.features = document.createElement("div");
        hosts.features.className = "features-table-host";
        body.append(featuresIdle, hosts.features);
      } else if (key === "network") {
        // WP-199: the small network's diagram (components/network-panel.js, the neural page's own panel): the tab's body IS its root, as on that page (`.network-body`: a column with the scroll box and the footer)
        hosts.network = body;
        // WP-216: until a trace has trained the network the tab says what to do (the panel's drawing replaces it when the trace arrives; a regression trace never draws here)
        const networkIdle = document.createElement("p");
        networkIdle.className = "heat-note";
        networkIdle.textContent = i18n.t("panel.model_network_idle");
        body.appendChild(networkIdle);
      } else if (key === "fit") {
        // WP-195c: the fit summary of the per-user model (components/cb-fit.js fills it at the trace's reset)
        hosts.fit = document.createElement("div");
        hosts.fit.className = "fit-host";
        body.appendChild(hosts.fit);
      } else {
        // the taste profile: the profile view on top, the table that explains its score under it; a pair with no profile says why instead (WP-195c: on the model, the learned weights
        // and the `weights` table under them; a user with nothing else rated has no model)
        idle = document.createElement("p");
        idle.className = "heat-note";
        idle.textContent = i18n.t(model ? "panel.model_weights_idle" : "panel.profile_idle");
        idle.hidden = true;
        hosts.profileGrid = document.createElement("div");
        hosts.profileGrid.className = "profile-grid-host";
        hosts.profileTable = document.createElement("div");
        hosts.profileTable.className = "profile-table-host";
        body.append(idle, hosts.profileGrid, hosts.profileTable);
      }
    }
    const topkGroup = document.createElement("span");
    topkGroup.className = "profile-head-slot";
    topkGroup.hidden = true;
    topkGroup.appendChild(richInfoTip(i18n.t("trace.cb_topk_info"), i18n.t("trace.cb_topk_info_label"))); // WP-168c: headings, lists and an inner scroll
    head.appendChild(topkGroup);
    buttons[tabs[0]].classList.add("active");
    buttons[tabs[0]].setAttribute("aria-selected", "true");
    if (tabs[0] !== "matrix") {
      base.classList.add("is-covered");
      base.inert = true;
      bodies[tabs[0]].hidden = false;
      heads[tabs[0]].hidden = false;
    }
    cbTab = tabs[0];
    return { tabs, buttons, bodies, heads, hosts, base, idle, featuresIdle, strip, title, topkGroup };
  }

  /**
   * WP-216: the per-user model's kind chosen in the form (before Apply) shows or hides the Network tab: "Small neural network" brings it at once - its body says "Apply to train the
   * user's network" until a trace has - and "Ridge regression" takes it away. `tabs` is changed in place (the keyboard walk along the strip, `cbDrivenTab` and the `panel` parameter all
   * read the same list); the open tab stays unless it is the one that goes - then the Fit tab (the network's neighbour) opens, as a click on it would.
   * @param {boolean} on
   */
  function showNetworkTab(on) {
    const network = cbTabs?.buttons.network;
    if (!cbTabs || !network) return; // not the model page
    const at = cbTabs.tabs.indexOf("network");
    if (on === (at >= 0)) return;
    if (on) cbTabs.tabs.push("network");
    else cbTabs.tabs.splice(at, 1);
    network.hidden = !on;
    if (!on && cbTab === "network") chooseCbTab("fit");
    if (!on && cbManual?.tab === "network") cbManual = null; // a hold on a tab that is gone
  }

  /**
   * WP-176 (stage 4): the heat panel of the content page in the top-K task. The ranked list fills the panel's own body and there are no tabs (a top-K trace has no profile matrix, no
   * TF-IDF table and no feature scores): the strip gives way to a title and the (i) of the top-K view, the other bodies are hidden and the own body is the one on screen. In the
   * prediction task everything is as the tabs left it (the listener of the tabs puts the method's first tab on screen at the trace's reset).
   * @param {boolean} on
   */
  function setCbTopkHead(on) {
    if (!cbTabs) return;
    cbTabs.strip.hidden = on;
    cbTabs.title.hidden = !on;
    cbTabs.topkGroup.hidden = !on;
    if (!on) return;
    for (const group of Object.values(cbTabs.heads)) group.hidden = true;
    for (const body of Object.values(cbTabs.bodies)) body.hidden = true;
    cbTabs.base.classList.remove("is-covered");
    cbTabs.base.inert = false;
  }

  /**
   * WP-176 (stage 2): put a tab on screen: the pressed tab, the covered matrix body (inert, still in the layout), the open tab's body and its head group.
   * @param {import("../util/cb-tabs.js").CbTab} tab
   */
  function showCbTab(tab) {
    if (!cbTabs) return;
    cbTab = tab;
    for (const [key, btn] of Object.entries(cbTabs.buttons)) {
      btn.classList.toggle("active", key === tab);
      btn.setAttribute("aria-selected", String(key === tab));
      btn.tabIndex = key === tab ? 0 : -1;
    }
    cbTabs.base.classList.toggle("is-covered", tab !== "matrix"); // the matrix body keeps its place (and so the panel its height)
    cbTabs.base.inert = tab !== "matrix";
    for (const [key, body] of Object.entries(cbTabs.bodies)) body.hidden = key !== tab;
    for (const [key, group] of Object.entries(cbTabs.heads)) group.hidden = key !== tab;
    if (tab === "fit") cbFitRef?.resize(); // WP-195c stage 2: the network's curve, drawn while its tab was closed, has no size: it takes the box's now
  }

  /**
   * WP-176 (stage 2): the reader's click on a tab. It holds until the walk leaves the node it was made on (`nextPanelTab`); the choice goes to the URL (`panel`).
   * @param {import("../util/cb-tabs.js").CbTab} tab
   */
  function chooseCbTab(tab) {
    if (cbTabs?.buttons[tab]?.getAttribute("aria-disabled") === "true") return; // a tab with nothing to show (the feature selection is switched off)
    cbManual = { tab, node: cbNode };
    showCbTab(tab);
    ctx.router.replace(pageId, { ...routeParams, ds: dataset, panel: tab });
  }

  /** WP-222: how many question / answer pairs `hybrid.walk.tip.<tab>` holds (`guide`, `q1` / `a1` ...) - the (i) of each tab, read the way the overview's section guides are */
  const HYBRID_TAB_QUESTIONS = { bases: 3, weights: 4, blend: 3 };

  /** WP-235 / WP-235a: the paragraphs that open a tab's (i) before its guide (`hybrid.walk.tip.<tab>.<name>`): what the gradient steps do, what the weights are learned from, why the curve flattens | what the blend applies */
  const HYBRID_TAB_LEADS = /** @type {Record<string, string[]>} */ ({ weights: ["lead", "learns", "flat"], blend: ["lead"] });

  /**
   * WP-222: the weighted hybrid's sub-matrix panel head becomes a tab strip - "Bases | Weights | Blend" - and each tab is a body that lies over the panel's own (covered for good: this page has
   * no sub-matrix) with a head group of its own, the tab's (i), shown only while the tab is. Bases: the base recommenders' table over the held-out entries; Weights: the trajectory curve over its
   * table; Blend: the weights against what the bases say about the target (the profile view) over the contributions table. Which tab is open is the player's call (`hybridDrivenTab`); a click on a
   * tab is the reader's. The panel keeps its size with every tab (trace.css `.has-panel-tabs`, hybrid.css `.hybrid-body`).
   * WP-222b: the switching walk's strip is "Bases | Leaderboard | Answer" (util/hybrid-tabs.js `hybridTabsFor`): Bases as above; Leaderboard: the bars of every base's two errors
   * (components/hybrid-board.js) over the leaderboard table; Answer: what each base says about the target and which one answers. Its tab labels are `tabs.hybrid_switch_*` and its (i) texts
   * the walk's own guides (`trace.hybrid_info_switch_*`, written with the engine).
   * @param {HTMLElement} box the heat panel
   * @param {HTMLElement} base the panel's own body (the sub-matrix grid's root, never shown here)
   */
  function buildHybridTabs(box, base) {
    const { i18n } = ctx;
    const switching = hybMethod() === "switching"; // WP-222b
    const tabs = hybridTabsFor(hybMethod()); // WP-222b
    const head = /** @type {HTMLElement} */ (box.querySelector(".panel-head"));
    head.classList.add("heat-tabs-head");
    box.classList.add("has-panel-tabs");
    const strip = document.createElement("div");
    strip.className = "heat-tabs";
    strip.setAttribute("role", "tablist");
    /** @type {Record<string, HTMLButtonElement>} */
    const buttons = {};
    for (const key of tabs) { // WP-222b
      const b = document.createElement("button");
      b.type = "button";
      b.className = "heat-tab";
      b.dataset.tab = key;
      b.setAttribute("role", "tab");
      b.setAttribute("aria-selected", "false");
      b.textContent = i18n.t(switching ? `tabs.hybrid_switch_${key}` : `tabs.hybrid_${key}`);
      b.title = i18n.t(switching ? `tabs.hybrid_switch_${key}_tip` : `tabs.hybrid_${key}_tip`); // WP-222b
      b.addEventListener("click", () => chooseHybridTab(key));
      buttons[key] = b;
      strip.appendChild(b);
    }
    strip.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      const list = tabs.map((key) => buttons[key]); // WP-222b
      const at = list.findIndex((b) => b === document.activeElement);
      if (at < 0) return;
      const next = list[Math.min(list.length - 1, Math.max(0, at + (e.key === "ArrowRight" ? 1 : -1)))];
      e.preventDefault();
      e.stopPropagation(); // the arrow keys step the player (a button is no text field): on the tab strip they move between the tabs only
      chooseHybridTab(/** @type {import("../util/hybrid-tabs.js").HybridTab} */ (next.dataset.tab));
      next.focus();
    });
    head.replaceChildren(strip);
    /** @type {Record<string, HTMLElement>} */
    const bodies = {};
    /** @type {Record<string, HTMLElement>} */
    const heads = {};
    /** @type {Record<string, HTMLElement>} */
    const hosts = {};
    /** one host of a tab's body: a table, the curve or the profile grid; `hybrid-host` lets the stylesheet share the room between the two of a tab @param {HTMLElement} body @param {string} id */
    const host = (body, id) => {
      const el = document.createElement("div");
      el.className = `hybrid-host hybrid-host-${id}`;
      el.dataset.host = id;
      body.appendChild(el);
      hosts[id] = el;
      return el;
    };
    /**
     * WP-233 / WP-235: the bridge sentence of the first tab - what the bases are - in the tab's head beside its (i): the strip's empty middle, two lines at most (the whole sentence is the hover text).
     * @param {string} textKey
     * @param {number} [lines] how many lines of the 40 px head the sentence may take (the weighted walk's fits two; the switching walk's, with its tabs' strip, three in a smaller type: hybrid.css)
     */
    const bridgeSpan = (textKey, lines = 2) => {
      const bridge = document.createElement("span");
      bridge.className = "hybrid-bridge";
      bridge.dataset.lines = String(lines);
      bridge.dataset.key = textKey; // WP-239: which sentence is on (the switching walk's follows its rule)
      bridge.textContent = i18n.t(textKey);
      bridge.title = bridge.textContent; // the whole sentence, should a narrow panel cut it at two lines
      return bridge;
    };
    // WP-239: the switching walk's bridge names the bases of its rule: the bucket's four, or the neighbour rule's two (the collaborative base and the content base); the rule is the route's
    const switchBridgeKey = () => (routeParams.sr === "neighbours" ? "hybrid.walk.switch.bridge_rule" : "hybrid.walk.switch.bridge");
    /** the first tab's (i): what the method is, the bridge, then the tab's guide @param {string} key */
    const switchGuide = (key) => (key === tabs[0] ? `${i18n.t("nav.tip_combine_switching")}\n\n${i18n.t(switchBridgeKey())}\n\n` : "") + i18n.t(`trace.hybrid_info_switch_${key}`);
    /** @type {HTMLElement | null} */
    let switchBridgeEl = null;
    /** @type {HTMLElement | null} */
    let switchInfoEl = null;
    /** WP-239: the rule changed (Apply keeps the page): the bridge sentence in the head and the (i) that repeats it follow */
    const repaintBridge = () => {
      if (!switchBridgeEl || !switchInfoEl || switchBridgeEl.dataset.key === switchBridgeKey()) return;
      switchBridgeEl.dataset.key = switchBridgeKey();
      switchBridgeEl.textContent = i18n.t(switchBridgeKey());
      switchBridgeEl.title = switchBridgeEl.textContent;
      const fresh = richInfoTip(switchGuide(tabs[0]), i18n.t(`trace.hybrid_info_switch_${tabs[0]}_label`));
      switchInfoEl.replaceWith(fresh);
      switchInfoEl = fresh;
    };
    for (const key of tabs) { // WP-222b
      const body = document.createElement("div");
      body.className = `panel-body hybrid-body hybrid-${key}-body`;
      body.hidden = true;
      box.appendChild(body);
      bodies[key] = body;
      const group = document.createElement("span");
      group.className = "profile-head-slot";
      group.hidden = true;
      if (switching) {
        // WP-222b: the switching walk's guides are whole texts (a guide, "How to present it", "If asked"), one per tab, written with the engine
        // WP-231: the first tab's guide opens with what the method is (the sidebar row's tooltip, nav.tip_combine_switching)
        // WP-235: and the switching walk's own bridge sentence (the same four bases, but a rule picks one of them), in the head beside the (i) as on the weighted walk
        if (key === tabs[0]) {
          switchBridgeEl = bridgeSpan(switchBridgeKey(), 3); // WP-239: the neighbour rule's sentence names its two bases, not "the same four"
          group.appendChild(switchBridgeEl);
        }
        const info = richInfoTip(switchGuide(key), i18n.t(`trace.hybrid_info_switch_${key}_label`));
        if (key === tabs[0]) switchInfoEl = info;
        group.appendChild(info);
      } else {
        // WP-231: the first tab's guide opens with what the method is (the sidebar row's tooltip, nav.tip_combine_weighted)
        // WP-233: and the bridge sentence right after it (the Bases tab is the first); the same sentence opens the tab itself, in its head beside the (i) - the strip's empty middle, so the tab's two tables keep their room
        // WP-235: the Weights and Blend guides open with one sentence on what the tab does (`hybrid.walk.tip.<tab>.lead`), before the guide
        const lead = (HYBRID_TAB_LEADS[key] ?? []).flatMap((name) => [i18n.t(`hybrid.walk.tip.${key}.${name}`), ""]); // WP-235a: more than one paragraph
        const lines = [...(key === tabs[0] ? [i18n.t("nav.tip_combine_weighted"), "", i18n.t("hybrid.walk.bridge"), ""] : []), ...lead, `## ${i18n.t("hybrid.tip.head_guide")}`, i18n.t(`hybrid.walk.tip.${key}.guide`), `## ${i18n.t("hybrid.tip.head_questions")}`];
        for (let n = 1; n <= HYBRID_TAB_QUESTIONS[key]; n++) lines.push(`- **${i18n.t(`hybrid.walk.tip.${key}.q${n}`)}** ${i18n.t(`hybrid.walk.tip.${key}.a${n}`)}`);
        if (key === tabs[0]) group.appendChild(bridgeSpan("hybrid.walk.bridge")); // WP-233: the bridge sentence in the first tab's head, beside its (i); WP-235: the same helper for both walks
        group.appendChild(richInfoTip(lines.join("\n"), i18n.t("hybrid.tip.label")));
      }
      head.appendChild(group);
      hosts[`head_${key}`] = group;
    }
    if (switching) {
      // WP-222b: the switching walk's tabs' contents: Bases = the bases table over the held-out table; Leaderboard = the bars over the leaderboard table; Answer = the answers table
      host(bodies.bases, "bases");
      host(bodies.bases, "heldout");
      host(bodies.board, "board");
      host(bodies.board, "leaderboard");
      host(bodies.answer, "answers");
    } else {
      // the tabs' contents: Bases = the bases table over the held-out table; Weights = the curve over the trajectory table; Blend = the weights profile over the contributions table
      host(bodies.bases, "bases");
      host(bodies.bases, "heldout");
      host(bodies.weights, "curve");
      host(bodies.weights, "trajectory");
      host(bodies.blend, "blendline"); // WP-235: the blend of the target film with its numbers, over the weights grid
      host(bodies.blend, "profile");
      host(bodies.blend, "contributions");
    }
    base.classList.add("is-covered"); // the panel's own body keeps its place (and so the panel its height) and is never shown: there is no sub-matrix on this page
    base.inert = true;
    buttons.bases.classList.add("active");
    buttons.bases.setAttribute("aria-selected", "true");
    bodies.bases.hidden = false;
    hosts.head_bases.hidden = false;
    hybTab = "bases";
    return { buttons, bodies, hosts, base, tabs, repaintBridge }; // WP-222b; WP-239: repaintBridge
  }

  /**
   * WP-222: put a tab of the weighted hybrid's panel on screen: the pressed tab, the open tab's body and its head group.
   * @param {import("../util/hybrid-tabs.js").HybridTab} tab
   */
  function showHybridTab(tab) {
    if (!hybTabs) return;
    hybTab = tab;
    for (const [key, btn] of Object.entries(hybTabs.buttons)) {
      btn.classList.toggle("active", key === tab);
      btn.setAttribute("aria-selected", String(key === tab));
      btn.tabIndex = key === tab ? 0 : -1;
    }
    for (const key of hybTabs.tabs) { // WP-222b: the strip on screen (the weighted walk's or the switching walk's)
      hybTabs.bodies[key].hidden = key !== tab;
      hybTabs.hosts[`head_${key}`].hidden = key !== tab;
    }
    if (tab === "weights") hybCurveRef?.resize(); // a chart drawn while its tab was closed has no size: it takes the box's now
    if (tab === "blend") hybProfileRef?.remeasure(); // WP-235: so does the weights grid's label column (it measured nothing while the tab was closed: the labels were cut at 72 px)
  }

  /**
   * WP-222: the reader's click on a tab of the weighted hybrid's panel. It holds until the walk leaves the node it was made on (`nextPanelTab`); the choice goes to the URL (`panel`).
   * @param {import("../util/hybrid-tabs.js").HybridTab} tab
   */
  function chooseHybridTab(tab) {
    hybManual = { tab, node: hybNode };
    showHybridTab(tab);
    ctx.router.replace(pageId, { ...routeParams, ds: dataset, panel: tab });
  }

  /**
   * WP-176 (stage 3): the strip of the lower-right table panel, in the title row of the table (it takes the title's place; each tab's hover sentence is the table's own title). The
   * tabs are the content page's three similarity-walk tables (util/cb-tabs.js `CB_TABLES`); a trace that lacks one hides its tab (`reset` of the listener).
   * @returns {{strip: HTMLElement, buttons: Record<string, HTMLButtonElement>}}
   */
  function buildCbTableTabs() {
    const { i18n } = ctx;
    const strip = document.createElement("div");
    strip.className = "table-tabs";
    strip.setAttribute("role", "tablist");
    /** @type {Record<string, HTMLButtonElement>} */
    const buttons = {};
    const tables = cbTablesFor(cbMethod()); // WP-195c: the per-user model's strip is Films | Contributions
    // the per-user model's `contributions` table is not the item method's "Per field" one (what each term adds to the prediction, not what each field adds to a similarity)
    const labelOf = (/** @type {string} */ id) => (cbMethod() === "model" && id === "contributions" ? "panel.cb_table_model_contributions" : `panel.cb_table_${id}`);
    const tipOf = (/** @type {string} */ id) => (cbMethod() === "model" && id === "contributions" ? "table.model_contributions" : `table.${id}`);
    for (const id of tables) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "table-tab";
      b.dataset.table = id;
      b.setAttribute("role", "tab");
      b.setAttribute("aria-selected", "false");
      b.textContent = i18n.t(labelOf(id));
      b.title = i18n.t(tipOf(id));
      b.addEventListener("click", () => chooseCbTable(id));
      buttons[id] = b;
      strip.appendChild(b);
    }
    strip.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      const list = tables.map((id) => buttons[id]).filter((b) => !b.hidden);
      const at = list.findIndex((b) => b === document.activeElement);
      if (at < 0) return;
      const next = list[Math.min(list.length - 1, Math.max(0, at + (e.key === "ArrowRight" ? 1 : -1)))];
      e.preventDefault();
      e.stopPropagation(); // the arrow keys step the player: on the strip they move between the tables only
      chooseCbTable(/** @type {import("../util/cb-tabs.js").CbTable} */ (next.dataset.table));
      next.focus();
    });
    return { strip, buttons };
  }

  /**
   * WP-176 (stage 3): put a table on screen in the lower-right panel: the pressed tab, and the data table drawn for it at the step on screen.
   * @param {import("../util/cb-tabs.js").CbTable} id
   * @param {any} [frame] the step to bring the table to (default: the one on screen)
   */
  function showCbTable(id, frame) {
    cbTable = id;
    if (cbTableStrip) {
      for (const [key, btn] of Object.entries(cbTableStrip.buttons)) {
        btn.classList.toggle("active", key === id);
        btn.setAttribute("aria-selected", String(key === id));
        btn.tabIndex = key === id ? 0 : -1;
      }
    }
    cbTableRef?.setTable(id, frame ?? cbFrame);
  }

  /**
   * WP-176 (stage 3): the reader's click on a table tab. It holds until the walk leaves the node it was made on (`nextPanelTab`); the choice goes to the URL (`tbl`).
   * @param {import("../util/cb-tabs.js").CbTable} id
   */
  function chooseCbTable(id) {
    if (!cbTablesHave.includes(id)) return;
    cbTableManual = { tab: id, node: cbNode };
    showCbTable(id);
    ctx.router.replace(pageId, { ...routeParams, ds: dataset, tbl: id });
  }

  /**
   * WP-158: a body for a lower box's second tab (hidden until its tab is open).
   * @param {string} cls "curve-body" | "embedding-body"
   * @returns {HTMLElement}
   */
  function lowerBody(cls) {
    const body = document.createElement("div");
    body.className = `panel-body ${cls}`;
    return body;
  }

  /**
   * WP-158: one lower panel's head becomes a tab strip - the Formula panel's "Formula" | "Latent space (2-D)", the Code panel's "Code" | "Training curve" - with the second tab's body
   * in the panel under the first. Only the title is replaced: the size group stays in the head and serves both tabs. The head is the sub-matrix panel's tab head (40 px,
   * `.heat-tabs-head`), so the two lower boxes' strips look like the strip above them. The panels have a fixed height (the block's grid), so a tab never changes their size.
   * @param {HTMLElement} box the panel (`.area-formula` | `.area-code`)
   * @param {"formula" | "code"} side
   * @param {HTMLElement} body the second tab's body
   * @returns {LowerBox}
   */
  function buildLowerTabs(box, side, body) {
    const { i18n } = ctx;
    const { first, second } = LOWER_BOXES[side];
    const head = /** @type {HTMLElement} */ (box.querySelector(".panel-head"));
    head.classList.add("heat-tabs-head");
    box.classList.add("has-lower-tabs");
    const strip = document.createElement("div");
    strip.className = "heat-tabs";
    strip.setAttribute("role", "tablist");
    /** @param {string} key @param {string} label */
    const tab = (key, label) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "heat-tab";
      b.dataset.tab = key;
      b.setAttribute("role", "tab");
      b.setAttribute("aria-selected", "false");
      b.textContent = label;
      b.addEventListener("click", () => {
        if (b.getAttribute("aria-disabled") !== "true") chooseLowerTab(side, /** @type {import("../util/panel-tab.js").LowerTab} */ (key));
      });
      return b;
    };
    const a = tab(first, i18n.t(`panel.${first}`));
    const b = tab(second, i18n.t(second === "latent" ? "panel.embedding" : "panel.curve"));
    strip.append(a, b);
    strip.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      const usable = [a, b].filter((x) => x.getAttribute("aria-disabled") !== "true");
      const at = usable.findIndex((x) => x === document.activeElement);
      if (at < 0) return;
      const next = usable[Math.min(usable.length - 1, Math.max(0, at + (e.key === "ArrowRight" ? 1 : -1)))];
      e.preventDefault();
      e.stopPropagation(); // the arrow keys step the player: on the tab strip they move between the tabs only (as on the sub-matrix panel)
      chooseLowerTab(side, /** @type {import("../util/panel-tab.js").LowerTab} */ (next.dataset.tab));
      next.focus();
    });
    head.querySelector("h3")?.replaceWith(strip);
    const firstBody = /** @type {HTMLElement} */ (box.querySelector(":scope > .panel-body"));
    body.hidden = true;
    box.appendChild(body);
    a.classList.add("active");
    a.setAttribute("aria-selected", "true");
    return { side, box, buttons: { [first]: a, [second]: b }, firstBody, body };
  }

  /**
   * WP-243: which tabs the loaded trace opens on (util/dnn-features.js: the feature page opens on its diagram and its training curve).
   * @param {any} trace
   * @param {boolean} topkMode
   */
  function openingFor(trace, topkMode) {
    return openingTabs({ engine, features: dnnFeatures(), topk: topkMode, hasNetwork: Boolean(trace.views?.network?.layers?.length), hasCurve: Boolean(trace.views?.curve?.x?.length) });
  }

  /**
   * WP-158: put a tab on screen in one lower box (the pressed tab, the open body).
   * @param {"formula" | "code"} side
   * @param {import("../util/panel-tab.js").LowerTab} tab
   */
  function showLowerTab(side, tab) {
    if (!lowerTabs) return;
    const lb = lowerTabs[side];
    const { second } = LOWER_BOXES[side];
    lowerShown[side] = tab;
    for (const [key, btn] of Object.entries(lb.buttons)) {
      btn.classList.toggle("active", key === tab);
      btn.setAttribute("aria-selected", String(key === tab));
      btn.tabIndex = key === tab ? 0 : -1;
    }
    lb.firstBody.hidden = tab === second;
    lb.body.hidden = tab !== second;
    if (tab === "curve") curveRef?.resize(); // a chart drawn while its tab was closed has no size: it takes the box's now
  }

  /**
   * WP-158: the reader's click on a lower box's tab. It holds until the walk leaves the node it was made on (`nextLowerTab`); the choice goes to the URL (`fbox` | `cbox`).
   * @param {"formula" | "code"} side
   * @param {import("../util/panel-tab.js").LowerTab} tab
   */
  function chooseLowerTab(side, tab) {
    lowerManual[side] = { tab, node: lowerNode };
    showLowerTab(side, tab);
    ctx.router.replace(pageId, { ...routeParams, ds: dataset, [LOWER_BOXES[side].param]: tab });
  }

  /**
   * WP-158: a trace without a training curve (a closed form) or a latent space has no such tab to open: it is greyed with the reason as its title and the box keeps its first tab
   * (the rule is told, `hasLatent` / `hasCurve`). In the top-K task the second tab is not offered at all (a ranking trace carries no curve and no latent space: measured, its `views`
   * hold the factor row at most) - the head is the box's single title, nothing greyed, as the neural page's sub-matrix panel has it there (WP-154).
   * @param {any} trace
   * @param {boolean} topkMode
   */
  function setLowerOff(trace, topkMode) {
    if (!lowerTabs) return;
    lowerOff = { latent: !trace.views?.embedding?.frames?.length, curve: !trace.views?.curve?.x?.length };
    for (const [side, key, reason] of /** @type {const} */ ([
      ["formula", "latent", "mf.no_embedding"],
      ["code", "curve", "mf.no_curve"],
    ])) {
      const btn = lowerTabs[side].buttons[key];
      btn.setAttribute("aria-disabled", String(lowerOff[key]));
      btn.hidden = lowerOff[key] && topkMode;
      btn.title = lowerOff[key] ? ctx.i18n.t(reason) : "";
    }
  }

  /** @param {Record<string, string | undefined>} patch */
  function navigateWith(patch) {
    const next = { ...routeParams, ...patch, ds: dataset };
    delete next.step;
    delete next.panel; // WP-152: the tab belongs to the step it was shown at; a new trace starts from the player's own choice
    delete next.fbox; // WP-158: and so do the two lower boxes' tabs
    delete next.cbox;
    delete next.hbox; // WP-244
    // WP-91: `nb` names a neighbour of THIS active user / target - another u or i makes it stale
    // (the new pair's candidates differ), a parameter Apply keeps it
    if ("u" in patch || "i" in patch) delete next.nb;
    // WP-166: a film named while the page is on the top-K task its route only implies (the random pick names one) would turn it into a prediction: the task is written in so many words
    if (patch.i !== undefined && patch.i !== "" && task === "topk" && routeParams.task !== "topk") next.task = "topk";
    ctx.router.navigate(pageId, next);
  }

  /**
   * WP-91: a dense-index route param (`nb`), null when absent or malformed.
   * @param {string | undefined} raw
   */
  function neighbourParam(raw) {
    return indexParam(raw);
  }

  /**
   * WP-91: the pair panel's neighbour dropdown -> the URL. `router.replace` (no history entry per
   * choice) and the CURRENT route params, so `step` and every config param survive; `nb` is not part
   * of the trace key (see `update`), so this never reloads the trace.
   * @param {number | null} index null drops `nb`
   */
  function writeNeighbour(index) {
    ctx.router.replace(pageId, { ...routeParams, ds: dataset, nb: index === null ? undefined : index });
  }

  /**
   * WP-132: the sub-matrix's `raw | centred` choice -> the URL (`vals` = c | r). View state like `nb` and `step`: `router.replace` (no history entry),
   * the CURRENT route params, and it is not part of the trace key (see `update`), so it never reloads the trace and never reaches the API.
   * @param {"raw" | "centred"} mode
   */
  function writeVals(mode) {
    ctx.router.replace(pageId, { ...routeParams, ds: dataset, vals: valsParam(mode) });
  }

  /**
   * WP-136: the statistic group's `ratings | Δ` choice -> the URL (`stats` = c | r). View state like `vals` and `nb`: `router.replace` (no history entry), the CURRENT route
   * params, and it is not part of the trace key (see `update`), so it never reloads the trace and never reaches the API; Apply and every step keep it.
   * @param {"raw" | "centred"} mode
   */
  function writeStats(mode) {
    ctx.router.replace(pageId, { ...routeParams, ds: dataset, stats: statsParam(mode) });
  }

  /**
   * WP-137a: the held-out reveal setting -> the URL (`reveal` = step | start). View state like `vals`: `router.replace`, the current route params, not part of the
   * trace key, never sent to the API; Apply and every step keep it.
   * @param {"step" | "start"} mode
   */
  function writeReveal(mode) {
    ctx.router.replace(pageId, { ...routeParams, ds: dataset, reveal: revealParam(mode) });
  }

  /**
   * WP-137a: the two-choice control of the setting (the app's segmented control, at the height of Apply / Defaults), with its caption. Both choices have a hover tip
   * that says what they do; the group says what the setting is. Built once; `syncReveal` marks the pressed choice.
   * @returns {HTMLElement}
   */
  function buildRevealSwitch() {
    const { i18n } = ctx;
    const wrap = document.createElement("span");
    wrap.className = "param-reveal";
    wrap.hidden = true;
    wrap.title = i18n.t("param_tip.reveal");
    const label = document.createElement("span");
    label.textContent = i18n.t("params.reveal");
    const seg = document.createElement("div");
    seg.className = "miniseg";
    seg.setAttribute("role", "group");
    seg.setAttribute("aria-label", i18n.t("params.reveal"));
    for (const mode of /** @type {const} */ (["step", "start"])) {
      const b = document.createElement("button");
      b.type = "button";
      b.dataset.value = mode;
      b.textContent = i18n.t(`params.reveal_${mode}`);
      b.title = i18n.t(`param_tip.reveal_${mode}`);
      b.addEventListener("click", (e) => {
        e.stopPropagation(); // in the panel head: a click is not a click on the head (it folds the panel)
        if (revealMode === mode) return;
        setRevealMode(mode);
        writeReveal(mode);
      });
      seg.appendChild(b);
    }
    wrap.append(label, seg);
    wrap.addEventListener("click", (e) => e.stopPropagation());
    return wrap;
  }

  /**
   * WP-137a: the setting changed (the switch, or an edited / back-forward URL): the grid, the summary bar and the picker chip follow, and the switch marks the choice.
   * @param {"step" | "start"} mode
   */
  function setRevealMode(mode) {
    revealMode = mode;
    heatRef?.setReveal(mode);
    syncReveal();
  }

  /** WP-137a: the setting is hidden-able now (the trace has a step that reveals the cell, the setting is "step", the step on screen is not that one). */
  const revealHidden = () => isHidden({ mode: revealMode, hasReveal: heldCell !== null, revealed: revealedNow });

  /**
   * WP-137a: write the summary bar's prediction-giving figures and the picker chip's rating as the setting says: a question mark (with a hover reason) while hidden, the
   * value otherwise; and mark the pressed choice of the switch. Called when the summary is drawn, on every frame that changes whether the cell is open, and when the
   * setting changes.
   */
  function syncReveal() {
    const { i18n } = ctx;
    const hide = revealHidden();
    const reason = i18n.t("param_tip.reveal_hidden");
    paintFigures(hideable, hide, reason);
    paintChip(/** @type {HTMLElement | null | undefined} */ (els.random?.querySelector('[data-role="held-out"]')), revealChip, hide, (k, p) => i18n.t(k, p), reason);
    if (revealWrap) {
      revealWrap.hidden = heldCell === null;
      for (const b of revealWrap.querySelectorAll("button")) {
        const on = b.dataset.value === revealMode;
        b.classList.toggle("active", on);
        b.setAttribute("aria-pressed", String(on));
      }
    }
  }

  /** @param {string | undefined} raw a route id param ("3") as a dense index, null when absent or malformed */
  function indexParam(raw) {
    if (raw === undefined || raw === "") return null;
    const n = Number(raw);
    return Number.isInteger(n) && n >= 0 ? n : null;
  }

  /**
   * WP-83c: a door from the Users / Items pages arrives with only `u` (uCF) or only `i` (iCF) in the
   * route. The trace needs both, so `loadTrace` - which is what normally fills the pickers - never
   * runs; show the entity in its picker here (and clear a picker whose id left the route). The
   * lookup is keyed by (dataset, u, i), so re-rendering the same route fetches nothing.
   */
  async function prefillPickers() {
    const u = indexParam(routeParams.u);
    const i = indexParam(routeParams.i);
    const key = JSON.stringify([dataset, u, i]);
    if (key === prefillKey) return;
    prefillKey = key;
    const [userInfo, itemInfo] = await Promise.all([
      u === null ? null : ctx.api.user(dataset, u).catch(() => null),
      i === null ? null : ctx.api.item(dataset, i).catch(() => null),
    ]);
    if (!mounted || key !== prefillKey) return; // the page was left, or the route moved on, meanwhile
    userPicker.update({ selected: userInfo });
    itemPicker.update({ selected: itemInfo });
  }

  /** @param {any} state */
  function ensurePickers(state) {
    const guards = state.meta?.pick_guards || {};
    if (!userPicker) {
      userPicker = createEntityPicker(els.user, {
        i18n: ctx.i18n,
        api: ctx.api,
        kind: "user",
        dataset,
        guards: {
          minRatings: Number(guards.min_user_ratings || 0),
          requireClass: !!guards.require_class_user,
          minRaters: 0,
          ratedByUser: false,
        },
        onSelect: (index) => navigateWith({ u: String(index) }),
      });
      // WP-153: the "rated by the user" chip opens ticked on the memory-based and the content pages, UNTICKED on the model pages (a film the user has not rated is answered by a
      // stored model at once; the chip, ticked on purpose, brings back the held-out refit, and its (i) says why); the random pick follows it, a film in the link (`i=`) always wins
      const ratedChip = ratedChipFor(engine);
      itemPicker = createEntityPicker(els.item, {
        i18n: ctx.i18n,
        api: ctx.api,
        kind: "item",
        dataset,
        ratedBy: routeParams.u !== undefined ? Number(routeParams.u) : null,
        guards: {
          minRatings: 0,
          requireClass: false,
          minRaters: Number(guards.min_item_raters || 0),
          ratedByUser: ratedChip.on,
        },
        ratedTip: ratedChip.tipKey ? { text: ctx.i18n.t(ratedChip.tipKey), label: ctx.i18n.t("picker.rated_by_user") } : null,
        onSelect: (index) => navigateWith({ i: String(index) }),
      });
      renderRandom(guards);
    } else {
      userPicker.update({ dataset });
      itemPicker.update({ dataset, ratedBy: routeParams.u !== undefined ? Number(routeParams.u) : null });
    }
  }

  /**
   * WP-243: the feature page, reached by the sidebar (no user, film or task in the route), opens on a pair instead of an empty form: the picker's own seeded draw (`DEFAULT_PICK_SEED`) with the
   * pickers' guards and the model pages' default chip (a film the user has not rated), so the walk, the diagram and the curve are there at once. Only while a STORED model matches the settings
   * in the route - a pair that would start a training run on opening is no opening - and once per mount. The route is replaced, so Back leaves the page; a failure leaves the page as it was.
   * @param {any} state
   */
  async function openOnDefaultPair(state) {
    defaultPairTried = true;
    const asked = dataset;
    try {
      const cfg = await loadConfig(ctx.api);
      if (!mounted || asked !== dataset) return;
      engineDefaults = defaultsFor(cfg) ?? engineDefaults;
      await refreshModels();
      if (!mounted || asked !== dataset || !modelStateNow().match) return;
      const guards = state.meta?.pick_guards || {};
      const res = await ctx.api.pick(dataset, {
        user_query: "",
        item_query: "",
        seed: DEFAULT_PICK_SEED,
        min_user_ratings: Number(guards.min_user_ratings || 0),
        min_item_raters: Number(guards.min_item_raters || 0),
        require_class_user: !!guards.require_class_user,
        rated: "no",
      });
      if (!mounted || asked !== dataset || routeParams.u !== undefined || routeParams.i !== undefined) return; // the reader chose meanwhile
      ctx.router.replace(pageId, { ...routeParams, ds: dataset, u: String(res.user.index), i: String(res.item.index) });
    } catch {
      /* the pickers are there: an opening that fails is the empty page it used to be */
    }
  }

  /** @param {any} guards */
  function renderRandom(guards) {
    const { i18n, api } = ctx;
    els.random.innerHTML = "";
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn btn-primary btn-sm";
    btn.textContent = `🎲 ${i18n.t("picker.random")}`;
    const seedEl = document.createElement("span");
    seedEl.className = "sub random-seed";
    seedNode = seedEl; // WP-203: what it says is the seed of an ordinary pick or the walk-through's counter (paintPickText)
    seedText = "";
    const heldOut = document.createElement("div");
    heldOut.className = "held-out";
    heldOut.dataset.role = "held-out";
    // WP-104: one line - the held-out rating on the left, the seed (small, faint: it only makes a pick repeatable) and
    // the button on the right
    if (cbPage) {
      // WP-192: the content-based page has the switch "Saved walks only". WP-196: a disk icon on this same line, before the button (the button keeps the box's right edge it always had; the box stays one line tall)
      // WP-203: the bubble of its inventory stands beside it (position: fixed, so it takes no room in the line); the walk-through goes on across a rebuild of the page (`walkCycle`)
      savedWalks = createSavedWalks({ i18n, api, page: pageId, onChange: syncSavedWalks, cycle: walkCycle });
      els.random.append(heldOut, seedEl, savedWalks.el, savedWalks.bubble, btn);
      randomBtn = btn;
      refreshSavedWalks();
    } else {
      els.random.append(heldOut, seedEl, btn);
    }
    /** @param {string} text the ordinary pick's seed text ("" clears it) */
    const showSeed = (text) => {
      seedText = text;
      paintPickText();
    };
    btn.addEventListener("click", async () => {
      if (btn.getAttribute("aria-disabled") === "true") return; // WP-192: the switch is on and nothing is saved for this page and task (the button says so in its title)
      const mine = ++pickSeq; // WP-97: a second click, or leaving the page, retires this pick
      const seed = Math.floor(Math.random() * 100000);
      if (savedWalks?.ticked()) {
        // WP-203: with the switch on the pick goes THROUGH the saved walks of the page and task (no seed): the next one, its form written into Parameters, its pair into the route
        const walk = await savedWalks.press();
        if (!mounted || mine !== pickSeq) return;
        walkCycle = savedWalks.cycle(); // before the route moves: a walk whose form changes the layout builds the page again, and the count must survive it
        if (!walk) {
          syncSavedWalks();
          return;
        }
        if (seedNode) {
          seedNode.textContent = walk.label; // at once: the route moves on the next tick, and the update that follows it derives the same counter from the route
          seedNode.classList.add("is-counter");
        }
        navigateWith(walk.patch);
        return;
      }
      showSeed(i18n.t("picker.picking"));
      const ug = userPicker.guards();
      const ig = itemPicker.guards();
      try {
        const res = await api.pick(dataset, {
          user_query: userPicker.query(),
          item_query: itemPicker.query(),
          seed,
          min_user_ratings: ug.minRatings,
          min_item_raters: ig.minRaters,
          require_class_user: ug.requireClass,
          // WP-112: the chip works both ways - ticked: only films the user rated, unticked: only films they did NOT rate
          rated: ig.ratedByUser ? "yes" : "no",
        });
        if (!mounted || mine !== pickSeq) return; // WP-97: never navigate on an answer nobody waits for
        showSeed(i18n.t("picker.seed", { seed }));
        for (const note of res.notes || []) showToast(i18n.t(note));
        navigateWith({ u: String(res.user.index), i: String(res.item.index) });
      } catch (err) {
        if (!mounted || mine !== pickSeq) return; // WP-97
        showSeed("");
        showToast(errorText(err), "error");
      }
    });
    void guards;
  }

  /** WP-203: the form and the pair the page shows, as the saved walks read them (the eight route parameters, whether any parameter the saved forms cannot name is set, the pair's dense indices) @returns {import("../util/saved-walks.js").FormRoute} */
  function formRoute() {
    return { params: routeForm(routeParams), extras: routeHasExtras(routeParams), u: indexParam(routeParams.u), i: indexParam(routeParams.i) };
  }

  /**
   * WP-192: tell the saved walks where the page stands. WP-203: two questions, each asked once per distinct question: the inventory of every form with saved walks (dataset, task and method - the
   * form itself is not part of it) and the exact one for the form on screen (dataset, task, method and the form's own route parameters).
   */
  function refreshSavedWalks() {
    if (!savedWalks || !dataset) return;
    const method = cbMethod() ?? "item";
    savedWalks.refresh({
      task,
      key: `${dataset}|${task}|${method}`, // the walk-through belongs to this page, task and method
      route: formRoute(),
      forms: savedFormsQuery({ dataset, engine, task, method }),
      exact: savedWalksQuery({ dataset, engine, task, method, params: routeParams }),
    });
    syncSavedWalks();
  }

  /**
   * WP-203: what the switch's state says on the page - Random pick is aria-disabled (still focusable, like the Parameters' Apply) only when nothing at all is saved for this page and task, and its
   * title says why (or that one walk is all there is, or what the press does); the span beside the icon reads the counter; the Parameters head carries the note "form loaded from saved walk"
   * while the form on screen is the one a press wrote.
   */
  function syncSavedWalks() {
    if (!randomBtn || !savedWalks) return;
    walkCycle = savedWalks.cycle(); // the page keeps it across a rebuild
    const none = savedWalks.blocked();
    randomBtn.setAttribute("aria-disabled", String(none));
    const state = !savedWalks.ticked() ? "" : none ? "picker.saved_none" : !savedWalks.loaded() ? "" : savedWalks.count() === 1 ? "picker.saved_one" : "picker.saved_next";
    randomBtn.title = state ? ctx.i18n.t(state) : "";
    paintPickText();
    syncFormNote();
  }

  /** WP-203: the span beside the icon: the walk-through's counter while the switch is on and the page shows the walk the last press opened, otherwise the ordinary pick's seed */
  function paintPickText() {
    if (!seedNode) return;
    const counter = savedWalks?.ticked() ? savedWalks.counter() : "";
    seedNode.textContent = savedWalks?.ticked() ? counter : seedText;
    seedNode.classList.toggle("is-counter", counter !== "");
    const cycle = savedWalks?.cycle();
    seedNode.title = counter && cycle ? ctx.i18n.t("picker.saved_count_title", { n: cycle.cursor + 1, count: cycle.count }) : "";
  }

  /** WP-203: the note in the Parameters head: "form loaded from saved walk" while the form on screen is the one a press wrote into the page (it goes with an Apply that changes the form) */
  function syncFormNote() {
    if (!paramForm || !savedWalks) return;
    const note = savedWalks.loadedNote();
    paramForm.setNote(note ? { text: ctx.i18n.t("picker.saved_loaded"), title: ctx.i18n.t("picker.saved_loaded_title", { n: note.n, count: note.count }) } : null);
  }

  /**
   * WP-84: genres of a dataset (keys of /stats genre_counts), cached per dataset.
   * @param {string} ds
   * @returns {Promise<string[]>}
   */
  function genresFor(ds) {
    if (!genreCache[ds]) {
      genreCache[ds] = ctx.api
        .stats(ds)
        .then((/** @type {any} */ s) => Object.keys(s?.genre_counts || {}))
        .catch(() => []);
    }
    return genreCache[ds];
  }

  /**
   * @param {any} cfg
   * @param {Record<string, string>} params
   * @param {string[]} [genres] WP-84: item-filter vocabulary (empty while the flag is off)
   * @param {{min: number, max: number, step: number} | null} [scale] WP-110 (b''): the dataset's rating scale (the centre field's fallback)
   */
  function renderParams(cfg, params, genres = [], scale = null) {
    const key = JSON.stringify([
      params.sim,
      params.mc,
      params.k,
      params.sw,
      params.den,
      params.cs, // WP-110 (b)
      params.cz, // WP-110 (b'')
      params.clip,
      params.keepneg,
      params.ctr,
      params.pred,
      params.deg,
      // WP-84
      params.fg,
      params.fy,
      params.ms,
      params.ufc,
      params.ufn,
      params.cfg,
      params.cfy,
      task, // WP-141: the task and its two request parameters (`k` is in the list above)
      params.cand,
      params.model, // WP-146: the model's source (the "Model" row)
      pretrainedOffered({ features }, engine) ? "P" : "",
      features.attribute_filter ? "F" : "",
      genres.join("|"),
      scale ? [scale.min, scale.max, scale.step].join(":") : "", // WP-110 (b'')
      params.mst,
      params.f, // WP-176
      params.fw,
      params.tf,
      params.gw, // WP-203: the Gini box - a route that only drops or adds `gw` (a saved walk's form is written into the page) left the box as it was
      params.ma, // WP-195c: the per-user model's ridge penalty
      params.mk, // WP-195c stage 2: and its kind
      params.hyb,
      params.alpha,
      params.mcfn,
      // WP-222: the weighted hybrid's own keys (`mr` is already above: the model pages' min raters, the hybrid's min ratings)
      params.bases,
      params.w,
      params.hf,
      params.hc,
      params.wc,
      params.gs,
      params.gss,
      params.rl,
      params.fo,
      // WP-222b: the switching walk's own keys (the rule, the user's held-out share, the criterion, where the winner is picked, the rule's collaborative base and neighbour count)
      params.sr,
      params.sh,
      params.cr,
      params.so,
      params.cfb,
      params.mn,
      // WP-46
      params.alg,
      params.nf,
      params.lr,
      params.reg,
      params.bias,
      params.std,
      params.lam,
      params.bs,
      params.ein,
      params.mr,
      params.seed,
      params.ep,
      params.pat,
      params.vf,
      // WP-47
      params.arch,
      params.layers,
      params.drop,
      params.opt,
      params.wd,
      params.dev,
      // WP-223: the feature network's side inputs; WP-224: the per-user network's training controls (ep, pat, lr, vf, seed are above)
      params.groups,
      params.if,
      params.imt,
      params.il,
      params.ul,
      params.hid,
      params.es,
    ]);
    if (key === paramsKey) return;
    paramsKey = key;
    const defaults = defaultsFor(cfg);
    paramForm = createParamForm(els.params, {
      i18n: ctx.i18n,
      similarities: cfg.similarities,
      defaults: defaults || {},
      values: params,
      engine,
      method: cbMethod(), // WP-195c: the content page's method (the per-user model has a penalty field of its own)
      features, // WP-84
      genres, // WP-84
      scale, // WP-110 (b'')
      task, // WP-141
      modelSource: pretrainedOffered({ features }, engine), // WP-146: the "Model" row
      actionsHost: els.paramActions, // WP-109 (9)
      onApply: (patch) => navigateWith(patch),
      onKindChange: (kind) => showNetworkTab(kind === "mlp"), // WP-216: the model's kind chosen in the form shows / hides the Network tab at once
    });
    paramForm.setTargetRated(targetRated); // WP-109 (6): a rebuilt form starts from what the last trace said
    paramForm.setModelState(modelStateNow()); // WP-146: and from what the page knows of the stored models
    syncFormNote(); // WP-203: and from the note "form loaded from saved walk" when the form on screen is the one a press wrote
    dataTrace = null; // WP-242: the settings changed (the form was rebuilt): the Data row shows them until the new trace brings its counts
    dataRow ??= createDataRow(ctx.i18n);
    renderDataRow();
  }

  /**
   * WP-242: the Data row of the Parameters panel - first in the body (the forms clear and rebuild it), the words and numbers of util/data-row.js: the trace's own split numbers when one is on screen,
   * else the settings the page would send (the route's value over the engine's default). Hidden where the page or the task has no split to state (the top-K task has no target).
   */
  function renderDataRow() {
    if (!dataRow || !mounted) return;
    dataRow.attach(els.params);
    dataRow.set(
      dataRowFor({
        engine,
        method: engine === "hybrid" ? hybMethod() : engine === "cb" ? cbMethod() : null,
        task,
        trace: dataTrace,
        route: routeParams,
        defaults: engineDefaults,
        t: (key, params) => ctx.i18n.t(key, params),
      })
    );
  }

  /**
   * WP-146: what the "Model" row is told: the stored model fitted with the APPLIED settings (the route's, laid over the engine's defaults), whether the list of stored models has
   * arrived, and the source the trace on screen used.
   * @returns {{match: import("../util/model-source.js").ModelInfo | null, listKnown: boolean, last: import("../util/model-source.js").ModelMeta | null}}
   */
  function modelStateNow() {
    const config = configFromParams(configParams(engine, routeParams, task), features);
    return { match: matchModel(modelList, { kind: engine, defaults: engineDefaults, config }), listKnown: modelList !== null, last: lastModel };
  }

  /**
   * WP-146: what a "train anyway" covers for a route - this data set, this engine, these resolved settings (not the pair, the task or the model's source).
   * @param {Record<string, string>} params
   * @returns {string}
   */
  function confirmScopeOf(params) {
    return confirmScope({ engine, dataset, defaults: engineDefaults, config: configFromParams(configParams(engine, params, task), features) });
  }

  /** WP-146: the models fitted at home for the data set (cheap; asked again after every trace, so a model fitted - or deleted - since shows without a restart) */
  async function refreshModels() {
    if (!trained || !pretrainedOffered({ features }, engine) || !mounted) return;
    const asked = dataset;
    /** @type {any[] | null} */
    let next = null;
    try {
      const res = await ctx.api.models(asked);
      next = Array.isArray(res?.models) ? res.models : null;
    } catch {
      next = null; // the row then says nothing about stored models, and the server still decides at request time
    }
    if (!mounted || asked !== dataset) return;
    modelList = next;
    paramForm?.setModelState(modelStateNow());
  }

  /**
   * The engine's defaults in the shared config (WP-140: the parameter form's, and the loading strip's words when the route names no value).
   * @param {{algorithms: any}} cfg
   * @returns {Record<string, any> | undefined}
   */
  function defaultsFor(cfg) {
    return engine === "ucf"
      ? cfg.algorithms.knn
      : engine === "icf"
        ? cfg.algorithms.item_knn
        : engine === "cb"
          ? cfg.algorithms.cb
          : engine === "dnn"
            ? architectureDefaults(cfg.algorithms.dnn, routeParams.arch) // WP-47; WP-246: the architecture's own defaults (the feature network trains with its own recipe) laid over the generic block - the form, Defaults, the model match and the tips read them
            : engine === "hybrid"
              ? cfg.algorithms.hybrid // WP-222
              : cfg.algorithms.mf; // WP-46
  }

  /**
   * WP-140: the page title as soon as the user's and the film's names are here (~30 ms), not with the trace: the same sentence, in the same role colours, that `renderSummary` writes
   * when the trace arrives (the model's name is the route's choice or the engine's default, the trace's own `algorithm_label` is the same word). Without both names (a lookup that
   * failed) the title stays as it was.
   * @param {Record<string, string>} params
   * @param {boolean} topkMode
   * @param {any} user `/api/datasets/<d>/users/<u>`
   * @param {any} item `/api/datasets/<d>/items/<i>` (null in the top-K task)
   */
  function paintEarlyTitle(params, topkMode, user, item) {
    if (!user || (!topkMode && !item)) return;
    const { i18n } = ctx;
    const algorithm = algorithmName({ engine, params, defaults: engineDefaults, t: (k, p) => i18n.t(k, p) });
    els.title.replaceChildren(
      linkedText(
        (k, p) => i18n.t(k, p),
        topkMode ? topkTitleKey() : titleKey(),
        { user: user.label, item: item?.title, algorithm },
        { user: { profile_url: user.profile_url }, ...(topkMode ? {} : { item: { film_url: item?.film_url } }) },
        "profile_url",
        topkMode ? { user: "user" } : { user: "user", item: "item" }
      )
    );
  }

  /** @param {unknown} err */
  function errorText(err) {
    if (err && typeof err === "object" && "messageKey" in err) {
      return ctx.i18n.t(/** @type {any} */ (err).messageKey, /** @type {any} */ (err).params);
    }
    return err instanceof Error ? err.message : String(err);
  }

  /**
   * @param {any} trace
   * @param {Record<string, string>} params
   */
  function renderSummary(trace, params) {
    const { i18n } = ctx;
    const r = trace.result || {};
    if (task === "topk" && trace.meta?.topk) {
      renderTopkSummary(trace, r);
      return;
    }
    // WP-96: the title names the active user - a link to the Letterboxd profile in handles mode;
    // WP-99: and the target film - a link to its Letterboxd / TMDB page in every mode
    els.title.replaceChildren(
      linkedText(
        (k, p) => i18n.t(k, p),
        titleKey(),
        {
          user: trace.entities?.active_user?.label ?? params.u,
          item: trace.entities?.target_item?.label ?? params.i,
          algorithm: r.algorithm_label, // WP-46 (title_mf only)
        },
        {
          user: { profile_url: trace.entities?.active_user?.profile_url },
          item: { film_url: trace.entities?.target_item?.film_url },
        },
        "profile_url",
        { user: "user", item: "item" } // WP-106: the user in the user colour, the film in the item colour; WP-139: on every trace page (it was the uCF / iCF pages only)
      )
    );
    els.summary.innerHTML = "";
    const hasActual = r.actual !== null && r.actual !== undefined;
    targetRated = hasActual; // WP-109 (6)
    paramForm?.setTargetRated(hasActual);
    dataTrace = trace; // WP-242: the Data row reads the split step's own counts
    renderDataRow();
    // WP-137a: which cell the trace reveals at its prediction step, and so whether the figures below can be hidden until then (the setting `reveal`)
    // WP-176: the content page holds out the same rating, but its sub-matrix (films x terms) has no cell for it: the sentinel [0, 0] says "something is held out" (the user
    // rated the film and the walk has a prediction phase) and the prediction PHASE opens it (below), as the `result` highlight of the cell does on the other pages
    // WP-176 (stage 3): the user-profile method has no prediction phase - its score is what the held-out rating is kept from, so the user-profile phase opens it
    heldCell = cbPage ? (hasActual && (trace.phases || []).some((/** @type {{id: string}} */ p) => p.id === cbRevealPhase()) ? [0, 0] : null) : heldOutCell(trace.views?.submatrix || null, trace.steps);
    // WP-222: the weighted hybrid holds the target's rating out of everything (the split, the bases, the weights) and opens it at the blend - its prediction phase
    if (hybPage) heldCell = hasActual && (trace.phases || []).some((/** @type {{id: string}} */ p) => p.id === cbRevealPhase()) ? [0, 0] : null;
    revealedNow = false;
    hideable = [];
    // WP-46: implicit models (BPR, EASE) report a score and a rank, not a rating
    // (WP-137a: the third entry says whether the figure gives the prediction away - the score and the rank do, the word "held out" does not)
    // WP-176 (stage 3): the content page's user-profile method reports a score too (the profile score, in `score`; `prediction` is null) and has no rank of its own: no rank chip
    const profileScore = cbPage && r.kind === "score";
    const items = r.kind === "score"
      ? [
          [i18n.t("trace.score"), fmt(profileScore ? r.score : r.prediction), true],
          ...(profileScore ? [] : [[i18n.t("trace.rank"), r.n_candidates ? `${r.rank} / ${r.n_candidates}` : "—", true]]),
          [i18n.t("trace.observed"), hasActual ? i18n.t("trace.observed_held_out") : "—", false],
        ]
      : [
          [i18n.t("trace.prediction"), fmt(r.prediction), true],
          [i18n.t("trace.actual"), hasActual ? Number(r.actual).toFixed(1) : "—", hasActual], // a rating: 1 decimal
          [i18n.t("trace.error"), fmt(r.error), true],
        ];
    for (const [label, value, canHide] of items) {
      const chip = document.createElement("span");
      chip.className = "chip";
      chip.textContent = `${label}: `;
      const v = document.createElement("strong");
      v.className = "num";
      v.textContent = value;
      chip.appendChild(v);
      els.summary.appendChild(chip);
      if (canHide) hideable.push({ el: v, text: String(value) });
    }
    if (r.fallback) {
      const warn = document.createElement("span");
      warn.className = "warn-banner";
      warn.textContent = i18n.t("pitfall.no_neighbours");
      els.summary.appendChild(warn);
    }
    if (engine === "icf") renderItemChips(r);
    renderFilterChips(r); // WP-84
    if (engine === "cb") renderContentChips(r, trace.meta?.numeric_fields);
    if (hybPage) renderHybridChips(r); // WP-222
    if (trained) renderMFChips(r, trace.meta?.model); // WP-46 / WP-47; WP-146: the model's source
    const heldOut = els.random.querySelector('[data-role="held-out"]');
    if (heldOut) {
      // WP-46: for a factor model "held out" means the model was refitted without the cell
      const convention = trained ? i18n.t("trace.mf_refit") : hybPage ? i18n.t(hybMethod() === "switching" ? "hybrid.walk.switch.left_out" : "hybrid.walk.left_out") : cbPage ? i18n.t("trace.cb_left_out") : params.mc || "dynamic"; // WP-176: the content page has no mean convention; WP-222: the hybrid's target is out of the split, the bases and the weights; WP-222b: out of the split, the bases and the leaderboard
      heldOut.textContent = hasActual
        ? i18n.t("picker.held_out", { rating: Number(r.actual).toFixed(1), convention })
        : i18n.t("picker.not_rated");
      heldOut.className = hasActual ? "held-out chip" : "held-out warn-banner";
      revealChip = hasActual ? { rating: Number(r.actual).toFixed(1), convention } : null; // WP-137a: the chip's rating hides with the rest
    } else {
      revealChip = null;
    }
    syncReveal(); // WP-137a: written as the setting says from the first frame (a hidden figure is `?`)
  }

  /**
   * WP-141: the top-K task's page title and summary bar - "Top-K for <user>" and three chips read from `meta.topk`: K, how many films are candidates, how many of the
   * list are relevant (a score model - BPR, EASE - has no threshold: no such chip), then the model's own chips. No prediction / actual / error, no held-out chip, no
   * reveal setting: nothing is held out.
   * @param {any} trace
   * @param {any} r trace.result
   */
  function renderTopkSummary(trace, r) {
    const { i18n } = ctx;
    const topk = trace.meta.topk;
    els.title.replaceChildren(
      linkedText(
        (k, p) => i18n.t(k, p),
        topkTitleKey(),
        { user: trace.entities?.active_user?.label ?? routeParams.u, algorithm: r.algorithm_label },
        { user: { profile_url: trace.entities?.active_user?.profile_url } },
        "profile_url",
        { user: "user" } // WP-139: the user in the user colour (the top-K title names no film)
      )
    );
    els.summary.innerHTML = "";
    targetRated = null; // no film, no rating to hold out: the mean-convention chips claim nothing
    paramForm?.setTargetRated(null);
    dataTrace = null; // WP-242: the top-K task states no split
    renderDataRow();
    heldCell = null;
    revealedNow = false;
    hideable = [];
    revealChip = null;
    const text = summaryParams(topk, i18n.lang());
    /** @param {string} key @param {Record<string, unknown>} params @param {string} [tipKey] */
    const chip = (key, params, tipKey) => {
      const el = document.createElement("span");
      el.className = "chip";
      el.textContent = i18n.t(key, params);
      if (tipKey) el.title = i18n.t(tipKey, params);
      els.summary.appendChild(el);
    };
    chip("trace.topk_summary_k", text);
    chip(trace.meta?.request?.candidates === "all" ? "trace.topk_summary_all" : "trace.topk_summary_unseen", text);
    if (topk.threshold !== null && topk.threshold !== undefined && topk.n_relevant !== null && topk.n_relevant !== undefined) chip("trace.topk_summary_relevant", text);
    // WP-176 (stage 4): the content page's MMR re-ranking - how much more varied the second list is (the intra-list similarity before and after), and for the taste-profile method that
    // the numbers are scores, not ratings
    const ils = engine === "cb" ? ilsParams(topk) : null;
    if (ils) chip("trace.topk_summary_ils", ils, "trace.topk_summary_ils_tip");
    // WP-176 (stage 4a): and how many films the re-ranking moved, brought in or dropped against the relevance list (`result.n_moved`; 0 = the same list): what a change of lambda
    // does is then read at a glance, next to the ILS
    // WP-176a (c): the engine's count of places, of K, and of the new films (`places_changed`, `n_new`: 0..K each); `n_moved` (it can exceed K) only when the server sends no places
    const changes = engine === "cb" ? changesParams(r, topk) : null;
    if (changes) {
      const places = changes.kind === "places";
      chip(places ? "trace.topk_summary_places" : changes.kind === "moved" ? "trace.topk_summary_moved" : "trace.topk_summary_moved_none", changes, places ? "trace.topk_summary_places_tip" : "trace.topk_summary_moved_tip");
    }
    if (engine === "cb" && r.kind === "score") chip("trace.topk_summary_score", text, "trace.topk_summary_score_tip");
    if (trained) renderMFChips(r, trace.meta?.model); // WP-146; WP-176 (stage 4): a fitted model's chips (algorithm, parameters, source) - the content page has none (its title names the method)
    const heldOut = els.random.querySelector('[data-role="held-out"]');
    if (heldOut) {
      heldOut.textContent = "";
      heldOut.className = "held-out";
    }
    syncReveal();
  }

  /**
   * WP-84 (D7): attribute-filter chips + warnings from `result.attribute_filter` (null when no
   * filter is active, so a plain trace shows no trace of the feature).
   * @param {any} r trace.result
   */
  function renderFilterChips(r) {
    const { i18n } = ctx;
    const f = r.attribute_filter;
    if (!f) return;
    /** @param {string} text */
    const chip = (text) => {
      const el = document.createElement("span");
      el.className = "chip";
      el.textContent = text;
      els.summary.appendChild(el);
    };
    /** @param {string} key */
    const warn = (key) => {
      const el = document.createElement("span");
      el.className = "warn-banner";
      el.textContent = i18n.t(key);
      els.summary.appendChild(el);
    };
    if (f.item_filter) {
      chip(
        i18n.t("trace.item_filter", {
          desc: f.item_filter.key,
          n_f: f.n_items_in_filter,
          n_a: f.n_active_in_filter,
          n_a_all: f.n_active_all,
        })
      );
      if (f.target_in_filter === false) warn("pitfall.target_outside_filter");
    }
    if (f.user_filter) {
      chip(i18n.t("trace.user_filter", { desc: f.user_filter.key, n_c: f.n_users_in_filter, n_users: f.n_users }));
      if (f.active_in_filter === false) warn("pitfall.active_outside_user_filter");
    }
    if (f.candidate_filter) {
      chip(i18n.t("trace.cand_filter", { desc: f.candidate_filter.key, n_off: f.n_off_context }));
    }
    if (f.mean_scope === "segment") chip(i18n.t("trace.mean_scope_segment"));
    if (f.n_small_support) {
      warn(f.user_filter ? "pitfall.filter_small_support_raters" : "pitfall.filter_small_support");
    }
  }

  /**
   * WP-42: iCF-only summary chips - how the item vectors were centred (the fault gets its pill)
   * and what the legacy degree filter did to the candidate set.
   * @param {any} r trace.result
   */
  function renderItemChips(r) {
    const { i18n } = ctx;
    if (r.centering) {
      const chip = document.createElement("span");
      chip.className = "chip";
      chip.textContent = i18n.t(r.centering === "item_mean" ? "trace.centering_item" : "trace.centering_user");
      if (r.centering === "item_mean") {
        const pill = document.createElement("span");
        pill.className = "pill tag-fault";
        pill.textContent = i18n.t("tag.fault");
        chip.appendChild(pill);
      }
      els.summary.appendChild(chip);
    }
    const d = r.degree_filter;
    if (d) {
      const chip = document.createElement("span");
      chip.className = "chip";
      chip.textContent =
        d.mode === "none"
          ? i18n.t("trace.degree_off")
          : i18n.t("trace.degree", { min_raters: d.min_raters, n_after: d.n_after, n_before: d.n_before });
      els.summary.appendChild(chip);
      if (d.target_below) {
        const warn = document.createElement("span");
        warn.className = "warn-banner";
        warn.textContent = i18n.t("pitfall.target_below_degree");
        els.summary.appendChild(warn);
      }
    }
  }

  /**
   * WP-45: cb-only summary chip - which hybrid strategy ran and what each side predicted (a plain
   * content-only trace has `hybrid_mode: "none"` and renders no chip at all).
   * @param {any} r trace.result
   * @param {unknown} [numeric] WP-176a (b): `trace.meta.numeric_fields` - the film under test's numbers that never enter the similarity (absent on an older server: no card)
   */
  function renderContentChips(r, numeric) {
    const { i18n } = ctx;
    // WP-176: one chip per selected field - how many films carry it (the idf of its terms counts over those films); a sparse field is visible at a glance
    for (const [name, c] of Object.entries(r.coverage || {})) {
      const cov = /** @type {{n: number, n_items: number}} */ (c);
      const params = { field: i18n.t(`params.field_${name}`), n: cov.n, total: cov.n_items };
      const chip = document.createElement("span");
      chip.className = "chip";
      chip.textContent = i18n.t("trace.cb_coverage", params);
      chip.title = i18n.t("trace.cb_coverage_tip", params);
      els.summary.appendChild(chip);
    }
    // WP-176a (b): the card of the film's own numbers (runtime, year, the vote figures ...) - read, never compared: the similarity is made of terms. One element, the hover sentence says
    // so and that the rating and vote figures are today's live values, not the course data's date
    const items = numericItems(numeric, i18n.lang());
    if (items.length) {
      const card = document.createElement("span");
      card.className = "chip numeric-card";
      card.title = i18n.t("trace.numeric_card_tip");
      const head = document.createElement("span");
      head.className = "numeric-title";
      head.textContent = i18n.t("trace.numeric_card");
      card.appendChild(head);
      for (const item of items) {
        const cell = document.createElement("span");
        cell.className = "numeric-item";
        const key = document.createElement("span");
        key.className = "numeric-key";
        key.textContent = i18n.t(`trace.numeric_${item.name}`);
        const value = document.createElement("span");
        value.className = "numeric-value";
        value.textContent = item.unit ? i18n.t("trace.numeric_minutes", { v: item.text }) : item.text;
        cell.append(key, value);
        card.appendChild(cell);
      }
      els.summary.appendChild(card);
    }
    if (!r.hybrid_mode || r.hybrid_mode === "none") return;
    const chip = document.createElement("span");
    chip.className = "chip";
    if (r.hybrid_mode === "weighted") {
      chip.textContent = i18n.t("trace.hybrid_weighted", {
        alpha: fmt(r.hybrid_alpha),
        beta: fmt(r.hybrid_alpha === null || r.hybrid_alpha === undefined ? null : 1 - r.hybrid_alpha),
        cf: fmt(r.cf_prediction),
        cb: fmt(r.cb_prediction),
      });
    } else {
      const choiceEngine =
        r.hybrid_choice === "cf" ? i18n.t(`nav.${r.cf_engine}`) : i18n.t("nav.content");
      chip.textContent = i18n.t("trace.hybrid_switching", {
        choice_engine: choiceEngine,
        cf: fmt(r.cf_prediction),
        cb: fmt(r.cb_prediction),
      });
    }
    els.summary.appendChild(chip);
  }

  /**
   * WP-222: the weighted hybrid's summary chips - which bases were blended, which weights predicted the target and whether they add up to one, how many held-out ratings (of how many users) the weights
   * were learned on, the held-out error of the best single base against the blend's, and - when the foil is on - where the weights were fitted: both named, the right way beside the foil.
   * @param {any} r trace.result
   */
  function renderHybridChips(r) {
    if (r.method === "switching") return renderSwitchChips(r); // WP-222b: the switching walk's own chips (no weights, no blend)
    const { i18n } = ctx;
    const abbreviations = baseNames(i18n); // WP-233: the page's own names (hybrid.walk.abbrev.*: CBF where the engine's tables say CB)
    /** @param {string} text @param {string} [title] */
    const chip = (text, title) => {
      const el = document.createElement("span");
      el.className = "chip";
      el.textContent = text;
      if (title) el.title = title;
      els.summary.appendChild(el);
      return el;
    };
    const bases = /** @type {{id: string, rmse_alone: number}[]} */ (r.bases || []);
    const names = bases.map((b) => abbreviations[b.id] ?? b.id);
    chip(i18n.t("hybrid.walk.chip_bases", { q: bases.length, names: names.join(" · ") }));
    chip(i18n.t("hybrid.walk.chip_weights", { mode: i18n.t(`params.hybrid_w_${r.weights_used}`), sum: fmt(r.alpha_sum, 3) }), i18n.t("hybrid.walk.chip_weights_tip"));
    chip(i18n.t("hybrid.walk.chip_heldout", { n: r.n_heldout, users: r.n_users_heldout }), i18n.t("hybrid.walk.chip_heldout_tip", { frac: r.holdout_frac, min: r.min_ratings }));
    const best = bases.find((b) => b.id === r.best_single);
    if (best && r.rmse_used !== undefined && r.rmse_used !== null) {
      chip(i18n.t("hybrid.walk.chip_rmse", { best: abbreviations[best.id] ?? best.id, rmse_best: fmt(best.rmse_alone, 3), rmse: fmt(r.rmse_used, 3) }), i18n.t("hybrid.walk.chip_rmse_tip"));
    }
    if (r.fit_on === "train") {
      // the foil, labelled and next to the right way it is paired with (the sentence names both)
      const el = chip(i18n.t("hybrid.walk.chip_fit_train"), i18n.t("hybrid.walk.chip_fit_train_tip"));
      const pill = document.createElement("span");
      pill.className = "pill tag-foil";
      pill.textContent = i18n.t("tag.foil");
      el.appendChild(pill);
    }
  }

  /**
   * WP-222b: the switching hybrid's summary chips (engines/hybrid/explain_switching.py `result`) - which bases competed, the rule (a bucket of models with its criterion, or the cold-start
   * neighbour rule with its base and neighbour count), how many of the active user's own ratings were held out for the leaderboard, and the choice: the bucket's winner with its error and
   * the runner-up's gap, or the rule's own error against the two bases alone. The foil (the winner picked on the training ratings) is a chip that names the right way's winner beside it,
   * with the lab's `foil` pill.
   * @param {any} r trace.result
   */
  function renderSwitchChips(r) {
    const { i18n } = ctx;
    const abbreviations = baseNames(i18n); // WP-233: the page's own names (hybrid.walk.abbrev.*: CBF where the engine's tables say CB)
    /** @param {unknown} id */
    const name = (id) => abbreviations[String(id)] ?? String(id);
    /** @param {string} text @param {string} [title] */
    const chip = (text, title) => {
      const el = document.createElement("span");
      el.className = "chip";
      el.textContent = text;
      if (title) el.title = title;
      els.summary.appendChild(el);
      return el;
    };
    const bases = /** @type {{id: string, mae: number, rmse: number, mae_fit: number, rmse_fit: number}[]} */ (r.bases || []);
    const rule = r.rule === "neighbours";
    const criterion = String(r.criterion || "rmse");
    chip(i18n.t("hybrid.walk.chip_bases", { q: bases.length, names: bases.map((b) => name(b.id)).join(" · ") }));
    if (rule) chip(i18n.t("hybrid.walk.switch.chip_rule_neighbours", { cf: name(r.cf_base), cb: name("cb"), m: r.min_neighbours }), i18n.t("hybrid.walk.switch.chip_rule_neighbours_tip"));
    else chip(i18n.t("hybrid.walk.switch.chip_rule_bucket", { criterion: criterion.toUpperCase() }), i18n.t("hybrid.walk.switch.chip_rule_bucket_tip"));
    chip(i18n.t("hybrid.walk.switch.chip_heldout", { n: r.n_heldout, n_user: r.n_user_ratings }), i18n.t("hybrid.walk.switch.chip_heldout_tip", { frac: r.switch_holdout_frac, cap: r.cap ?? "∞" }));
    if (rule) {
      const [cf, cb] = bases;
      if (cf && cb) chip(i18n.t("hybrid.walk.switch.chip_rule_result", { rmse_rule: fmt(r.rule_rmse, 3), cf: name(cf.id), rmse_cf: fmt(cf.rmse, 3), cb: name(cb.id), rmse_cb: fmt(cb.rmse, 3) }), i18n.t("hybrid.walk.switch.chip_rule_result_tip"));
      return;
    }
    const winner = bases.find((b) => b.id === r.winner);
    if (!winner) return;
    if (r.select_on === "train") {
      // the foil, labelled and next to the right way it is paired with (the sentence names both winners)
      const el = chip(i18n.t("hybrid.walk.switch.chip_select_train", { winner: name(winner.id), value: fmt(criterion === "mae" ? winner.mae_fit : winner.rmse_fit, 3), criterion: criterion.toUpperCase(), right: name(r.winner_right) }), i18n.t("hybrid.walk.switch.chip_select_train_tip"));
      const pill = document.createElement("span");
      pill.className = "pill tag-foil";
      pill.textContent = i18n.t("tag.foil");
      el.appendChild(pill);
    } else {
      chip(i18n.t("hybrid.walk.switch.chip_winner", { winner: name(winner.id), criterion: criterion.toUpperCase(), value: fmt(criterion === "mae" ? winner.mae : winner.rmse, 3), gap: fmt(r.gap, 3) }), i18n.t("hybrid.walk.switch.chip_winner_tip"));
    }
  }

  /**
   * WP-46: MF-only summary chips - algorithm, epochs run / best epoch (+ an early-stop pill), the
   * kept epoch's train loss and validation metric, the seed; EASE shows λ and its catalogue size. WP-146: and where the model came from.
   * @param {any} r trace.result
   * @param {import("../util/model-source.js").ModelMeta | null | undefined} [model] `trace.meta.model` (absent on a server without stored models: no chip)
   */
  function renderMFChips(r, model) {
    const { i18n } = ctx;
    /**
     * @param {string} text
     * @param {string} [pillKey]
     * @param {string} [title] the chip's hover text
     */
    const add = (text, pillKey, title) => {
      const chip = document.createElement("span");
      chip.className = "chip";
      chip.textContent = text;
      if (title) chip.title = title;
      if (pillKey) {
        const pill = document.createElement("span");
        pill.className = "pill";
        pill.textContent = i18n.t(pillKey);
        chip.appendChild(pill);
      }
      els.summary.appendChild(chip);
      return chip;
    };
    // WP-47: a neural trace names its architecture and its parameter count instead
    add(
      r.algorithm === "dnn" ? i18n.t(r.architecture === "features" && Array.isArray(r.groups) && r.groups.join() === "ids" ? "params.arch_features_ids" : `params.arch_${r.architecture}`) : i18n.t(`params.alg_${r.algorithm}`), // WP-225: the ids-only variant says so
      undefined,
      r.algorithm === "funk_svd" ? i18n.t("param_tip.alg_funk_svd") : undefined // WP-124 (d'): the long name stays out of the chip
    );
    if (r.n_params) add(i18n.t("mf.params", { n: r.n_params }));
    if (r.epochs) {
      add(
        i18n.t("trace.mf_epochs", { n: r.epochs, best: r.best_epoch ?? r.epochs }),
        r.stopped_early ? "trace.mf_stopped_early" : undefined
      );
      if (r.train_loss !== null && r.train_loss !== undefined) add(`${i18n.t(`curve.${r.loss_name}`)}: ${fmt(r.train_loss)}`);
      if (r.valid_metric !== null && r.valid_metric !== undefined) {
        add(`${i18n.t(`curve.valid_${r.metric_name}`)}: ${fmt(r.valid_metric)}`);
      }
      if (r.seed !== undefined && r.seed !== null) add(i18n.t("trace.mf_seed", { seed: r.seed }));
    }
    // (WP-141: a top-K trace's result carries neither the ridge weight nor the catalogue size - no chip says "λ = — · undefined items")
    if (r.algorithm === "ease" && r.lam !== undefined && r.n_kept_items !== undefined) add(`λ = ${fmt(r.lam)} · ${r.n_kept_items} ${i18n.t("mf.legend_items")}`);
    // WP-146: where the model came from - "model: pretrained · 13:50" (fitted at home), "model: refit (held-out)" (trained again without the rating), "model: fit" (trained for this trace)
    const source = modelChip(model, { t: (k, p) => i18n.t(k, p), lang: i18n.lang() });
    if (source) {
      const chip = add(source.text, undefined, source.title);
      chip.dataset.modelSource = source.source;
    }
  }

  /**
   * @param {Record<string, string>} params
   */
  async function loadTrace(params) {
    const { api, i18n } = ctx;
    const topkMode = task === "topk"; // WP-141: the task this request is for
    const mine = ++traceSeq; // WP-97: only the newest request may draw (see the tokens above)
    const current = () => mounted && mine === traceSeq;
    // WP-146: the model's source and the person's word on a trace that trains on a large data set travel with the request; the warning of an earlier refusal goes (this request is the answer to it)
    const stored = pretrainedOffered({ features }, engine);
    const confirmLarge = stored && confirmCovers(confirmed, confirmScopeOf(params)); // once per data set + engine + resolved settings, for the page's session (user decision 2026-10-11)
    const modelFields = modelRequestFields({ offered: stored, params, confirmLarge });
    // WP-191: a request of an engine whose server side reports progress carries an id the progress record is kept under; the strip polls `GET /api/progress/{id}` with it. A frozen
    // bundle runs no request (and has no record), so it sends none; a request without the field is built exactly as before.
    const progressId = reportsProgress(engine) && ctx.api.mode === "live" ? newProgressId() : null;
    const progressFields = progressId ? { progress_id: progressId } : {};
    largeWarning?.hide();
    // WP-140: the trace on screen is NOT destroyed when a request starts: it is frozen (the player is locked, the panels inert, the strip fades them once the request is slow)
    // and goes only when the new trace is here, so a failed request can give it back. `replaced` says it is gone.
    const hadTrace = player !== null;
    let replaced = false;
    let givenBack = false; // WP-146: the request failed and the old trace (with its title) is the page's again - a late answer of the name lookups must not paint the failed pair's title over it
    player?.lock();
    // the title belongs to the TRACE on screen: a failed request gives it back with the trace (the pickers belong to the route, they keep what was asked for)
    const keepTitle = hadTrace ? [...els.title.childNodes].map((node) => node.cloneNode(true)) : null;
    traceLoading?.begin({
      words: () => loadingWords({ engine, params, defaults: engineDefaults, t: (k, p) => i18n.t(k, p) }),
      why: trained ? i18n.t(topkMode ? "trace.loading_why_topk" : "trace.loading_why") : null,
      estimateSeconds: confirmLarge ? confirmed?.estimate : null, // WP-146: "3.2 s of about 100 s" once the person has confirmed a fit the server put a number on
      progressId, // WP-191: the stage, the loop count and the estimate of the request, read from its record
      // WP-210: the kind of this request - page, data set, task and every setting, NOT the user and not the film - under which its wall time is kept and the next of its kind is estimated
      etaKey: progressId
        ? etaKeyOf({
            page: pageId,
            dataset,
            task: topkMode ? "topk" : "predict",
            settings: { ...requestExtras(topkMode ? "topk" : "predict", params, engine), config: configFromParams(configParams(engine, params, task), features) },
          })
        : null,
    });
    if (!hadTrace) els.narration.textContent = i18n.t("trace.loading");
    // WP-140: the user and the film are two light requests of their own (~25 ms); the pickers show them as they arrive, not with the trace (they used to wait for it)
    const userReq = api.user(dataset, Number(params.u)).catch(() => null);
    const itemReq = topkMode ? Promise.resolve(null) : api.item(dataset, Number(params.i)).catch(() => null);
    void Promise.all([userReq, itemReq]).then(([early, earlyItem]) => {
      if (!current()) return;
      if (early) userPicker?.update({ selected: early });
      if (earlyItem) itemPicker?.update({ selected: earlyItem });
      if (!givenBack) paintEarlyTitle(params, topkMode, early, earlyItem); // WP-146: (a refused request - the 413 - comes back faster than the two lookups)
    });
    try {
      const [trace, cfg, userInfo, itemInfo] = await Promise.all([
        api.trace(
          engine,
          dataset,
          topkMode
            ? // WP-141: a top-K request names a user, a list length and a candidate set - no film
              { user: Number(params.u), ...requestExtras("topk", params, engine), ...modelFields, ...progressFields, config: configFromParams(configParams(engine, params, task), features) }
            : {
                user: Number(params.u),
                item: Number(params.i),
                ...modelFields, // WP-146: `model_source` / `confirm_large` (none for automatic: the request is what it was)
                ...progressFields, // WP-191: `progress_id` (content-based pages, live server only)
                config: configFromParams(configParams(engine, params, task), features), // WP-84; WP-141: `k` is a list length on the model pages
              }
        ),
        loadConfig(api),
        userReq,
        itemReq,
      ]);
      if (!current()) return; // WP-97: a newer route took over while the trace was in flight
      // WP-46: the flowchart is the trace's own (the mf route serves four algorithms behind three
      // flowcharts); for ucf/icf/cb `flowchart_id` equals the engine alias, as before.
      const flow = await api.flowchart(trace.flowchart_id || engine);
      if (!current()) return; // WP-43: the user left this page while the trace was in flight; WP-97: or moved on
      // WP-140: the new trace is here - the old one goes now, and the page leaves its loading look in the same task as it draws the new one (no frame between them)
      if (player) {
        player.destroy();
        player = null;
      }
      replaced = true;
      traceLoading?.done();
      lastModel = trace.meta?.model ?? null; // WP-146: where this trace's model came from; the "Model" row follows it
      paramForm?.setModelState(modelStateNow());
      void refreshModels();
      // WP-105: a new trace starts on the matrix tab, with no pair (the pair panel reports one once its table is built)
      onPair(null);
      setHeatTab("matrix");
      els.heatInfo?.replaceChildren(); // WP-141: the sub-matrix's (i) belongs to the grid (the top-K task has no grid)
      setCbTopkHead(topkMode); // WP-176 (stage 4)
      renderSummary(trace, params);
      userPicker.update({
        selected: userInfo || { index: Number(params.u), label: trace.entities?.active_user?.label },
      });
      if (!topkMode) {
        itemPicker.update({
          selected: itemInfo || { index: Number(params.i), title: trace.entities?.target_item?.label },
        });
      }
      const flowchart = createFlowchart(els.flow, {
        i18n,
        compact: layoutF && !dnnFeatures(), // WP-105: the narrow vertical column of layout F (two columns of boxes, chain folded); WP-123: on the MF / DNN pages too. WP-248: not on the Hybrid DNN chart - its YAML grid is already the compact drawing (folding it again would put "Result" under "Forward pass" and add a row)
        follow: layoutF, // WP-107 (e2): the chart may be taller than its panel: the active node is kept in view
        zoom: () => flowZoomValue, // WP-107 (g2): the reader's size factor
        straightBack: dnnFeatures(), // WP-248: the Hybrid DNN chart's "next epoch" arrow goes straight up (its loop is drawn as a rectangle)
        onNodeClick: (nodeId) => {
          const idx = trace.steps.findIndex((s) => s.node_id === nodeId);
          if (idx >= 0 && player) player.goto(idx);
        },
      });
      flowchartRef = flowchart;
      flowchart.setFlowchart(flow);
      flowSplit?.refresh(); // WP-107 (e2): the chart's natural height is known now
      // WP-46: the epoch log for iterative MF, EASE's weight table for the closed form
      const tableId =
        engine === "ucf" ? "candidates" : trained ? (trace.tables?.epochs ? "epochs" : "weights") : cbPage && topkMode ? "mmr" : cbPage ? cbTablesFor(cbMethod())[0] : "items"; // WP-176 (stage 4): the MMR list of the content page's top-K task; WP-195c: the model's first table
      // WP-141: a top-K trace has no epoch / weight table: the panel goes and the flowchart takes the column
      const noTable = (topkMode && trained && !trace.tables?.[tableId]) || (cbPage && !(topkMode ? trace.tables?.mmr : cbTablesFor(cbMethod()).some((id) => trace.tables?.[id]))); // WP-176 (stages 3, 4): the user-profile method has no candidates to tabulate; a top-K trace with no candidate has no MMR list
      els.tableBox?.toggleAttribute("hidden", noTable);
      els.flowCol?.classList.toggle("no-table", noTable);
      // WP-222: the weighted hybrid's tables live in the tabs of the panel above (Bases | Weights | Blend): the lower-right table panel is never shown, the flowchart takes the column
      if (hybPage) {
        els.tableBox?.setAttribute("hidden", "");
        els.flowCol?.classList.add("no-table");
      }
      // WP-141: the training curve, the latent space, the network and the factor matrices belong to the fitted model; a top-K trace that carries none of those views (BPR and EASE
      // have no factor view) leaves their panels out (they would say "closed form" / "no network to draw" / "no factor matrices")
      // WP-152: the factor matrices are a tab of the sub-matrix panel now: with no factor view in a top-K trace the tab is off (its title says why), nothing hides.
      // WP-154: the network too; the top-K trace of a network carries no diagram at all (measured: `views` is empty), so there that tab is not offered - the matrix is the
      // only one, a single title in the head, nothing greyed
      // WP-158: the training curve and the latent space are tabs of the Code and the Formula panel (no panel left to hide): without the view the tab is greyed, with its reason as title
      setLowerOff(trace, topkMode);
      const secondOff = Boolean(panelTabs) && topkMode && !trace.views?.[panelTabs?.second ?? ""];
      if (panelTabs) {
        const other = panelTabs.buttons[panelTabs.second];
        other.setAttribute("aria-disabled", String(secondOff));
        other.hidden = secondOff && engine === "dnn";
        other.title = secondOff ? i18n.t(engine === "dnn" ? "mf.no_network" : "mf.factors_idle") : "";
      }
      // WP-106 (3b): on the framed pages the sentence and the user / item chips use the role colours: the active user and the
      // candidate NEIGHBOUR of a uCF page are users, the target item (and an iCF page's candidate items) are items
      // WP-159: the model pages name the same two entities in their sentences (the Setup line "Predict <user>'s rating of <film> with <algorithm>", the SGD / BPR
      // demo steps, the EASE weights), so they use the same colours; a param is drawn in a role by the KEY its step gives it (`user`; `item`, and the other
      // film-named keys of the BPR triple and of the EASE weights) - no step is singled out. `who` (the network's embedding stages: the user at one stage, the film at
      // another) was not here until WP-171: the engine now sends the user's lookup stage under `user` and the film's under `item` (two keys, `step.dnn.layer_embedding_user` / `_item`), so both names take these roles
      const narration = createNarration(els.narration, {
        i18n,
        roles: framed || cbPage || hybPage // WP-176: the content page's candidates are films; WP-222: the hybrid names the same two entities
          ? { user: "user", item: "item", cand: engine === "ucf" ? "user" : "item" }
          : framedTrained
            ? { user: "user", item: "item", item_i: "item", item_j: "item", top_item: "item" }
            : null,
        chipRoles: layoutF ? { user: "user", item: "item" } : null,
        alias: hybPage ? hybridAlias(i18n) : undefined, // WP-233: the hybrid page's sentences say CBF where the engine's params say CB
        // WP-239: the hybrid walks' decision steps say for whom the choice is made (the whole class, this user, a user x film, this pair); the switching walk's rule is the trace's
        scope: hybPage
          ? (/** @type {any} */ step) => {
              const found = scopeOf(hybMethod(), step, trace.result?.rule);
              return found ? scopeTexts((key) => i18n.t(key), found) : null;
            }
          : undefined,
      });
      // WP-117: headSlot holds the statistic group's (i); WP-131: the item-based page draws a film per row (util/heat-orient.js)
      // WP-132: the cells open in the mode the URL names (`vals`: c = centred, r = raw; else the page's own: the item-based page centred, the others raw);
      // a choice made with the switch goes back to the URL
      // WP-141: the top-K task has no sub-matrix: the grid is not built, the Ranked list stands in its place (`heat`: the panel the player drives)
      const heatGrid = topkMode ? null : createHeatGrid(els.heat, {
        i18n,
        headSlot: els.heatInfo,
        orientation: orientationFor(engine),
        mode: modeFor(engine, routeParams.vals),
        onModeChange: writeVals,
        reveal: revealMode, // WP-137a: the held-out reveal setting (the `reveal` route parameter)
        statsMode: statsModeFor(routeParams.stats), // WP-136: the statistic group opens in the story the URL names (`stats`: c = centred Δ, else the ratings as given)
        onStatsModeChange: writeStats,
        heldRole: engine === "ucf" ? "user" : null, // WP-137a: the user-based page's `?` box is the users' red; the item-based and the model pages keep the navy
      });
      heatRef = heatGrid;
      const heat = heatGrid ?? createRankedList(els.heat, { i18n });
      const formula = createFormulaPanel(els.formula, { i18n, formulas: cfg.formulas || {} });
      const code = createCodePanel(els.code, { i18n, highlight: layoutF }); // WP-107 (f): coloured Python on the layout-F pages (uCF / iCF; WP-123: MF / DNN)
      // WP-91 stage 2: the iCF candidate table marks its odd items (unreleased / no metadata / TV series)
      const table = createDataTable(els.table, {
        i18n,
        tableId,
        flagColumn: engine === "icf" ? "item" : undefined,
        headExtra: tableZoomEl, // WP-107 (g2)
        headLead: cbTableStrip && !topkMode ? cbTableStrip.strip : undefined, // WP-176 (stage 3): the content page's strip takes the title's place (the top-K task has one table, with its title)
        focusLink: cbPage && !topkMode ? { from: "items", key: "col" } : undefined, // the field parts of the candidate the walk is on are focused with its row
        follow: cbPage, // the wrap keeps the focused row in view while the walk reveals one row per step
        showOnReference: cbPage, // the prediction shares carry no row count: the step that names the table shows it whole (so does the MMR table's result step)
        tipKeys: cbPage && topkMode ? { title: "col_tip.topk_film" } : undefined, // WP-176 (stage 4): the MMR table's films are ones the user has NOT rated
        // the narrow panel shows the lesson (the places and what moved) before its scroll begins; the film it resembled is cut, its full title is the hover text
        columnOrder: cbPage && topkMode ? ["title", "rank_before", "rank_after", "moved", "rel", "penalty", "penalised_by", "mmr_value"] : undefined,
        clampKeys: cbPage && topkMode ? ["penalised_by"] : undefined,
      });
      cbTableRef = cbPage && !topkMode ? table : null;
      if (topkMode) cbTablesHave = []; // no `tbl` in the URL of a top-K trace
      /** @type {any[]} */
      const panels = [narration, heat, flowchart, formula, code, table];
      // WP-137a: a panel that only listens: the step on screen opens (or closes again) the held-out figures of the summary bar and the picker chip - the very test the
      // grid's cell uses (util/heat-orient.js `revealsCell`), so the three open on the same step
      panels.push({
        reset() {
          revealedNow = false;
        },
        apply: (/** @type {any} */ frame) => {
          const open = cbPage || hybPage ? heldCell !== null && frame.phase?.id === cbRevealPhase() : revealsCell(frame.highlights, heldCell); // WP-176: the content page's prediction phase opens it (the user-profile method's: its user-profile phase); WP-222: and the weighted hybrid's (the blend)
          if (open !== revealedNow) {
            revealedNow = open;
            syncReveal();
          }
        },
      });
      if (sigTip) {
        const tip = sigTip;
        // a panel that only listens: the (i) is visible while the step's formula is a significance-weighting template
        panels.push({
          reset() {},
          apply: (/** @type {any} */ frame) => {
            const id = String(frame.step?.formula?.template_id ?? "");
            tip.style.visibility = id.startsWith("sig_weight") ? "visible" : "hidden";
          },
        });
      }
      // WP-46: training curve + latent-space scatter (both idle on a closed-form trace); the heat
      // panel shows EASE's item x item Gram matrix instead of the ratings, so retitle it.
      if (trained && els.curve && els.embedding) {
        // WP-158: the curve's text takes the Code panel's size step (`--code-zoom` on the panel, read at every draw)
        const codeBox = lowerTabs?.code.box;
        const curvePanel = createCurvePanel(els.curve, { i18n, scale: () => (codeBox ? Number.parseFloat(getComputedStyle(codeBox).getPropertyValue("--code-zoom")) || 1 : 1), features: dnnFeatures() && !topkMode, column: true }); // WP-243: the feature page draws the whole run faint from the first step and the ids-only network's error as a reference // WP-244
        curveRef = curvePanel;
        panels.push(curvePanel, createEmbeddingPanel(els.embedding, { i18n }));
        if (engine === "dnn" && els.network) panels.push(createNetworkPanel(els.network, { i18n })); // WP-47
        if (sideTabs && els.side) panels.push(createSideInputsPanel(els.side, { i18n })); // WP-244
        if (sideTabs && els.values) panels.push((valuesRef = createValuesPanel(els.values, { i18n }))); // WP-248
        if (engine === "mf" && els.factors) panels.push(createFactorPanel(els.factors, { i18n, headSlot: els.secondHead, scale: ratingScale })); // WP-122
        if (els.heatHead) {
          const heading = i18n.t(topkMode ? "panel.ranked" : trace.result?.algorithm === "ease" ? "panel.gram" : "panel.submatrix"); // WP-141
          if (panelTabs && panelTabs.first === "matrix") panelTabs.buttons.matrix.textContent = heading; // WP-152: the head is a tab strip on the MF and the neural page: the first tab carries the title; WP-245: not on the feature page (its strip is the flowchart's)
          else if (sideTabs) sideTabs.buttons.matrix.textContent = heading; // WP-244: the first tab of the side-inputs strip carries the title
          else els.heatHead.textContent = heading;
        }
      }
      // WP-176 (stage 2): the content page's tabs - the TF-IDF table (the target film's terms), and on the user-profile method the taste-profile view with the table that explains its
      // score (the terms, the user's preference p(t), the film's weight x(t), the share each adds; sorted by the size of that share). Both tables show every row while their tab is open.
      // A panel that only listens decides the open tab (util/cb-tabs.js - what the step highlights and references), unless the reader clicked one on this node.
      if (cbTabs && !topkMode) {
        const { hosts, idle, featuresIdle } = cbTabs;
        stepNodes = (trace.steps || []).map((/** @type {{node_id?: string}} */ st) => st.node_id ?? null);
        if (hosts.tfidf) panels.push(createDataTable(hosts.tfidf, { i18n, tableId: "tfidf", showAll: true }));
        if (hosts.features) panels.push(createDataTable(hosts.features, { i18n, tableId: "feature_scores", showAll: true })); // WP-176 (stage 3)
        if (hosts.network && cbKind() === "mlp") panels.push(createNetworkPanel(hosts.network, { i18n, footnote: i18n.t("trace.cb_model_network_input") })); // WP-199: the network's diagram, driven by the `network` highlights of the walk (the neural page's contract); WP-216: only for the network's trace (the tab of a regression page stays idle), and its footer says what the input is
        if (hosts.fit) {
          cbFitRef = createCbFit(hosts.fit, { i18n }); // WP-195c: the per-user model's fit summary (stage 2: and the network's curve and epochs)
          panels.push(cbFitRef);
        }
        if (hosts.profileGrid && hosts.profileTable) {
          const modelTab = cbMethod() === "model"; // WP-195c: the Weights tab - the `weights` table (the terms with the largest weights, signed) under the profile view
          panels.push(
            createHeatGrid(hosts.profileGrid, { i18n, orientation: "profile", viewKey: "profile" }),
            // WP-195c stage 2: the small network's table is `effects` (each term's single-term effect, signed), not the regression's `weights`
            createDataTable(hosts.profileTable, {
              i18n,
              tableId: modelTab ? (cbKind() === "mlp" ? "effects" : "weights") : "profile_terms",
              showAll: true,
              signed: modelTab ? (cbKind() === "mlp" ? ["effect"] : ["w"]) : ["preference", "contribution"],
            })
          );
        }
        const tabsOfMethod = cbTabs.tabs;
        panels.push({
          reset(/** @type {any} */ t) {
            cbManual = null;
            cbNode = null;
            showCbTab(tabsOfMethod[0]);
            if (idle) idle.hidden = Boolean(t?.views?.profile); // a pair with no taste profile (the user rated nothing else) says why
            // WP-195c: the Weights tab of the per-user model has two empty cases, each with its own sentence: a user whose every rating equals their mean (a model fitted, nothing to learn:
            // `result.model.flat`, no weights step, phase, view or table) and a user with no other rating at all (no model: `result.model` is null)
            if (idle && cbMethod() === "model") idle.textContent = i18n.t(t?.result?.model?.flat ? "cbmodel.flat" : "panel.model_weights_idle");
            // WP-176 (stage 3): the feature-selection tab - switched off (the request key `feature_selection: false`: the trace has no such phase) it is greyed with its reason; with the phase but no scores (too few liked or
            // disliked films) the tab says why, in the step's own sentence
            const fsStep = (t?.steps || []).find((/** @type {{phase?: string}} */ st) => st.phase === "feature_selection");
            const fsTab = cbTabs?.buttons.features;
            if (fsTab) {
              fsTab.setAttribute("aria-disabled", String(!fsStep));
              fsTab.title = fsStep ? "" : i18n.t("panel.features_off");
            }
            if (featuresIdle) {
              const none = Boolean(fsStep) && !t?.tables?.feature_scores;
              featuresIdle.hidden = !none;
              featuresIdle.textContent = none && fsStep ? `${i18n.t("panel.features_idle")} ${i18n.t(fsStep.text_key, fsStep.text_params || {})}` : "";
            }
          },
          apply: (/** @type {any} */ frame) => {
            cbNode = frame.step?.node_id ?? null;
            const next = /** @type {{tab: import("../util/cb-tabs.js").CbTab, manual: {tab: import("../util/cb-tabs.js").CbTab, node: string | null} | null}} */ (
              /** @type {any} */ (nextPanelTab)({ driven: cbDrivenTab(frame.step, tabsOfMethod), current: cbTab, manual: cbManual, node: cbNode })
            );
            cbManual = next.manual;
            if (next.tab !== cbTab) showCbTab(next.tab);
          },
        });
      }
      // WP-222: the weighted hybrid's three tabs. Each tab's tables and views are panels that listen to the player like every other (a data table reads `trace.tables.<id>` and reveals its rows by the
      // step's `reveal_upto`; the profile grid follows the highlights of the `profile` view; the curve those of `curve`). A host stays out of sight until the walk first reaches what it shows - a head
      // row with no row under it says nothing - and the tab the step carries is opened (util/hybrid-tabs.js), unless the reader clicked one on this node.
      if (hybTabs && !topkMode) {
        const { hosts } = hybTabs;
        stepNodes = (trace.steps || []).map((/** @type {{node_id?: string}} */ st) => st.node_id ?? null);
        /** a table of the trace in a host of a tab; the player's `reveal_upto` decides its rows, and a step that names the table with no count shows every row @param {string} id @param {Record<string, unknown>} [extra] */
        // WP-233: every table says CBF where the engine's say CB (`alias`); the bases table's name cell is the method's own words, a link to its page for this pair and the settings in effect (`decorate`)
        const alias = hybridAlias(i18n);
        const baseCell = {
          decorate: (/** @type {any} */ col, /** @type {any} */ row, /** @type {HTMLElement} */ td) => {
            if (col.key === "base") dressBaseCell(td, row, { i18n, tree: ctx.nav?.tree ?? [], pair: { u: params.u, i: params.i, ds: dataset }, algorithms: cfg.algorithms, overrides: trace.meta?.request?.config?.base_configs });
          },
        };
        const tableIn = (id, extra = {}) => createDataTable(hosts[id], { i18n, tableId: id, showOnReference: true, follow: true, alias, ...(id === "bases" ? baseCell : {}), ...extra });
        // WP-235: the held-out table's film and rating columns say what THEY are (the candidate table's sentences - "an item the active user has rated", "the neighbour's rating" - are the uCF / iCF
        // pages': they are looked up by the label `col.item` / `col.rating`, which the held-out table shares); the other heads find their tips by label (`col_tip.hybrid_*`)
        const heldoutTips = { tipKeys: { item: "col_tip.hybrid_heldout_item", actual: "col_tip.hybrid_heldout_actual" } };
        // WP-235: the trajectory table's row of the step the walk is on says which way the error moved (the RMSE cell takes the tone of the chart's marker: green ▼ fell, red ▲ rose, grey = under 1e-4)
        // and which weight moved the most (outlined); the cells are marked once, when the table is built, and trace.css shows the marks only on the focused row
        const trajectoryRows = /** @type {Record<string, any>[]} */ (trace.tables?.trajectory?.rows ?? []);
        const weightKeys = (trace.tables?.trajectory?.columns ?? []).map((/** @type {{key: string}} */ c) => c.key).filter((/** @type {string} */ k) => k.startsWith("a_"));
        const trajectoryCell = {
          keepCase: ["beta0"], // "intercept β₀": the capital of β is not β
          keepCaseParams: true, // "weight · uCF": the base keeps its case
          decorate: (/** @type {any} */ col, /** @type {any} */ row, /** @type {HTMLElement} */ td) => {
            const prev = trajectoryRows[Number(row.step) - 1];
            if (!(Number(row.step) > 0) || !prev) return; // the start has no step before it
            if (col.key === "rmse") {
              const move = trendOf(prev.rmse, row.rmse);
              if (!move) return;
              td.dataset.trend = move;
              const glyph = document.createElement("span");
              glyph.className = "hybrid-trend";
              glyph.textContent = TREND_GLYPH[move];
              td.append(" ", glyph);
            } else if (col.key === largestChange(prev, row, weightKeys)) td.dataset.moved = "1";
          },
        };
        const switching = hybMethod() === "switching"; // WP-222b
        if (switching) {
          // WP-222b: the switching walk's tables - the bases over the held-out ratings (Bases), the leaderboard under its bars (Leaderboard), the answers with the signed miss (Answer)
          panels.push(tableIn("bases"), tableIn("heldout", heldoutTips), tableIn("leaderboard"), tableIn("answers", { signed: ["miss"] })); // WP-235: the held-out table says what its film and rating columns are
          hybBoardRef = createHybridBoard(hosts.board, { i18n });
          panels.push(hybBoardRef);
        } else {
          // WP-235: `alpha` is the label `col.alpha` the content model's table shares (its tip there is the ridge penalty, its head "α" would be upper-cased to the Greek capital): the blend's own tip, kept as typed
          panels.push(tableIn("bases"), tableIn("heldout", heldoutTips), tableIn("trajectory", trajectoryCell), tableIn("contributions", { signed: ["alpha", "contribution"], keepCase: ["alpha"], tipKeys: { alpha: "col_tip.hybrid_alpha" } }));
          hybCurveRef = createHybridCurve(hosts.curve, { i18n, tol: cfg.algorithms?.hybrid_notes?.gd_tol }); // WP-235: `tol` marks where the descent reached the closed form
          // WP-235: the weights grid's label column is as wide as its labels ("α* closed-form weights", a whole film title: `labelMax`; the labels wrap, hybrid.css) and measured again when the tab is shown (`remeasure`);
          // above it the blend of the target film with its numbers in it
          hybProfileRef = createHeatGrid(hosts.profile, { i18n, orientation: "profile", viewKey: "profile", alias, labelMax: 300, profileTexts: { row: "hybrid.walk.profile_row", userTip: "hybrid.walk.profile_alpha_tip", itemTip: "hybrid.walk.profile_says_tip" } }); // WP-233: `alias` - the grid's column heads say CBF where the engine's say CB
          panels.push(hybCurveRef, createHybridBlendLine(hosts.blendline, { i18n }), hybProfileRef);
        }
        // where the walk first reaches what each host shows: the tables at the first step that references them, the profile view at the first step that highlights it
        /** @type {Record<string, number>} */
        let reached = {};
        const reachedAt = (/** @type {any} */ t) =>
          switching
            ? {
                // WP-222b: the bars and the leaderboard table appear with the first score step, the answers with the answer step
                bases: firstReference(t?.steps, "bases"),
                heldout: firstReference(t?.steps, "heldout"),
                board: firstReference(t?.steps, "leaderboard"),
                leaderboard: firstReference(t?.steps, "leaderboard"),
                answers: firstReference(t?.steps, "answers"),
              }
            : {
                bases: firstReference(t?.steps, "bases"),
                heldout: firstReference(t?.steps, "heldout"),
                trajectory: firstReference(t?.steps, "trajectory"),
                curve: firstReference(t?.steps, "trajectory"),
                contributions: firstReference(t?.steps, "contributions"),
                blendline: firstReference(t?.steps, "contributions"), // WP-235: the blend with its numbers in it appears with the contributions table it sums
                profile: (t?.steps || []).findIndex((/** @type {{highlights?: {view?: string}[]}} */ st) => (st.highlights || []).some((h) => h.view === "profile")),
              };
        panels.push({
          reset(/** @type {any} */ t) {
            hybManual = null;
            hybNode = null;
            reached = reachedAt(t);
            showHybridTab("bases");
          },
          apply: (/** @type {any} */ frame) => {
            for (const [id, at] of Object.entries(reached)) hosts[id].hidden = at < 0 || frame.index < at;
            hybNode = frame.step?.node_id ?? null;
            const next = /** @type {{tab: import("../util/hybrid-tabs.js").HybridTab, manual: {tab: import("../util/hybrid-tabs.js").HybridTab, node: string | null} | null}} */ (
              /** @type {any} */ (nextPanelTab)({ driven: hybridDrivenTab(frame.step) ?? (frame.index === 0 ? HYBRID_TABS[0] : null), current: hybTab, manual: hybManual, node: hybNode }) // the first step opens the first tab, also when the reader jumps back to it
            );
            hybManual = next.manual;
            if (next.tab !== hybTab) showHybridTab(next.tab);
          },
        });
      }
      // WP-176 (stage 3): and the lower-right panel's table - a panel that only listens, like the one above: the step's table references decide (util/cb-tabs.js `cbTableDriven`), unless the
      // reader clicked a tab on this node. It runs after the data table's own reset (the table is the first of `panels`), so the table it switches has its trace.
      if (cbTableStrip && !topkMode) {
        const strip = cbTableStrip;
        const stripTables = cbTablesFor(cbMethod()); // WP-195c
        panels.push({
          reset(/** @type {any} */ t) {
            cbTablesHave = stripTables.filter((id) => t?.tables?.[id]);
            cbTableManual = null;
            cbFrame = null;
            for (const id of stripTables) strip.buttons[id].hidden = !cbTablesHave.includes(id);
            showCbTable(/** @type {import("../util/cb-tabs.js").CbTable} */ (cbTablesHave[0] ?? stripTables[0]));
          },
          apply: (/** @type {any} */ frame) => {
            cbFrame = frame;
            cbNode = frame.step?.node_id ?? null;
            if (!cbTablesHave.length) return;
            const steps = frame.trace?.steps || [];
            const driven = cbTableDriven(frame.step, steps[frame.index - 1] ?? null, cbTable, cbTablesHave, cbMethod());
            const next = /** @type {{tab: import("../util/cb-tabs.js").CbTable, manual: {tab: import("../util/cb-tabs.js").CbTable, node: string | null} | null}} */ (
              /** @type {any} */ (nextPanelTab)({ driven: driven !== cbTable ? driven : null, current: cbTable, manual: cbTableManual, node: cbNode })
            );
            cbTableManual = next.manual;
            if (next.tab !== cbTable) showCbTable(next.tab, frame);
          },
        });
      }
      // WP-152: a panel that only listens: the step on screen decides which tab of the sub-matrix panel is open (util/panel-tab.js - the step's own highlights, in the
      // top-K task the phase), unless the reader clicked one on this node
      if (panelTabs) {
        stepNodes = (trace.steps || []).map((/** @type {{node_id?: string}} */ st) => st.node_id ?? null);
        const phaseIds = (trace.phases || []).map((/** @type {{id: string}} */ p) => p.id);
        const hasView = Boolean(trace.views?.[panelTabs.second]);
        const { networkFirst } = openingFor(trace, topkMode); // WP-243
        panels.push({
          reset() {
            manualTab = null;
            panelNode = null;
            showPanelTab(networkFirst ? "network" : panelFirst); // WP-243: the feature page opens on its diagram; WP-245: the strip's first tab when there is none
          },
          apply: (/** @type {any} */ frame) => {
            panelNode = frame.step?.node_id ?? null;
            const next = nextPanelTab({
              driven: drivenTab(frame.step, { engine, topk: topkMode, phaseIds, phaseId: frame.phase?.id ?? null, hasView, networkFirst, first: panelFirst }), // WP-245: the strip's first tab
              current: panelTab,
              manual: manualTab,
              node: panelNode,
            });
            manualTab = next.manual;
            if (next.tab !== panelTab) showPanelTab(next.tab);
          },
        });
      }
      // WP-244: the feature page's Side inputs tab - a panel that only listens: a step that lights a side-input box opens it, a step that names the sub-matrix opens the matrix, any other leaves the open one
      // (util/side-tab.js), unless the reader clicked one on this node; the tab is hidden while the trace carries no side input (the ids-only network, the top-K task)
      if (sideTabs) {
        sideHas = sideGroups(trace).length > 0;
        valuesHas = (trace.views?.network?.layers ?? []).length > 0; // WP-248: any trace with a diagram has the vectors to list (the ids-only network too)
        sideTabs.buttons.side.hidden = !sideHas;
        sideTabs.buttons.values.hidden = !valuesHas; // WP-248
        const sideOpts = { sideRows: sideRows(trace.views?.network), hasSide: sideHas, hasValues: valuesHas };
        panels.push({
          reset() {
            sideManual = null;
            sideNode = null;
            showSideTab("matrix");
          },
          apply: (/** @type {any} */ frame) => {
            sideNode = frame.step?.node_id ?? null;
            const next = nextPanelTab({ driven: sideDrivenTab(frame.step, sideOpts), current: sideTab, manual: sideManual, node: sideNode });
            sideManual = next.manual;
            if (next.tab !== sideTab) showSideTab(/** @type {import("../util/side-tab.js").SideTab} */ (next.tab));
          },
        });
      }
      // WP-158: two more listeners, one per lower box: what the step carries decides the Formula panel's tab (formula | latent space) and the Code panel's (code | training curve),
      // each on its own (util/panel-tab.js), unless the reader clicked one on this node
      if (lowerTabs) {
        const { curveFirst } = openingFor(trace, topkMode); // WP-243
        panels.push({
          reset() {
            lowerManual = { formula: null, code: null };
            lowerNode = null;
            showLowerTab("formula", "formula");
            showLowerTab("code", lowerOpeningTab("code", { hasCurve: !lowerOff.curve, curveFirst })); // WP-243: the feature page opens its code box on the training curve
          },
          apply: (/** @type {any} */ frame) => {
            lowerNode = frame.step?.node_id ?? null;
            // WP-158b: a box whose open tab has nothing at this step (the result step carries no formula and no source line) shows its second view once the walk has shown it
            const have = { hasLatent: !lowerOff.latent, hasCurve: !lowerOff.curve };
            const driven = {
              formula: lowerStepTab("formula", trace.steps, frame.index, have),
              code: lowerStepTab("code", trace.steps, frame.index, have),
            };
            for (const side of /** @type {const} */ (["formula", "code"])) {
              const next = nextLowerTab({ driven: driven[side], current: lowerShown[side], manual: lowerManual[side], node: lowerNode });
              lowerManual[side] = next.manual;
              if (next.tab !== lowerShown[side]) showLowerTab(side, next.tab);
            }
          },
        });
      }
      // The controls need the player instance, so they are created after it and fed from
      // onPosition instead of the panel list.
      /** @type {any} */
      let controls = null;
      player = createTracePlayer({
        trace,
        panels,
        stepEndKey: layoutF, // WP-107: the E key finishes the step (uCF / iCF; WP-123: MF / DNN)
        bursts: hybPage ? hybridBurstsFor(hybMethod()) : undefined, // WP-235a: the bases being fitted (and scored) are ONE click: their rows come one after the other
        burstMs: HYBRID_BURST_MS, // WP-235a
        onPosition: (index, sub) => {
          if (!mounted) return; // WP-43: never rewrite the URL once the page is gone
          if (controls) controls.apply(buildFrameLite(trace, index, sub));
          // keeps URL + store in sync; update() below is a no-op when the position already matches
          // WP-91: `nb` is read from the live route - `params` is the route this trace was loaded
          // from, and a neighbour chosen since would be wiped from the URL by every step
          ctx.router.replace(pageId, {
            ...params,
            ds: dataset,
            nb: routeParams.nb,
            vals: routeParams.vals, // WP-132: view state like `nb`: a choice made since this trace loaded stays in the URL
            reveal: routeParams.reveal, // WP-137a: the same for the held-out reveal setting
            stats: routeParams.stats, // WP-136: and for the statistic group's story
            panel: panelTabs ? panelParam(panelTab) : hybTabs ? hybTab : cbTabs && !topkMode ? cbTab : undefined, // WP-152: the tab on screen at this step (the player's or the reader's), so a link reopens it; WP-176: the content page's too (not in the top-K task: no tabs); WP-222: and the weighted hybrid's
            tbl: cbTableStrip && cbTablesHave.length ? cbTable : undefined, // WP-176 (stage 3): and its lower-right table
            fbox: lowerTabs ? lowerShown.formula : undefined, // WP-158: and the two lower boxes' tabs
            cbox: lowerTabs ? lowerShown.code : undefined,
            hbox: sideTabs ? sideTab : undefined, // WP-244: and the feature page's Side inputs strip
            step: index + (sub ? `.${sub}` : ""),
          });
        },
      });
      // WP-107: the finish-step button; (i): the candidate counter under the step counter, in the role colour of the candidates (the neighbours
      // of a uCF page are users, the candidate items of an iCF page are items)
      controls = createPlayerControls(els.controls, {
        i18n,
        player,
        trace,
        finishStep: layoutF,
        loops: hybPage ? hybridLoopsFor(hybMethod()) : undefined, // WP-222: the bases being fitted and the gradient steps are one step each of the counter; WP-222b: the switching walk's are the bases and the scores
        candidates: framed || cbPage ? (engine === "ucf" ? "user" : "item") : null, // WP-176: the content page's candidates are films
        hybrid: hybPage, // WP-235: "Iteration 15 / 30" / "Recommender 2 / 4" under the macro step counter
        training: framedTrained, topk: cbPage && topkMode, // WP-123: the epoch / stage counter under the macro step counter; WP-212: the content page's top-K walk counts its two loops (scoring, re-ranking) as one step each
      });
      controls.reset();
      const [stepIdx, subIdx] = parseStep(params.step);
      // WP-152: a link that names a tab (`panel`) opens on it at the step it names, as the reader's own click would (it holds until the walk leaves that node)
      const wantPanel = tabFromParam(params.panel, engine, panelFirst); // WP-245
      if (panelTabs && wantPanel && !(wantPanel === panelTabs.second && secondOff)) manualTab = { tab: wantPanel, node: stepNodes[stepIdx] ?? null };
      else if (panelTabs && stepIdx > 0) {
        // WP-154: a link to a step that names no `panel` opens on the tab the walk would have there (a step that drives neither tab leaves the open one, so it depends on the steps
        // before it): replay the walk up to the step and start from that
        const phaseIds = (trace.phases || []).map((/** @type {{id: string}} */ p) => p.id);
        const start = tabBefore(trace.steps, stepIdx, { engine, topk: topkMode, phaseIds, hasView: Boolean(trace.views?.[panelTabs.second]), networkFirst: openingFor(trace, topkMode).networkFirst, first: panelFirst }); // WP-243; WP-245: the strip's first tab
        if (start !== panelTab) showPanelTab(start);
      }
      // WP-244: and the Side inputs strip's - a link that names a tab (`hbox`) opens on it at the step it names, as the reader's own click would; a link that names none starts from the tab the walk would
      // have there (the walk is replayed up to the step)
      if (sideTabs) {
        const wantSide = sideTabFromParam(params.hbox);
        stepNodes = (trace.steps || []).map((/** @type {{node_id?: string}} */ st) => st.node_id ?? null);
        if (wantSide && (wantSide !== "side" || sideHas) && (wantSide !== "values" || valuesHas)) sideManual = { tab: wantSide, node: stepNodes[stepIdx] ?? null }; // WP-248: + values
        else if (stepIdx > 0) {
          const start = sideTabBefore(trace.steps, stepIdx, { sideRows: sideRows(trace.views?.network), hasSide: sideHas, hasValues: valuesHas }); // WP-248
          if (start !== sideTab) showSideTab(start);
        }
      }
      // WP-176 (stage 2): the same for the content page's tabs - a link that names one (`panel`) opens on it at the step it names, as the reader's own click would (it holds until the walk
      // leaves that node); a link that names none starts from the tab the walk would have there (the walk is replayed up to the step)
      if (cbTabs && !topkMode) {
        const wantCb = cbTabFromParam(params.panel, cbTabs.tabs);
        if (wantCb) cbManual = { tab: wantCb, node: stepNodes[stepIdx] ?? null };
        else if (stepIdx > 0) {
          const start = cbTabBefore(trace.steps, stepIdx, cbTabs.tabs);
          if (start !== cbTab) showCbTab(start);
        }
      }
      // WP-222: and the weighted hybrid's tabs - a link that names one (`panel`) opens on it at the step it names, as the reader's own click would; a link that names none starts from the tab the walk
      // would have there (the walk is replayed up to the step)
      if (hybTabs && !topkMode) {
        const wantHyb = hybridTabFromParam(params.panel, hybTabs.tabs); // WP-222b: a tab of the strip on screen (the other walk's `panel` means nothing here)
        if (wantHyb) hybManual = { tab: wantHyb, node: stepNodes[stepIdx] ?? null };
        else if (stepIdx > 0) {
          const start = hybridTabBefore(trace.steps, stepIdx);
          if (start !== hybTab) showHybridTab(start);
        }
      }
      // WP-176 (stage 3): and its lower-right table (`tbl`), the same way
      if (cbTableStrip && !topkMode) {
        const have = cbTablesFor(cbMethod()).filter((id) => trace.tables?.[id]);
        const wantTable = cbTableFromParam(params.tbl, have, cbMethod());
        if (wantTable) cbTableManual = { tab: wantTable, node: stepNodes[stepIdx] ?? null };
        else if (stepIdx > 0) {
          const start = cbTableBefore(trace.steps, stepIdx, have, cbMethod());
          if (start !== cbTable) showCbTable(start);
        }
      }
      // WP-158: a link that names a lower box's tab (`fbox` | `cbox`) opens on it at the step it names, as the reader's own click would; a link that names none starts from the tab the
      // walk would have there (a step that carries nothing for a box leaves the open tab, so it depends on the steps before it: the walk is replayed up to the step)
      if (lowerTabs) {
        for (const side of /** @type {const} */ (["formula", "code"])) {
          const { second, param } = LOWER_BOXES[side];
          const want = lowerFromParam(side, /** @type {Record<string, unknown>} */ (params)[param]);
          if (want && !(want === second && (second === "latent" ? lowerOff.latent : lowerOff.curve))) lowerManual[side] = { tab: want, node: stepNodes[stepIdx] ?? null };
          else if (stepIdx > 0) {
            const start = lowerTabBefore(side, trace.steps, stepIdx, { hasLatent: !lowerOff.latent, hasCurve: !lowerOff.curve, curveFirst: openingFor(trace, topkMode).curveFirst }); // WP-243
            if (start !== lowerShown[side]) showLowerTab(side, start);
          }
        }
      }
      player.goto(stepIdx, subIdx);
      // WP-107 (e2): the panels have reset (the table is built from the trace there) and the first frame is drawn: the divider's limits
      // and default are known now - and once more when the fonts are in (they change the head row's height)
      flowSplit?.refresh();
      requestAnimationFrame(() => flowSplit?.refresh());
      document.fonts?.ready.then(() => flowSplit?.refresh());
      // WP-105: a link that names a step (`step=`) opens with the player strip at the top of the page - once, on the
      // FIRST load after the page is mounted (a later load is the router completing the URL, or a new pair). Stepping
      // never scrolls the page.
      if (!stripRevealed) {
        stripRevealed = true;
        if (params.step !== undefined && els.strip) els.strip.scrollIntoView({ block: "start" });
      }

      // WP-91 stage 2: data-quality flags of the candidate items. One request after the table is
      // built; a failure (a static bundle has no such endpoint) just leaves the table unflagged.
      if (engine === "icf") {
        const cols = (trace.tables?.items?.rows || []).map((/** @type {any} */ r) => r.col).filter(Number.isInteger);
        if (cols.length) {
          api
            .itemFlags(dataset, { items: cols.join(",") })
            .then((/** @type {any} */ res) => {
              if (current()) table.setFlags(res.items || {}); // WP-97: not onto a table that was replaced
            })
            .catch(() => {});
        }
      }

      // WP-41 (users) / WP-42 (items): every catalogue measure for one pair, next to the trace.
      // WP-45: cb has no such panel (see the layout() comment) - `heatTabs` does not exist there.
      // WP-105: the film sets (uCF) / the users who rated both items (iCF) are the heat panel's 2nd tab, the pair table its 3rd (WP-115 1).
      if (heatTabs) {
        if (!pairFilms) {
          pairFilms = createPairFilms(heatTabs.filmsHost, {
            i18n,
            api,
            mode: engine === "icf" ? "raters" : "films",
            layout: "columns",
          });
        }
        if (!pairPanel) {
          pairPanel = createPairSimilarities(heatTabs.simsHost, {
            i18n,
            api,
            kind: engine === "ucf" ? "user" : "item",
            onNeighbour: writeNeighbour, // WP-91
            onPair, // WP-105
            active: heatTab === "sims", // asked for only while its tab is the one on screen
            infoTip, // WP-114: the (i) beside the co-rated count (what the table is, what a foil is)
          });
        }
        const rows = trace.tables?.[tableId]?.rows || [];
        pairPanel.update({
          dataset,
          user: Number(params.u),
          item: Number(params.i),
          mc: params.mc || "dynamic",
          cz: configFromParams(params).constrained_centre, // WP-110 (b''): the same parse as the trace request's; the table's constrained row follows the centre
          neighbour: neighbourParam(routeParams.nb), // WP-91: the live route, not the load-time one
          candidates:
            engine === "ucf"
              ? rows.map((r) => ({ index: r.row, label: r.user }))
              : rows.filter((r) => r.col !== undefined).map((r) => ({ index: r.col, label: r.item })),
        });
      }
    } catch (err) {
      if (!current()) return; // WP-97: a failed old request must not overwrite the newer trace's screen
      const message = errorText(err);
      // WP-146: a trace that would train on more ratings than the page allows is not a failure: the server asks for the person's word (413 `trace_too_large`). The reason is an
      // inline warning under the Parameters panel with the ways on, not a toast; an older server (no stored models) keeps the toast and its sentence.
      const tooLarge = stored && isTooLarge(err);
      if (tooLarge) showLargeWarning(/** @type {any} */ (err).params || {});
      void refreshModels(); // a failed request may be the first word of a changed list (`pretrained_missing`: the file was deleted)
      if (!replaced && player && tooLarge) {
        // WP-161: the server did not fail - it wants the person's word before it trains for THIS pair. The title names this pair (the name lookups paint it: `givenBack` stays false,
        // the old title is NOT given back), and the trace on screen belongs to the pair before: it stays frozen, faded and stamped "previous pair" (the summary bar, the held-out
        // chip, the player strip with it) until a decision - Train anyway, the pretrained model, the class set - starts a request, which makes the page its own again.
        traceLoading?.refused({ lead: i18n.t("trace.previous_pair"), text: i18n.t("trace.previous_pair_text") });
        return;
      }
      if (!replaced && player) {
        // WP-140: the request failed before the old trace was replaced: it is the page's again (unfrozen, no longer faded), the reason is in the toast
        player.unlock();
        givenBack = true;
        if (keepTitle) els.title.replaceChildren(...keepTitle);
        traceLoading?.fail({ lead: i18n.t("trace.failed_stamp"), text: i18n.t("trace.failed_stamp_text") }); // WP-222: the strip keeps a stamp until a request succeeds (the toast is four seconds)
        if (!tooLarge) showToast(i18n.t("trace.failed", { message }), "error");
        return;
      }
      traceLoading?.broken(); // WP-140: no trace on screen
      els.narration.textContent = tooLarge ? i18n.t("trace.large_waiting") : i18n.t("trace.failed", { message });
      if (!tooLarge) showToast(i18n.t("trace.failed", { message }), "error");
      targetRated = null; // WP-109 (6): the pair on the page has no trace: the chips claim nothing
      paramForm?.setTargetRated(null);
      dataTrace = null; // WP-242: the Data row shows the settings alone
      renderDataRow();
    }
  }

  /**
   * WP-146: the inline warning of a trace the server will not train unasked. "Train anyway" repeats THIS request with the person's word (`confirm_large`) and the word then holds for
   * the rest of the page's session on this data set, engine and resolved settings (util/model-source.js `confirmScope`: a new user or film does not ask again, a changed data set,
   * engine or setting does, a reload does; the server's hard ceiling is never confirmable); "Use the pretrained model" asks for the stored one (the route's `model`); "Switch to the
   * class set" moves the header's data set selector, and the page follows it like it does for any other change of it (a new pair is chosen on the new data).
   * @param {Record<string, any>} errParams the 413's `params`
   */
  function showLargeWarning(errParams) {
    if (!largeWarning) return;
    const classSet = classSetFor(datasetList, trainLimit);
    // WP-146: EASE has no stored model, so for it neither "a stored model cannot answer a rated film" nor "fit it beforehand" means anything
    const ease = engine === "mf" && (routeParams.alg || engineDefaults?.algorithm || "funk_svd") === "ease";
    const offer = largeOffer(errParams, { classSet, storable: !ease });
    const key = loadedKey;
    largeWarning.show({
      algorithm: algorithmName({ engine, params: routeParams, defaults: engineDefaults, t: (k, p) => ctx.i18n.t(k, p) }),
      params: errParams,
      offer,
      onTrain: () => {
        if (key === null || key !== loadedKey) return; // the route moved on while the warning was open (a new request has taken it away already)
        confirmed = { scope: confirmScopeOf(routeParams), estimate: offer.estimate };
        void loadTrace(routeParams);
      },
      onPretrained: () => navigateWith({ model: "pretrained" }),
      onClass: () => {
        if (classSet) ctx.store.set({ dataset: classSet });
      },
    });
  }

  /**
   * @param {any} trace
   * @param {number} index
   * @param {number} sub
   */
  function buildFrameLite(trace, index, sub) {
    const phase = trace.phases.reduce((acc, p) => (p.first_step <= index ? p : acc), trace.phases[0]);
    return { index, sub, total: trace.steps.length, step: trace.steps[index], phase };
  }

  /** @param {string | undefined} raw */
  function parseStep(raw) {
    if (!raw) return [0, 0];
    const [a, b] = String(raw).split(".");
    return [Number(a) || 0, Number(b) || 0];
  }

  const page = {
    /**
     * @param {HTMLElement} rootEl
     * @param {any} context
     */
    mount(rootEl, context) {
      root = rootEl;
      ctx = context;
      routeParams = ctx.store?.get?.().route?.params || routeParams; // WP-177b: the strip's tabs are built for the route's method
      mounted = true;
      traceSeq += 1; // WP-97: answers still in flight from an earlier visit belong to nobody
      paramsSeq += 1;
      pickSeq += 1;
      storeDataset = null; // WP-115 (12)
      userPicker = null;
      itemPicker = null;
      savedWalks = null; // WP-192
      randomBtn = null;
      seedNode = null; // WP-203 (`walkCycle` stays: see its declaration)
      pairPanel = null;
      pairFilms = null; // WP-105
      pairState = null;
      filmsKey = null;
      heatTab = "matrix";
      flowSplit = null; // WP-107 (e2)
      sigTip = null; // WP-108 (b)
      flowchartRef = null; // WP-107 (g2)
      heatRef = null; // WP-132
      task = "predict"; // WP-141
      taskSwitch = null; // WP-141a
      traceLoading = null; // WP-140 (layout() builds the strip)
      engineDefaults = null;
      largeWarning = null; // WP-146 (layout() builds the warning)
      confirmed = null;
      modelList = null;
      modelsFor = null;
      lastModel = null;
      datasetList = [];
      trainLimit = undefined;
      flowObserver?.disconnect();
      paramsKey = null;
      paramForm = null; // WP-109
      dataRow = null; // WP-242
      dataTrace = null;
      targetRated = null;
      prefillKey = null; // WP-83c
      stripRevealed = false; // WP-105
      defaultPairTried = false; // WP-243
      layout();
    },
    /** @param {any} state */
    update(state) {
      if (!mounted || !root) return;
      routeParams = state.route.params || {};
      repaintNetworkTip?.(); // WP-231: a click between the two neural rows changes only `arch`
      hybTabs?.repaintBridge(); // WP-239: the switching walk's bridge sentence follows the rule (Apply keeps the page)
      // WP-177b: a click on the other child of the sidebar is the same page with another `m`: the tabs belong to the method, so the page is built again (the old trace and its
      // player go) and the new one starts from Setup; the remount re-enters update() with the method it is built for, so there is no loop
      if ((cbPage && layoutMethod !== null && layoutMethod !== cbLayout()) || (hybPage && layoutMethod !== null && layoutMethod !== hybMethod()) || (engine === "dnn" && layoutMethod !== null && layoutMethod !== dnnLayout())) { // WP-245: the neural page's two rows (and a Network type chosen in the form) put the Network tab in different panels // WP-222b: the hybrid's two walks have different strips, so a method change rebuilds the page as the content page's does
        const keepRoot = root;
        const keepCtx = ctx;
        page.unmount();
        page.mount(keepRoot, keepCtx);
        page.update(state);
        return;
      }
      // WP-115 (12): the header's dataset selector only sets the store; this page's own links always carry `ds`, so a change of the selector used to be ignored once the
      // URL named a dataset. On the first update a deep link to a dataset the selector does not show moves the SELECTOR (what the header says is what the page shows); on
      // later ones a new store dataset moves the URL: new `ds`, no pair (the dense indices belonged to the old dataset), every parameter kept, and the page starts again
      // from Setup (the old trace, the player, the pickers go). The store / route change re-enters update() - hence the returns.
      const knownDataset = (/** @type {string} */ name) => (state.meta?.datasets || []).some((/** @type {any} */ x) => x.name === name);
      const follow = followDataset({ seen: storeDataset, store: state.dataset, route: routeParams.ds, known: knownDataset });
      storeDataset = follow.seen;
      if (follow.action === "adopt") {
        ctx.store.set({ dataset: follow.seen });
        return;
      }
      if (follow.action === "follow") {
        const nextRoute = routeForDataset(routeParams, follow.seen);
        const keepRoot = root;
        const keepCtx = ctx;
        page.unmount();
        page.mount(keepRoot, keepCtx);
        ctx.router.replace(pageId, nextRoute);
        return;
      }
      dataset = routeParams.ds || state.dataset || "";
      if (!dataset) return;
      features = state.meta?.features || {}; // WP-84
      datasetList = state.meta?.datasets || []; // WP-146: the class set the "too large" warning leads to, within the training limit
      trainLimit = state.meta?.trace_limits?.max_train_ratings;
      if (trained && pretrainedOffered({ features }, engine) && modelsFor !== dataset) {
        modelsFor = dataset; // WP-146: the stored models of this data set (asked again after every trace)
        modelList = null;
        void refreshModels();
      }
      // WP-141: the task the route names, when the server offers it for this engine (a server without `engine_tasks` offers none: the page is what it was)
      const offered = topkOffered(state.meta, engine);
      syncTask(state.meta, taskFor(routeParams.task, offered, openingTask(engine, routeParams))); // WP-166: a neural route that names no task and no film is top-K
      ensurePickers(state);
      refreshSavedWalks(); // WP-192: the form may have changed (a route parameter, the task): the saved walks it has are asked again
      // WP-84: the item filter's genre vocabulary comes from /stats, only with the flag on
      const genresPromise =
        features.attribute_filter && engine === "ucf" ? genresFor(dataset) : Promise.resolve([]);
      const paramsMine = ++paramsSeq; // WP-97: the newest update's genres (its dataset) win, whatever the arrival order
      const datasetScale = state.meta?.datasets?.find((/** @type {any} */ x) => x.name === dataset)?.scale ?? null; // WP-110 (b'')
      ratingScale = datasetScale; // WP-122
      Promise.all([loadConfig(ctx.api), genresPromise]).then(([cfg, genres]) => {
        if (mounted) engineDefaults = defaultsFor(cfg) ?? null; // WP-140
        if (mounted && paramsMine === paramsSeq) renderParams(cfg, routeParams, genres, datasetScale);
      });
      // WP-141: the top-K task needs a user only (no film)
      const hasPair = routeParams.u !== undefined && routeParams.u !== "" && (task === "topk" || (routeParams.i !== undefined && routeParams.i !== ""));
      if (!hasPair) {
        // WP-166a: a trace is on screen (or on its way) and the route no longer names a pair - the task switch left top-K without a film, or the reader went back to a route without
        // one: its panels (the ranked list, the player, the flowchart) belong to a pair the route does not have, under an idle strip that says "pick a user and a film". The page starts
        // again from Setup, like after a dataset change. `unmount` clears `loadedKey`, so the pass below takes the idle branch: no loop.
        if (loadedKey !== null) {
          const keepRoot = root;
          const keepCtx = ctx;
          page.unmount();
          page.mount(keepRoot, keepCtx);
          page.update(state);
          return;
        }
        // WP-45: the nav id ("content") and the trace engine alias ("cb") differ for this page,
        // unlike ucf/icf where both strings coincide - map back to the nav key explicitly.
        els.title.textContent = ctx.i18n.t(`nav.${engine === "cb" ? (cbMethod() === "profile" ? "content_profile" : cbMethod() === "model" ? "content_model" : "content_item") : hybPage ? `combine_${hybMethod()}` : dnnFeatures() ? "combine_dnn" : engine}`); // WP-222: the hybrid's idle name is its sidebar row's; WP-223: so is the feature network's
        els.summary.innerHTML = "";
        if (layoutF) showIdleNarration(els.narration, ctx.i18n); // WP-109 (10): the strip is never empty: "Setup" + what to do
        void prefillPickers(); // WP-83c: `#/ucf?u=N` / `#/icf?i=N` shows that entity in its picker
        if (!defaultPairTried && wantsDefaultPair({ engine, params: routeParams })) void openOnDefaultPair(state); // WP-243: the feature page reached by the sidebar opens on a pair
        return;
      }
      // WP-91: `nb` (the pair panel's neighbour) is view state like `step`, not part of the trace; WP-132: so is `vals` (the sub-matrix's raw | centred)
      // WP-137a: and so is `reveal` (the held-out reveal setting: step | start); the setting is read here, before the trace loads, so a deep link opens in it
      // WP-152: and so is `panel` (the sub-matrix panel's open tab on the MF page: matrix | factors)
      // WP-158: and so are `fbox` | `cbox` (the Formula panel's and the Code panel's open tab on the MF and the neural page)
      const { step, nb, vals, reveal, stats, panel, tbl, fbox, cbox, hbox, ...rest } = routeParams; // WP-176 (stage 3): `tbl` (the content page's lower-right table) is view state like `panel` // WP-244
      const wantReveal = revealModeFor(reveal);
      if (wantReveal !== revealMode) setRevealMode(wantReveal); // an edited / back-forward `reveal`
      // WP-141: `task`, `k` and `cand` are in `rest` (request parameters); in the top-K task the film is no part of the request
      // WP-166: the key names the task the page RUNS (not the route's word: `task=topk` and the neural page's implied top-K are one request)
      const { i: _film, task: _word, ...restTopk } = rest; // eslint-disable-line no-unused-vars
      const { task: _word2, ...restPredict } = rest; // eslint-disable-line no-unused-vars
      const key = JSON.stringify([engine, dataset, task, task === "topk" ? restTopk : restPredict]);
      if (key !== loadedKey) {
        loadedKey = key;
        loadTrace(routeParams);
      } else if (player && !traceLoading?.frozen()) {
        // (WP-140: a trace that is waiting for its successor is frozen - the route's step / view changes wait too; WP-161: so is the previous pair's, after a refusal)
        const [stepIdx, subIdx] = parseStep(step);
        const st = player.state();
        // WP-152: a `panel` that differs from the tab on screen is an edited link (the player's own writes always name the tab on screen): it is the reader's choice at the
        // step the link names, so it is taken BEFORE the walk moves there (the move would otherwise decide the tab and the stale `panel` undo it)
        const wantPanel = tabFromParam(panel, engine, panelFirst); // WP-245
        const panelEdited = Boolean(panelTabs) && wantPanel !== null && wantPanel !== panelTab && panelTabs?.buttons[wantPanel].getAttribute("aria-disabled") !== "true";
        if (panelEdited && wantPanel) manualTab = { tab: wantPanel, node: stepNodes[stepIdx] ?? null };
        // WP-244: and the Side inputs strip's - an `hbox` that differs from the tab on screen is an edited link
        const wantSide = sideTabs ? sideTabFromParam(hbox) : null;
        const sideEdited = wantSide !== null && wantSide !== sideTab && (wantSide !== "side" || sideHas) && (wantSide !== "values" || valuesHas); // WP-248: + values
        if (sideEdited && wantSide) sideManual = { tab: wantSide, node: stepNodes[stepIdx] ?? null };
        // WP-176 (stage 2): and the content page's tabs - a `panel` that differs from the tab on screen is an edited link
        const wantCb = cbTabs ? cbTabFromParam(panel, cbTabs.tabs) : null;
        const cbEdited = wantCb !== null && wantCb !== cbTab;
        if (cbEdited && wantCb) cbManual = { tab: wantCb, node: stepNodes[stepIdx] ?? null };
        // WP-222: and the weighted hybrid's tabs - a `panel` that differs from the tab on screen is an edited link
        const wantHyb = hybTabs ? hybridTabFromParam(panel, hybTabs.tabs) : null; // WP-222b: of the strip on screen
        const hybEdited = wantHyb !== null && wantHyb !== hybTab;
        if (hybEdited && wantHyb) hybManual = { tab: wantHyb, node: stepNodes[stepIdx] ?? null };
        // WP-176 (stage 3): and the lower-right table's - a `tbl` that differs from the table on screen is an edited link
        const wantTbl = cbTableStrip ? cbTableFromParam(tbl, cbTablesHave, cbMethod()) : null;
        const tblEdited = wantTbl !== null && wantTbl !== cbTable;
        if (tblEdited && wantTbl) cbTableManual = { tab: wantTbl, node: stepNodes[stepIdx] ?? null };
        // WP-158: the same for the two lower boxes: an `fbox` | `cbox` that differs from the tab on screen is an edited link (the player's own writes always name the tab on screen)
        /** @type {("formula" | "code")[]} */
        const lowerEdited = [];
        if (lowerTabs) {
          for (const side of /** @type {const} */ (["formula", "code"])) {
            const { second } = LOWER_BOXES[side];
            const want = lowerFromParam(side, side === "formula" ? fbox : cbox);
            const off = second === "latent" ? lowerOff.latent : lowerOff.curve;
            if (want && want !== lowerShown[side] && !(want === second && off)) {
              lowerManual[side] = { tab: want, node: stepNodes[stepIdx] ?? null };
              lowerEdited.push(side);
            }
          }
        }
        if (st.index !== stepIdx || st.sub !== subIdx) player.goto(stepIdx, subIdx);
        else {
          if (panelEdited && wantPanel) showPanelTab(wantPanel);
          if (sideEdited && wantSide) showSideTab(wantSide); // WP-244
          if (cbEdited && wantCb) showCbTab(wantCb);
          if (hybEdited && wantHyb) showHybridTab(wantHyb);
          if (tblEdited && wantTbl) showCbTable(wantTbl);
          for (const side of lowerEdited) if (lowerManual[side]) showLowerTab(side, /** @type {NonNullable<typeof lowerManual.formula>} */ (lowerManual[side]).tab);
        }
        if (pairPanel) pairPanel.setNeighbour(neighbourParam(nb)); // WP-91: an edited / back-forward `nb`
        if (heatRef) {
          const want = modeFor(engine, vals); // WP-132: an edited / back-forward `vals`
          if (heatRef.mode() !== want) heatRef.setMode(want);
          const wantStats = statsModeFor(stats); // WP-136: an edited / back-forward `stats`
          if (heatRef.statsMode() !== wantStats) heatRef.setStatsMode(wantStats);
        }
      }
    },
    unmount() {
      // WP-43 finding: mark the page dead BEFORE destroying the player - a frame emitted during
      // destroy used to reach onPosition -> router.replace and drag the URL back to this trace
      // while the user was navigating to another page.
      mounted = false;
      traceSeq += 1; // WP-97
      paramsSeq += 1;
      pickSeq += 1;
      if (player) player.destroy();
      player = null;
      traceLoading?.reset(); // WP-140: no timer of the strip outlives the page
      largeWarning?.hide(); // WP-146
      confirmed = null;
      loadedKey = null;
      flowObserver?.disconnect(); // WP-107 (e2)
      flowObserver = null;
      flowSplit = null;
      heatRef = null; // WP-132
      paramForm = null; // WP-109
      dataRow = null; // WP-242
      dataTrace = null;
      repaintNetworkTip = null; // WP-231
      if (root) root.innerHTML = "";
    },
  };
  return page;
}
