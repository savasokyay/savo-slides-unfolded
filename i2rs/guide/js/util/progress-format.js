// @ts-check
// WP-191: the progress of a trace request on screen - what the loading strip says while the server builds a content-based trace (design note docs/plans/2610171502-trace-progress-design.md).
// The page sends a `progress_id` with the request and asks `GET /api/progress/{id}` every PROGRESS_POLL_MS; the answer is
//   {stage, stage_index, n_stages, done, total, elapsed_ms, stage_elapsed_ms, eta_ms, finished}
// and this module is the plain logic of how it is shown: which engines report, the id, the validated snapshot, and the four short texts of the strip (stage "2/5", counter
// "40/100 (40 %)", the stage's label, the estimate "3.0"). A part the snapshot does not carry is an EMPTY text, never a placeholder word - the strip reserves the room for it
// (components/trace-loading.js, css/trace.css `.has-progress`), so nothing moves between two polls. Pure functions, hand-derived in tests/app/js/progress_format_check.mjs under node.

import { fmtElapsed } from "./trace-loading.js";

/** how often the strip asks for the record (ms) - the design note's contract */
export const PROGRESS_POLL_MS = 250;

/**
 * the stage names the content-based engine reports (engines/cb/stages.py), each with an i18n label `progress.<stage>`; `starting` is the record before the first stage. WP-222: and the weighted
 * hybrid's (engines/hybrid/stages.py: the split, one fit per base, the held-out predictions, the weights; its last stage, `assemble`, is the content engine's word too)
 */
export const PROGRESS_STAGES = ["starting", "profiles", "user", "score", "rank", "assemble", "split", "fit_ucf", "fit_icf", "fit_mf", "fit_cb", "predict", "weights"];

/** the engines whose server side reports progress (WP-191: content-based first; WP-191a: the others, by adding their alias here; WP-222: the weighted hybrid) */
const REPORTING_ENGINES = new Set(["cb", "hybrid"]);

/**
 * Whether a trace request of this engine carries a `progress_id` (an engine the server does not report for would be polled for nothing: every answer a 404).
 * @param {string} engine the page's engine alias
 * @returns {boolean}
 */
export function reportsProgress(engine) {
  return REPORTING_ENGINES.has(engine);
}

/**
 * A fresh id for one request: `[A-Za-z0-9-]{8,64}`, the server's rule. `crypto.randomUUID()` exists only in a secure context (https, localhost) - a classroom laptop served over plain
 * http on the LAN has `getRandomValues` but no `randomUUID` - so the id falls back to a version-4 UUID built from random bytes, and last to `Math.random`.
 * @param {{randomUUID?: () => string, getRandomValues?: (a: Uint8Array) => Uint8Array} | undefined} [source] the crypto object (the browser's by default; a stub in the node check)
 * @returns {string}
 */
export function newProgressId(source = globalThis.crypto) {
  if (source && typeof source.randomUUID === "function") return source.randomUUID();
  const bytes = new Uint8Array(16);
  if (source && typeof source.getRandomValues === "function") source.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10xx
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * @typedef {Object} ProgressSnapshot
 * @property {string} stage the stage's name (an i18n suffix)
 * @property {number | null} stageIndex 1-based
 * @property {number | null} nStages
 * @property {number | null} done the loop count of the stage (null: the stage has no counter)
 * @property {number | null} total
 * @property {number | null} etaMs the remaining time of the CURRENT stage (null: no estimate)
 * @property {boolean} finished
 */

/**
 * The answer of `GET /api/progress/{id}` as the strip uses it. Anything that is not an object with a stage name is no snapshot (null: the strip keeps its last text); a number
 * that is not what its field promises (a count that is not a whole number, a negative time) becomes null, so its cell stays empty instead of showing nonsense.
 * @param {unknown} raw
 * @returns {ProgressSnapshot | null}
 */
export function parseProgress(raw) {
  if (!raw || typeof raw !== "object") return null;
  const r = /** @type {Record<string, unknown>} */ (raw);
  if (typeof r.stage !== "string" || !r.stage) return null;
  /** @param {unknown} v @param {number} min */
  const whole = (v, min) => (typeof v === "number" && Number.isInteger(v) && v >= min ? v : null);
  const eta = typeof r.eta_ms === "number" && Number.isFinite(r.eta_ms) && r.eta_ms >= 0 ? r.eta_ms : null;
  const total = whole(r.total, 1);
  const done = total === null ? null : whole(r.done, 0);
  return { stage: r.stage, stageIndex: whole(r.stage_index, 1), nStages: whole(r.n_stages, 1), done, total, etaMs: eta, finished: r.finished === true };
}

/**
 * "2/5": the stage's place among the stages the request will go through. Empty when either number is missing or the index is past the count.
 * @param {ProgressSnapshot | null} snap
 * @returns {string}
 */
export function stageText(snap) {
  if (!snap || snap.stageIndex === null || snap.nStages === null || snap.stageIndex > snap.nStages) return "";
  return `${snap.stageIndex}/${snap.nStages}`;
}

/**
 * "40/100 (40 %)" (Turkish: "40/100 (% 40)"): the loop count of the stage and its percentage. The percentage is rounded DOWN, so 100 only shows with the last item done (1 of 3 is 33,
 * 2 of 3 is 66); a count past the total is shown as the total. Empty for a stage with no counter.
 * @param {ProgressSnapshot | null} snap
 * @param {string} [lang]
 * @returns {string}
 */
export function counterText(snap, lang = "en") {
  if (!snap || snap.total === null || snap.done === null) return "";
  const done = Math.min(snap.done, snap.total);
  const pct = Math.floor((100 * done) / snap.total);
  return lang === "tr" ? `${done}/${snap.total} (% ${pct})` : `${done}/${snap.total} (${pct} %)`;
}

/**
 * The remaining time of the current stage in seconds, one decimal, the language's separator ("3.0" / "3,0") - the unit is the page's own word (`trace.loading_seconds`). Empty with
 * no estimate (the stage has no counter yet, or has none), once the request is finished, and when less than a tenth of a second is left (the loop's last item: "~0.0 s" says nothing).
 * @param {ProgressSnapshot | null} snap
 * @param {string} [lang]
 * @returns {string}
 */
export function etaText(snap, lang = "en") {
  if (!snap || snap.finished || snap.etaMs === null || snap.etaMs < 100) return "";
  return fmtElapsed(snap.etaMs, lang);
}

/**
 * The stage's words: its language label (`progress.<stage>`), or the stage's own name when the language file has none (the lookup returns the key itself).
 * @param {string} stage
 * @param {(key: string) => string} t the viewer's language
 * @returns {string}
 */
export function stageLabel(stage, t) {
  const key = `progress.${stage}`;
  const text = t(key);
  return typeof text === "string" && text !== key && text ? text : stage;
}

/**
 * The room the label cell reserves, in `ch`: the longest of the given texts (every stage's label and the page's own waiting sentence), counted in characters. A `ch` is the width of
 * a zero, wider than the average letter, so a text of N characters fits in N `ch`.
 * @param {string[]} texts
 * @returns {number}
 */
export function labelChars(texts) {
  return texts.reduce((most, text) => Math.max(most, [...String(text)].length), 0);
}
