// @ts-check
// WP-74 (D-149, D-150; brief 09 and its second supplement; the pages `top-k`, `rank-corr` and `sampled` of the I2RS w07 deck, storyboard §3): the mode `ranked` of compare. Ranked lists, told as a picture in three views: `topk` (five presses: only the top
// of a list of 20 counts, the liked items and two cut points, then a right answer at rank 50 with precision and recall at the two cuts, one hidden item per user: HR and ARHR), `corr` (three presses: Spearman and Kendall on five items, ties in the true order) and `sampled` (four presses:
// Rendle's three hypothetical algorithms A, B and C scored on the full ranking and on 99 sampled negatives; the order of the algorithms is not the same). `sampled` is a hypothetical example of the literature, not a measurement: its tag says so
// (D-129 asks that nothing that looks like a result be unlabelled; the tag is a label, empty hides it). The tie-corrected Kendall of Herlocker et al. 2004 (p. 30-31, Eq. 7), tau-b, is drawn in press 3 of the corr view (WP-93, the lead's correction of 2026-11-01).
//
// WP-93 (D-174, the user's rule of 2026-11-01: "a formula is shown as a computation"): every division of the page is a FRACTION with a horizontal bar, written as the symbolic fraction = the fraction with the numbers = the value,
// never "a / b" in a line of text. `rankedFormulas` composes each line per language from the model's own numbers and the labels (the symbolic part is a label with formula.js mark-up, so a deck can reword it); the mode draws it with
// `renderFormula` (formula.js). The picture's geometry for the taller lines (a fraction is two lines high) is UNMEASURED at the time of writing: the Chrome run of the deck tour decides.
// WP-93 (D-177, the user's answer of 2026-11-01 on page 12: "for this page 1/rank is better"): the ONE exception to "never a / b in text": the header of the weight column (`colW`) and the sentence of ARHR (`arHow`) write 1/rank
// as plain text with a slash; the values in the cells (1/1, 1/2, 1/4) and every formula line stay bar fractions (D-174).
//
// View `topk`, states (0 is a list of twenty items, positions 1 to 20):
//   1 the top     a window frames what the user sees (the first 5 positions); the rest of the list steps back
//   2 relevant    WP-93 (D-183, the user, 2026-11-01, page 12: "bring only the first 5 stars and maybe the @10 lines, I tell what hit and what did not; the sixth star and the formulas at the next press"): ONLY the legend of the star, the five stars
//                 of the list (1, 3, 4, 8, 14) and the two cut lines after 10 and after 20 (the rule: never a single K; both lines, so that the star at 14 reads "missed at 10, found by 20"). No sixth star, no false-negative marks, no TP, FP and FN,
//                 no computation: nothing is counted before the presenter has said what the lines hit and miss
//   3 count       WP-93 (the user, 2026-11-01, page 12: "the sixth star is missing but the formulas are on screen"): in this ORDER, so that nothing is counted before it is on screen: the sixth star far down the list (rank 50, outside it),
//                 then the false negatives of each cut MARKED where they are (FN@10 on the items at 14 and 50, FN@20 on the item at 50: a red ring and a tag, so that the 2 and the 1 of R@10 and R@20 can be counted on the screen), then the
//                 four computations in a 2 x 2 grid and TP, FP and FN told at the first cut, one per line:
//                 P@10 = TP / (TP + FP) = 4 / (4 + 6) = 0.40, P@20 = 5 / (5 + 15) = 0.25, R@10 = TP / (TP + FN) = 4 / (4 + 2) = 0.67, R@20 = 5 / (5 + 1) = 0.83 (the same symbols as the confusion page, the measure now at a cut)
//   4 rank 50     the sixth relevant item is already there: this press only frames it and says it, not in the top 20, so it is not found: a good classifier is not a good ranker
//   5 hidden      the list steps back; one hidden item per user (leave-one-out): the rank of the hidden item of 5 users (1, 2, 4, 15, 40) and the weight 1 / rank of each hit, a fraction; HR@10 = hits / users = 3 / 5 = 0.60 (the share of users
//                 whose hidden item is in the top 10); ARHR = (1/1 + 1/2 + 1/4) / 5 = 0.35 (the average of 1 / rank over all users, a miss counts 0; Deshpande and Karypis 2004, p. 158-159, Eq. 5 and 6, N = 10), so ARHR <= HR and the top counts most
//   (the fifth step of the page, "implicit feedback: the ranking is what matters", is text only)
// View `corr`, states (0 is two columns, the true order and the predicted one, with a line for every item):
//   1 Spearman    the rank difference d of every item; rho = 1 - 6 sum(d^2) / (n (n^2 - 1)) = 1 - 6 * 4 / (5 * 24) = 0.80, on two rows (the symbolic fraction, then the numbers and the value)
//   2 Kendall     the lines that cross are discordant pairs: concordant 8, discordant 2 of 10 pairs, tau = (C - D) / (C + D) = (8 - 2) / (8 + 2) = 0.60
//   3 ties        two items tie in the true order: their pair is not discordant (concordant 8, discordant 1, tied 1). WP-93 (the user's notes on page 14: say why a tied pair is neither, and how tau changes, with the numbers): the tied
//                 items get a bracket and the word "tied", their two lines turn from red to purple (the pair leaves both counts, the one discordant pair left is A-B), the tie count of each order is told under its column
//                 (T_true = 1, T_predicted = 0), and the panel says why (a tie has no order to agree or disagree with) and shows tau without the tie, (8 - 2) / (8 + 2) = 0.60, and with it. WITH the tie the formula is Kendall's tau-b,
//                 Herlocker et al. 2004, p. 30-31, Eq. 7: tau = (C - D) / sqrt((C + D + T_R)(C + D + T_P)); the slide writes T_true and T_predicted, never the bare "TP" of the confusion page. By hand: (8 - 1) / sqrt((8 + 1 + 1)(8 + 1 + 0))
//                 = 7 / sqrt(10 * 9) = 0.74. (C - D) / (C + D) with the tied pair simply left out, 7 / 9 = 0.78, is Goodman and Kruskal's gamma, a different measure (the lead's correction of 2026-11-01); 7 / 10 = 0.70 would punish the tie.
// View `sampled`, states (0 is empty; the legend and the tag come with press 1). Rendle 2019 (arXiv 1912.02263, p. 5-6): 10,000 items, five test cases, three hypothetical algorithms, 99 sampled negatives, the mean of 1,000 repeats:
//   1 full        Recall@10 and NDCG of the full ranking, three bars (A, B, C) each: C is best (Recall@10 0.000 / 0.000 / 0.200, NDCG 0.150 / 0.122 / 0.208), with the rank of each algorithm and the order, "C > A = B"
//   2 sampled     the same metrics on 99 sampled negatives: A is first (Recall@10 1.000 / 0.400 / 0.567, NDCG 0.724 / 0.444 / 0.460), the order flips
//   3 AP          average precision, both readings: the full ranking 0.010 / 0.010 / 0.101, sampled 0.630 / 0.336 / 0.325; C, best in the full ranking, falls to last (a double red frame and its number)
//   4 the rule    use the full ranking; if you sample, say so and say how it biases the result
//   WP-93 (D-180, the user's notes on page 20, 2026-11-01): the metric panel is 520 px wide (it was 500: the rank circles ended 2 px past the inner edge, so their stroke touched the border; now they end 18 px from it, the gap of the chip on the left); the three panels stand 40 px
//   from the stage edges and 20 px apart. The rank circles are identical: an ink ring and digit that fade with the rank (100 / 84 / 68 % ink, 13.5 / 8.4 / 5.1 : 1 on the light ground), no blue filled 1; the UPPER circle of an algorithm (its full-ranking bar) is dashed like
//   that bar and the legend swatch, the lower one (the sample) solid. The legend row says what the number is, as its last item, right-aligned at the panels' edge: "circled number: the algorithm's rank on that measure"; the tag of the example stands at the right of the row of the rule.
//
// duration(k) = pressDuration (u = 380 ms; the tests work them out by hand; the browser reports the same). topk: 580 / 1430 / 1360 / 880 / 1230 ms (WP-93: the sixth star and the marks came first, press 2 was 2260; D-183: the stars and the cut lines are press 2, the sixth star, the marks and the computations press 3); corr: 880 / 780 / 680 ms; sampled: 1180 / 1180 / 1780 / 480 ms.
//
// Motion: opacity and transform (scale pops, scaleY for a cut line, scaleX for a bar). Nothing else.
import { h } from './frames.js';
import { emblem } from './pictos.js';
import { formulaProblem, renderFormula } from './formula.js';
import { formulaValue } from './table-confusion.js';
import { U, fillFrag, fillFragL, finish, frag, grow, group, labelsSchema, num, on, pop, pressDuration, rise, scene } from './w07-common.js';

