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

/** The params' JSON Schema, inside the subset of engine/widgets/params.js (the registry carries the same one). */
export const schema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    mode: {
      type: 'string', enum: ['vote', 'milestones'], default: 'vote', title: 'the picture',
      description: 'vote: the chance that the majority of n members is right, for independent members, for copies of one model and (optional) for members that are right less than half of the time, beside the number line of Galton\'s village fair, and a bar of squared bias + variance + noise in invented proportions, tagged synthetic data (seven presses). milestones: the published test RMSEs of the Netflix Prize as ordered milestones with a target line, the Grand Prize tie, and a separate card of production numbers (four presses).',
    },
    ...voteProps,
    milestones: milestonesSchema,
  },
};

/** @param {any} params the params with the schema's defaults filled in @returns {number} */
const presses = (params) => (params.mode === 'milestones' ? 4 : votePresses(params));

export default defineWidget({
  id: 'chart-draw',
  steps: 'Mode milestones, four presses: 1 the published test RMSE of Cinematch with its line, the target line (10 per cent better) and the bracket between them; 2 the progress prizes of 2007 and 2008 and the Grand Prize come one after the other on a ladder of milestones (not a time axis), the Grand Prize is a tie of two teams at the same height with their submission times, the earlier submission won; 3 the leaderboard dims and a card of its own shows what ran in production (three numbers, set not stated); 4 both are washed in gold together. Mode vote, seven presses (six without the worse curve): 1 the village fair of Galton (the dressed weight of an ox and the middle of 787 guesses on a number line); 2 the chance that the majority is right for independent members, each right 75 % of the time, at n = 1 and 5; 3 the rest of the curve (n = 9 and 17 written); 4 copies of one model: a flat dashed line, no gain; 5 members that are right only 40 % of the time: the vote gets worse (optional, empty `worse.points` drops it); 6 the chart dims for a bar of squared bias + variance + noise in invented proportions (tagged synthetic data); 7 the chart returns and the gap between the independent curve and the flat line is washed in gold.',
  params: schema,
  stepCount: presses,
  check: (params) => (params.mode === 'milestones' ? milestonesProblems(params) : []),                 // WP-50: the mode's own rules, pure
  // The params the widget is shown with (the harness builds a slide from each): the lecture's page.
  examples: [voteExample, ...milestonesExamples],
  build(ctx, P) {
    if (P.mode === 'milestones') return milestonesBuild(ctx, P);
    return voteBuild(ctx, P);
  },
});
