// @ts-check
// WP-74 (D-149, D-150; brief 09; pages 14 `confusion` and 15 `precision-recall` of the I2RS w07 deck, storyboard §3): the mode `confusion` of table-highlight. A 2 x 2 table of what a recommender did against what the user liked,
// told as a picture in two views: `outcomes` (page 14, five presses) and `measures` (page 15, six presses since WP-93, D-177). The counts are a toy: the speaker note and the evidence record say so, the picture carries no label (D-129).
//
// The table: columns are what the user thinks (liked, not liked), rows what the recommender did (recommended, not recommended): TP (recommended and liked), FP (recommended, not liked), FN (liked, not recommended), TN (neither).
// A right outcome (TP, TN) is a solid green frame and a tick, a wrong one (FP, FN) a dashed red frame and a cross (D-068: shape and frame carry it, not colour alone).
//
// By hand, the lecture's counts (200 films): TP 40, FP 10, FN 20, TN 130. Accuracy = (40 + 130) / 200 = 0.85; precision = 40 / (40 + 10) = 0.80; recall = 40 / (40 + 20) = 0.667; specificity = 130 / (10 + 130) = 0.929;
// F1 = 2 * 0.8 * 0.667 / (0.8 + 0.667) = 0.727. The imbalanced case (1,000 users, 20 like the film, a recommender that recommends nothing): accuracy = 980 / 1000 = 0.98, and it finds 0 of 20. The trade-off (500 films, 60 liked):
// "one famous band" recommends 10 films, 9 liked: precision 0.90, recall 9 / 60 = 0.15, F1 = 0.257, the average of the two 0.525; "all of rock" recommends 200, all 60 liked among them: precision 0.30, recall 1.00, F1 = 0.462, the average 0.65.
//
// View `outcomes`, states (0 is the empty frame of the table: its headers and four dashed cells):
//   1 four outcomes  TP, FP, FN, TN come in, each with its name and its count
//   2 two errors     FP is a Type I error, FN a Type II one (a tag on each cell)
//   3 which is worse the two wrong cells are ringed; two opposite tasks (Herlocker 2004, p. 10 and 14-15): a film for tonight (a bad pick costs an evening: FP is worse; a missed good film costs almost nothing) and a lawyer looking for
//                     precedents (a missed case, FN, is unacceptable; a few irrelevant results are bearable); each error carries its verdict as a word and a frame
//   4 accuracy       (TP + TN) / all, the two right cells ringed, a panel as tall as the matrix: the title "accuracy", its how-line ("of all the films, how many we got right", D-176), one formula line (D-174: symbolic fraction = the fraction
//                     with the numbers = the value) and a gauge. Accuracy uses all four cells, so none is grey
//   5 imbalance      the table STAYS and its numbers become the imbalanced case's (1,000 users, 20 like the film, a recommender that recommends nothing), the TP = 0 cell is ringed (negative); to its right the accuracy
//                     0.98 (frac(0 + 980|1000)) and, in the negative role, a panel that says in WORDS what happened: "it found none of the 20 films the user likes" (D-176: recall is introduced on page 11, so there is no recall
//                     formula, gauge or name here)
// WP-93 (D-176): in the view `measures` the cells that the formula on the screen does NOT use are grey (a grey twin on top of the cell, see USES): precision leaves FN and TN grey, recall FP and TN, specificity TP and FN.
// View `measures`, states (0 is the filled table of the lecture):
//   WP-93 (D-177, the user's choice on board 3, 2026-11-01): SIX presses; the lecture's table stays for the three measures that need it, then each recommender's problem is shown on its OWN matrix before its card:
//   1 precision      the row "recommended" is banded; TP / (TP + FP), the numbers, the gauge; FN and TN are grey
//   2 recall         the column "liked" is banded; TP / (TP + FN), the numbers, the gauge; "sensitivity" is the same thing; FP and TN are grey
//   3 specificity    (it was press 5) the column "not liked" is banded; TN / (FP + TN); TP and FN are grey; the lecture's table leaves in press 4 and never comes back
//   4 famous band    the lecture's table leaves; the matrix of ONE FAMOUS BAND comes in (TP 9, FP 1, FN 51, TN 439: board 3's candidate A, a table with its row heads and a column group of its own, TN grey: precision and recall do not use it), then its card with the
//                    precision and recall bars: the problem first (precision high, recall low)
//   5 all of rock    the matrix of ALL OF ROCK joins the first one in the second column group (TP 60, FP 140, FN 0, TN 300, TN grey), then its card with its bars (the reverse); the band's matrix and card stay
//   6 F1             the two matrices fly away (to the left); the two cards stand as they did in the old press 4 and get the harmonic mean next to the average of the two: the average is a wrong average (0.525 against 0.257, 0.65 against 0.462); each card ends in the F1 line frac(2 · P · R|P + R) = frac(2 · 0.90 · 0.15|0.90 + 0.15) = 0.26
//
// duration(k) = pressDuration (u = 380 ms; the tests work them out by hand; the browser reports the same). Outcomes: 750 / 660 / 940 / 1260 / 1400 ms (press 5 was 1640 ms with the recall gauge, D-176). Measures (D-177, six presses): 1200 / 1200 / 1200 / 1400 / 1400 / 1320 ms.
//
// Motion: opacity and transform (scale pops, scaleX for a gauge). Nothing else.
import { h } from './frames.js';
import { icon } from './pictos.js';
import { formulaProblem, renderFormula } from './formula.js';
import { U, fillFragL, finish, frag, group, grow, labelsSchema, num, on, pop, pressDuration, rise, scene } from './w07-common.js';

const MX = 250, MY = 132, CW = 220, CH = 172, CG = 10;
const PX = 770;
const PANEL = { y: 110, w: 860 };

