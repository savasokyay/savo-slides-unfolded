// @ts-check
// WP-168a: the plain logic of the neural page's network diagram (components/network-panel.js draws it): which column a stage stands in, where a box lies, where an edge starts and
// ends, how a title or a name is cut to the room a box has, what an `input` stage (the user's and the film's index, the two boxes at the left) shows, the scale the bars share, and the
// union of the boxes a step lights. Checked under node against values worked out by hand (tests/app/js/network_layout_check.mjs); the DOM shell is the panel.

export const BOX_W = 118;
// WP-168a: a box has room for a TWO-line title (the branch of an embedding table: "user embedding" / "(GMF)"): the second line puts the meta line at 39 and the highest bar (28 units above
// the baseline at box height - 12) starts at 82 - 12 - 28 = 42. The height is as small as that allows: on a normal page the diagram is fitted by its WIDTH, but in presenting mode the tab is
// wide and short and the fit is by HEIGHT, so every unit of box height there is paid for in text size (measured: a box of 86 cost 0.5 px of title size).
export const BOX_H = 82;
// the gap between columns: 34 (was 42). The id column the diagram gained costs width, and the text scale is the tab's width over the drawing's: the user chose 8 units less per gap
// (2026-10-12) to keep the title text at about 7.15 px on a 1536 x 864 page (6.84 px at 42).
export const GAP_X = 34;
export const GAP_Y = 12;
export const PAD = 14;
/** the room a line of text has inside a box (the box's width less a margin on each side) */
export const TEXT_W = BOX_W - 12;
/** the vertical step of a line of text in a box (title, name) */
export const LINE_H = 11;

/**
 * Longest-path depth of every stage from the sources (the wiring is a DAG): a stage with no incoming edge is at depth 0.
 * @param {{id: string}[]} layers
 * @param {[string, string][]} edges
 * @returns {Map<string, number>}
 */
export function stageDepths(layers, edges) {
  /** @type {Map<string, number>} */
  const depth = new Map();
  const ids = layers.map((l) => l.id);
  /** @type {Map<string, string[]>} */
  const incoming = new Map(ids.map((id) => [id, []]));
  for (const [from, to] of edges || []) incoming.get(to)?.push(from);
  /** @param {string} id @returns {number} */
  const visit = (id) => {
    const known = depth.get(id);
    if (known !== undefined) return known;
    const parents = incoming.get(id) || [];
    const d = parents.length ? Math.max(...parents.map((p) => visit(p))) + 1 : 0;
    depth.set(id, d);
    return d;
  };
  for (const id of ids) visit(id);
  return depth;
}

/**
 * The grid of the diagram: one column per depth, the boxes of a column stacked in the order of the layers and centred on the tallest column.
 * @param {{id: string}[]} layers
 * @param {[string, string][]} edges
 * @returns {{width: number, height: number, nCols: number, columns: Map<number, string[]>, pos: Map<string, {x: number, y: number}>}}
 */
export function layoutNetwork(layers, edges) {
  const depth = stageDepths(layers, edges);
  /** @type {Map<number, string[]>} */
  const columns = new Map();
  for (const layer of layers) {
    const d = depth.get(layer.id) ?? 0;
    const column = columns.get(d);
    if (column) column.push(layer.id);
    else columns.set(d, [layer.id]);
  }
  const nCols = Math.max(...columns.keys()) + 1;
  const maxRows = Math.max(...[...columns.values()].map((c) => c.length));
  const width = PAD * 2 + nCols * BOX_W + (nCols - 1) * GAP_X;
  const height = PAD * 2 + maxRows * BOX_H + (maxRows - 1) * GAP_Y;
  /** @type {Map<string, {x: number, y: number}>} */
  const pos = new Map();
  for (const [d, ids] of columns) {
    const colHeight = ids.length * BOX_H + (ids.length - 1) * GAP_Y;
    const top = PAD + (height - 2 * PAD - colHeight) / 2;
    ids.forEach((id, r) => pos.set(id, { x: PAD + d * (BOX_W + GAP_X), y: top + r * (BOX_H + GAP_Y) }));
  }
  return { width, height, nCols, columns, pos };
}