const LABELS = {
  user: frag('what the user sees', 'kullanıcının gördüğü'), rel: frag('relevant', 'ilgili'), far: frag('rank {n}: not in the top {k}, so not found', '{n}. sıra: ilk {k} içinde değil, bulunmadı'),
  // WP-93 (the user, 2026-11-01, page 12): the key of the star ("the star needs a legend") and the label of the sixth item, the key comes with the stars (press 2), the label of the sixth item with that item (press 3) before its verdict `far` (press 4)
  starKey: frag('an item the user likes', 'kullanıcının beğendiği öğe'), farAt: frag('rank {n}, outside the list', '{n}. sıra, listenin dışında'),
  loo: frag('one hidden item per user (leave-one-out)', 'kullanıcı başına bir gizli öğe (leave-one-out)'), userN: frag('user {i}', '{i}. kullanıcı'),
  colRank: frag('hidden item at rank', 'gizli öğenin sırası'), colHit: frag('in the top {k}?', 'ilk {k}\'da mı?'),
  // WP-93 (D-177, the user's answer of 2026-11-01 on page 12: "for this page 1/rank is better"): 1/rank is written with a slash, as text, in the header of the weight column and in the sentence of ARHR; the values in the cells
  // and every formula line stay bar fractions (D-174)
  colW: frag('1/rank (hits only)', '1/sıra (yalnız isabet)'),
  hrName: frag('hit rate', 'isabet oranı'), hrHow: frag('the share of users whose hidden item is in the top {k}', 'gizli öğesi ilk {k} içine giren kullanıcıların payı'),
  arName: frag('average reciprocal hit rank', 'ortalama ters isabet sırası'), arHow: frag('1/rank added over the hits, divided by all users', 'isabetlerde 1/sıra toplanır, tüm kullanıcılara bölünür'),
  // WP-93 (D-174): the symbolic fraction of every formula (rankedFormulas writes the numbers and the value after it). P and R are the confusion page's precision and recall at a cut: TP is a relevant item inside the cut,
  // FP an item inside it that is not relevant, FN a relevant item outside it
  pFormula: frag('P@{k} = frac(TP|TP + FP)', 'P@{k} = frac(TP|TP + FP)'), rFormula: frag('R@{k} = frac(TP|TP + FN)', 'R@{k} = frac(TP|TP + FN)'),
  // WP-93 (the user, 2026-11-01, page 12: "the text wraps in unrelated places"; "I did not understand the FN part of R@10"): TP, FP and FN one per line, each told at the FIRST cut {k} in the words of the picture (a liked item is a star);
  // a line never wraps (the stylesheet holds it on one row), so each is short enough for its room: measured with the engine's fonts, the Turkish FN line is the widest (590.8 px of 608)
  tpDef: frag('liked items in the top {k}', 'ilk {k} içindeki beğenilen öğeler'), fpDef: frag('items in the top {k} that are not liked', 'ilk {k} içindeki beğenilmeyen öğeler'),
  fnDef: frag('liked items the list did not reach (below rank {k})', 'listenin ulaşamadığı beğenilen öğeler ({k}. sıranın altında)'),
  // WP-93 (D-178, the abbreviation rule of 2026-11-01: an abbreviation is expanded on the slide where it first appears): P@10 and R@10 first appear in the tiles of press 3; the tiles are full (P@20 is 398 of 414 px), so the expansions
  // are the heading of the panel of symbols, above TP, FP and FN
  pName: frag('precision at {k}', 'kesinlik (ilk {k} içinde)'), rName: frag('recall at {k}', 'duyarlılık (ilk {k} içinde)'),
  hrFormula: frag('HR@{k} = frac(hits|users)', 'HR@{k} = frac(isabet|kullanıcı)'), arFormula: frag('ARHR = frac(Σ frac(1|rank)|users)', 'ARHR = frac(Σ frac(1|sıra)|kullanıcı)'),
  rhoFormula: frag('ρ = 1 − frac(6 Σd²|n (n² − 1))', 'ρ = 1 − frac(6 Σd²|n (n² − 1))'), tauFormula: frag('τ = frac(C − D|C + D)', 'τ = frac(C − D|C + D)'),
  // WP-93 (the lead's correction, 2026-11-01): Kendall's tau-b with ties, Herlocker et al. 2004, p. 30-31, Eq. 7; the subscripts are words, so the tie counts are not read as TP of the confusion page ("b" is the name of the variant: tau-b)
  tauTieFormula: frag('τ_b = frac(C − D|sqrt((C + D + T_true)(C + D + T_predicted)))', 'τ_b = frac(C − D|sqrt((C + D + T_true)(C + D + T_predicted)))'),
  trueOrder: frag('true order', 'gerçek sıra'), predicted: frag('predicted order', 'tahmin edilen sıra'), item: frag('item {i}', '{i}. öğe'),
  spearman: frag('Spearman: Pearson on the ranks', 'Spearman: sıralar üzerinde Pearson'), kendall: frag('Kendall: concordant and discordant pairs', 'Kendall: uyumlu ve uyumsuz çiftler'),
  concordant: frag('concordant', 'uyumlu'), discordant: frag('discordant', 'uyumsuz'), tied: frag('tied', 'beraber'), tieNote: frag('a tie in the true order is not penalised', 'gerçek sıradaki beraberlik cezalandırılmaz'),
  // WP-93 (the user's notes on page 14, 2026-11-01): why a tied pair is neither concordant nor discordant ({a} and {b} stand for the two tied items; the default sentence does not need them: the bracket and the word "tied" name the pair, and
  // the first sentence "D and E tie in the true order" took a third line the panel has no room for), and tau without and with the tie. WP-93 (the lead's correction, 2026-11-01): with the tie the measure is Kendall's tau-b
  // (Herlocker et al. 2004, p. 30-31, Eq. 7), its two tie counts are written T_true and T_predicted (Herlocker's T_R and T_P: "TP" would read as the true positive of pages 10 and 11) and told under their columns ({n} is the count)
  tieWhy: frag('A tie has no order to agree or disagree with, so the pair is neither concordant nor discordant.', 'Beraberliğin uyacağı ya da uymayacağı bir sıra yoktur: çift ne uyumlu ne uyumsuzdur.'),
  tieBefore: frag('without the tie', 'beraberlik olmadan'), tieAfter: frag('with the tie: Kendall\'s tau-b', 'beraberlikle: Kendall tau-b'),
  tieCountTrue: frag('tied pairs: T_true = {n}', 'beraber çift: T_true = {n}'), tieCountPred: frag('tied pairs: T_predicted = {n}', 'beraber çift: T_predicted = {n}'),
  fullName: frag('full ranking', 'tam sıralama'), sampleName: frag('sampled', 'örneklenmiş'),
  legendFull: frag('full ranking: {n} items', 'tam sıralama: {n} öğe'), legendSample: frag('sampled: {m} random negatives, the mean of {r} runs', 'örneklenmiş: {m} rastgele negatif, {r} tekrarın ortalaması'),
  rule: frag('use the full ranking; if you sample, say so and say how it biases the result', 'tam sıralamayı kullan; örnekleme gerekiyorsa söyle ve yanlılığını belirt'),
  // WP-93 (D-180, page 20): the key of the numbers in the circles of the three panels, the last item of the legend row
  rankKey: frag('circled number: the algorithm\'s rank on that measure', 'daire içindeki sayı: algoritmanın o ölçüdeki sırası'),
  tag: frag('hypothetical example (Rendle 2019)', 'varsayımsal örnek (Rendle 2019)'),
};
/** WP-93 (D-174): the labels that hold formula mark-up (frac(NUM|DEN), formula.js): refused with their place when one does not parse. `colW` and `arHow` are plain text by default (D-177) and may still hold mark-up in a deck. */
const FORMULA_LABELS = ['colW', 'arHow', 'pFormula', 'rFormula', 'hrFormula', 'arFormula', 'rhoFormula', 'tauFormula', 'tauTieFormula', 'tieCountTrue', 'tieCountPred'];
const REL = [1, 3, 4, 8, 14];
const HIDDEN = [1, 2, 4, 15, 40];
const PRED = ['B', 'A', 'C', 'E', 'D'];
/** Rendle 2019, p. 5 and 6: the three metrics of the three algorithms A, B, C on the full ranking and on 99 sampled negatives (the mean of 1,000 repeats). */
const METRICS = [
  { name: 'Recall@10', full: [0, 0, 0.2], sampled: [1, 0.4, 0.567] },
  { name: 'NDCG', full: [0.15, 0.122, 0.208], sampled: [0.724, 0.444, 0.46] },
  { name: 'AP', full: [0.01, 0.01, 0.101], sampled: [0.63, 0.336, 0.325] },
];
const METRIC_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['name', 'full', 'sampled'],
  properties: {
    name: { type: 'string', minLength: 1, maxLength: 24 },
    full: { type: 'array', minItems: 3, maxItems: 3, items: { type: 'number', minimum: 0, maximum: 1 } },
    sampled: { type: 'array', minItems: 3, maxItems: 3, items: { type: 'number', minimum: 0, maximum: 1 } },
  },
};