const LABELS = {
  liked: frag('liked', 'beğendi'), notLiked: frag('not liked', 'beğenmedi'), rec: frag('recommended', 'önerildi'), notRec: frag('not recommended', 'önerilmedi'),
  tpName: frag('liked and recommended', 'beğendi, önerildi'), fpName: frag('recommended, not liked', 'önerildi, beğenmedi'), fnName: frag('liked, not recommended', 'beğendi, önerilmedi'), tnName: frag('neither', 'ikisi de değil'),
  type1: frag('Type I', 'Tip I'), type2: frag('Type II', 'Tip II'), which: frag('which is worse?', 'hangisi daha kötü?'),
  // WP-74 (brief 09, Ek 2 item 1; Herlocker 2004 p. 10 and 14-15): two opposite tasks instead of the two pizza stories: for a film a bad pick is the worse error, for a lawyer looking for precedents a missed case is
  taskA: frag('a film for tonight', 'bu akşam için bir film'), fpA: frag('a bad pick costs an evening', 'kötü öneri bir akşama mal olur'), fnA: frag('a missed good film costs almost nothing', 'kaçan iyi film neredeyse bedava'),
  taskB: frag('a lawyer looking for precedents', 'emsal arayan bir avukat'), fpB: frag('a few irrelevant results', 'birkaç ilgisiz sonuç'), fnB: frag('a missed case', 'kaçan bir dava'),
  worseTag: frag('worse', 'daha kötü'), bearTag: frag('bearable', 'katlanılır'),
  // WP-93 (D-176, the user's review of 2026-11-01): the title and the how-line of the accuracy panel (page 10, press 4), in the voice of the how-lines of page 11; press 5 says in WORDS what the recommender that recommends nothing did (recall is only introduced on page 11)
  accuracy: frag('accuracy', 'doğruluk'), accuracyHow: frag('of all the films, how many we got right', 'tüm filmlerin kaçında doğru karar verdik'),
  imbHead: frag('{n} users, {k} like the film', '{n} kullanıcı, {k} filmi beğeniyor'), imbNote: frag('it recommends nothing', 'hiçbir şey önermiyor'),
  imbFound: frag('it found none of the {k} films the user likes', 'kullanıcının beğendiği {k} filmin hiçbirini bulamadı'),
  precision: frag('precision', 'kesinlik'), precisionHow: frag('of what I recommend, how much was liked', 'önerdiklerimin kaçı beğenildi'),
  recall: frag('recall', 'duyarlılık'), recallHow: frag('of what they like, how much did we find', 'beğendiklerinin kaçını bulduk'), sensitivity: frag('= sensitivity', '= sensitivity'),
  famous: frag('one famous band', 'tek bir ünlü grup'), rock: frag('all of rock', 'bütün rock'), p: frag('precision', 'kesinlik'), r: frag('recall', 'duyarlılık'),
  f1: frag('F1 (harmonic mean)', 'F1 (harmonik ortalama)'), mean: frag('average (the wrong one)', 'ortalama (yanlış olan)'),
  // WP-93 (D-174): the symbolic part of the formulas (formula.js mark-up); the fraction with the numbers and the value are worked out from the counts
  accFormula: frag('Accuracy = frac(TP + TN|TP + TN + FP + FN)', 'Doğruluk = frac(TP + TN|TP + TN + FP + FN)'), preFormula: frag('Precision = frac(TP|TP + FP)', 'Kesinlik = frac(TP|TP + FP)'),
  recFormula: frag('Recall = frac(TP|TP + FN)', 'Duyarlılık = frac(TP|TP + FN)'), speFormula: frag('Specificity = frac(TN|FP + TN)', 'Özgüllük = frac(TN|FP + TN)'),
  f1Formula: frag('F1 = frac(2 · P · R|P + R)', 'F1 = frac(2 · P · R|P + R)'),
  specificity: frag('specificity', 'özgüllük'), specificityHow: frag('of what they do not like, how much did we leave out', 'beğenmediklerinin kaçını dışarıda bıraktık'),
};
const WORSE = ['fp', 'fn'];
/** WP-93 (the user's w07 review, step 2): a Type I / II tag is 40 px high (22 px type, 6 + 6 padding, 3 + 3 border) and stands 10 px from the cell's right AND bottom edge. */
const TAG = { h: 40, gap: 10 };
/** The right column of the page and the matrix it lines up with (WP-93): from the matrix's top to its bottom. */
const COLUMN = { y: MY, h: 2 * CH + CG };
/** The height of the card of one recommender in press 3 and 4 of `measures` (380 before the F1 formula under the bars, WP-93). */
const SCORE_H = 420;
const COUNTS = { tp: 40, fp: 10, fn: 20, tn: 130 };
const IMBALANCE = { tp: 0, fp: 0, fn: 20, tn: 980 };
const FAMOUS = { tp: 9, fp: 1, fn: 51, tn: 439 };
const ROCK = { tp: 60, fp: 140, fn: 0, tn: 300 };
const COUNT_SCHEMA = (/** @type {Record<string, number>} */ d) => ({
  type: 'object', additionalProperties: false, required: ['tp', 'fp', 'fn', 'tn'], default: d,
  properties: { tp: { type: 'integer', minimum: 0, default: d.tp }, fp: { type: 'integer', minimum: 0, default: d.fp }, fn: { type: 'integer', minimum: 0, default: d.fn }, tn: { type: 'integer', minimum: 0, default: d.tn } },
});

