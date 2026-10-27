// @ts-check
// WP-20: the widget kit. A story widget (plan 3.6) writes only WHAT MOVES; the kit writes the contract plumbing once, so no widget can get it wrong:
//
//   defineWidget({ id, steps, params, stepCount(params), examples, build(ctx, params) -> { steps: [{final(), plan()}, ...], ambient?, destroy? } })
//
//   - `stepCount(params)` is how many presses the widget takes with those params (a pure function; the params arrive with the schema's defaults filled in). A slide that carries
//     the widget must have exactly that many steps: the build cannot run JavaScript, so `rendererProblems` (core/renderers.js) compares the two at LOAD, with a clear error,
//     and the kit checks it again when the widget is created. `examples` are params the widget is shown with: at least one, each valid against the schema; the harness
//     generates its rows from them (a slide with `stepCount(example)` steps), so every widget gets the same acceptance rows for free.
//   - `steps` has exactly slide.stepCount + 1 entries: the states 0 ... n of the slide. Entry k is state k:
//       final()  sets the FINAL picture of state k, instantly. It is idempotent and does not depend on what the DOM looks like now (a deep link, Back and a
//                language switch all land here).
//       plan()   the Plan (core/animations.js: [element, keyframes, start, duration, fill?, easing?]) that animates the picture of state k-1 into that of state k;
//                for k = 0 it animates the widget's own entry from the base DOM, and may be [] when the layout's fade of the slot is the whole entry (then the base DOM
//                must already BE the picture of state 0: a generated harness row checks that). An empty plan means "nothing to animate": the player then calls final().
//                plan() is pure (it writes nothing to the DOM) and may be called more than once. A widget never calls element.animate() (D-039), and it animates only
//                ALLOWED_PROPS below; the kit checks every plan it hands out (`planProblems`) and fails loudly, naming the widget, the state and the entry.
//   - the kit derives mount(host), render(k), timeline(k) and duration(k) of the SlideRenderer contract (core/placeholder.js). duration(k) IS the planDuration of
//     timeline(k), so the length the build compares with the speaking budget can never drift from the motion that plays.
//   - params are checked against the schema before anything is built, and its defaults are filled in (widgets/params.js; the schema is the registry's).
// A widget draws into the slot it is given (the layout `widget-stage`) and uses `ctx.area` for the room it has; it carries no timer (wapi-only test).
import { planDuration } from '../core/animations.js';
import { WIDGET_SLOT } from '../layouts/geometry.js';
import { schemaProblems, validateParams, withDefaults } from './params.js';

/** @typedef {import('../core/animations.js').Plan} Plan */
/** @typedef {import('../core/placeholder.js').SlideRenderer} SlideRenderer */
/** @typedef {import('../core/placeholder.js').RenderContext} RenderContext */
/**
 * @typedef {object} WidgetStep
 * @property {() => void} final  the FINAL picture of this state, instantly; idempotent, independent of the DOM's current state
 * @property {() => Plan} plan    the motion from the previous state's picture to this one (state 0: the slide entry); [] when nothing moves
 * @typedef {object} WidgetBuild
 * @property {WidgetStep[]} steps  exactly slide.stepCount + 1 entries
 * @property {() => Array<[Element, Keyframe[], {id: string, duration: number, easing?: string}]>} [ambient]  endless loops that never lock anything
 * @property {() => void} [destroy]
 * @typedef {RenderContext & {slot: HTMLElement, size: {width: number, height: number}, params: any}} WidgetContext
 *   the render context of the slide (deck, slide, lang, doc, win, defaults, text, setText, reducedMotion, area) plus: `slot`, the element the widget draws into (the
 *   layout's, `widget-stage`); `size`, the room it has in stage pixels (never hard-code it: read it; a layout that gives none leaves the slot of `widget-stage`, geometry.js);
 *   `params`, the deck's params with the schema's defaults filled in
 * @typedef {object} WidgetDefinition
 * @property {string} id
 * @property {string} steps    one line of prose for the registry: what each press does
 * @property {any} params      the params' JSON Schema, inside the subset of widgets/params.js (the registry carries the same one)
 * @property {(params: any) => number} stepCount   how many presses the widget takes with these params (defaults filled in): a whole number, 0 or more
 * @property {(params: any) => Array<{path: string, detail: string}>} [check]   WP-50: what the widget needs of its params that the schema subset cannot say (a node that names an unknown parent, a press order), checked PURELY (no DOM)
 *   with the defaults filled in, and only when the schema accepted the params. It is part of `checkParams`, so the build's node script, the deck loader (rendererProblems) and the harness refuse the same params with the same sentence;
 *   `build` does not check again.
 * @property {any[]} examples  params the widget is shown with (at least one), each valid against the schema; the harness builds a slide from each
 * @property {(ctx: WidgetContext, params: any) => WidgetBuild} build
 * @typedef {object} WidgetEntry  what the table of widgets (widgets/index.js) holds
 * @property {string} id @property {'real'|'placeholder'} status @property {string} steps @property {any} params
 * @property {(params: unknown) => Array<{path: string, detail: string}>} checkParams
 * @property {((params: unknown) => number)|null} stepCount  the presses a slide with these params must have (the schema's defaults are filled in first); null for a placeholder
 * @property {ReadonlyArray<any>} examples  [] for a placeholder
 * @property {((slide: import('../core/deck.js').Slide, ctx: RenderContext) => SlideRenderer)|null} create  null for a placeholder: the layout then draws the placeholder
 */

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * The only properties a widget animates (lead and ui-agent, 2026-10-25): the theme-safe ones. A colour is never a keyframe: committing it would freeze a theme
 * colour into an inline style that survives a light/dark switch (`commit_theme_sensitive`, core/animations.js), so a colour change is a crossfade of two stacked
 * layers (opacity). A layout property (width, top, fontSize, ...) re-lays-out the page every frame (`layout_property_animated`).
 */
