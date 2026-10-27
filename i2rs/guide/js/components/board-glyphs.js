// @ts-check
// WP-66: the lecture board's figure library. A glyph draws one of the little sketches the
// instructor puts next to a node on the whiteboard (the users×items matrix with row/column
// ellipses, the item-feature table, a black box with named inputs, the train/val/test split, the
// "classification vs recommendation" matrix pair, a user–item bipartite graph, a requirements
// form) inside the figure's box, in LOCAL coordinates (0..w, 0..h). WP-67 adds the system board's
// retrieval -> ranking funnel ribbon and the A/B-test sketch.
//
// Every glyph is made of named PARTS (`ctx.part(name, role)`), each an inkable id
// `<figure>.<part>` a deck step can reveal on its own (the matrix grid first, the red row
// ellipses with uCF, the blue column ellipses with iCF). The part names drawn here are mirrored
// in `i2rs.slides.decks.GLYPH_PARTS`, which validates the decks - keep the two lists in step.
// Colour roles: the part's role colours everything inside it once inked; a nested
// `<g class="role-user">` recolours just that piece (see board.css variables in slides.css).

import { arrowLine, checkMark, crossMark, line, svgEl, textEl, thumb } from "./board-svg.js";

const SIZE = 11; // px, glyph text (the SVG scales with the board's viewBox)

/**
 * @typedef {Object} GlyphCtx
 * @property {(name: string, role: string) => SVGGElement} part  create + register an inkable part
 * @property {(key: string) => string} t  i18n
 */

/**
 * The ratings matrix: users are rows (brace + label on the left), items are columns (brace +
 * label on top); ellipses around two rows (`rows`, user colour) and two columns (`cols`, item
 * colour) are the uCF / iCF "compare row vectors / column vectors" idea.
 * @param {any} el
 * @param {GlyphCtx} ctx
 */
function matrix(el, ctx) {
  const p = el.params || {};
  const rows = p.rows || 5;
  const cols = p.cols || 6;
  const W = el.w;
  const H = el.h;
  // WP-66 (round 10): left margin 44 -> 34 and the "users" label 2 units nearer the brace, the
  // "items" label 3 units higher - the labels sat too far from / on top of the brace lines
  const gx = 34;
  const gy = 22;
  const gw = W - gx - 6;
  const gh = H - gy - 6;
  const cw = gw / cols;
  const ch = gh / rows;

  const grid = ctx.part("grid", el.role || "ink");
  grid.appendChild(svgEl("rect", { x: gx, y: gy, width: gw, height: gh, class: "bd-shape bd-fill" }));
  for (let r = 1; r < rows; r += 1) grid.appendChild(line(gx, gy + r * ch, gx + gw, gy + r * ch, "bd-thin"));
  for (let c = 1; c < cols; c += 1) grid.appendChild(line(gx + c * cw, gy, gx + c * cw, gy + gh, "bd-thin"));
  // WP-66 (round 11): the braces carry the axis colours themselves (items blue on top, users red
  // on the left) - the same cue the small classification-vs-RS matrices use without any words
  grid.appendChild(svgEl("path", { d: `M ${gx} ${gy - 5} v -3 h ${gw} v 3`, class: "bd-shape role-item" }));
  grid.appendChild(svgEl("path", { d: `M ${gx - 5} ${gy} h -3 v ${gh} h 3`, class: "bd-shape role-user" }));
  grid.appendChild(textEl(gx + gw / 2, 6, ctx.t(p.items_key), { size: SIZE, cls: "bd-small role-item" }));
  const users = textEl(0, 0, ctx.t(p.users_key), { size: SIZE, cls: "bd-small role-user" });
  users.setAttribute("transform", `translate(16 ${gy + gh / 2}) rotate(-90)`);
  grid.appendChild(users);

  const rowsPart = ctx.part("rows", "user");
  for (const r of p.row_ellipses || []) {
    rowsPart.appendChild(
      svgEl("ellipse", { cx: gx + gw / 2, cy: gy + (r + 0.5) * ch, rx: gw / 2 + 5, ry: ch / 2 + 1.5, class: "bd-shape bd-ring" })
    );
  }
  const colsPart = ctx.part("cols", "item");
  for (const c of p.col_ellipses || []) {
    colsPart.appendChild(
      svgEl("ellipse", { cx: gx + (c + 0.5) * cw, cy: gy + gh / 2, rx: cw / 2 + 1.5, ry: gh / 2 + 5, class: "bd-shape bd-ring" })
    );
  }
}