/** The params of the mode `confusion`, merged into table-highlight's schema (the registry carries the whole). */
export const confusionSchema = {
  type: 'object', additionalProperties: false, title: 'the confusion-table mode (mode confusion)',
  description: '`view` is `outcomes` (page 14: the four outcomes, the two errors, which is worse, accuracy, class imbalance) or `measures` (page 15: precision, recall, the trade-off, F1, specificity). `counts` fill the table; `imbalance` is press 5 of `outcomes` '
    + '(a recommender that recommends nothing); `famous` and `rock` are the two recommenders of press 3 and 4 of `measures`. `worse` names the error that is worse in each of the two tasks of press 3 of `outcomes` (`fp` or `fn`; the film: a bad pick, the lawyer: a '
    + 'missed case). All counts are a toy; the picture carries no label.',
  default: { view: 'outcomes', counts: COUNTS, imbalance: IMBALANCE, famous: FAMOUS, rock: ROCK, worse: WORSE, labels: LABELS },
  properties: {
    view: { type: 'string', enum: ['outcomes', 'measures'], default: 'outcomes' },
    worse: { type: 'array', minItems: 2, maxItems: 2, items: { type: 'string', enum: ['fp', 'fn'] }, default: WORSE },
    counts: COUNT_SCHEMA(COUNTS), imbalance: COUNT_SCHEMA(IMBALANCE), famous: COUNT_SCHEMA(FAMOUS), rock: COUNT_SCHEMA(ROCK),
    labels: labelsSchema(LABELS, '`imbHead` holds {n} (the users) and {k} (the ones who like it), `imbFound` {k}.'),
  },
};
export const confusionExamples = [{ mode: 'confusion' }, { mode: 'confusion', confusion: { view: 'measures' } }, { mode: 'confusion', confusion: { counts: { tp: 6, fp: 2, fn: 3, tn: 9 } } }];
export const confusionPresses = 5;
/** WP-93 (D-177): the number of presses of a view: `outcomes` five, `measures` six (precision, recall, specificity, the band, the rock, F1). @param {any} P the params of table-highlight (or of the mode) */
export const confusionPressesOf = (P) => ((P?.confusion ?? P)?.view === 'measures' ? 6 : 5);

/** @param {{tp: number, fp: number, fn: number, tn: number}} c @returns {number} */
const total = (c) => c.tp + c.fp + c.fn + c.tn;

/** WP-93 (D-177): the way a recommender's matrix leaves: to the left, in 500 ms (the matrices of the band and the rock "fly away" when the F1 cards come). */
const FLY = { start: 0, duration: 500 };
/** Shown from press `from` up to (not including) press `to`: it rises in before, and flies away to the left after. @param {number} k @param {number} from @param {number} to */
const between = (k, from, to) => (k < from ? rise(false) : k < to ? rise(true) : { opacity: '0', transform: 'translateX(-90px)' });
/** The four cells, in the order the picture keys them (`cf:i`, `gy:i`). */
export const CELL_KEYS = Object.freeze(['tp', 'fp', 'fn', 'tn']);
/**
 * WP-93 (D-176, the user's review of 2026-11-01, "more meaningful and memorable"): which cells each measure's formula is made of. The cells it does NOT use turn grey while the formula shows: precision TP / (TP + FP) leaves FN and TN
 * grey, recall TP / (TP + FN) leaves FP and TN, specificity TN / (FP + TN) leaves TP and FN, accuracy (TP + TN) / all leaves none; F1 works from precision and recall, so it uses TP, FP and FN and leaves TN. Pure data: the test changes each count
 * and checks that the value of a measure moves exactly when a cell it uses moves.
 * @type {Readonly<Record<'accuracy'|'precision'|'recall'|'specificity'|'f1', ReadonlyArray<'tp'|'fp'|'fn'|'tn'>>>}
 */
export const USES = Object.freeze({ accuracy: ['tp', 'fp', 'fn', 'tn'], precision: ['tp', 'fp'], recall: ['tp', 'fn'], specificity: ['fp', 'tn'], f1: ['tp', 'fp', 'fn'] });
/** The cells a measure's formula does not use (they turn grey). Pure. @param {keyof typeof USES} measure @returns {Array<'tp'|'fp'|'fn'|'tn'>} */
export const unusedCells = (measure) => /** @type {Array<'tp'|'fp'|'fn'|'tn'>} */ (CELL_KEYS.filter((c) => !USES[measure].includes(/** @type {any} */ (c))));
/** The measure whose formula shows in a press of the view `measures` while the lecture's table is on the screen (presses 1 to 3; D-177: the table is away from press 4 on, where each recommender has its own matrix with TN grey): the cells it does not use are grey. */
export const GREY_AT = Object.freeze({ 1: 'precision', 2: 'recall', 3: 'specificity' });
/** The cells that are grey in press k of the view `measures` (none when no formula shows over the lecture's table). Pure. @param {number} k @returns {Array<'tp'|'fp'|'fn'|'tn'>} */
export const greyCells = (k) => { const measure = /** @type {Record<number, keyof typeof USES>} */ (GREY_AT)[k]; return measure ? unusedCells(measure) : []; };
/** accuracy, precision, recall, specificity, F1 of a table (0 when the denominator is 0). @param {{tp: number, fp: number, fn: number, tn: number}} c */
export function measures(c) {
  const div = (/** @type {number} */ a, /** @type {number} */ b) => (b === 0 ? 0 : a / b);
  const precision = div(c.tp, c.tp + c.fp), recall = div(c.tp, c.tp + c.fn);
  return { accuracy: div(c.tp + c.tn, total(c)), precision, recall, specificity: div(c.tn, c.fp + c.tn), f1: div(2 * precision * recall, precision + recall), mean: (precision + recall) / 2 };
}

/**
 * WP-93 (D-174): a value as the formulas write it: 0 and 1 without decimals, every other with two; the decimal comma in Turkish. Pure.
 * @param {number} v @param {'en'|'tr'} lang @returns {string}
 */
export function formulaValue(v, lang) {
  const s = v === 0 || v === 1 ? String(v) : v.toFixed(2);
  return lang === 'tr' ? s.replace('.', ',') : s;
}

/**
 * WP-93 (D-174): the four formulas of a table, per language: the symbolic fraction (a label) = the fraction with the numbers = the value, e.g. `Accuracy = frac(TP + TN|TP + TN + FP + FN) = frac(40 + 130|200) = 0.85`. Pure.
 * @param {{tp: number, fp: number, fn: number, tn: number}} c @param {Record<string, Record<string, string>>} L the labels
 * @returns {Record<'accuracy'|'precision'|'recall'|'specificity'|'f1', Record<'en'|'tr', string>>}
 */
