// @ts-check
// WP-48: Metrics page. Two things live here:
//   1. the traced evaluation sweep - ONE protocol run (temporal split -> fit on train -> score the
//      test cells) played step by step with the shared TracePlayer panels: the ranked-list walk of
//      one user (@K metrics, then the average over the test users) or the threshold sweep over the
//      pooled test cells (ROC / PR / AUC, the "binarised = one point" lesson), plus the ROC/PR
//      curves revealed point by point and (threshold mode) the live confusion matrix;
//   2. the baseline battery - every engine under the same protocol (>= 5 seeds), paired against a
//      reference (Wilcoxon / paired t / Cohen's d, Holm across engines), read from runs/ and, on a
//      live server, runnable from the page for small datasets.
// The route is the single source of truth: `ds`, `mode` (rank|threshold), `eng`, `u` (dense row,
// rank mode), `thr`, `ks` ("10,20"), `seed`, `tf` (test share), `mr` (min ratings), `step`, and for
// the battery `ref` (reference engine) + `bm` (metric of the comparison table). `bodyFromParams`
// builds the COMPLETE SweepRequest the API expects - the static export matches on exactly this
// object (canonical JSON), so its defaults come from config/metrics.yaml on both sides.
// Page object contract: `{mount(root, ctx), update(state), unmount()}` (WP-32).

import { createCodePanel } from "../components/code-panel.js";
import { createConfusionPanel } from "../components/confusion-panel.js";
import { createDataTable } from "../components/data-table.js";
import { createEntityPicker } from "../components/entity-picker.js";
import { createFlowchart } from "../components/flowchart.js";
import { createFormulaPanel } from "../components/formula-panel.js";
import { createHeatGrid } from "../components/heat-grid.js";
import { createNarration } from "../components/narration.js";
import { createPlayerControls } from "../components/player-controls.js";
import { createRocPanel } from "../components/roc-panel.js";
import { showToast } from "../components/toast.js";
import { createTracePlayer } from "../components/trace-player.js";
import { fmt } from "../util/format.js";
import { createPanel } from "../util/panel.js";

/** i18n label of every evaluation engine name (`i2rs.metrics.factory.ENGINE_NAMES`). */
const ENGINE_LABEL_KEYS = {
  popularity: "metrics.engine_popularity",
  user_knn: "nav.ucf",
  item_knn: "nav.icf",
  content_based: "nav.content",
  funk_svd: "params.alg_funk_svd",
  als: "params.alg_als",
  bpr: "params.alg_bpr",
  ease: "params.alg_ease",
  dnn: "nav.dnn",
};

/**
 * Route params -> the complete SweepRequest body (every key present, numbers as numbers).
 * Defaults come from `/api/config/metrics` (`sweep` block) - the same file the server completes a
 * partial export entry with, so live and static see one canonical object.
 * @param {Record<string, string>} params
 * @param {any} cfg  /api/config/metrics
 * @returns {Record<string, unknown>}
 */
export function bodyFromParams(params, cfg) {
  const d = (cfg && cfg.sweep) || {};
  const split = { ...(d.split || {}) };
  if (params.tf !== undefined && params.tf !== "") split.test_frac = Number(params.tf);
  if (params.mr !== undefined && params.mr !== "") split.min_ratings = Number(params.mr);
  const ksRaw = params.ks
    ? String(params.ks)
        .split(",")
        .map((k) => Number(k.trim()))
        .filter((k) => Number.isInteger(k) && k > 0)
    : [];
  const mode = params.mode === "threshold" ? "threshold" : params.mode === "rank" ? "rank" : d.mode || "rank";
  return {
    mode,
    engine: params.eng || d.engine || "popularity",
    engine_config: {},
    split,
    seed: params.seed !== undefined && params.seed !== "" ? Number(params.seed) : Number(d.seed ?? 0),
    // the walked user only matters in rank mode; keeping it null otherwise keeps cache keys stable
    user: mode === "rank" && params.u !== undefined && params.u !== "" ? Number(params.u) : null,
    threshold: params.thr !== undefined && params.thr !== "" ? Number(params.thr) : null,
    ks: ksRaw.length ? ksRaw : (d.ks || [10, 20]).map((k) => Number(k)),
  };
}

/** @type {Promise<any> | null} */
let formulasPromise = null;
/** @param {any} api */
function loadFormulas(api) {
  if (!formulasPromise) formulasPromise = api.formulas();
  return formulasPromise;
}

/** @param {number | null | undefined} p */
function fmtP(p) {
  if (p === null || p === undefined || Number.isNaN(p)) return "—";
  return p < 1e-4 ? "<0.0001" : p.toFixed(4);
}

