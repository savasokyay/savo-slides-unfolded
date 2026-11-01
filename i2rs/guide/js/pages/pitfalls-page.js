// @ts-check
// WP-43: Pitfall gallery + fault injection. The presets come from /api/pitfalls (config/pitfalls.yaml).
// A TRACE pitfall explains one (user, item) twice - course configuration vs one deliberate mistake -
// and shows the first step where the two traces diverge (narration + numeric formula side by side),
// the result deltas and the per-neighbour weight deltas, with deep links into the uCF/iCF pages.
// An EVAL pitfall (fault injection, T18) re-runs the evaluation protocol with the mistake switched
// on and shows the metric table honest vs faulty, the "watch" rows highlighted.
// Route params: `p` (preset id), `group` (`faults` = evaluation group, from the nav), `u`, `i`
// (dense indices for trace pitfalls), `seeds` (comma list for eval pitfalls).
// Page object contract: `{mount(root, ctx), update(state), unmount()}` (WP-32).

import { createEntityPicker } from "../components/entity-picker.js";
import { createFormulaPanel } from "../components/formula-panel.js";
import { fmt, fmtParams } from "../util/format.js";
import { createPanel } from "../util/panel.js";
import { paramsFromConfig } from "./trace-page.js";

const GROUPS = /** @type {const} */ (["all", "similarity", "prediction", "evaluation"]);

