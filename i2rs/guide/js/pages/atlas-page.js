// @ts-check
// WP-44: Similarity atlas page - the exam's Q1 as a live view: every pairwise similarity of a chosen
// entity set (class cohort users, degree-filtered items, top-N, or explicit indices) as a heatmap
// with the answer key's 3-colour anchors, the significance-weighted variant and the co-rated counts
// as alternative views, a threshold graph drawn on a classical-MDS embedding ("holistic view",
// like-minded vs outlier entities) and two tables (most like-minded pairs, per-entity marginals).
//
// The route is the single source of truth (deep links): `ds`, `ent`, `sub`, `lim`, `sim`, `mc`,
// `ctr`, `sw`, `swn`, `minc`, `deg`, `thr`, `idx` build the complete AtlasSpec the API expects
// (`specFromParams`); `view` picks the matrix shown; the palette lives in localStorage only.
// Page object contract: `{mount(root, ctx), update(state), unmount()}` (WP-32).

import { createChart, themeColors } from "../components/chart.js";
import { fmt } from "../util/format.js";
import { createPanel } from "../util/panel.js";
import { userLabel } from "../util/user-link.js"; // WP-96
import { segOption } from "../util/seg-option.js"; // WP-133

/** Diverging palettes; the mid colour is theme-dependent (see `midColor`). */
const PALETTES = {
  default: { low: "#c0392b", high: "#1a9d54" }, // answer key: red - white - green
  cb: { low: "#b35806", high: "#542788" }, // ColorBrewer PuOr endpoints (colour-blind safe)
};
const VIEWS = /** @type {const} */ (["values", "weighted", "counts"]);
const CELL_TEXT_MAX_N = 30; // annotate cells with their value up to this many entities

/**
 * Route params -> the complete AtlasSpec wire set (every key present, numbers as numbers) so the
 * live route and the static manifest matcher see one canonical object.
 * @param {Record<string, string>} params
 * @param {any} cfg  /api/config/atlas
 * @returns {Record<string, unknown>}
 */
export function specFromParams(params, cfg) {
  const d = (cfg && cfg.defaults) || {};
  const entity = params.ent === "item" || params.ent === "user" ? params.ent : d.entity || "user";
  const subsetDefault = entity === "user" ? d.subset_user || "class" : d.subset_item || "degree";
  const num = (raw, fallback) => {
    const v = raw === undefined || raw === "" ? NaN : Number(raw);
    return Number.isFinite(v) ? v : Number(fallback);
  };
  const sigMode =
    params.sw === undefined
      ? d.sig_mode || "none"
      : params.sw === "ratio"
        ? "min_ratio"
        : params.sw === "raw"
          ? "raw_count"
          : params.sw === "adaptive"
            ? "adaptive_fraction"
            : "none";
  /** @type {Record<string, unknown>} */
  const spec = {
    entity,
    similarity: params.sim || d.similarity || "pearson",
    mean_convention: params.mc || d.mean_convention || "dynamic",
    centering: entity === "item" && params.ctr === "item" ? "item_mean" : "user_mean",
    sig_mode: sigMode,
    sig_n: num(params.swn, d.sig_n ?? 50),
    min_corated: num(params.minc, d.min_corated ?? 1),
    subset: params.sub || subsetDefault,
    limit: num(params.lim, d.limit ?? 120),
    degree_fraction: num(params.deg, d.degree_fraction ?? 0.5),
    threshold: num(params.thr, d.threshold ?? 0.5),
  };
  // canonical form (sorted, unique) - the server echoes the same, so "4,0" and "0,4" are one atlas
  if (spec.subset === "indices") {
    const seen = new Set(
      String(params.idx || "")
        .split(",")
        .map((s) => Number(s))
        .filter((n) => Number.isInteger(n) && n >= 0)
    );
    spec.indices = [...seen].sort((a, b) => a - b).join(",");
  }
  return spec;
}