export function confusionFormulas(c, L) {
  const m = measures(c);
  /** @type {Array<['accuracy'|'precision'|'recall'|'specificity', string, string, number]>} */
  const rows = [['accuracy', 'accFormula', `${c.tp} + ${c.tn}|${total(c)}`, m.accuracy], ['precision', 'preFormula', `${c.tp}|${c.tp + c.fp}`, m.precision], ['recall', 'recFormula', `${c.tp}|${c.tp + c.fn}`, m.recall], ['specificity', 'speFormula', `${c.tn}|${c.fp + c.tn}`, m.specificity]];
  const out = /** @type {any} */ (Object.fromEntries(rows.map(([name, key, frac, v]) => [name, Object.fromEntries(['en', 'tr'].map((lang) => [lang, `${L[key][lang] ?? L[key].en} = frac(${frac}) = ${formulaValue(v, /** @type {'en'|'tr'} */ (lang))}`]))])));
  // F1 works from the two numbers as the page shows them (precision and recall with two decimals): F1 = frac(2 · P · R|P + R) = frac(2 · 0.90 · 0.15|0.90 + 0.15) = 0.26
  out.f1 = Object.fromEntries(['en', 'tr'].map((lang) => {
    const p = formulaValue(m.precision, /** @type {'en'|'tr'} */ (lang)), r = formulaValue(m.recall, /** @type {'en'|'tr'} */ (lang));
    return [lang, `${L.f1Formula[lang] ?? L.f1Formula.en} = frac(2 · ${p} · ${r}|${p} + ${r}) = ${formulaValue(m.f1, /** @type {'en'|'tr'} */ (lang))}`];
  }));
  return out;
}

/**
 * What the picture needs of the params that the schema subset cannot say (empty: fine). Pure.
 * @param {any} P @returns {Array<{path: string, detail: string}>}
 */
export function confusionProblems(P) {
  /** @type {Array<{path: string, detail: string}>} */ const out = [];
  const bad = (/** @type {string} */ path, /** @type {string} */ detail) => { out.push({ path, detail }); };
  const Q = P.confusion;
  if (total(Q.counts) === 0) bad('$.confusion.counts', 'are all 0: a table with no film');
  if (Q.counts.tp + Q.counts.fp === 0) bad('$.confusion.counts', 'recommend nothing (tp + fp is 0): precision is undefined');
  if (Q.counts.tp + Q.counts.fn === 0) bad('$.confusion.counts', 'have no liked film (tp + fn is 0): recall is undefined');
  if (Q.counts.fp + Q.counts.tn === 0) bad('$.confusion.counts', 'have no film that is not liked (fp + tn is 0): specificity is undefined');
  for (const key of ['accFormula', 'preFormula', 'recFormula', 'speFormula', 'f1Formula']) {                    // WP-93: the formula mark-up of formula.js, refused with its place when it does not parse
    for (const [lang, txt] of Object.entries(/** @type {Record<string, any>} */ (Q.labels?.[key] ?? {}))) {
      const problem = typeof txt === 'string' ? formulaProblem(txt) : null;
      if (problem) bad(`$.confusion.labels.${key}.${lang}`, problem);
    }
  }
  if (Q.view === 'outcomes') {
    const m = measures(Q.imbalance);
    if (Q.imbalance.tp + Q.imbalance.fp !== 0) bad('$.confusion.imbalance', 'recommends something (tp + fp is not 0): the page says it recommends nothing');
    if (Q.imbalance.fn === 0) bad('$.confusion.imbalance', 'has no liked film (fn is 0): there is nothing it fails to find');
    else if (m.accuracy <= 0.9) bad('$.confusion.imbalance', `has an accuracy of ${m.accuracy.toFixed(2)}: the page says it looks excellent (above 0.90) and finds nothing`);
  } else {
    const f = measures(Q.famous), r = measures(Q.rock);
    if (!(f.precision > r.precision && f.recall < r.recall)) bad('$.confusion.famous', 'must have the higher precision and the lower recall of the two recommenders: one famous band against all of rock');
    if (!(f.f1 < f.mean && r.f1 < r.mean)) bad('$.confusion.famous', 'has an F1 that is not below the average of precision and recall (it always is unless they are equal)');
  }
  return out;
}

/**
 * The picture's data and its two pure functions, `frame(k)` and `timing(key, k)`, without a DOM.
 * @param {any} P the resolved params of table-highlight
 */
