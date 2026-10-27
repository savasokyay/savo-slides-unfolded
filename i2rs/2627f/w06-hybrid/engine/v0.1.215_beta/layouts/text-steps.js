// @ts-check
// WP-20: the layout `text-steps` (lead decision, 2026-10-25): the title, the hook and text lines that open one press at a time. No widget: the text is the story.
// A step that carries no text, or the explicit empty text, adds nothing to the page (no element), so a press on it changes nothing; the build's checks, not this layout, say whether that is intended.
// The numbers of the motion are the engine's (deck.engine, via ctx.defaults): the entry and the step reveal keep the keys of the placeholder
// (`placeholder_entry_ms`, `placeholder_step_ms`) until the contract renames them; that rename is a build-side change.
import { planDuration } from '../core/animations.js';
import { buildFrame, headEntry, hideHead, showHead, put, isEmptyFragment, ITEM_HIDDEN, SHOWN } from './frame.js';

/**
 * @typedef {import('../core/deck.js').Slide} Slide
 * @typedef {import('../core/placeholder.js').RenderContext} RenderContext
 * @typedef {import('../core/placeholder.js').SlideRenderer} SlideRenderer
 */

/** @param {Slide} slide @param {RenderContext} ctx @returns {SlideRenderer} */
export function createTextSteps(slide, ctx) {
  const entryMs = ctx.defaults.placeholderEntryMs, stepMs = ctx.defaults.placeholderStepMs;
  /** @type {{frame: import('./frame.js').Frame, items: Array<HTMLElement|null>}|null} */
  let dom = null;
  const need = () => { if (!dom) throw new Error('text-steps: used before mount()'); return dom; };

  /** @param {number} k @returns {import('../core/animations.js').Plan} */
  function timeline(k) {
    const d = need();
    if (k === 0) return headEntry(d.frame, entryMs);
    const li = d.items[k - 1];
    return li ? [[li, [ITEM_HIDDEN, SHOWN], 0, stepMs]] : [];
  }

  return {
    mount(host) {
      const doc = ctx.doc;
      const frame = buildFrame(ctx, slide, 'text-steps');
      const list = doc.createElement('ol');
      list.className = 'savo-steps';
      list.setAttribute('data-part', 'steps');
      /** @type {Array<HTMLElement|null>} */
      const items = [];
      for (const st of slide.steps) {
        if (!st.html || isEmptyFragment(st.html)) { items.push(null); continue; }       // no text, or the explicit empty text (D-097): nothing to draw here
        const li = doc.createElement('li');
        li.className = 'savo-step';
        li.setAttribute('data-step', String(st.k));
        ctx.setText(li, st.html);
        list.appendChild(li);
        items.push(li);
      }
      frame.root.appendChild(list);
      host.appendChild(frame.root);
      hideHead(frame);
      for (const li of items) if (li) put(li, ITEM_HIDDEN);
      dom = { frame, items };
    },
    render(k) {
      const d = need();
      if (!Number.isInteger(k) || k < 0 || k > slide.stepCount) throw new RangeError(`text-steps on slide ${slide.id} has no state ${k} (0 ... ${slide.stepCount})`);
      showHead(d.frame);
      d.items.forEach((li, i) => { if (li) put(li, i + 1 <= k ? SHOWN : ITEM_HIDDEN); });
    },
    timeline,
    duration: (k) => planDuration(timeline(k)),
    destroy() { dom = null; },
  };
}
