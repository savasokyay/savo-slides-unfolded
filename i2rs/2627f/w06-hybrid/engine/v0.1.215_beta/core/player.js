// @ts-check
// WP-09: the player. A frame is a PURE FUNCTION of (slide, step) (plan section 3.2):
//   snap(k)   rebuilds the slide's base DOM and sets the final picture of state k instantly. Deep links, back, jumps and
//             reduced motion always take this path, so a link opened cold shows exactly what k presses show.
//   k-1 -> k  (and only that) animates: the renderer's timeline(k) is played as WAAPI animations that end in
//             commitStyles() + cancel(); nothing stays behind with fill: forwards (D-039).
// The lock (D-027, D-028) is the pure state machine of lock.js; this class executes its actions. A step is "running" while
// the animations the engine started for it are: they carry the id prefix savo-step: (animations.js), so they are the
// engine's own slice of `document.getAnimations()` and nothing foreign (an extension's infinite pulse) can lock the deck.
//
// The ONLY timer in the engine is the fast-finish deadline guard below (marked `motion-guard`); it drives no motion, it only
// bounds how long a fast finish may take. tests/js/wapi-only.test.mjs enforces that rule mechanically.
import { reduce, initialLockState } from './lock.js';
import { playPlan, settle, finishAnimations, commitAndCancel, cancelAnimations, speedUp, startAmbient, cancelAmbient, ownAnimations } from './animations.js';
import { slideAt, nextState, prevState, clampState, firstState, lastState, resolveLang, text } from './deck.js';
import { createPlaceholderRenderer } from './placeholder.js';
import { setFragment } from './i18n.js';
import { DEFAULTS } from './defaults.js';
import { CONTENT_AREA } from './area.js';
import { isHidden, watchVisibility } from './visibility.js';

/**
 * @typedef {import('./deck.js').Deck} Deck
 * @typedef {import('./deck.js').Slide} Slide
 * @typedef {import('./deck.js').State} State
 * @typedef {import('./lock.js').Policy} Policy
 * @typedef {import('./lock.js').LockState} LockState
 * @typedef {import('./placeholder.js').SlideRenderer} SlideRenderer
 * @typedef {import('./placeholder.js').RenderContext} RenderContext
 * @typedef {{animations: Animation[], done: boolean, target: State}} Run
 */

const MOTIONS = ['auto', 'reduce', 'full'];

export class Player {
  /**
   * @param {object} o
   * @param {Deck} o.deck
   * @param {HTMLElement} o.host  receives the slide DOM
   * @param {(slide: Slide, ctx: RenderContext) => SlideRenderer} [o.createRenderer]  default: the placeholder renderer
   * @param {Policy} [o.policy]  lock policy (default queue)
   * @param {'auto'|'reduce'|'full'} [o.motion]  auto follows prefers-reduced-motion; reduce and full force it either way
   * @param {string|null} [o.lang]
   * @param {Window} [o.window]
   * @param {Partial<typeof DEFAULTS>} [o.defaults]  overrides on top of the deck's `engine` numbers (WP-12c), which sit on top of the built-in DEFAULTS
   * @param {(slide: Slide, lang: string) => HTMLElement|null} [o.chrome]  WP-12c: the chrome layer of a slide (top strip, footer): built after the renderer
   *   mounted and appended to the host, so it is rebuilt with every slide and every language switch and is, like the slide, a function of the state
   */
  constructor(o) {
    this.deck = o.deck;
    this.host = o.host;
    this.doc = o.host.ownerDocument;
    this.win = o.window ?? /** @type {Window} */ (this.doc.defaultView);
    this.createRenderer = o.createRenderer ?? createPlaceholderRenderer;
    this.chrome = o.chrome ?? null;
    this.defaults = { ...DEFAULTS, ...(this.deck.engine ?? {}), ...(o.defaults ?? {}) };     // WP-12c: the deck JSON's numbers, else the built-in ones
    this.lang = resolveLang(this.deck, o.lang);
    /** @type {LockState} */ this.lock = initialLockState(o.policy ?? 'queue');
    /** @type {State} */ this.state = firstState(this.deck);
    /** @type {Slide|null} */ this.slide = null;
    /** @type {SlideRenderer|null} */ this.renderer = null;
    /** @type {Run|null} */ this.run = null;
    /** @type {*} */ this._guard = null;                                // motion-guard: handle of the fast-finish deadline timer
    /** @type {Array<() => void>} */ this._idle = [];
    /** @type {Map<string, Set<(d: any) => void>>} */ this._listeners = new Map();
    /** @type {'auto'|'reduce'|'full'} */ this.motion = 'auto';
    /** @type {MediaQueryList|null} */ this.mq = null;
    this._onMq = () => this._motionChanged();
    // WP-43 (D-096): nobody sees a hidden document and it gets no frames, so what plays when it hides is finished at once and nothing is played while it stays hidden (see `still`)
    this._unwatch = watchVisibility(this.doc, () => this._visibilityChanged());
    this._warn = (/** @type {{code: string, message: string}} */ w) => {
      if (this._listeners.get('warn')?.size) this._emit('warn', w); else console.warn(`[savo-slides] ${w.code}: ${w.message}`);
    };
    this.setMotion(o.motion ?? 'auto');
  }