/**
 * Item profiles: one row per item, one column per feature (genre), a tick where the item has
 * it (`table`, item colour); the last column is the target user's verdict on each item as an
 * up/down arrow (`ratings`, user colour) - the content-based training set for ONE user.
 * @param {any} el
 * @param {GlyphCtx} ctx
 */
function featureTable(el, ctx) {
  const p = el.params || {};
  const terms = (p.terms_keys || []).map((k) => ctx.t(k));
  const checks = p.checks || [];
  const ratings = p.ratings || [];
  const W = el.w;
  const H = el.h;
  const rcol = 30;
  const head = 18;
  // WP-66 (round 12): optional caption under the table (`caption_key`, e.g. "CBRS ≈ text
  // classification") in neutral ink; it takes 16 units off the body, the rows share the rest
  const cap = p.caption_key ? 16 : 0;
  const bodyH = H - head - cap;
  const nRows = Math.max(checks.length, ratings.length, 1);
  const tw = W - rcol;
  const cw = tw / Math.max(terms.length, 1);
  const rh = bodyH / nRows;

  const table = ctx.part("table", "item");
  table.appendChild(svgEl("rect", { x: 0, y: head, width: tw, height: bodyH, class: "bd-shape bd-fill" }));
  terms.forEach((t, c) => table.appendChild(textEl(c * cw + cw / 2, head / 2, t, { size: SIZE, cls: "bd-small bd-strong" })));
  for (let r = 1; r < nRows; r += 1) table.appendChild(line(0, head + r * rh, tw, head + r * rh, "bd-thin"));
  for (let c = 1; c < terms.length; c += 1) table.appendChild(line(c * cw, head, c * cw, head + bodyH, "bd-thin"));
  if (p.caption_key) {
    table.appendChild(textEl(W / 2, head + bodyH + cap / 2 + 2, ctx.t(p.caption_key), { size: SIZE, cls: "bd-small role-ink" }));
  }
  checks.forEach((row, r) => {
    row.forEach((v, c) => {
      if (v) table.appendChild(checkMark(c * cw + cw / 2, head + r * rh + rh / 2, Math.min(cw, rh) * 0.28));
    });
  });

  // the verdict column holds ratings, so it takes the RATING colour - the same one as every
  // box's output arrow r̂ and the X cells of the matrix-completion sketch (instructor's rule:
  // "whatever colour the output r gets, the examples of it get too"); never the red user axis,
  // which read as the "u" input of the boxes to its left
  const rat = ctx.part("ratings", p.ratings_role || "rating");
  rat.appendChild(svgEl("rect", { x: tw, y: head, width: rcol, height: bodyH, class: "bd-shape bd-fill" }));
  for (let r = 1; r < nRows; r += 1) rat.appendChild(line(tw, head + r * rh, W, head + r * rh, "bd-thin"));
  rat.appendChild(textEl(tw + rcol / 2, head / 2, "r", { size: SIZE, cls: "bd-small bd-strong bd-italic" }));
  ratings.forEach((dir, r) => rat.appendChild(thumb(tw + rcol / 2, head + r * rh + rh / 2, dir === "up", Math.min(rh * 0.62, 13))));
}

/**
 * Inputs → box → output. Used three times on the RS tree: the model-based black box (u, i →
 * r̂), the content-based target-user model (i, +i → r̂) and the hybrid combiner (u, i, +i, +G →
 * r̂). `plus: true` draws the input inside a ring ("extra information").
 * @param {any} el
 * @param {GlyphCtx} ctx
 */