/**
 * WP-222 (the feature network): the geometry of a drawing - the size of a box and the room between boxes. The default is the neural page's own (the constants above); the feature network
 * has sixteen stages and gets a COMPACT one (see `layoutTwoSided`): narrower boxes, a second line for the details, so the whole drawing is as wide as the tab and its text is not shrunk.
 * @typedef {{boxW: number, boxH: number, gapX: number, gapY: number, pad: number, textW: number, metaLines: number, lineH: number, metaH: number}} NetGeo `lineH` the step of a title's lines, `metaH` the step
 * of the details' lines (a 10.5-unit title is 12.3 high as a text box and a 9-unit detail 12.1: lines 11 apart overlap their boxes by a unit, glyphs do not touch; the compact drawing steps 13 / 12.5 so the boxes do not meet either; 14 / 13.5 now: measured, the text boxes are 13.2 high in the page's own font and 14.2 in a fallback one)
 */
/** @type {NetGeo} */
export const DEFAULT_GEO = { boxW: BOX_W, boxH: BOX_H, gapX: GAP_X, gapY: GAP_Y, pad: PAD, textW: TEXT_W, metaLines: 1, lineH: LINE_H, metaH: LINE_H };
/** @type {NetGeo} the feature network's: 7 columns of 96 are 760 units wide (the tab inside is 704 px at 1536 -> 0.93x: the 9-unit details are 8.3 px, their text boxes 11 px), 4 rows of 98 (a two-line title at 14 apart, two lines of details, the bars) */
export const COMPACT_GEO = { boxW: 96, boxH: 98, gapX: 12, gapY: 10, pad: 8, textW: 84, metaLines: 2, lineH: 14, metaH: 13.5 };

/**
 * Where an edge starts and ends. Normally from the right-hand side of the source box at its middle to the left-hand side of the target box at its middle (so one source with two
 * targets - an id input feeding two embedding tables - fans out from one point). WP-222: in a two-sided drawing the target can also lie to the LEFT of its source (the film's side flows
 * right to left: left-hand side to right-hand side) or in the same column (a chain that turns down: bottom to top).
 * @param {{x: number, y: number}} a the source box
 * @param {{x: number, y: number}} b the target box
 * @param {NetGeo} [geo]
 * @returns {{x1: number, y1: number, x2: number, y2: number}}
 */
export function edgeEnds(a, b, geo = DEFAULT_GEO) {
  const { boxW, boxH } = geo;
  if (b.x >= a.x + boxW) return { x1: a.x + boxW, y1: a.y + boxH / 2, x2: b.x, y2: b.y + boxH / 2 };
  if (b.x + boxW <= a.x) return { x1: a.x, y1: a.y + boxH / 2, x2: b.x + boxW, y2: b.y + boxH / 2 };
  return b.y >= a.y
    ? { x1: a.x + boxW / 2, y1: a.y + boxH, x2: b.x + boxW / 2, y2: b.y }
    : { x1: a.x + boxW / 2, y1: a.y, x2: b.x + boxW / 2, y2: b.y + boxH };
}

/**
 * WP-222: which side of a two-sided drawing a stage belongs to - the engine names the user's stages `user_...` and the film's `item_...` (ids, embeddings, towers, side features);
 * everything else (the concatenation and the layers after it) is the middle.
 * @param {{id: string}} layer
 * @returns {"user" | "item" | "mid"}
 */
export function stageSide(layer) {
  return layer.id.startsWith("user_") ? "user" : layer.id.startsWith("item_") ? "item" : "mid";
}

