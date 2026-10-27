// @ts-check
// WP-20 (brief 04, moved here from prototypes/story-widgets after the visual acceptance there; the engine's own CSS is css/widgets.css): tree-grow, a taxonomy that grows one branch per step.
// Content here: the taxonomy of hybrid recommenders. Structure, node ids and the EN/TR node names follow the student
// site's taxonomy (hybrid.taxonomy.node.* in RS-lesson-material/outputs/i2rs-2627f/config/i18n/{en,tr}.json), one to one;
// the look, the colours and the type are ours (design-brief). The concepts are after Aggarwal (2016), ch. 6, redrawn.
//
// Kit shape (engine/widgets/kit.js): defineWidget({id, steps, params, build}); build(ctx, params) -> {steps: [{final(), plan()}]},
// states k = 0..n. The widget fills the slot of the widget-stage layout (ctx.slot, ctx.size); title, hook and the caption
// band belong to the layout. build() leaves the base DOM as the picture of state 0.
//
// States (default params): 1 the three families; 2 monolithic leaves; 3 the two ensemble branches; 4 sequential leaves and
// the dotted link with its note; 5 parallel leaves; 6 the highlighted leaves (the route is drawn root -> leaf, a ring on the nodes).
//
// duration(k) = planDuration(plan(k)); s = staggerMs, lag = popLagMs. A node starts at t0 = (its place in the press) * s and, WP-50, when its parent grows in the same press, at least chainMs after the
// parent's t0 (the press then grows from the top down; parents are listed first, `check` refuses the other order). With P = the last pop, max over the press of t0 + lag + popMs:
//   growth state     P (a press of m nodes with no parent inside it: (m-1)*s + lag + popMs)
//   ... that grows the link's origin  max(that, P + noteLagMs + noteMs, P + linkMs)
//   highlight state  (dmax-1)*routeStepMs + max(routeMs, ringLagMs + ringMs), dmax = depth of the deepest highlighted leaf
// Default numbers: 920 / 830 / 830 / 1530 / 830 / 1140 ms (measured: the browser reports the same).
// The summary page (`summary` below, four presses): 1780 / 1260 / 740 / 1140 ms (worked out by hand in tests/js/widgets-story.html: 520 + 520 + 740 = 1780 for the three levels of the first press).
//
// Motion: strokeDashoffset (edges draw), opacity + transform (nodes pop), clipPath (the dotted link wipes in).
// The emphasis is a second layer per node and a second path per edge that fade/draw over the first; no colour keyframes.
import { defineWidget } from './kit.js';
import { stepsFromFrames, h, s, fit } from './frames.js';
import { typePicto } from './pictos.js';

/** The slot the composition is drawn for, in stage px. The widget reads ctx.size and scales once when it differs. */
const W = 1680, H = 600;
/** One slot of 240 per leaf (seven leaves fill the width); a leaf is a card with the picture of its type above its name. */
const SLOT = 240, NODE_W = 200, ROOT_W = 280, ROOT_H = 72, BRANCH_H = 72, LEAF_H = 148;
/** A leaf that also carries a one-line "how it combines" (the flat form of Burke 2002) is taller. */
const LEAF_H_HOW = 232;
/**
 * The top of each depth's row, by the depth of the tree. The taxonomy of the textbook has three levels under the root: its deepest leaves
 * end at the slot's bottom edge (452 + 148 = 600). The flat form has one: the root and a single row of seven cards.
 */
const ROWS = /** @type {Record<number, number[]>} */ ({ 1: [30, 176], 2: [0, 150, 400], 3: [0, 128, 256, 452] });

const frag = (/** @type {string} */ en, /** @type {string} */ tr) => ({ en, tr });
const FRAGMENT = { type: 'object', required: ['en'], additionalProperties: true, properties: { en: { type: 'string' }, tr: { type: 'string' } } };
/** @param {Record<string, string>} d */
const fragSchema = (d) => ({ ...FRAGMENT, default: d });
const ms = (/** @type {number} */ d, min = 0) => ({ type: 'integer', minimum: min, default: d });