export function createMetricsPage() {
  /** @type {HTMLElement | null} */
  let root = null;
  /** @type {any} */
  let ctx = null;
  /** @type {any} */
  let els = null;
  /** @type {any} */
  let player = null;
  /** @type {any} */
  let userPicker = null;
  /** @type {any} */
  let cfg = null;
  /** @type {Record<string, string>} */
  let routeParams = {};
  let dataset = "";
  let lang = "";
  let loadedKey = "";
  let controlsKey = "";
  let batteryKey = "";
  /** @type {any} */
  let battery = null;
  let mounted = false;
  // WP-97: tickets of the newest sweep trace / battery request. An older answer (a slower earlier request, one asked
  // before an unmount / re-mount, a battery run that finishes after the route moved on) is dropped instead of being
  // drawn over what the route names now; mount and unmount take a ticket too
  let traceSeq = 0;
  let batterySeq = 0;

  // ── layout ──────────────────────────────────────────────────────────────────────────────────

  /**
   * @param {HTMLElement} rootEl
   * @param {any} context
   */
  function mount(rootEl, context) {
    root = rootEl;
    ctx = context;
    mounted = true;
    traceSeq += 1; // WP-97
    batterySeq += 1;
    loadedKey = "";
    controlsKey = "";
    batteryKey = "";
    battery = null;
    userPicker = null;
    root.innerHTML = "";
    const { i18n } = context;
    const page = document.createElement("div");
    page.className = "metrics-page";
    const title = document.createElement("h2");
    title.className = "trace-title";
    const protocol = createPanel("metrics-protocol", "", i18n.t("metrics.protocol"), true);
    protocol.body.classList.add("param-form");
    const summary = document.createElement("div");
    summary.className = "trace-summary";
    const grid = document.createElement("div");
    grid.className = "trace-layout metrics-layout";
    const narration = createPanel("narration", "trace-panel area-narration");
    const controls = createPanel("controls", "trace-panel area-controls");
    const heat = createPanel("heat", "trace-panel area-heat", i18n.t("metrics.panel_list"));
    const flow = createPanel("flow", "trace-panel area-flow", i18n.t("panel.flowchart"));
    const curves = createPanel("curves", "trace-panel area-curves", i18n.t("metrics.panel_curves"));
    const formula = createPanel("formula", "trace-panel area-formula", i18n.t("panel.formula"));
    const confusion = createPanel("confusion", "trace-panel area-confusion", i18n.t("metrics.panel_confusion"));
    const code = createPanel("code", "trace-panel area-code", i18n.t("panel.code"));
    const table = createPanel("table", "trace-panel area-table");
    const tableMain = document.createElement("div");
    const tableSecond = document.createElement("div");
    tableSecond.style.marginTop = "10px";
    table.body.append(tableMain, tableSecond);
    grid.append(
      narration.box,
      controls.box,
      heat.box,
      flow.box,
      curves.box,
      formula.box,
      confusion.box,
      code.box,
      table.box
    );
    const batteryPanel = createPanel("metrics-battery", "", i18n.t("metrics.battery_title"), true);
    const bIntro = document.createElement("p");
    bIntro.className = "pitfalls-intro";
    const bControls = document.createElement("div");
    bControls.className = "battery-controls";
    const bStatus = document.createElement("div");
    bStatus.className = "trace-summary";
    const bTables = document.createElement("div");
    const bNotes = document.createElement("div");
    bNotes.className = "battery-notes";
    batteryPanel.body.append(bIntro, bControls, bStatus, bTables, bNotes);
    page.append(title, protocol.box, summary, grid, batteryPanel.box);
    root.appendChild(page);
    els = {
      title,
      protocol: protocol.body,
      summary,
      grid,
      narration: narration.body,
      controls: controls.body,
      heat: heat.body,
      heatHead: /** @type {HTMLElement} */ (heat.box.querySelector("h3")),
      flow: flow.body,
      curves: curves.body,
      formula: formula.body,
      confusion: confusion.body,
      confusionBox: confusion.box,
      code: code.body,
      tableMain,
      tableSecond,
      bIntro,
      bControls,
      bStatus,
      bTables,
      bNotes,
    };
  }

  /** @param {any} state */
  function update(state) {
    if (!mounted || !root || !ctx) return;
    routeParams = state.route.params || {};
    dataset = routeParams.ds || state.dataset || "";
    lang = state.lang || "en";
    if (!dataset) return;
    ensureConfig().then(() => {
      if (!mounted) return;
      renderControls();
      const body = bodyFromParams(routeParams, cfg);
      const key = JSON.stringify([dataset, body]);
      if (key !== loadedKey) {
        loadedKey = key;
        loadTrace(body);
      } else if (player) {
        const [stepIdx, subIdx] = parseStep(routeParams.step);
        const st = player.state();
        if (st.index !== stepIdx || st.sub !== subIdx) player.goto(stepIdx, subIdx);
      }
      loadBattery(false);
    });
  }

  function unmount() {
    mounted = false; // before destroying the player (WP-43 finding: no farewell router.replace)
    traceSeq += 1; // WP-97
    batterySeq += 1;
    if (player) player.destroy();
    player = null;
    loadedKey = "";
    if (root) root.innerHTML = "";
    root = null;
    ctx = null;
    els = null;
  }

  async function ensureConfig() {
    if (cfg) return;
    cfg = await ctx.api.metricsConfig();
  }

  /** @param {Record<string, string | undefined>} patch */
  function navigateWith(patch) {
    const next = { ...routeParams, ...patch, ds: dataset };
    delete next.step;
    ctx.router.navigate("metrics", next);
  }

  /** @param {unknown} err */
  function errorText(err) {
    if (err && typeof err === "object" && "messageKey" in err) {
      return ctx.i18n.t(/** @type {any} */ (err).messageKey, /** @type {any} */ (err).params);
    }
    return err instanceof Error ? err.message : String(err);
  }

  /** @param {string} name */
  function engineLabel(name) {
    const key = ENGINE_LABEL_KEYS[name];
    return key ? ctx.i18n.t(key) : name;
  }

  // ── protocol form ───────────────────────────────────────────────────────────────────────────

  function renderControls() {
    const { i18n } = ctx;
    const body = bodyFromParams(routeParams, cfg);
    const key = JSON.stringify([lang, body, dataset]);
    if (key === controlsKey) return;
    controlsKey = key;
    const rootEl = els.protocol;
    rootEl.innerHTML = "";
    userPicker = null;

    /**
     * @param {string} labelKey
     * @param {HTMLElement} control
     */
    function field(labelKey, control) {
      const wrap = document.createElement("label");
      wrap.className = "param-field";
      const span = document.createElement("span");
      span.textContent = i18n.t(labelKey);
      wrap.append(span, control);
      return wrap;
    }
    /** @param {string} value @param {string} step @param {string} min @param {string} [max] */
    function number(value, step, min, max) {
      const el = document.createElement("input");
      el.type = "number";
      el.value = value;
      el.step = step;
      el.min = min;
      if (max) el.max = max;
      return el;
    }

    let mode = String(body.mode);
    const modeSeg = document.createElement("div");
    modeSeg.className = "miniseg";
    const userField = document.createElement("div");
    userField.className = "param-field";
    for (const [v, k] of [
      ["rank", "metrics.mode_rank"],
      ["threshold", "metrics.mode_threshold"],
    ]) {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = i18n.t(k);
      b.classList.toggle("active", v === mode);
      b.addEventListener("click", () => {
        mode = v;
        for (const other of modeSeg.querySelectorAll("button")) other.classList.toggle("active", other === b);
        userField.hidden = mode !== "rank";
      });
      modeSeg.appendChild(b);
    }
    const engSel = document.createElement("select");
    const engines = ((cfg.battery && cfg.battery.engines) || []).map((/** @type {any} */ e) => e.name);
    for (const name of engines) {
      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = engineLabel(name);
      opt.selected = name === body.engine;
      engSel.appendChild(opt);
    }
    // the walked user (rank mode): any user; the server auto-picks when none is chosen
    const userLabel = document.createElement("span");
    userLabel.textContent = i18n.t("metrics.user");
    const pickerHost = document.createElement("div");
    userField.append(userLabel, pickerHost);
    userField.hidden = mode !== "rank";
    userPicker = createEntityPicker(pickerHost, {
      i18n,
      api: ctx.api,
      kind: "user",
      dataset,
      guards: { minRatings: 0, requireClass: false, minRaters: 0, ratedByUser: false },
      onSelect: (/** @type {number} */ index) => navigateWith({ u: String(index), mode: "rank" }),
    });
    const autoNote = document.createElement("span");
    autoNote.className = "sub";
    autoNote.textContent = i18n.t("metrics.user_auto");
    userField.appendChild(autoNote);

    const thrIn = number(body.threshold === null ? "" : String(body.threshold), "0.5", "0.5", "5");
    thrIn.placeholder = String(cfg.sweep?.threshold ?? "3.5");
    const ksIn = document.createElement("input");
    ksIn.type = "text";
    ksIn.value = /** @type {number[]} */ (body.ks).join(",");
    const seedIn = number(String(body.seed), "1", "0");
    const split = /** @type {any} */ (body.split);
    const tfIn = number(String(split.test_frac ?? 0.2), "0.05", "0.05", "0.9");
    const mrIn = number(String(split.min_ratings ?? 5), "1", "1");

    const grid = document.createElement("div");
    grid.className = "param-grid";
    grid.append(
      field("metrics.mode", modeSeg),
      field("metrics.engine", engSel),
      userField,
      field("metrics.threshold", thrIn),
      field("metrics.ks", ksIn),
      field("metrics.seed", seedIn),
      field("metrics.test_frac", tfIn),
      field("metrics.min_ratings", mrIn)
    );
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
    rootEl.append(grid, actions);

    function collect() {
      const ks = ksIn.value
        .split(",")
        .map((k) => Number(k.trim()))
        .filter((k) => Number.isInteger(k) && k > 0);
      return {
        mode,
        eng: engSel.value,
        thr: thrIn.value === "" ? undefined : String(Number(thrIn.value)),
        ks: ks.length ? ks.join(",") : undefined,
        seed: String(Math.max(0, Math.round(Number(seedIn.value) || 0))),
        tf: String(Number(tfIn.value) || 0.2),
        mr: String(Math.max(1, Math.round(Number(mrIn.value) || 5))),
      };
    }
    apply.addEventListener("click", () => navigateWith(collect()));
    reset.addEventListener("click", () =>
      navigateWith({ mode: undefined, eng: undefined, u: undefined, thr: undefined, ks: undefined, seed: undefined, tf: undefined, mr: undefined })
    );
    rootEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && /** @type {HTMLElement} */ (e.target).tagName === "INPUT" && !pickerHost.contains(/** @type {Node} */ (e.target))) {
        e.preventDefault();
        navigateWith(collect());
      }
    });
  }

  // ── the sweep trace ─────────────────────────────────────────────────────────────────────────

  /** @param {Record<string, unknown>} body */
  async function loadTrace(body) {
    const { api, i18n } = ctx;
    const mine = (traceSeq += 1); // WP-97
    if (player) {
      player.destroy();
      player = null;
    }
    els.narration.textContent = i18n.t("metrics.loading");
    els.summary.innerHTML = "";
    try {
      const [trace, formulas] = await Promise.all([api.metricsSweep(dataset, body), loadFormulas(api)]);
      if (!mounted || mine !== traceSeq) return; // WP-97
      const r = trace.result || {};
      const mode = r.mode || body.mode;
      // the walked user's summary for the picker chip (a missing detail view must not block the trace)
      const [flow, userInfo] = await Promise.all([
        api.flowchart(trace.flowchart_id),
        mode === "rank" && r.user_index !== undefined ? api.user(dataset, r.user_index).catch(() => null) : Promise.resolve(null),
      ]);
      if (!mounted || mine !== traceSeq) return; // WP-97
      els.grid.classList.toggle("mode-rank", mode === "rank");
      els.confusionBox.hidden = mode === "rank";
      els.heatHead.textContent = i18n.t(mode === "rank" ? "metrics.panel_list" : "metrics.panel_cells");
      renderSummary(trace);
      if (userPicker && r.user !== undefined && r.user_index !== undefined) {
        userPicker.update({ selected: userInfo || { index: r.user_index, label: r.user } });
      }
      const flowchart = createFlowchart(els.flow, {
        i18n,
        onNodeClick: (/** @type {string} */ nodeId) => {
          const idx = trace.steps.findIndex((/** @type {any} */ s) => s.node_id === nodeId);
          if (idx >= 0 && player) player.goto(idx);
        },
      });
      flowchart.setFlowchart(flow);
      const [mainId, secondId] = mode === "rank" ? ["ranked", "users"] : ["cells", "thresholds"];
      /** @type {any[]} */
      const panels = [
        createNarration(els.narration, { i18n }),
        createHeatGrid(els.heat, { i18n }),
        flowchart,
        createFormulaPanel(els.formula, { i18n, formulas: formulas || {} }),
        createCodePanel(els.code, { i18n }),
        createDataTable(els.tableMain, { i18n, tableId: mainId }),
        createDataTable(els.tableSecond, { i18n, tableId: secondId }),
        createRocPanel(els.curves, { i18n }),
      ];
      if (mode === "threshold") panels.push(createConfusionPanel(els.confusion, { i18n }));
      /** @type {any} */
      let controls = null;
      player = createTracePlayer({
        trace,
        panels,
        onPosition: (/** @type {number} */ index, /** @type {number} */ sub) => {
          if (!mounted) return;
          if (controls) controls.apply(buildFrameLite(trace, index, sub));
          ctx.router.replace("metrics", { ...routeParams, ds: dataset, step: index + (sub ? `.${sub}` : "") });
        },
      });
      controls = createPlayerControls(els.controls, { i18n, player, trace });
      controls.reset();
      const [stepIdx, subIdx] = parseStep(routeParams.step);
      player.goto(stepIdx, subIdx);
    } catch (err) {
      if (!mounted || mine !== traceSeq) return; // WP-97
      const message = errorText(err);
      els.narration.textContent = i18n.t("metrics.failed", { message });
      showToast(i18n.t("metrics.failed", { message }), "error");
    }
  }

  /** @param {any} trace */
  function renderSummary(trace) {
    const { i18n } = ctx;
    const r = trace.result || {};
    els.title.textContent = i18n.t("metrics.title", { dataset });
    els.summary.innerHTML = "";
    /** @param {string} text @param {string} [cls] */
    const chip = (text, cls = "chip") => {
      const el = document.createElement("span");
      el.className = cls;
      el.textContent = text;
      els.summary.appendChild(el);
    };
    chip(engineLabel(r.engine), "chip on");
    chip(i18n.t("metrics.chip_split", { n_train: r.n_train, n_test: r.n_test }));
    const K = Array.isArray(r.ks) ? r.ks[0] : undefined;
    if (r.mode === "rank") {
      const um = r.user_metrics || {};
      const mm = r.mean_metrics || {};
      chip(i18n.t("metrics.chip_user", { user: r.user, K, precision: fmt(um[`precision@${K}`]), ndcg: fmt(um[`ndcg@${K}`]) }));
      chip(i18n.t("metrics.chip_ndcg", { K, value: fmt(mm[`ndcg@${K}`]) }));
      chip(i18n.t("metrics.chip_users", { n_users: r.n_users_ranked }));
      if (r.n_rel === 0) chip(i18n.t("pitfall.no_test_ratings"), "warn-banner");
    } else {
      chip(i18n.t("metrics.chip_auc", { auc: fmt(r.auc) }));
      chip(i18n.t("metrics.chip_prevalence", { value: fmt(r.prevalence) }));
    }
    if (r.mae !== null && r.mae !== undefined) chip(i18n.t("metrics.chip_mae", { mae: fmt(r.mae), rmse: fmt(r.rmse) }));
  }

  /**
   * @param {any} trace
   * @param {number} index
   * @param {number} sub
   */
  function buildFrameLite(trace, index, sub) {
    const phase = trace.phases.reduce((/** @type {any} */ acc, /** @type {any} */ p) => (p.first_step <= index ? p : acc), trace.phases[0]);
    return { index, sub, total: trace.steps.length, step: trace.steps[index], phase };
  }

  /** @param {string | undefined} raw */
  function parseStep(raw) {
    if (!raw) return [0, 0];
    const [a, b] = String(raw).split(".");
    return [Number(a) || 0, Number(b) || 0];
  }

  // ── baseline battery ────────────────────────────────────────────────────────────────────────

  /** @param {boolean} force */
  async function loadBattery(force) {
    const { api, i18n } = ctx;
    const ref = routeParams.ref || undefined;
    const key = JSON.stringify([dataset, ref, lang, routeParams.bm]);
    if (!force && key === batteryKey) return;
    batteryKey = key;
    const mine = (batterySeq += 1); // WP-97: also when the cached battery is shown below - it supersedes a fetch in flight
    if (!force && battery && battery.dataset === dataset && (!ref || ref === battery.reference)) {
      renderBattery(battery); // only the language / the compared metric changed
      return;
    }
    els.bStatus.innerHTML = "";
    const loading = document.createElement("span");
    loading.className = "chip";
    loading.textContent = i18n.t("shell.loading");
    els.bStatus.appendChild(loading);
    try {
      const got = await api.battery(dataset, ref ? { reference: ref } : undefined);
      if (!mounted || mine !== batterySeq) return; // WP-97
      battery = got;
      renderBattery(battery);
    } catch (err) {
      if (!mounted || mine !== batterySeq) return; // WP-97
      battery = null;
      els.bIntro.textContent = "";
      els.bControls.innerHTML = "";
      els.bTables.innerHTML = "";
      els.bNotes.innerHTML = "";
      els.bStatus.innerHTML = "";
      const warn = document.createElement("span");
      warn.className = "warn-banner";
      const e = /** @type {any} */ (err);
      warn.textContent =
        e && e.code === "not_precomputed" ? i18n.t("metrics.battery_unavailable") : i18n.t("metrics.battery_failed", { message: errorText(err) });
      els.bStatus.appendChild(warn);
    }
  }

  /** @param {any} res */
  function renderBattery(res) {
    const { i18n, api } = ctx;
    const bcfg = (cfg && cfg.battery) || {};
    const protocol = res.protocol || {};
    const split = protocol.split || bcfg.split || {};
    els.bIntro.textContent = i18n.t("metrics.battery_intro", {
      seeds: Array.isArray(protocol.seeds) ? protocol.seeds.length : bcfg.seeds,
      method: split.method || "per_user_temporal",
      unit: protocol.split_unit || "per_user",
      ks: (protocol.ks || bcfg.ks || []).join(", "),
      tau: protocol.relevance_threshold ?? cfg.sweep?.threshold ?? "3.5",
    });
    renderBatteryControls(res);
    els.bStatus.innerHTML = "";
    /** @param {string} text @param {string} [cls] */
    const chip = (text, cls = "chip") => {
      const el = document.createElement("span");
      el.className = cls;
      el.textContent = text;
      els.bStatus.appendChild(el);
    };
    chip(i18n.t("metrics.runs_note", { n: res.n_runs }));
    if (api.mode === "static") chip(i18n.t("metrics.battery_static"));
    if (res.skipped && res.skipped.length) chip(i18n.t("metrics.skipped_note", { engines: res.skipped.join(", ") }), "warn-banner");
    els.bTables.innerHTML = "";
    els.bNotes.innerHTML = "";
    if (!res.rows || res.rows.length === 0) {
      chip(i18n.t("metrics.battery_none", { dataset }), "warn-banner");
      return;
    }
    renderMainTable(res);
    renderComparison(res);
    renderNotes(res);
  }

  /** @param {any} res */
  function renderBatteryControls(res) {
    const { i18n, api } = ctx;
    const bcfg = (cfg && cfg.battery) || {};
    const rootEl = els.bControls;
    rootEl.innerHTML = "";
    /**
     * @param {string} labelKey
     * @param {HTMLElement} control
     */
    function field(labelKey, control) {
      const wrap = document.createElement("label");
      wrap.className = "param-field";
      const span = document.createElement("span");
      span.textContent = i18n.t(labelKey);
      wrap.append(span, control);
      return wrap;
    }
    const refSel = document.createElement("select");
    const names = [...new Set([...(res.available_engines || []), ...(res.rows || []).map((/** @type {any} */ r) => r.engine)])];
    for (const name of names) {
      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = engineLabel(name);
      opt.selected = name === res.reference;
      refSel.appendChild(opt);
    }
    refSel.addEventListener("change", () => navigateWith({ ref: refSel.value }));
    rootEl.appendChild(field("metrics.battery_reference", refSel));
    if (res.metrics && res.metrics.length) {
      const metricSel = document.createElement("select");
      const current = routeParams.bm && res.metrics.includes(routeParams.bm) ? routeParams.bm : res.metrics[0];
      for (const m of res.metrics) {
        const opt = document.createElement("option");
        opt.value = m;
        opt.textContent = m;
        opt.selected = m === current;
        metricSel.appendChild(opt);
      }
      metricSel.addEventListener("change", () => ctx.router.replace("metrics", { ...routeParams, ds: dataset, bm: metricSel.value }));
      rootEl.appendChild(field("metrics.battery_metric", metricSel));
    }
    if (api.mode === "static") return;
    const seedsIn = document.createElement("input");
    seedsIn.type = "number";
    seedsIn.min = "1";
    seedsIn.max = "20";
    seedsIn.value = String(bcfg.seeds ?? 5);
    const usersIn = document.createElement("input");
    usersIn.type = "number";
    usersIn.min = "1";
    usersIn.value = String(bcfg.max_users_for_ranking ?? 200);
    const engBox = document.createElement("div");
    engBox.className = "battery-engines";
    /** @type {HTMLInputElement[]} */
    const checks = [];
    for (const e of bcfg.engines || []) {
      const label = document.createElement("label");
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.value = e.name;
      cb.checked = e.enabled !== false;
      label.classList.toggle("off", !cb.checked);
      cb.addEventListener("change", () => label.classList.toggle("off", !cb.checked));
      label.append(cb, document.createTextNode(engineLabel(e.name)));
      engBox.appendChild(label);
      checks.push(cb);
    }
    const run = document.createElement("button");
    run.type = "button";
    run.className = "btn btn-primary btn-sm";
    run.textContent = i18n.t("metrics.battery_run");
    run.addEventListener("click", async () => {
      const engines = checks.filter((c) => c.checked).map((c) => c.value);
      const seeds = Math.max(1, Math.round(Number(seedsIn.value) || 5));
      const mine = batterySeq; // WP-97: the view this run was started from
      const askedFor = dataset;
      run.disabled = true;
      els.bStatus.innerHTML = "";
      const busy = document.createElement("span");
      busy.className = "chip";
      busy.textContent = i18n.t("metrics.battery_running", { n: engines.length, seeds });
      els.bStatus.appendChild(busy);
      try {
        const out = await api.runBattery(askedFor, { engines, seeds, max_users: Math.max(1, Math.round(Number(usersIn.value) || 200)) });
        if (!mounted) return;
        if (mine !== batterySeq || askedFor !== dataset) {
          // WP-97: the route moved on while the run was going (another reference, language, dataset): its answer is not
          // for the view on screen; the run is stored server-side, so the same dataset just reloads what it now says
          if (askedFor === dataset) loadBattery(true);
          return;
        }
        battery = out;
        batteryKey = JSON.stringify([dataset, routeParams.ref || undefined, lang, routeParams.bm]);
        renderBattery(out);
      } catch (err) {
        if (!mounted || mine !== batterySeq || askedFor !== dataset) return; // WP-97
        els.bStatus.innerHTML = "";
        const warn = document.createElement("span");
        warn.className = "warn-banner";
        warn.textContent = i18n.t("metrics.battery_failed", { message: errorText(err) });
        els.bStatus.appendChild(warn);
      } finally {
        run.disabled = false;
      }
    });
    rootEl.append(field("metrics.battery_seeds", seedsIn), field("metrics.battery_max_users", usersIn), field("metrics.battery_engines", engBox), run);
  }

  /**
   * @param {string[]} headers
   * @param {string[]} numeric
   */
  function plainTable(headers, numeric) {
    const wrap = document.createElement("div");
    wrap.className = "table-wrap";
    const table = document.createElement("table");
    table.className = "data-table";
    const thead = document.createElement("thead");
    const tr = document.createElement("tr");
    /** @type {HTMLTableCellElement[]} */
    const ths = [];
    for (const h of headers) {
      const th = document.createElement("th");
      th.textContent = h;
      if (numeric.includes(h)) th.className = "num";
      tr.appendChild(th);
      ths.push(th);
    }
    thead.appendChild(tr);
    const tbody = document.createElement("tbody");
    table.append(thead, tbody);
    wrap.appendChild(table);
    return { wrap, tbody, ths };
  }

  /** @param {any} res */
  function renderMainTable(res) {
    const { i18n } = ctx;
    const lowerBetter = (/** @type {string} */ m) => (res.lower_is_better || []).some((/** @type {string} */ p) => m === p || m.startsWith(p));
    const headers = [i18n.t("metrics.col_engine"), i18n.t("metrics.col_run"), i18n.t("metrics.col_seeds"), ...res.metrics];
    const { wrap, tbody, ths } = plainTable(headers, [i18n.t("metrics.col_seeds"), ...res.metrics]);
    res.metrics.forEach((/** @type {string} */ m, /** @type {number} */ i) => {
      const th = ths[3 + i];
      const dir = document.createElement("span");
      dir.className = "dir";
      dir.textContent = lowerBetter(m) ? "↓" : "↑";
      dir.title = i18n.t(lowerBetter(m) ? "metrics.lower_better" : "metrics.higher_better");
      th.appendChild(dir);
    });
    /** @type {Record<string, string | null>} */
    const best = {};
    for (const m of res.metrics) {
      let bestEngine = null;
      let bestValue = null;
      for (const row of res.rows) {
        const v = row.mean[m];
        if (v === undefined || v === null || Number.isNaN(v)) continue;
        if (bestValue === null || (lowerBetter(m) ? v < bestValue : v > bestValue)) {
          bestValue = v;
          bestEngine = row.engine;
        }
      }
      best[m] = bestEngine;
    }
    for (const row of res.rows) {
      const tr = document.createElement("tr");
      if (row.engine === res.reference) tr.className = "reference";
      const name = document.createElement("td");
      name.textContent = engineLabel(row.engine);
      if (row.engine === res.reference) {
        const pill = document.createElement("span");
        pill.className = "pill";
        pill.textContent = i18n.t("metrics.reference_row");
        name.appendChild(pill);
      }
      const run = document.createElement("td");
      run.textContent = row.run_id;
      run.title = row.run_id;
      const seeds = document.createElement("td");
      seeds.className = "num";
      seeds.textContent = String(row.n_seeds);
      tr.append(name, run, seeds);
      for (const m of res.metrics) {
        const td = document.createElement("td");
        td.className = "num";
        const v = row.mean[m];
        const s = row.std[m];
        td.textContent = v === undefined || v === null || Number.isNaN(v) ? "—" : s ? `${fmt(v)} ± ${fmt(s)}` : fmt(v);
        if (best[m] === row.engine) td.classList.add("best");
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
    els.bTables.appendChild(wrap);
  }

  /** @param {any} res */
  function renderComparison(res) {
    const { i18n } = ctx;
    const metric = routeParams.bm && res.metrics.includes(routeParams.bm) ? routeParams.bm : res.metrics[0];
    const rows = (res.comparisons || []).filter((/** @type {any} */ c) => c.metric === metric);
    if (!rows.length) return;
    const head = document.createElement("div");
    head.className = "table-head";
    head.style.marginTop = "10px";
    head.textContent = `${metric} — ${i18n.t("metrics.col_diff")} (${engineLabel(res.reference)})`;
    els.bTables.appendChild(head);
    const headers = [
      i18n.t("metrics.col_engine"),
      i18n.t("metrics.col_n"),
      i18n.t("metrics.col_diff"),
      i18n.t("metrics.col_t_p"),
      i18n.t("metrics.col_w_p"),
      i18n.t("metrics.col_d"),
      i18n.t("metrics.col_holm"),
    ];
    const { wrap, tbody } = plainTable(headers, headers.slice(1, 6));
    for (const c of rows) {
      const tr = document.createElement("tr");
      const cells = [
        [engineLabel(c.engine), ""],
        [`${c.n} (${i18n.t(c.unit === "users" ? "metrics.unit_users" : "metrics.unit_seeds")})`, "num"],
        [c.mean_diff === null ? "—" : `${c.mean_diff > 0 ? "+" : ""}${fmt(c.mean_diff)}`, `num ${c.better === true ? "delta-up" : c.better === false ? "delta-down" : ""}`],
        [fmtP(c.t_p), "num"],
        [fmtP(c.wilcoxon_p), "num"],
        [c.cohens_d === null ? "—" : fmt(c.cohens_d), "num"],
      ];
      for (const [text, cls] of cells) {
        const td = document.createElement("td");
        td.textContent = /** @type {string} */ (text);
        td.className = /** @type {string} */ (cls);
        tr.appendChild(td);
      }
      const holm = document.createElement("td");
      const pill = document.createElement("span");
      pill.className = `pill ${c.holm_reject ? "tag-sig" : "tag-ns"}`;
      pill.textContent = i18n.t(c.holm_reject ? "metrics.holm_reject" : "metrics.holm_keep");
      holm.appendChild(pill);
      tr.appendChild(holm);
      tbody.appendChild(tr);
    }
    els.bTables.appendChild(wrap);
  }

  /** @param {any} res */
  function renderNotes(res) {
    const { i18n } = ctx;
    const metric = routeParams.bm && res.metrics.includes(routeParams.bm) ? routeParams.bm : res.metrics[0];
    const rows = (res.comparisons || []).filter((/** @type {any} */ c) => c.metric === metric);
    const units = rows.map((/** @type {any} */ c) => c.unit);
    const unit = units.filter((u) => u === "users").length >= units.length / 2 ? "users" : "seeds";
    const notes = [];
    if (rows.length) {
      notes.push(
        i18n.t("metrics.stats_note", {
          unit: i18n.t(unit === "users" ? "metrics.unit_users" : "metrics.unit_seeds"),
          n: Math.max(0, ...rows.map((/** @type {any} */ c) => c.n)),
          m: rows.length,
          alpha: res.alpha,
        })
      );
      if (unit === "seeds" || rows.every((/** @type {any} */ c) => c.n <= 5)) notes.push(i18n.t("pitfall.few_pairs_for_stats"));
    }
    if (res.rows.every((/** @type {any} */ r) => res.metrics.every((/** @type {string} */ m) => !r.std[m]))) {
      notes.push(i18n.t("pitfall.deterministic_no_variance"));
    }
    notes.push(i18n.t("metrics.mnar_note"));
    if (res.disclaimer) notes.push(res.disclaimer);
    for (const text of notes) {
      const p = document.createElement("p");
      p.textContent = text;
      els.bNotes.appendChild(p);
    }
  }

  return { mount, update, unmount };
}
