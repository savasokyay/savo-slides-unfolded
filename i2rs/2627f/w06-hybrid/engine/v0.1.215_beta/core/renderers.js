// @ts-check
// WP-20: the dispatcher. The Player draws every slide through one function, `createRenderer(slide, ctx)` (core/player.js); this module is the one boot.js hands it.
//   generated page (cover, toc, references, evidence, colophon, closing)   the renderer of that page, or the placeholder page while it has none
//   content slide                                                         the renderer of its layout (`slide.layout`, engine/layouts); a layout with a widget slot takes
//                                                                         the slide's widget (`slide.widget.use`, engine/widgets) into its slot
// Nothing is guessed: an id the engine does not know is an error. `rendererProblems(deck)` finds every such slide ONCE, at load (like `chromeProblems`), so the page stops
// there with a clear message and not at slide 17 of the lecture; `createRenderer` throws the same error as the backstop for a caller that skipped the check.
// A placeholder entry (status `placeholder` in the tables) is listed on purpose and is drawn by core/placeholder.js: it is not a fallback for an unknown id.
// `makeRenderers(tables)` builds the pair over any tables (the tests pass small ones); the module's own exports are that pair over the engine's tables.
import { DeckError } from './deck.js';
import { createPlaceholderRenderer } from './placeholder.js';
import { LAYOUTS } from '../layouts/index.js';
import { WIDGETS } from '../widgets/index.js';
import { PAGES } from '../pages/index.js';

/** @typedef {import('./deck.js').Deck} Deck @typedef {import('./deck.js').Slide} Slide @typedef {import('./placeholder.js').RenderContext} RenderContext @typedef {import('./placeholder.js').SlideRenderer} SlideRenderer */
/**
 * @typedef {object} Tables
 * @property {Readonly<Record<string, {id: string, widgetSlot: boolean, widgetRequired?: boolean, create: (slide: Slide, ctx: RenderContext, widget: any) => SlideRenderer}>>} layouts
 * @property {Readonly<Record<string, {id: string, checkParams: (params: unknown) => Array<{path: string, detail: string}>, stepCount?: ((params: unknown) => number)|null}>>} widgets
 * @property {Readonly<Record<string, {create: (slide: Slide, ctx: RenderContext) => SlideRenderer, problems?: (deck: Deck, slide: Slide) => string[]}>>} pages
 *   the renderers of the generated pages by kind (pages/index.js); `problems` lists at load what the page cannot be drawn without
 */

/** Own properties only: an id such as `constructor` or `__proto__` is not an entry. @template T @param {Readonly<Record<string, T>>} table @param {unknown} id @returns {T|undefined} */
const own = (table, id) => (typeof id === 'string' && Object.hasOwn(table, id) ? table[id] : undefined);

/** @param {Tables} tables */
export function makeRenderers(tables) {
  const { layouts, widgets, pages } = tables;
  /**
   * Everything wrong with the layouts and widgets a deck names, as `slide <id>: ...` strings (none: every slide can be drawn).
   * @param {Deck} deck @returns {string[]}
   */
  function rendererProblems(deck) {
    /** @type {string[]} */ const out = [];
    for (const slide of deck.slides) {
      if (slide.kind !== 'content') {                            // a generated page has a renderer or the placeholder (its kind was checked by loadDeck); a renderer says what data it needs
        out.push(...(own(pages, slide.kind)?.problems?.(deck, slide) ?? []));
        continue;
      }
      const layout = own(layouts, slide.layout);
      if (!layout) out.push(`slide ${slide.id}: the layout ${JSON.stringify(slide.layout)} is not one of the engine's (${Object.keys(layouts).join(', ')})`);
      if (!slide.widget) {
        if (layout?.widgetRequired) out.push(`slide ${slide.id}: the layout "${layout.id}" draws a widget and the slide carries none`);
        continue;
      }
      const widget = own(widgets, slide.widget.use);
      if (!widget) out.push(`slide ${slide.id}: the widget ${JSON.stringify(slide.widget.use)} is not one of the engine's (${Object.keys(widgets).join(', ')})`);
      else {
        const refused = widget.checkParams(slide.widget.params);
        for (const p of refused) out.push(`slide ${slide.id}: widget ${widget.id}, param ${p.path} ${p.detail}`);
        // the build cannot run JavaScript, so this is where the number of steps the widget takes meets the number the slide has (a placeholder widget takes none: stepCount is null)
        if (refused.length === 0 && typeof widget.stepCount === 'function') {
          const takes = widget.stepCount(slide.widget.params);
          if (takes !== slide.stepCount) out.push(`slide ${slide.id}: the widget ${widget.id} takes ${takes} steps with these params, the slide has ${slide.stepCount}`);
        }
      }
      if (layout && !layout.widgetSlot) out.push(`slide ${slide.id}: the layout "${layout.id}" has no slot for a widget, but the slide carries "${slide.widget.use}"`);
    }
    return out;
  }

  /**
   * The renderer of a slide. Throws a DeckError for a layout or widget the engine does not know (`rendererProblems` reports the same thing at load).
   * @param {Slide} slide @param {RenderContext} ctx @returns {SlideRenderer}
   */
  function createRenderer(slide, ctx) {
    if (slide.kind !== 'content') return (own(pages, slide.kind)?.create ?? createPlaceholderRenderer)(slide, ctx);
    const layout = own(layouts, slide.layout);
    if (!layout) throw new DeckError('unknown_layout', `$.slides[${slide.index}].layout`, `the layout ${JSON.stringify(slide.layout)} is not one of the engine's (${Object.keys(layouts).join(', ')})`);
    const widget = slide.widget ? own(widgets, slide.widget.use) ?? null : null;
    if (slide.widget && !widget) throw new DeckError('unknown_widget', `$.slides[${slide.index}].widget.use`, `the widget ${JSON.stringify(slide.widget.use)} is not one of the engine's (${Object.keys(widgets).join(', ')})`);
    if (layout.widgetRequired && !widget) throw new DeckError('widget_missing', `$.slides[${slide.index}].widget`, `the layout "${layout.id}" draws a widget and the slide carries none`);
    return layout.create(slide, ctx, widget);
  }

  return { createRenderer, rendererProblems };
}

export const { createRenderer, rendererProblems } = makeRenderers({ layouts: LAYOUTS, widgets: WIDGETS, pages: PAGES });