export function confusionModel(P) {
  const Q = P.confusion;
  const outcomes = Q.view === 'outcomes';
  const m = measures(Q.counts), imb = measures(Q.imbalance), fam = measures(Q.famous), roc = measures(Q.rock);
  /** @param {number} k */
  const frame = (k) => {
    /** @type {Map<string, Record<string, string>>} */
    const f = new Map();
    if (outcomes) {
      f.set('mat', { opacity: '1' });                                 // WP-93 (the user's w07 review, page 10, step 5): the table STAYS and its numbers become the imbalanced case's (n0 out, n1 in), so the 0.98 is read against a table that finds nothing
      for (let i = 0; i < 4; i++) { f.set(`cf:${i}`, pop(k >= 1)); f.set(`n0:${i}`, on(k !== 5)); f.set(`n1:${i}`, on(k === 5)); }
      f.set('t1', rise(k >= 2)); f.set('t2', rise(k >= 2));
      f.set('hl:fp', on(k === 3)); f.set('hl:fn', on(k === 3)); f.set('ta', rise(k === 3)); f.set('tb', rise(k === 3)); f.set('wh', rise(k === 3));
      f.set('hl:tp', on(k === 4)); f.set('hl:tn', on(k === 4)); f.set('acc', rise(k === 4)); f.set('ag', grow(k === 4));
      f.set('imb', rise(k === 5)); f.set('zr', rise(k === 5)); f.set('imbp', rise(k === 5)); f.set('ig', grow(k === 5)); f.set('rcl', rise(k === 5));       // WP-93: the TP = 0 ring, the accuracy panel and, in WORDS, what the recommender did not find (D-176: no recall formula, no gauge, no name: recall comes on page 11)
    } else {
      f.set('mat', { opacity: k <= 3 ? '1' : '0' });                                   // WP-93 (D-177): the lecture's table goes in press 4 and never comes back: the recommenders' own counts are not its numbers
      f.set('bd:rec', on(k === 1)); f.set('bd:liked', on(k === 2)); f.set('bd:not', on(k === 3));
      f.set('pp', rise(k === 1)); f.set('pg', grow(k === 1)); f.set('rp', rise(k === 2)); f.set('rg', grow(k === 2)); f.set('sp', rise(k === 3)); f.set('sg', grow(k === 3));
      CELL_KEYS.forEach((c, i) => f.set(`gy:${i}`, on(greyCells(k).includes(c))));                                  // WP-93 (D-176): the grey twin of a cell that the formula on the screen does not use
      // WP-93 (D-177): the row heads (`sh`, shared) and each recommender's column group (`mx:i`: its name, its column heads and its four cells) come in with the recommender's press (4 and 5), stay, and fly away to the left in press 6
      f.set('sh', between(k, 4, 6));
      for (const i of [0, 1]) {
        f.set(`mx:${i}`, between(k, 4 + i, 6));
        f.set(`sc:${i}`, rise(k >= 4 + i));                                                                   // the card follows its matrix and stays
        f.set(`p:${i}`, grow(k >= 4 + i)); f.set(`r:${i}`, grow(k >= 4 + i));
        f.set(`f:${i}`, grow(k === 6)); f.set(`a:${i}`, grow(k === 6)); f.set(`fm:${i}`, rise(k === 6));      // WP-93 (D-174): the F1 formula of each recommender, under its bars (press 6)
      }
    }
    return f;
  };
  /** @param {string} key @param {number} k @returns {import('./frames.js').Timing} */
  const timing = (key, k) => {
    const [kind, a] = key.split(':');
    const i = Number(a);
    const gone = { start: 0, duration: 260 };
    /** the press in which a thing of the view `measures` is shown: it appears then and leaves quickly in any other */
    const own = /** @type {Record<string, number>} */ ({ 'bd:rec': 1, 'bd:liked': 2, 'bd:not': 3, pp: 1, pg: 1, rp: 2, rg: 2, sp: 3, sg: 3 });
    if (key in own) return k === own[key] ? (kind === 'bd' ? { start: 0, duration: U } : kind.endsWith('g') && kind.length === 2 ? { start: 560, duration: 640 } : { start: 200, duration: U }) : gone;
    switch (kind) {
      case 'mat': return { start: 0, duration: 400 };
      case 'cf': return { start: 100 + i * 90, duration: U };
      case 't1': return { start: 100, duration: U };
      case 't2': return { start: 280, duration: U };
      case 'hl': return k === 3 || k === 4 ? { start: 100 + (a === 'fn' || a === 'tn' ? 120 : 0), duration: U } : gone;
      case 'ta': return k === 3 ? { start: 300, duration: U } : gone;
      case 'tb': return k === 3 ? { start: 560, duration: U } : gone;
      case 'wh': return k === 3 ? { start: 100, duration: U } : gone;
      case 'acc': return k === 4 ? { start: 300, duration: U } : gone;
      case 'ag': return k === 4 ? { start: 620, duration: 640 } : gone;
      case 'imb': return k === 5 ? { start: 300, duration: U } : gone;
      case 'n0': return gone;                                                         // WP-93: the lecture's counts go
      case 'n1': return { start: 300, duration: U };                                    // and the imbalanced case's come
      case 'zr': return k === 5 ? { start: 500, duration: U } : gone;
      case 'imbp': return k === 5 ? { start: 400, duration: U } : gone;
      case 'ig': return k === 5 ? { start: 760, duration: 640 } : gone;
      case 'rcl': return k === 5 ? { start: 900, duration: U } : gone;
      case 'gy': return greyCells(k).includes(CELL_KEYS[i]) ? { start: 200, duration: U } : gone;                       // WP-93 (D-176): with its panel (which starts at 200 too), inside the 1200 ms of the press
      // WP-93 (D-177): a recommender's press (4 for the band, 5 for the rock): the table that goes first (400), its matrix at 200, its card at 600 (the matrix, THEN the card), its two bars at 860: 1400 ms; in press 6 the matrices fly away in 500
      case 'sh': return k === 4 ? { start: 200, duration: U } : k === 6 ? FLY : gone;
      case 'mx': return k === 4 + i ? { start: 200, duration: U } : k === 6 ? FLY : gone;
      case 'sc': return k === 4 + i ? { start: 600, duration: U } : gone;
      case 'p': case 'r': return k === 4 + i ? { start: 860, duration: 540 } : gone;
      case 'f': return k === 6 ? { start: 200 + i * 220, duration: 540 } : gone;
      case 'fm': return k === 6 ? { start: 440 + i * 220, duration: U } : gone;       // WP-93: after its F1 bar has grown a little, before the average markers end (i = 1: 660 + 380 = 1040 < 1320)
      case 'a': return k === 6 ? { start: 560 + i * 220, duration: 540 } : gone;
      default: return { start: 0, duration: U };
    }
  };
  return { outcomes, m, imb, fam, roc, formulas: confusionFormulas(Q.counts, Q.labels), imbFormulas: confusionFormulas(Q.imbalance, Q.labels), famFormulas: confusionFormulas(Q.famous, Q.labels), rockFormulas: confusionFormulas(Q.rock, Q.labels), frame, timing, n: confusionPressesOf(P), duration: (/** @type {number} */ k) => pressDuration(k, frame, timing) };
}

const CELLS = /** @type {const} */ ([
  { key: 'tp', row: 0, col: 0, good: true, name: 'tpName' }, { key: 'fp', row: 0, col: 1, good: false, name: 'fpName' },
  { key: 'fn', row: 1, col: 0, good: false, name: 'fnName' }, { key: 'tn', row: 1, col: 1, good: true, name: 'tnName' },
]);

/**
 * The picture of the mode `confusion` (both views).
 * @param {import('./kit.js').WidgetContext} ctx @param {Record<string, any>} P the resolved params of table-highlight
 * @returns {import('./kit.js').WidgetBuild}
 */