// Node ids and names: the student site's (hybrid.taxonomy.node.*.name), EN and TR verbatim.
const TREE = {
  id: 'root', label: frag('Hybrid systems', 'Hibrit sistemler'),
  children: [
    { id: 'monolithic', label: frag('Monolithic', 'Monolitik'), children: [
      { id: 'combination', label: frag('Feature combination', 'Özellik birleştirme') },
      { id: 'meta', label: frag('Meta-level', 'Meta-düzey') }] },
    { id: 'ensembles', label: frag('Ensembles', 'Topluluklar'), children: [
      { id: 'sequential', label: frag('Sequential', 'Ardışık'), children: [
        { id: 'augmentation', label: frag('Feature augmentation', 'Özellik artırma') },
        { id: 'cascade', label: frag('Cascade', 'Kademeli') }] },
      { id: 'parallel', label: frag('Parallel', 'Paralel'), children: [
        { id: 'weighted', label: frag('Weighted', 'Ağırlıklı') },
        { id: 'switching', label: frag('Switching', 'Geçişli') }] }] },
    { id: 'mixed', label: frag('Mixed', 'Karma') },
  ],
};

/**
 * The flat form (alternative B, D-093): the seven types in a plain row, no group above them, each with a "how it combines" line. After
 * Burke (2002), whose survey lists the seven hybridization methods this way; the citation is still being verified (content-agent, literature
 * round), so the page labels it so. The "how" lines are our own words, consistent with the student site's node tips. The same ids as the
 * taxonomy, so the same pictures and the same highlight.
 */
export const burke = {
  tree: {
    id: 'root', label: frag('Hybrid systems', 'Hibrit sistemler'),
    children: [
      { id: 'weighted', label: frag('Weighted', 'Ağırlıklı'), how: frag('Scores are added up with weights', 'Puanlar ağırlıklarla toplanır') },
      { id: 'switching', label: frag('Switching', 'Geçişli'), how: frag('A rule picks one recommender per case', 'Bir kural her durum için tek önericiyi seçer') },
      { id: 'mixed', label: frag('Mixed', 'Karma'), how: frag('Lists are shown together, none merged', 'Listeler birlikte gösterilir, hiçbiri birleşmez') },
      { id: 'combination', label: frag('Feature combination', 'Özellik birleştirme'), how: frag('All features feed one recommender', 'Bütün özellikler tek önericiye girer') },
      { id: 'cascade', label: frag('Cascade', 'Kademeli'), how: frag('Each one refines the previous list', 'Her biri öncekinin listesini inceltir') },
      { id: 'augmentation', label: frag('Feature augmentation', 'Özellik artırma'), how: frag("One's output becomes the next one's features", 'Birinin çıktısı ötekinin özelliği olur') },
      { id: 'meta', label: frag('Meta-level', 'Meta-düzey'), how: frag("One's model becomes the next one's input", 'Birinin modeli ötekinin girdisi olur') },
    ],
  },
  grow: [['weighted', 'switching', 'mixed'], ['combination', 'cascade', 'augmentation', 'meta']],
  highlight: ['weighted', 'combination'],
  link: { from: '', to: '' },
  figureLabel: frag(
    'The seven hybridization methods as a flat row under the root: weighted, switching, mixed, feature combination, cascade, feature augmentation and meta-level, each with a line on how it combines.',
    'Kökün altında düz bir sırada yedi hibritleme yöntemi: ağırlıklı, geçişli, karma, özellik birleştirme, kademeli, özellik artırma ve meta-düzey; her birinin nasıl birleştirdiğini söyleyen bir satırla.'),
};

/**
 * The summary page (s18 of the w06 deck): the whole tree in four presses, family by family. The first press grows the ensembles, their two branches and the four leaves under them (a parent and its
 * children in ONE press, parents listed first), the second the monolithic branch with its two leaves, the third the mixed leaf, the fourth rings the weighted leaf and draws its route.
 */
export const summary = {
  grow: [['ensembles', 'sequential', 'parallel', 'augmentation', 'cascade', 'weighted', 'switching'], ['monolithic', 'combination', 'meta'], ['mixed']],
  highlight: ['weighted'], link: { from: '', to: '' }, linkNote: { en: '' },
};

