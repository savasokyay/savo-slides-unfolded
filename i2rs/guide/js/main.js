// @ts-check
// WP-31: frontend shell entry point - boots store/router/i18n/theme/api, re-renders header + nav
// on every store change. WP-32: pages are objects `{ mount(root, ctx), update(state), unmount() }`
// kept alive across route changes so a TracePlayer survives a `step` deep-link update; switching
// to another page unmounts the previous one.

import { detectApi } from "./api.js";
import { renderNavTree } from "./components/nav-tree.js";
import { createI18n } from "./i18n.js";
import { initKeyboard, setPresenting } from "./keyboard.js";
import { initNavCollapse } from "./nav-collapse.js";
import { createAtlasPage } from "./pages/atlas-page.js";
import { createCbfPage } from "./pages/cbf-page.js"; // WP-177
import { createCohortPage } from "./pages/cohort-page.js";
import { createDataPage } from "./pages/data-page.js";
import { createExamPage } from "./pages/exam-page.js";
import { createHybridPage } from "./pages/hybrid-page.js"; // WP-221
import { createMemoryPage } from "./pages/memory-page.js"; // WP-116
import { createMetricsPage } from "./pages/metrics-page.js";
import { createModelPage } from "./pages/model-page.js"; // WP-121
import { createPitfallsPage } from "./pages/pitfalls-page.js";
import { createPlaceholderPage } from "./pages/placeholder.js";
import { createSlidesPage } from "./pages/slides-page.js";
import { createTracePage } from "./pages/trace-page.js";
import { initRouter } from "./router.js";
import { createStore } from "./store.js";
import { initTheme } from "./theme.js";
import { showToast } from "./components/toast.js"; // WP-214
import { infoTip } from "./util/info-tip.js";
import { datasetOnEntry, navNodeById } from "./util/nav-dataset.js"; // WP-214; WP-221: navNodeById
import { pageShowsNames } from "./util/names-pages.js";
import { editionHas, editionStart } from "./util/publication.js"; // WP-237a: the students' publication holds only the pages it lists

/** Pages that exist; everything else renders the placeholder with its WP number. */
const PAGE_FACTORIES = {
  data: () => createDataPage(),
  users: () => createCohortPage("user"), // WP-83: every user in one sortable table
  items: () => createCohortPage("item"), // WP-83: every item in one sortable table
  memory_cf: () => createMemoryPage(), // WP-116: Memory-based CF overview (static; the parent of ucf / icf in the nav)
  model_cf: () => createModelPage(), // WP-121: Model-based CF overview (static; the parent of mf / dnn in the nav)
  cbf: () => createCbfPage(), // WP-177: Content-based overview (static; the parent of content in the nav)
  hybrid: () => createHybridPage(), // WP-221: Hybrid & ensemble overview (static; the parent of combine in the nav)
  combine: () => createTracePage("hybrid"), // WP-222: page id "combine", trace engine alias "hybrid" (the weighted hybrid's walk)
  ucf: () => createTracePage("ucf"),
  icf: () => createTracePage("icf"),
  atlas: () => createAtlasPage(), // WP-44
  pitfalls: () => createPitfallsPage(), // WP-43
  content: () => createTracePage("cb"), // WP-45: page id "content", trace engine alias "cb"
  mf: () => createTracePage("mf"), // WP-46: FunkSVD / ALS / BPR / EASE on the shared trace page
  dnn: () => createTracePage("dnn"), // WP-47: GMF / MLP / NeuMF / genre hybrid (PyTorch)
  metrics: () => createMetricsPage(), // WP-48: traced evaluation sweep + baseline battery
  exam: () => createExamPage(), // WP-49: locked Q1/Q2/Q3 exam views
  rs_tree: () => createSlidesPage("rs_tree"), // WP-66: lecture board (config/slides/rs_tree.yaml)
  rs_system: () => createSlidesPage("rs_system"), // WP-67: "From model to system" (config/slides/rs_system.yaml)
};

