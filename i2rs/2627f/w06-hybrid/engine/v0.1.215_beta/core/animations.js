// @ts-check
// WP-09: the WAAPI layer (D-039). All motion of a step goes through here.
//
// A plan is a list of [element, keyframes, start ms, duration ms, fill?, easing?] (the prototype's choreography array).
// Every animation of a step carries the id prefix `savo-step:`, so `document.getAnimations()` is the single source for what
// the engine runs, FILTERED to the engine's own animations (ownAnimations below): the lock, finish, cut-and-go and the
// reduced-motion check look at nothing else. No timers, no flags that could drift from what the browser runs.
// Ambient loops carry `savo-ambient:` and never lock anything.
//
// Foreign animations (the Claude extension's infinite "claude-pulse" in an agent tab, a page-level spinner, any CSS animation
// outside the deck) are in `document.getAnimations()` too. They are never part of the lock and are never finished, sped up,
// committed or cancelled by the engine; every function below that touches animations starts from the engine's own list.
//
// A step that has ended is committed with commitStyles() and cancelled. Nothing is left behind with `fill: forwards`: the
// bug of the closing prototype was a backwards fill that outranked later animations, and a pile of finished fills would
// do the same across steps. The default fill is therefore `forwards` (the end state is held until the commit), never
// `both`: a plan entry that really needs its first keyframe during its delay asks for it explicitly.
import { DEFAULTS } from './defaults.js';

export const STEP_PREFIX = 'savo-step:';
export const AMBIENT_PREFIX = 'savo-ambient:';

const FILLS = new Set(['none', 'forwards', 'backwards', 'both', 'auto']);
const RESERVED = new Set(['offset', 'easing', 'composite', 'computedOffset']);
/** Layout-tier properties (animation-performance skill): animating them re-lays-out the page every frame. */
const LAYOUT_PROPS = new Set(['width', 'height', 'top', 'left', 'right', 'bottom', 'margin', 'marginTop', 'marginRight', 'marginBottom', 'marginLeft',
  'padding', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'borderWidth', 'fontSize', 'lineHeight']);
/** Properties whose committed literal would freeze a theme colour in an inline style and survive a light/dark switch. */
const THEME_PROPS = new Set(['color', 'backgroundColor', 'borderColor', 'outlineColor', 'fill', 'stroke', 'boxShadow', 'textShadow', 'caretColor', 'textDecorationColor']);

/**
 * @typedef {[Element, Keyframe[]|PropertyIndexedKeyframes, number, number, FillMode?, string?]} PlanEntry
 * @typedef {PlanEntry[]} Plan
 * @typedef {(w: {code: string, message: string, animation?: string}) => void} WarnFn
 */
/** @type {WarnFn} */
const defaultWarn = (w) => console.warn(`[savo-slides] ${w.code}: ${w.message}`);

/** Static length of a plan: the latest end among its entries (start + duration). The build compares it with the speaking budget. @param {Plan} plan */
export function planDuration(plan) {
  return plan.reduce((m, e) => Math.max(m, e[2] + e[3]), 0);
}

/**
 * Playback rate that makes `remainingMs` of animation time end within `targetMs` of wall time; never slows down.
 * @param {number} remainingMs @param {number} targetMs
 */
export function fastRate(remainingMs, targetMs) {
  if (!(targetMs > 0)) throw new RangeError(`targetMs must be positive: ${targetMs}`);
  return Math.max(1, remainingMs / targetMs);
}

/** @param {Plan} plan */
function validatePlan(plan) {
  if (!Array.isArray(plan)) throw new TypeError('a plan is an array of [element, keyframes, start, duration, fill?, easing?]');
  plan.forEach((e, i) => {
    if (!Array.isArray(e) || e.length < 4) throw new TypeError(`plan[${i}] must be [element, keyframes, start, duration, fill?, easing?]`);
    if (!e[0] || typeof e[0].animate !== 'function') throw new TypeError(`plan[${i}][0] is not an element`);
    if (!(Number.isFinite(e[2]) && e[2] >= 0)) throw new RangeError(`plan[${i}] start must be a finite number >= 0, got ${e[2]}`);
    if (!(Number.isFinite(e[3]) && e[3] >= 0)) throw new RangeError(`plan[${i}] duration must be a finite number >= 0, got ${e[3]}`);
    if (e[4] !== undefined && !FILLS.has(e[4])) throw new RangeError(`plan[${i}] fill must be one of ${[...FILLS].join(', ')}, got ${e[4]}`);
  });
}

/** Property names a keyframe set animates. @param {Keyframe[]|PropertyIndexedKeyframes} kf @returns {string[]} */
function keyframeProps(kf) {
  const frames = Array.isArray(kf) ? kf : [kf];
  const out = new Set();
  for (const f of frames) for (const k of Object.keys(f)) if (!RESERVED.has(k)) out.add(k);
  return [...out];
}

/**
 * Start every entry of a plan. Returns the animations (ids `savo-step:<id>#<i>`).
 * @param {Plan} plan
 * @param {{id: string, easing?: string, onWarn?: WarnFn}} o
 * @returns {Animation[]}
 */
export function playPlan(plan, { id, easing = DEFAULTS.easing, onWarn = defaultWarn }) {
  validatePlan(plan);
  return plan.map(([el, keyframes, start, duration, fill = 'forwards', ease = easing], i) => {
    const slow = keyframeProps(keyframes).filter((p) => LAYOUT_PROPS.has(p));
    if (slow.length) onWarn({ code: 'layout_property_animated', message: `${id}#${i} animates ${slow.join(', ')}: layout-tier properties re-lay-out the page every frame; use transform/opacity unless there is a reason`, animation: `${id}#${i}` });
    return el.animate(keyframes, { duration, delay: start, fill, easing: ease, id: `${STEP_PREFIX}${id}#${i}` });
  });
}

