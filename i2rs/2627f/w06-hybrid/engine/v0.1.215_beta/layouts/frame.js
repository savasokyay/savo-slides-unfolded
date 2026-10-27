// @ts-check
// WP-20: what every content layout shares: the root of a slide, its head (title and hook) and the entry of the head. The DOM contract below is STABLE
// (harness rows, the build's checks and ui-agent's visual layer read it; documented in engine/README.md):
//
//   section.savo-slide[data-slide=<id>][data-kind=content][data-layout=<layout id>]      the slide root: the first child of the stage, the chrome comes after it
//     header.savo-head
//       h1.savo-title[data-part=title]                                                   the slide's title (a text fragment, set through ctx.setText)
//       p.savo-hook[data-part=hook]                                                      the hook, only when the slide has one
//     ...the layout's own parts: ol.savo-steps[data-part=steps] > li.savo-step[data-step=<k>]   (text-steps)
//        div.savo-slot[data-part=widget]                                                 (widget-stage: where the widget draws)
//
// Look: engine/css/content.css (tokens only, no colour literal). Motion: transform and opacity only, returned as a Plan (D-039).

/** The hidden and the shown picture of a part (the placeholder's, core/placeholder.js: one visual language for every slide). Inline: they are what the animation moves. */
export const HEAD_HIDDEN = { opacity: '0', transform: 'translateY(12px)' };
export const ITEM_HIDDEN = { opacity: '0', transform: 'translateY(24px)' };
export const SHOWN = { opacity: '1', transform: 'none' };
/** The hook follows the title by this much (ms), as in the placeholder. */
export const HOOK_DELAY_MS = 120;

/** @param {HTMLElement} el @param {Record<string, string>} style */
export const put = (el, style) => { Object.assign(el.style, style); };

/**
 * A step text that is the empty string in every language: the explicit "no caption from here on" of widget-stage (D-097; the deck gate, core/deck.js, accepts it for a step and
 * for nothing else). `null` is a step with no text at all. A layout that draws no captions (text-steps) draws nothing for either.
 * @param {Record<string, string>|null|undefined} html @returns {boolean}
 */
export const isEmptyFragment = (html) => !!html && Object.values(html).every((t) => t === '');

/**
 * @typedef {import('../core/placeholder.js').RenderContext} RenderContext
 * @typedef {import('../core/deck.js').Slide} Slide
 * @typedef {{root: HTMLElement, title: HTMLElement, hook: HTMLElement|null}} Frame
 */

/**
 * The slide root and its head. The root is NOT yet in the document: the layout adds its own parts, then appends the root to the host.
 * @param {RenderContext} ctx @param {Slide} slide @param {string} layoutId @returns {Frame}
 */
export function buildFrame(ctx, slide, layoutId) {
  const doc = ctx.doc;
  const root = doc.createElement('section');
  root.className = 'savo-slide';
  root.setAttribute('data-slide', slide.id);
  root.setAttribute('data-kind', slide.kind);
  root.setAttribute('data-layout', layoutId);
  const head = doc.createElement('header');
  head.className = 'savo-head';
  const title = doc.createElement('h1');
  title.className = 'savo-title';
  title.setAttribute('data-part', 'title');
  ctx.setText(title, slide.title);                                // a fragment the deck gate already checked; labelled when it is not in <html lang>
  head.appendChild(title);
  /** @type {HTMLElement|null} */
  let hook = null;
  if (slide.hook) {
    hook = doc.createElement('p');
    hook.className = 'savo-hook';
    hook.setAttribute('data-part', 'hook');
    ctx.setText(hook, slide.hook);
    head.appendChild(hook);
  }
  root.appendChild(head);
  return { root, title, hook };
}

/** The base DOM of the head: everything hidden, ready for the entry. @param {Frame} f */
export function hideHead(f) { put(f.title, HEAD_HIDDEN); if (f.hook) put(f.hook, HEAD_HIDDEN); }
/** The final picture of the head. @param {Frame} f */
export function showHead(f) { put(f.title, SHOWN); if (f.hook) put(f.hook, SHOWN); }

/**
 * The entry of the head: the title, then the hook a moment later.
 * @param {Frame} f @param {number} entryMs @returns {import('../core/animations.js').Plan}
 */
export function headEntry(f, entryMs) {
  /** @type {import('../core/animations.js').Plan} */
  const plan = [[f.title, [HEAD_HIDDEN, SHOWN], 0, entryMs]];
  if (f.hook) plan.push([f.hook, [HEAD_HIDDEN, SHOWN], HOOK_DELAY_MS, entryMs]);
  return plan;
}