  // ---------- state ----------
  get animating() { return this.run !== null; }
  get policy() { return this.lock.policy; }
  /** @returns {LockState} */ get lockState() { return { ...this.lock }; }
  get reducedMotion() { return this.motion === 'reduce' || (this.motion === 'auto' && !!this.mq && this.mq.matches); }
  /** WP-43: is the document hidden (minimised, behind another tab)? Chrome plays no animation of a hidden document: a step started there never ends. @returns {boolean} */
  get hidden() { return isHidden(this.doc); }
  /** WP-43 (D-096): should no motion be played now? The reader asked for none (reduced motion) or nobody can see it (hidden). A still player draws every step at its last frame at once and runs no ambient loop. @returns {boolean} */
  get still() { return this.reducedMotion || this.hidden; }
  /** The engine's own animations in this document (named ones plus anything inside the host): what acceptance checks count. Foreign animations are not in it. @returns {Animation[]} */
  ownAnimations() { return ownAnimations(this.doc, this.host); }

  /**
   * Draw the first state instantly (a deep link, or the first slide). Returns the problems of the requested link.
   * WP-10: `lang` lets an audience window start in the console's language, so its first picture is already the right one.
   * @param {{slideId: string|null, step?: number, lang?: string|null}} [requested]
   */
  start(requested = { slideId: null }) {
    const { state, problems } = clampState(this.deck, requested);
    if (requested.lang) this.lang = resolveLang(this.deck, requested.lang);
    this._syncDocLang();
    this._snap(state, 'start');
    return problems;
  }
  /** WP-09: <html lang> always names the language on screen (CLAUDE.md invariant: text-transform is language-aware). */
  _syncDocLang() { this.doc.documentElement.lang = this.lang; }

  /** @param {'auto'|'reduce'|'full'} mode */
  setMotion(mode) {
    if (!MOTIONS.includes(mode)) throw new RangeError(`motion must be one of ${MOTIONS.join(', ')}, got ${String(mode)}`);
    this.motion = mode;
    // WP-12c: a FORCED mode cannot be seen through the media query, so CSS gets a hook on the host: data-motion="reduce|full". `auto` writes nothing: the media query decides.
    if (mode === 'auto') this.host.removeAttribute('data-motion'); else this.host.setAttribute('data-motion', mode);
    if (mode === 'auto' && !this.mq && this.win && typeof this.win.matchMedia === 'function') {
      this.mq = this.win.matchMedia('(prefers-reduced-motion: reduce)');
      this.mq.addEventListener('change', this._onMq);
    }
    if (this.renderer) this._motionChanged();
  }
  /** @param {Policy} policy */
  setPolicy(policy) {
    this.lock = reduce(this.lock, { type: 'policy', policy }).state;
    this._emit('policy', { policy });
    this._emitLock();
  }
  /** Switch language: finish the running step, then redraw the same state in the new language. @param {string} lang */
  setLang(lang) {
    const l = resolveLang(this.deck, lang);
    if (l === this.lang) return;
    this._finishRun('lang');
    this.lang = l;
    this._syncDocLang();                                   // before the redraw: the new text is laid out under the new language
    this._snap(this.state, 'lang');
    this._emit('lang', { lang: l });
  }