/** The params of the mode `ranked`, merged into compare's schema (the registry carries the whole). */
export const rankedSchema = {
  type: 'object', additionalProperties: false, title: 'the ranked-lists mode (mode ranked)',
  description: '`view` is `topk`, `corr` or `sampled`. topk (a list of 20): `relevant` are the positions (1..20) of the relevant items inside the list, `outside` the rank of the one relevant item far down (21 or more), `cuts` the two cut points (10 and 20), '
    + '`visible` how many positions the user sees (press 1), `hidden` the rank of the one hidden item of each user (press 5: HR and ARHR at the first cut point). corr: `predicted` is the order of the five items A..E as predicted (the true order is A B C D E) '
    + 'and `tie` the two items (by true rank, 1..5) that tie in the true order in press 3. sampled (Rendle 2019): `items` and `negatives` and `repeats` describe the sampling, `metrics` are exactly three metrics (the first two in presses 1 and 2, the third in press 3), '
    + 'each with the values of the algorithms A, B and C on the full ranking and on the sample. All numbers are a toy or the literature\'s hypothetical example; `sampled` carries its tag (an empty `tag` hides it). '
    + 'The formulas of topk and corr are computations (a symbolic fraction, the fraction with the numbers, the value): the symbolic part is a label (`pFormula`, `rFormula`, `hrFormula`, `arFormula`, `rhoFormula`, `tauFormula`, `tauTieFormula`) and may hold `frac(NUM|DEN)`, `sqrt(BODY)` and `_sub` (engine/widgets/formula.js); a text that does not parse is refused.',
  default: { view: 'topk', relevant: REL, outside: 50, cuts: [10, 20], visible: 5, hidden: HIDDEN, predicted: PRED, tie: [4, 5], items: 10000, negatives: 99, repeats: 1000, metrics: METRICS, labels: LABELS },
  properties: {
    view: { type: 'string', enum: ['topk', 'corr', 'sampled'], default: 'topk' },
    relevant: { type: 'array', minItems: 2, maxItems: 10, items: { type: 'integer', minimum: 1, maximum: 20 }, default: REL },
    outside: { type: 'integer', minimum: 21, maximum: 1000, default: 50 },
    cuts: { type: 'array', minItems: 2, maxItems: 2, items: { type: 'integer', minimum: 1, maximum: 20 }, default: [10, 20] },
    visible: { type: 'integer', minimum: 1, maximum: 10, default: 5 },
    hidden: { type: 'array', minItems: 2, maxItems: 6, items: { type: 'integer', minimum: 1, maximum: 1000 }, default: HIDDEN },
    predicted: { type: 'array', minItems: 5, maxItems: 5, items: { type: 'string', enum: ['A', 'B', 'C', 'D', 'E'] }, default: PRED },
    tie: { type: 'array', minItems: 2, maxItems: 2, items: { type: 'integer', minimum: 1, maximum: 5 }, default: [4, 5] },
    items: { type: 'integer', minimum: 100, default: 10000 },
    negatives: { type: 'integer', minimum: 1, default: 99 },
    repeats: { type: 'integer', minimum: 1, default: 1000 },
    metrics: { type: 'array', minItems: 3, maxItems: 3, items: METRIC_SCHEMA, default: METRICS },
    labels: labelsSchema(LABELS, '`far` holds {n} (the rank) and {k} (the cut), `farAt` {n}, `item` and `userN` {i}, `colHit`, `hrHow`, `pFormula`, `rFormula`, `hrFormula`, `pName`, `rName`, `tpDef`, `fpDef` and `fnDef` {k}, `tieWhy` {a} and {b} (the two tied items, optional), `tieCountTrue` and `tieCountPred` {n} (the number of tied pairs of that order), `legendFull` {n}, `legendSample` {m} and {r}.'),
  },
};
export const rankedExamples = [{ mode: 'ranked' }, { mode: 'ranked', ranked: { view: 'corr' } }, { mode: 'ranked', ranked: { view: 'sampled' } }];
/** The presses of the mode by view: topk 5 (WP-93, D-183: four before the stars and the cut lines became a press of their own), corr 3, sampled 4. @param {any} P the params of compare (defaults filled in) @returns {number} */
export const rankedPressesOf = (P) => { const view = (P.ranked ?? P).view; return view === 'corr' ? 3 : view === 'topk' ? 5 : 4; };

/** The metrics of the lists: hits in the top k, P@k and R@k against all relevant items. @param {number[]} relevant @param {number} k @param {number} total */
export function atK(relevant, k, total) { const hits = relevant.filter((p) => p <= k).length; return { hits, p: hits / k, r: hits / total }; }
/** Hit rate at k of the ranks of the hidden items (leave-one-out): the share of users whose hidden item is in the top k. @param {number[]} hidden @param {number} k */
export const hitRate = (hidden, k) => hidden.filter((r) => r <= k).length / hidden.length;
/** Average reciprocal hit rank at k (Deshpande and Karypis 2004, Eq. 6): the mean over ALL users of 1 / rank, a user whose hidden item is not in the top k counts 0. @param {number[]} hidden @param {number} k */
export const arhr = (hidden, k) => hidden.reduce((a, r) => a + (r <= k ? 1 / r : 0), 0) / hidden.length;
/** The rank differences d, Spearman's rho of ranks without ties. @param {number[]} d @returns {number} */
export const spearman = (d) => 1 - (6 * d.reduce((a, x) => a + x * x, 0)) / (d.length * (d.length * d.length - 1));
/**
 * Concordant, discordant and tied pairs of a true order 1..n (items by true rank) and the predicted ranks of those items; a pair tied in the true order is neither.
 * @param {number[]} predRank predicted rank of the item with true rank 1, 2, ... @param {[number, number]} [tie] two true ranks that tie
 */
export function pairs(predRank, tie) {
  let c = 0, d = 0, t = 0;
  for (let i = 0; i < predRank.length; i++) for (let j = i + 1; j < predRank.length; j++) {
    if (tie && ((i + 1 === tie[0] && j + 1 === tie[1]) || (i + 1 === tie[1] && j + 1 === tie[0]))) { t++; continue; }
    if (predRank[i] < predRank[j]) c++; else d++;
  }
  return { c, d, t };
}
/** Kendall's tau without ties. @param {number} c @param {number} d @returns {number} */
export const kendall = (c, d) => (c - d) / (c + d);
/**
 * WP-93 (the lead's correction of 2026-11-01): Kendall's tau-b, the tie-corrected form of Herlocker et al. 2004 (p. 30-31, Eq. 7): tau = (C - D) / sqrt((C + D + T_R)(C + D + T_P)), here with T_true (their T_R, the pairs tied in the
 * true order) and T_predicted (their T_P, tied in the predicted order). The two factors are the pairs the prediction separates (C + D + T_true) and the pairs the true order separates (C + D + T_predicted). Without ties it is tau, (C - D) / (C + D).
 * (C - D) / (C + D) with a tied pair merely left out, 7 / 9 = 0.78 on the page's numbers, is Goodman and Kruskal's gamma, not tau-b. By hand: C = 8, D = 1, T_true = 1, T_predicted = 0: 7 / sqrt(10 * 9) = 7 / 9.487 = 0.7379.
 * @param {number} c concordant pairs @param {number} d discordant pairs @param {number} tTrue pairs tied in the true order @param {number} tPred pairs tied in the predicted order @returns {number}
 */
export const kendallB = (c, d, tTrue, tPred) => (c - d) / Math.sqrt((c + d + tTrue) * (c + d + tPred));
/**
 * WP-93 (the user's notes on page 14): the discordant pairs of a predicted order as index pairs [i, j] (item i is before item j in the true order, after it in the prediction); a pair tied in the true order is not one.
 * @param {number[]} predRank predicted rank of the item with true rank 1, 2, ... @param {[number, number]} [tie] two true ranks that tie @returns {Array<[number, number]>}
 */
export function discordantPairs(predRank, tie) {
  /** @type {Array<[number, number]>} */ const out = [];
  for (let i = 0; i < predRank.length; i++) for (let j = i + 1; j < predRank.length; j++) {
    if (tie && ((i + 1 === tie[0] && j + 1 === tie[1]) || (i + 1 === tie[1] && j + 1 === tie[0]))) continue;
    if (predRank[i] > predRank[j]) out.push([i, j]);
  }
  return out;
}
/** The rank of each value, the largest is first and equal values share the better rank (a competition ranking: 1, 2, 2 / 1, 1, 3). @param {number[]} values @returns {number[]} */
export const ranksOf = (values) => values.map((v) => 1 + values.filter((w) => w > v).length);
/** The order of the algorithms A, B, C by a metric as text, best first: "C > A = B". @param {number[]} values @returns {string} */
export function orderText(values) {
  const names = ['A', 'B', 'C'];
  const idx = values.map((_, i) => i).sort((i, j) => values[j] - values[i] || i - j);
  return idx.map((i, p) => (p === 0 ? '' : values[idx[p - 1]] === values[i] ? ' = ' : ' > ') + names[i]).join('');
}

/**
 * What the picture needs of the params that the schema subset cannot say (empty: fine). Pure.
 * @param {any} P @returns {Array<{path: string, detail: string}>}
 */
export function rankedProblems(P) {
  /** @type {Array<{path: string, detail: string}>} */ const out = [];
  const bad = (/** @type {string} */ path, /** @type {string} */ detail) => { out.push({ path, detail }); };
  const Q = P.ranked;
  for (const key of FORMULA_LABELS) {                                                  // WP-93 (D-174): the formula mark-up of formula.js, refused with its place when it does not parse
    for (const [lang, txt] of Object.entries(/** @type {Record<string, any>} */ (Q.labels?.[key] ?? {}))) {
      const problem = typeof txt === 'string' ? formulaProblem(txt) : null;
      if (problem) bad(`$.ranked.labels.${key}.${lang}`, problem);
    }
  }
  if (Q.view === 'topk') {
    /** @type {number[]} */ const rel = Q.relevant;
    if (new Set(rel).size !== rel.length) bad('$.ranked.relevant', 'names a position twice');
    const [a, b] = Q.cuts;
    if (!(a < b)) bad('$.ranked.cuts', `are ${a} and ${b}: the first cut point must be smaller than the second`);
    else {
      const first = atK(rel, a, rel.length + 1);
      if (first.hits === 0) bad('$.ranked.relevant', `has no relevant item in the first ${a} positions: precision at ${a} would be 0`);
      if (Q.visible >= a) bad('$.ranked.visible', `is ${Q.visible}: it must be smaller than the first cut point (${a}), the user sees only the top of the list`);
    }
    /** @type {number[]} */ const hid = Q.hidden;
    const hits = hid.filter((r) => r <= a).length;
    if (hits === 0) bad('$.ranked.hidden', `has no hidden item in the top ${a}: HR@${a} and ARHR would be 0`);
    else if (hits === hid.length) bad('$.ranked.hidden', `has every hidden item in the top ${a}: no user is missed, so the hit rate says nothing`);
  } else if (Q.view === 'corr') {
    const set = new Set(Q.predicted);
    if (set.size !== 5) bad('$.ranked.predicted', 'must name each of A, B, C, D, E once');
    else {
      const predRank = ['A', 'B', 'C', 'D', 'E'].map((x) => Q.predicted.indexOf(x) + 1);
      const p = pairs(predRank);
      if (p.d === 0) bad('$.ranked.predicted', 'is the true order: no pair crosses, so there is nothing to see in press 2');
      const [x, y] = Q.tie;
      if (x >= y) bad('$.ranked.tie', `are ${x} and ${y}: the first true rank of the tie must be smaller than the second`);
      else if (pairs(predRank, [x, y]).d === p.d) bad('$.ranked.tie', 'ties a pair that is concordant anyway: press 3 would show no pair that stops being discordant');
    }
  } else {
    if (Q.negatives >= Q.items) bad('$.ranked.negatives', `are ${Q.negatives} but the catalogue has ${Q.items} items: the sample must be smaller than the catalogue`);
    /** @type {Array<{name: string, full: number[], sampled: number[]}>} */ const ms = Q.metrics;
    for (const [m, x] of ms.entries()) {
      if (m < 2) {
        const f = ranksOf(x.full).indexOf(1), s = ranksOf(x.sampled).indexOf(1);
        if (ranksOf(x.full).filter((r) => r === 1).length !== 1 || ranksOf(x.sampled).filter((r) => r === 1).length !== 1) bad(`$.ranked.metrics[${m}]`, 'has no single best algorithm in one of the two readings: the page says who is first');
        else if (f === s) bad(`$.ranked.metrics[${m}]`, `has the same best algorithm (${'ABC'[f]}) in both readings: the page shows the order flip`);
      } else {
        const fr = ranksOf(x.full), sr = ranksOf(x.sampled);
        if (!fr.some((r, i) => sr[i] > r)) bad('$.ranked.metrics[2]', 'has no algorithm that falls in rank from the full ranking to the sample: press 3 shows one that falls');
      }
    }
  }
  return out;
}