function blackbox(el, ctx) {
  const p = el.params || {};
  const inputs = p.inputs || [];
  const W = el.w;
  const H = el.h;
  const bw = p.box_w || 56;
  const lx = 16; // the input labels' centre; the arrows start 14 units after it
  // WP-79: the output arrow stays legible (at least 20 units) - a narrow figure slides its box
  // left instead of squeezing the arrow into a stub (the content-based box had 9 units)
  // WP-82: `arrow_len` fixes the input arrows' length instead (the content-based box: 20, the
  // same as its output arrow) and the box follows right after them - a compact, symmetric figure
  const bx = p.arrow_len ? lx + 14 + p.arrow_len + 3 : Math.min(W / 2 - bw / 2 + 12, W - 18 - 3 - 20 - bw);
  const by = 6;
  const bh = H - 12;

  const inp = ctx.part("inputs", el.role || "ink");
  const n = inputs.length;
  inputs.forEach((it, k) => {
    const y = (H * (k + 1)) / (n + 1);
    const sub = svgEl("g", { class: `role-${it.role || "ink"}` });
    if (it.plus) sub.appendChild(svgEl("circle", { cx: lx, cy: y, r: 9, class: "bd-shape bd-ring" }));
    sub.appendChild(textEl(lx, y, ctx.t(it.label_key), { size: SIZE, cls: "bd-small bd-strong bd-italic" }));
    sub.appendChild(arrowLine(lx + 14, y, bx - 3, y, it.role || "ink"));
    inp.appendChild(sub);
  });

  // a sharp-cornered rectangle = "process" in flowchart notation (rounded corners would read as a
  // terminator); the box is a function of its inputs, so that is the right symbol
  const box = ctx.part("box", el.role || "ink");
  box.appendChild(svgEl("rect", { x: bx, y: by, width: bw, height: bh, rx: 1.5, class: "bd-shape bd-fill" }));
  if (p.box_key) box.appendChild(textEl(bx + bw / 2, H / 2, ctx.t(p.box_key), { size: 9.5, cls: "bd-small" }));
  if (p.inner === "mlp") {
    // a tiny network: two inputs -> three hidden units -> one output
    const xs = [bx + 10, bx + bw / 2, bx + bw - 10];
    const layers = [[0.34, 0.66], [0.24, 0.5, 0.76], [0.5]].map((fs) => fs.map((f) => by + bh * f));
    for (let l = 0; l + 1 < layers.length; l += 1) {
      for (const y1 of layers[l]) for (const y2 of layers[l + 1]) box.appendChild(line(xs[l], y1, xs[l + 1], y2, "bd-thin bd-inner"));
    }
    layers.forEach((ys, l) => ys.forEach((y) => box.appendChild(svgEl("circle", { cx: xs[l], cy: y, r: 2.2, class: "bd-shape bd-dot" }))));
  } else if (p.inner === "combine") {
    // a tiny combiner: one node per input feeding a weighted sum
    const cx = bx + bw / 2 + 4;
    const cy = by + bh / 2;
    inputs.forEach((_, k) => {
      const y = by + (bh * (k + 1)) / (n + 1);
      box.appendChild(line(bx + 9, y, cx - 7, cy, "bd-thin bd-inner"));
      box.appendChild(svgEl("circle", { cx: bx + 9, cy: y, r: 2, class: "bd-shape bd-dot" }));
    });
    box.appendChild(svgEl("circle", { cx, cy, r: 8, class: "bd-shape bd-fill bd-thin" }));
    box.appendChild(textEl(cx, cy, "Σ", { size: 10, cls: "bd-small bd-strong" }));
    box.appendChild(line(cx + 8, cy, bx + bw - 5, cy, "bd-thin bd-inner"));
  }

  const outRole = p.output_role || "rating"; // the output is a rating / score: amber everywhere
  const out = ctx.part("output", outRole);
  out.appendChild(arrowLine(bx + bw + 3, H / 2, W - 18, H / 2, outRole));
  out.appendChild(textEl(W - 8, H / 2, ctx.t(p.output_key), { size: SIZE, cls: "bd-small bd-strong bd-italic" }));
}

/**
 * The evaluation protocol of a fitted model: the data forks into train / validation / test.
 * @param {any} el
 * @param {GlyphCtx} ctx
 */
