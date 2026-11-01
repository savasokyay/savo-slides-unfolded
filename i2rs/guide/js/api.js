// @ts-check
// WP-31: API client. `detectApi()` probes `./manifest.json` (200 -> static export, WP-50) and
// falls back to the live FastAPI server (`/api/meta`). Both classes expose the same method set so
// the rest of the frontend never checks the mode itself.
//
// StaticApi serves config, i18n, and per-dataset card/stats/users/items as plain JSON files, plus
// any `Trace` the export command froze from config/export/pairs.yaml (WP-50) - matched by
// (dataset, engine, dense user/item, config), the same fields trace-page.js actually sends; see
// `manifest.traces`. Everything that needs an arbitrary live prediction (pick, submatrix,
// pair-similarities, runs, exam) stays a clearly labelled ApiError instead of half-implementing a
// lookup that has nothing to look up in a static bundle.

import { isPublicationManifest, readPublication } from "./util/publication.js"; // WP-237a

export class ApiError extends Error {
  /**
   * @param {string} code
   * @param {string} messageKey
   * @param {Record<string, unknown>} params
   * @param {number} status
   */
  constructor(code, messageKey, params, status) {
    super(messageKey);
    this.code = code;
    this.messageKey = messageKey;
    this.params = params || {};
    this.status = status;
  }
}

/** @param {Response} res */
async function handle(res) {
  /** @type {any} */
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* empty body (e.g. a 204) - fall through with data = null */
  }
  if (!res.ok) {
    const err = (data && data.error) || {};
    throw new ApiError(
      err.code || "http_error",
      err.message_key || "error.http",
      err.params || { detail: res.statusText },
      res.status
    );
  }
  return data;
}

/**
 * @param {string} path
 * @param {Record<string, unknown>} [params]
 */
function withParams(path, params) {
  const url = new URL(path, location.origin);
  for (const [k, v] of Object.entries(params || {})) {
    if (Array.isArray(v)) {
      for (const one of v) url.searchParams.append(k, String(one)); // WP-95: a repeated parameter (`flag=a&flag=b`)
    } else if (v !== undefined && v !== null) {
      url.searchParams.set(k, String(v));
    }
  }
  return url.pathname + url.search;
}

class LiveApi {
  mode = "live";
  /** WP-237a: the lab is not a publication: every page is open, nothing is stamped @type {import("./util/publication.js").Publication | null} */
  publication = null;