/**
 * WP-222: the feature network's drawing - the user's stages on the LEFT flowing right, the film's on the RIGHT flowing left, meeting in one box in the middle (the concatenation), with
 * the layers after it as a row of their own under it. Each side is a stack of CHAINS (a chain is a run of stages joined by edges within the side: the id and its embedding; the
 * features and their tower; a side feature that feeds the middle directly), in the order the engine lists them, so a tower is one straight row and the two sides mirror each other. A
 * chain's stages stand in the columns of their depth; a side feature that feeds only the middle is pulled up to the side's last column (next to its consumer, not at the far edge).
 * The middle's first stage stands at the middle row; the stages after it run along the bottom row from the middle column to the right (edges turn down out of the join).
 * Returns null when the wiring is not of that shape (no stage on a side, no join in the middle): the caller keeps the plain grid.
 * @param {{id: string}[]} layers
 * @param {[string, string][]} edges
 * @param {NetGeo} [geo]
 * @returns {{width: number, height: number, nCols: number, pos: Map<string, {x: number, y: number}>, geo: NetGeo} | null}
 */
export function layoutTwoSided(layers, edges, geo = COMPACT_GEO) {
  const side = new Map(layers.map((l) => [l.id, stageSide(l)]));
  const depth = stageDepths(layers, edges);
  const ofSide = (/** @type {"user" | "item"} */ s) => layers.filter((l) => side.get(l.id) === s);
  const mid = layers.filter((l) => side.get(l.id) === "mid").sort((p, q) => (depth.get(p.id) ?? 0) - (depth.get(q.id) ?? 0));
  if (!ofSide("user").length || !ofSide("item").length || !mid.length) return null;
  const consumers = (/** @type {string} */ id) => edges.filter(([from]) => from === id).map(([, to]) => to);
  /** columns of a side: the depth of its stages, a source that feeds only the middle pulled to the last @param {"user" | "item"} s */
  const sideColumns = (s) => {
    const own = ofSide(s);
    const hasParent = new Set(edges.map(([, to]) => to));
    const pulled = (/** @type {{id: string}} */ l) => !hasParent.has(l.id) && consumers(l.id).length > 0 && consumers(l.id).every((to) => side.get(to) === "mid");
    const last = Math.max(0, ...own.filter((l) => !pulled(l)).map((l) => depth.get(l.id) ?? 0));
    return new Map(own.map((l) => [l.id, pulled(l) ? last : (depth.get(l.id) ?? 0)]));
  };
  const userCols = sideColumns("user");
  const itemCols = sideColumns("item");
  const sideWidth = Math.max(...userCols.values(), ...itemCols.values()) + 1;
  /** the rows of a side: its chains (stages joined by edges inside the side), in the order of the engine's list @param {"user" | "item"} s */
  const chainsOf = (s) => {
    const own = ofSide(s).map((l) => l.id);
    /** @type {Map<string, string>} */
    const root = new Map(own.map((id) => [id, id]));
    const find = (/** @type {string} */ id) => {
      while (root.get(id) !== id) id = /** @type {string} */ (root.get(id));
      return id;
    };
    for (const [from, to] of edges) if (root.has(from) && root.has(to)) root.set(find(from), find(to));
    /** @type {Map<string, string[]>} */
    const groups = new Map();
    for (const id of own) groups.set(find(id), [...(groups.get(find(id)) || []), id]);
    return [...groups.values()];
  };
  const userChains = chainsOf("user");
  const itemChains = chainsOf("item");
  const sideRows = Math.max(userChains.length, itemChains.length);
  const nCols = 2 * sideWidth + 1;
  const tail = mid.slice(1);
  if (tail.length > sideWidth + 1) return null; // the bottom row would not fit the width
  const nRows = sideRows + (tail.length ? 1 : 0);
  const step = geo.boxH + geo.gapY;
  /** @type {Map<string, {x: number, y: number}>} */
  const pos = new Map();
  const at = (/** @type {number} */ col, /** @type {number} */ row) => ({ x: geo.pad + col * (geo.boxW + geo.gapX), y: geo.pad + row * step });
  userChains.forEach((chain, row) => chain.forEach((id) => pos.set(id, at(userCols.get(id) ?? 0, row))));
  itemChains.forEach((chain, row) => chain.forEach((id) => pos.set(id, at(2 * sideWidth - (itemCols.get(id) ?? 0), row))));
  pos.set(mid[0].id, at(sideWidth, (sideRows - 1) / 2));
  tail.forEach((layer, k) => pos.set(layer.id, at(sideWidth + k, sideRows)));
  const width = geo.pad * 2 + nCols * geo.boxW + (nCols - 1) * geo.gapX;
  const height = geo.pad * 2 + nRows * geo.boxH + (nRows - 1) * geo.gapY;
  return { width, height, nCols, pos, geo };
}

