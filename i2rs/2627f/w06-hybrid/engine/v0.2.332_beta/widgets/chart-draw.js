// @ts-check
// WP-50 (D-112, brief 07; the storyboard's W4): chart-draw, a chart that is drawn press by press: the lines draw, the points pop, the labels rise; the story is in the order they come.
// One widget, one mode per page: `vote` (page s6, the majority-vote curve of a committee) and `milestones` (page s9, the published RMSEs of the Netflix Prize as ordered milestones, chart-milestones.js).
// A mode is a support module (like table-matrix.js of table-highlight) that holds its params, its example and its picture; this file holds the widget: its id, the one schema the registry
// carries, and the step count. The widget draws numbers it is given and never makes one: the deck takes them from its script (evidence record `our-computation`, no seed).
//
// Kit shape (engine/widgets/kit.js): defineWidget({id, steps, params, stepCount, examples, build}).
import { defineWidget } from './kit.js';
import { voteProps, voteExample, votePresses, voteBuild } from './chart-vote.js';
import { milestonesSchema, milestonesExamples, milestonesProblems, milestonesBuild } from './chart-milestones.js';          // WP-50 (D-112): the mode `milestones`
import { finishSchema, finishExamples, finishProblems, finishBuild, finishPresses } from './chart-finish.js';        // WP-74 (D-149): the mode `finish` (w07, the Netflix Prize on the test set)
import { rocSchema, rocExamples, rocProblems, rocBuild, rocPresses } from './chart-roc.js';                        // WP-74 (D-149): the mode `roc` (w07, ROC and AUC)
import { seedsSchema, seedsExamples, seedsProblems, seedsBuild, seedsPresses } from './chart-seeds.js';                  // WP-74 (D-149): the mode `seeds` (w07, one run is an anecdote)

/** The params' JSON Schema, inside the subset of engine/widgets/params.js (the registry carries the same one). */
export const schema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    mode: {
      type: 'string', enum: ['vote', 'milestones', 'finish', 'roc', 'seeds'], default: 'vote', title: 'the picture',
      description: 'vote: the chance that the majority of n members is right, for independent members, for copies of one model and (optional) for members that are right less than half of the time, beside the number line of Galton\'s village fair, and a bar of squared bias + variance + noise in invented proportions, tagged synthetic data (seven presses). milestones: the published test RMSEs of the Netflix Prize as ordered milestones with a target line, the Grand Prize tie, and a separate card of production numbers (four presses). finish (WP-74): the Netflix Prize on the test set as a ladder of milestones (the movie average, Cinematch, the target, the two progress prizes, the Grand Prize) with the finalists\' quiz against test card, the six decimals of the tie and the rule that the earlier submission wins (five presses). roc (WP-74, WP-93): ROC and AUC for two ranked lists of ten, told from one curve first (a cut slides down a list while the counts TP, FP, FN, TN and the open formulas of TPR and FPR change at every rank and the curve is drawn step by step, the oracle and the random diagonal, two lists that win on different parts, the shaded area is the AUC; five presses). seeds (WP-74): one run is an anecdote: the measured spread of one algorithm over random seeds (6.3 % for a single split, 2.3 % with cross-validation; the dots are synthetic), an untuned baseline against a carefully run one, the practice (four presses).',   // WP-93: the roc sentence follows chart-roc.js (five presses since the walk of one curve)
    },
    ...voteProps,
    milestones: milestonesSchema,
    finish: finishSchema,
    roc: rocSchema,
    seeds: seedsSchema,
  },
};

/** @param {any} params the params with the schema's defaults filled in @returns {number} */
const presses = (params) => (params.mode === 'milestones' ? 4 : params.mode === 'finish' ? finishPresses : params.mode === 'roc' ? rocPresses : params.mode === 'seeds' ? seedsPresses : votePresses(params));