function split(el, ctx) {
  const p = el.params || {};
  const labels = (p.labels_keys || []).map((k) => ctx.t(k));
  const W = el.w;
  const H = el.h;
  const role = el.role || "ink";
  const all = ctx.part("all", role);
  // with a title the figure is a CARD like the corner lists (frame + title + rule), the fork inside
  const head = p.title_key ? 20 : 0;
  if (p.title_key) {
    all.appendChild(svgEl("rect", { x: 0, y: 0, width: W, height: H, rx: 6, class: "bd-shape bd-fill bd-card" }));
    all.appendChild(textEl(8, head / 2 + 1, ctx.t(p.title_key), { anchor: "start", size: SIZE, cls: "bd-small bd-strong" }));
    all.appendChild(line(6, head, W - 6, head, "bd-thin"));
  }
  const top = head + 4;
  const innerH = H - top - 4;
  const bx = Math.round(W * 0.42);
  const bw = W - bx - 10;
  all.appendChild(svgEl("rect", { x: bx, y: top, width: bw, height: innerH, rx: 8, class: "bd-shape bd-fill" }));
  const ys = labels.map((_, k) => top + (innerH * (k + 1)) / (labels.length + 1));
  const x0 = 14;
  if (ys.length > 1) all.appendChild(line(x0, ys[0], x0, ys[ys.length - 1], ""));
  labels.forEach((t, k) => {
    all.appendChild(arrowLine(x0, ys[k], bx - 3, ys[k], role));
    all.appendChild(textEl(bx + bw / 2, ys[k], t, { size: SIZE, cls: "bd-small bd-strong" }));
  });
}

/**
 * Classification (one target column, features complete) vs recommendation (holes anywhere, any
 * column can be the target) - Aggarwal's Fig. 1.4 idea as two little matrices.
 * @param {any} el
 * @param {GlyphCtx} ctx
 */
function clasVsRs(el, ctx) {
  const p = el.params || {};
  const W = el.w;
  const H = el.h;
  const n = 5;
  // WP-66 (round 11): room above and to the left of each grid for the axis braces (items blue on
  // top, users red on the left, no words - the big matrix above spells them out once); the label
  // stays under the grid
  const top = 10;
  const left = 8;
  const cell = Math.min((W - 2 * left - 32) / 2 / n, (H - top - 20) / n);
  const gsz = cell * n;

  /**
   * @param {SVGGElement} part
   * @param {number} x0
   * @param {number[][]} marks
   * @param {number} [topCols]  how many columns the top brace spans (default all)
   * @param {string} [topRole]  the top brace's role class (default the item blue)
   */
  function grid(part, x0, marks, topCols = n, topRole = "role-item") {
    part.appendChild(svgEl("rect", { x: x0, y: top, width: gsz, height: gsz, class: "bd-shape bd-fill" }));
    for (let k = 1; k < n; k += 1) {
      part.appendChild(line(x0, top + k * cell, x0 + gsz, top + k * cell, "bd-thin"));
      part.appendChild(line(x0 + k * cell, top, x0 + k * cell, top + gsz, "bd-thin"));
    }
    // the axis braces: same shape as the big matrix's, 4 units off the grid. WP-82 round 8: the
    // classification grid is NOT a user x item matrix - its columns are features plus the target
    // column, so its top brace is plain ink and stops before the last column (the instructor's
    // catch); the rows keep the user red (the instances are the users in Aggarwal's analogy)
    part.appendChild(svgEl("path", { d: `M ${x0} ${top - 4} v -3 h ${topCols * cell} v 3`, class: `bd-shape ${topRole}` }));
    part.appendChild(svgEl("path", { d: `M ${x0 - 4} ${top} h -3 v ${gsz} h 3`, class: "bd-shape role-user" }));
    // the X cells are the ratings to predict: the rating colour, like every r̂ output on the board
    const xs = svgEl("g", { class: "role-rating" });
    for (const [r, c] of marks) xs.appendChild(crossMark(x0 + (c + 0.5) * cell, top + (r + 0.5) * cell, cell * 0.26));
    part.appendChild(xs);
  }

  const clas = ctx.part("clas", "ink");
  grid(clas, left, p.clas_marks || [[0, 4], [1, 4], [2, 4], [3, 4], [4, 4]], n - 1, "role-ink"); // WP-82: features brace
  clas.appendChild(textEl(left + gsz / 2, top + gsz + 13, ctx.t(p.clas_key), { size: SIZE, cls: "bd-small" }));
  // WP-66 (round 12): "vs." sits on the label line, so the bottom reads "classification vs. RS"
  clas.appendChild(textEl(W / 2, top + gsz + 13, "vs.", { size: SIZE, cls: "bd-small bd-italic" }));

  const rs = ctx.part("rs", "ink");
  const x1 = W - left - gsz;
  grid(rs, x1, p.rs_marks || [[0, 3], [1, 1], [2, 4], [3, 0], [3, 2], [4, 3]]);
  rs.appendChild(textEl(x1 + gsz / 2, top + gsz + 13, ctx.t(p.rs_key), { size: SIZE, cls: "bd-small" }));
}