export const ALLOWED_PROPS = Object.freeze(['opacity', 'transform', 'strokeDashoffset', 'clipPath']);
/** The keys of a keyframe that are not properties (WAAPI): the engine's own list (core/animations.js RESERVED). */
const KEYFRAME_CONTROL = new Set(['offset', 'easing', 'composite', 'computedOffset']);
const FILLS = new Set(['none', 'forwards', 'backwards', 'both', 'auto']);

/**
 * Everything wrong with a widget's plan, as strings (none: it is a plan the engine can play and the widget may animate). The shape is the engine's (core/animations.js
 * validatePlan: [element, keyframes, start, duration, fill?, easing?]), stricter in two ways: a duration is above 0 (an entry of no length moves nothing), and the
 * keyframes name only ALLOWED_PROPS.
 * @param {unknown} plan @returns {string[]}
 */
export function planProblems(plan) {
  if (!Array.isArray(plan)) return ['a plan is an array of [element, keyframes, start, duration, fill?, easing?]'];
  /** @type {string[]} */ const out = [];
  plan.forEach((e, i) => {
    const at = `plan[${i}]`;
    if (!Array.isArray(e) || e.length < 4 || e.length > 6) { out.push(`${at}: expected [element, keyframes, start, duration, fill?, easing?]`); return; }
    const [el, kf, start, duration, fill, easing] = e;
    if (!el || typeof el !== 'object' || typeof /** @type {any} */ (el).animate !== 'function') out.push(`${at}[0]: not an element`);
    if (!(Number.isFinite(start) && start >= 0)) out.push(`${at}[2]: start must be a finite number >= 0, found ${start}`);
    if (!(Number.isFinite(duration) && duration > 0)) out.push(`${at}[3]: duration must be a finite number above 0, found ${duration}`);
    if (fill !== undefined && !FILLS.has(fill)) out.push(`${at}[4]: fill must be one of ${[...FILLS].join(', ')}, found ${fill}`);
    if (easing !== undefined && typeof easing !== 'string') out.push(`${at}[5]: easing must be a string`);
    const frames = Array.isArray(kf) ? kf : (kf && typeof kf === 'object' ? [kf] : null);
    if (!frames || frames.length === 0) { out.push(`${at}[1]: keyframes must be an array of keyframes or one property-indexed object`); return; }
    const props = new Set(frames.flatMap((f) => (f && typeof f === 'object' ? Object.keys(f).filter((k) => !KEYFRAME_CONTROL.has(k)) : [])));
    const bad = [...props].filter((p) => !ALLOWED_PROPS.includes(p));
    if (bad.length) out.push(`${at}[1]: animates ${bad.join(', ')}; only ${ALLOWED_PROPS.join(', ')} may be animated (a colour is a crossfade of two layers' opacity)`);
    if (props.size === 0) out.push(`${at}[1]: the keyframes animate no property`);
  });
  return out;
}

/**
 * Turn a widget's definition into a table entry. Throws at definition time, so a widget that breaks the contract is found when the module loads, not in the lecture.
 * @param {WidgetDefinition} def @returns {Readonly<WidgetEntry>}
 */