/** The step animations the browser knows about: what the lock waits for. @param {Document} doc */
export const stepAnimations = (doc) => doc.getAnimations().filter((a) => a.id.startsWith(STEP_PREFIX));
/** @param {Document} doc */
export const ambientAnimations = (doc) => doc.getAnimations().filter((a) => a.id.startsWith(AMBIENT_PREFIX));
/** True while a step animation is running or about to run. @param {Document} doc */
export const isAnimating = (doc) => stepAnimations(doc).some((a) => a.playState === 'running' || a.playState === 'pending');

/**
 * WP-09 (smoke-test finding S3, an extension's infinite animation in the tab): the engine's own animations: the ones it named
 * (`savo-step:`, `savo-ambient:`) plus anything that animates inside the deck root
 * (a CSS animation of a layout counts: reduced motion has to silence it too). Everything else is foreign and not returned.
 * This is the list the acceptance checks count ("no animation under reduced motion", "nothing left after a step"), so an
 * extension's infinite animation can neither fail them nor hide behind them.
 * @param {Document} doc @param {Element} [root] the deck root (the player's host); without it only the named animations are own
 * @returns {Animation[]}
 */
export function ownAnimations(doc, root) {
  /** @type {Set<Animation>} */
  const own = new Set(doc.getAnimations().filter((a) => a.id.startsWith(STEP_PREFIX) || a.id.startsWith(AMBIENT_PREFIX)));
  if (root && typeof root.getAnimations === 'function') for (const a of root.getAnimations({ subtree: true })) own.add(a);
  return [...own];
}

/**
 * Resolves when every animation has finished OR been cancelled. Never rejects: WAAPI rejects `finished` on cancel (and on
 * finish() followed by cancel() in the same task), and that is a normal way for a step to end.
 * @param {Animation[]} animations @returns {Promise<void>}
 */
export function settle(animations) {
  return Promise.allSettled(animations.map((a) => a.finished)).then(() => undefined);
}

/** Jump every animation to its end. The styles are committed afterwards by commitAndCancel. @param {Animation[]} animations @param {WarnFn} [onWarn] */
export function finishAnimations(animations, onWarn = defaultWarn) {
  for (const a of animations) {
    try { a.finish(); } catch (e) { onWarn({ code: 'finish_failed', message: `${a.id}: ${/** @type {Error} */ (e).message}`, animation: a.id }); }
  }
}

/**
 * Write the end state of every animation into inline styles, then cancel them. Two phases on purpose: committing reads the
 * computed value with ALL animations still in effect, so cancelling one before committing the next would lose what it
 * contributed to a shared property.
 * @param {Animation[]} animations @param {WarnFn} [onWarn]
 */
export function commitAndCancel(animations, onWarn = defaultWarn) {
  for (const a of animations) {
    if (a.playState === 'idle') continue;                              // already cancelled
    const effect = /** @type {KeyframeEffect|null} */ (a.effect);
    const theme = effect ? keyframeProps(effect.getKeyframes()).filter((p) => THEME_PROPS.has(p)) : [];
    if (theme.length) onWarn({ code: 'commit_theme_sensitive', message: `${a.id} commits ${theme.join(', ')}: a literal colour in an inline style survives a theme switch; drive colours through classes or variables`, animation: a.id });
    try { a.commitStyles(); } catch (e) { onWarn({ code: 'commit_failed', message: `${a.id}: ${/** @type {Error} */ (e).message}`, animation: a.id }); }
  }
  for (const a of animations) a.cancel();
}

/** Cancel without committing: the DOM is about to be rebuilt anyway. @param {Animation[]} animations */
export function cancelAnimations(animations) {
  for (const a of animations) a.cancel();
}

/**
 * `fast` policy: speed every running animation up so they all end within `targetMs` of wall time (they keep their
 * relative timing and share one rate; the rate never goes below 1).
 * @param {Animation[]} animations @param {number} targetMs
 * @returns {{remaining: number, rate: number}}
 */
export function speedUp(animations, targetMs) {
  let remaining = 0;
  for (const a of animations) {
    if (a.playState === 'finished' || a.playState === 'idle') continue;
    const end = /** @type {number} */ (a.effect?.getComputedTiming().endTime ?? 0);
    const cur = Number(a.currentTime ?? 0);
    remaining = Math.max(remaining, (end - cur));                      // media time left, whatever the current rate
  }
  const rate = fastRate(remaining, targetMs);
  for (const a of animations) if (a.playState !== 'finished' && a.playState !== 'idle') a.updatePlaybackRate(rate);
  return { remaining, rate };
}

/**
 * Start an endless ambient loop (never part of the lock). Returns null under reduced motion: there is then no animation
 * of any kind in the document.
 * @param {Element} el @param {Keyframe[]|PropertyIndexedKeyframes} keyframes
 * @param {{id: string, duration: number, easing?: string}} o @param {boolean} reduced @returns {Animation|null}
 */
export function startAmbient(el, keyframes, { id, duration, easing = 'ease-in-out' }, reduced) {
  if (reduced) return null;
  return el.animate(keyframes, { duration, iterations: Infinity, easing, id: `${AMBIENT_PREFIX}${id}` });
}

/** @param {Document} doc */
export function cancelAmbient(doc) {
  for (const a of ambientAnimations(doc)) a.cancel();
}