/**
 * WP-199: whether a stage is one of the content page's per-user network (the engine's label keys `layer.cb_terms`, `layer.cb_hidden`, `layer.cb_output`). Its `input` stage is NOT an id
 * like the neural page's two: it is the target film's TF-IDF row (its terms, scaled to length 1), drawn with bars like every other stage that holds numbers.
 * @param {{label_key?: string}} layer
 * @returns {boolean}
 */
export function isCbStage(layer) {
  return typeof layer.label_key === "string" && layer.label_key.startsWith("layer.cb_");
}

/**
 * The largest magnitude the bars are scaled to. An `input` stage holds a row number (the table row the id looks up), not an activation: it has no bars and must not set the scale
 * (a row number of 4000 would flatten every real bar). WP-199: the content network's input holds the film's term values, which are bars like the others.
 * @param {{kind: string, label_key?: string, values?: number[]}[]} layers
 * @returns {number}
 */
export function barExtent(layers) {
  return Math.max(1e-9, ...layers.filter((l) => l.kind !== "input" || isCbStage(l)).flatMap((l) => (l.values || []).map((v) => Math.abs(v))));
}

/**
 * A text cut to a width: kept whole when it fits; else the end is replaced by "…". A trailing " (year)" of a film title is kept (the year tells films of one name apart) and the name
 * before it gives way.
 * @param {string} text
 * @param {number} maxWidth
 * @param {(s: string) => number} measure the width of a string in the box's font
 * @returns {string}
 */
export function fitText(text, maxWidth, measure) {
  if (measure(text) <= maxWidth) return text;
  const year = /\s\(\d{4}\)$/.exec(text);
  const tail = year ? `…${year[0]}` : "…";
  const head = year ? text.slice(0, year.index) : text;
  for (let n = head.length - 1; n > 0; n--) {
    const cut = `${head.slice(0, n).trimEnd()}${tail}`;
    if (measure(cut) <= maxWidth) return cut;
  }
  return tail;
}

/**
 * A text laid in up to `maxLines` lines of at most `maxWidth`: words are taken greedily, a line break falls before a word that does not fit (a "(GMF)" tag therefore stands on its
 * own second line); the last line is cut with "…" when the text still does not fit.
 * @param {string} text
 * @param {number} maxWidth
 * @param {(s: string) => number} measure
 * @param {number} [maxLines]
 * @returns {string[]}
 */
export function wrapLines(text, maxWidth, measure, maxLines = 2) {
  const words = String(text).split(/\s+/).filter(Boolean);
  if (!words.length) return [""];
  /** @type {string[]} */
  const lines = [];
  let line = "";
  let i = 0;
  for (; i < words.length; i++) {
    const next = line ? `${line} ${words[i]}` : words[i];
    if (!line || measure(next) <= maxWidth) {
      line = next;
      continue;
    }
    if (lines.length === maxLines - 1) break; // the last line takes the rest of the text
    lines.push(line);
    line = words[i];
  }
  if (i < words.length) line = [line, ...words.slice(i)].join(" "); // (cut below)
  lines.push(fitText(line, maxWidth, measure));
  return lines;
}

/** WP-168b: the role an id input stands for - the engine's two input stages are the user's and the film's index (`user_id`, `item_id`) */
export const INPUT_ROLE = { user_id: "user", item_id: "item" };

/**
 * WP-168b: the role of an `input` stage (its box wears that role's colour: the users' red, the films' blue); null for every other stage and for an input the table does not know.
 * @param {{id: string, kind: string}} layer
 * @returns {"user" | "item" | null}
 */