/** The params' JSON Schema, inside the subset of engine/widgets/params.js (the registry carries the same one). */
export const schema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    tree: {
      type: 'object', required: ['id', 'label'], additionalProperties: false, default: TREE, title: 'the taxonomy',
      description: 'A node is {id, label: {en, tr}, how?, picto?, children?}; leaves have no children and wear the picture named by `picto` (default: their id: combination, meta, augmentation, cascade, weighted, switching, mixed); `how` is a one-line "how it combines" under the name (the flat form). The widget checks the nested nodes (the schema subset cannot recurse); one to three levels under the root.',
      properties: { id: { type: 'string', minLength: 1 }, label: FRAGMENT, how: FRAGMENT, picto: { type: 'string' }, children: { type: 'array', items: { type: 'object' } } },
    },
    grow: {
      type: 'array', minItems: 1, items: { type: 'array', minItems: 1, items: { type: 'string' } }, title: 'one press per entry',
      description: 'The node ids that grow in each press. Every node but the root exactly once; a node grows in a press after the one of its parent, or in the SAME press when its parent is listed before it (then it grows from the top down, `chainMs` after the parent).',
      default: [['monolithic', 'ensembles', 'mixed'], ['combination', 'meta'], ['sequential', 'parallel'], ['augmentation', 'cascade'], ['weighted', 'switching']],
    },
    highlight: {
      type: 'array', items: { type: 'string' }, default: ['weighted', 'combination'], title: 'leaves emphasised in the last press',
      description: 'Leaf ids. The route from the root and a ring on the nodes mark them. An empty list drops the last press.',
    },
    link: {
      type: 'object', required: ['from', 'to'], additionalProperties: false, default: { from: 'augmentation', to: 'monolithic' }, title: 'the dotted line',
      description: 'A dotted line from node `from` (a leaf) to node `to`, drawn when `from` grows. An empty `from` draws none.',
      properties: { from: { type: 'string' }, to: { type: 'string' } },
    },
    linkNote: {
      ...FRAGMENT, title: 'what the dotted line means', default: frag(
        'Dotted: feature augmentation counts as monolithic when the next recommender has to be adapted.',
        'Noktalı çizgi: sonraki öneri sistemi uyarlanacaksa özellik artırma monolitik sayılır.'),
      description: 'Shortened from the site\'s hybrid.taxonomy.dotted.tip. Empty `en` shows no note.',
    },
    figureLabel: {
      ...FRAGMENT, title: 'the text alternative of the whole figure', default: frag(
        'The taxonomy of hybrid systems as a tree. Hybrid systems split into monolithic, ensembles and mixed. Monolithic holds feature combination and meta-level. Ensembles split into sequential (feature augmentation, cascade) and parallel (weighted, switching). A dotted line joins monolithic to feature augmentation.',
        'Hibrit sistemlerin ağaç olarak taksonomisi. Hibrit sistemler monolitik, topluluklar ve karma olarak ayrılır. Monolitik; özellik birleştirme ve meta-düzeyi içerir. Topluluklar ardışık (özellik artırma, kademeli) ve paralel (ağırlıklı, geçişli) olarak ayrılır. Noktalı bir çizgi monolitiği özellik artırmaya bağlar.'),
      description: 'The site\'s hybrid.taxonomy.figure_label, verbatim.',
    },
    staggerMs: ms(90), chainMs: ms(520), edgeMs: ms(520, 1), popLagMs: ms(360), popMs: ms(380, 1), linkMs: ms(600, 1), noteLagMs: ms(300), noteMs: ms(400, 1),
    routeStepMs: ms(260), routeMs: ms(420, 1), ringLagMs: ms(300), ringMs: ms(320, 1),
  },
};

/**
 * Number of presses for given params (the slide's `stepCount` must equal it; the kit checks): one per `grow` entry, plus one
 * for the highlight when `highlight` is not empty.
 * @param {{grow: string[][], highlight: string[]}} params
 */
const presses = (params) => params.grow.length + (params.highlight.length ? 1 : 0);