/**
 * The picture's data and its two pure functions, `frame(k)` and `timing(key, k)`, without a DOM.
 * @param {any} P the resolved params of compare
 */
export function rankedModel(P) {
  const Q = P.ranked;
  const view = Q.view;
  const gone = { start: 0, duration: 260 };
  /** @type {(k: number) => Map<string, Record<string, string>>} */ let frame;
  /** @type {(key: string, k: number) => import('./frames.js').Timing} */ let timing;
  /** @type {Record<string, any>} */ let data = {};
  if (view === 'topk') {
    /** @type {number[]} */ const rel = Q.relevant, hidden = Q.hidden;
    const total = rel.length + 1, [c1, c2] = Q.cuts;
    const m1 = atK(rel, c1, total), m2 = atK(rel, c2, total);
    const hits = hidden.filter((r) => r <= c1);
    // WP-93 (the user, 2026-11-01, page 12): the false negatives of each cut, one mark each: the liked items after the cut (the ones of the list by position, then the one far down the list, which is after every cut)
    const fns = [c1, c2].flatMap((cut) => [...rel.filter((p) => p > cut).sort((a, b) => a - b), Q.outside].map((pos) => ({ cut, pos, far: pos === Q.outside })));
    // WP-93 (D-183, the user, 2026-11-01, page 12): FIVE presses. Press 2 is the stars of the list (100 ms, then one stagger of 90 ms each) and, when the last star has started (100 + 90 * 5 = 550) and a little more
    // (150 ms: the last star is two thirds there), the two cut lines (100 ms apart) with their labels (250 and 350 ms after the first line): the presenter says what each line hit and missed before anything is counted. Press 3 is
    // the sixth star (100 ms), the false-negative marks when it is two thirds there (250 ms later), the computations one stagger after the last mark started. Press 4 frames the sixth star, press 5 is the hidden items.
    const tCut = 100 + 90 * rel.length + 150, tFar = 100, tFn = tFar + 250, tCalc = tFn + 90 * fns.length;
    const T = { far: tFar, cut: tCut, fn: tFn, calc: tCalc };
    data = { total, m1, m2, rel, hidden, hits, hr: hitRate(hidden, c1), arhr: arhr(hidden, c1), fns, t: T };
    frame = (k) => {
      /** @type {Map<string, Record<string, string>>} */ const f = new Map();
      f.set('lst', on(k < 5));
      f.set('win', on(k === 1)); f.set('wl', rise(k === 1)); f.set('dm', { opacity: k === 1 ? '0.3' : '1' });
      // WP-93 (D-183): press 2 is the key of the star, the five stars and the two cut lines with their labels; nothing of the count is drawn yet
      f.set('sk', rise(k >= 2));                                                       // WP-93: the key of the star comes with the stars
      rel.forEach((_, j) => f.set(`rm:${j}`, pop(k >= 2)));
      f.set('c1', grow(k >= 2, 'y')); f.set('c2', grow(k >= 2, 'y')); f.set('c1l', rise(k >= 2)); f.set('c2l', rise(k >= 2));
      // press 3: the sixth star (rank 50, outside the list), the false negatives of each cut marked, the four computations and the definitions of TP, FP and FN
      f.set('fr', pop(k >= 3)); f.set('fl', rise(k >= 3));
      fns.forEach((_, i) => f.set(`fn:${i}`, pop(k >= 3)));                            // WP-93: the false negatives of each cut, marked
      for (let i = 0; i < 4; i++) f.set(`m:${i}`, rise(k >= 3));
      f.set('cd', rise(k >= 3));                                                       // WP-93 (D-174): what TP, FP and FN are at the first cut, one per line, beside the four computations
      f.set('fh', pop(k >= 4)); f.set('frl', rise(k >= 4));                            // press 4: the sixth star is framed and its verdict said
      f.set('lo', rise(k >= 5));
      hidden.forEach((_, i) => f.set(`lu:${i}`, rise(k >= 5)));
      f.set('hr', rise(k >= 5)); f.set('ar', rise(k >= 5));
      return f;
    };
    timing = (key, k) => {
      const [kind, a] = key.split(':');
      const i = Number(a);
      switch (kind) {
        case 'lst': return k === 5 ? gone : { start: 0, duration: U };
        case 'win': return k === 1 ? { start: 100, duration: U } : gone;
        case 'wl': return k === 1 ? { start: 200, duration: U } : gone;
        case 'dm': return k === 1 ? { start: 100, duration: U } : gone;
        case 'sk': return { start: 100, duration: U };
        case 'rm': return { start: 100 + i * 90, duration: U };
        case 'fr': case 'fl': return { start: T.far, duration: U };
        case 'c1': return { start: T.cut, duration: 500 };
        case 'c2': return { start: T.cut + 100, duration: 500 };
        case 'c1l': return { start: T.cut + 250, duration: U };
        case 'c2l': return { start: T.cut + 350, duration: U };
        case 'fn': return { start: T.fn + i * 90, duration: U };
        case 'm': return { start: T.calc + i * 120, duration: U };
        case 'cd': return { start: T.calc, duration: U };                               // with the first computation
        case 'fh': return { start: 200, duration: U };
        case 'frl': return { start: 500, duration: U };
        case 'lo': return { start: 100, duration: U };
        case 'lu': return { start: 200 + i * 100, duration: U };
        case 'hr': return { start: 700, duration: U };
        case 'ar': return { start: 850, duration: U };
        default: return { start: 0, duration: U };
      }
    };
  } else if (view === 'corr') {
    const predRank = ['A', 'B', 'C', 'D', 'E'].map((x) => Q.predicted.indexOf(x) + 1);
    const d = predRank.map((r, i) => Math.abs(r - (i + 1)));
    const pr = pairs(predRank), prt = pairs(predRank, Q.tie);
    const involved = predRank.map((_, i) => predRank.some((rj, j) => j !== i && ((i < j) !== (predRank[i] < rj)))).map((v, i) => (v ? i : -1)).filter((i) => i >= 0);
    // WP-93 (the user's notes on page 14): with the tie, the items that still stand in a discordant pair (the tied pair is out) keep their red line, the two tied items change it for a purple one, and tau is worked out again: as
    // Kendall's tau-b (the lead's correction of 2026-11-01), with T_true = the pairs tied in the true order (`prt.t`) and T_predicted = the pairs tied in the predicted order. A prediction is a strict order (`rankedProblems` refuses
    // anything but a permutation of A to E), so no pair is tied in it: `tPred` is 0, and no pair is tied in both orders either.
    const tieItems = Q.tie.map((/** @type {number} */ r) => r - 1);
    const still = [...new Set(discordantPairs(predRank, Q.tie).flat())].sort((a, b) => a - b);
    const tPred = 0;
    data = { predRank, d, rho: spearman(d), pr, prt, tPred, tau: kendall(pr.c, pr.d), tauTie: kendallB(prt.c, prt.d, prt.t, tPred), involved, tieItems, still };
    frame = (k) => {
      /** @type {Map<string, Record<string, string>>} */ const f = new Map();
      for (let i = 0; i < 5; i++) f.set(`d:${i}`, rise(k === 1));
      f.set('sp', rise(k === 1));
      involved.forEach((i) => f.set(`hl:${i}`, on(k === 2 || (k === 3 && still.includes(i)))));
      tieItems.forEach((/** @type {number} */ i) => f.set(`ht:${i}`, on(k === 3)));
      f.set('kp', rise(k === 2)); f.set('tb', rise(k === 3)); f.set('tl', rise(k === 3)); f.set('tp', rise(k === 3));
      f.set('tct', rise(k === 3)); f.set('tcp', rise(k === 3));                    // WP-93 (tau-b): the tie count of each order, told under its column
      return f;
    };
    timing = (key, k) => {
      const [kind, a] = key.split(':');
      const i = Number(a);
      switch (kind) {
        case 'd': return k === 1 ? { start: 100 + i * 100, duration: U } : gone;
        case 'sp': return k === 1 ? { start: 100, duration: U } : gone;
        case 'hl': return k === 2 ? { start: 100 + involved.indexOf(i) * 100, duration: U } : gone;
        case 'kp': return k === 2 ? { start: 300, duration: U } : gone;
        case 'tb': case 'tl': case 'tct': case 'tcp': return k === 3 ? { start: 100, duration: U } : gone;
        case 'ht': return k === 3 ? { start: 200 + tieItems.indexOf(i) * 100, duration: U } : gone;          // the two lines of the tied items change their colour while the panel comes (300)
        case 'tp': return k === 3 ? { start: 300, duration: U } : gone;
        default: return { start: 0, duration: U };
      }
    };
  } else {
    /** @type {Array<{name: string, full: number[], sampled: number[]}>} */ const ms = Q.metrics;
    const metrics = ms.map((x) => ({ ...x, fr: ranksOf(x.full), sr: ranksOf(x.sampled), fo: orderText(x.full), so: orderText(x.sampled) }));
    // the algorithm of press 3 that falls the most from the full ranking to the sample (the first of equals)
    const drops = metrics[2].sr.map((r, i) => r - metrics[2].fr[i]);
    const fall = drops.indexOf(Math.max(...drops));
    data = { metrics, fall };
    /** the press in which the full ranking and the sample of metric m are drawn: metrics 0 and 1 in presses 1 and 2, metric 2 (AP) both in press 3 */
    const pressOf = (/** @type {number} */ m, /** @type {boolean} */ sampled) => (m === 2 ? 3 : sampled ? 2 : 1);
    frame = (k) => {
      /** @type {Map<string, Record<string, string>>} */ const f = new Map();
      for (let m = 0; m < 3; m++) {
        f.set(`pm:${m}`, rise(k >= pressOf(m, false)));
        f.set(`fo:${m}`, rise(k >= pressOf(m, false))); f.set(`so:${m}`, rise(k >= pressOf(m, true)));
        for (let i = 0; i < 3; i++) {
          f.set(`fb:${m}:${i}`, grow(k >= pressOf(m, false))); f.set(`fv:${m}:${i}`, rise(k >= pressOf(m, false))); f.set(`fr:${m}:${i}`, pop(k >= pressOf(m, false)));
          f.set(`sb:${m}:${i}`, grow(k >= pressOf(m, true))); f.set(`sv:${m}:${i}`, rise(k >= pressOf(m, true))); f.set(`sr:${m}:${i}`, pop(k >= pressOf(m, true)));
        }
      }
      f.set('fall', on(k >= 3)); f.set('lg', rise(k >= 1)); f.set('tg', rise(k >= 1)); f.set('rl', rise(k >= 4));
      return f;
    };
    timing = (key) => {
      const [kind, a, b] = key.split(':');
      const m = Number(a), i = Number(b);
      const base = kind.startsWith('s') && m === 2 ? 600 : 0;                          // in press 3 the sample follows the full ranking
      switch (kind) {
        case 'pm': return { start: 100, duration: U };
        case 'fb': case 'sb': return { start: base + 200 + i * 100, duration: 500 };
        case 'fv': case 'sv': return { start: base + 400 + i * 100, duration: U };
        case 'fr': case 'sr': return { start: base + 500 + i * 100, duration: U };
        case 'fo': case 'so': return { start: base + 800, duration: U };
        case 'fall': return { start: 1400, duration: U };
        default: return { start: 100, duration: U };                                   // the legend, the tag, the rule
      }
    };
  }
  return { view, data, frame, timing, n: rankedPressesOf(P), duration: (/** @type {number} */ k) => pressDuration(k, frame, timing) };
}