/**
 * A user–item bipartite graph with one highlighted 3-hop path (user → item → user → item):
 * similarity travelling along paths, the graph-based idea.
 * @param {any} el
 * @param {GlyphCtx} ctx
 */
function bipartite(el, ctx) {
  const p = el.params || {};
  const W = el.w;
  const H = el.h;
  const all = ctx.part("all", "ink");
  const ux = 22;
  const ix = W - 22;
  const uy = [24, 52, 80].map((v) => (v * H) / 96);
  const iy = [18, 40, 62, 84].map((v) => (v * H) / 96);
  const edges = [[0, 0], [0, 1], [1, 1], [1, 2], [2, 2], [2, 3], [0, 3]];
  for (const [u, i] of edges) all.appendChild(line(ux, uy[u], ix, iy[i], "bd-thin"));
  const path = svgEl("g", { class: "role-model" });
  path.append(
    line(ux, uy[0], ix, iy[1], "bd-path-seg"),
    line(ix, iy[1], ux, uy[1], "bd-path-seg"),
    line(ux, uy[1], ix, iy[2], "bd-path-seg")
  );
  all.appendChild(path);
  const users = svgEl("g", { class: "role-user" });
  for (const y of uy) users.appendChild(svgEl("circle", { cx: ux, cy: y, r: 5, class: "bd-shape bd-dot" }));
  users.appendChild(textEl(ux, 7, ctx.t(p.u_key), { size: SIZE, cls: "bd-small bd-strong bd-italic" }));
  all.appendChild(users);
  const items = svgEl("g", { class: "role-item" });
  for (const y of iy) {
    items.appendChild(svgEl("rect", { x: ix - 4.5, y: y - 4.5, width: 9, height: 9, class: "bd-shape bd-dot", transform: `rotate(45 ${ix} ${y})` }));
  }
  items.appendChild(textEl(ix, 7, ctx.t(p.i_key), { size: SIZE, cls: "bd-small bd-strong bd-italic" }));
  all.appendChild(items);
}

/**
 * A requirements form (explicit constraints the user states) that filters the catalogue: the
 * knowledge-based idea.
 * @param {any} el
 * @param {GlyphCtx} ctx
 */
function constraints(el, ctx) {
  const p = el.params || {};
  const lines = (p.lines_keys || []).map((k) => ctx.t(k));
  const W = el.w;
  const H = el.h;
  const all = ctx.part("all", el.role || "ink");
  // WP-82: `frame_role` colours just the form's frame (the RS tree paints it example-pink: the
  // form is a sample query under the KBRS node, not one more box of the taxonomy)
  const frame = svgEl("g", { class: p.frame_role ? `role-${p.frame_role}` : "" });
  frame.appendChild(svgEl("rect", { x: 0, y: 0, width: W, height: H, rx: 6, class: "bd-shape bd-fill" }));
  all.appendChild(frame);
  const rh = (H - 8) / (lines.length + 1);
  lines.forEach((t, k) => {
    const y = 4 + rh * (k + 0.5) + 1;
    all.appendChild(textEl(8, y, t, { size: SIZE, cls: "bd-small", anchor: "start" }));
    all.appendChild(svgEl("rect", { x: W - 22, y: y - 6, width: 12, height: 12, rx: 2, class: "bd-shape bd-thin" }));
    if (k === 0) all.appendChild(checkMark(W - 16, y, 4, "role-model"));
  });
  const yb = 4 + rh * (lines.length + 0.5) + 1;
  all.appendChild(arrowLine(8, yb, W / 2 - 8, yb, "ink"));
  all.appendChild(checkMark(W / 2 + 10, yb, 6, "role-model"));
}