export function inputRole(layer) {
  if (layer.kind !== "input") return null;
  const role = /** @type {Record<string, "user" | "item">} */ (INPUT_ROLE)[layer.id];
  return role ?? null;
}

/**
 * What an `input` stage shows below its title: the name of the user / film the index stands for (the engine's `detail`), cut to the box, and the index itself ("#3", the row of
 * the embedding tables the id looks up). A stage with no name shows the index alone, as its value.
 * @param {{values?: number[], detail?: string | null}} layer
 * @param {(s: string) => number} measure width in the font of the value line
 * @param {number} [maxWidth]
 * @returns {{value: string[], index: string | null}} the lines of the value (the name; the index alone when there is no name) and the index line (null when it is the value)
 */
export function inputCaption(layer, measure, maxWidth = TEXT_W) {
  const raw = layer.values?.[0];
  const index = typeof raw === "number" && Number.isFinite(raw) ? `#${Math.round(raw)}` : null;
  const name = typeof layer.detail === "string" ? layer.detail.trim() : "";
  if (!name) return { value: index ? [index] : [], index: null };
  return { value: wrapLines(name, maxWidth, measure, 2), index };
}

/**
 * The smallest rectangle that holds all the given ones (the boxes a step lights: an id input and the table it indexes).
 * @param {{top: number, bottom: number, left: number, right: number}[]} rects
 * @returns {{top: number, bottom: number, left: number, right: number} | null} null when there is none
 */
export function unionRect(rects) {
  if (!rects.length) return null;
  return {
    top: Math.min(...rects.map((r) => r.top)),
    bottom: Math.max(...rects.map((r) => r.bottom)),
    left: Math.min(...rects.map((r) => r.left)),
    right: Math.max(...rects.map((r) => r.right)),
  };
}

// -- WP-245: the feature network drawn from the top down ------------------------------------------------------------------------------------------------------------------
// The two-sided drawing (`layoutTwoSided`, WP-222) is 689 x 397 units: far wider than the flowchart column it now lives in (467 px) and read as "sideways and arrows mixed up" by the
// reader. The vertical drawing is as wide as that column: ONE COLUMN PER TOWER - the user's id and its embedding, the user's taste profile and its tower, the film's content and its
// tower, the film's id and its embedding - the user's columns on the left, the film's on the right (mirrored, so the two towers stand side by side in the middle), the inputs at the top
// and each column running down its own stages. Below them the join: the user's statistics and the film's numbers have NO tower, so they stand as boxes at the two sides of the join and
// enter it with a short horizontal arrow; every tower enters it from above with ONE arrow. The layers after the join are a narrow stack below it, the output last. Every arrow is a
// straight vertical or horizontal line, except that a column standing outside the join's width turns in under the towers (down, along, down) - right angles only, no crossings.

/**
 * @typedef {{x: number, y: number, w: number, h: number, mode: "column" | "flank" | "slim"}} VBox the box of a stage: a tower column's (`column`), the join row's side input (`flank`: the
 *   same box as a column's, wider) or a slim one of the stack from the join down (`slim`: the name and the details at the left, the bars at the right)
 * @typedef {NetGeo & {barMax: number, baseGap: number, flankW: number, flankH: number, slimH: number, busGap: number, flankGap: number, tailGap: number, minW: number, maxTailW: number, titleLines: number}} VerticalGeo
 *   `barMax`, `baseGap` the tallest bar and the bars' baseline above the box's bottom; `flankW` / `flankH` the side input's width and height (two title lines: 15, 29, the details at 42, bars 12 high from the baseline 8 up: 66); `slimH` the height of a slim box; `busGap` the room between the last
 *   row of the towers and the join (where a turning arrow runs along); `flankGap` the arrow between a side input and the join; `tailGap` between the stack's boxes; `minW` the narrowest
 *   drawing (an ids-only network has two columns: it is centred, not stretched); `maxTailW` the widest the join and the stack are drawn when nothing stands beside the join; `titleLines`
 *   the most lines a title takes in a column (the Turkish "filmin terimleri (TF-IDF)" needs three at this width)
 */
