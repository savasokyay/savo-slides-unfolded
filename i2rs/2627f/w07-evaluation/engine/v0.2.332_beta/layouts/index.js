// @ts-check
// WP-20: the table of layouts: id -> entry. A content slide names its layout (`slide.layout`); the ids are the registry's (engine/registry.json), which the build checks decks
// against, and tests/js/registry-sync.test.mjs holds the two equal. `status` says what the entry is:
//   real         drawn by its own module
//   placeholder  listed so a deck can name it and the build's id check passes; the engine draws the placeholder page (core/placeholder.js) for it. Explicit and
//                listed here, never a silent fallback for an UNKNOWN id: an unknown id stops the page at load (core/renderers.js rendererProblems).
// `widgetSlot` says whether the layout has a place for a widget; a slide that carries a widget must use such a layout. `widgetRequired` says the layout draws nothing without one
// (widget-stage): a slide that names it and carries no widget is an error at load. D-097: widget-stage is the only layout with a slot, so a slide that carries a widget names it.
import { createPlaceholderRenderer } from '../core/placeholder.js';
import { createTextSteps } from './text-steps.js';
import { createWidgetStage } from './widget-stage.js';

/**
 * @typedef {import('../core/deck.js').Slide} Slide
 * @typedef {import('../core/placeholder.js').RenderContext} RenderContext
 * @typedef {import('../core/placeholder.js').SlideRenderer} SlideRenderer
 * @typedef {object} LayoutEntry
 * @property {string} id
 * @property {'real'|'placeholder'} status
 * @property {boolean} widgetSlot
 * @property {boolean} [widgetRequired]  the layout is empty without a widget
 * @property {string} about  one line, what the layout is
 * @property {(slide: Slide, ctx: RenderContext, widget: import('../widgets/kit.js').WidgetEntry|null) => SlideRenderer} create
 */

/** @type {Readonly<Record<string, Readonly<LayoutEntry>>>} */
export const LAYOUTS = Object.freeze({
  'text-steps': Object.freeze({
    id: 'text-steps', status: /** @type {const} */ ('real'), widgetSlot: false,
    about: 'the title, the hook and text lines that open one press at a time; no widget',
    create: (slide, ctx) => createTextSteps(slide, ctx),
  }),
  'widget-stage': Object.freeze({
    id: 'widget-stage', status: /** @type {const} */ ('real'), widgetSlot: true, widgetRequired: true,
    about: 'the title, the hook, one widget in a big slot and a one-line caption band under it; the widget is the story',
    create: (slide, ctx, widget) => createWidgetStage(slide, ctx, widget),
  }),
  'figure-cards': Object.freeze({
    id: 'figure-cards', status: /** @type {const} */ ('placeholder'), widgetSlot: false,
    about: 'a static figure (a deck asset) and cards that open step by step; a placeholder until its module is written (WP-20, last)',
    create: (slide, ctx) => createPlaceholderRenderer(slide, ctx),
  }),
});