/**
 * A side card: a title, one or more columns (optional column titles) of bulleted items. Used for
 * the board's steering lists - operational goals & performance metrics, problem types. The
 * `header` part is the card itself; every item is its own part (`<figure>.<item id>`), so a
 * step's sub-steps can reveal and explain them one by one and a click on an item jumps to it.
 * Part ids come from `params.columns[*].items[*].id` (validated in i2rs.slides.decks).
 * @param {any} el
 * @param {GlyphCtx} ctx
 */
function listCard(el, ctx) {
  const p = el.params || {};
  const columns = p.columns || [];
  const W = el.w;
  const H = el.h;
  // WP-82: `title_size` = the title's font (default the glyph size, 11 px); the header band grows
  // with it (20 at 11 px, 25 at 14 px), so a card can wear a tree node's label size - the RS tree's
  // Memory-based / Model-based cards are nodes of the taxonomy whose bullets are their methods
  const titleSize = p.title_size || SIZE;
  const head = Math.round(titleSize * 1.8);
  const hasColTitles = columns.some((c) => c.title_key);
  const rowsTop = head + (hasColTitles ? 16 : 6);
  const rowH = 14;
  const colW = (W - 12) / Math.max(columns.length, 1);

  const header = ctx.part("header", el.role || "ink");
  header.appendChild(svgEl("rect", { x: 0, y: 0, width: W, height: H, rx: 6, class: "bd-shape bd-fill bd-card" }));
  header.appendChild(textEl(8, head / 2 + 1, ctx.t(p.title_key), { anchor: "start", size: titleSize, cls: "bd-small bd-strong" }));
  header.appendChild(line(6, head, W - 6, head, "bd-thin"));
  columns.forEach((col, c) => {
    if (!col.title_key) return;
    header.appendChild(textEl(6 + c * colW + 4, head + 8, ctx.t(col.title_key), { anchor: "start", size: 9, cls: "bd-small bd-italic bd-col-title" }));
  });

  // Item options: `level: 2` = a variant of the level-1 items above it (same alignment, a thin
  // rule before the first one, hollow bullet, smaller italic); `marker: "1"` = a numbered marker
  // instead of the bullet; `strong: true` = bold label. The RS tree uses them to make
  // "1 · prediction / 2 · ranking" the message of the card and to subordinate implicit feedback and
  // context-awareness to it.
  columns.forEach((col, c) => {
    const x0 = 6 + c * colW + 4;
    let y = rowsTop + rowH / 2;
    let prevLevel = 1;
    (col.items || []).forEach((item) => {
      const level2 = item.level === 2;
      // WP-82: `role_scope: paren` colours only the "(...)" tail of the label in the item's role
      // ("user-based CF (uCF)": plain ink up to the parenthesis, user red inside it); the part
      // itself stays ink, so the bullet is neutral too
      const label = ctx.t(item.label_key);
      const parenAt = item.role_scope === "paren" ? label.indexOf("(") : -1;
      const paren = parenAt > 0;
      const part = ctx.part(item.id, paren ? "ink" : item.role || el.role || "ink");
      if (level2 && prevLevel !== 2) {
        y += 4; // room for the rule that separates the variants from the main items
        part.appendChild(line(x0 - 3, y - rowH / 2 - 1, x0 + colW - 12, y - rowH / 2 - 1, "bd-thin"));
      }
      part.appendChild(svgEl("rect", { x: x0 - 3, y: y - rowH / 2, width: colW - 4, height: rowH, class: "bd-hit" }));
      if (item.marker) {
        part.appendChild(textEl(x0 + 3, y, String(item.marker), { size: 9.5, cls: "bd-small bd-strong bd-marker" }));
      } else if (level2) {
        part.appendChild(svgEl("circle", { cx: x0 + 3, cy: y, r: 2.2, class: "bd-shape bd-hollow" }));
      } else {
        part.appendChild(svgEl("circle", { cx: x0 + 3, cy: y, r: 2.4, class: "bd-shape bd-dot" }));
      }
      const cls = `bd-small bd-item${item.strong ? " bd-strong" : ""}${level2 ? " bd-item-2" : ""}`;
      const size = level2 ? 9.5 : 10.5;
      if (paren) {
        const t = svgEl("text", { x: x0 + 11, y, "text-anchor": "start", class: `bd-text ${cls}`, "font-size": size });
        t.appendChild(svgEl("tspan", {}));
        t.firstChild.textContent = label.slice(0, parenAt);
        const tail = svgEl("tspan", { class: `bd-span role-${item.role || "ink"}` });
        tail.textContent = label.slice(parenAt);
        t.appendChild(tail);
        part.appendChild(t);
      } else {
        part.appendChild(textEl(x0 + 11, y, label, { anchor: "start", size, cls }));
      }
      y += rowH;
      prevLevel = level2 ? 2 : 1;
    });
  });
}