/** @typedef {{sym: Record<'en'|'tr', string>, rest: Record<'en'|'tr', string>}} Equation  `sym` the symbolic fraction (a label), `rest` what follows its "=": the fraction with the numbers, "=", the value */

/**
 * WP-93 (D-174): every formula of the mode as a COMPUTATION, per language: the symbolic fraction (`sym`, a label, so that a deck can reword it) = the same fraction with the numbers = the value (`rest` is what follows the first
 * "="), every division a `frac(NUM|DEN)` of formula.js and never "a / b" in a line of text. The page writes `sym = rest` on one row, or `sym` and `= rest` on two where a row is too narrow (Spearman's). The numbers are the
 * model's own; the values are written as the formulas of the confusion page write them (0 and 1 without decimals, the others with two, the decimal comma in Turkish). Pure. By hand (the page's toy numbers):
 *   topk  P@10 = TP / (TP + FP) = 4 / (4 + 6) = 0.40, P@20 = 5 / (5 + 15) = 0.25, R@10 = TP / (TP + FN) = 4 / (4 + 2) = 0.67, R@20 = 5 / (5 + 1) = 0.83; HR@10 = hits / users = 3 / 5 = 0.60;
 *         ARHR = (1/1 + 1/2 + 1/4) / 5 = 1.75 / 5 = 0.35
 *   corr  rho = 1 - 6 * 4 / (5 * (5^2 - 1)) = 1 - 24 / 120 = 0.80; tau = (C - D) / (C + D) = (8 - 2) / (8 + 2) = 0.60; with D and E tied in the true order the pair is in neither count and the measure is Kendall's tau-b (Herlocker et al. 2004,
 *         p. 30-31, Eq. 7), tauTie: (C - D) / sqrt((C + D + T_true)(C + D + T_predicted)) = (8 - 1) / sqrt((8 + 1 + 1)(8 + 1 + 0)) = 7 / sqrt(10 * 9) = 7 / 9.487 = 0.74 (the gamma 7 / 9 = 0.78 and tau-a 7 / 10 = 0.70 are other measures)
 * @param {any} P the resolved params of compare @returns {Record<string, Equation>} topk: p1, p2, r1, r2, hr, ar; corr: rho, tau, tauTie; sampled: none
 */
export function rankedFormulas(P) {
  const Q = P.ranked, L = Q.labels, M = rankedModel(P);
  const langs = /** @type {Array<'en'|'tr'>} */ (['en', 'tr']);
  /** a label in both languages (a deck may give English only), its placeholders filled */
  const label = (/** @type {string} */ key, /** @type {Record<string, string|number>} */ vars = {}) => /** @type {Record<'en'|'tr', string>} */ (fillFrag({ en: L[key].en, tr: L[key].tr ?? L[key].en }, vars));
  const eq = (/** @type {string} */ key, /** @type {Record<string, string|number>} */ vars, /** @type {(lang: 'en'|'tr') => string} */ rest) => /** @type {Equation} */ ({ sym: label(key, vars), rest: Object.fromEntries(langs.map((lang) => [lang, rest(lang)])) });
  /** @type {Record<string, Equation>} */ const out = {};
  if (M.view === 'topk') {
    const [c1, c2] = Q.cuts, { m1, m2, total, hidden, hits, hr, arhr: ar } = M.data;
    // TP: relevant items inside the cut; FP: the other items inside it (k - TP); FN: relevant items outside it (all relevant - TP)
    const prec = (/** @type {number} */ k, /** @type {{hits: number, p: number, r: number}} */ m) => eq('pFormula', { k }, (lang) => `frac(${m.hits}|${m.hits} + ${k - m.hits}) = ${formulaValue(m.p, lang)}`);
    const rec = (/** @type {number} */ k, /** @type {{hits: number, p: number, r: number}} */ m) => eq('rFormula', { k }, (lang) => `frac(${m.hits}|${m.hits} + ${total - m.hits}) = ${formulaValue(m.r, lang)}`);
    out.p1 = prec(c1, m1); out.p2 = prec(c2, m2); out.r1 = rec(c1, m1); out.r2 = rec(c2, m2);
    out.hr = eq('hrFormula', { k: c1 }, (lang) => `frac(${hits.length}|${hidden.length}) = ${formulaValue(hr, lang)}`);
    out.ar = eq('arFormula', {}, (lang) => `frac(${hits.map((/** @type {number} */ r) => `frac(1|${r})`).join(' + ')}|${hidden.length}) = ${formulaValue(ar, lang)}`);
  } else if (M.view === 'corr') {
    const { d, rho, pr, tau, prt, tPred, tauTie } = M.data;
    const n = d.length, sumd2 = d.reduce((/** @type {number} */ a, /** @type {number} */ x) => a + x * x, 0);
    out.rho = eq('rhoFormula', {}, (lang) => `1 − frac(6 × ${sumd2}|${n} × (${n}² − 1)) = ${formulaValue(rho, lang)}`);
    out.tau = eq('tauFormula', {}, (lang) => `frac(${pr.c} − ${pr.d}|${pr.c} + ${pr.d}) = ${formulaValue(tau, lang)}`);
    // WP-93 (the user's notes on page 14; the lead's correction of 2026-11-01): when two items tie in the true order the tied pair is in neither count and the measure is Kendall's tau-b (Herlocker et al. 2004, Eq. 7): the numbers
    // (8 - 1) / sqrt((8 + 1 + 1)(8 + 1 + 0)), then the simplified fraction 7 / sqrt(10 * 9) (the 10 pairs the prediction separates times the 9 pairs the true order separates), then the value 0.74. NOT (8 - 1) / (8 + 1) = 0.78 (gamma).
    out.tauTie = eq('tauTieFormula', {}, (lang) => `frac(${prt.c} − ${prt.d}|sqrt((${prt.c} + ${prt.d} + ${prt.t})(${prt.c} + ${prt.d} + ${tPred}))) = frac(${prt.c - prt.d}|sqrt(${prt.c + prt.d + prt.t} × ${prt.c + prt.d + tPred})) = ${formulaValue(tauTie, lang)}`);
  }
  return out;
}
/** The whole line of a computation on ONE row: `sym = rest`, per language. @param {Equation} f @returns {Record<'en'|'tr', string>} */
export const equationLine = (f) => ({ en: `${f.sym.en} = ${f.rest.en}`, tr: `${f.sym.tr} = ${f.rest.tr}` });
/** The second row of a computation written on two rows: `= rest`, per language. @param {Equation} f @returns {Record<'en'|'tr', string>} */
export const equationRest = (f) => ({ en: `= ${f.rest.en}`, tr: `= ${f.rest.tr}` });