/** @type {VerticalGeo} 4 columns of 100 are 440 units wide (the flowchart column's body is ~450 px: 1.0x); a column box holds a three-line title (15, 29, 43), the details under it (58 at
 * the lowest) and bars at most 12 high above the baseline 8 from the bottom (80 - 8 - 12 = 60); the gaps between boxes are 10 (an arrow's head is ~10 long and sits half over its box); a slim
 * box is 34 high (the name and `|θ|` on the first line, the details and 10-unit bars on the second) */
export const VERTICAL_GEO = { boxW: 100, boxH: 80, gapX: 8, gapY: 10, pad: 8, textW: 88, metaLines: 2, lineH: 14, metaH: 13.5, barMax: 12, baseGap: 8, flankW: 118, flankH: 66, slimH: 34, busGap: 12, flankGap: 18, tailGap: 10, minW: 300, maxTailW: 200, titleLines: 3 };

/**
 * The chains of one side - runs of stages joined by edges inside the side (the id and its embedding; the features and their tower; a side input that feeds the join directly) - in the
 * order the engine lists them, each from its input down.
 * @param {{id: string}[]} layers
 * @param {[string, string][]} edges
 * @param {"user" | "item"} s
 * @returns {string[][]}
 */
export function sideChains(layers, edges, s) {
  const depth = stageDepths(layers, edges);
  const own = layers.filter((l) => stageSide(l) === s).map((l) => l.id);
  /** @type {Map<string, string>} */
  const root = new Map(own.map((id) => [id, id]));
  const find = (/** @type {string} */ id) => {
    while (root.get(id) !== id) id = /** @type {string} */ (root.get(id));
    return id;
  };
  for (const [from, to] of edges) if (root.has(from) && root.has(to)) root.set(find(from), find(to));
  /** @type {Map<string, string[]>} */
  const groups = new Map();
  for (const id of own) groups.set(find(id), [...(groups.get(find(id)) || []), id]);
  return [...groups.values()].map((chain) => chain.sort((p, q) => (depth.get(p) ?? 0) - (depth.get(q) ?? 0)));
}

/**
 * WP-245 (the feature network): the vertical drawing described above. Returns null when the wiring is not of that shape (no join, no tower, more than one side input on a side, or
 * more than one column outside the join's width on a side - the drawing's one turn per side); the caller then keeps the two-sided drawing.
 * @param {{id: string, kind?: string}[]} layers
 * @param {[string, string][]} edges
 * @param {VerticalGeo} [geo]
 * @returns {{width: number, height: number, nCols: number, pos: Map<string, VBox>, routes: Map<string, {x: number, y: number}[]>, geo: VerticalGeo} | null}
 */