  // ---------- commands ----------
  /** One "next" press. `force` is Shift+Right: cut and go under every policy. @param {{force?: boolean}} [o] @returns {import('./lock.js').LockAction} */
  next({ force = false } = {}) { return this._press('next', force); }
  /** One "back" press: the previous state, drawn instantly. */
  prev() { return this._press('back', false); }
  first() { return this._press('jump', false, firstState(this.deck)); }
  last() { return this._press('jump', false, lastState(this.deck)); }
  /** Jump to a state, drawn instantly. An unknown slide or a step past the end is corrected and reported. @param {string} slideId @param {number} [step] */
  goto(slideId, step = 0) {
    const { state, problems } = clampState(this.deck, { slideId, step });
    this._press('jump', false, state);
    return problems;
  }
  /** Finish the running step instantly (commit + cancel). */
  finishAll() { this._finishRun('finish'); }
  /**
   * WP-10: finish the running step within the fast budget (the speed-up and its deadline guard of the `fast` policy), without
   * touching the lock or the state. An audience window runs this when its console, which owns the lock, decided "fast".
   * @returns {boolean} whether a step was running
   */
  fastFinish() {
    if (!this.run) return false;
    if (this._guard === null) this._fastFinish();          // a repeated order (it may arrive on two channels) must not arm a second deadline
    return true;
  }
  /** Resolves when no step is running and no press is remembered. @returns {Promise<void>} */
  idle() {
    if (!this.run && !this.lock.pending) return Promise.resolve();
    return new Promise((resolve) => { this._idle.push(resolve); });
  }

  // ---------- events ----------
  /**
   * state {slideId, step, animated, reason} · press {kind, force, action, lock} · lock {…LockState} · transitionend {slideId, step, how}
   * · transitioncancel · end · motion {reduced} · visibility {hidden} · policy · lang · warn {code, message}
   * @param {string} type @param {(detail: any) => void} fn @returns {() => void} unsubscribe
   */
  on(type, fn) {
    let set = this._listeners.get(type);
    if (!set) this._listeners.set(type, set = new Set());
    set.add(fn);
    return () => { set.delete(fn); };
  }
  /** @param {string} type @param {any} detail */
  _emit(type, detail) {
    for (const fn of [...(this._listeners.get(type) ?? [])]) {
      try { fn(detail); } catch (e) { console.error(`[savo-slides] a "${type}" listener threw`, e); }
    }
  }
  _emitLock() { this._emit('lock', { ...this.lock }); }

  destroy() {
    this._abandonRun();
    cancelAmbient(this.doc);
    this.renderer?.destroy?.();
    this.host.replaceChildren();
    this.mq?.removeEventListener('change', this._onMq);
    this._unwatch?.();
    this._listeners.clear();
    this._flushIdle();
  }

  // ---------- internals: presses and the lock ----------
  /** @param {import('./lock.js').NavKind} kind @param {boolean} force @param {State} [target] */
  _press(kind, force, target) {
    if (!this.renderer) throw new Error('Player.start() must run before the first command');
    const before = this.lock;
    const r = reduce(before, { type: 'press', kind, force });
    this.lock = r.state;
    this._emit('press', { kind, force, action: r.action, lock: { ...this.lock } });
    if (r.state.pending !== before.pending || r.state.fast !== before.fast || r.state.animating !== before.animating) this._emitLock();   // e.g. "a press is remembered"
    switch (r.action) {
      case 'START':
        this._navigate(kind, target);
        break;
      case 'CUT_AND_GO':
        this._finishRun('cut');
        this._navigate(kind, target);
        break;
      case 'SNAP_NOW':
        this._abandonRun();
        this._navigate(kind, target);
        break;
      case 'FAST_FINISH':
        this._fastFinish();
        break;
      default:
        break;      // QUEUED, DROPPED, IGNORED: nothing to do now, the press event told the UI
    }
    return r.action;
  }

