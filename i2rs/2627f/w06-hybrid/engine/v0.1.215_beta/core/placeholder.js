// @ts-check
// WP-09: the placeholder renderer, the default SlideRenderer until the layouts (WP-12), generated pages (WP-14/15/16/18/19)
// and widgets (WP-20) exist. It shows the title, the hook and one line per step and reveals them through the SAME
// mount / render / timeline / duration contract a real widget has, so the whole frame model (deep link == presses, lock,
// cut-and-go, reduced motion) is exercised by the engine core without a single widget. Everything it moves is a plain
// WAAPI plan on transform and opacity.
// WP-20: the Player's own default (the harness and the tests run on it) and, through core/renderers.js, the page the engine draws for a generated page that has no
// renderer yet and for a layout or widget the registry lists but nobody has written (status `placeholder`). The real layouts are engine/layouts/.
//
// SlideRenderer contract (plan section 3.6, refined in WP-20):
//   mount(host)      build the BASE DOM once: every element of every state exists, nothing is revealed yet
//   render(k)        set the FINAL picture of state k instantly; idempotent and independent of the DOM's current state
//   timeline(k)      the Plan that animates the DOM from the final picture of k-1 to that of k (k = 0: the slide entry,
//                    from the base DOM); an empty plan means "nothing to animate" and the player calls render(k)
//   duration(k)      the static length of timeline(k) in ms; the build checks it against the speaking budget (budget_s)
//   ambient()        optional: endless loops [element, keyframes, {id, duration}] that never lock anything
//   destroy()        optional
// All step motion must be returned from timeline(k); a renderer never calls element.animate() on its own.
/**
 * @typedef {import('./animations.js').Plan} Plan
 * @typedef {import('./deck.js').Slide} Slide
 * @typedef {import('./deck.js').Deck} Deck
 * @typedef {object} RenderContext
 * @property {Deck} deck
 * @property {Slide} slide
 * @property {string} lang
 * @property {Document} doc
 * @property {Window} win
 * @property {typeof import('./defaults.js').DEFAULTS} defaults
 * @property {(v: Record<string, string>|null|undefined) => string} text
 * @property {(el: HTMLElement, v: Record<string, string>|null|undefined, lang?: string) => string} setText
 *           put an i18n fragment into an element; the element gets its own lang attribute when the text is not in <html lang>
 * @property {() => boolean} reducedMotion
 * @property {Readonly<{x: number, y: number, width: number, height: number}>} area  WP-20: the room between the top strip and the footer band, in stage pixels (core/area.js)
 * @typedef {object} SlideRenderer
 * @property {(host: HTMLElement) => void} mount
 * @property {(k: number) => void} render
 * @property {(k: number) => Plan} timeline
 * @property {(k: number) => number} duration
 * @property {() => Array<[Element, Keyframe[], {id: string, duration: number, easing?: string}]>} [ambient]
 * @property {() => void} [destroy]
 */

const HEAD_HIDDEN = { opacity: '0', transform: 'translateY(12px)' };
const ITEM_HIDDEN = { opacity: '0', transform: 'translateY(24px)' };
const SHOWN = { opacity: '1', transform: 'none' };
const num = (v, d) => (Number.isFinite(v) && v >= 0 ? v : d);

/**
 * @param {Slide} slide @param {RenderContext} ctx @returns {SlideRenderer}
 */
export function createPlaceholderRenderer(slide, ctx) {
  const { deck, defaults } = ctx;
  const params = /** @type {any} */ (slide.widget?.params ?? {});
  const stepMs = num(params.durationMs, defaults.placeholderStepMs);
  const entryMs = num(params.entryMs, defaults.placeholderEntryMs);
  const hookDelay = 120;
  /** @type {{title: HTMLElement, hook: HTMLElement|null, items: HTMLElement[]}|null} */
  let dom = null;
  /** @param {HTMLElement} el @param {Record<string, string>} style */
  const put = (el, style) => { Object.assign(el.style, style); };

  return {
    mount(host) {
      const doc = host.ownerDocument;
      const root = doc.createElement('section');
      root.className = 'savo-placeholder';
      root.setAttribute('data-slide', slide.id);
      root.setAttribute('data-kind', slide.kind);
      // WP-20: the look of this page is engine/css/content.css (`.savo-placeholder`, tokens, in the content area under the strip); only what the motion moves is inline
      const title = doc.createElement('h1');
      title.setAttribute('data-part', 'title');
      ctx.setText(title, slide.generated ? deck.title : slide.title);                // fragments, checked by loadDeck; labelled when not in <html lang>
      const hookSource = slide.generated ? deck.subtitle : slide.hook;
      let hook = null;
      if (hookSource) {
        hook = doc.createElement('p');
        hook.setAttribute('data-part', 'hook');
        ctx.setText(hook, hookSource);
      }
      const list = doc.createElement('ol');
      list.setAttribute('data-part', 'steps');
      const items = [];
      for (let k = 1; k <= slide.stepCount; k++) {
        const li = doc.createElement('li');
        li.setAttribute('data-step', String(k));
        const st = slide.steps[k - 1];
        if (st && st.html) ctx.setText(li, st.html);
        else { li.textContent = st ? `(${st.beat})` : `(${slide.kind} page, step ${k})`; li.setAttribute('lang', 'en'); }   // text the placeholder invents is English
        list.appendChild(li);
        items.push(li);
      }
      root.append(title, ...(hook ? [hook] : []), list);
      if (slide.widget) {
        const w = doc.createElement('p');
        w.setAttribute('data-part', 'widget');
        w.textContent = `widget ${slide.widget.use} ${JSON.stringify(slide.widget.params)} (placeholder: the widget arrives with WP-20)`;
        w.setAttribute('lang', 'en');
        root.appendChild(w);
      }
      host.appendChild(root);
      put(title, HEAD_HIDDEN); if (hook) put(hook, HEAD_HIDDEN);
      for (const li of items) put(li, ITEM_HIDDEN);
      dom = { title, hook, items };
    },

    render(k) {
      if (!dom) throw new Error('render() before mount()');
      put(dom.title, SHOWN); if (dom.hook) put(dom.hook, SHOWN);
      dom.items.forEach((li, i) => put(li, i + 1 <= k ? SHOWN : ITEM_HIDDEN));
    },

    timeline(k) {
      if (!dom) throw new Error('timeline() before mount()');
      if (k === 0) {
        /** @type {Plan} */
        const plan = [[dom.title, [HEAD_HIDDEN, SHOWN], 0, entryMs]];
        if (dom.hook) plan.push([dom.hook, [HEAD_HIDDEN, SHOWN], hookDelay, entryMs]);
        return plan;
      }
      const li = dom.items[k - 1];
      return li ? [[li, [ITEM_HIDDEN, SHOWN], 0, stepMs]] : [];
    },

    duration(k) {
      if (k === 0) return entryMs + (slide.hook || (slide.generated && deck.subtitle) ? hookDelay : 0);
      return k <= slide.stepCount ? stepMs : 0;
    },
  };
}