export function confusionBuild(ctx, P) {
  const Q = P.confusion, L = Q.labels;
  const M = confusionModel(P);
  const sc = scene(ctx, 'mx-root cf-root');
  const { doc, box, put, add, say } = sc;
  const cx = (/** @type {number} */ c) => MX + c * (CW + CG), cy = (/** @type {number} */ r) => MY + r * (CH + CG);

  const mat = h(doc, 'div', 'cf-mat');
  put('mat', mat, box(0, 0, 1680, 600));
  add(say(h(doc, 'div', 'cf-ch'), L.liked), box(cx(0), MY - 50, CW, 40), mat); add(say(h(doc, 'div', 'cf-ch'), L.notLiked), box(cx(1), MY - 50, CW, 40), mat);
  add(say(h(doc, 'div', 'cf-rh'), L.rec), box(40, cy(0), 190, CH), mat); add(say(h(doc, 'div', 'cf-rh'), L.notRec), box(40, cy(1), 190, CH), mat);
  if (!M.outcomes) {                                                                  // the bands of the view `measures` lie under the cells
    put('bd:rec', h(doc, 'div', 'cf-band', { 'aria-hidden': 'true' }), box(MX - 10, cy(0) - 8, 2 * CW + CG + 20, CH + 16), mat);
    put('bd:liked', h(doc, 'div', 'cf-band', { 'aria-hidden': 'true' }), box(cx(0) - 8, MY - 8, CW + 16, 2 * CH + CG + 16), mat);
    put('bd:not', h(doc, 'div', 'cf-band', { 'aria-hidden': 'true' }), box(cx(1) - 8, MY - 8, CW + 16, 2 * CH + CG + 16), mat);
  }
  for (const c of CELLS) {
    add(h(doc, 'div', 'cf-empty', { 'aria-hidden': 'true', 'data-gfx': 'border' }), box(cx(c.col), cy(c.row), CW, CH), mat);
    const cell = h(doc, 'div', `cf-cell ${c.good ? 'cf-good' : 'cf-bad'}`, { 'aria-hidden': 'true', 'data-gfx': 'border' });
    cell.append(say(h(doc, 'b', 'cf-abbr'), frag(c.key.toUpperCase(), c.key.toUpperCase())), say(h(doc, 'span', 'cf-name'), L[c.name]));
    if (M.outcomes) {                                                                 // WP-93: two keyed numbers, the lecture's counts and (press 5) the imbalanced case's
      put(`n0:${CELLS.indexOf(c)}`, say(h(doc, 'i', 'cf-n'), num(Q.counts[c.key], 0)), '', cell);
      put(`n1:${CELLS.indexOf(c)}`, say(h(doc, 'i', 'cf-n'), num(Q.imbalance[c.key], 0)), '', cell);
    } else { const n = h(doc, 'i', 'cf-n'); ctx.setText(n, num(Q.counts[c.key], 0)); cell.append(n); }
    cell.append(tick(doc, c.good));
    // the table is filled in state 0 of the view `measures`, and empty in state 0 of `outcomes`: either way the frame says so
    put(`cf:${CELLS.indexOf(c)}`, cell, box(cx(c.col), cy(c.row), CW, CH), mat);
  }
  if (!M.outcomes) {
    // WP-93 (D-176, the user's review of 2026-11-01): the GREY TWIN of each cell, on top of it: same box, same name and count, the shape of its frame (solid for a right outcome, dashed for a wrong one, D-068) but in grey. It fades in when
    // the formula on the screen does not use the cell (precision: FN and TN; recall: FP and TN; specificity: TP and FN) and out when the press ends; opacity only, like every other thing of the picture
    CELLS.forEach((c, i) => {
      const twin = h(doc, 'div', `cf-cell ${c.good ? 'cf-good' : 'cf-bad'} cf-grey`, { 'aria-hidden': 'true', 'data-gfx': 'border' });
      const n = h(doc, 'i', 'cf-n'); ctx.setText(n, num(Q.counts[c.key], 0));
      twin.append(say(h(doc, 'b', 'cf-abbr'), frag(c.key.toUpperCase(), c.key.toUpperCase())), say(h(doc, 'span', 'cf-name'), L[c.name]), n, tick(doc, c.good));
      put(`gy:${i}`, twin, box(cx(c.col), cy(c.row), CW, CH), mat);
    });
  }
  if (M.outcomes) {
    const tagAt = (/** @type {string} */ key, /** @type {number} */ col, /** @type {number} */ row, /** @type {Record<string, string>} */ text) => put(key, say(h(doc, 'div', 'cf-tag', { 'data-role': 'neg' }), text), `left:${cx(col) + CW - 114}px;top:${cy(row) + CH - TAG.h - TAG.gap}px;width:104px`, mat);      // WP-93: the gap under the tag is the gap at its right (10 px), it stood flush with the cell's bottom
    tagAt('t1', 1, 0, L.type1); tagAt('t2', 0, 1, L.type2);
    // press 3: the two wrong cells are ringed; two stories
    CELLS.forEach((c) => { put(`hl:${c.key}`, h(doc, 'div', `cf-ring ${c.good ? 'cf-ring-good' : 'cf-ring-bad'}`, { 'aria-hidden': 'true', 'data-gfx': 'border' }), box(cx(c.col) - 8, cy(c.row) - 8, CW + 16, CH + 16), mat); });
    put('wh', say(h(doc, 'div', 'cf-q'), L.which), box(PX, MY - 50, PANEL.w, 44));                // WP-93: on the row of the column heads, the cards under it line up with the matrix's rows
    // two task cards (WP-74, Ek 2 item 1): a task, then its two errors; the worse one has a double red frame and the word, the bearable one a dashed grey frame (D-068: frame and word, not colour alone)
    const task = (/** @type {string} */ key, /** @type {number} */ y, /** @type {Record<string, string>} */ name, /** @type {'items'|'magnifier'} */ icn, /** @type {string} */ worse,
      /** @type {Record<string, string>} */ fpText, /** @type {Record<string, string>} */ fnText) => {
      const el = h(doc, 'div', 'cf-task', { 'aria-hidden': 'true', 'data-gfx': 'border' });
      const head = h(doc, 'div', 'cf-task-head');
      head.append(icon(doc, icn, 40), say(h(doc, 'span'), name));
      el.append(head);
      for (const [abbr, text] of /** @type {Array<[string, Record<string, string>]>} */ ([['fp', fpText], ['fn', fnText]])) {
        const isWorse = abbr === worse;
        const row = h(doc, 'div', `cf-task-row ${isWorse ? 'cf-worse' : 'cf-bear'}`);
        row.append(say(h(doc, 'b', 'cf-abbr'), frag(abbr.toUpperCase(), abbr.toUpperCase())), say(h(doc, 'span', 'cf-story-text'), text), say(h(doc, 'i', 'cf-verdict'), isWorse ? L.worseTag : L.bearTag));
        el.append(row);
      }
      put(key, el, box(PX, y, PANEL.w, CH));
    };
    task('ta', cy(0), L.taskA, 'items', Q.worse[0], L.fpA, L.fnA); task('tb', cy(1), L.taskB, 'magnifier', Q.worse[1], L.fpB, L.fnB);        // WP-93: the film card on the matrix's first row, the lawyer's on the second
    // press 4: accuracy
    // WP-93 (D-176, the user's review of 2026-11-01): besides its formula the panel says what the measure IS (the title) and what it means for a recommender (the how-line), as the three panels of page 11 do
    panel(sc, 'acc', 'ag', L.accuracy, M.formulas.accuracy, M.m.accuracy, L.accuracyHow, { y: COLUMN.y, h: COLUMN.h });                   // WP-93: its top and bottom are the matrix's
    // press 5: the imbalanced case, a small table of its own
    // WP-93 (step 5): the table stays with the imbalanced counts, the TP = 0 cell is ringed in the negative role; to its right the heading, the accuracy (high) and the recall (0), whose frame is the negative one
    put('zr', h(doc, 'div', 'cf-ring cf-ring-bad', { 'aria-hidden': 'true', 'data-gfx': 'border' }), box(cx(0) - 8, cy(0) - 8, CW + 16, CH + 16), mat);
    const imb = h(doc, 'div', 'cf-imb', { 'aria-hidden': 'true' });                         // one line on the row of the column heads (like the question of press 3): who they are, and that it recommends nothing
    imb.append(say(h(doc, 'div', 'cf-q'), fillFragL(L.imbHead, (lang) => ({ n: group(total(Q.imbalance), lang), k: Q.imbalance.tp + Q.imbalance.fn }))));
    imb.append(say(h(doc, 'div', 'cf-imb-note'), L.imbNote));
    put('imb', imb, box(PX, MY - 50, PANEL.w, 44));
    // the two panels stand on the matrix's rows (y 132 and 314, 172 high), like the two task cards of press 3: the accuracy beside TP and FP, the recall beside FN and TN
    panel(sc, 'imbp', 'ig', null, M.imbFormulas.accuracy, M.imb.accuracy, null, { y: cy(0), h: CH });
    // WP-93 (D-176, the user's review of 2026-11-01): recall is introduced on page 11, so press 5 does not use it: the dashed panel says in WORDS what happened ("it found none of the 20 films the user likes"), with no formula, no gauge and no name
    wordsPanel(sc, 'rcl', fillFragL(L.imbFound, () => ({ k: Q.imbalance.tp + Q.imbalance.fn })), { y: cy(1), h: CH });
  } else {
    const c = Q.counts;                                                               // the panels of the three measures
    void c;
    panel(sc, 'pp', 'pg', L.precision, M.formulas.precision, M.m.precision, L.precisionHow, { y: COLUMN.y, h: COLUMN.h });                // WP-93 (D-174): one formula line each, the matrix's top and bottom
    panel(sc, 'rp', 'rg', L.recall, M.formulas.recall, M.m.recall, L.recallHow, { y: COLUMN.y, h: COLUMN.h, aka: L.sensitivity });
    panel(sc, 'sp', 'sg', L.specificity, M.formulas.specificity, M.m.specificity, L.specificityHow, { y: COLUMN.y, h: COLUMN.h });
    // press 3 and 4: two recommenders, a bar each for precision and recall, then F1 against the average
    [[L.famous, M.fam], [L.rock, M.roc]].forEach(([name, ms], i) => {
      const x = PX + i * 440;
      const card = h(doc, 'div', 'cf-sc', { 'aria-hidden': 'true' });
      card.append(say(h(doc, 'div', 'cf-sc-name'), /** @type {Record<string, string>} */ (name)));
      put(`sc:${i}`, card, box(x, PANEL.y, 420, SCORE_H));
      const fm = say(h(doc, 'div', 'cf-sc-formula'), (i === 0 ? M.famFormulas : M.rockFormulas).f1);        // WP-93 (D-174): F1 = frac(2 · P · R|P + R) = frac(2 · 0.90 · 0.15|0.90 + 0.15) = 0.26, under the bars
      renderFormula(doc, fm);
      put(`fm:${i}`, fm, box(18, 350, 384, 56), card);
      /** @type {Array<[string, Record<string, string>, number, string, number]>} */
      const bars = [[`p:${i}`, L.p, /** @type {any} */ (ms).precision, 'cf-bar-p', 70], [`r:${i}`, L.r, /** @type {any} */ (ms).recall, 'cf-bar-r', 130], [`a:${i}`, L.mean, /** @type {any} */ (ms).mean, 'cf-bar-a', 230], [`f:${i}`, L.f1, /** @type {any} */ (ms).f1, 'cf-bar-f', 290]];
      for (const [key, label, v, cls, y] of bars) {
        const lab = say(h(doc, 'div', 'cf-bar-label'), label);
        lab.style.cssText += `;left:18px;top:${y - 4}px`;
        card.append(lab);
        put(key, h(doc, 'div', `cf-bar ${cls}`, { 'data-gfx': 'fill' }), `${box(18, y + 26, Math.max(4, Math.round(v * 380)), 22)};transform-origin:0 50%`, card);
        const val = say(h(doc, 'div', 'cf-bar-val'), num(v, 2)); val.style.cssText += `;left:${420 - 18 - 72}px;width:72px;top:${y - 4}px`;
        card.append(val);
      }
    });
    // WP-93 (D-177, the user's choice on board 3, 2026-11-01): the matrix of each recommender, its problem first and then its card. Candidate A of the board: ONE table whose row heads (shared: recommended / not recommended) stand at x 14 to 154
    // and whose column groups (liked / not liked under the recommender's name, the name of its card) stand at x 164 and x 432, each 248 wide, on the rows of the lecture's table (y 132 and 314, 172 high). A cell holds its abbreviation, its tick or
    // cross and its count (40 px: the widest, 439, is 71.5 px in the 84 px inside a 120 px cell); TN is grey for good (precision and recall do not use it). The cards stand where they always did (x 770 and 1210).
    const heads = h(doc, 'div', 'cf-sh', { 'aria-hidden': 'true' });
    add(say(h(doc, 'div', 'cf-rh cf-rh-sm'), L.rec), box(0, cy(0), 140, CH), heads); add(say(h(doc, 'div', 'cf-rh cf-rh-sm'), L.notRec), box(0, cy(1), 140, CH), heads);
    put('sh', heads, box(14, 0, 140, 600));
    [[L.famous, Q.famous], [L.rock, Q.rock]].forEach(([name, counts], g) => {
      const grp = h(doc, 'div', 'cf-grp', { 'aria-hidden': 'true' });
      add(say(h(doc, 'div', 'cf-gn'), /** @type {Record<string, string>} */ (name)), box(0, 36, 248, 40), grp);
      add(say(h(doc, 'div', 'cf-ch cf-ch-sm'), L.liked), box(0, 86, 120, 36), grp); add(say(h(doc, 'div', 'cf-ch cf-ch-sm'), L.notLiked), box(128, 86, 120, 36), grp);
      for (const c of CELLS) {
        const cell = h(doc, 'div', `cf-cell cf-mini ${c.good ? 'cf-good' : 'cf-bad'}${c.key === 'tn' ? ' cf-grey' : ''}`, { 'aria-hidden': 'true', 'data-gfx': 'border' });
        const n = h(doc, 'i', 'cf-n'); ctx.setText(n, num(/** @type {Record<string, number>} */ (counts)[c.key], 0));
        cell.append(say(h(doc, 'b', 'cf-abbr'), frag(c.key.toUpperCase(), c.key.toUpperCase())), n, tick(doc, c.good));
        add(cell, box(c.col * 128, cy(c.row), 120, CH), grp);
      }
      put(`mx:${g}`, grp, box(164 + g * 268, 0, 248, 600));
    });
  }
  return finish(ctx, sc, M.n, M.frame, M.timing);
}

