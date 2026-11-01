// @ts-check
// WP-49: locked exam views - Q1 (all-pairs user heatmaps), Q2 (item cosine raw/centred/fault),
// Q3 (prediction list from an uploaded Letterboxd list export + top-N recommendations). Nothing
// here is a new computation: Q1/Q2 bundle the same kind of AtlasResponse the Atlas page (WP-44)
// renders, under exam-shaped presets (config/exam.yaml); Q3 reuses whichever engine the
// instructor picks (`Recommender.predict_pairs`/`recommend`, WP-22/46/47/45).
//
// WP-84a: the two "similarity restricted to a sub-catalogue F" views (teaching decision D7). Q1 gets
// a filter select: with a preset chosen the page lays the unfiltered view, rule A (centres over ALL
// ratings, the course's) and rule B (centres over the ratings inside F) side by side - three cached
// atlas calls - plus the filtered support (co-rated counts inside F). Q4 is a new tab: one class
// user's neighbour table, the similarity three ways, with NO target item (nothing is predicted).
//
// `nav-tree.js` already refuses to navigate here while locked (a short click on "Exam" shows a
// toast instead); this page's own `store.examToken` check is only the fallback for someone typing
// `#/exam` directly. Route params: the view tab `v=q1|q2|q3|q4`; WP-84a: `f` (a `config/exam.yaml`
// filter preset id; Q1: absent = no filter, Q4: absent = the first preset) and `u` (Q4's user).

import { createChart, themeColors } from "../components/chart.js";
import { createEntityPicker } from "../components/entity-picker.js";
import { fmt } from "../util/format.js";
import { createPanel } from "../util/panel.js";

const VIEWS = /** @type {const} */ (["q1", "q2", "q3", "q4"]);
const VIEW_TO_API = {
  q1: "all_pairs_similarity",
  q2: "item_cosine_degree_filtered",
  q3: "prediction_list",
  q4: "filtered_neighbours", // WP-84a
};
const Q3_ENGINES = /** @type {const} */ (["ucf", "icf", "content", "mf", "dnn"]);
const Q3_ENGINE_API_NAME = { ucf: "ucf", icf: "icf", content: "cb", mf: "mf", dnn: "dnn" };