const LST = { x: 60, y: 170, pitch: 78, cell: 66 };                    // WP-93 (D-174): 40 px higher than it was (210): the computations of press 3 are two lines high and need the room below the list
const EQ = { x: 60, dx: 452, y: 420, dy: 94, w: 440, h: 82 };           // press 3: the 2 x 2 grid of computations (the second row ends at 596 of 600); WP-93 (page 12): 440 wide, it was 560, so that the three definitions have the room of one line each (P@20, the widest, is 398.3 px of the 414 inside a tile)
const DEF = { x: EQ.x + 2 * EQ.dx + 8, y: 420, w: 648, h: 176 };       // press 3: the panel of TP, FP and FN right of the grid (x 972 to 1620), the abbreviations in a 40 px column
const FAR = { x: 1340, y: LST.y + 170, star: 83 };                      // press 3: the item far down the list: its dots, its cell (left 70, 66 px) and its star (left 83: centred on the cell), y 340 to 406
const FN = { ring: 56, tagW: 84, tagH: 30, gap: 6 };                    // press 3: a mark of a false negative: a ring of 56 px round the star (40 px) and a tag of 84 x 30 px 6 px above the ring ("FN@10" at 22 px is 69.2 px); two tags of one item stand 6 px apart
const ROW = { y: 180, h: 64, pitch: 70 };                               // press 5: a row of the table (a fraction 1 / rank is two lines high: the row was 56 px with the text 1/r, pitch 64)
// WP-93 (D-180): pw 500 -> 520 and px [50, 590, 1130] -> [40, 580, 1120] (the panels 20 px apart, 40 px from both stage edges: they end at 1640); the circles stand at 462..496 of the inner width 514, 18 px from its edge
const SMP = { px: [40, 580, 1120], py: 80, pw: 520, ph: 444, row: 104, bar: 300 };

/**
 * The picture of the mode `ranked` (all three views).
 * @param {import('./kit.js').WidgetContext} ctx @param {Record<string, any>} P the resolved params of compare
 * @returns {import('./kit.js').WidgetBuild}
 */
