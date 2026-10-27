// @ts-check
// WP-20 (brief 04, moved here from prototypes/story-widgets after the visual acceptance there; the engine's own CSS is css/widgets.css): pipeline, items flowing through stages; here a cascade hybrid.
// The candidate list passes a first recommender, which scores roughly (so many items tie) and cuts the weakest; the second
// recommender is asked ONLY about the ties and orders each tie inside its own group. It never brings a cut item back and
// never moves an item across a group boundary: the last state shows exactly that. The items and scores are SYNTHETIC (D-055); the speaker note and the evidence record say so, the picture carries no label (D-129).
// Structure and names follow the student site's cascade (hybrid.taxonomy.node.cascade: "a rough first ranking prunes the
// items, the second stage breaks the ties"); the site's lab has no cascade page, so there are no site numbers to avoid.
//
// Kit shape (engine/widgets/kit.js): defineWidget({id, steps, params, build}); states k = 0..6; k=0 shows the candidates' column title.
//   1 the candidates   2 stage 1 ranks them (rough scores, many equal)   3 stage 1 cuts the weakest
//   4 the ties are bracketed; stage 2 scores only them   5 stage 2 orders each tie, the list moves on
//   6 the verdict: same groups, the single item stayed put, cut items do not return
// The cut items stay visible (struck through, dashed) so "never returns" has something to be true of.
//
// duration(k) = planDuration(plan(k)); N = items, K = kept, T = tied kept items, D = cut items, G = tie groups, V = verdict lines.
// With the default numbers (N=10, K=6, T=5, D=4, G=2, V=3): 825 / 1200 / 1060 / 1320 / 1400 / 1580 ms (measured: the browser reports the same).
//   k=1 (N-1)*45 + 420
//   k=2 max((N-1)*40 + 760, (N-1)*40 + 520 + 320)            the pips land last: (N-1)*40 + 840
//   k=3 260 + (D-1)*60 + 300 + 320                           the strike-throughs
//   k=4 max(240 + (G-1)*160 + 420, 600 + (T-1)*90 + 360)     the scores land last
//   k=5 (K-1)*60 + 1100                                      the last chip arrives
//   k=6 max((G-1)*160 + 420, 300 + (D-1)*80 + 320, 500 + (V-1)*330 + 420)   the last verdict line
//
// Motion: opacity and transform only. A chip is two stacked layers (kept, struck-out); the second fades in over the first.
import { defineWidget } from './kit.js';
import { stepsFromFrames, h, s, fit } from './frames.js';
import { icon, emblem, starRow } from './pictos.js';
import { switchSchema, switchBuild, switchExamples } from './pipeline-switch.js';
import { designsSchema, designsBuild, designsExamples, designsProblems } from './pipeline-designs.js';        // WP-50: the two designs of an ensemble (page s5)
import { kindsSchema, kindsBuild, kindsExamples, kindsProblems } from './pipeline-kinds.js';                  // WP-51: one kind of data or several (page homo-hetero)
import { metaSchema, metaBuild, metaExamples, metaProblems } from './pipeline-meta.js';                       // WP-51: the model itself is handed on (page meta-level)

const W = 1680, H = 600;
const Y0 = 56, PITCH = 51, CHIP_H = 44, CHIP_W = 84, CUT_GAP = 32;
const AX = 0, BX = 350, CX = 960;
const BAND1 = 150, BAND2 = 760, BAND_W = 120;
const MAX_ITEMS = Math.floor((H - Y0 - CUT_GAP - CHIP_H) / PITCH) + 1;

const frag = (/** @type {string} */ en, /** @type {string} */ tr) => ({ en, tr });
const FRAGMENT = { type: 'object', required: ['en'], additionalProperties: true, properties: { en: { type: 'string' }, tr: { type: 'string' } } };
/** @param {Record<string, string>} d */
const fragSchema = (d) => ({ ...FRAGMENT, default: d });