/** A tick or a cross, drawn in currentColor: the shape cue of a right or a wrong outcome. @param {Document} doc @param {boolean} good */
function tick(doc, good) {
  const ns = 'http://www.w3.org/2000/svg';
  const sv = doc.createElementNS(ns, 'svg');
  sv.setAttribute('class', 'cf-mark'); sv.setAttribute('width', '34'); sv.setAttribute('height', '34'); sv.setAttribute('viewBox', '0 0 34 34'); sv.setAttribute('aria-hidden', 'true');
  const p = doc.createElementNS(ns, 'path');
  p.setAttribute('d', good ? 'M6 18l8 8 14-16' : 'M8 8l18 18M26 8L8 26');
  sv.append(p);
  return /** @type {SVGElement} */ (sv);
}

/**
 * WP-93 (D-176): a panel in the negative role (a dashed red frame) that holds one sentence and nothing else: no formula, no track, no gauge (css .cf-panel-plain has no room reserved for the track).
 * @param {ReturnType<typeof scene>} sc @param {string} key @param {Record<string, string>} text @param {{y: number, h: number}} o
 */
function wordsPanel(sc, key, text, o) {
  const { doc, box, put, say } = sc;
  const el = h(doc, 'div', 'cf-panel cf-panel-plain cf-bad', { 'aria-hidden': 'true' });
  el.append(say(h(doc, 'div', 'cf-panel-words'), text));
  put(key, el, box(PX, o.y, PANEL.w, o.h));
}