export function layoutVertical(layers, edges, geo = VERTICAL_GEO) {
  const side = new Map(layers.map((l) => [l.id, stageSide(l)]));
  const depth = stageDepths(layers, edges);
  const mid = layers.filter((l) => side.get(l.id) === "mid").sort((p, q) => (depth.get(p.id) ?? 0) - (depth.get(q.id) ?? 0));
  if (!mid.length) return null;
  const [join, ...stack] = mid;
  const consumers = (/** @type {string} */ id) => edges.filter(([from]) => from === id).map(([, to]) => to);
  /** @param {"user" | "item"} s */
  const split = (s) => {
    const chains = sideChains(layers, edges, s);
    const lone = chains.filter((c) => c.length === 1 && consumers(c[0]).length > 0 && consumers(c[0]).every((to) => side.get(to) === "mid"));
    return { towers: chains.filter((c) => !lone.includes(c)), lone: lone.map((c) => c[0]) };
  };
  const user = split("user");
  const item = split("item");
  if (user.lone.length > 1 || item.lone.length > 1) return null;
  const columns = [...user.towers, ...[...item.towers].reverse()];
  if (!columns.length) return null;
  const nCols = columns.length;
  const hasLeft = user.lone.length === 1;
  const hasRight = item.lone.length === 1;
  const columnsW = nCols * geo.boxW + (nCols - 1) * geo.gapX;
  const sideRoom = Math.max(hasLeft ? geo.flankW + geo.flankGap : 0, hasRight ? geo.flankW + geo.flankGap : 0);
  const width = Math.max(geo.minW, columnsW + 2 * geo.pad, 2 * sideRoom + 2 * geo.pad + 120);
  const cx = width / 2;
  const left = cx - columnsW / 2;
  /** @type {Map<string, VBox>} */
  const pos = new Map();
  const rows = Math.max(...columns.map((c) => c.length));
  columns.forEach((chain, k) => chain.forEach((id, r) => pos.set(id, { x: left + k * (geo.boxW + geo.gapX), y: geo.pad + r * (geo.boxH + geo.gapY), w: geo.boxW, h: geo.boxH, mode: "column" })));
  const towersBottom = geo.pad + rows * geo.boxH + (rows - 1) * geo.gapY;
  const yBus = towersBottom + geo.busGap / 2;
  const joinTop = towersBottom + geo.busGap;
  const rowH = hasLeft || hasRight ? geo.flankH : geo.slimH;
  const tailW = Math.min(geo.maxTailW, width - 2 * geo.pad - 2 * sideRoom);
  const joinY = joinTop + (rowH - geo.slimH) / 2;
  pos.set(join.id, { x: cx - tailW / 2, y: joinY, w: tailW, h: geo.slimH, mode: "slim" });
  if (hasLeft) pos.set(user.lone[0], { x: cx - tailW / 2 - geo.flankGap - geo.flankW, y: joinTop, w: geo.flankW, h: geo.flankH, mode: "flank" });
  if (hasRight) pos.set(item.lone[0], { x: cx + tailW / 2 + geo.flankGap, y: joinTop, w: geo.flankW, h: geo.flankH, mode: "flank" });
  let y = joinTop + rowH;
  for (const layer of stack) {
    y += geo.tailGap;
    pos.set(layer.id, { x: cx - tailW / 2, y, w: tailW, h: geo.slimH, mode: "slim" });
    y += geo.slimH;
  }
  const height = y + geo.pad;
  // the arrows: straight down a column and down the stack; a side input goes straight across to the join; a tower enters the join from above - straight when its centre is over the join (less a
  // margin), else under the towers: down to the bus line, along it to the join's edge, down
  const joinBox = /** @type {VBox} */ (pos.get(join.id));
  const margin = 8;
  const lo = joinBox.x + margin;
  const hi = joinBox.x + joinBox.w - margin;
  const outside = { left: 0, right: 0 };
  for (const chain of columns) {
    const last = /** @type {VBox} */ (pos.get(chain[chain.length - 1]));
    const centre = last.x + last.w / 2;
    if (centre < lo) outside.left += 1;
    else if (centre > hi) outside.right += 1;
  }
  if (outside.left > 1 || outside.right > 1) return null;
  /** @type {Map<string, {x: number, y: number}[]>} */
  const routes = new Map();
  for (const [from, to] of edges) {
    const a = pos.get(from);
    const b = pos.get(to);
    if (!a || !b) continue;
    const ax = a.x + a.w / 2;
    const ay = a.y + a.h;
    if (a.mode === "flank") {
      const across = joinY + geo.slimH / 2;
      routes.set(`${from}>${to}`, a.x < b.x ? [{ x: a.x + a.w, y: across }, { x: b.x, y: across }] : [{ x: a.x, y: across }, { x: b.x + b.w, y: across }]);
    } else if (to === join.id && ax >= lo && ax <= hi) {
      routes.set(`${from}>${to}`, [{ x: ax, y: ay }, { x: ax, y: b.y }]);
    } else if (to === join.id) {
      const enter = ax < lo ? lo : hi;
      routes.set(`${from}>${to}`, [{ x: ax, y: ay }, { x: ax, y: yBus }, { x: enter, y: yBus }, { x: enter, y: b.y }]);
    } else {
      routes.set(`${from}>${to}`, [{ x: ax, y: ay }, { x: ax, y: b.y }]);
    }
  }
  return { width, height, nCols, pos, routes, geo };
}