/** The params' JSON Schema, inside the subset of engine/widgets/params.js (the registry carries the same one). */
export const schema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    mode: {
      type: 'string', enum: ['cascade', 'switch', 'designs', 'kinds', 'meta'], default: 'cascade', title: 'what the pipeline shows',
      description: 'cascade: films pass a rough first recommender and a second one that only settles ties (six presses). switch: a switch at the entrance and two ways, chosen by how many ratings the user has or by a measurement (four presses). designs: the two designs of an ensemble of recommenders, parallel and sequential, as boxes and arrows ending in a combiner, and the designs of the taxonomy that belong to each (three presses). kinds: what an ensemble reads, one kind of data into three different models or two kinds of data into two models, both into a weighted blend, the weights of the second coming forward (three presses). meta: a content-based model learns a profile for each user, the collaborative model compares users by these profiles, then feature augmentation (an output is handed on) against meta-level (the model itself is) (three presses).',
    },
    switch: switchSchema,
    designs: designsSchema,
    kinds: kindsSchema,
    meta: metaSchema,
    items: {
      type: 'array', minItems: 3, maxItems: MAX_ITEMS, title: 'the candidates, in arrival order',
      description: 'Each {id, coarse, fine?}: `coarse` is the first recommender\'s rough score (1..5, equal scores tie), `fine` the second one\'s score, needed for every kept item that ties.',
      items: { type: 'object', required: ['id', 'coarse'], additionalProperties: false,
        properties: { id: { type: 'string', minLength: 1, maxLength: 3 }, coarse: { type: 'integer', minimum: 1, maximum: 5 }, fine: { type: 'number' } } },
      default: [
        { id: 'A', coarse: 3 }, { id: 'B', coarse: 5, fine: 0.62 }, { id: 'C', coarse: 2 }, { id: 'D', coarse: 4, fine: 0.3 }, { id: 'E', coarse: 5, fine: 0.91 },
        { id: 'F', coarse: 1 }, { id: 'G', coarse: 4, fine: 0.77 }, { id: 'H', coarse: 5, fine: 0.48 }, { id: 'I', coarse: 2 }, { id: 'J', coarse: 2 },
      ],
    },
    cut: { type: 'integer', minimum: 2, maximum: 5, default: 3, title: 'the first recommender keeps the items scoring at least this' },
    ratings: {
      type: 'array', maxItems: 4, items: { type: 'integer', minimum: 1, maximum: 5 }, default: [5, 4, 2], title: 'the ratings of the user in the story',
      description: 'The story: a new user who has rated only a few films (each 1..5 stars, drawn as a small poster with its stars). An empty list draws no user.',
    },
    labels: {
      type: 'object', additionalProperties: false, title: 'column and stage titles',
      default: { candidates: frag('Candidates', 'Adaylar'), stage1: frag('Stage 1', '1. aşama'), ranked: frag('Rough ranking', 'Kaba sıralama'),
        tie: frag('tie-break', 'eşitlik bozma'), stage2: frag('Stage 2', '2. aşama'), final: frag('Final list', 'Son liste'), cut: frag('cut', 'elenir') },
      properties: {
        candidates: fragSchema(frag('Candidates', 'Adaylar')), stage1: fragSchema(frag('Stage 1', '1. aşama')), ranked: fragSchema(frag('Rough ranking', 'Kaba sıralama')),
        tie: fragSchema(frag('tie-break', 'eşitlik bozma')), stage2: fragSchema(frag('Stage 2', '2. aşama')), final: fragSchema(frag('Final list', 'Son liste')), cut: fragSchema(frag('cut', 'elenir')),
      },
    },
    verdict: {
      type: 'array', minItems: 1, maxItems: 4, title: 'the last press: what stage 2 did and did not do',
      description: 'Each {ok, text}: ok draws a check (positive), otherwise a cross (negative). They appear one by one, after the evidence.',
      items: { type: 'object', required: ['ok', 'text'], additionalProperties: false, properties: { ok: { type: 'boolean' }, text: FRAGMENT } },
      default: [
        { ok: true, text: frag('Same groups, same slots', 'Aynı gruplar, aynı yerler') },
        { ok: true, text: frag('The single item stayed put', 'Tekil öğe yerinde kaldı') },
        { ok: false, text: frag('Cut items do not return', 'Elenenler geri dönmez') },
      ],
    },
  },
};