/**
 * WP-67: the retrieval -> ranking funnel of a production recommender, as a horizontal ribbon that
 * narrows left to right. One band per stage (`params.stages[*]`: `id` = the part id, `count_key`
 * = the label under it), band boundaries at `params.stops` (local x; default: equal widths) with
 * the ribbon's heights at those boundaries in `params.heights` (default: a geometric decrease
 * from `ribbon_h`). The count labels form one row under the ribbon, like axis ticks. An optional
 * `tip` part (`tip_key`, `tip_role`, `tip_w`) is the arrow into the user at the narrow end. The
 * bands take the figure's role - blue: it is items that flow through the system.
 * @param {any} el
 * @param {GlyphCtx} ctx
 */
function funnel(el, ctx) {
  const p = el.params || {};
  const stages = p.stages || [];
  const n = stages.length;
  const W = el.w;
  const H = el.h;
  const tipW = p.tip_key ? p.tip_w || 44 : 0;
  const ribbonW = W - tipW;
  /** @type {number[]} */
  const stops =
    Array.isArray(p.stops) && p.stops.length === n + 1 ? p.stops : stages.map((_, k) => (ribbonW * k) / n).concat([ribbonW]);
  const hMax = p.ribbon_h || H - 18; // the label row needs the rest
  /** @type {number[]} */
  const heights =
    Array.isArray(p.heights) && p.heights.length === n + 1 ? p.heights : stops.map((_, k) => hMax * Math.pow(0.55, k));
  const cy = hMax / 2 + 1;
  stages.forEach((st, k) => {
    const part = ctx.part(st.id, st.role || el.role || "ink");
    const [x0, x1] = [stops[k], stops[k + 1]];
    const [h0, h1] = [heights[k], heights[k + 1]];
    part.appendChild(
      svgEl("path", {
        d: `M ${x0} ${cy - h0 / 2} L ${x1} ${cy - h1 / 2} L ${x1} ${cy + h1 / 2} L ${x0} ${cy + h0 / 2} Z`,
        class: "bd-shape bd-fill bd-band",
      })
    );
    part.appendChild(textEl((x0 + x1) / 2, hMax + 10, ctx.t(st.count_key), { size: SIZE, cls: "bd-small bd-strong" }));
  });
  if (p.tip_key) {
    const role = p.tip_role || "user";
    const tip = ctx.part("tip", role);
    const x = stops[n];
    tip.appendChild(arrowLine(x + 2, cy, x + tipW - 16, cy, role));
    tip.appendChild(textEl(x + tipW - 6, cy, ctx.t(p.tip_key), { size: SIZE, cls: "bd-small bd-strong bd-italic" }));
  }
}

/**
 * WP-67: an online A/B test in one sketch. A crowd of users is split at random into two arms - A
 * keeps the running system, B gets the candidate model - and one metric is read out per arm with
 * the difference and its confidence interval. Parts: `split` (the users and the random fork),
 * `arms` (the two lanes, each serving a little ranked list), `result` (the two bars, their values,
 * the Δ line). The values come from the deck's params and are illustrative (the narration says so).
 * @param {any} el
 * @param {GlyphCtx} ctx
 */