  /** @param {import('./lock.js').NavKind} kind @param {State} [target] */
  _navigate(kind, target) {
    if (kind === 'next') {
      const t = nextState(this.deck, this.state);
      if (!t) { this._emit('end', { ...this.state }); return; }
      if (t.entering) this._enter(t.slideId); else this._playStep({ slideId: t.slideId, step: t.step });
    } else if (kind === 'back') {
      const t = prevState(this.deck, this.state);
      if (t) this._snap(t, 'back');
    } else if (target) {
      this._snap(target, 'jump');
    }
  }

  _fastFinish() {
    const run = this.run;
    if (!run) return;
    speedUp(run.animations, this.defaults.fastMs * this.defaults.fastTargetRatio);
    // motion-guard: a deadline only. If the speed-up has not landed by then the step is finished instantly, so a fast finish can never exceed its budget.
    this._guard = setTimeout(() => { if (this.run === run) this._finishRun('guard'); }, this.defaults.fastMs * this.defaults.fastGuardRatio); // motion-guard
  }
  _clearGuard() { if (this._guard !== null) { clearTimeout(this._guard); this._guard = null; } }

  // ---------- internals: frames and transitions ----------
  /** Slide entry (state 0 animates in from the base DOM) @param {string} slideId */
  _enter(slideId) {
    this._abandonRun();
    this._mount(slideId);
    const target = { slideId, step: 0 };
    if (this.still) { this._instant(target, 'enter', this.reducedMotion ? 'reduced' : 'hidden'); return; }
    this._playTimeline(target, 'enter');
  }
  /** A step inside the current slide @param {State} target */
  _playStep(target) {
    if (this.still) { this.renderer?.render(target.step); this._setState(target, false, 'step'); this._shown(target); this._emit('transitionend', { ...target, how: this.reducedMotion ? 'reduced' : 'hidden' }); this._flushIdle(); return; }
    this._playTimeline(target, 'step');
  }
  /** @param {State} target @param {string} reason @param {string} how */
  _instant(target, reason, how) {
    this.renderer?.render(target.step);
    this._setState(target, false, reason);
    this._startAmbient();
    this._shown(target);
    this._emit('transitionend', { ...target, how });
    this._flushIdle();
  }
  /** @param {State} target @param {string} reason */
  _playTimeline(target, reason) {
    const renderer = /** @type {SlideRenderer} */ (this.renderer);
    const plan = renderer.timeline(target.step);
    const animations = playPlan(plan, { id: `${target.slideId}:${target.step}`, easing: this.defaults.easing, onWarn: this._warn });
    this._setState(target, true, reason);
    if (animations.length === 0) {                                       // nothing to animate: the pure frame IS the transition
      renderer.render(target.step);
      this._startAmbient();
      this._shown(target);
      this._emit('transitionend', { ...target, how: 'instant' });
      this._flushIdle();
      return;
    }
    /** @type {Run} */
    const run = { animations, done: false, target };
    this.run = run;
    this.lock = reduce(this.lock, { type: 'started' }).state;
    this._emitLock();
    settle(animations).then(() => this._complete(run, 'natural'));
  }

  /** The animations of `run` ended (naturally or finished by us): commit, cancel, release the lock, start what was owed. @param {Run} run @param {string} how */
  _complete(run, how) {
    if (run.done) return;
    run.done = true;
    commitAndCancel(run.animations, this._warn);
    if (this.run === run) this.run = null;
    this._clearGuard();
    const r = reduce(this.lock, { type: 'finished' });
    this.lock = r.state;
    this._startAmbient();
    this._shown(run.target);
    this._emit('transitionend', { ...run.target, how });
    this._emitLock();
    if (r.action === 'START_PENDING') this._navigate('next');           // the one remembered press (queue policy)
    this._flushIdle();
  }
  /** @param {string} how */
  _finishRun(how) {
    const run = this.run;
    if (!run) return;
    finishAnimations(run.animations, this._warn);
    this._complete(run, how);
  }
  /** Drop a running step without committing: the DOM is about to be rebuilt. */
  _abandonRun() {
    const run = this.run;
    if (!run) return;
    run.done = true;
    cancelAnimations(run.animations);
    this.run = null;
    this._clearGuard();
    this.lock = { ...this.lock, animating: false, pending: false, fast: false };
    this._emit('transitioncancel', { ...run.target });
    this._emitLock();
    this._flushIdle();
  }