/** Number of presses: cascade 6 (candidates, rough ranking, cut, ties, tie-break, verdict), switch 4, designs 3 (parallel, sequential, the designs of the taxonomy), kinds 3 (homogeneous, heterogeneous, the weights), meta 3 (a profile, the profiles compared, output against model). */
const presses = (/** @type {{mode: string}} */ params) => (params.mode === 'switch' ? 4 : ['designs', 'kinds', 'meta'].includes(params.mode) ? 3 : 6);

/** @param {Document} doc @param {'check'|'cross'} kind */
function verdictMark(doc, kind) {
  const sv = s(doc, 'svg', { class: `pl-icon ${kind}`, width: '40', height: '40', viewBox: '0 0 40 40', 'aria-hidden': 'true' });
  sv.append(s(doc, 'path', { d: kind === 'check' ? 'M7 21l9 9 17-20' : 'M9 9l22 22M31 9L9 31', 'data-gfx': 'stroke', fill: 'none', 'stroke-width': '5', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
  return sv;
}

export default defineWidget({
  id: 'pipeline',
  steps: 'cascade mode, six presses: the candidates appear, the first recommender ranks them roughly (many tie), it cuts the weakest, the ties are bracketed and the second recommender scores only them, it orders each tie inside its group, then the verdict (same groups, the single item stayed put, cut items do not return). switch mode, four presses: a new user (three ratings) is switched to the content-based way, a user with a long history to the collaborative way, the bucket of models picks the winner by held-out error, then wrong (by training error) next to right (by held-out error). designs mode, three presses: the parallel design (an input, two recommenders side by side, a combiner, a prediction), the sequential design (a chain that ends in the same combiner, with two dashed arrows that may also be there: the original input to the next recommender and the earlier output to the combiner), then two chips under each panel naming the designs of the taxonomy that belong to it, in the order of the tree. kinds mode, three presses: the homogeneous panel (one box of data, three different models, a weighted blend, a prediction), the heterogeneous panel (two boxes of data of two kinds, a collaborative and a content-based model, the same blend; the upper panel goes quiet), then the weights of the lower panel come forward (the two arrows into the blend drawn again, thicker, with the labels w1 and w2). meta mode, three presses: the content-based model learns a profile (one card, a user and three bars), two more users and the pill that joins the two alike profiles while the collaborative model reads the three, then two rows, feature augmentation (an output, a rating, is handed on) above meta-level (the model itself is).',
  params: schema,
  stepCount: presses,
  check: (params) => (params.mode === 'designs' ? designsProblems(params) : params.mode === 'kinds' ? kindsProblems(params) : params.mode === 'meta' ? metaProblems(params) : []),   // WP-50, WP-51: the mode's own rules, pure
  // The sample cascade, and a smaller one (five items: one tie of two, three kept, two cut).
  examples: [{}, { cut: 3, items: [{ id: 'P', coarse: 5, fine: 0.4 }, { id: 'Q', coarse: 5, fine: 0.8 }, { id: 'R', coarse: 3 }, { id: 'S', coarse: 2 }, { id: 'T', coarse: 1 }] }, ...switchExamples, ...designsExamples, ...kindsExamples, ...metaExamples],
  build(ctx, P) {
    if (P.mode === 'switch') return switchBuild(ctx, P);                  // the switch mode has its own picture (pipeline-switch.js)
    if (P.mode === 'designs') return designsBuild(ctx, P);                // WP-50: so has the designs mode (pipeline-designs.js)
    if (P.mode === 'kinds') return kindsBuild(ctx, P);                    // WP-51: and the kinds mode (pipeline-kinds.js)
    if (P.mode === 'meta') return metaBuild(ctx, P);                      // WP-51: and the meta mode (pipeline-meta.js)
    const doc = ctx.slot.ownerDocument;
    /** @type {Array<{id: string, coarse: number, fine?: number}>} */
    const items = P.items;
    const N = items.length;
    const ids = new Set(items.map((x) => x.id));
    if (ids.size !== N) throw new Error('pipeline: item ids must be distinct');

    // ---------- the cascade, computed once ----------
    const byCoarse = items.map((it, i) => ({ it, i })).sort((a, b) => b.it.coarse - a.it.coarse || a.i - b.i);
    /** @type {Map<string, number>} */ const rank1 = new Map(byCoarse.map((x, r) => [x.it.id, r]));
    const input = new Map(items.map((it, i) => [it.id, i]));
    const kept = byCoarse.filter((x) => x.it.coarse >= P.cut).map((x) => x.it);
    const cutItems = byCoarse.filter((x) => x.it.coarse < P.cut).map((x) => x.it);
    const K = kept.length, D = cutItems.length;
    if (!K || !D) throw new Error('pipeline: the cut must keep some items and drop some');
    /** @type {Array<{start: number, ids: string[]}>} */
    const groups = [];
    kept.forEach((it, r) => {
      const g = groups[groups.length - 1];
      if (g && items[/** @type {number} */ (input.get(g.ids[0]))].coarse === it.coarse) g.ids.push(it.id); else groups.push({ start: r, ids: [it.id] });
    });
    const ties = groups.filter((g) => g.ids.length > 1);
    /** @type {Map<string, number>} */ const rowC = new Map();
    for (const g of groups) {
      const sorted = [...g.ids];
      if (g.ids.length > 1) {
        for (const id of g.ids) if (typeof items[/** @type {number} */ (input.get(id))].fine !== 'number') throw new Error(`pipeline: item "${id}" ties and needs a "fine" score`);
        sorted.sort((a, b) => /** @type {number} */ (items[/** @type {number} */ (input.get(b))].fine) - /** @type {number} */ (items[/** @type {number} */ (input.get(a))].fine));
      }
      sorted.forEach((id, j) => rowC.set(id, g.start + j));
    }
    const tiedIds = ties.flatMap((g) => g.ids);
    const cutSet = new Set(cutItems.map((x) => x.id));
    const n = presses(P);
    const rowY = (/** @type {number} */ r) => Y0 + PITCH * r;
    const posA = (/** @type {string} */ id) => `translate(${AX}px, ${rowY(/** @type {number} */ (input.get(id)))}px)`;
    const posB = (/** @type {string} */ id, /** @type {boolean} */ gap) => `translate(${BX}px, ${rowY(/** @type {number} */ (rank1.get(id))) + (gap && cutSet.has(id) ? CUT_GAP : 0)}px)`;
    const posC = (/** @type {string} */ id) => `translate(${CX}px, ${rowY(/** @type {number} */ (rowC.get(id)))}px)`;

    // ---------- DOM ----------
    const root = h(doc, 'div', 'w-root pl-root');
    root.style.cssText = `width:${W}px;height:${H}px`;
    const sc = fit(ctx, W, H);
    if (Math.abs(sc - 1) > 0.001) root.style.transform = `scale(${sc})`;
    /** @type {Map<string, Element>} */
    const els = new Map();
    const box = (/** @type {number} */ x, /** @type {number} */ y, /** @type {number} */ w, /** @type {number} */ hh) => `left:${x}px;top:${y}px;width:${w}px;height:${hh}px`;
    /** @param {string} key @param {HTMLElement|SVGElement} el @param {string} css @param {Record<string, string>} [text] */
    const put = (key, el, css, text) => {
      /** @type {HTMLElement} */ (el).style.cssText += `;${css}`;
      if (text) ctx.setText(/** @type {HTMLElement} */ (el), text);
      el.setAttribute('data-key', key);
      els.set(key, el);
      root.append(el);
      return el;
    };
    const L = P.labels;
    const bandTop = Y0 - 8, bandH = Y0 + PITCH * (N - 1) + CUT_GAP + CHIP_H + 8 - bandTop;

    // the two recommenders are gates the films pass: stage 1 a coarse funnel, stage 2 a magnifier (the picture of "look closer, only at the ties")
    const band1 = put('band1', h(doc, 'div', 'pl-band', { 'aria-hidden': 'true' }), box(BAND1, bandTop, BAND_W, bandH));
    const band2 = put('band2', h(doc, 'div', 'pl-band', { 'aria-hidden': 'true' }), box(BAND2, bandTop, BAND_W, bandH));
    for (const [b, name] of /** @type {const} */ ([[band1, 'funnel'], [band2, 'magnifier']])) {
      const ic = icon(doc, name, 56);
      ic.style.cssText = `position:absolute;left:${(BAND_W - 56) / 2 - 3}px;top:${bandH / 2 - 28}px`;
      b.append(ic);
    }

    // the story: a new user who has rated only a few films (small posters with their stars)
    if (P.ratings.length) {
      const story = h(doc, 'div', 'pl-story', { 'aria-hidden': 'true' });
      story.style.cssText = box(1380, 0, 330, 140);
      const user = icon(doc, 'user', 60);
      user.style.cssText = 'position:absolute;left:0;top:24px';
      story.append(user);
      P.ratings.forEach((/** @type {number} */ r, /** @type {number} */ i) => {
        const card = h(doc, 'div', 'pl-mini');
        card.style.cssText = `left:${84 + i * 84}px;top:8px`;
        card.append(emblem(doc, [4, 8, 1, 5][i % 4], 30));
        const st = starRow(doc, r, 12, 1);
        st.style.cssText += ';position:absolute;left:-3px;top:80px';
        card.append(st);
        story.append(card);
      });
      root.append(story);
    }
    const headA = h(doc, 'div', 'pl-head');
    headA.style.cssText = box(AX, 0, 300, 40);
    ctx.setText(headA, L.candidates);
    root.append(headA);
    put('h:s1', h(doc, 'div', 'pl-head pl-head-c'), box(BAND1 - 20, 0, BAND_W + 40, 40), L.stage1);
    put('h:B', h(doc, 'div', 'pl-head'), box(BX, 0, 200, 40), L.ranked);
    put('h:fine', h(doc, 'div', 'pl-head pl-head-r small'), box(BX + 200, 0, 100, 40), L.tie);     // over the scores while they stand in the ranked list ...
    put('h:fineC', h(doc, 'div', 'pl-head pl-head-r small'), box(CX + 200, 0, 100, 40), L.tie);    // ... and over them once they have moved on
    put('h:s2', h(doc, 'div', 'pl-head pl-head-c'), box(BAND2 - 20, 0, BAND_W + 40, 40), L.stage2);
    put('h:C', h(doc, 'div', 'pl-head'), box(CX, 0, 300, 40), L.final);

    // placeholders: where a chip stood before it moved on
    for (let r = 0; r < N; r++) put(`phA:${r}`, h(doc, 'div', 'pl-ph', { 'data-gfx': 'border', 'aria-hidden': 'true' }), box(AX, rowY(r), CHIP_W, CHIP_H));
    for (let r = 0; r < K; r++) put(`phB:${r}`, h(doc, 'div', 'pl-ph', { 'data-gfx': 'border', 'aria-hidden': 'true' }), box(BX, rowY(r), CHIP_W, CHIP_H));

    // the cut line
    const cutY = rowY(K - 1) + CHIP_H + 8;
    put('cut', h(doc, 'div', 'pl-cut', { 'data-gfx': 'fill', 'aria-hidden': 'true' }), box(BX - 10, cutY, 330, 3));
    put('cutl', h(doc, 'div', 'pl-cutl'), box(BX - 10, cutY + 5, 330, 26), L.cut);

    // tie brackets, in the ranked list (B) and in the final list (C)
    ties.forEach((g, i) => {
      const top = rowY(g.start) - 2, hh = PITCH * (g.ids.length - 1) + CHIP_H + 4;
      put(`brB:${i}`, h(doc, 'div', 'pl-bracket', { 'data-gfx': 'border-right', 'aria-hidden': 'true' }), box(BX + 326, top, 16, hh));
      put(`brC:${i}`, h(doc, 'div', 'pl-bracket', { 'data-gfx': 'border-right', 'aria-hidden': 'true' }), box(CX + 326, top, 16, hh));
    });

    // the items
    for (const it of items) {
      const wrap = h(doc, 'div', 'pl-item', { 'data-item': it.id });
      wrap.style.cssText = `left:0;top:0;width:340px;height:${CHIP_H}px`;
      const chip = h(doc, 'div', 'pl-chip');
      // a chip is a small poster: a generic emblem (told apart by shape, no real film) and the item's letter
      const faceOf = (/** @type {HTMLElement} */ layer) => {
        layer.append(emblem(doc, /** @type {number} */ (input.get(it.id)), 24));
        const letter = h(doc, 'span', 'pl-letter');
        ctx.setText(letter, frag(it.id, it.id));
        layer.append(letter);
      };
      const keep = h(doc, 'div', 'pl-layer pl-keep');
      faceOf(keep);
      chip.append(keep);
      if (cutSet.has(it.id)) {
        const drop = h(doc, 'div', 'pl-layer pl-drop', { 'aria-hidden': 'true', 'data-key': `cd:${it.id}` });
        faceOf(drop);
        chip.append(drop);
        els.set(`cd:${it.id}`, drop);
        const strike = h(doc, 'div', 'pl-strike', { 'aria-hidden': 'true', 'data-key': `s:${it.id}`, 'data-gfx': 'fill' });
        wrap.append(strike);
        els.set(`s:${it.id}`, strike);
        const x = h(doc, 'div', 'pl-mark', { 'aria-hidden': 'true', 'data-key': `x:${it.id}`, 'data-role': 'neg' });
        x.append(verdictMark(doc, 'cross'));
        wrap.append(x);
        els.set(`x:${it.id}`, x);
      }
      const pips = h(doc, 'div', 'pl-pips', { 'data-key': `p:${it.id}`, 'aria-hidden': 'true' });
      for (let q = 1; q <= 5; q++) pips.append(h(doc, 'span', q <= it.coarse ? 'on' : 'off', q <= it.coarse ? { 'data-gfx': 'fill' } : { 'data-gfx': 'border' }));
      els.set(`p:${it.id}`, pips);
      wrap.append(chip, pips);
      if (tiedIds.includes(it.id)) {
        const fine = h(doc, 'div', 'pl-fine', { 'data-key': `f:${it.id}` });
        ctx.setText(fine, { en: /** @type {number} */ (it.fine).toFixed(2), tr: /** @type {number} */ (it.fine).toFixed(2).replace('.', ',') });
        wrap.append(fine);
        els.set(`f:${it.id}`, fine);
      }
      wrap.setAttribute('data-key', `i:${it.id}`);
      els.set(`i:${it.id}`, wrap);
      root.append(wrap);
    }

    // the verdict
    /** @type {Array<{ok: boolean, text: Record<string, string>}>} */
    const verdict = P.verdict;
    verdict.forEach((v, j) => {
      const row = h(doc, 'div', 'pl-verdict', { 'data-role': v.ok ? 'pos' : 'neg' });
      row.append(verdictMark(doc, v.ok ? 'check' : 'cross'));
      const t = h(doc, 'span', 'pl-vtext');
      ctx.setText(t, v.text);
      row.append(t);
      put(`v:${j}`, row, box(1380, 200 + j * 120, 300, 100));
    });

    // ---------- frames and timing ----------
    const frame = (/** @type {number} */ k) => {
      /** @type {Map<string, Record<string, string>>} */
      const f = new Map();
      const on = (/** @type {boolean} */ b) => ({ opacity: b ? '1' : '0' });
      f.set('band1', on(k >= 2)); f.set('band2', on(k >= 4));
      f.set('h:s1', on(k >= 2)); f.set('h:B', on(k >= 2)); f.set('h:fine', on(k === 4)); f.set('h:fineC', on(k >= 5)); f.set('h:s2', on(k >= 4)); f.set('h:C', on(k >= 5));
      for (let r = 0; r < N; r++) f.set(`phA:${r}`, on(k >= 2));
      for (let r = 0; r < K; r++) f.set(`phB:${r}`, on(k >= 5));
      f.set('cut', { opacity: k >= 3 ? '1' : '0', transform: k >= 3 ? 'scaleX(1)' : 'scaleX(0)' });
      f.set('cutl', on(k >= 3));
      ties.forEach((_, i) => {
        f.set(`brB:${i}`, { opacity: k >= 4 ? '1' : '0', transform: k >= 4 ? 'scaleY(1)' : 'scaleY(0)' });
        f.set(`brC:${i}`, { opacity: k >= 6 ? '1' : '0', transform: k >= 6 ? 'scaleY(1)' : 'scaleY(0)' });
      });
      for (const it of items) {
        const id = it.id;
        const place = k <= 0 ? `translate(${AX - 20}px, ${rowY(/** @type {number} */ (input.get(id)))}px)`
          : k === 1 ? posA(id) : k < 5 || cutSet.has(id) ? posB(id, k >= 3) : posC(id);
        f.set(`i:${id}`, { opacity: k >= 1 ? '1' : '0', transform: place });
        f.set(`p:${id}`, { opacity: k >= 2 ? '1' : '0', transform: k >= 2 ? 'scaleX(1)' : 'scaleX(0)' });
        if (tiedIds.includes(id)) f.set(`f:${id}`, on(k >= 4));
        if (cutSet.has(id)) {
          f.set(`cd:${id}`, on(k >= 3));
          f.set(`s:${id}`, { opacity: k >= 3 ? '1' : '0', transform: k >= 3 ? 'scaleX(1)' : 'scaleX(0)' });
          f.set(`x:${id}`, on(k >= 6));
        }
      }
      verdict.forEach((_, j) => f.set(`v:${j}`, k >= 6 ? { opacity: '1', transform: 'translateY(0px)' } : { opacity: '0', transform: 'translateY(12px)' }));
      return f;
    };
    /** @param {string} key @param {number} k */
    const timing = (key, k) => {
      const c = key.indexOf(':');
      const kind = c < 0 ? key : key.slice(0, c);
      const name = c < 0 ? '' : key.slice(c + 1);
      const r1 = rank1.get(name) ?? 0;
      const dOrder = cutItems.findIndex((x) => x.id === name);
      if (k === 1) return { start: /** @type {number} */ (input.get(name)) * 45, duration: 420 };
      if (k === 2) {
        if (kind === 'i') return { start: r1 * 40, duration: 760 };
        if (kind === 'p') return { start: r1 * 40 + 520, duration: 320 };
        if (kind === 'phA') { const id = byCoarse.find((x) => x.i === Number(name))?.it.id ?? ''; return { start: /** @type {number} */ (rank1.get(id)) * 40, duration: 200 }; }
        return { start: 0, duration: 320 };                                   // band1, h:s1, h:B
      }
      if (k === 3) {
        if (kind === 'i' || kind === 'cd') return { start: 260 + dOrder * 60, duration: 420 };
        if (kind === 's') return { start: 260 + dOrder * 60 + 300, duration: 320 };
        return { start: 0, duration: 420 };                                   // cut, cutl
      }
      if (k === 4) {
        if (kind === 'brB') return { start: 240 + Number(name) * 160, duration: 420 };
        if (kind === 'f') return { start: 600 + tiedIds.indexOf(name) * 90, duration: 360 };
        return { start: 0, duration: 320 };                                   // band2, h:s2, h:fine
      }
      if (k === 5) {
        if (kind === 'i') {
          const yB = rowY(/** @type {number} */ (rank1.get(name)));
          return { start: /** @type {number} */ (rowC.get(name)) * 60, duration: 1100, via: [{ offset: 0.45, transform: `translate(${CX}px, ${yB}px)` }] };
        }
        return { start: 0, duration: kind === 'phB' ? 240 : 320 };           // phB, h:C
      }
      if (kind === 'brC') return { start: Number(name) * 160, duration: 420 };
      if (kind === 'x') return { start: 300 + dOrder * 80, duration: 320 };
      return { start: 500 + Number(name) * 330, duration: 420 };             // v:j
    };

    ctx.slot.append(root);
    const steps = stepsFromFrames({ n, els, frame, timing, easing: ctx.defaults.easing });
    steps[0].final();                                                          // the base DOM is the picture of state 0
    return { steps, destroy: () => root.remove() };
  },
});