function abTest(el, ctx) {
  const p = el.params || {};
  const W = el.w;
  const H = el.h;
  const cy = H / 2 - 5; // the Δ line takes the bottom
  const laneDy = 20;

  const split = ctx.part("split", "ink");
  const users = svgEl("g", { class: "role-user" });
  const ux = 22;
  for (const [dx, dy] of [[-8, -10], [6, -12], [-2, 0], [-10, 10], [8, 8]]) {
    users.appendChild(svgEl("circle", { cx: ux + dx, cy: cy + dy, r: 3.2, class: "bd-shape bd-dot" }));
  }
  users.appendChild(textEl(ux, cy + 25, ctx.t(p.users_key), { size: 9.5, cls: "bd-small" }));
  split.appendChild(users);
  const fx = 60; // the fork
  split.appendChild(line(ux + 16, cy, fx, cy, ""));
  split.appendChild(svgEl("circle", { cx: fx, cy, r: 3, class: "bd-shape bd-dot" }));
  split.appendChild(arrowLine(fx, cy, fx + 26, cy - laneDy, "ink"));
  split.appendChild(arrowLine(fx, cy, fx + 26, cy + laneDy, "ink"));
  split.appendChild(textEl(fx + 2, cy + 33, ctx.t(p.random_key), { size: 9.5, cls: "bd-small bd-italic" }));

  const arms = ctx.part("arms", "ink");
  const ax = fx + 32;
  /**
   * @param {number} y
   * @param {string} key
   * @param {string} cls
   */
  const lane = (y, key, cls) => {
    const g = svgEl("g", { class: cls });
    g.appendChild(svgEl("rect", { x: ax, y: y - 7, width: 12, height: 14, rx: 1.5, class: "bd-shape bd-fill bd-thin" }));
    for (const k of [0, 1, 2]) g.appendChild(line(ax + 2.5, y - 4 + k * 4, ax + 9.5, y - 4 + k * 4, "bd-thin"));
    g.appendChild(textEl(ax + 18, y, ctx.t(key), { anchor: "start", size: 10.5, cls: "bd-small bd-strong" }));
    return g;
  };
  arms.append(lane(cy - laneDy, p.a_key, ""), lane(cy + laneDy, p.b_key, "role-model"));

  const res = ctx.part("result", "rating");
  const bx = Math.round(W * 0.64); // the lane labels end well before the bars start
  const bwMax = W - bx - 42;
  const vA = Number(p.a_value) || 0;
  const vB = Number(p.b_value) || 0;
  const vMax = Math.max(vA, vB, 1e-9);
  /**
   * @param {number} y
   * @param {number} v
   * @param {string} cls
   */
  const bar = (y, v, cls) => {
    const w = (bwMax * v) / vMax;
    res.appendChild(svgEl("rect", { x: bx, y: y - 6, width: w, height: 12, class: `bd-shape bd-bar ${cls}`.trim() }));
    res.appendChild(textEl(bx + w + 4, y, `${v} %`, { anchor: "start", size: 10, cls: "bd-small bd-strong" }));
  };
  bar(cy - laneDy, vA, "");
  bar(cy + laneDy, vB, "bd-bar-b");
  res.appendChild(textEl(bx, cy - laneDy - 15, ctx.t(p.metric_key), { anchor: "start", size: 9.5, cls: "bd-small bd-italic" }));
  res.appendChild(textEl(W / 2, H - 6, ctx.t(p.delta_key), { size: 10, cls: "bd-small bd-strong" }));
}

const GLYPHS = {
  matrix,
  feature_table: featureTable,
  blackbox,
  split,
  clas_vs_rs: clasVsRs,
  bipartite,
  constraints,
  list_card: listCard,
  funnel, // WP-67
  ab_test: abTest, // WP-67
};

/**
 * @param {string} name
 * @param {any} el  the figure element (x, y, w, h, role, params)
 * @param {GlyphCtx} ctx
 */
export function drawGlyph(name, el, ctx) {
  const fn = GLYPHS[/** @type {keyof typeof GLYPHS} */ (name)];
  if (!fn) throw new Error(`unknown board glyph: ${name}`);
  fn(el, ctx);
}