/** @typedef {{id: string, label: Record<string, string>, how: Record<string, string>|null, picto: string, depth: number, parent: string|null, leaf: boolean, cx: number, w: number, h: number, x: number, y: number}} Box */
/** @param {any} n @returns {number} the depth of the deepest node under n (n itself: 0) */
const treeDepth = (n) => (n && Array.isArray(n.children) && n.children.length ? 1 + Math.max(...n.children.map(treeDepth)) : 0);
/** @param {any} n @returns {boolean} whether a leaf under n carries a `how` line */
const anyHow = (n) => (n && Array.isArray(n.children) && n.children.length ? n.children.some(anyHow) : !!(n && n.how && n.how.en));
/** @param {any} tree @returns {Map<string, Box>} */
function layout(tree) {
  /** @type {Map<string, Box>} */
  const nodes = new Map();
  let slot = 0;
  const maxDepth = treeDepth(tree);
  const ROW_Y = ROWS[maxDepth];
  if (!ROW_Y) throw new TreeProblem('$.tree', `the tree has ${maxDepth} levels under the root, the widget draws 1 to 3`);
  const leafH = anyHow(tree) ? LEAF_H_HOW : LEAF_H;
  /** @param {any} n @param {number} depth @param {string|null} parent @param {string} path the node's own path in the params, for a problem @returns {number} the node's centre x */
  const walk = (n, depth, parent, path) => {
    if (!n || typeof n.id !== 'string' || !n.label || typeof n.label.en !== 'string') throw new TreeProblem(path, 'every node needs {id, label: {en}}');
    if (nodes.has(n.id)) throw new TreeProblem(`${path}.id`, `duplicate node id "${n.id}"`);
    if (n.children !== undefined && !Array.isArray(n.children)) throw new TreeProblem(`${path}.children`, `children of "${n.id}" must be a list of nodes, found ${JSON.stringify(n.children)}`);
    const kids = n.children ?? [];
    const cx = kids.length
      ? (() => { const xs = kids.map((/** @type {any} */ c, /** @type {number} */ i) => walk(c, depth + 1, n.id, `${path}.children[${i}]`)); return (xs[0] + xs[xs.length - 1]) / 2; })()
      : slot++ * SLOT + SLOT / 2;
    const w = depth === 0 ? ROOT_W : NODE_W;
    const leaf = !kids.length;
    nodes.set(n.id, { id: n.id, label: n.label, how: n.how && n.how.en ? n.how : null, picto: typeof n.picto === 'string' ? n.picto : n.id, depth, parent, leaf, cx, w, h: depth === 0 ? ROOT_H : leaf ? leafH : BRANCH_H, x: cx - w / 2, y: ROW_Y[depth] });
    return cx;
  };
  walk(tree, 0, null, '$.tree');
  if (slot * SLOT > W) throw new TreeProblem('$.tree', `${slot} leaves do not fit the slot (at most ${Math.floor(W / SLOT)})`);
  return nodes;
}

/** A problem of the params' tree that makes its boxes impossible to lay out, with the path of the node it is about (layout throws it, analyse reports it). */
class TreeProblem extends Error {
  /** @param {string} path @param {string} message */
  constructor(path, message) { super(message); this.path = path; }
}

/**
 * WP-50 (lead, 2026-10-25): everything the picture needs from the params and the schema subset cannot say, worked out ONCE and without a DOM: the boxes of the nodes, the press each node
 * grows in and its place in that press, and what is wrong (the list `checkParams` returns, so the build's node script, the deck loader and the harness refuse the same params with the same
 * sentence; build() does not check again). A node grows in a press that is later than its parent's, or in the SAME press when the parent is listed before it (the page of the summary grows a
 * family, its branches and its leaves in one press, from the top down).
 * @param {any} P the params with the schema's defaults filled in
 * @returns {{nodes: Map<string, Box>, appear: Map<string, number>, order: Map<string, number>, problems: Array<{path: string, detail: string}>}}
 */