  /**
   * @param {string} path
   * @param {{params?: Record<string, unknown>, body?: unknown, method?: string, token?: string | null}} [opts]
   */
  async _request(path, opts = {}) {
    const headers = { "Content-Type": "application/json" };
    if (opts.token) headers["Authorization"] = `Bearer ${opts.token}`;
    const res = await fetch(withParams(path, opts.params), {
      method: opts.method || (opts.body !== undefined ? "POST" : "GET"),
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
    return handle(res);
  }

  meta() {
    return this._request("/api/meta");
  }
  nav() {
    return this._request("/api/config/nav");
  }
  /** @param {string} lang */
  i18n(lang) {
    return this._request(`/api/config/i18n/${lang}`);
  }
  /** @param {string} id */
  flowchart(id) {
    return this._request(`/api/config/flowcharts/${id}`);
  }
  // WP-66: lecture-board decks (Slides pages)
  slides() {
    return this._request("/api/config/slides");
  }
  /** @param {string} id */
  slide(id) {
    return this._request(`/api/config/slides/${id}`);
  }
  formulas() {
    return this._request("/api/config/formulas");
  }
  algorithms() {
    return this._request("/api/config/algorithms");
  }
  similarities() {
    return this._request("/api/config/similarities");
  }
  /**
   * @param {string} ds
   * @param {Record<string, unknown>} params user, other, item?, mc?, kind?, cz? (WP-110 b'': the constrained Pearson's centre)
   */
  pairSimilarities(ds, params) {
    return this._request(`/api/datasets/${ds}/pair-similarities`, { params });
  }
  /**
   * WP-91: the film sets of two users (common / only A / only B) with data-quality flags.
   * @param {string} ds
   * @param {{user: number, other: number}} params dense user indices
   */
  pairFilms(ds, params) {
    return this._request(`/api/datasets/${ds}/pair-films`, { params });
  }
  /**
   * WP-91 stage 2: the rater sets of two items (users who rated both / only one).
   * @param {string} ds
   * @param {{item: number, other: number}} params dense item indices
   */
  pairRaters(ds, params) {
    return this._request(`/api/datasets/${ds}/pair-raters`, { params });
  }
  /**
   * WP-91 stage 2: data-quality flags of a list of items (the iCF candidate table).
   * @param {string} ds
   * @param {{items: string}} params comma-separated dense item indices
   */
  itemFlags(ds, params) {
    return this._request(`/api/datasets/${ds}/item-flags`, { params });
  }
  // WP-43: pitfall gallery
  pitfalls() {
    return this._request("/api/pitfalls");
  }
  /**
   * @param {string} id
   * @param {string} dataset
   * @param {{user?: number, item?: number, seeds?: number[]}} body
   */
  runPitfall(id, dataset, body) {
    return this._request(`/api/pitfalls/${id}/run`, { params: { dataset }, body });
  }
  // WP-44: similarity atlas (defaults + anchors, and the all-pairs computation)
  atlasConfig() {
    return this._request("/api/config/atlas");
  }
  // WP-121: the Model-based CF page's two worked factorization examples (config/model_examples.yaml, served as it is)
  modelExamples() {
    return this._request("/api/config/model_examples");
  }
  /**
   * @param {string} ds
   * @param {Record<string, unknown>} params the complete AtlasSpec wire set (see atlas-page.js)
   */
  atlas(ds, params) {
    return this._request(`/api/datasets/${ds}/atlas`, { params });
  }
  /** @param {string} ds */
  card(ds) {
    return this._request(`/api/datasets/${ds}/card`);
  }
  /** @param {string} ds */
  stats(ds) {
    return this._request(`/api/datasets/${ds}/stats`);
  }
  /**
   * @param {string} ds
   * @param {Record<string, unknown>} [params]
   */
  users(ds, params) {
    return this._request(`/api/datasets/${ds}/users`, { params });
  }
  /**
   * @param {string} ds
   * @param {Record<string, unknown>} [params]
   */
  items(ds, params) {
    return this._request(`/api/datasets/${ds}/items`, { params });
  }
  /**
   * @param {string} ds
   * @param {number} index
   * @param {{limit?: number, order?: "recent" | "top" | "bottom"}} [params] WP-95: the Data page's Browse lists
   */
  user(ds, index, params) {
    return this._request(`/api/datasets/${ds}/users/${index}`, { params });
  }
  /**
   * @param {string} ds
   * @param {number} index
   * @param {{limit?: number, order?: "recent" | "top" | "bottom", scope?: "all" | "class"}} [params] WP-95: the Data
   *   page's Browse lists; WP-100: `scope: "class"` lists the class cohort's raters (all of them up to the server's cap)
   */
  item(ds, index, params) {
    return this._request(`/api/datasets/${ds}/items/${index}`, { params });
  }
  /**
   * @param {string} ds
   * @param {Record<string, unknown>} body
   */
  pick(ds, body) {
    return this._request(`/api/datasets/${ds}/pick`, { body });
  }
  /**
   * @param {string} ds
   * @param {Record<string, unknown>} params
   */
  submatrix(ds, params) {
    return this._request(`/api/datasets/${ds}/submatrix`, { params });
  }
  /**
   * @param {string} ds
   * @param {Record<string, unknown>} params
   */
  splitPreview(ds, params) {
    return this._request(`/api/datasets/${ds}/split-preview`, { params });
  }
  /**
   * @param {"ucf" | "icf"} engine
   * @param {string} dataset
   * @param {Record<string, unknown>} body
   */
  trace(engine, dataset, body) {
    return this._request(`/api/trace/${engine}`, { params: { dataset }, body });
  }
  /**
   * WP-191: the progress record of a trace request that carried a `progress_id`: `{stage, stage_index, n_stages, done, total, elapsed_ms, stage_elapsed_ms, eta_ms, finished}`. Asked every
   * 250 ms by the loading strip while the request is pending; a 404 (no such record yet, or the server does not report for this engine) or any failure is `null` - the strip keeps its
   * last text, and a poll never raises a toast of its own.
   * @param {string} id
   * @returns {Promise<Record<string, unknown> | null>}
   */
  async progress(id) {
    try {
      return await this._request(`/api/progress/${encodeURIComponent(id)}`);
    } catch {
      return null;
    }
  }
  /**
   * WP-192: the walks saved beforehand (`i2rs trace warm`) for the form as it stands - `{users: [u...], pairs: [[u, i]...]}` (dense indices): the saved entries whose configuration equals
   * `query`'s (dataset, engine, task, m, f, fw, tf, k, lam). A server without the endpoint, an old one, a failure: `null` - the tick box then finds none saved and never raises a toast.
   * @param {Record<string, string>} query
   * @returns {Promise<{users?: number[], pairs?: number[][]} | null>}
   */
  async precomputed(query) {
    try {
      return await this._request("/api/trace/precomputed", { params: query });
    } catch {
      return null;
    }
  }
  /**
   * WP-203 (server: WP-202): the inventory of the saved walks - EVERY form that has walks on disk for a data set, task and method, in the order the store's index first lists them:
   * `{forms: [{params, resolved, users, pairs}]}`. `params` are the content page's route parameters for the form (a default is not named), `resolved` what they mean with the defaults applied
   * (fields, k, lam, model_kind). An older server has no such route (404), a failure: `null` - the page then falls back to the exact question and never raises a toast.
   * @param {Record<string, string>} query dataset, engine, task, m
   * @returns {Promise<{forms?: unknown[]} | null>}
   */
  async precomputedForms(query) {
    try {
      return await this._request("/api/trace/precomputed/forms", { params: query });
    } catch {
      return null;
    }
  }
  /**
   * WP-146: the models fitted at home (`i2rs model fit`) that are stored for a data set: `{dataset, models: [{kind, algorithm, cfghash, seed, fitted_at, n_epochs, seconds, size,
   * config, ...}]}`. Asked only of a server whose `/api/meta` `features.pretrained_models` is on.
   * @param {string} ds
   */
  models(ds) {
    return this._request("/api/models", { params: { ds } });
  }
  /**
   * @param {"ucf" | "icf"} engine
   * @param {string} traceId
   */
  cachedTrace(engine, traceId) {
    return this._request(`/api/trace/${engine}/${traceId}`);
  }
  runs() {
    return this._request("/api/runs");
  }
  /** @param {string} id */
  run(id) {
    return this._request(`/api/runs/${id}`);
  }
  // WP-48: metrics page - sweep protocol defaults, the traced sweep, the baseline battery
  metricsConfig() {
    return this._request("/api/config/metrics");
  }
  /**
   * @param {string} dataset
   * @param {Record<string, unknown>} body the complete SweepRequest (see metrics-page.js bodyFromParams)
   */
  metricsSweep(dataset, body) {
    return this._request("/api/metrics/sweep", { params: { dataset }, body });
  }
  /**
   * @param {string} dataset
   * @param {Record<string, unknown>} [params] `reference`
   */
  battery(dataset, params) {
    return this._request("/api/metrics/battery", { params: { dataset, ...(params || {}) } });
  }
  /**
   * @param {string} dataset
   * @param {{engines?: string[], seeds?: number, max_users?: number}} body
   */
  runBattery(dataset, body) {
    return this._request("/api/metrics/battery/run", { params: { dataset }, body });
  }
  /** @param {string} pin */
  examUnlock(pin) {
    return this._request("/api/exam/unlock", { body: { pin } });
  }
  /** @param {string} token */
  examRelock(token) {
    return this._request("/api/exam/relock", { method: "POST", body: {}, token });
  }
  /** @param {string} token */
  examViews(token) {
    return this._request("/api/exam/views", { token });
  }
  /**
   * WP-84a: the Q1 filter presets and the Q4 block of `config/exam.yaml`; `filter_sizes` (|F| per
   * preset) when a dataset is given.
   * @param {string} token @param {string} [dataset]
   */
  examConfig(token, dataset) {
    return this._request("/api/exam/config", { params: dataset ? { dataset } : {}, token });
  }
  /** @param {string} token @param {string} dataset @param {Record<string, unknown>} body */
  examRender(token, dataset, body) {
    return this._request("/api/exam/render", { params: { dataset }, body, token });
  }
  /**
   * @param {string} token @param {string} dataset @param {Record<string, unknown>} body
   * @returns {Promise<{blob: Blob, filename: string}>}
   */
  async examExport(token, dataset, body) {
    const res = await fetch(withParams("/api/exam/export", { dataset }), {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    if (!res.ok) return handle(res); // reuses the JSON error envelope decoding + ApiError throw
    const disposition = res.headers.get("Content-Disposition") || "";
    const match = /filename="([^"]+)"/.exec(disposition);
    return { blob: await res.blob(), filename: match ? match[1] : "exam-export.xlsx" };
  }
}

/**
 * Recursively sort object keys so two configs that differ only in key order (or in array vs.
 * missing-key spelling of the same JSON value) compare equal via `JSON.stringify`.
 * @param {unknown} value
 * @returns {unknown}
 */
function canon(value) {
  if (Array.isArray(value)) return value.map(canon);
  if (value && typeof value === "object") {
    /** @type {Record<string, unknown>} */
    const out = {};
    for (const key of Object.keys(value).sort()) out[key] = canon(/** @type {any} */ (value)[key]);
    return out;
  }
  return value;
}

/**
 * A method that isn't meaningful in a static export - see the module docstring above.
 *
 * Returns a REJECTED PROMISE, not a synchronous throw: `trace-page.js` calls `api.user(...)` and
 * `api.item(...)` as `.catch(() => null)` (a missing detail view must not block a precomputed
 * trace from rendering) - a synchronous throw happens while the `Promise.all([...])` array
 * literal is still being built, before `.catch` ever attaches, and takes the whole page down with
 * it (caught live in Chrome against an exported bundle, WP-50).
 */
function notPrecomputed(what) {
  return () =>
    Promise.reject(
      new ApiError("not_precomputed", "error.not_implemented", { wp: `static export: ${what}` }, 501)
    );
}

class StaticApi {
  mode = "static";
  /** WP-237a: the students' publication (`publication.json` beside the manifest) - null for a plain frozen export @type {import("./util/publication.js").Publication | null} */
  publication = null;

  /** @param {{mode: string, default_dataset?: string, datasets?: unknown[]}} manifest */
  constructor(manifest) {
    this.manifest = manifest;
  }

  /** @param {string} path */
  async _json(path) {
    const res = await fetch(path);
    if (!res.ok) {
      throw new ApiError("not_found", "error.run_not_found", { path }, res.status);
    }
    return res.json();
  }

  meta() {
    return this.manifest;
  }
  nav() {
    return this._json("config/nav.json");
  }
  /** @param {string} lang */
  i18n(lang) {
    return this._json(`config/i18n/${lang}.json`);
  }
  /** @param {string} id */
  flowchart(id) {
    return this._json(`config/flowcharts/${id}.json`);
  }
  // WP-66: decks are plain config files, so the Slides pages work unchanged in an export
  slides() {
    return this._json("config/slides.json");
  }
  /** @param {string} id */
  slide(id) {
    return this._json(`config/slides/${id}.json`);
  }
  formulas() {
    return this._json("config/formulas.json");
  }
  algorithms() {
    return this._json("config/algorithms.json");
  }
  similarities() {
    return this._json("config/similarities.json");
  }
  /** @param {string} ds */
  card(ds) {
    return this._json(`data/${ds}/card.json`);
  }
  /** @param {string} ds */
  stats(ds) {
    return this._json(`data/${ds}/stats.json`);
  }
  /**
   * WP-83: the cohort pages call this with sort / search parameters like the live API; a bundle has
   * no server, so the full list comes back and the page filters and sorts it itself (cohort-page.js).
   * @param {string} ds
   * @param {Record<string, unknown>} [_params] accepted and ignored
   */
  users(ds, _params) {
    return this._json(`data/${ds}/users.json`);
  }
  /**
   * @param {string} ds
   * @param {Record<string, unknown>} [_params] accepted and ignored (see `users`)
   */
  items(ds, _params) {
    return this._json(`data/${ds}/items.json`);
  }

  user = notPrecomputed("user detail");
  item = notPrecomputed("item detail");
  pick = notPrecomputed("pick");
  pairSimilarities = notPrecomputed("pair similarities");
  pairFilms = notPrecomputed("pair films"); // WP-91
  pairRaters = notPrecomputed("pair raters"); // WP-91 stage 2
  itemFlags = notPrecomputed("item flags"); // WP-91 stage 2
  submatrix = notPrecomputed("submatrix");
  splitPreview = notPrecomputed("split preview");
  pitfalls = notPrecomputed("pitfall gallery"); // WP-43: needs live explain/evaluation runs
  runPitfall = notPrecomputed("pitfall gallery");
  atlasConfig() {
    return this._json("config/atlas.json");
  }
  // WP-121: frozen by `i2rs export` as config/model_examples.json
  modelExamples() {
    return this._json("config/model_examples.json");
  }
  /**
   * WP-44: a frozen atlas is served when the page's complete parameter set matches an entry of
   * `manifest.atlases` (canonical JSON, same rule as the traces); anything else degrades to a
   * labelled error with a count of what is available.
   * @param {string} ds
   * @param {Record<string, unknown>} params
   */
  atlas(ds, params) {
    const entries = this.manifest.atlases || [];
    const wanted = JSON.stringify(canon(params));
    const hit = entries.find(
      /** @param {any} e */ (e) => e.dataset === ds && JSON.stringify(canon(e.params || {})) === wanted
    );
    if (!hit) {
      const available = entries.filter(/** @param {any} e */ (e) => e.dataset === ds).length;
      return Promise.reject(
        new ApiError("not_precomputed", "error.atlas_not_precomputed", { dataset: ds, available }, 501)
      );
    }
    return this._json(`atlas/${hit.atlas_id}.json`);
  }

  /**
   * @param {"ucf" | "icf"} engine
   * @param {string} dataset
   * @param {{user: number, item: number, config?: Record<string, unknown>}} body
   */
  trace(engine, dataset, body) {
    const entries = this.manifest.traces || [];
    const wanted = JSON.stringify(canon(body.config || {}));
    const hit = entries.find(
      /** @param {any} e */
      (e) =>
        e.dataset === dataset &&
        e.engine === engine &&
        e.user === body.user &&
        e.item === body.item &&
        JSON.stringify(canon(e.config || {})) === wanted
    );
    if (!hit) {
      const available = entries.filter(
        /** @param {any} e */ (e) => e.dataset === dataset && e.engine === engine
      ).length;
      return Promise.reject(
        new ApiError("not_precomputed", "error.trace_not_precomputed", { dataset, available }, 501)
      );
    }
    return this._json(`traces/${engine}/${hit.trace_id}.json`);
  }

  /**
   * WP-146: a bundle has no stored models (its manifest has no `features.pretrained_models`, so nothing asks); an empty list keeps the method set the same as the live client's.
   * @param {string} ds
   */
  models(ds) {
    return Promise.resolve({ dataset: ds, models: [] });
  }

  /**
   * WP-191: a bundle's traces are frozen files - no request runs, so no progress record exists (the page does not send a `progress_id` in this mode; the method keeps the method set the
   * same as the live client's).
   * @param {string} _id
   * @returns {Promise<null>}
   */
  progress(_id) {
    return Promise.resolve(null);
  }

  /**
   * WP-192: a bundle holds frozen traces, not a store of saved walks: nothing is saved for the tick box to offer (the method set stays the same as the live client's).
   * @param {Record<string, string>} _query
   * @returns {Promise<null>}
   */
  precomputed(_query) {
    return Promise.resolve(null);
  }

  /**
   * WP-203: nor an inventory of them (the method set stays the same as the live client's).
   * @param {Record<string, string>} _query
   * @returns {Promise<null>}
   */
  precomputedForms(_query) {
    return Promise.resolve(null);
  }

  /**
   * @param {"ucf" | "icf"} engine
   * @param {string} traceId
   */
  cachedTrace(engine, traceId) {
    return this._json(`traces/${engine}/${traceId}.json`);
  }

  runs = notPrecomputed("runs");
  run = notPrecomputed("runs");
  // WP-48: sweeps frozen from config/export/pairs.yaml `sweeps:` (matched by the complete body the
  // page sends, canonical JSON like the traces); the battery table frozen from runs/ at export time.
  metricsConfig() {
    return this._json("config/metrics.json");
  }
  /**
   * @param {string} dataset
   * @param {Record<string, unknown>} body
   */
  metricsSweep(dataset, body) {
    const entries = this.manifest.sweeps || [];
    const wanted = JSON.stringify(canon(body));
    const hit = entries.find(
      /** @param {any} e */ (e) => e.dataset === dataset && JSON.stringify(canon(e.body || {})) === wanted
    );
    if (!hit) {
      const available = entries.filter(/** @param {any} e */ (e) => e.dataset === dataset).length;
      return Promise.reject(
        new ApiError("not_precomputed", "error.sweep_not_precomputed", { dataset, available }, 501)
      );
    }
    return this._json(`sweeps/${hit.trace_id}.json`);
  }
  /** @param {string} dataset */
  battery(dataset) {
    return this._json(`metrics/${dataset}/battery.json`).catch(() =>
      Promise.reject(
        new ApiError("not_precomputed", "error.battery_not_precomputed", { dataset }, 501)
      )
    );
  }
  runBattery = notPrecomputed("battery run");
  examUnlock = notPrecomputed("exam");
  examRelock = notPrecomputed("exam");
  examViews = notPrecomputed("exam");
  examConfig = notPrecomputed("exam"); // WP-84a
  examRender = notPrecomputed("exam");
  examExport = notPrecomputed("exam");
}

/** WP-237a: `./publication.json` of the students' package; null when it cannot be read (the page then runs as a plain static export, with every page open) */
async function loadPublication() {
  try {
    const res = await fetch("publication.json", { cache: "no-store" });
    if (res.ok) return readPublication(await res.json());
  } catch {
    /* unreadable: fall through */
  }
  console.warn("[publication] publication.json could not be read: the edition's page list is unknown");
  return null;
}

/** Probe `./manifest.json`; live API otherwise. */
export async function detectApi() {
  try {
    const res = await fetch("manifest.json", { cache: "no-store" });
    if (res.ok) {
      const manifest = await res.json();
      if (manifest && manifest.mode === "static") {
        const api = new StaticApi(manifest);
        // WP-237a: a manifest that names a profile is the students' publication: `publication.json` (beside it) says which pages the edition holds and when it was rendered
        if (isPublicationManifest(manifest)) api.publication = await loadPublication();
        return api;
      }
    }
  } catch {
    /* no manifest.json (dev server, or fetch blocked) - fall through to the live API */
  }
  return new LiveApi();
}