export default defineWidget({
  id: 'chart-draw',
  steps: 'Mode milestones, four presses: 1 the published test RMSE of Cinematch with its line, the target line (10 per cent better) and the bracket between them; 2 the progress prizes of 2007 and 2008 and the Grand Prize come one after the other on a ladder of milestones (not a time axis), the Grand Prize is a tie of two teams at the same height with their submission times, the earlier submission won; 3 the leaderboard dims and a card of its own shows what ran in production (three numbers, set not stated); 4 both are washed in gold together. Mode vote, seven presses (six without the worse curve): 1 the village fair of Galton (the dressed weight of an ox and the middle of 787 guesses on a number line); 2 the chance that the majority is right for independent members, each right 75 % of the time, at n = 1 and 5; 3 the rest of the curve (n = 9 and 17 written); 4 copies of one model: a flat dashed line, no gain; 5 members that are right only 40 % of the time: the vote gets worse (optional, empty `worse.points` drops it); 6 the chart dims for a bar of squared bias + variance + noise in invented proportions (tagged synthetic data); 7 the chart returns and the gap between the independent curve and the flat line is washed in gold. Mode finish (WP-74), five presses, the whole ladder on the test set: 1 the movie average (1.0540); 2 Cinematch (0.9525, its quiz value 0.9514 beside it) and a line down to it; 3 the dashed target line (0.8572, 10 per cent better) and the 2007 and 2008 progress prizes (0.8723, 0.8627); 4 the two finalists at the same height (test 0.8567, a tie at four decimals, the winner a filled point and the runner-up a ring) and a card: on the public quiz the order was the reverse (0.8553 and 0.8554); 5 six decimals (0.856704 and 0.856714), the earlier submission wins (19 min 54 s earlier) and the leaderboard did not decide the winner. Mode roc (WP-74, five presses since WP-93): 1 one ranked list of ten with five relevant items, unnamed, and a cut that slides down it (the top k is recommended): the four counts TP, FP, FN, TN and the open formulas TPR = TP / (TP + FN) and FPR = FP / (FP + TN) show the numbers of every k, a point drops onto the chart at (FPR, TPR) and the ROC curve builds behind it step by step (a relevant item up, an irrelevant one right), the cut walks the first `first` ranks (default 4); 2 the cut runs on to the end of the list, faster, and the curve is complete at (1, 1); 3 the walk machinery leaves, the oracle (every relevant item first) is the best curve and a random list is the diagonal, on average; 4 the first list is named algorithm A and a second list, B, is walked: A is ahead at the start and B later, the curves cross; 5 the area under the curve of B is shaded: AUC = the pairs with the relevant item first over all pairs (A 15 / 25 = 0.60, B 16 / 25 = 0.64) and AUC is blind to position. Mode seeds (WP-74), four presses: 1 a single split: the spread over eight seeds inside the measured band of 6.3 % (synthetic dots); 2 cross-validation: the band of 2.3 %; 3 an untuned baseline as reported (RMSE 0.8197) against the same baseline run carefully (0.7633) and the best reported method (0.7634); 4 5 of 26 papers repeated the seeds, more than half of the new-algorithm papers have no significance test, and the gold sentence: one run is an anecdote.',   // WP-93: the roc sentence follows chart-roc.js (five presses since the walk of one curve)
  params: schema,
  stepCount: presses,
  check: (params) => (params.mode === 'milestones' ? milestonesProblems(params) : params.mode === 'finish' ? finishProblems(params) : params.mode === 'roc' ? rocProblems(params) : params.mode === 'seeds' ? seedsProblems(params) : []),                 // WP-50: the mode's own rules, pure
  // The params the widget is shown with (the harness builds a slide from each): the lecture's page.
  examples: [voteExample, ...milestonesExamples, ...finishExamples, ...rocExamples, ...seedsExamples],
  build(ctx, P) {
    if (P.mode === 'milestones') return milestonesBuild(ctx, P);
    if (P.mode === 'finish') return finishBuild(ctx, P);                                // WP-74: the finish mode (chart-finish.js)
    if (P.mode === 'roc') return rocBuild(ctx, P);                                      // WP-74: the roc mode (chart-roc.js)
    if (P.mode === 'seeds') return seedsBuild(ctx, P);                                  // WP-74: the seeds mode (chart-seeds.js)
    return voteBuild(ctx, P);
  },
});