/** @param {string} theme */
function midColor(theme) {
  return theme === "dark" ? "#4b5563" : "#ffffff";
}

export function createAtlasPage() {
  /** @type {HTMLElement | null} */
  let root = null;
  /** @type {any} */
  let ctx = null;
  /** @type {any} */
  let els = null;
  let dataset = "";
  let lang = "";
  let theme = "";
  /** @type {Record<string, string>} */
  let routeParams = {};
  /** @type {any} */
  let cfg = null;
  /** @type {any[]} */
  let catalogue = [];
  /** @type {string} */
  let loadedKey = "";
  // WP-97: ticket of the newest atlas request; an older answer (a slower earlier spec, or one asked before an
  // unmount / re-mount) is dropped instead of being drawn over the spec the route names now
  let loadSeq = 0;
  /** @type {any} */
  let current = null; // last AtlasResponse
  let controlsKey = "";
  /** @type {{destroy(): void} | null} */
  let heatChart = null;
  /** @type {{destroy(): void} | null} */
  let mapChart = null;
  let palette = "default";
  try {
    palette = localStorage.getItem("i2rs.atlasPalette") || "default";
  } catch {
    /* private browsing */
  }

  /**
   * @param {HTMLElement} rootEl
   * @param {any} context
   */
  function mount(rootEl, context) {
    root = rootEl;
    ctx = context;
    loadSeq += 1; // WP-97
    dataset = "";
    loadedKey = "";
    controlsKey = "";
    current = null;
    root.innerHTML = "";
    const { i18n } = context;
    const page = document.createElement("div");
    page.className = "atlas-page";
    const title = document.createElement("h2");
    const controls = createPanel("atlas-controls", "", i18n.t("atlas.controls"), true);
    const summary = document.createElement("div");
    summary.className = "trace-summary";
    const grid = document.createElement("div");
    grid.className = "atlas-grid";
    const heat = createPanel("atlas-heat", "", i18n.t("atlas.heatmap_title"));
    const map = createPanel("atlas-map", "", i18n.t("atlas.map_title"));
    grid.append(heat.box, map.box);
    const tables = document.createElement("div");
    tables.className = "atlas-tables";
    const pairs = createPanel("atlas-pairs", "", i18n.t("atlas.pairs_title"));
    const entities = createPanel("atlas-entities", "", i18n.t("atlas.entities_title"));
    tables.append(pairs.box, entities.box);
    page.append(title, controls.box, summary, grid, tables);
    root.appendChild(page);
    els = {
      title,
      controls: controls.body,
      summary,
      heat: heat.body,
      map: map.body,
      pairs: pairs.body,
      entities: entities.body,
    };
  }

  /** @param {any} state */
  function update(state) {
    if (!root || !ctx) return;
    routeParams = state.route.params || {};
    const nextDataset = routeParams.ds || state.dataset || "";
    const nextLang = state.lang || "en";
    const nextTheme = state.theme || "light";
    const repaint = nextLang !== lang || nextTheme !== theme;
    dataset = nextDataset;
    lang = nextLang;
    theme = nextTheme;
    if (!dataset) return;
    ensureConfig().then(() => {
      if (!root) return;
      renderControls();
      const spec = specFromParams(routeParams, cfg);
      const key = JSON.stringify([dataset, spec]);
      if (key !== loadedKey) {
        loadedKey = key;
        load(spec);
      } else if (current) {
        // only the view / palette / theme / language changed: repaint from the cached response
        renderAll(current, repaint);
      }
    });
  }

  function unmount() {
    loadSeq += 1; // WP-97
    if (heatChart) heatChart.destroy();
    if (mapChart) mapChart.destroy();
    heatChart = null;
    mapChart = null;
    root = null;
    ctx = null;
    els = null;
  }

  async function ensureConfig() {
    if (cfg && catalogue.length) return;
    [cfg, catalogue] = await Promise.all([ctx.api.atlasConfig(), ctx.api.similarities()]);
  }

  /** @param {Record<string, string | undefined>} patch */
  function navigateWith(patch) {
    ctx.router.navigate("atlas", { ...routeParams, ...patch, ds: dataset });
  }

  // ── controls ───────────────────────────────────────────────────────────────────────────────

  function renderControls() {
    const { i18n } = ctx;
    const spec = specFromParams(routeParams, cfg);
    const key = JSON.stringify([lang, spec, routeParams.view]);
    if (key === controlsKey) return;
    controlsKey = key;
    const rootEl = els.controls;
    rootEl.innerHTML = "";
    rootEl.classList.add("param-form");

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
    /**
     * @param {[string, string][]} options
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
     * WP-133: an entry may carry `{ fault: true }` as its fourth element (util/seg-option.js): the button is marked `is-fault` and the stylesheet
     * pulses it red while it is the pressed choice - the same control as on the item-based page's Parameters panel.
     * @param {import("../util/seg-option.js").SegEntry[] | [string, string][]} options
     * @param {string} value
     * @param {(v: string) => void} [onChange]
     */
    function miniseg(options, value, onChange) {
      const seg = document.createElement("div");
      seg.className = "miniseg";
      seg.dataset.value = value;
      for (const entry of options) {
        const { value: v, label: text, fault } = segOption(entry); // WP-133
        const b = document.createElement("button");
        b.type = "button";
        b.textContent = text;
        b.dataset.value = v;
        b.classList.toggle("is-fault", fault); // WP-133
        b.classList.toggle("active", v === value);
        b.addEventListener("click", () => {
          seg.dataset.value = v;
          for (const other of seg.querySelectorAll("button")) other.classList.toggle("active", other === b);
          if (onChange) onChange(v);
        });
        seg.appendChild(b);
      }
      return seg;
    }
    /** @param {string} value @param {string} step @param {string} min */
    function number(value, step, min) {
      const el = document.createElement("input");
      el.type = "number";
      el.value = value;
      el.step = step;
      el.min = min;
      return el;
    }

    const userSubsets = /** @type {[string, string][]} */ ([
      ["class", i18n.t("atlas.subset_class")],
      ["top", i18n.t("atlas.subset_top")],
      ["indices", i18n.t("atlas.subset_indices")],
    ]);
    const itemSubsets = /** @type {[string, string][]} */ ([
      ["degree", i18n.t("atlas.subset_degree")],
      ["top", i18n.t("atlas.subset_top")],
      ["indices", i18n.t("atlas.subset_indices")],
    ]);
    const d = cfg.defaults || {};
    let entity = String(spec.entity);
    const subsetSel = select(entity === "user" ? userSubsets : itemSubsets, String(spec.subset));
    const simSel = select(
      catalogue
        .filter((s) => !s.name.endsWith("_item_centred")) // the centring switch covers the fault
        .map((s) => [s.name, `${i18n.t(s.label_key)}${s.tags.includes("core") ? "" : ` (${s.tags.map((t) => i18n.t(`tag.${t}`)).join(", ")})`}`]),
      String(spec.similarity)
    );
    const ctrSeg = miniseg(
      [
        ["user", i18n.t("params.ctr_user")],
        ["item", i18n.t("params.ctr_item"), undefined, { fault: true }], // WP-133: the same deliberate mistake as on the item-based page
      ],
      spec.centering === "item_mean" ? "item" : "user"
    );
    const degIn = number(String(spec.degree_fraction), "0.05", "0.05");
    function syncEntity() {
      const keep = subsetSel.value;
      const options = entity === "user" ? userSubsets : itemSubsets;
      subsetSel.innerHTML = "";
      for (const [v, text] of options) {
        const opt = document.createElement("option");
        opt.value = v;
        opt.textContent = text;
        opt.selected = v === keep;
        subsetSel.appendChild(opt);
      }
      if (!options.some(([v]) => v === subsetSel.value)) {
        subsetSel.value = entity === "user" ? d.subset_user || "class" : d.subset_item || "degree";
      }
      const itemCtr = entity === "item" && simSel.value === "adjusted_cosine";
      ctrSeg.classList.toggle("disabled", !itemCtr);
      for (const b of ctrSeg.querySelectorAll("button")) b.disabled = !itemCtr;
      degIn.disabled = !(entity === "item" && subsetSel.value === "degree");
    }
    const entSeg = miniseg(
      [
        ["user", i18n.t("atlas.entity_user")],
        ["item", i18n.t("atlas.entity_item")],
      ],
      entity,
      (v) => {
        entity = v;
        syncEntity();
      }
    );
    simSel.addEventListener("change", syncEntity);
    subsetSel.addEventListener("change", syncEntity);
    const limIn = number(String(spec.limit), "1", "1");
    limIn.max = String(d.max_limit ?? 200);
    const mcSeg = miniseg(
      [
        ["dynamic", i18n.t("params.mc_dynamic")],
        ["static", i18n.t("params.mc_static")],
        ["corated_only", i18n.t("params.mc_corated_only")],
      ],
      String(spec.mean_convention)
    );
    const swSel = select(
      [
        ["none", i18n.t("params.sig_none")],
        ["min_ratio", i18n.t("params.sig_min_ratio")],
        ["raw_count", i18n.t("params.sig_raw_count")],
      ],
      String(spec.sig_mode) === "adaptive_fraction" ? "min_ratio" : String(spec.sig_mode)
    );
    const swnIn = number(String(spec.sig_n), "1", "1");
    const mincIn = number(String(spec.min_corated), "1", "0");
    const thrIn = number(String(spec.threshold), "0.05", "-1");
    thrIn.max = "1";
    syncEntity();

    const grid = document.createElement("div");
    grid.className = "param-grid";
    grid.append(
      field("atlas.entity", entSeg),
      field("atlas.subset", subsetSel),
      field("atlas.limit", limIn),
      field("atlas.degree_fraction", degIn),
      field("params.similarity", simSel),
      field("params.centering", ctrSeg),
      field("params.mean_convention", mcSeg),
      field("params.sig_mode", swSel),
      field("params.sig_n", swnIn),
      field("atlas.min_corated", mincIn),
      field("atlas.threshold", thrIn)
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
      const mode = swSel.value;
      /** @type {Record<string, string | undefined>} */
      const params = {
        ent: entity,
        sub: subsetSel.value,
        lim: String(Math.max(1, Math.round(Number(limIn.value) || Number(d.limit ?? 120)))),
        sim: simSel.value,
        mc: mcSeg.dataset.value,
        ctr: entity === "item" && simSel.value === "adjusted_cosine" && ctrSeg.dataset.value === "item" ? "item" : undefined,
        sw: mode === "none" ? "none" : mode === "raw_count" ? "raw" : "ratio",
        swn: mode === "none" ? undefined : String(Math.max(1, Number(swnIn.value) || 50)),
        minc: String(Math.max(0, Math.round(Number(mincIn.value) || 0))),
        deg: entity === "item" && subsetSel.value === "degree" ? String(Number(degIn.value) || 0.5) : undefined,
        thr: String(Number(thrIn.value)),
      };
      if (subsetSel.value !== "indices") params.idx = undefined;
      return params;
    }
    apply.addEventListener("click", () => navigateWith(collect()));
    reset.addEventListener("click", () =>
      navigateWith({
        ent: undefined,
        sub: undefined,
        lim: undefined,
        sim: undefined,
        mc: undefined,
        ctr: undefined,
        sw: undefined,
        swn: undefined,
        minc: undefined,
        deg: undefined,
        thr: undefined,
        idx: undefined,
      })
    );
    rootEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && /** @type {HTMLElement} */ (e.target).tagName === "INPUT") {
        e.preventDefault();
        navigateWith(collect());
      }
    });
  }

  // ── data + rendering ───────────────────────────────────────────────────────────────────────

  /** @param {Record<string, unknown>} spec */
  async function load(spec) {
    const { api, i18n } = ctx;
    const mine = (loadSeq += 1); // WP-97
    els.summary.innerHTML = "";
    const loading = document.createElement("span");
    loading.className = "chip";
    loading.textContent = i18n.t("atlas.loading");
    els.summary.appendChild(loading);
    try {
      const res = await api.atlas(dataset, spec);
      if (!root || mine !== loadSeq) return;
      current = res;
      renderAll(res, true);
    } catch (err) {
      if (!root || mine !== loadSeq) return;
      current = null;
      els.summary.innerHTML = "";
      const warn = document.createElement("span");
      warn.className = "warn-banner";
      warn.textContent = i18n.t("atlas.failed", { message: errorText(err) });
      els.summary.appendChild(warn);
      els.heat.innerHTML = "";
      els.map.innerHTML = "";
      els.pairs.innerHTML = "";
      els.entities.innerHTML = "";
    }
  }

  /** @param {unknown} err */
  function errorText(err) {
    if (err && typeof err === "object" && "messageKey" in err) {
      return ctx.i18n.t(/** @type {any} */ (err).messageKey, /** @type {any} */ (err).params);
    }
    return err instanceof Error ? err.message : String(err);
  }

  /** @param {any} res @param {boolean} full */
  function renderAll(res, full) {
    els.title.textContent = ctx.i18n.t("atlas.title", { dataset });
    renderSummary(res);
    renderHeatmap(res);
    if (full) {
      renderMap(res);
      renderPairs(res);
      renderEntities(res);
    }
  }

  /** @param {any} res */
  function currentView() {
    const v = routeParams.view;
    if (v === "weighted" && current && !current.weighted) return "values";
    return VIEWS.includes(/** @type {any} */ (v)) ? v : "values";
  }

  /** @param {any} res */
  function renderSummary(res) {
    const { i18n } = ctx;
    els.summary.innerHTML = "";
    const entityWord = i18n.t(res.entity === "user" ? "atlas.entity_user" : "atlas.entity_item");
    const eff = res.weighted || res.values;
    let defined = 0;
    let sum = 0;
    for (let i = 0; i < res.n; i += 1) {
      for (let j = 0; j < res.n; j += 1) {
        if (i !== j && eff[i][j] !== null) {
          defined += 1;
          sum += eff[i][j];
        }
      }
    }
    const possible = res.n * (res.n - 1);
    const chips = [
      i18n.t("atlas.n_entities", { n: res.n, total: res.n_total, entity: entityWord }),
      i18n.t("atlas.defined_pairs", { pct: possible ? ((100 * defined) / possible).toFixed(0) : "0" }),
      i18n.t("atlas.mean_sim", { v: defined ? fmt(sum / defined) : "—" }),
      i18n.t("atlas.edges", { n: res.edges.length, thr: fmt(res.spec.threshold, 2) }),
    ];
    if (res.weighted) chips.push(i18n.t("atlas.weighted_with", { n: fmt(res.n_eff ?? res.spec.sig_n, 0) }));
    for (const text of chips) {
      const chip = document.createElement("span");
      chip.className = "chip";
      chip.textContent = text;
      els.summary.appendChild(chip);
    }
    const label = document.createElement("span");
    label.className = "chip on";
    label.textContent = i18n.t(res.label_key);
    if (res.tags.includes("fault") || res.tags.includes("foil")) {
      const pill = document.createElement("span");
      pill.className = `pill tag-${res.tags.includes("fault") ? "fault" : "foil"}`;
      pill.textContent = i18n.t(`tag.${res.tags.includes("fault") ? "fault" : "foil"}`);
      label.appendChild(pill);
    }
    els.summary.appendChild(label);
    if (res.truncated) {
      const warn = document.createElement("span");
      warn.className = "warn-banner";
      warn.textContent = i18n.t("atlas.truncated", { limit: res.spec.limit });
      els.summary.appendChild(warn);
    }
    for (const note of res.notes || []) {
      const warn = document.createElement("span");
      warn.className = "warn-banner";
      warn.textContent = i18n.t(note);
      els.summary.appendChild(warn);
    }
  }

  /** @param {any} res */
  function renderHeatmap(res) {
    const { i18n } = ctx;
    const view = currentView();
    els.heat.innerHTML = "";
    if (heatChart) heatChart.destroy();

    // view / palette switches (immediate, no Apply)
    const bar = document.createElement("div");
    bar.className = "atlas-view";
    const viewLabel = document.createElement("span");
    viewLabel.className = "atlas-view-label";
    viewLabel.textContent = i18n.t("atlas.view");
    const viewSeg = document.createElement("div");
    viewSeg.className = "miniseg";
    for (const v of VIEWS) {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = i18n.t(`atlas.view_${v}`);
      b.classList.toggle("active", v === view);
      b.disabled = v === "weighted" && !res.weighted;
      b.addEventListener("click", () => ctx.router.replace("atlas", { ...routeParams, ds: dataset, view: v }));
      viewSeg.appendChild(b);
    }
    const palLabel = document.createElement("span");
    palLabel.className = "atlas-view-label";
    palLabel.textContent = i18n.t("atlas.palette");
    const palSeg = document.createElement("div");
    palSeg.className = "miniseg";
    for (const [p, key] of [
      ["default", "atlas.palette_default"],
      ["cb", "atlas.palette_cb"],
    ]) {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = i18n.t(key);
      b.classList.toggle("active", p === palette);
      b.addEventListener("click", () => {
        palette = p;
        try {
          localStorage.setItem("i2rs.atlasPalette", p);
        } catch {
          /* private browsing */
        }
        renderHeatmap(res);
      });
      palSeg.appendChild(b);
    }
    bar.append(viewLabel, viewSeg, palLabel, palSeg);
    els.heat.appendChild(bar);

    const plot = document.createElement("div");
    plot.className = "atlas-heatmap";
    plot.style.height = `${Math.min(760, Math.max(320, res.n * 22 + 150))}px`;
    els.heat.appendChild(plot);

    const anchors = view === "counts" ? res.anchors.counts : res.anchors.values;
    const [lo, mid, hi] = anchors;
    const midPos = hi > lo ? Math.min(1, Math.max(0, (mid - lo) / (hi - lo))) : 0.5;
    const pal = PALETTES[palette] || PALETTES.default;
    const c = themeColors();
    /** @type {(number | null)[][]} */
    const z =
      view === "counts"
        ? res.counts.map((row, i) => row.map((v, j) => (i === j ? null : v)))
        : view === "weighted" && res.weighted
          ? res.weighted
          : res.values;
    const text = z.map((row) => row.map((v) => (v === null ? "" : view === "counts" ? String(v) : Number(v).toFixed(2))));
    const customdata = res.counts;
    heatChart = createChart(plot);
    heatChart.render(
      [
        {
          type: "heatmap",
          z,
          x: res.labels,
          y: res.labels,
          text,
          customdata,
          texttemplate: res.n <= CELL_TEXT_MAX_N ? "%{text}" : "",
          textfont: { size: 10, color: c.ink },
          hovertemplate: "%{y} × %{x}<br>%{text}<br>c = %{customdata}<extra></extra>",
          hoverongaps: false,
          zmin: lo,
          zmax: hi,
          zauto: false,
          colorscale: [
            [0, pal.low],
            [midPos, midColor(theme)],
            [1, pal.high],
          ],
          colorbar: { tickvals: anchors, thickness: 12, len: 0.75, tickfont: { size: 10 } },
          xgap: 1,
          ygap: 1,
        },
      ],
      {
        margin: { l: 120, r: 10, t: 120, b: 10 },
        plot_bgcolor: c.line, // gaps (undefined pairs, the diagonal) read as a neutral grey
        xaxis: { side: "top", tickangle: -45, tickfont: { size: 10 }, showgrid: false, zeroline: false },
        yaxis: { autorange: "reversed", tickfont: { size: 10 }, showgrid: false, zeroline: false },
      }
    );
    const note = document.createElement("p");
    note.className = "atlas-note";
    note.textContent = `${i18n.t("atlas.heatmap_note", { minc: res.spec.min_corated })} ${i18n.t("atlas.anchors", {
      lo: fmt(lo, 2),
      mid: fmt(mid, 2),
      hi: fmt(hi, 2),
    })}`;
    els.heat.appendChild(note);
  }

  /** @param {any} res */
  function renderMap(res) {
    const { i18n } = ctx;
    els.map.innerHTML = "";
    if (mapChart) mapChart.destroy();
    const plot = document.createElement("div");
    plot.className = "atlas-map";
    els.map.appendChild(plot);
    const c = themeColors();
    const x = res.mds.x;
    const y = res.mds.y;
    const strong = res.spec.threshold + (1 - res.spec.threshold) / 2;
    /** @param {(e: number[]) => boolean} keep */
    const edgeTrace = (keep, width) => {
      /** @type {(number | null)[]} */
      const ex = [];
      /** @type {(number | null)[]} */
      const ey = [];
      for (const e of res.edges) {
        if (!keep(e)) continue;
        ex.push(x[e[0]], x[e[1]], null);
        ey.push(y[e[0]], y[e[1]], null);
      }
      return {
        type: "scatter",
        mode: "lines",
        x: ex,
        y: ey,
        line: { color: c.muted, width },
        opacity: 0.6,
        hoverinfo: "skip",
      };
    };
    const maxRatings = Math.max(1, ...res.entities.map((e) => e.n_ratings));
    const nodes = {
      type: "scatter",
      mode: "markers+text",
      x,
      y,
      text: res.labels,
      textposition: "top center",
      textfont: { size: 10, color: c.ink },
      customdata: res.entities.map((e) => [fmt(e.mean), fmt(e.max), e.degree, e.n_ratings]),
      hovertemplate:
        "%{text}<br>mean s = %{customdata[0]} · max s = %{customdata[1]}<br>degree %{customdata[2]} · %{customdata[3]} ratings<extra></extra>",
      marker: {
        size: res.entities.map((e) => 9 + 14 * Math.sqrt(e.n_ratings / maxRatings)),
        color: res.entities.map((e) => (e.cohort === "ml" ? c.maroon : c.navy)),
        line: {
          color: res.entities.map((e) => (e.outlier ? "#c0392b" : c.line)),
          width: res.entities.map((e) => (e.outlier ? 3 : 1)),
        },
      },
    };
    mapChart = createChart(plot);
    mapChart.render([edgeTrace((e) => e[2] < strong, 1), edgeTrace((e) => e[2] >= strong, 2.5), nodes], {
      margin: { l: 10, r: 10, t: 10, b: 10 },
      xaxis: { showticklabels: false, zeroline: false, showgrid: false },
      yaxis: { showticklabels: false, zeroline: false, showgrid: false, scaleanchor: "x" },
      hovermode: "closest",
    });
    const note = document.createElement("p");
    note.className = "atlas-note";
    const [e1, e2] = res.mds.explained || [0, 0];
    note.textContent = i18n.t(res.distance_kind === "unit" ? "atlas.map_note_unit" : "atlas.map_note_correlation", {
      e1: (100 * e1).toFixed(0),
      e2: (100 * e2).toFixed(0),
    });
    els.map.appendChild(note);
  }

  /**
   * @param {HTMLElement} rootEl
   * @param {string[]} headers
   * @param {string[]} numericHeaders
   */
  function plainTable(rootEl, headers, numericHeaders) {
    const wrap = document.createElement("div");
    wrap.className = "table-wrap";
    const table = document.createElement("table");
    table.className = "data-table";
    const thead = document.createElement("thead");
    const tr = document.createElement("tr");
    for (const h of headers) {
      const th = document.createElement("th");
      th.textContent = h;
      if (numericHeaders.includes(h)) th.className = "num";
      tr.appendChild(th);
    }
    thead.appendChild(tr);
    const tbody = document.createElement("tbody");
    table.append(thead, tbody);
    wrap.appendChild(table);
    rootEl.appendChild(wrap);
    return tbody;
  }

  /** @param {any} res */
  function renderPairs(res) {
    const { i18n } = ctx;
    els.pairs.innerHTML = "";
    if (!res.top_pairs.length) {
      const p = document.createElement("p");
      p.className = "muted";
      p.textContent = i18n.t("atlas.no_pairs");
      els.pairs.appendChild(p);
      return;
    }
    const sHead = i18n.t("atlas.col_s");
    const cHead = i18n.t("atlas.col_c");
    const tbody = plainTable(els.pairs, [i18n.t("atlas.col_a"), i18n.t("atlas.col_b"), sHead, cHead], [sHead, cHead]);
    for (const [i, j, s, cnt] of res.top_pairs) {
      const tr = document.createElement("tr");
      for (const [text, numeric, at] of [
        [res.labels[i], false, i],
        [res.labels[j], false, j],
        [fmt(s), true, -1],
        [String(cnt), true, -1],
      ]) {
        const td = document.createElement("td");
        // WP-96: a user atlas names users; the server fills `profile_url` per entity (handles mode)
        const url = at >= 0 ? res.entities?.[at]?.profile_url : null;
        if (url) {
          td.appendChild(userLabel({ label: /** @type {string} */ (text), profile_url: url }, { t: (k, p) => ctx.i18n.t(k, p) }));
        } else {
          td.textContent = /** @type {string} */ (text);
        }
        if (numeric) td.className = "num";
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
  }

  /** @param {any} res */
  function renderEntities(res) {
    const { i18n } = ctx;
    els.entities.innerHTML = "";
    const heads = {
      entity: i18n.t("atlas.col_entity"),
      ratings: i18n.t("atlas.col_ratings"),
      mean: i18n.t("atlas.col_mean"),
      max: i18n.t("atlas.col_max"),
      degree: i18n.t("atlas.col_degree"),
    };
    const tbody = plainTable(
      els.entities,
      [heads.entity, heads.ratings, heads.mean, heads.max, heads.degree],
      [heads.ratings, heads.mean, heads.max, heads.degree]
    );
    const maxDegree = Math.max(0, ...res.entities.map((e) => e.degree));
    const sorted = [...res.entities].sort((a, b) => {
      if (a.mean === null && b.mean === null) return a.pos - b.pos;
      if (a.mean === null) return 1;
      if (b.mean === null) return -1;
      return b.mean - a.mean || a.pos - b.pos;
    });
    for (const e of sorted) {
      const tr = document.createElement("tr");
      const name = document.createElement("td");
      if (e.profile_url) {
        name.appendChild(userLabel(e, { t: (k, p) => i18n.t(k, p) })); // WP-96
      } else {
        name.textContent = e.label;
      }
      if (e.outlier) {
        const pill = document.createElement("span");
        pill.className = "pill tag-outlier";
        pill.textContent = i18n.t("atlas.outlier");
        name.appendChild(pill);
      } else if (maxDegree > 0 && e.degree === maxDegree) {
        const pill = document.createElement("span");
        pill.className = "pill tag-hub";
        pill.textContent = i18n.t("atlas.hub");
        name.appendChild(pill);
      }
      tr.appendChild(name);
      for (const value of [String(e.n_ratings), fmt(e.mean), fmt(e.max), String(e.degree)]) {
        const td = document.createElement("td");
        td.className = "num";
        td.textContent = value;
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
  }

  return { mount, update, unmount };
}