/**
 * A formula panel (WP-93, D-174): an optional title and sentence, the formula in ONE line, symbolic fraction = fraction with the numbers = value (formula.js), and a gauge that grows to the value. `o.y` and `o.h` are its place; `o.bad` is the
 * negative role (a dashed red frame) and `how` may be any fragment.
 * @param {ReturnType<typeof scene>} sc @param {string} key @param {string} gaugeKey @param {Record<string, string>|null} title @param {Record<'en'|'tr', string>} formula @param {number} value
 * `o.inline` puts `how` at the right end of the formula's line (a 172 px panel has no room for a line of its own above the formula). The content is centred above the gauge (CSS), and the track and the gauge both stand 22 px from the
 * foot of the panel's padding box, so the border (3 px, 4 px when dashed) cannot shift one against the other.
 * @param {Record<string, string>|null} how @param {{y: number, h: number, bad?: boolean, aka?: Record<string, string>, inline?: boolean}} o
 */
function panel(sc, key, gaugeKey, title, formula, value, how, o) {
  const { doc, box, put, say } = sc;
  const el = h(doc, 'div', `cf-panel${o.bad ? ' cf-bad' : ''}`, { 'aria-hidden': 'true' });
  if (title) {
    const head = say(h(doc, 'div', 'cf-panel-title'), title);
    if (o.aka) head.append(' ', say(h(doc, 'span', 'cf-aka'), o.aka));
    el.append(head);
  }
  const fm = say(h(doc, 'div', 'cf-formula'), formula);
  renderFormula(doc, fm);
  if (how && o.inline) {
    const line = h(doc, 'div', 'cf-line');
    line.append(fm, say(h(doc, 'div', 'cf-panel-how'), how));
    el.append(line);
  } else {
    if (how) el.append(say(h(doc, 'div', 'cf-panel-how'), how));
    el.append(fm);
  }
  put(key, el, box(PX, o.y, PANEL.w, o.h));
  el.append(h(doc, 'div', 'cf-track', { 'aria-hidden': 'true' }));
  put(gaugeKey, h(doc, 'div', `cf-gauge${o.bad ? ' cf-gauge-bad' : ''}`, { 'data-gfx': 'fill' }), `left:8px;bottom:22px;width:${Math.max(4, Math.round((PANEL.w - 16) * value))}px;height:30px;transform-origin:0 50%`, el);
}