function analyse(P) {
  /** @type {Array<{path: string, detail: string}>} */ const problems = [];
  const bad = (/** @type {string} */ path, /** @type {string} */ detail) => { problems.push({ path, detail }); };
  /** @type {Map<string, Box>} */ let nodes = new Map();
  try { nodes = layout(P.tree); } catch (e) { if (e instanceof TreeProblem) bad(e.path, e.message); else throw e; }
  const rootId = P.tree?.id;
  /** @type {Map<string, number>} */ const appear = new Map([[rootId, 0]]);
  /** @type {Map<string, number>} */ const order = new Map([[rootId, -1]]);
  if (nodes.size === 0) return { nodes, appear, order, problems };          // no boxes, nothing else to say about them
  /** @type {string[][]} */ const grow = P.grow;
  grow.forEach((ids, j) => ids.forEach((nid, i) => {
    const at = `$.grow[${j}][${i}]`;
    if (!nodes.has(nid)) { bad(at, `names unknown node "${nid}"`); return; }
    if (nid === rootId) { bad(at, `"${nid}" is the root: it is there from the start and is never grown`); return; }
    if (appear.has(nid)) { bad(at, `node "${nid}" is grown twice (press ${appear.get(nid)} and press ${j + 1})`); return; }
    appear.set(nid, j + 1); order.set(nid, i);
  }));
  for (const nd of nodes.values()) {
    if (nd.parent === null) continue;
    const j = appear.get(nd.id);
    if (j === undefined) { bad('$.grow', `node "${nd.id}" is never grown`); continue; }
    const pj = appear.get(nd.parent);
    if (pj === undefined) continue;                                         // the parent's own problem is reported on the parent
    const at = `$.grow[${j - 1}][${order.get(nd.id)}]`;
    if (pj > j) bad(at, `"${nd.id}" is grown in press ${j}, before its parent "${nd.parent}" (press ${pj}): a node grows in a press after its parent's, or in the same press with the parent listed first`);
    else if (pj === j && /** @type {number} */ (order.get(nd.parent)) > /** @type {number} */ (order.get(nd.id))) bad(at, `"${nd.id}" is listed before its parent "${nd.parent}" in press ${j}: list the parent first`);
  }
  P.highlight.forEach((/** @type {string} */ leaf, /** @type {number} */ i) => { if (!nodes.has(leaf)) bad(`$.highlight[${i}]`, `names unknown node "${leaf}"`); });
  if (P.link.from) {
    const f = nodes.get(P.link.from), to = nodes.get(P.link.to);
    if (!f || !to) bad('$.link', `names an unknown node (from "${P.link.from}", to "${P.link.to}"): a tree of your own needs its own link, or {"from": ""} for no dotted line (the default one belongs to the taxonomy)`);
    else if (!f.leaf) bad('$.link.from', 'the dotted line starts at a leaf');
  }
  return { nodes, appear, order, problems };
}