const PAGE_WP = {};

/** @param {string} key */
function safeLocalGet(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

async function boot() {
  const store = createStore({
    route: { page: "data", params: {} },
    theme: "light",
    lang: "en",
    presenting: false,
    examToken: null,
    meta: null,
    dataset: null,
    showHiddenOverride: false,
    navCollapsed: false,
  });
  const theme = initTheme(store);
  const navCollapse = initNavCollapse(store);
  const api = await detectApi();
  const i18n = createI18n();

  const mainEl = /** @type {HTMLElement} */ (document.getElementById("main"));
  let meta;
  try {
    meta = await api.meta();
  } catch (err) {
    mainEl.textContent = `Failed to load /api/meta: ${err instanceof Error ? err.message : String(err)}`;
    return;
  }

  const lang = safeLocalGet("i2rs.lang") || meta.defaults?.lang || "en";
  await i18n.load(api, lang);
  const nav = await api.nav();

  const router = initRouter(store);
  const publication = api.publication ?? null; // WP-237a: null in the lab (every page open, nothing stamped)
  const ctx = { store, api, i18n, theme, navCollapse, nav, router, publication };
  initKeyboard(ctx);

  // WP-76: the page the app opens on comes from config/app.yaml `defaults.page` (the lecture
  // starts on the RS tree board); only when the URL names no page - a hash always wins - and only
  // for a page this build knows, otherwise the router's own fallback (Data) stays.
  const urlPage = location.hash.replace(/^#\/?/, "").split("?")[0];
  const startPage = meta.defaults?.page;
  if (!urlPage && startPage && PAGE_FACTORIES[startPage]) router.replace(startPage, {});

  store.set({ meta, lang, dataset: meta.default_dataset });

  const headerEl = /** @type {HTMLElement} */ (document.getElementById("header"));
  const navEl = /** @type {HTMLElement} */ (document.getElementById("nav"));

  /** @type {{id: string, lang: string, page: any} | null} */
  let current = null;

  function render() {
    const state = store.get();
    renderHeader(headerEl, ctx);
    renderNavTree(navEl, ctx);
    const pageId = state.route.page;
    // a language switch re-mounts the page so static labels re-render in the new language
    if (!current || current.id !== pageId || current.lang !== state.lang) {
      if (current) current.page.unmount();
      const factory = PAGE_FACTORIES[pageId];
      const page = factory
        ? factory()
        : createPlaceholderPage(pageId, PAGE_WP[pageId] || "a later WP");
      page.mount(mainEl, ctx);
      current = { id: pageId, lang: state.lang, page };
    }
    current.page.update(state);
    // WP-78: a page that declares `usesDataset: false` (the lecture boards) gets the header's
    // dataset selector greyed with a tooltip - the doors on the board carry their own dataset,
    // so a choice here would do nothing; the control stays in place so the header never shifts.
    const datasetSel = /** @type {HTMLSelectElement | null} */ (headerEl.querySelector(".dataset-select"));
    if (datasetSel && !datasetSel.disabled) {
      const unused = current.page.usesDataset === false;
      datasetSel.disabled = unused;
      datasetSel.title = unused ? i18n.t("shell.dataset_unused") : "";
      // WP-81: the instructor wants it gone on those pages, not greyed; `visibility` keeps its
      // slot so the language / theme controls do not jump between pages
      datasetSel.style.visibility = unused ? "hidden" : "";
    }
  }
  // WP-214: a sidebar entry may name the data set its pages are taught on (config/nav.yaml `dataset`; the content-based pages ask for the class set). When the route ENTERS such a
  // group the header selector takes the same path as a click on it (`store.set({ dataset })`: every page follows it as for any change) - once on entry, a small toast says so;
  // inside the group the reader's own choice stands, leaving it brings nothing back, a route that names a data set (`ds`) wins, and a set this machine has not registered is skipped.
  // Entering changes the store, which calls this again for the new state (the group is already recorded, so it only renders): one render, with the new data set.
  /** @type {string | null} */
  let datasetGroup = null;
  /** @param {any} state @returns {boolean} true when it switched the data set (the nested call has rendered) */
  function enterDataset(state) {
    const step = datasetOnEntry({
      tree: nav.tree || [],
      route: state.route,
      prevGroup: datasetGroup,
      current: state.dataset,
      known: (name) => (state.meta?.datasets || []).some((/** @type {{name: string}} */ d) => d.name === name),
    });
    datasetGroup = step.group;
    if (step.action === "skip") {
      console.info(`[nav] data set "${step.dataset}" is not registered on this machine: the selector stays on "${state.dataset}"`);
    }
    if (step.action !== "switch") return false;
    store.set({ dataset: step.dataset });
    // WP-221: the toast names the group by the sidebar's own label ("Content-based filtering", "Hybrid & ensemble", "Feature-combination network"): the first wording said "the content-based pages" for every group
    const owner = navNodeById(nav.tree || [], step.group);
    showToast(i18n.t("shell.dataset_entered", { dataset: String(step.dataset), pages: owner ? i18n.t(owner.label_key) : String(step.group) }));
    return true;
  }
  // WP-237a: a publication holds only the pages it lists (`publication.json` `pages`): a route that names another - a locked row's page, a lab page an old link points at, `#/metrics` - opens the
  // edition's own start page and says so, instead of drawing a page that has nothing to read (a raw key, an empty trace shell). The redirect re-enters the store, which renders the start page.
  /** @param {any} state @returns {boolean} true when it redirected */
  function outsideEdition(state) {
    if (!publication || editionHas(publication, state.route.page)) return false;
    const start = editionStart(publication, meta.defaults?.page);
    if (!start) return false;
    router.replace(start, {});
    showToast(i18n.t("shell.not_in_edition"));
    return true;
  }
  store.subscribe((state) => {
    if (outsideEdition(state)) return; // WP-237a
    if (!enterDataset(state)) render();
  });
  if (!outsideEdition(store.get()) && !enterDataset(store.get())) render(); // WP-237a
}

/**
 * @param {HTMLElement} root
 * @param {{store: any, api: any, i18n: any, theme: any, nav?: any, publication?: any}} ctx WP-237a: + publication (the students' edition, null in the lab)
 */
function renderHeader(root, ctx) {
  const { i18n, store, theme, api, nav } = ctx;
  const state = store.get();
  root.innerHTML = "";

  const brand = document.createElement("div");
  brand.className = "brand";
  const logo = document.createElement("div");
  logo.className = "logo";
  const logoText = document.createElement("span");
  logoText.className = "logo-text";
  logoText.textContent = "i2rs";
  // WP-53: assets/app.ico is dropped in by the instructor; until then this 404s silently and the
  // text stays visible - no broken-image glyph (the element is only shown once it has loaded).
  const logoIcon = document.createElement("img");
  logoIcon.className = "logo-icon";
  logoIcon.alt = "";
  logoIcon.hidden = true;
  logoIcon.src = "assets/app.ico";
  logoIcon.addEventListener("load", () => {
    logoIcon.hidden = false;
    logoText.hidden = true;
  });
  logo.append(logoIcon, logoText);
  const titles = document.createElement("div");
  const titleEl = document.createElement("div");
  titleEl.textContent = i18n.t("app.title");
  // WP-54a: vX.Y.<git commit count> (i2rs.app.build_version) next to the title, small - lets
  // students see which revision is on screen without a separate footer strip.
  if (state.meta?.build_version && !ctx.publication) { // WP-237a: the edition shows its stamp in the sidebar (major.minor and the render time), never the revision
    const versionEl = document.createElement("span");
    versionEl.className = "brand-version";
    versionEl.textContent = ` (${state.meta.build_version})`;
    titleEl.appendChild(versionEl);
  }
  const subtitleEl = document.createElement("div");
  subtitleEl.className = "subtitle";
  subtitleEl.style.cssText = "font-weight:400;font-size:11px;opacity:.8";
  subtitleEl.textContent = i18n.t("app.subtitle");
  titles.append(titleEl, subtitleEl);
  brand.append(logo, titles);

  const select = document.createElement("select");
  select.className = "dataset-select"; // WP-78: render() greys it on pages that do not use it
  select.setAttribute("aria-label", i18n.t("common.dataset"));
  const datasets = state.meta?.datasets || [];
  if (datasets.length === 0) {
    const opt = document.createElement("option");
    opt.textContent = i18n.t("shell.no_datasets");
    select.appendChild(opt);
    select.disabled = true;
  } else {
    for (const ds of datasets) {
      const opt = document.createElement("option");
      opt.value = ds.name;
      opt.textContent = ds.name;
      opt.selected = ds.name === state.dataset;
      select.appendChild(opt);
    }
  }
  select.addEventListener("change", () => store.set({ dataset: select.value }));

  const langSeg = buildSeg(["en", "tr"], state.lang, async (next) => {
    if (!(await i18n.load(api, next))) return; // WP-97: a later click's load superseded this one (fast double click)
    try {
      localStorage.setItem("i2rs.lang", next);
    } catch {
      /* private browsing - the toggle still works for this page view */
    }
    store.set({ lang: next });
  });

  const themeSeg = buildSeg(
    ["light", "dark"],
    state.theme,
    (next) => theme.set(next),
    (v) => (v === "light" ? "☀" : "◑")
  );

  const presentBtn = document.createElement("button");
  presentBtn.className = "icon-btn";
  presentBtn.type = "button";
  presentBtn.title = i18n.t("common.presenting");
  presentBtn.setAttribute("aria-pressed", String(!!state.presenting));
  presentBtn.textContent = "⛶";
  presentBtn.addEventListener("click", () => setPresenting(store, !store.get().presenting));

  const spacer = document.createElement("div");
  spacer.className = "spacer";

  // WP-93: a small badge while the selected dataset shows real handles (instructor's machine only).
  // WP-93a: only on a page that can print a name (config/nav.yaml `shows_names`) - not on the lecture boards,
  // not where nothing names a user - and the explanation is the app's one help bubble (the "i"), not a title.
  // WP-93b: the badge is the "i" alone (no word in the strip): the bubble's first line is the old badge text, the
  // hint follows, and the button's aria-label carries both, so nothing a screen reader had is lost.
  const shown = datasets.find((d) => d.name === state.dataset)?.handles_shown === true;
  if (shown && pageShowsNames(nav, state.route.page)) {
    const badge = document.createElement("span");
    badge.className = "handles-badge";
    const tip = infoTip(i18n.t("shell.handles_shown_hint"), i18n.t("shell.handles_shown"), i18n.t("shell.handles_shown"));
    tip.classList.add("handles-tip");
    badge.append(tip);
    root.append(brand, spacer, badge, select, langSeg, themeSeg, presentBtn);
    return;
  }
  // WP-237a: the edition has no data set, so the header's disabled "No datasets registered." selector is not drawn
  root.append(brand, spacer, ...(ctx.publication ? [] : [select]), langSeg, themeSeg, presentBtn);
}

/**
 * @param {string[]} options
 * @param {string} current
 * @param {(next: string) => void} onSelect
 * @param {(value: string) => string} [label]
 */
function buildSeg(options, current, onSelect, label) {
  const seg = document.createElement("div");
  seg.className = "seg";
  for (const opt of options) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = label ? label(opt) : opt.toUpperCase();
    if (opt === current) btn.classList.add("active");
    btn.addEventListener("click", () => onSelect(opt));
    seg.appendChild(btn);
  }
  return seg;
}

boot();
