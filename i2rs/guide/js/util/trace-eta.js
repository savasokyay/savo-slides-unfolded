// @ts-check
// WP-210: how long the WHOLE request has still to run - the loading strip's estimate for a trace that reports progress (WP-191). The server's own estimate (`eta_ms`) is the remaining time of the
// stage that is running, so a stage with no counter and the first stage said nothing, and the strip only counted up. This module keeps what the browser has seen: the wall time of the last
// live requests of the same KIND, and the strip says "~N s left (estimate)" from their median.
//
// The kind of a request is the page, the data set, the task and every setting the engine is built from (fields, weights, tf, k, lambda, the model's kind ...) - NOT the user and not the
// film: a new user gets an estimate too (another user takes another time - the strip's hover text says so). The history lives in the browser's `localStorage`, one JSON object
// `{ key: [ms, ...] }`, the last five runs per kind, the last forty kinds; every read and write is guarded (a private window or blocked site data leaves the strip as WP-191 made it).
// Only a request that really ran the engine is written (the component decides: the server reported a stage); a saved walk or a repeated request comes back at once and says nothing about the work.
// Display rule (`wholeEstimate`): with a history, the estimate is the median minus the time already gone, and it is dropped (the strip shows the clock only) once the median is overtaken - an
// estimate that has run out is not repeated beside a clock that has passed it; with no history, the stage's own estimate as before.
// Pure but for `readRuns` / `writeRun`, which take the storage as an argument; hand-derived in tests/app/js/trace_eta_check.mjs under node.

/** the one `localStorage` entry that holds the durations of every kind */
export const ETA_STORAGE_KEY = "i2rs.traceDurations";
/** the runs kept per kind (the median of these is the estimate) */
export const ETA_MAX_RUNS = 5;
/** the kinds kept (the least recently written one goes first) */
export const ETA_MAX_KEYS = 40;
/** below this much time left the estimate says nothing ("~0.0 s left" is no information) */
export const ETA_MIN_LEFT_MS = 100;

/**
 * @param {unknown} value
 * @returns {Record<string, unknown>}
 */
function asObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? /** @type {Record<string, unknown>} */ (value) : {};
}

/**
 * The same text for the same settings whatever the order the keys were written in.
 * @param {unknown} value
 * @returns {string}
 */
function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const o = /** @type {Record<string, unknown>} */ (value);
    return `{${Object.keys(o)
      .sort()
      .filter((k) => o[k] !== undefined)
      .map((k) => `${JSON.stringify(k)}:${stable(o[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

/**
 * The kind of a request. `settings` is everything that decides how long the engine works and nothing about WHO or WHICH film is asked for (the request body without `user` / `item`).
 * @param {{ page: string, dataset: string, task: string, settings?: Record<string, unknown> }} parts
 * @returns {string}
 */
export function etaKey({ page, dataset, task, settings = {} }) {
  return `${page}|${dataset}|${task}|${stable(settings)}`;
}

/**
 * The median of a list of durations (the mean of the two middle ones for an even count). NaN for an empty list.
 * @param {number[]} values
 * @returns {number}
 */
export function median(values) {
  if (values.length === 0) return Number.NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * @param {Pick<Storage, "getItem"> | null | undefined} storage
 * @returns {Record<string, unknown>} the whole stored object ({} for nothing, for text that is no JSON object, or when the storage throws)
 */
function load(storage) {
  try {
    const raw = storage?.getItem(ETA_STORAGE_KEY);
    return raw ? asObject(JSON.parse(raw)) : {};
  } catch {
    return {};
  }
}

/**
 * The stored runs of a kind: positive finite numbers only, the last ETA_MAX_RUNS of them.
 * @param {Pick<Storage, "getItem"> | null | undefined} storage
 * @param {string} key
 * @returns {number[]}
 */
export function readRuns(storage, key) {
  const runs = load(storage)[key];
  if (!Array.isArray(runs)) return [];
  return runs.filter((v) => typeof v === "number" && Number.isFinite(v) && v > 0).slice(-ETA_MAX_RUNS);
}

/**
 * Add one run of a kind (its wall time in ms): the kind's list keeps its last ETA_MAX_RUNS runs, the kind becomes the most recently written one, and the object keeps its last
 * ETA_MAX_KEYS kinds. A duration that is not a positive finite number is not written.
 * @param {Pick<Storage, "getItem" | "setItem"> | null | undefined} storage
 * @param {string} key
 * @param {number} ms
 * @returns {boolean} whether it was written
 */
export function writeRun(storage, key, ms) {
  if (!storage || !Number.isFinite(ms) || ms <= 0) return false;
  try {
    const all = load(storage);
    const runs = readRuns(storage, key);
    runs.push(Math.round(ms));
    delete all[key]; // re-added below: the most recently written kind goes last
    const next = { ...all, [key]: runs.slice(-ETA_MAX_RUNS) };
    const keys = Object.keys(next);
    for (const old of keys.slice(0, Math.max(0, keys.length - ETA_MAX_KEYS))) delete next[old];
    storage.setItem(ETA_STORAGE_KEY, JSON.stringify(next));
    return true;
  } catch {
    return false;
  }
}

/**
 * What the strip says it has still to wait.
 * @param {{ runs: number[], elapsedMs: number, stageEtaMs: number | null }} s `runs`: the earlier runs of this kind; `elapsedMs`: the request's clock; `stageEtaMs`: the server's
 *   estimate for the stage that is running (null: none, or the request is finished)
 * @returns {{ ms: number | null, source: "history" | "stage" | null }}
 */
export function wholeEstimate({ runs, elapsedMs, stageEtaMs }) {
  if (runs.length > 0) {
    const left = median(runs) - Math.max(0, elapsedMs);
    return left >= ETA_MIN_LEFT_MS ? { ms: left, source: "history" } : { ms: null, source: null };
  }
  return stageEtaMs !== null && stageEtaMs >= ETA_MIN_LEFT_MS ? { ms: stageEtaMs, source: "stage" } : { ms: null, source: null };
}