  /** Rebuild the slide and set the final picture of `target` instantly. @param {State} target @param {string} reason */
  _snap(target, reason) {
    this._abandonRun();
    this._mount(target.slideId);
    this._instant(target, reason, 'snap');
  }
  /** Fresh base DOM of a slide. @param {string} slideId @returns {SlideRenderer} */
  _mount(slideId) {
    const slide = slideAt(this.deck, slideId);
    cancelAmbient(this.doc);
    this.renderer?.destroy?.();
    this.host.replaceChildren();
    const renderer = this.createRenderer(slide, this._ctx(slide));
    renderer.mount(this.host);
    this._tag(slide);
    const layer = this.chrome ? this.chrome(slide, this.lang) : null;           // WP-12c: after the slide, so it stands above it (z-index in chrome.css); a page without chrome returns null
    if (layer) this.host.appendChild(layer);
    this.renderer = renderer;
    this.slide = slide;
    return renderer;
  }
  /**
   * WP-20: the root of every slide says which slide and which kind it is, whichever renderer drew it (the cover card comes from engine/chrome, which knows neither). What reads the DOM
   * (the acceptance rig compares the windows by what they show, not by what they say) finds `[data-slide]`; a renderer that set them itself keeps its own.
   * @param {Slide} slide
   */
  _tag(slide) {
    const root = this.host.firstElementChild;
    if (!root) return;
    if (!root.hasAttribute('data-slide')) root.setAttribute('data-slide', slide.id);
    if (!root.hasAttribute('data-kind')) root.setAttribute('data-kind', slide.kind);
  }
  /**
   * The step whose FINAL picture is on screen now, written on the slide root at the four places a picture becomes final (an instant draw, a step with nothing to animate, the end of an
   * animation, a reduced-motion step), so the DOM carries the state whatever the renderer (a text-steps line, a widget, the cover) and the same attribute stands in a deep link and after presses.
   * @param {State} s
   */
  _shown(s) {
    const root = this.host.firstElementChild;
    if (root) root.setAttribute('data-shown-step', String(s.step));
  }
  /** @param {Slide} slide @returns {RenderContext} */
  _ctx(slide) {
    return { deck: this.deck, slide, lang: this.lang, doc: this.doc, win: this.win, defaults: this.defaults, area: CONTENT_AREA,   // WP-20: area, the room under the strip and above the footer band
      text: (v) => text(this.deck, v, this.lang), reducedMotion: () => this.reducedMotion,
      // an element showing text in a language other than <html lang> carries its own lang attribute
      setText: (el, v, lang = this.lang) => setFragment(el, v, { lang, docLang: this.lang, defaultLang: this.deck.defaultLang, math: this.deck.math }) };
  }
  /** @param {State} target @param {boolean} animated @param {string} reason */
  _setState(target, animated, reason) {
    this.state = { slideId: target.slideId, step: target.step };
    this.slide = slideAt(this.deck, target.slideId);
    this._emit('state', { ...this.state, animated, reason });
  }

  _startAmbient() {
    cancelAmbient(this.doc);
    const loops = this.renderer?.ambient?.();
    if (!loops) return;
    loops.forEach(([el, keyframes, o]) => startAmbient(el, keyframes, o, this.still));
  }
  _motionChanged() {
    if (this.still) { this._finishRun(this.reducedMotion ? 'reduced' : 'hidden'); cancelAmbient(this.doc); } else if (this.renderer) this._startAmbient();
    this._emit('motion', { reduced: this.reducedMotion });
  }
  /**
   * WP-43 (D-096): the document was hidden or shown. Hidden: the running step is finished (commit and cancel: the lock is released, a remembered press is carried out, and each of those
   * is drawn at its last frame because the player is still) and the ambient loops stop; shown: the loops come back, and the next step plays as ever. The way out of a frozen step is
   * this event and `Animation.finish()`, never a timer: a hidden page throttles its timers too.
   */
  _visibilityChanged() {
    if (this.renderer) {
      if (this.still) { this._finishRun('hidden'); cancelAmbient(this.doc); } else this._startAmbient();
    }
    this._emit('visibility', { hidden: this.hidden });
  }
  _flushIdle() {
    if (this.run || this.lock.pending) return;
    for (const resolve of this._idle.splice(0)) resolve();
  }
}
