// @ts-check
// WP-20: the table of widgets: id -> entry (widgets/kit.js defineWidget or placeholderWidget). The ids, the params schemas and the `steps` lines are the registry's
// (engine/registry.json), which the build checks decks against; tests/js/registry-sync.test.mjs holds the two equal. A widget module is
// `engine/widgets/<id>.js` with `export default defineWidget({...})` (written by slide-ui-agent from its prototypes); when it arrives, an `import` and a line go here
// and its entry goes into registry.json (slide-code-agent, one writer per file).
// WP-20 (2026-10-25, lead's order): tree-grow, table-highlight, pipeline and compare moved here from prototypes/story-widgets; slide-ui-agent holds this file and the widgets
// part of registry.json for that move. The support modules (frames.js: the pure-frame helper every story widget is built on; pictos.js: the pictures; table-matrix.js and
// pipeline-switch.js: the extra modes of table-highlight and pipeline) are not widgets and are not listed.
import { placeholderWidget } from './kit.js';
import treeGrow from './tree-grow.js';
import tableHighlight from './table-highlight.js';
import pipeline from './pipeline.js';
import compare from './compare.js';
import chartDraw from './chart-draw.js';       // WP-50 (D-112): the fifth widget of the w06 deck; its modes are support modules (chart-vote.js)

/** @type {Readonly<Record<string, Readonly<import('./kit.js').WidgetEntry>>>} */
export const WIDGETS = Object.freeze({
  'scatter-fit': placeholderWidget({
    id: 'scatter-fit',
    params: {},
    steps: "placeholder until WP-20: the real widget and its params JSON Schema arrive with the widget framework; listed now so the mini fixture passes the build's id check",
  }),
  [treeGrow.id]: treeGrow,
  [tableHighlight.id]: tableHighlight,
  [pipeline.id]: pipeline,
  [compare.id]: compare,
  [chartDraw.id]: chartDraw,
});
