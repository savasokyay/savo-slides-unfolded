// @ts-check
// WP-09: the animation lock as a pure state machine (D-027, D-028). No DOM and no timers: the player feeds it events
// and executes the returned action, so every policy is testable with plain `node --test`.
//
//   queue   (presenter default) a press while a step animates is remembered, at most ONE; it runs when the step ends.
//   ignore  a press while a step animates is dropped.
//   fast    a press while a step animates finishes that step within the fast budget (200 ms) and stops; it never advances.
//   cutgo   (student build, D-028) a press while a step animates finishes it instantly and starts the next one.
//   force   Shift+Right: cut and go, under every policy.
// Backward moves and jumps are never locked and never queued: the frame is a pure function of (slide, step), so the
// target state is simply drawn instantly.

/** @typedef {'queue'|'ignore'|'fast'|'cutgo'} Policy */
/** @typedef {'next'|'back'|'jump'} NavKind */
/**
 * @typedef {object} LockState
 * @property {Policy} policy
 * @property {boolean} animating  a step animation is running
 * @property {boolean} pending    one press is remembered (queue policy only)
 * @property {boolean} fast       a fast finish is in progress (fast policy only)
 */
/**
 * What the player must do:
 *  NONE           nothing
 *  START          run the navigation now (nothing is animating)
 *  START_PENDING  run the remembered navigation now (an animation just ended)
 *  QUEUED         the press is remembered
 *  DROPPED        discarded: the queue already holds a press
 *  IGNORED        discarded by policy, or a press during a fast finish
 *  FAST_FINISH    speed the running animations up so they end within the fast budget, then stop
 *  CUT_AND_GO     finish the running animations instantly, then run the navigation now
 *  SNAP_NOW       finish/abandon the running animations, draw the target state instantly
 * @typedef {'NONE'|'START'|'START_PENDING'|'QUEUED'|'DROPPED'|'IGNORED'|'FAST_FINISH'|'CUT_AND_GO'|'SNAP_NOW'} LockAction
 */
/**
 * @typedef {{type: 'press', kind: NavKind, force?: boolean} | {type: 'started'} | {type: 'finished'} | {type: 'policy', policy: Policy}} LockEvent
 */

export const POLICIES = Object.freeze(['queue', 'ignore', 'fast', 'cutgo']);

/** @param {unknown} p @returns {p is Policy} */
export const isPolicy = (p) => typeof p === 'string' && POLICIES.includes(p);

/** @param {Policy} [policy] @returns {LockState} */
export function initialLockState(policy = 'queue') {
  if (!isPolicy(policy)) throw new RangeError(`unknown lock policy: ${String(policy)}`);
  return { policy, animating: false, pending: false, fast: false };
}

/**
 * Default policy of a role: students never get a lock (D-028); the presenter follows the deck's `lock_default`
 * (absent in the student JSON) and falls back to `queue` (D-027).
 * @param {'student'|'console'|'audience'} role
 * @param {unknown} lockDefault
 * @returns {Policy}
 */
export function defaultPolicy(role, lockDefault) {
  if (role === 'student') return 'cutgo';
  return isPolicy(lockDefault) ? lockDefault : 'queue';
}

/**
 * One transition of the machine.
 * @param {LockState} state
 * @param {LockEvent} event
 * @returns {{state: LockState, action: LockAction}}
 */
export function reduce(state, event) {
  switch (event.type) {
    case 'press': return onPress(state, event.kind, event.force === true);
    case 'started': return { state: { ...state, animating: true }, action: 'NONE' };
    case 'finished': {
      if (!state.animating) return { state: { ...state, fast: false }, action: 'NONE' };   // nothing was running (already cut or snapped)
      const done = { ...state, animating: false, fast: false };
      return state.pending ? { state: { ...done, pending: false }, action: 'START_PENDING' } : { state: done, action: 'NONE' };
    }
    case 'policy':
      if (!isPolicy(event.policy)) throw new RangeError(`unknown lock policy: ${String(event.policy)}`);
      return { state: { ...state, policy: event.policy, pending: false }, action: 'NONE' };   // switching policy forgets a remembered press
    default:
      throw new TypeError(`unknown lock event: ${JSON.stringify(event)}`);
  }
}

/** @param {LockState} s @param {NavKind} kind @param {boolean} force @returns {{state: LockState, action: LockAction}} */
function onPress(s, kind, force) {
  const idle = { ...s, animating: false, pending: false, fast: false };
  if (kind !== 'next') return { state: idle, action: 'SNAP_NOW' };               // back and jumps: never locked, never queued
  if (!s.animating) return { state: s, action: 'START' };
  if (force || s.policy === 'cutgo') return { state: idle, action: 'CUT_AND_GO' };
  switch (s.policy) {
    case 'queue': return s.pending ? { state: s, action: 'DROPPED' } : { state: { ...s, pending: true }, action: 'QUEUED' };   // at most one
    case 'ignore': return { state: s, action: 'IGNORED' };
    case 'fast': return s.fast ? { state: s, action: 'IGNORED' } : { state: { ...s, fast: true }, action: 'FAST_FINISH' };
    default: throw new RangeError(`unknown lock policy: ${String(s.policy)}`);
  }
}
