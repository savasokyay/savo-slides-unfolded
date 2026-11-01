// @ts-check
// WP-20: the layout `widget-stage` (brief 04, step 3): the title, the hook, ONE widget in a big slot and, under it, a one-line caption band. The widget is the story and
// the caption only says what to look at. The widget (widgets/kit.js) draws into the slot it is given and animates its own parts; this layout adds the slide's entry and
// the swap of the caption, and returns ONE merged Plan per state, so duration(k) is the planDuration of what actually plays (the length the build compares with the
// speaking budget can never drift from the motion).
//
//   state 0   the head enters (the title, the hook 120 ms behind it); the slot fades in behind the hook (opacity only); the widget's own entry (its plan of state 0, often
//             none) starts together with the slot, so nothing of it plays in an invisible slot
//   state k   the widget's plan of state k, unchanged, together with the swap of the caption when step k brings one: the old caption fades out, the new one fades in behind it
//
// The caption is STICKY (D-097): a step with no text at all (`html` null: a beat of the picture alone) keeps the last caption, so the band is never empty in the middle of a
// story; a step whose text is the explicit empty string (in every language) CLEARS the caption, which stays cleared until a step brings a text; state 0 has none. Only one caption
// is shown at a time; they lie on top of each other in the band. A caption is one line: a longer one runs out of the band to the right (white-space: nowrap in content.css) where a
// measurement sees it, it is never clipped or wrapped away.
// A widget the registry lists but nobody has written (status `placeholder`) is drawn as one line of text in the slot, like the placeholder page does.
import { planDuration } from '../core/animations.js';
import { buildFrame, headEntry, hideHead, showHead, put, isEmptyFragment, HOOK_DELAY_MS, SHOWN } from './frame.js';
import { WIDGET_SLOT } from './geometry.js';

/**
 * @typedef {import('../core/deck.js').Slide} Slide
 * @typedef {import('../core/animations.js').Plan} Plan
 * @typedef {import('../core/placeholder.js').RenderContext} RenderContext
 * @typedef {import('../core/placeholder.js').SlideRenderer} SlideRenderer
 */

/** The slot fades in behind the hook: the head first, then the picture. */
export const SLOT_DELAY_MS = 2 * HOOK_DELAY_MS;
/** A caption that leaves fades for this share of a step's length; the one that arrives follows it, so a swap is one beat, not two. */
export const CAPTION_OUT_SHARE = 0.4;
/** The hidden and the shown picture of the slot (opacity alone: the widget inside moves by itself) and the hidden picture of a caption (the shown one is frame.js SHOWN). */
export const SLOT_HIDDEN = Object.freeze({ opacity: '0' });
export const SLOT_SHOWN = Object.freeze({ opacity: '1' });
export const CAPTION_HIDDEN = Object.freeze({ opacity: '0', transform: 'translateY(8px)' });

/**
 * Which step's caption is on screen in state k: the latest step up to k that SETS the caption (a step with no text keeps the caption before it), 0 for none (state 0, or
 * nothing set yet). `sets[i]` says whether step i + 1 sets the caption: it has a text, possibly the explicit empty one that clears it.
 * @param {ReadonlyArray<boolean>} sets @param {number} k @returns {number}
 */
export function captionStep(sets, k) {
  for (let j = Math.min(k, sets.length); j >= 1; j--) if (sets[j - 1]) return j;
  return 0;
}

/** The same plan, every entry starting `ms` later (the tuple keeps its shape: fill and easing stay where they are). @param {Plan} plan @param {number} ms @returns {Plan} */
export function shiftPlan(plan, ms) {
  return plan.map((e) => /** @type {any} */ ([e[0], e[1], e[2] + ms, ...e.slice(3)]));
}

/**
 * What stands in the slot for a widget that has no module: one line naming it, the same words as the placeholder page. It has no motion of its own.
 * @param {Slide} slide @param {RenderContext} ctx @returns {SlideRenderer}
 */
function placeholderInstance(slide, ctx) {
  return {
    mount(host) {
      const p = ctx.doc.createElement('p');
      p.className = 'savo-slot-note';
      p.setAttribute('data-part', 'widget-placeholder');
      p.setAttribute('lang', 'en');                                       // text the engine invents is English
      p.textContent = `widget ${slide.widget?.use} ${JSON.stringify(slide.widget?.params ?? {})} (placeholder: the widget is not written yet)`;
      host.appendChild(p);
    },
    render() {},
    timeline() { return []; },
    duration() { return 0; },
  };
}

/**
 * @param {Slide} slide @param {RenderContext} ctx @param {import('../widgets/kit.js').WidgetEntry|null} widget  the table entry of `slide.widget.use`, found by the dispatcher
 * @returns {SlideRenderer}
 */