export function defineWidget(def) {
  /** @type {string[]} */ const bad = [];
  if (typeof def?.id !== 'string' || !SLUG.test(def.id)) bad.push('id: a lowercase slug');
  if (typeof def?.steps !== 'string' || def.steps.trim() === '') bad.push('steps: one line of prose for the registry');
  if (typeof def?.build !== 'function') bad.push('build: a function (ctx, params) => {steps, ...}');
  if (typeof def?.stepCount !== 'function') bad.push('stepCount: a function (params) => the number of presses');
  if (def?.check !== undefined && typeof def.check !== 'function') bad.push('check: a function (params) => [{path, detail}] when given');
  const sp = schemaProblems(def?.params);
  bad.push(...sp);
  if (sp.length === 0 && def.params.type !== 'object') bad.push('params.type: the params of a widget are an object');
  if (!Array.isArray(def?.examples) || def.examples.length === 0) bad.push('examples: at least one params object the widget is shown with');
  else if (sp.length === 0 && def.params.type === 'object') {
    def.examples.forEach((ex, i) => {
      let exampleProblems = validateParams(def.params, ex);
      if (exampleProblems.length === 0 && typeof def.check === 'function') exampleProblems = def.check(withDefaults(def.params, ex));       // (WP-50) an example is held to the widget's own check too
      if (exampleProblems.length) { bad.push(`examples[${i}]: ${exampleProblems.map((p) => `${p.path} ${p.detail}`).join(', ')}`); return; }
      if (typeof def.stepCount !== 'function') return;
      let n;
      try { n = def.stepCount(withDefaults(def.params, ex)); } catch (e) { bad.push(`examples[${i}]: stepCount threw ${/** @type {Error} */ (e).message}`); return; }
      if (!Number.isInteger(n) || n < 0) bad.push(`examples[${i}]: stepCount returned ${JSON.stringify(n)}, expected a whole number, 0 or more`);
    });
  }
  if (bad.length) throw new Error(`defineWidget(${typeof def?.id === 'string' ? def.id : '?'}): ${bad.join('; ')}`);

  /** @param {unknown} params */
  // the schema first; the widget's own check (WP-50) only for params the schema accepted, with the defaults filled in
  const checkParams = (params) => {
    const problems = validateParams(def.params, params ?? {});
    if (problems.length || typeof def.check !== 'function') return problems;
    return def.check(withDefaults(def.params, params ?? {}));
  };
  /** The presses a slide with these (given) params must have; the schema's defaults are filled in first. @param {unknown} params @returns {number} */
  const stepCount = (params) => def.stepCount(withDefaults(def.params, params ?? {}));
  return Object.freeze({
    id: def.id, status: /** @type {const} */ ('real'), steps: def.steps, params: def.params, checkParams, stepCount, examples: Object.freeze(structuredClone(def.examples)),
    /** @param {import('../core/deck.js').Slide} slide @param {RenderContext} ctx @returns {SlideRenderer} */
    create(slide, ctx) {
      const given = slide.widget?.params ?? {};
      const problems = checkParams(given);
      if (problems.length) throw new Error(`widget ${def.id} on slide ${slide.id}: ${problems.map((p) => `${p.path} ${p.detail}`).join('; ')}`);
      const params = withDefaults(def.params, given);
      const takes = def.stepCount(params);
      if (takes !== slide.stepCount) throw new Error(`widget ${def.id} on slide ${slide.id}: the widget takes ${takes} steps with these params, the slide has ${slide.stepCount}`);
      /** @type {WidgetBuild|null} */ let built = null;
      const need = () => { if (!built) throw new Error(`widget ${def.id}: used before mount()`); return built; };
      /** @param {number} k @returns {WidgetStep} */
      const step = (k) => {
        const s = need().steps[k];
        if (!s) throw new RangeError(`widget ${def.id} on slide ${slide.id} has no state ${k} (it has ${need().steps.length}: the states 0 ... ${need().steps.length - 1})`);
        return s;
      };
      /** The plan of state k, checked: a widget that returns a plan the engine would warn about or reject fails here, in its first test, and says which entry. @param {number} k @returns {Plan} */
      const plan = (k) => {
        const p = step(k).plan();
        const bad = planProblems(p);
        if (bad.length) throw new Error(`widget ${def.id} on slide ${slide.id}, state ${k}: ${bad.join('; ')}`);
        return p;
      };
      return {
        mount(host) {
          const size = /** @type {any} */ (ctx).size ?? { width: WIDGET_SLOT.width, height: WIDGET_SLOT.height };   // the layout's own room; without one, the slot of `widget-stage`
          built = def.build(/** @type {WidgetContext} */ ({ ...ctx, slot: host, size, params }), params);
          const want = slide.stepCount + 1;
          if (!built || !Array.isArray(built.steps) || built.steps.length !== want) {
            throw new Error(`widget ${def.id} on slide ${slide.id}: build() returned ${Array.isArray(built?.steps) ? built.steps.length : 'no'} states, the slide has ${want} (steps 0 ... ${slide.stepCount})`);
          }
        },
        render(k) { step(k).final(); },
        timeline(k) { return plan(k); },
        duration(k) { return planDuration(plan(k)); },
        ambient() { return need().ambient?.() ?? []; },
        destroy() { built?.destroy?.(); built = null; },
      };
    },
  });
}

/**
 * A widget the registry lists but that has no module yet (the id exists so a deck can name it and the build's id check passes). The layout draws the placeholder
 * for the slide; this is what `scatter-fit` is until its module arrives. It is explicit and listed by `status`, never a silent fallback for an unknown id.
 * @param {{id: string, steps: string, params: any}} def @returns {Readonly<WidgetEntry>}
 */
export function placeholderWidget(def) {
  const sp = schemaProblems(def.params);
  if (sp.length) throw new Error(`placeholderWidget(${def.id}): ${sp.join('; ')}`);
  return Object.freeze({ id: def.id, status: /** @type {const} */ ('placeholder'), steps: def.steps, params: def.params, checkParams: (/** @type {unknown} */ p) => validateParams(def.params, p ?? {}), stepCount: null, examples: Object.freeze([]), create: null });
}