export function rankedBuild(ctx, P) {
  const Q = P.ranked, L = Q.labels;
  const M = rankedModel(P);
  const sc = scene(ctx, 'mx-root rk-root');
  const { doc, box, put, add, say } = sc;
  /** A fragment with {n} etc. filled in every language. @param {Record<string, string>} f @param {Record<string, string|number>} vars */
  const fill = (f, vars) => Object.fromEntries(Object.entries(f).map(([lg, t]) => [lg, Object.entries(vars).reduce((s, [k, v]) => s.replaceAll(`{${k}}`, String(v)), String(t))]));

  /** WP-93 (D-174): set bilingual text and draw the formula mark-up in it (formula.js: frac, sqrt, badges); a text without any is left as `say` made it. @param {HTMLElement} el @param {Record<string, string>} text */
  const fsay = (el, text) => { say(el, text); renderFormula(doc, el); return el; };

  if (M.view === 'topk') {
    const { rel, hidden, fns } = M.data;
    const [c1, c2] = Q.cuts;
    const F = rankedFormulas(P);
    const lst = put('lst', h(doc, 'div', 'rk-grp'), box(0, 0, 1680, 600));
    const dm = put('dm', h(doc, 'div', 'rk-grp'), box(0, 0, 1680, 600), lst);
    const cx = (/** @type {number} */ p) => LST.x + (p - 1) * LST.pitch;
    for (let p = 1; p <= 20; p++) {
      const cell = h(doc, 'div', 'rk-cell', { 'aria-hidden': 'true', 'data-gfx': 'border' });
      cell.textContent = String(p);
      add(cell, box(cx(p), LST.y, LST.cell, LST.cell), p > Q.visible ? dm : lst);
    }
    // WP-93 (the user, 2026-11-01, page 12: "the star needs a legend"): the key of the star, with the stars it explains (the same emblem, smaller, in the colour of the stars)
    const skey = h(doc, 'div', 'rk-starkey');
    const kstar = emblem(doc, 4, 32); kstar.classList.add('rk-keystar');
    skey.append(kstar, say(h(doc, 'span'), L.starKey));
    put('sk', skey, box(LST.x, 22, 560, 44), lst);
    rel.forEach((/** @type {number} */ p, /** @type {number} */ j) => { const st = emblem(doc, 4, 40); st.classList.add('rk-star'); put(`rm:${j}`, st, `left:${cx(p) + LST.cell / 2 - 20}px;top:${LST.y - 50}px`, lst); });
    put('win', h(doc, 'div', 'rk-window', { 'aria-hidden': 'true' }), box(cx(1) - 10, LST.y - 62, Q.visible * LST.pitch + 8, LST.cell + 84), lst);
    put('wl', say(h(doc, 'div', 'rk-cap'), L.user), box(cx(1) - 10, LST.y + LST.cell + 30, 500, 34), lst);
    [[c1, 'c1', 'c1l'], [c2, 'c2', 'c2l']].forEach(([k, line, lab]) => {
      const x = cx(/** @type {number} */ (k)) + LST.cell + 4;
      put(/** @type {string} */ (line), h(doc, 'div', 'rk-cut', { 'aria-hidden': 'true' }), `${box(x, LST.y - 70, 4, LST.cell + 130)};transform-origin:50% 100%`, lst);
      put(/** @type {string} */ (lab), say(h(doc, 'div', 'rk-cutlab'), { en: `@${k}`, tr: `@${k}` }), `left:${x - 30}px;top:${LST.y + LST.cell + 64}px;width:64px;text-align:center`, lst);
    });
    // press 3 (WP-93, D-174; D-183): the four measures as COMPUTATIONS in a 2 x 2 grid, P@c1 and P@c2 on the first row, R@c1 and R@c2 on the second (the keys m:0 to m:3 of the model); each tile holds the whole line, the symbolic
    // fraction = the fraction with the numbers = the value. Beside them, what TP, FP and FN are at the first cut, one per line (WP-93, the user's page 12 notes).
    [F.p1, F.p2, F.r1, F.r2].forEach((f, i) => {
      const t = h(doc, 'div', 'rk-tile rk-eqtile', { 'aria-hidden': 'true' });
      t.append(fsay(h(doc, 'div', 'rk-eq'), equationLine(f)));
      put(`m:${i}`, t, box(EQ.x + (i % 2) * EQ.dx, EQ.y + Math.floor(i / 2) * EQ.dy, EQ.w, EQ.h), lst);
    });
    // TP, FP and FN at the first cut, ONE PER LINE (the user: "the text wraps in unrelated places"): the abbreviation in a column of its own, then its meaning in the words of the picture; a line is a row that never wraps (the stylesheet
    // holds it on one row) and FN is red like its marks in the list. Measured with the engine's fonts: the widest line (Turkish FN, 24 px) is 590.8 px of the 608 right of the column.
    const def = h(doc, 'div', 'rk-def');
    // WP-93 (D-178): the heading spells out P@k and R@k where they first appear (the tiles above them are full); one row that never wraps (EN 402 px, TR 586 of 648)
    const dhead = h(doc, 'div', 'rk-def-head');
    for (const [abbr, key] of /** @type {Array<[string, string]>} */ ([[`P@${c1}`, 'pName'], [`R@${c1}`, 'rName']])) {
      const grp = h(doc, 'span', 'rk-def-hg');
      grp.append(say(h(doc, 'b'), { en: abbr, tr: abbr }), ' ', say(h(doc, 'span'), fill(L[key], { k: c1 })));
      dhead.append(grp);
    }
    def.append(dhead);
    for (const [abbr, key] of /** @type {Array<[string, string]>} */ ([['TP', 'tpDef'], ['FP', 'fpDef'], ['FN', 'fnDef']])) {
      const row = h(doc, 'div', 'rk-def-row');
      row.append(say(h(doc, 'b', abbr === 'FN' ? 'rk-def-abbr rk-def-neg' : 'rk-def-abbr'), { en: abbr, tr: abbr }), say(h(doc, 'span'), fill(L[key], { k: c1 })));
      def.append(row);
    }
    put('cd', def, box(DEF.x, DEF.y, DEF.w, DEF.h), lst);
    // WP-93 (the user, 2026-11-01, page 12: "the sixth star comes first"): the one relevant item far down the list comes in press 3 (D-183: press 2 is the five stars and the cut lines only), outside the list (its dots say that the list goes on, its cell is its rank), before any cut line
    // or computation counts it; press 4 frames it (`fh`) and says that it is not found (`frl`)
    const far = h(doc, 'div', 'rk-far', { 'aria-hidden': 'true' });
    far.append(h(doc, 'span', 'rk-dots'), h(doc, 'div', 'rk-cell rk-cell-far'));
    far.lastElementChild.textContent = String(Q.outside);
    const st = emblem(doc, 4, 40); st.classList.add('rk-star'); st.style.cssText += `;position:absolute;left:${FAR.star}px;top:-50px`;
    far.append(st);
    put('fr', far, box(FAR.x, FAR.y, 200, LST.cell), lst);
    put('fl', say(h(doc, 'div', 'rk-farlab'), fill(L.farAt, { n: Q.outside })), box(FAR.x - 340, FAR.y + 12, 320, 40), lst);
    put('fh', h(doc, 'div', 'rk-farhl', { 'aria-hidden': 'true' }), box(FAR.x + 70, FAR.y, LST.cell, LST.cell), lst);       // press 4: a red border laid over the cell's own, the item that is not found
    put('frl', say(h(doc, 'div', 'rk-note', { 'data-role': 'neg' }), fill(L.far, { n: Q.outside, k: c2 })), box(LST.x, LST.y + 178, 900, 40), lst);   // 900 px: the sentence is 497 px (English) or 484 px (Turkish) at 30 px; the label of the item (x 1000 on) stands right of it
    // WP-93 (the user: "mark those items in the picture, so the 2 in TP + FN can be counted on the screen"): the false negatives of each cut (the model's `fns`: one per liked item beyond a cut) marked where they are: a red ring round the
    // star (once per item, with its first mark) and a tag FN@cut above it; the sixth item, missed by both cuts, has two tags side by side
    const starAt = (/** @type {{pos: number, far: boolean}} */ m) => (m.far ? { x: FAR.x + 70 + LST.cell / 2, y: FAR.y - 30 } : { x: cx(m.pos) + LST.cell / 2, y: LST.y - 30 });
    fns.forEach((/** @type {{cut: number, pos: number, far: boolean}} */ m, /** @type {number} */ i) => {
      const same = fns.filter((/** @type {{pos: number}} */ o) => o.pos === m.pos);
      const slot = same.indexOf(m);
      const mark = h(doc, 'div', slot === 0 ? 'rk-fn' : 'rk-fn rk-fn-bare', { 'aria-hidden': 'true' });
      const left = same.length === 1 ? (FN.ring - FN.tagW) / 2 : slot === 0 ? FN.ring / 2 - FN.gap / 2 - FN.tagW : FN.ring / 2 + FN.gap / 2;
      add(say(h(doc, 'span', 'rk-fntag'), { en: `FN@${m.cut}`, tr: `FN@${m.cut}` }), `left:${left}px;top:${-(FN.tagH + 6)}px;width:${FN.tagW}px;height:${FN.tagH}px`, mark);
      const c = starAt(m);
      put(`fn:${i}`, mark, box(c.x - FN.ring / 2, c.y - FN.ring / 2, FN.ring, FN.ring), lst);
    });
    // press 5: one hidden item per user (leave-one-out): the rank of each, the hit rate and the average reciprocal hit rank
    const lo = put('lo', h(doc, 'div', 'rk-grp'), box(0, 0, 1680, 600));
    add(say(h(doc, 'div', 'rk-q'), L.loo), box(110, 70, 1000, 44), lo);
    const COL = { user: 16, rank: 190, hit: 410, w: 560 };                // the header cells may wrap to two lines: the hit column ends (540) before the weight column starts (560)
    const head = h(doc, 'div', 'rk-th');
    add(say(h(doc, 'div', 'rk-thc'), L.colRank), `left:${COL.rank}px;top:0;width:200px`, head);
    add(say(h(doc, 'div', 'rk-thc'), fill(L.colHit, { k: c1 })), `left:${COL.hit}px;top:0;width:130px`, head);
    add(fsay(h(doc, 'div', 'rk-thc'), L.colW), `left:${COL.w}px;top:0;width:230px`, head);              // WP-93 (D-174, D-177): the header says 1/rank as text (the user's choice for this page, 162 px EN / 191 px TR of 230); the weight in every row below is a bar fraction
    add(head, box(110, 122, 790, 52), lo);
    hidden.forEach((/** @type {number} */ r, /** @type {number} */ i) => {
      const hit = r <= c1;
      const row = h(doc, 'div', `rk-row ${hit ? 'rk-row-hit' : 'rk-row-miss'}`, { 'aria-hidden': 'true', 'data-gfx': 'border' });
      add(say(h(doc, 'span', 'rk-row-user'), fill(L.userN, { i: i + 1 })), `left:${COL.user}px;top:0;width:170px`, row);
      const chip = h(doc, 'span', 'rk-rankchip'); chip.textContent = String(r); add(chip, `left:${COL.rank}px;top:${(ROW.h - 40) / 2}px;width:96px`, row);
      add(mark(doc, hit), `left:${COL.hit + 26}px;top:${(ROW.h - 34) / 2}px`, row);
      if (hit) {
        add(fsay(h(doc, 'span', 'rk-recip'), { en: `frac(1|${r})`, tr: `frac(1|${r})` }), `left:${COL.w}px;top:0;width:64px`, row);
        add(h(doc, 'span', 'rk-wbar', { 'data-gfx': 'fill' }), `left:${COL.w + 72}px;top:${(ROW.h - 22) / 2}px;width:${Math.max(4, Math.round(150 / r))}px`, row);
      } else add(say(h(doc, 'span', 'rk-recip'), { en: '0', tr: '0' }), `left:${COL.w}px;top:0;width:64px`, row);
      put(`lu:${i}`, row, box(110, ROW.y + i * ROW.pitch, 790, ROW.h), lo);
    });
    // the two tiles: the name, how it is said in words, and the computation (WP-93, D-174: one row, the symbolic fraction = the numbers = the value; ARHR's fractions nest, so its tile is the taller)
    const tile = (/** @type {string} */ key, /** @type {number} */ y, /** @type {number} */ hh, /** @type {Record<string, string>} */ name, /** @type {string} */ abbr, /** @type {Record<string, string>} */ how, /** @type {Equation} */ f) => {
      const t = h(doc, 'div', 'rk-hrtile', { 'aria-hidden': 'true' });
      const nm = h(doc, 'div', 'rk-hr-name'); nm.append(say(h(doc, 'b'), { en: abbr, tr: abbr }), ' ', say(h(doc, 'span'), name));
      t.append(nm, fsay(h(doc, 'div', 'rk-hr-how'), how), fsay(h(doc, 'div', 'rk-hr-calc'), equationLine(f)));
      put(key, t, box(960, y, 670, hh), lo);
    };
    tile('hr', 100, 200, L.hrName, `HR@${c1}`, fill(L.hrHow, { k: c1 }), F.hr);          // by hand (tests/js/compare-w07-build.test.mjs): name 40 + how 33 + computation 78 = 151 of 166 inside the padding
    tile('ar', 316, 256, L.arName, 'ARHR', L.arHow, F.ar);                              // name 40 + how 4 + 30 (plain text since D-177; with a fraction in a deck's own text it is 4 + 54.5) + computation (nested fractions) 10 + 100 = 184 of 222 (208.5 with a fraction)
  } else if (M.view === 'corr') {
    const { predRank, d, pr, prt, involved, tieItems } = M.data;
    const F = rankedFormulas(P);
    const X1 = 360, X2 = 900, Y0 = 130, PY = 80;
    const names = ['A', 'B', 'C', 'D', 'E'];
    add(say(h(doc, 'div', 'rk-cap rk-center'), L.trueOrder), box(X1 - 80, 64, 220, 34));
    add(say(h(doc, 'div', 'rk-cap rk-center'), L.predicted), box(X2 - 80, 64, 220, 34));
    names.forEach((nm, i) => {
      const chip = (/** @type {number} */ x, /** @type {number} */ y) => { const c = h(doc, 'div', 'rk-chip', { 'data-gfx': 'border' }); c.textContent = nm; add(c, box(x, y, 60, 56)); };
      chip(X1, Y0 + i * PY); chip(X2, Y0 + (predRank[i] - 1) * PY);
      const y1 = Y0 + i * PY + 28, y2 = Y0 + (predRank[i] - 1) * PY + 28;
      const len = Math.hypot(X2 - X1 - 60, y2 - y1), ang = Math.atan2(y2 - y1, X2 - X1 - 60) * 180 / Math.PI;
      add(h(doc, 'div', 'rk-line', { 'aria-hidden': 'true' }), `left:${X1 + 60}px;top:${y1 - 2}px;width:${len}px;transform:rotate(${ang}deg);transform-origin:0 50%`);
      if (involved.includes(i)) put(`hl:${i}`, h(doc, 'div', 'rk-line rk-line-hl', { 'aria-hidden': 'true' }), `left:${X1 + 60}px;top:${y1 - 4}px;width:${len}px;transform:rotate(${ang}deg);transform-origin:0 50%`);
      // WP-93 (the user's notes on page 14): in press 3 the line of a tied item changes from the red of a discordant pair to the purple of the term "tied" (the pair is in neither count)
      if (tieItems.includes(i)) put(`ht:${i}`, h(doc, 'div', 'rk-line rk-line-tie', { 'aria-hidden': 'true' }), `left:${X1 + 60}px;top:${y1 - 4}px;width:${len}px;transform:rotate(${ang}deg);transform-origin:0 50%`);
      put(`d:${i}`, say(h(doc, 'div', 'rk-d'), { en: `d = ${d[i]}`, tr: `d = ${d[i]}` }), `left:${X2 + 76}px;top:${Y0 + (predRank[i] - 1) * PY + 12}px`);
    });
    /** A panel: its title, then lines: a drawn computation or text (`rk-panel-line`), or a line of its own class (`{ text, cls }`); `hh` is its height (330; the press-3 panel is taller), `x` and `w` its left edge and width (the right edge stays at 1630). */
    const panel = (/** @type {string} */ key, /** @type {Record<string, string>} */ title, /** @type {Array<Record<string, string> | {text: Record<string, string>, cls: string}>} */ lines, hh = 330, x = 1130, w = 500) => {
      const el = h(doc, 'div', 'rk-panel', { 'aria-hidden': 'true' });
      el.append(say(h(doc, 'div', 'rk-panel-title'), title));
      for (const ln of lines) { const spec = 'text' in ln ? ln : { text: ln, cls: 'rk-panel-line' }; el.append(fsay(h(doc, 'div', spec.cls), /** @type {Record<string, string>} */ (spec.text))); }
      put(key, el, box(x, 110, w, hh));
    };
    // WP-93 (D-174): Spearman's computation is too wide for one row of the panel (about 565 px of 456): the symbolic fraction on the first row, the values of its symbols on the second, then "= the numbers = the value"; Kendall's fits on one row
    const sumd2 = d.reduce((/** @type {number} */ a, /** @type {number} */ x) => a + x * x, 0);
    panel('sp', L.spearman, [F.rho.sym, frag(`Σd² = ${sumd2},  n = ${d.length}`, `Σd² = ${sumd2},  n = ${d.length}`), equationRest(F.rho)]);
    panel('kp', L.kendall, [frag(`${L.concordant.en}: ${pr.c}   ${L.discordant.en}: ${pr.d}`, `${L.concordant.tr ?? L.concordant.en}: ${pr.c}   ${L.discordant.tr ?? L.discordant.en}: ${pr.d}`), equationLine(F.tau)]);
    const [t1, t2] = Q.tie;
    // WP-93 (the user's notes on page 14: "say why a tied pair is neither concordant nor discordant, and how that changes tau, with the numbers"; the lead's correction of 2026-11-01: with the tie the measure is Kendall's tau-b): the counts,
    // then why (a tie has no order to agree or disagree with), then tau without the tie (the press-2 computation) and with it, on two rows: the symbolic fraction, then the numbers, the simplified fraction and the value (481 px at 28 px).
    // The panel is 560 x 486 (x 1070 to 1630, y 110 to 596; the other two panels are 500 wide and keep the right edge): inside it is 510 x 444, and the rows need 46.5 (title) + 37.8 (counts) + 75.4 (the reason, 2 lines of 29.7) +
    // 101.3 (caption and computation of tau without the tie) + 37.7 (caption) + 2 x 65.9 (the tau-b rows) = 430.5
    panel('tp', L.tieNote, [
      frag(`${L.concordant.en}: ${prt.c}   ${L.discordant.en}: ${prt.d}   ${L.tied.en}: ${prt.t}`, `${L.concordant.tr ?? L.concordant.en}: ${prt.c}   ${L.discordant.tr ?? L.discordant.en}: ${prt.d}   ${L.tied.tr ?? L.tied.en}: ${prt.t}`),
      { text: fill(L.tieWhy, { a: names[t1 - 1], b: names[t2 - 1] }), cls: 'rk-panel-note' },
      { text: L.tieBefore, cls: 'rk-panel-cap' }, equationLine(F.tau),
      { text: L.tieAfter, cls: 'rk-panel-cap' }, F.tauTie.sym, equationRest(F.tauTie),
    ], 486, 1070, 560);
    const tieY = Y0 + (t1 - 1) * PY - 4, tieH = (t2 - t1) * PY + 64;
    put('tb', h(doc, 'div', 'rk-tie', { 'aria-hidden': 'true' }), box(X1 - 22, tieY, 8, tieH));
    put('tl', say(h(doc, 'div', 'rk-tielab', { 'data-role': 'term' }), L.tied), box(X1 - 22 - 12 - 120, tieY + tieH / 2 - 17, 120, 34));   // the word "tied" left of the bracket, in the colour of a term
    // WP-93 (tau-b): the tie count of each order under its column, where the symbol of the formula is born: T_true under the true order (the pair D-E, 1) and T_predicted under the predicted one (none, 0); 22 px, EN 171 / 207 px, TR 192 / 228 px
    const under = Y0 + 4 * PY + 56 + 18;                                      // 18 px under the chip of the fifth position (the bracket ends 4 px lower)
    put('tct', fsay(h(doc, 'div', 'rk-tiecount'), fill(L.tieCountTrue, { n: prt.t })), box(X1 + 30 - 130, under, 260, 34));
    put('tcp', fsay(h(doc, 'div', 'rk-tiecount'), fill(L.tieCountPred, { n: M.data.tPred })), box(X2 + 30 - 130, under, 260, 34));
  } else {
    // Rendle 2019: three hypothetical algorithms, three metrics, the full ranking (a dashed, hollow bar) and the sample (a solid bar), the rank of each algorithm in a numbered circle
    const { metrics, fall } = M.data;
    const lg = h(doc, 'div', 'rk-legend', { 'aria-hidden': 'true' });
    lg.append(h(doc, 'i', 'rk-sw-full'), say(h(doc, 'span'), fillFragL(L.legendFull, (lang) => ({ n: group(Q.items, lang) }))), h(doc, 'i', 'rk-sw-samp'), say(h(doc, 'span'), fillFragL(L.legendSample, (lang) => ({ m: group(Q.negatives, lang), r: group(Q.repeats, lang) }))), say(h(doc, 'span', 'rk-key'), L.rankKey));   // WP-93 (D-180): the key of the circles' numbers, the last item of the row
    put('lg', lg, box(SMP.px[0], 22, SMP.px[2] + SMP.pw - SMP.px[0], 40));                      // the row spans the panels (x 40 to 1640), so the key can stand at its right edge
    const tg = put('tg', say(h(doc, 'div', 'rk-tag'), L.tag), box(SMP.px[2] + SMP.pw - 400, 544, 400, 40));     // WP-93 (D-180): on the row of the rule, right-aligned at the panels' edge (the legend row is full)
    if (!L.tag.en) /** @type {HTMLElement} */ (tg).hidden = true;                                                                // an empty tag hides the label (the key stays: the frames do not depend on the text)
    /** One line of an order: the name of the ranking and its colon in a column of its own, the order (letters and signs, the same in every language) after it. @param {Record<string, string>} label @param {string} text */
    const orderLine = (label, text) => {
      const el = h(doc, 'div', 'rk-order');
      const val = h(doc, 'span', 'rk-order-val'); val.textContent = text;
      el.append(say(h(doc, 'span', 'rk-order-name'), Object.fromEntries(Object.entries(label).map(([lg2, name]) => [lg2, `${name}:`]))), val);
      return el;
    };
    metrics.forEach((/** @type {any} */ x, /** @type {number} */ m) => {
      const pm = put(`pm:${m}`, h(doc, 'div', 'rk-pm', { 'aria-hidden': 'true', 'data-gfx': 'border' }), box(SMP.px[m], SMP.py, SMP.pw, SMP.ph));
      add(say(h(doc, 'div', 'rk-pm-title'), frag(x.name, x.name)), box(0, 10, SMP.pw, 40), pm);
      ['A', 'B', 'C'].forEach((nm, i) => {
        const top = 62 + i * SMP.row;
        const chip = h(doc, 'div', 'rk-chip', { 'data-gfx': 'border' }); chip.textContent = nm;
        add(chip, box(18, top + 14, 46, 46), pm);
        /** @type {Array<[string, number[], number[], number, string]>} */
        const rows = [['f', x.full, x.fr, top + 4, 'rk-bar-full'], ['s', x.sampled, x.sr, top + 44, 'rk-bar-samp']];
        for (const [p, vals, ranks, y, cls] of rows) {
          put(`${p}b:${m}:${i}`, h(doc, 'div', `rk-sbar ${cls}`, { 'data-gfx': 'fill' }), `${box(80, y, Math.max(4, Math.round(vals[i] * SMP.bar)), 30)};transform-origin:0 50%`, pm);
          put(`${p}v:${m}:${i}`, say(h(doc, 'div', 'rk-sval'), num(vals[i], 3)), box(386, y, 70, 30), pm);
          const badge = h(doc, 'div', `rk-rank rk-rank-${ranks[i]}${p === 'f' ? ' rk-rank-up' : ''}`, { 'data-gfx': 'border' }); badge.textContent = String(ranks[i]);   // WP-93 (D-180): identical circles, the rank fades 1, 2, 3; the upper one (the full ranking) is dashed like its bar
          put(`${p}r:${m}:${i}`, badge, box(462, y - 2, 34, 34), pm);
        }
      });
      // WP-93 (brief 10 item 3, D-162; the user: "the A-B-C orderings under the three examples should start from the same vertical line, they look scattered"): a name column of a fixed width and an order column, so the two orders of a panel (and of all three panels) begin at the same x
      put(`fo:${m}`, orderLine(L.fullName, x.fo), box(18, 62 + 3 * SMP.row - 14, SMP.pw - 36, 32), pm);
      put(`so:${m}`, orderLine(L.sampleName, x.so), box(18, 62 + 3 * SMP.row + 22, SMP.pw - 36, 32), pm);
      if (m === 2) put('fall', h(doc, 'div', 'rk-fall', { 'aria-hidden': 'true', 'data-gfx': 'border' }), box(70, 62 + fall * SMP.row + 36, 430, 46), pm);
    });
    put('rl', say(h(doc, 'div', 'rk-rule'), L.rule), box(SMP.px[0], 538, SMP.px[2] + SMP.pw - SMP.px[0], 44));
  }
  return finish(ctx, sc, M.n, M.frame, M.timing);
}

/** A tick (a hit) or a cross (a miss), drawn in currentColor: the shape cue next to the colour. @param {Document} doc @param {boolean} good */
function mark(doc, good) {
  const ns = 'http://www.w3.org/2000/svg';
  const sv = doc.createElementNS(ns, 'svg');
  sv.setAttribute('class', `rk-mark ${good ? 'rk-hit' : 'rk-miss'}`); sv.setAttribute('width', '34'); sv.setAttribute('height', '34'); sv.setAttribute('viewBox', '0 0 34 34'); sv.setAttribute('aria-hidden', 'true');
  const p = doc.createElementNS(ns, 'path');
  p.setAttribute('d', good ? 'M6 18l8 8 14-16' : 'M8 8l18 18M26 8L8 26');
  sv.append(p);
  return /** @type {SVGElement} */ (sv);
}
