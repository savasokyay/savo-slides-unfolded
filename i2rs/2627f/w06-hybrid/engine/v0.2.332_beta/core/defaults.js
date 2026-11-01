// @ts-check
// WP-09: engine defaults in one place. The numbers that are decisions come from the decision log; the rest are the
// measured prototype values.
// WP-12c: the deck JSON's top-level `engine` block (DECK_SCHEMA section 7, written by the build from config/engine.yaml > engine) feeds these
// numbers: `resolveEngine` validates the block and `loadDeck` puts the result on `deck.engine`; every consumer reads it from there. This
// module stays the built-in fallback for a deck JSON without the block (an older build, a test fixture): lead decision 2026-10-22,
// "no block: today's values stay". tests/js/engine-defaults.test.mjs holds DEFAULTS and config/engine.yaml > engine to the same numbers.

export const DEFAULTS = Object.freeze({
  /** D-027: `fast` finishes the running step within this budget (ms), measured press -> finished. */
  fastMs: 200,
  /** The speed-up aims at fastMs * ratio, because `finished` lands one frame late and the rate change one frame later. */
  fastTargetRatio: 0.6,
  /** Deadline guard: if the speed-up has not landed by fastMs * ratio, the step is finished instantly. */
  fastGuardRatio: 0.9,
  /** Easing of the prototype choreography (prototypes/cover-closing, constant E). */
  easing: 'cubic-bezier(.25,.8,.25,1)',
  /** Placeholder renderer: step reveal and slide entry durations (ms). Real widgets compute duration(k) themselves. */
  placeholderStepMs: 500,
  placeholderEntryMs: 400,
  /** WP-10: console <-> audience heartbeat period (ms): the console pings, the audience answers with an ack (plan 3.3). */
  heartbeatMs: 1000,
  /** WP-10: silence longer than this is LOST (WP-11a 6.4 measured +3.17 s with this rule). */
  lostAfterMs: 3000,
  /** WP-10: an ack that has not caught up with the console state within this time turns SYNC into DRIFT (a message is in flight before that). */
  driftGraceMs: 800,
  /** WP-10: E8 acceptance: both windows equal within this time after F5, close and reopen, or a walk. */
  syncBudgetMs: 2000,
  /** WP-10: how often a console repeats its presence announcement (a second console of the same deck notices within this time). */
  announceMs: 1000,
  /** WP-10: a new console listens this long for an older console of the same deck before it claims the deck. */
  claimWindowMs: 300,
});

/** @typedef {typeof DEFAULTS} EngineValues */

/** WP-12c: the twelve keys of the JSON block (snake_case, config/engine.yaml) and their twins here (camelCase). The order is the config's. */
export const ENGINE_KEYS = Object.freeze(/** @type {Record<string, keyof EngineValues>} */ ({
  fast_ms: 'fastMs', fast_target_ratio: 'fastTargetRatio', fast_guard_ratio: 'fastGuardRatio', easing: 'easing',
  placeholder_step_ms: 'placeholderStepMs', placeholder_entry_ms: 'placeholderEntryMs',
  heartbeat_ms: 'heartbeatMs', lost_after_ms: 'lostAfterMs', drift_grace_ms: 'driftGraceMs',
  sync_budget_ms: 'syncBudgetMs', announce_ms: 'announceMs', claim_window_ms: 'claimWindowMs',
}));

/** The longest delay a browser timer takes (2^31 - 1 ms): a larger one fires at once, so a heartbeat of that size would spin. The build has no such bound; this gate adds it. */
const TIMER_MAX_MS = 2 ** 31 - 1;
/** The same five keywords the build accepts (savo_slides/config.py `_EASING_KEYWORDS`). */
const EASING_KEYWORDS = new Set(['linear', 'ease', 'ease-in', 'ease-out', 'ease-in-out']);
const NUMBER = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/;
const BEZIER = /^cubic-bezier\(\s*([^,\s]+)\s*,\s*([^,\s]+)\s*,\s*([^,\s]+)\s*,\s*([^,\s)]+)\s*\)$/;

/**
 * Why a value of the `engine` block is refused, or null when it is fine. The rules are the build's (savo_slides/config.py `EngineDefaults`):
 * a whole number of milliseconds above zero (a float, a string or `true` is not one), a ratio above 0 and at most 1, an easing that is a keyword
 * or `cubic-bezier(x1,y1,x2,y2)` whose x values lie in 0..1, so a value the Web Animations API would throw on never reaches a page.
 * @param {string} snake the key of the block @param {unknown} v @returns {string|null}
 */
export function engineValueProblem(snake, v) {
  if (v === undefined) return 'missing: the engine block carries all twelve keys';
  if (snake === 'easing') {
    if (typeof v !== 'string') return `expected a CSS easing string, found ${JSON.stringify(v)}`;
    if (EASING_KEYWORDS.has(v)) return null;
    const m = BEZIER.exec(v);
    if (!m || !m.slice(1).every((s) => NUMBER.test(s))) return `${JSON.stringify(v)} is neither one of ${[...EASING_KEYWORDS].sort().join(', ')} nor cubic-bezier(x1,y1,x2,y2)`;
    const [x1, , x2] = m.slice(1).map(Number);
    return x1 >= 0 && x1 <= 1 && x2 >= 0 && x2 <= 1 ? null : `${JSON.stringify(v)}: the x values of a cubic-bezier lie in 0..1`;
  }
  if (typeof v !== 'number' || !Number.isFinite(v)) return `expected a number, found ${JSON.stringify(v)}`;
  if (snake.endsWith('_ratio')) return v > 0 && v <= 1 ? null : `a ratio lies above 0 and at most 1, found ${v}`;
  if (!Number.isInteger(v) || v <= 0) return `expected a whole number of milliseconds above 0, found ${v}`;
  return v <= TIMER_MAX_MS ? null : `${v} ms is longer than a browser timer takes (${TIMER_MAX_MS})`;
}

/**
 * The engine numbers of a deck. Absent block (`undefined`): the built-in DEFAULTS, so a deck JSON of an older build still plays. A block that is
 * there must be an object with all twelve keys and every value valid: the first problems come back as `{path, detail}` and `values` is null
 * (the caller refuses the deck loudly, no fallback). Keys the engine does not know are ignored: a contract addition needs no code here.
 * @param {unknown} block `$.engine` of the deck JSON
 * @returns {{values: EngineValues|null, problems: Array<{path: string, detail: string}>}}
 */
export function resolveEngine(block) {
  if (block === undefined) return { values: DEFAULTS, problems: [] };
  if (block === null || typeof block !== 'object' || Array.isArray(block)) return { values: null, problems: [{ path: '', detail: `expected an object with the twelve engine keys, found ${JSON.stringify(block)}` }] };
  /** @type {Array<{path: string, detail: string}>} */ const problems = [];
  /** @type {Record<string, unknown>} */ const out = {};
  for (const [snake, camel] of Object.entries(ENGINE_KEYS)) {
    const v = /** @type {any} */ (block)[snake];
    const why = engineValueProblem(snake, v);
    if (why) problems.push({ path: `.${snake}`, detail: why }); else out[camel] = v;
  }
  return problems.length ? { values: null, problems } : { values: Object.freeze(/** @type {EngineValues} */ (out)), problems };
}