export function createPitfallsPage() {
  /** @type {HTMLElement | null} */
  let root = null;
  /** @type {any} */
  let ctx = null;
  /** @type {any} */
  let els = null;
  let dataset = "";
  let lang = "";
  /** @type {Record<string, string>} */
  let routeParams = {};
  /** @type {any} */
  let catalogue = null;
  /** @type {any} */
  let formulas = null;
  let loadedKey = "";
  let listKey = "";
  /** @type {any} */
  let userPicker = null;
  /** @type {any} */
  let itemPicker = null;
  let pickersFor = "";

  /**
   * @param {HTMLElement} rootEl
   * @param {any} context
   */
  function mount(rootEl, context) {
    root = rootEl;
    ctx = context;
    dataset = "";
    loadedKey = "";
    listKey = "";
    pickersFor = "";
    userPicker = null;
    itemPicker = null;
    root.innerHTML = "";
    const { i18n } = context;
    const page = document.createElement("div");
    page.className = "pitfalls-page";
    const title = document.createElement("h2");
    const intro = document.createElement("p");
    intro.className = "pitfalls-intro";
    intro.textContent = i18n.t("pitfalls.intro");
    const groups = document.createElement("div");
    groups.className = "pitfalls-groups";
    const layout = document.createElement("div");
    layout.className = "pitfalls-layout";
    const list = document.createElement("div");
    list.className = "pitfalls-list";
    // a non-empty placeholder so createPanel builds the heading; renderDetail fills in the title
    const detail = createPanel("pitfall-detail", "", " ");
    layout.append(list, detail.box);
    page.append(title, intro, groups, layout);
    root.appendChild(page);
    els = { title, groups, list, detail: detail.body, detailBox: detail.box };
  }

  /** @param {any} state */
  function update(state) {
    if (!root || !ctx) return;
    routeParams = state.route.params || {};
    dataset = routeParams.ds || state.dataset || "";
    lang = state.lang || "en";
    if (!dataset) return;
    ensureCatalogue().then(() => {
      if (!root) return;
      renderList();
      const selected = currentId();
      const key = JSON.stringify([dataset, selected, routeParams.u, routeParams.i, routeParams.seeds, lang]);
      if (key !== loadedKey) {
        loadedKey = key;
        renderDetail(selected);
      }
    });
  }

  function unmount() {
    root = null;
    ctx = null;
    els = null;
  }

  async function ensureCatalogue() {
    if (catalogue && formulas) return;
    [catalogue, formulas] = await Promise.all([ctx.api.pitfalls(), ctx.api.formulas()]);
  }

  function currentGroup() {
    if (routeParams.group === "faults") return "evaluation";
    return GROUPS.includes(/** @type {any} */ (routeParams.group)) ? routeParams.group : "all";
  }

  /** @returns {string} */
  function currentId() {
    const group = currentGroup();
    const visible = catalogue.pitfalls.filter((p) => group === "all" || p.group === group);
    if (routeParams.p && visible.some((p) => p.id === routeParams.p)) return routeParams.p;
    return visible.length ? visible[0].id : "";
  }

  /** @param {Record<string, string | undefined>} patch */
  function navigateWith(patch) {
    ctx.router.navigate("pitfalls", { ...routeParams, ...patch, ds: dataset });
  }

  // ── list ───────────────────────────────────────────────────────────────────────────────────

  function renderList() {
    const { i18n } = ctx;
    const group = currentGroup();
    const selected = currentId();
    const key = JSON.stringify([group, selected, lang]);
    if (key === listKey) return;
    listKey = key;
    els.title.textContent = i18n.t(routeParams.group === "faults" ? "pitfalls.title_faults" : "pitfalls.title");
    els.groups.innerHTML = "";
    for (const g of GROUPS) {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = `chip${g === group ? " on" : ""}`;
      chip.textContent = i18n.t(`pitfalls.group_${g}`);
      chip.addEventListener("click", () => navigateWith({ group: g === "all" ? undefined : g, p: undefined }));
      els.groups.appendChild(chip);
    }
    els.list.innerHTML = "";
    for (const p of catalogue.pitfalls) {
      if (group !== "all" && p.group !== group) continue;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `pitfall-item${p.id === selected ? " active" : ""}`;
      const label = document.createElement("span");
      label.textContent = i18n.t(p.title_key);
      const pill = document.createElement("span");
      pill.className = `pill${p.kind === "eval" ? " tag-foil" : " tag-fault"}`;
      pill.textContent = i18n.t(p.kind === "eval" ? "pitfalls.kind_eval" : "pitfalls.kind_trace");
      btn.append(label, pill);
      btn.addEventListener("click", () => navigateWith({ p: p.id, u: undefined, i: undefined }));
      els.list.appendChild(btn);
    }
  }

  // ── detail ─────────────────────────────────────────────────────────────────────────────────

  /** @param {string} id */
  async function renderDetail(id) {
    const { i18n, api } = ctx;
    const preset = catalogue.pitfalls.find((p) => p.id === id);
    els.detail.innerHTML = "";
    const heading = els.detailBox.querySelector("h3");
    if (heading) heading.textContent = preset ? i18n.t(preset.title_key) : "";
    if (!preset) return;
    const why = document.createElement("p");
    why.className = "pitfall-why";
    why.textContent = i18n.t(preset.why_key);
    els.detail.appendChild(why);
    if (preset.kind === "trace") {
      await renderTracePitfall(preset);
    } else {
      renderEvalPitfall(preset);
    }
    void api;
  }

  /** @param {any} preset */
  async function renderTracePitfall(preset) {
    const { i18n, api } = ctx;
    const user = routeParams.u !== undefined ? Number(routeParams.u) : preset.example.user;
    const item = routeParams.i !== undefined ? Number(routeParams.i) : preset.example.item;

    // pair pickers (any pair; the example pair is only the starting point)
    const pair = document.createElement("div");
    pair.className = "pitfall-pair";
    const userRoot = document.createElement("div");
    const itemRoot = document.createElement("div");
    pair.append(userRoot, itemRoot);
    els.detail.appendChild(pair);
    const noGuards = { minRatings: 0, requireClass: false, minRaters: 0, ratedByUser: true };
    userPicker = createEntityPicker(userRoot, {
      i18n,
      api,
      kind: "user",
      dataset,
      guards: noGuards,
      onSelect: (index) => navigateWith({ u: String(index) }),
    });
    itemPicker = createEntityPicker(itemRoot, {
      i18n,
      api,
      kind: "item",
      dataset,
      ratedBy: user,
      guards: noGuards,
      onSelect: (index) => navigateWith({ i: String(index) }),
    });
    pickersFor = preset.id;

    const status = document.createElement("div");
    status.className = "trace-summary";
    const loading = document.createElement("span");
    loading.className = "chip";
    loading.textContent = i18n.t("trace.loading");
    status.appendChild(loading);
    els.detail.appendChild(status);
    const body = document.createElement("div");
    els.detail.appendChild(body);

    let res;
    try {
      res = await api.runPitfall(preset.id, dataset, { user, item });
    } catch (err) {
      status.innerHTML = "";
      const warn = document.createElement("span");
      warn.className = "warn-banner";
      warn.textContent = i18n.t("pitfalls.failed", { message: errorText(err) });
      status.appendChild(warn);
      return;
    }
    if (!root || pickersFor !== preset.id) return;
    userPicker.update({ selected: { index: res.user.index, label: res.user.label } });
    itemPicker.update({ selected: { index: res.item.index, title: res.item.label } });

    // summary chips
    status.innerHTML = "";
    const rb = res.base.result || {};
    const rf = res.faulty.result || {};
    const chips = [
      [i18n.t("pitfalls.base_prediction"), fmt(rb.prediction)],
      [i18n.t("pitfalls.faulty_prediction"), fmt(rf.prediction)],
      [i18n.t("pitfalls.delta"), fmt(rf.prediction - rb.prediction)],
      [i18n.t("pitfalls.actual"), rb.actual === null || rb.actual === undefined ? "—" : Number(rb.actual).toFixed(1)],
    ];
    for (const [label, value] of chips) {
      const chip = document.createElement("span");
      chip.className = "chip";
      chip.textContent = `${label}: `;
      const strong = document.createElement("strong");
      strong.className = "num";
      strong.textContent = value;
      chip.appendChild(strong);
      status.appendChild(chip);
    }
    for (const key of res.warn_keys || []) {
      const warn = document.createElement("span");
      warn.className = "warn-banner";
      warn.textContent = i18n.t(key);
      status.appendChild(warn);
    }

    // divergence
    const div = res.diverge_at;
    const divTitle = document.createElement("h4");
    divTitle.className = "table-head";
    if (!div) {
      divTitle.textContent = i18n.t("pitfalls.no_divergence");
      body.appendChild(divTitle);
    } else {
      const node = div.base_step?.node_id || div.faulty_step?.node_id || "";
      divTitle.textContent = `${i18n.t("pitfalls.diverge_title", { index: div.index + 1, node })} — ${i18n.t(
        `pitfalls.diverge_${div.kind}`,
        { keys: (div.keys || []).join(", ") }
      )}`;
      body.appendChild(divTitle);
      const grid = document.createElement("div");
      grid.className = "pitfall-diff";
      grid.append(
        sideColumn(i18n.t("pitfalls.base"), div.base_step, false, res.base),
        sideColumn(i18n.t("pitfalls.faulty"), div.faulty_step, true, res.faulty)
      );
      body.appendChild(grid);
    }

    // deep links into the trace pages (the same dense indices, the echoed configs)
    const links = document.createElement("div");
    links.className = "pitfall-links";
    const step = div ? String(div.index) : undefined;
    for (const [key, cfg] of [
      ["pitfalls.open_base", res.base_config],
      ["pitfalls.open_faulty", res.faulty_config],
    ]) {
      const a = document.createElement("a");
      a.className = "btn btn-sm";
      a.textContent = i18n.t(/** @type {string} */ (key));
      const params = { ds: dataset, u: String(res.user.index), i: String(res.item.index), ...paramsFromConfig(cfg) };
      if (step) params.step = step;
      const qs = new URLSearchParams(params).toString();
      a.href = `#/${res.engine}?${qs}`;
      links.appendChild(a);
    }
    body.appendChild(links);

    // result deltas + neighbour deltas
    body.appendChild(deltaTable(res.result_deltas, res.neighbour_deltas));
  }

  /**
   * @param {string} label
   * @param {any} step
   * @param {boolean} faulty
   * @param {any} trace
   */
  function sideColumn(label, step, faulty, trace) {
    const { i18n } = ctx;
    const col = document.createElement("div");
    col.className = `pitfall-side${faulty ? " is-faulty" : ""}`;
    const h = document.createElement("h4");
    h.textContent = label;
    col.appendChild(h);
    if (!step) return col;
    const text = document.createElement("p");
    text.className = "narration-text";
    text.textContent = i18n.t(step.text_key, fmtParams(step.text_params));
    col.appendChild(text);
    const strip = document.createElement("div");
    strip.className = "status-strip";
    for (const [k, v] of Object.entries(step.values || {})) {
      const chip = document.createElement("span");
      chip.className = "chip";
      chip.textContent = `${k} ${fmt(v)}`;
      strip.appendChild(chip);
    }
    col.appendChild(strip);
    if (step.formula) {
      const formulaRoot = document.createElement("div");
      col.appendChild(formulaRoot);
      const panel = createFormulaPanel(formulaRoot, { i18n, formulas: formulas || {} });
      panel.reset();
      // the numeric layer is what differs; show all three like the player's last sub-step
      void panel.apply(/** @type {any} */ ({ index: step.id, sub: 2, step, trace, phase: null, total: 0, highlights: [], tables: {} }));
    }
    return col;
  }

  /**
   * @param {any[]} resultRows
   * @param {any[]} neighbourRows
   */
  function deltaTable(resultRows, neighbourRows) {
    const { i18n } = ctx;
    const wrap = document.createElement("div");
    const head = document.createElement("div");
    head.className = "table-head";
    head.textContent = i18n.t("pitfalls.neighbours_title");
    wrap.appendChild(head);
    const scroller = document.createElement("div");
    scroller.className = "table-wrap";
    const table = document.createElement("table");
    table.className = "data-table";
    const thead = document.createElement("tr");
    for (const [text, cls] of [
      [i18n.t("pitfalls.col_neighbour"), ""],
      [i18n.t("pitfalls.base"), "num"],
      [i18n.t("pitfalls.faulty"), "num"],
      [i18n.t("pitfalls.delta"), "num"],
      [i18n.t("pitfalls.col_status"), ""],
    ]) {
      const th = document.createElement("th");
      th.textContent = text;
      th.className = cls;
      thead.appendChild(th);
    }
    const theadEl = document.createElement("thead");
    theadEl.appendChild(thead);
    const tbody = document.createElement("tbody");
    for (const r of neighbourRows) {
      const tr = document.createElement("tr");
      if (r.changed) tr.className = "changed";
      const cells = [
        [r.label, ""],
        [fmt(r.base_w), "num"],
        [fmt(r.faulty_w), "num"],
        [fmt(r.delta), "num"],
        [
          r.base_status === r.faulty_status
            ? i18n.t(`status.${r.base_status}`)
            : `${i18n.t(`status.${r.base_status}`)} → ${i18n.t(`status.${r.faulty_status}`)}`,
          "",
        ],
      ];
      for (const [text, cls] of cells) {
        const td = document.createElement("td");
        td.textContent = /** @type {string} */ (text);
        td.className = cls;
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
    // result rows appended below the neighbours, same columns
    for (const r of resultRows) {
      const tr = document.createElement("tr");
      if (r.delta && Math.abs(r.delta) > 1e-9) tr.className = "changed";
      for (const [text, cls] of [
        [r.key, ""],
        [fmt(r.base), "num"],
        [fmt(r.faulty), "num"],
        [fmt(r.delta), "num"],
        ["", ""],
      ]) {
        const td = document.createElement("td");
        td.textContent = /** @type {string} */ (text);
        td.className = cls;
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
    table.append(theadEl, tbody);
    scroller.appendChild(table);
    wrap.appendChild(scroller);
    return wrap;
  }

  /** @param {any} preset */
  function renderEvalPitfall(preset) {
    const { i18n, api } = ctx;
    const defaults = catalogue.eval_defaults || {};
    const seedsText = routeParams.seeds || (defaults.seeds || [0, 1, 2, 3, 4]).join(",");
    const bar = document.createElement("div");
    bar.className = "pitfall-seeds";
    const label = document.createElement("span");
    label.textContent = i18n.t("pitfalls.seeds");
    const input = document.createElement("input");
    input.value = seedsText;
    const run = document.createElement("button");
    run.type = "button";
    run.className = "btn btn-primary btn-sm";
    run.textContent = i18n.t("pitfalls.run");
    bar.append(label, input, run);
    els.detail.appendChild(bar);
    const status = document.createElement("div");
    status.className = "trace-summary";
    const body = document.createElement("div");
    els.detail.append(status, body);

    const seeds = String(seedsText)
      .split(",")
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isInteger(n) && n >= 0);
    run.addEventListener("click", () => navigateWith({ seeds: input.value.replace(/\s+/g, "") }));
    // an eval pitfall runs on demand (it fits an engine per seed twice); the URL remembers the seeds
    if (routeParams.seeds === undefined) {
      const hint = document.createElement("span");
      hint.className = "chip";
      hint.textContent = i18n.t("pitfalls.seeds_note", { n: seeds.length });
      status.appendChild(hint);
      return;
    }
    status.innerHTML = "";
    const loading = document.createElement("span");
    loading.className = "chip";
    loading.textContent = i18n.t("pitfalls.running");
    status.appendChild(loading);
    run.disabled = true;
    api
      .runPitfall(preset.id, dataset, { seeds })
      .then((res) => {
        if (!root) return;
        run.disabled = false;
        renderEvalResult(status, body, res);
      })
      .catch((err) => {
        if (!root) return;
        run.disabled = false;
        status.innerHTML = "";
        const warn = document.createElement("span");
        warn.className = "warn-banner";
        warn.textContent = i18n.t("pitfalls.failed", { message: errorText(err) });
        status.appendChild(warn);
      });
  }

  /**
   * @param {HTMLElement} status
   * @param {HTMLElement} body
   * @param {any} res
   */
  function renderEvalResult(status, body, res) {
    const { i18n } = ctx;
    status.innerHTML = "";
    body.innerHTML = "";
    const chips = [i18n.t("pitfalls.seeds_note", { n: res.seeds.length })];
    for (const [key, [before, after]] of Object.entries(res.protocol_diff || {})) {
      chips.push(`${key}: ${before} → ${after}`);
    }
    for (const text of chips) {
      const chip = document.createElement("span");
      chip.className = "chip";
      chip.textContent = text;
      status.appendChild(chip);
    }
    const moved = res.deltas.filter((d) => d.delta !== null && d.delta !== undefined && Math.abs(d.delta) > 1e-9);
    if (moved.length === 0) {
      const warn = document.createElement("span");
      warn.className = "warn-banner";
      warn.textContent = i18n.t("pitfalls.no_movement");
      status.appendChild(warn);
    }
    const head = document.createElement("div");
    head.className = "table-head";
    head.textContent = i18n.t("pitfalls.metrics_title");
    body.appendChild(head);
    const scroller = document.createElement("div");
    scroller.className = "table-wrap";
    const table = document.createElement("table");
    table.className = "data-table";
    const thead = document.createElement("thead");
    const tr = document.createElement("tr");
    for (const [text, cls] of [
      [i18n.t("pitfalls.col_metric"), ""],
      [i18n.t("pitfalls.col_base"), "num"],
      [i18n.t("pitfalls.col_faulty"), "num"],
      [i18n.t("pitfalls.delta"), "num"],
    ]) {
      const th = document.createElement("th");
      th.textContent = text;
      th.className = cls;
      tr.appendChild(th);
    }
    thead.appendChild(tr);
    const tbody = document.createElement("tbody");
    const rows = [...res.deltas].sort((a, b) => Number(b.watch) - Number(a.watch));
    for (const d of rows) {
      const row = document.createElement("tr");
      if (d.watch) row.className = "watch";
      const name = document.createElement("td");
      name.textContent = d.metric;
      if (d.watch) {
        const pill = document.createElement("span");
        pill.className = "pill tag-hub";
        pill.textContent = i18n.t("pitfalls.watch");
        name.appendChild(pill);
      }
      const base = document.createElement("td");
      base.className = "num";
      base.textContent = d.base_std ? `${fmt(d.base)} ± ${fmt(d.base_std)}` : fmt(d.base);
      const faulty = document.createElement("td");
      faulty.className = "num";
      faulty.textContent = d.faulty_std ? `${fmt(d.faulty)} ± ${fmt(d.faulty_std)}` : fmt(d.faulty);
      const delta = document.createElement("td");
      delta.className = "num";
      const dv = d.delta;
      if (dv === null || dv === undefined || Number.isNaN(dv)) {
        delta.textContent = "—";
      } else {
        delta.textContent = `${dv > 0 ? "▲ +" : dv < 0 ? "▼ " : ""}${fmt(dv)}`;
        if (Math.abs(dv) > 1e-9) delta.classList.add(dv > 0 ? "delta-up" : "delta-down");
      }
      row.append(name, base, faulty, delta);
      tbody.appendChild(row);
    }
    table.append(thead, tbody);
    scroller.appendChild(table);
    body.appendChild(scroller);
    const runs = document.createElement("p");
    runs.className = "atlas-note";
    runs.textContent = `${i18n.t("pitfalls.runs", { base: res.base.run_id, faulty: res.faulty.run_id })} · ${res.base.disclaimer || ""}`;
    body.appendChild(runs);
  }

  /** @param {unknown} err */
  function errorText(err) {
    if (err && typeof err === "object" && "messageKey" in err) {
      return ctx.i18n.t(/** @type {any} */ (err).messageKey, /** @type {any} */ (err).params);
    }
    return err instanceof Error ? err.message : String(err);
  }

  return { mount, update, unmount };
}