export function createExamPage() {
  /** @type {HTMLElement | null} */
  let root = null;
  /** @type {any} */
  let ctx = null;
  /** @type {any} */
  let els = null;
  let dataset = "";
  /** @type {Record<string, string>} */
  let routeParams = {};
  let renderedKey = ""; // (dataset, view) - rebuild boundary; theme alone only repaints Q1/Q2
  let paintedTheme = "";
  /** @type {{destroy(): void}[]} */
  let activeCharts = [];
  /** @type {any} */
  let lastQ1 = null; // WP-84a: {preset, none, a, b} - the atlases of the three columns
  /** @type {any} */
  let lastQ2 = null;
  /** @type {Promise<any> | null} */
  let configPromise = null; // WP-84a: GET /api/exam/config?dataset=... (presets + |F|), once per (token, dataset)
  let configKey = "";
  /** @type {(() => void) | null} */
  let q4Refresh = null; // WP-84a: re-renders Q4's results when `f` / `u` change without rebuilding the form
  // Q3 form state lives across unrelated re-renders (theme toggles, etc.) - only a dataset/view
  // change tears it down.
  let pickedUser = /** @type {number | null} */ (null);
  let csvText = "";

  /** @param {HTMLElement} rootEl @param {any} context */
  function mount(rootEl, context) {
    root = rootEl;
    ctx = context;
    renderedKey = "";
    pickedUser = null;
    csvText = "";
    configPromise = null;
    configKey = "";
    q4Refresh = null;
    root.innerHTML = "";
    const page = document.createElement("div");
    page.className = "exam-page";
    const title = document.createElement("h2");
    const tabs = document.createElement("div");
    tabs.className = "seg exam-tabs";
    const content = document.createElement("div");
    content.className = "exam-content";
    page.append(title, tabs, content);
    root.appendChild(page);
    els = { title, tabs, content };
  }

  function unmount() {
    destroyCharts();
    q4Refresh = null;
    root = null;
    ctx = null;
    els = null;
  }

  function destroyCharts() {
    for (const c of activeCharts) c.destroy();
    activeCharts = [];
  }

  /** @param {any} state */
  function update(state) {
    if (!root || !ctx) return;
    routeParams = state.route.params || {};
    dataset = routeParams.ds || state.dataset || "";
    const theme = state.theme || "light";
    const { i18n } = ctx;
    els.title.textContent = i18n.t("exam.title");
    if (!state.examToken) {
      renderedKey = "";
      destroyCharts();
      renderLocked();
      return;
    }
    if (!dataset) return;
    const view = currentView();
    renderTabs(view);
    // WP-84a: Q1's filter choice rebuilds its panel (three new renders); Q4 keeps its form and only
    // re-renders the results (q4Refresh) when the user or the filter changes
    const key = JSON.stringify(view === "q1" ? [dataset, view, routeParams.f || ""] : [dataset, view]);
    if (key !== renderedKey) {
      renderedKey = key;
      paintedTheme = theme;
      destroyCharts();
      q4Refresh = null;
      els.content.innerHTML = "";
      if (view === "q1") loadQ1();
      else if (view === "q2") loadQ2();
      else if (view === "q4") renderQ4();
      else renderQ3();
    } else if (view === "q4" && q4Refresh) {
      q4Refresh();
    } else if (theme !== paintedTheme) {
      paintedTheme = theme;
      if (view === "q1" && lastQ1) {
        destroyCharts();
        paintQ1(lastQ1);
      } else if (view === "q2" && lastQ2) {
        destroyCharts();
        paintQ2(lastQ2);
      }
    }
  }

  function currentView() {
    const v = routeParams.v;
    return VIEWS.includes(/** @type {any} */ (v)) ? /** @type {any} */ (v) : "q1";
  }

  /** @param {Record<string, string | undefined>} patch */
  function navigateWith(patch) {
    ctx.router.navigate("exam", { ...routeParams, ...patch, ds: dataset });
  }

  function renderLocked() {
    const { i18n } = ctx;
    els.tabs.innerHTML = "";
    els.content.innerHTML = "";
    const p = document.createElement("p");
    p.className = "muted";
    p.textContent = i18n.t("exam.locked_hint");
    els.content.appendChild(p);
  }

  /** @param {string} active */
  function renderTabs(active) {
    const { i18n } = ctx;
    els.tabs.innerHTML = "";
    for (const v of VIEWS) {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = i18n.t(`exam.tab.${v}`);
      b.classList.toggle("active", v === active);
      b.addEventListener("click", () => {
        if (v !== active) navigateWith({ v });
      });
      els.tabs.appendChild(b);
    }
  }

  /** @param {unknown} err */
  function errorText(err) {
    if (err && typeof err === "object" && "messageKey" in err) {
      return ctx.i18n.t(/** @type {any} */ (err).messageKey, /** @type {any} */ (err).params);
    }
    return err instanceof Error ? err.message : String(err);
  }

  /** @param {HTMLElement} container @param {unknown} err */
  function renderError(container, err) {
    const warn = document.createElement("span");
    warn.className = "warn-banner";
    warn.textContent = errorText(err);
    container.appendChild(warn);
  }

  /** @returns {Promise<any>} */
  function render(view, body) {
    const token = ctx.store.get().examToken;
    return ctx.api.examRender(token, dataset, { view: VIEW_TO_API[view], ...body });
  }

  /**
   * A small "download .xlsx" button - the same computed render, laid out as a workbook
   * (`i2rs.exam.xlsx_export`, `config/exam.yaml: xlsx.enabled`).
   * `suffix` (WP-84a) tells apart the two workbooks of a filtered Q1 (rule A / rule B).
   * @param {HTMLElement} container @param {string} view @param {() => Record<string, unknown>} getBody
   * @param {string} [suffix]
   */
  function addExportButton(container, view, getBody, suffix = "") {
    const { i18n } = ctx;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn btn-sm exam-export-btn";
    btn.textContent = suffix ? `${i18n.t("exam.export_xlsx")} · ${suffix}` : i18n.t("exam.export_xlsx");
    btn.addEventListener("click", async () => {
      btn.disabled = true;
      try {
        const token = ctx.store.get().examToken;
        const { blob, filename } = await ctx.api.examExport(token, dataset, {
          view: VIEW_TO_API[view],
          ...getBody(),
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } catch (err) {
        renderError(container, err);
      } finally {
        btn.disabled = false;
      }
    });
    container.appendChild(btn);
  }

  // ── Q1: every configured measure, over the class cohort by default ───────────────────────────

  // WP-84a: the filter presets (config/exam.yaml via GET /api/exam/config) and the Q1 filter option

  /**
   * The presets + `filter_sizes` (|F| per preset on this dataset), fetched once per (token, dataset).
   * Resolves to null when the endpoint is unavailable - the filter option then simply is not offered.
   * @returns {Promise<any>}
   */
  function getConfig() {
    const token = ctx.store.get().examToken;
    const key = `${token}|${dataset}`;
    if (!configPromise || configKey !== key) {
      configKey = key;
      configPromise = ctx.api.examConfig(token, dataset).catch(() => null);
    }
    return configPromise;
  }

  /**
   * "genre: Drama · years 1990-1999", built from the preset's predicates so a preset added to
   * config/exam.yaml needs no new i18n key.
   * @param {{id?: string, genres?: string[], year_min?: number | null, year_max?: number | null}} f
   */
  function presetLabel(f) {
    const { i18n } = ctx;
    /** @type {string[]} */
    const parts = [];
    if (f.genres && f.genres.length) parts.push(i18n.t("exam.q1.filter_genres", { genres: f.genres.join(" / ") }));
    const lo = f.year_min;
    const hi = f.year_max;
    if (lo != null && hi != null) parts.push(i18n.t("exam.q1.filter_year_range", { lo, hi }));
    else if (lo != null) parts.push(i18n.t("exam.q1.filter_year_from", { lo }));
    else if (hi != null) parts.push(i18n.t("exam.q1.filter_year_to", { hi }));
    return parts.join(" · ") || String(f.id ?? "");
  }

  /**
   * The "Sub-catalogue F" select. A preset that selects nothing on this dataset (`filter_sizes` 0)
   * stays visible but disabled, with the reason in its text. `withNone` = Q1 (no filter is a choice);
   * Q4 needs a filter, so it has no such option.
   * @param {any} cfg @param {string} current @param {boolean} withNone @param {string} labelKey
   */
  function filterSelect(cfg, current, withNone, labelKey) {
    const { i18n } = ctx;
    const sizes = cfg.q1.filter_sizes || {};
    const wrap = document.createElement("label");
    wrap.className = "param-field exam-filter";
    const span = document.createElement("span");
    span.textContent = i18n.t(labelKey);
    const sel = document.createElement("select");
    sel.dataset.role = "exam-filter";
    if (withNone) {
      const none = document.createElement("option");
      none.value = "";
      none.textContent = i18n.t("exam.q1.filter_none");
      sel.appendChild(none);
    }
    for (const f of cfg.q1.filters) {
      const opt = document.createElement("option");
      opt.value = f.id;
      const label = presetLabel(f);
      const empty = sizes[f.id] === 0;
      opt.textContent = empty ? i18n.t("exam.q1.filter_empty", { label }) : label;
      opt.disabled = empty;
      sel.appendChild(opt);
    }
    sel.value = current;
    sel.addEventListener("change", () => navigateWith({ f: sel.value || undefined }));
    wrap.append(span, sel);
    return wrap;
  }

  async function loadQ1() {
    const { i18n } = ctx;
    const panel = createPanel("exam-q1", "", i18n.t("exam.tab.q1"));
    els.content.appendChild(panel.box);
    const hint = document.createElement("p");
    hint.className = "muted";
    hint.textContent = i18n.t("exam.q1.hint");
    panel.body.appendChild(hint);
    const cfg = await getConfig();
    if (!root) return; // the page was left while the presets were loading
    const filterId = routeParams.f || "";
    if (cfg && cfg.q1.filters.length) {
      const row = document.createElement("div");
      row.className = "exam-filter-row";
      row.appendChild(filterSelect(cfg, filterId, true, "exam.q1.filter_label"));
      panel.body.appendChild(row);
    }
    const preset = filterId && cfg ? (cfg.q1.filters.find((/** @type {any} */ f) => f.id === filterId) ?? null) : null;
    const loading = document.createElement("p");
    loading.textContent = i18n.t("shell.loading");
    panel.body.appendChild(loading);
    try {
      if (!preset) {
        const data = await render("q1", {});
        lastQ1 = { preset: null, none: data.atlas };
      } else {
        // the three columns - each one a cached atlas call: whole catalogue, rule A, rule B
        const [none, a, b] = await Promise.all([
          render("q1", {}),
          render("q1", { filter: preset.id, mean_scope: "global" }),
          render("q1", { filter: preset.id, mean_scope: "segment" }),
        ]);
        lastQ1 = { preset, none: none.atlas, a: a.atlas, b: b.atlas };
      }
      if (!root) return;
      loading.remove();
      paintQ1(lastQ1);
      if (!preset) {
        addExportButton(panel.body, "q1", () => ({}));
      } else {
        const exports = document.createElement("div");
        exports.className = "exam-export-row";
        panel.body.appendChild(exports);
        for (const [scope, key] of /** @type {[string, string][]} */ ([
          ["global", "exam.q1.scope_global"],
          ["segment", "exam.q1.scope_segment"],
        ])) {
          addExportButton(exports, "q1", () => ({ filter: preset.id, mean_scope: scope }), i18n.t(key));
        }
      }
    } catch (err) {
      loading.remove();
      renderError(panel.body, err);
    }
  }

  /** @param {any} q1 `lastQ1` */
  function paintQ1(q1) {
    const { i18n } = ctx;
    const panel = els.content.querySelector('[data-panel="exam-q1"] .panel-body');
    if (!panel) return;
    for (const el of panel.querySelectorAll(".exam-heat, .exam-triple, .exam-support, .exam-filter-hint")) el.remove();
    if (!q1.preset) {
      for (const res of Object.values(q1.none.views)) {
        panel.appendChild(oneHeatmap(i18n.t(/** @type {any} */ (res).label_key), res));
      }
      return;
    }
    const hint = document.createElement("p");
    hint.className = "muted exam-filter-hint";
    hint.textContent = i18n.t("exam.q1.filter_hint");
    panel.appendChild(hint);
    // one row per measure: [whole catalogue | A: centres over all ratings | B: centres inside F]
    for (const [name, res] of Object.entries(q1.none.views)) {
      const row = document.createElement("div");
      row.className = "exam-triple";
      const title = document.createElement("h4");
      title.textContent = i18n.t(/** @type {any} */ (res).label_key);
      row.appendChild(title);
      const grid = document.createElement("div");
      grid.className = "exam-triple-grid";
      for (const [heading, source] of /** @type {[string, any][]} */ ([
        [i18n.t("exam.q1.filter_none"), q1.none],
        [i18n.t("exam.q1.scope_global"), q1.a],
        [i18n.t("exam.q1.scope_segment"), q1.b],
      ])) {
        grid.appendChild(oneHeatmap(heading, source.views[name], { compact: true }));
      }
      row.appendChild(grid);
      panel.appendChild(row);
    }
    // the filtered support: co-rated items inside F - identical for every measure, so drawn once
    const first = Object.values(q1.a.views)[0];
    if (first) {
      const support = document.createElement("div");
      support.className = "exam-support";
      support.appendChild(oneHeatmap(i18n.t("exam.q1.support_title"), first, { counts: true }));
      panel.appendChild(support);
    }
  }

  // ── Q2: raw / (user-)centred / item-centred fault, over the degree-filtered items ────────────

  async function loadQ2() {
    const { i18n } = ctx;
    const panel = createPanel("exam-q2", "", i18n.t("exam.tab.q2"));
    els.content.appendChild(panel.box);
    const hint = document.createElement("p");
    hint.className = "muted";
    hint.textContent = i18n.t("exam.q2.hint");
    panel.body.appendChild(hint);
    const loading = document.createElement("p");
    loading.textContent = i18n.t("shell.loading");
    panel.body.appendChild(loading);
    try {
      const data = await render("q2", {});
      loading.remove();
      lastQ2 = data.atlas;
      paintQ2(data.atlas);
      addExportButton(panel.body, "q2", () => ({}));
    } catch (err) {
      loading.remove();
      renderError(panel.body, err);
    }
  }

  /** @param {any} atlas */
  function paintQ2(atlas) {
    const { i18n } = ctx;
    const panel = els.content.querySelector('[data-panel="exam-q2"] .panel-body');
    if (!panel) return;
    for (const el of panel.querySelectorAll(".exam-heat")) el.remove();
    for (const name of ["raw", "centred", "fault"]) {
      const res = atlas.views[name];
      if (!res) continue;
      const box = oneHeatmap(i18n.t(`exam.q2.${name}`), res);
      if (name === "fault") box.classList.add("exam-heat-fault");
      panel.appendChild(box);
    }
  }

  // ── shared mini heatmap (simplified sibling of atlas-page.js's renderHeatmap: fixed default
  //    palette, "values" view only - the exam wants the numbers, not the explorer) ──────────────

  /**
   * `compact` (WP-84a): one of three side-by-side maps - no entity chip, a smaller plot, numbers only
   * for small matrices. `counts`: draw the co-rated counts (the support) instead of the values.
   * @param {string} title @param {any} res @param {{compact?: boolean, counts?: boolean}} [opts]
   */
  function oneHeatmap(title, res, opts = {}) {
    const { i18n } = ctx;
    const { compact = false, counts = false } = opts;
    const box = document.createElement("div");
    box.className = "exam-heat";
    const h = document.createElement("h4");
    h.textContent = title;
    box.appendChild(h);
    for (const note of res.notes || []) {
      const warn = document.createElement("span");
      warn.className = "warn-banner";
      warn.textContent = i18n.t(note);
      box.appendChild(warn);
    }
    if (!compact) {
      const chip = document.createElement("span");
      chip.className = "chip";
      chip.textContent = i18n.t("atlas.n_entities", {
        n: res.n,
        total: res.n_total,
        entity: i18n.t(res.entity === "user" ? "atlas.entity_user" : "atlas.entity_item"),
      });
      box.appendChild(chip);
    }
    const plot = document.createElement("div");
    plot.className = "exam-heatmap";
    plot.style.height = compact
      ? `${Math.min(380, Math.max(200, res.n * 14 + 90))}px`
      : `${Math.min(520, Math.max(220, res.n * 20 + 90))}px`;
    box.appendChild(plot);
    const z = counts ? res.counts : res.values;
    const [lo, mid, hi] = counts ? [0, 0, Math.max(1, ...z.flat())] : res.anchors.values;
    const midPos = hi > lo ? Math.min(1, Math.max(0, (mid - lo) / (hi - lo))) : 0.5;
    const c = themeColors();
    const theme = ctx.store.get().theme || "light";
    const midColor = theme === "dark" ? "#4b5563" : "#ffffff";
    const text = z.map(
      /** @param {(number | null)[]} row */
      (row) => row.map((v) => (v === null ? "" : counts ? String(v) : Number(v).toFixed(2)))
    );
    const chart = createChart(plot);
    activeCharts.push(chart);
    chart.render(
      [
        {
          type: "heatmap",
          z,
          x: res.labels,
          y: res.labels,
          text,
          customdata: res.counts,
          texttemplate: res.n <= (compact ? 12 : 30) ? "%{text}" : "",
          textfont: { size: 10, color: c.ink },
          hovertemplate: counts
            ? "%{y} × %{x}<br>c = %{customdata}<extra></extra>"
            : "%{y} × %{x}<br>%{text}<br>c = %{customdata}<extra></extra>",
          hoverongaps: false,
          zmin: lo,
          zmax: hi,
          zauto: false,
          // WP-84a: the support is a sequential scale (0 = white / dark grey -> blue), the values keep the
          // answer key's red - white - green anchors
          colorscale: counts
            ? [
                [0, midColor],
                [1, "#1f5fa8"],
              ]
            : [
                [0, "#c0392b"],
                [midPos, midColor],
                [1, "#1a9d54"],
              ],
          colorbar: {
            tickvals: counts ? [lo, hi] : [lo, mid, hi],
            thickness: 10,
            len: 0.7,
            tickfont: { size: 9 },
          },
          xgap: 1,
          ygap: 1,
        },
      ],
      {
        // the rotated tick labels of a narrow map need room above it, or "sRS26_u01" is cut to "sRS2…"
        margin: { l: compact ? 70 : 90, r: 10, t: compact ? 64 : 30, b: 10 },
        plot_bgcolor: c.line,
        xaxis: { side: "top", tickangle: -45, tickfont: { size: 9 }, showgrid: false, zeroline: false },
        yaxis: { autorange: "reversed", tickfont: { size: 9 }, showgrid: false, zeroline: false },
      }
    );
    return box;
  }

  // ── Q3: upload a list, predict, recommend ─────────────────────────────────────────────────────

  function renderQ3() {
    const { api, i18n } = ctx;
    const panel = createPanel("exam-q3", "", i18n.t("exam.tab.q3"));
    els.content.appendChild(panel.box);
    const hint = document.createElement("p");
    hint.className = "muted";
    hint.textContent = i18n.t("exam.q3.hint");
    panel.body.appendChild(hint);

    const form = document.createElement("div");
    form.className = "param-form";
    const grid = document.createElement("div");
    grid.className = "param-grid";

    /** @param {string} labelKey @param {HTMLElement} control */
    function field(labelKey, control) {
      const wrap = document.createElement("label");
      wrap.className = "param-field";
      const span = document.createElement("span");
      span.textContent = i18n.t(labelKey);
      wrap.append(span, control);
      return wrap;
    }

    const userBox = document.createElement("div");
    const fileWrap = document.createElement("div");
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = ".csv,text/csv";
    const fileNote = document.createElement("span");
    fileNote.className = "muted exam-file-note";
    fileWrap.append(fileInput, fileNote);

    const engineSel = document.createElement("select");
    for (const e of Q3_ENGINES) {
      const opt = document.createElement("option");
      opt.value = e;
      opt.textContent = i18n.t(`nav.${e}`);
      engineSel.appendChild(opt);
    }

    const topNInput = document.createElement("input");
    topNInput.type = "number";
    topNInput.min = "1";
    topNInput.value = "15";

    const cfgInput = document.createElement("textarea");
    cfgInput.rows = 2;
    cfgInput.placeholder = "{}";
    cfgInput.className = "exam-cfg";

    grid.append(
      field("exam.q3.user_label", userBox),
      field("exam.q3.list_label", fileWrap),
      field("exam.q3.engine_label", engineSel),
      field("exam.q3.top_n_label", topNInput),
      field("exam.q3.engine_config_label", cfgInput)
    );

    const actions = document.createElement("div");
    actions.className = "param-actions";
    const runBtn = document.createElement("button");
    runBtn.type = "button";
    runBtn.className = "btn btn-primary btn-sm";
    runBtn.textContent = i18n.t("exam.q3.run");
    actions.appendChild(runBtn);

    form.append(grid, actions);
    panel.body.appendChild(form);
    const results = document.createElement("div");
    results.className = "exam-results";
    panel.body.appendChild(results);

    createEntityPicker(userBox, {
      i18n,
      api,
      kind: "user",
      dataset,
      guards: { minRatings: 0, requireClass: false, minRaters: 0, ratedByUser: false },
      onSelect: (/** @type {number} */ index) => {
        pickedUser = index;
      },
    });

    fileInput.addEventListener("change", async () => {
      const file = fileInput.files && fileInput.files[0];
      if (!file) return;
      csvText = await file.text();
      // count film rows the same way the server locates them (i2rs.data.letterboxd.read_list_csv):
      // find the "Position,Name,Year,URL" header, then count non-empty lines after it.
      const lines = csvText.split("\n");
      const headerIdx = lines.findIndex((l) => l.startsWith("Position,Name,Year,URL"));
      const n = headerIdx < 0 ? 0 : lines.slice(headerIdx + 1).filter((l) => l.trim() !== "").length;
      fileNote.textContent = i18n.t("exam.q3.list_chosen", { name: file.name, n });
    });

    runBtn.addEventListener("click", async () => {
      results.innerHTML = "";
      if (pickedUser === null || !csvText) {
        renderError(results, { messageKey: "exam.q3.need_user_and_list", params: {} });
        return;
      }
      let engineConfig = {};
      const raw = cfgInput.value.trim();
      if (raw) {
        try {
          engineConfig = JSON.parse(raw);
        } catch (err) {
          renderError(results, {
            messageKey: "error.bad_engine_config",
            params: { detail: err instanceof Error ? err.message : String(err) },
          });
          return;
        }
      }
      const loading = document.createElement("p");
      loading.textContent = i18n.t("shell.loading");
      results.appendChild(loading);
      runBtn.disabled = true;
      try {
        const q3Body = {
          user: pickedUser,
          csv_text: csvText,
          engine: Q3_ENGINE_API_NAME[/** @type {keyof typeof Q3_ENGINE_API_NAME} */ (engineSel.value)],
          engine_config: engineConfig,
          top_n: Math.max(1, Math.round(Number(topNInput.value) || 15)),
        };
        const data = await render("q3", q3Body);
        loading.remove();
        renderPrediction(results, data.prediction);
        addExportButton(results, "q3", () => q3Body);
      } catch (err) {
        loading.remove();
        renderError(results, err);
      } finally {
        runBtn.disabled = false;
      }
    });
  }

  /** @param {HTMLElement} container @param {string[]} headers */
  function plainTable(container, headers) {
    const wrap = document.createElement("div");
    wrap.className = "table-wrap";
    const table = document.createElement("table");
    table.className = "data-table";
    const thead = document.createElement("thead");
    const tr = document.createElement("tr");
    for (const h of headers) {
      const th = document.createElement("th");
      th.textContent = h;
      tr.appendChild(th);
    }
    thead.appendChild(tr);
    const tbody = document.createElement("tbody");
    table.append(thead, tbody);
    wrap.appendChild(table);
    container.appendChild(wrap);
    return tbody;
  }

  /** @param {HTMLElement} container @param {any} pred */
  function renderPrediction(container, pred) {
    const { i18n } = ctx;
    for (const note of pred.notes || []) {
      const warn = document.createElement("span");
      warn.className = "warn-banner";
      warn.textContent = i18n.t(note);
      container.appendChild(warn);
    }
    const userChip = document.createElement("span");
    userChip.className = "chip on";
    userChip.textContent = pred.user.label;
    container.appendChild(userChip);

    const h1 = document.createElement("h4");
    h1.textContent = i18n.t("exam.q3.predictions_title");
    container.appendChild(h1);
    const body1 = plainTable(container, [
      i18n.t("exam.q3.col_position"),
      i18n.t("exam.q3.col_name"),
      i18n.t("exam.q3.col_year"),
      i18n.t("exam.q3.col_prediction"),
      i18n.t("exam.q3.col_actual"),
    ]);
    for (const row of pred.rows) {
      const tr = document.createElement("tr");
      const name = row.entry.item
        ? row.entry.item.label
        : `${row.entry.name}${row.entry.reason ? ` — ${i18n.t(row.entry.reason)}` : ""}`;
      for (const [value, numeric] of /** @type {[unknown, boolean][]} */ ([
        [row.entry.position ?? "—", true],
        [name, false],
        [row.entry.year ?? "—", true],
        [fmt(row.prediction, 3), true],
        [fmt(row.actual, 1), true],
      ])) {
        const td = document.createElement("td");
        td.textContent = String(value);
        if (numeric) td.className = "num";
        tr.appendChild(td);
      }
      body1.appendChild(tr);
    }

    const h2 = document.createElement("h4");
    h2.textContent = i18n.t("exam.q3.recommendations_title");
    container.appendChild(h2);
    const body2 = plainTable(container, [
      i18n.t("exam.q3.col_name"),
      i18n.t("exam.q3.col_score"),
      i18n.t("exam.q3.col_why"),
    ]);
    for (const r of pred.recommendations) {
      const tr = document.createElement("tr");
      for (const [value, numeric] of /** @type {[unknown, boolean][]} */ ([
        [r.item.label, false],
        [fmt(r.score, 3), true],
        [i18n.t(r.explanation_key, r.explanation_params), false],
      ])) {
        const td = document.createElement("td");
        td.textContent = String(value);
        if (numeric) td.className = "num";
        tr.appendChild(td);
      }
      body2.appendChild(tr);
    }
  }

  // ── Q4 (WP-84a): one class user's neighbours, the similarity three ways, NO target item ──────────

  function renderQ4() {
    const { api, i18n } = ctx;
    const panel = createPanel("exam-q4", "", i18n.t("exam.tab.q4"));
    els.content.appendChild(panel.box);
    const hint = document.createElement("p");
    hint.className = "muted";
    hint.textContent = i18n.t("exam.q4.hint");
    // "no target" is part of the question's answer, not a footnote: nothing is predicted, no rating is
    // held out, so these numbers are not the trace's filtered ones
    const noTarget = document.createElement("p");
    noTarget.className = "muted exam-q4-note";
    noTarget.textContent = i18n.t("exam.q4.no_target");

    const form = document.createElement("div");
    form.className = "param-form exam-q4-form";
    // the picker draws its own "User" label
    const userBox = document.createElement("div");
    userBox.className = "exam-q4-user";
    const filterHost = document.createElement("div");
    form.append(userBox, filterHost);
    const results = document.createElement("div");
    results.className = "exam-results";
    panel.body.append(hint, noTarget, form, results);

    const picker = createEntityPicker(userBox, {
      i18n,
      api,
      kind: "user",
      dataset,
      // Q4 is about the class (the exam's 21): the picker starts on "class users" like the trace pages
      guards: { minRatings: 0, requireClass: true, minRaters: 0, ratedByUser: false },
      onSelect: (/** @type {number} */ index) => navigateWith({ u: String(index) }),
    });
    /** @type {number | null} */
    let shownUser = null; // the user the picker currently displays
    let seq = 0; // a newer refresh makes an older, slower one drop its result

    async function refresh() {
      const mine = ++seq;
      const cfg = await getConfig();
      if (!root || mine !== seq) return;
      results.innerHTML = "";
      if (!cfg || !cfg.q1.filters.length) {
        renderError(results, { messageKey: "exam.q4.need_filter", params: {} });
        return;
      }
      const sizes = cfg.q1.filter_sizes || {};
      const known = cfg.q1.filters.some((/** @type {any} */ x) => x.id === routeParams.f);
      const usable = cfg.q1.filters.filter((/** @type {any} */ x) => sizes[x.id] !== 0);
      const f = known ? routeParams.f : (usable[0] ?? cfg.q1.filters[0]).id;
      if (filterHost.dataset.current !== f) {
        filterHost.innerHTML = "";
        filterHost.appendChild(filterSelect(cfg, f, false, "exam.q4.filter_label"));
        filterHost.dataset.current = f;
      }
      const raw = routeParams.u;
      if (raw === undefined || raw === "") {
        shownUser = null;
        picker.update({ selected: null });
        const need = document.createElement("p");
        need.className = "muted";
        need.textContent = i18n.t("exam.q4.need_user");
        results.appendChild(need);
        return;
      }
      const user = Number(raw);
      if (shownUser !== user) {
        shownUser = user;
        api
          .user(dataset, user)
          .then((/** @type {any} */ info) => {
            if (root && shownUser === user) picker.update({ selected: info });
          })
          .catch(() => {});
      }
      const loading = document.createElement("p");
      loading.textContent = i18n.t("shell.loading");
      results.appendChild(loading);
      try {
        const data = await render("q4", { user, filter: f });
        if (!root || mine !== seq) return;
        loading.remove();
        paintQ4(results, data.neighbours, cfg);
        addExportButton(results, "q4", () => ({ user, filter: f }));
      } catch (err) {
        if (!root || mine !== seq) return;
        loading.remove();
        renderError(results, err);
      }
    }

    q4Refresh = () => {
      void refresh();
    };
    void refresh();
  }

  /** @param {HTMLElement} container @param {any} t ExamNeighbourTable @param {any} cfg */
  function paintQ4(container, t, cfg) {
    const { i18n } = ctx;
    const dec = cfg?.q4?.decimals ?? 4;
    /** @param {number | null | undefined} v */
    const num = (v) => (v === null || v === undefined ? "—" : Number(v).toFixed(dec));
    /** @param {number | null | undefined} v */
    const rank = (v) => (v === null || v === undefined ? "—" : String(v));

    for (const key of t.warn_keys) {
      if (key.endsWith("degenerate_b")) continue; // the footnote below the table
      const warn = document.createElement("span");
      warn.className = "warn-banner";
      warn.textContent = i18n.t(key);
      container.appendChild(warn);
    }
    const summary = document.createElement("p");
    summary.className = "exam-q4-summary";
    const filterChip = document.createElement("span");
    filterChip.className = "chip on";
    filterChip.textContent = presetLabel(t.filter);
    summary.append(
      filterChip,
      i18n.t("exam.q4.summary", {
        user: t.user.label,
        n_f: t.n_items_in_filter,
        n_in: t.n_active_in_filter,
        n_all: t.n_active_all,
        mean_a: num(t.mean_a_global),
        mean_b: num(t.mean_a_segment),
      })
    );
    container.appendChild(summary);

    const body = plainTable(
      container,
      [
        "neighbour",
        "c_all",
        "c",
        "mean_global",
        "mean_segment",
        "w_all",
        "w_a",
        "w_b",
        "rank_all",
        "rank_a",
        "rank_b",
        "status_a",
        "status_b",
      ].map((k) => i18n.t(`exam.q4.col_${k}`))
    );
    const table = body.closest("table");
    table?.classList.add("exam-q4-table");
    // numeric columns: the header sits over its right-aligned numbers
    table?.querySelectorAll("th").forEach((th, i) => th.classList.toggle("num", i >= 1 && i <= 10));
    let anyDegenerate = false;
    for (const r of t.rows) {
      const tr = document.createElement("tr");
      tr.dataset.neighbour = String(r.neighbour.index);
      /** @param {string} text @param {boolean} numeric @param {string} [cls] */
      const cell = (text, numeric, cls) => {
        const td = document.createElement("td");
        td.textContent = text;
        td.className = [numeric ? "num" : "", cls || ""].join(" ").trim();
        tr.appendChild(td);
        return td;
      };
      cell(r.neighbour.label, false);
      cell(String(r.c_all), true);
      cell(String(r.c), true);
      cell(num(r.mean_u_global), true);
      cell(num(r.mean_u_segment), true);
      cell(num(r.w_all), true);
      cell(num(r.w_a), true);
      const wb = cell(num(r.w_b), true);
      if (r.degenerate_b) {
        // B centres on exactly the co-rated films, so it IS the library correlation (the course's foil)
        anyDegenerate = true;
        const pill = document.createElement("span");
        pill.className = "pill exam-degenerate";
        pill.textContent = i18n.t("exam.q4.degenerate_pill");
        pill.title = i18n.t("exam.q4.degenerate_tip");
        wb.appendChild(pill);
      }
      cell(rank(r.rank_all), true);
      cell(rank(r.rank_a), true);
      cell(rank(r.rank_b), true, r.rank_b !== r.rank_a ? "exam-rank-moved" : ""); // the scope moved this neighbour
      cell(i18n.t(`status.${r.status_a}`), false);
      cell(i18n.t(`status.${r.status_b}`), false);
      body.appendChild(tr);
    }
    if (anyDegenerate) {
      const foot = document.createElement("p");
      foot.className = "muted exam-q4-foot";
      foot.textContent = i18n.t("exam.q4.warn.degenerate_b");
      container.appendChild(foot);
    }
    if (t.truncated) {
      const cut = document.createElement("p");
      cut.className = "muted exam-q4-foot";
      cut.textContent = i18n.t("exam.q4.truncated", { n: t.rows.length, total: t.n_candidates });
      container.appendChild(cut);
    }
  }

  return { mount, update, unmount };
}
