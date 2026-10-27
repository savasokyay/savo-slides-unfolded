// @ts-check
// WP-160: the geometry of the latent-space scene (components/embedding-panel.js), pure so it can be checked by hand (tests/app/js/scatter_scene_check.mjs).
// The scene is as big as the stage in pixels; what it keeps over the whole walk is the BOUNDS of the axes (over every frame, the origin included, grown by 12 % of the
// span on each side) and each point's reach in x, so nothing rescales or flips while the player runs.

export const PAD_X = 24; // the plot's left / right margin in the scene (the x axis' label sits in it)
export const PAD_TOP = 26; // under the epoch bubble
export const PAD_BOTTOM = 18;
export const LABEL_GAP = 8; // a label's distance from its dot, px
export const GLYPH = 0.56; // the width of an average glyph as a share of the font size: the room a label needs is estimated from its length
export const MARGIN = 0.12; // the share of the span added on each side of the data

/**
 * @param {number[][][]} frames `frames[f][p]` = the position `[x, y]` of point `p` in frame `f`
 * @param {number} nPoints
 * @returns {{bounds: {xmin: number, xmax: number, ymin: number, ymax: number}, reach: Array<[number, number]>}}
 *   the bounds over EVERY frame (origin included) grown by `MARGIN` of the span, and each point's x range over the frames (data units)
 */
export function sceneBounds(frames, nPoints) {
  let xmin = 0;
  let xmax = 0;
  let ymin = 0;
  let ymax = 0;
  /** @type {Array<[number, number]>} */
  const reach = Array.from({ length: nPoints }, () => /** @type {[number, number]} */ ([Infinity, -Infinity]));
  for (const frame of frames) {
    frame.forEach(([x, y], p) => {
      xmin = Math.min(xmin, x);
      xmax = Math.max(xmax, x);
      ymin = Math.min(ymin, y);
      ymax = Math.max(ymax, y);
      if (reach[p]) reach[p] = [Math.min(reach[p][0], x), Math.max(reach[p][1], x)];
    });
  }
  const grow = (/** @type {number} */ lo, /** @type {number} */ hi) => {
    const span = hi - lo || 1;
    return [lo - MARGIN * span, hi + MARGIN * span];
  };
  [xmin, xmax] = grow(xmin, xmax);
  [ymin, ymax] = grow(ymin, ymax);
  return { bounds: { xmin, xmax, ymin, ymax }, reach };
}

/**
 * @param {{xmin: number, xmax: number, ymin: number, ymax: number}} bounds
 * @param {number} w the scene's width, px
 * @param {number} h the scene's height, px
 * @returns {{x: (x: number) => number, y: (y: number) => number}} data units -> scene pixels (y grows upwards in the data, downwards on the screen)
 */
export function sceneScales(bounds, w, h) {
  const { xmin, xmax, ymin, ymax } = bounds;
  return {
    x: (x) => PAD_X + ((x - xmin) / (xmax - xmin)) * (w - 2 * PAD_X),
    y: (y) => h - PAD_BOTTOM - ((y - ymin) / (ymax - ymin)) * (h - PAD_TOP - PAD_BOTTOM),
  };
}

/**
 * The side of its dot a label goes to, decided once per scene from the dot's reach over the whole walk (never from the current frame: a label that flipped while the
 * points play would jump): right when it fits there, else left when it fits there, else the side with more room.
 * @param {string} label
 * @param {number} fontPx the label's font size (scene px)
 * @param {[number, number]} reachPx the dot's leftmost and rightmost x in the scene (px) over every frame
 * @param {number} w the scene's width, px
 * @returns {"right" | "left"}
 */
export function labelSide(label, fontPx, reachPx, w) {
  const need = LABEL_GAP + label.length * fontPx * GLYPH;
  const right = w - reachPx[1];
  const left = reachPx[0];
  return right < need && left > right ? "left" : "right";
}

/**
 * WP-170: the room a label has on the side `labelSide` chose, from the dot's whole-walk reach (the same numbers, so the label's text never changes while the player runs).
 * @param {"right" | "left"} side
 * @param {[number, number]} reachPx the dot's leftmost and rightmost x in the scene (px) over every frame
 * @param {number} w the scene's width, px
 * @returns {number} px between the dot's reach and the scene's edge on that side
 */
export function labelRoom(side, reachPx, w) {
  return side === "left" ? reachPx[0] : w - reachPx[1];
}

/**
 * WP-170: a label that is wider than the room on BOTH sides of its dot (a 61-character title in a 416 px scene: cut 52 px by the scene's edge) gives way with an ellipsis, the
 * same rule as every film title in the app (WP-135): the NAME shortens, the "(Year)" that ends it stays while a few letters of the name still fit beside it; the full title is
 * the dot's hover title (embedding-panel.js). The width is MEASURED by the caller (`measure`: the rendered text's length in scene px), so the estimate `labelSide` decides the
 * side with is not what the clip is judged by. A label that fits is returned as it is.
 * @param {string} label the full label
 * @param {number} room px between the dot's reach and the scene's edge on the label's side (`labelRoom`)
 * @param {(text: string) => number} measure the width, in scene px, the text takes when drawn
 * @returns {string}
 */
export function fitLabel(label, room, measure) {
  const avail = room - LABEL_GAP;
  if (measure(label) <= avail) return label;
  const parts = /^(.*?)( \(\d{4}\))?$/.exec(label);
  const name = parts?.[1] ?? label;
  const year = parts?.[2] ?? "";
  for (const tail of year ? [year, ""] : [""]) {
    for (let n = name.length - 1; n >= (tail ? 3 : 1); n--) {
      const cut = `${name.slice(0, n).trimEnd()}…${tail}`;
      if (measure(cut) <= avail) return cut;
    }
  }
  return "…";
}