export function createWidgetStage(slide, ctx, widget) {
  if (!widget) throw new Error(`widget-stage on slide ${slide.id}: the slide carries no widget (rendererProblems reports this at load)`);
  // the numbers of the motion are the engine's (deck.engine, via ctx.defaults); a widget that is only listed (no module) keeps the timing params of the placeholder page, `entryMs`
  // and `durationMs`, so the decks and the acceptance rigs written for it keep their lengths. A real widget's params are its own: the layout never reads them.
  const given = /** @type {any} */ (widget.create ? {} : slide.widget?.params ?? {});
  const num = (/** @type {unknown} */ v, /** @type {number} */ d) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : d);
  const entryMs = num(given.entryMs, ctx.defaults.placeholderEntryMs), stepMs = num(given.durationMs, ctx.defaults.placeholderStepMs);
  const outMs = Math.max(1, Math.round(stepMs * CAPTION_OUT_SHARE));
  /** `caps[i]` is the caption element of step i + 1, null when the step has none or clears it; `sets[i]` says the step sets the caption (a cleared one included). */
  /** @type {{frame: import('./frame.js').Frame, slot: HTMLElement, caps: Array<HTMLElement|null>, sets: boolean[], inner: SlideRenderer}|null} */
  let dom = null;
  const need = () => { if (!dom) throw new Error('widget-stage: used before mount()'); return dom; };

  /** @param {number} k @returns {Plan} */
  function timeline(k) {
    const d = need();
    if (k === 0) return [...headEntry(d.frame, entryMs), [d.slot, [SLOT_HIDDEN, SLOT_SHOWN], SLOT_DELAY_MS, entryMs], ...shiftPlan(d.inner.timeline(0), SLOT_DELAY_MS)];
    /** @type {Plan} */
    const plan = [...d.inner.timeline(k)];
    const from = captionStep(d.sets, k - 1), to = captionStep(d.sets, k);
    if (from !== to) {
      const old = from > 0 ? d.caps[from - 1] : null, now = to > 0 ? d.caps[to - 1] : null;      // a cleared caption has no element: there is nothing to fade in
      if (old) plan.push([old, [SHOWN, CAPTION_HIDDEN], 0, outMs]);
      if (now) plan.push([now, [CAPTION_HIDDEN, SHOWN], old ? outMs : 0, stepMs]);
    }
    return plan;
  }

  return {
    mount(host) {
      const doc = ctx.doc;
      const frame = buildFrame(ctx, slide, 'widget-stage');
      const slot = doc.createElement('div');
      slot.className = 'savo-slot';
      slot.setAttribute('data-part', 'widget');
      const band = doc.createElement('div');
      band.className = 'savo-caption';
      band.setAttribute('data-part', 'caption');
      /** @type {Array<HTMLElement|null>} */
      const caps = [], sets = [];
      for (const st of slide.steps) {
        sets.push(!!st.html);                                             // a text, even the empty one, sets the caption; no text leaves it
        if (!st.html || isEmptyFragment(st.html)) { caps.push(null); continue; }
        const p = doc.createElement('p');
        p.className = 'savo-cap';
        p.setAttribute('data-step', String(st.k));
        ctx.setText(p, st.html);
        band.appendChild(p);
        caps.push(p);
      }
      frame.root.append(slot, band);
      host.appendChild(frame.root);
      const inner = widget.create ? widget.create(slide, /** @type {any} */ ({ ...ctx, size: { width: WIDGET_SLOT.width, height: WIDGET_SLOT.height } })) : placeholderInstance(slide, ctx);
      inner.mount(slot);                                                  // the widget builds the base picture of its state 0 inside the slot
      hideHead(frame);
      put(slot, SLOT_HIDDEN);
      for (const c of caps) if (c) put(c, CAPTION_HIDDEN);
      dom = { frame, slot, caps, sets, inner };
    },
    render(k) {
      const d = need();
      if (!Number.isInteger(k) || k < 0 || k > slide.stepCount) throw new RangeError(`widget-stage on slide ${slide.id} has no state ${k} (0 ... ${slide.stepCount})`);
      showHead(d.frame);
      put(d.slot, SLOT_SHOWN);
      d.inner.render(k);
      const on = captionStep(d.sets, k);
      d.caps.forEach((c, i) => { if (c) put(c, i + 1 === on ? SHOWN : CAPTION_HIDDEN); });
    },
    timeline,
    duration: (k) => planDuration(timeline(k)),
    ambient() { return need().inner.ambient?.() ?? []; },
    destroy() { dom?.inner.destroy?.(); dom = null; },
  };
}
