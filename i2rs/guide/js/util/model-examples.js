// @ts-check
// WP-121: pure helpers of the Model-based CF overview page (pages/model-page.js), section 2 - the lecture's two worked factorization examples
// (config/model_examples.yaml, served by /api/config/model_examples as they are): checking the data's shape, the product U x Vt, the residual
// R - U x Vt and the cells where the two differ. The server does not compute the product; the page does, from the printed numbers, so the
// tables cannot disagree with the matrices they show. Checked under node from hand-derived cases and against the REAL data
// (tests/app/js/model_examples_check.mjs, tests/app/test_model_page.py). In these matrices 0 is a value, not "missing" (see `zeroIsValue`).

/**
 * @typedef {{
 *   id: string, titleKey: string, users: string[], userGroups: string[], items: string[], concepts: string[],
 *   zeroIsValue: boolean, R: number[][], U: number[][], Vt: number[][], residualShownInDeck: boolean,
 * }} Example
 */

/**
 * @param {unknown} value
 * @returns {value is number[][]} a non-empty matrix of finite numbers with equal row lengths
 */
function isMatrix(value) {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((row) => Array.isArray(row) && row.length === value[0].length && row.length > 0 && row.every(Number.isFinite))
  );
}

/**
 * @param {unknown} value
 * @returns {value is string[]}
 */
function isLabels(value) {
  return Array.isArray(value) && value.length > 0 && value.every((x) => typeof x === "string" && x.length > 0);
}

/**
 * The examples of `/api/config/model_examples`, in file order, each checked: R is m x n, U is m x k, Vt is k x n, and the user, item and
 * concept labels have those lengths. A malformed example throws an Error that names it (the page shows the message instead of a wrong table).
 * @param {any} data `{examples: {<id>: {...}}}`
 * @returns {Example[]}
 */
export function normalizeExamples(data) {
  const entries = data && typeof data.examples === "object" && data.examples ? Object.entries(data.examples) : [];
  if (!entries.length) throw new Error("no worked examples in the data");
  return entries.map(([id, raw]) => {
    const e = /** @type {any} */ (raw);
    const fail = (/** @type {string} */ why) => new Error(`example ${id}: ${why}`);
    if (typeof e?.title_key !== "string") throw fail("title_key is missing");
    for (const name of ["R", "U", "Vt"]) if (!isMatrix(e[name])) throw fail(`${name} is not a matrix of numbers`);
    for (const name of ["users", "user_groups", "items", "concepts"]) if (!isLabels(e[name])) throw fail(`${name} is not a list of labels`);
    const m = e.R.length;
    const n = e.R[0].length;
    const k = e.U[0].length;
    if (e.U.length !== m) throw fail(`U has ${e.U.length} rows, R has ${m}`);
    if (e.Vt.length !== k) throw fail(`Vt has ${e.Vt.length} rows, U has ${k} columns`);
    if (e.Vt[0].length !== n) throw fail(`Vt has ${e.Vt[0].length} columns, R has ${n}`);
    if (e.users.length !== m || e.user_groups.length !== m) throw fail(`${m} users expected`);
    if (e.items.length !== n) throw fail(`${n} items expected`);
    if (e.concepts.length !== k) throw fail(`${k} concepts expected`);
    return {
      id,
      titleKey: e.title_key,
      users: e.users,
      userGroups: e.user_groups,
      items: e.items,
      concepts: e.concepts,
      zeroIsValue: e.scale?.zero_is_value === true,
      R: e.R,
      U: e.U,
      Vt: e.Vt,
      residualShownInDeck: e.residual_shown_in_deck === true,
    };
  });
}

/**
 * The matrix product A x B (A is m x k, B is k x n).
 * @param {number[][]} a
 * @param {number[][]} b
 * @returns {number[][]}
 */
export function matmul(a, b) {
  if (!a.length || a[0].length !== b.length) throw new Error("matmul: the inner dimensions differ");
  return a.map((row) => b[0].map((_, j) => row.reduce((sum, x, t) => sum + x * b[t][j], 0)));
}

/**
 * The difference A - B of two matrices of one shape.
 * @param {number[][]} a
 * @param {number[][]} b
 * @returns {number[][]}
 */
export function subtract(a, b) {
  if (a.length !== b.length || a[0].length !== b[0].length) throw new Error("subtract: the shapes differ");
  return a.map((row, i) => row.map((x, j) => x - b[i][j]));
}

/**
 * Everything the page draws besides R, U and Vt: the product, the residual R - U x Vt and the cells where R differs from the product
 * (zero-based `row`, `col`; `delta` is the residual there).
 * @param {Example} example
 * @returns {{product: number[][], residual: number[][], diffs: {row: number, col: number, delta: number}[]}}
 */
export function decompose(example) {
  const product = matmul(example.U, example.Vt);
  const residual = subtract(example.R, product);
  /** @type {{row: number, col: number, delta: number}[]} */
  const diffs = [];
  residual.forEach((row, i) => row.forEach((delta, j) => {
    if (delta !== 0) diffs.push({ row: i, col: j, delta });
  }));
  return { product, residual, diffs };
}

/**
 * A number as the tables print it: an integer as it is, a fraction to two decimals without trailing zeros, a minus sign as U+2212.
 * @param {number} x
 * @returns {string}
 */
export function formatValue(x) {
  const text = Number.isInteger(x) ? String(x) : String(Number(x.toFixed(2)));
  return text.replace("-", "−");
}