export default defineWidget({
  id: 'tree-grow',
  steps: 'Each press grows one branch of the tree (default: the three families, the monolithic leaves, the two ensemble branches, the sequential leaves with the dotted line, the parallel leaves); the last press, when `highlight` names leaves, draws the route to them and rings them.',
  params: schema,
  stepCount: presses,
  check: (params) => analyse(params).problems,
  // The params the widget is shown with (the harness builds a slide from each): the lecture's tree, the same tree without the last press and the dotted line, the flat form (alternative B), and the summary page (a family, its branches and its leaves grow in ONE press).
  examples: [{}, { highlight: [], link: { from: '', to: '' } }, burke, summary],
  build(ctx, P) {
    const doc = ctx.slot.ownerDocument;
    // the boxes, the press each node grows in and its place in the press: analyse() (the kit has already refused params it found wrong, through `check`: nothing is checked again here)
    const { nodes, appear } = analyse(P);
    const rootId = P.tree.id;
    /** @type {string[][]} */
    const grow = P.grow;

    // Emphasis: the highlighted leaves and the nodes on their way up to the root.
    /** @type {Set<string>} */
    const route = new Set();
    for (const leaf of P.highlight) {
      for (let nd = nodes.get(leaf); nd && nd.parent !== null; nd = nodes.get(nd.parent)) route.add(nd.id);
    }
    const focusStep = P.highlight.length ? grow.length + 1 : 0;
    const n = presses(P);

    // ---------- DOM ----------
    const root = h(doc, 'div', 'w-root tg-root', { role: 'img', 'aria-label': ctx.text(P.figureLabel) });
    root.style.cssText = `width:${W}px;height:${H}px`;
    const sc = fit(ctx, W, H);
    if (Math.abs(sc - 1) > 0.001) root.style.transform = `scale(${sc})`;
    const svg = s(doc, 'svg', { class: 'tg-edges', width: String(W), height: String(H), viewBox: `0 0 ${W} ${H}`, 'aria-hidden': 'true' });
    const nodeLayer = h(doc, 'div', 'tg-nodes', { 'aria-hidden': 'true' });
    root.append(svg, nodeLayer);
    /** @type {Map<string, Element>} */
    const els = new Map();

    /** @type {Array<[Box, Box]>} */
    const edges = [];
    for (const nd of nodes.values()) if (nd.parent !== null) edges.push([/** @type {Box} */ (nodes.get(nd.parent)), nd]);
    /** @param {Box} p @param {Box} c */
    const elbow = (p, c) => { const y0 = p.y + p.h, mid = y0 + (c.y - y0) / 2; return `M${p.cx} ${y0}V${mid}H${c.cx}V${c.y}`; };
    for (const [p, c] of edges) {
      const base = s(doc, 'path', { class: 'tg-edge', d: elbow(p, c), pathLength: '1', 'data-gfx': 'stroke', 'data-key': `e:${c.id}` });
      svg.append(base);
      els.set(`e:${c.id}`, base);
    }
    for (const [p, c] of edges) {
      if (!route.has(c.id)) continue;
      const over = s(doc, 'path', { class: 'tg-edge tg-route', d: elbow(p, c), pathLength: '1', 'data-gfx': 'stroke', 'data-key': `er:${c.id}` });
      svg.append(over);
      els.set(`er:${c.id}`, over);
    }

    for (const nd of nodes.values()) {
      const kind = nd.parent === null ? 'root' : nd.leaf ? 'leaf' : 'branch';
      const box = h(doc, 'div', `tg-node tg-${kind}`, { 'data-key': `n:${nd.id}`, 'data-node': nd.id });
      box.style.cssText = `left:${nd.x}px;top:${nd.y}px;width:${nd.w}px;height:${nd.h}px`;
      const pic = nd.leaf ? typePicto(doc, nd.picto) : null;       // a leaf wears the picture of its type; a branch only its name
      const base = h(doc, 'div', `tg-layer tg-base ${kind}${pic ? ' has-picto' : ''}`);
      if (pic) base.append(pic);
      const lbl = h(doc, 'span', 'tg-lbl', kind === 'root' ? {} : { 'data-role': 'term' });
      ctx.setText(lbl, nd.label);
      base.append(lbl);
      if (nd.how) { const how = h(doc, 'span', 'tg-how'); ctx.setText(how, nd.how); base.append(how); }
      box.append(base);
      els.set(`n:${nd.id}`, box);
      if (route.has(nd.id)) {
        const focus = h(doc, 'div', `tg-layer tg-focus${pic ? ' has-picto' : ''}`, { 'aria-hidden': 'true', 'data-key': `nf:${nd.id}` });
        const picF = nd.leaf ? typePicto(doc, nd.picto) : null;
        if (picF) focus.append(picF);
        const fl = h(doc, 'span', 'tg-lbl', { 'data-role': 'emph' });
        ctx.setText(fl, nd.label);
        focus.append(fl);
        if (nd.how) { const how = h(doc, 'span', 'tg-how'); ctx.setText(how, nd.how); focus.append(how); }
        box.append(focus);
        els.set(`nf:${nd.id}`, focus);
      }
      nodeLayer.append(box);
    }

    // The dotted line: from the left edge of `link.from`, along the corridor between it and its left neighbour, up to the
    // right edge of `link.to` (the taxonomy marks "feature augmentation may become monolithic" this way); then its note.
    const link = P.link.from ? P.link : null;
    const linkStep = link ? appear.get(link.from) : undefined;
    const note = link && P.linkNote.en ? P.linkNote : null;
    if (link) {
      const f = /** @type {Box} */ (nodes.get(link.from)), t = /** @type {Box} */ (nodes.get(link.to));
      const leaves = [...nodes.values()].filter((x) => x.leaf).sort((a, b) => a.cx - b.cx);
      const left = leaves[leaves.indexOf(f) - 1];
      const corridor = left ? (left.x + left.w + f.x) / 2 : f.x - 20;
      const fy = f.y + f.h / 2, ty = t.y + t.h / 2, tx = t.x + t.w;
      const pad = 8, x0 = Math.min(tx, corridor) - pad, y0 = Math.min(fy, ty) - pad;
      const bw = f.x - x0 + pad, bh = Math.max(fy, ty) - y0 + pad;
      const wrap = h(doc, 'div', 'tg-link', { 'data-key': 'lk', 'aria-hidden': 'true' });
      wrap.style.cssText = `left:${x0}px;top:${y0}px;width:${bw}px;height:${bh}px`;
      const sv = s(doc, 'svg', { width: String(bw), height: String(bh) });
      sv.append(s(doc, 'path', { class: 'tg-dots', d: `M${f.x - x0} ${fy - y0}H${corridor - x0}V${ty - y0}H${tx - x0}`, 'data-gfx': 'stroke', 'data-key': 'lk-path' }));
      wrap.append(sv);
      nodeLayer.append(wrap);
      els.set('lk', wrap);
      if (note) {
        const ln = h(doc, 'div', 'tg-note', { 'data-key': 'ln' });
        ln.style.cssText = `left:20px;top:${fy - 60}px;width:${Math.max(200, corridor - 44)}px`;
        ctx.setText(ln, note);
        nodeLayer.append(ln);
        els.set('ln', ln);
      }
    }

    // ---------- frames and timing ----------
    const depthOf = (/** @type {string} */ nid) => /** @type {Box} */ (nodes.get(nid)).depth;
    const frame = (/** @type {number} */ k) => {
      /** @type {Map<string, Record<string, string>>} */
      const m = new Map();
      for (const nd of nodes.values()) {
        const shown = k >= /** @type {number} */ (appear.get(nd.id));
        m.set(`n:${nd.id}`, shown ? { opacity: '1', transform: 'translateY(0px) scale(1)' } : { opacity: '0', transform: 'translateY(-14px) scale(0.92)' });
        if (nd.parent !== null) m.set(`e:${nd.id}`, { strokeDashoffset: shown ? '0' : '1.02' });
        if (route.has(nd.id)) {
          const lit = focusStep > 0 && k >= focusStep;
          m.set(`nf:${nd.id}`, { opacity: lit ? '1' : '0' });
          m.set(`er:${nd.id}`, { strokeDashoffset: lit ? '0' : '1.02' });
        }
      }
      if (link) {
        const on = k >= /** @type {number} */ (linkStep);
        m.set('lk', { opacity: '1', clipPath: on ? 'inset(0% 0% 0% 0%)' : 'inset(100% 0% 0% 0%)' });
        if (note) m.set('ln', on ? { opacity: '1', transform: 'translateY(0px)' } : { opacity: '0', transform: 'translateY(10px)' });
      }
      return m;
    };
    /**
     * When node `nid` starts to grow in press k: after the stagger of its place in the press, and, when its parent grows in the same press, chainMs after the parent started (from the top down).
     * @param {number} k @param {string} nid @returns {number} ms
     */
    const startOf = (k, nid) => {
      const nd = /** @type {Box} */ (nodes.get(nid));
      const own = grow[k - 1].indexOf(nid) * P.staggerMs;
      return nd.parent !== null && appear.get(nd.parent) === k ? Math.max(own, startOf(k, nd.parent) + P.chainMs) : own;
    };
    /** @param {string} key @param {number} k */
    const timing = (key, k) => {
      const name = key.slice(key.indexOf(':') + 1);
      if (focusStep && k === focusStep) {
        const d = depthOf(name);
        if (key.startsWith('er:')) return { start: (d - 1) * P.routeStepMs, duration: P.routeMs };
        return { start: (d - 1) * P.routeStepMs + P.ringLagMs, duration: P.ringMs };
      }
      const G = grow[k - 1];
      const lead = Math.max(...G.map((nid) => startOf(k, nid) + P.popLagMs + P.popMs));       // the last node has popped
      if (key === 'lk') return { start: lead, duration: P.linkMs };
      if (key === 'ln') return { start: lead + P.noteLagMs, duration: P.noteMs };
      const at = startOf(k, name);
      return key.startsWith('e:') ? { start: at, duration: P.edgeMs } : { start: at + P.popLagMs, duration: P.popMs };
    };

    ctx.slot.append(root);
    const steps = stepsFromFrames({ n, els, frame, timing, easing: ctx.defaults.easing });
    steps[0].final();                                                          // the base DOM is the picture of state 0
    return { steps, destroy: () => root.remove() };
  },
});
