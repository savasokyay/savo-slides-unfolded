// @ts-check
// WP-110 (b''): the fixed centre z of the constrained Pearson (Shardanand & Maes 1995 Eq. 5: ratings above z count as positive, below z as
// negative, for every user alike). Plain logic of the Parameters field "centre (z)" - where its default and bounds come from and when the value
// travels in the route (`cz`) - so tests/app/js/centre_field_check.mjs can pin it under node.
//
// The default and the bounds are served (`algorithms.knn|item_knn.constrained_centre` of /api/config/algorithms, derived from the rating scale);
// when they are not, the dataset's scale gives them: the midpoint, steps of half a scale step. No number of a particular scale lives here.

/** @typedef {{ default: number, min: number, max: number, step: number }} CentreSpec */

/** @param {unknown} x @returns {x is number} */
const isNum = (x) => typeof x === "number" && Number.isFinite(x);

/** 6 decimals: (0.5 + 5) / 2 and typed values meet without floating-point residue */
const round = (/** @type {number} */ x) => Math.round(x * 1e6) / 1e6;

/**
 * @param {any} served `constrained_centre` of the config response (or undefined)
 * @param {{ min?: number, max?: number, step?: number } | null | undefined} scale the dataset's rating scale (the fallback)
 * @returns {CentreSpec | null} null when neither source gives a usable field (the field is then not drawn)
 */
export function centreSpec(served, scale) {
  if (
    served &&
    isNum(served.default) &&
    isNum(served.min) &&
    isNum(served.max) &&
    isNum(served.step) &&
    served.step > 0 &&
    served.min <= served.default &&
    served.default <= served.max
  ) {
    return { default: served.default, min: served.min, max: served.max, step: served.step };
  }
  if (scale && isNum(scale.min) && isNum(scale.max) && isNum(scale.step) && scale.step > 0 && scale.min < scale.max) {
    return { default: round((scale.min + scale.max) / 2), min: scale.min, max: scale.max, step: round(scale.step / 2) };
  }
  return null;
}

/**
 * The number the field stands for: what was typed, kept inside the bounds; a blank or non-numeric entry is the default.
 * @param {unknown} raw the text of the field (or a route value)
 * @param {CentreSpec} spec
 * @returns {number}
 */
export function centreValue(raw, spec) {
  const text = String(raw ?? "").trim();
  if (text === "") return spec.default;
  const x = Number(text);
  if (!Number.isFinite(x)) return spec.default;
  return round(Math.min(spec.max, Math.max(spec.min, x)));
}

/**
 * The route value `cz`: only while the constrained Pearson is chosen and the centre is not the default (a plain deep link stays short).
 * @param {boolean} selected the constrained Pearson is the chosen measure
 * @param {unknown} raw the text of the field
 * @param {CentreSpec | null} spec
 * @returns {string | undefined}
 */
export function centreParam(selected, raw, spec) {
  if (!selected || !spec) return undefined;
  const x = centreValue(raw, spec);
  return x === round(spec.default) ? undefined : String(x);
}
