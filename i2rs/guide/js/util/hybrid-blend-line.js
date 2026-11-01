// @ts-check
// WP-235: the line at the head of the Blend tab - the blend of the target film with its own numbers in it: `r̂ = β₀ + Σ α·p = −0.368 + 0.392·4.668 + 0.112·4.106 + ... = 4.049`. The terms are the rows of the
// `contributions` table (the base's weight α and what it says p; the intercept row `intercept` holds β₀ in its `contribution`); the sum is what they add up to (the blend before any clipping). Pure,
// so tests/app/js/hybrid_blend_line_check.mjs can pin it under node.

/** the id of the table row that holds the intercept (engines/hybrid/explain_weighted.py `INTERCEPT_ID`) */
const INTERCEPT_ID = "intercept";

/** the minus sign of the app's signed figures (util/heat-centred.js) */
const MINUS = "−";

/**
 * @param {Record<string, any>[] | null | undefined} rows `trace.tables.contributions.rows`
 * @param {number} [decimals] the places of every figure
 * @returns {{level: boolean, terms: string, sum: number} | null} `level`: the blend has an intercept (free weights have none); null when the table holds no base with a weight and an answer
 */
export function blendLine(rows, decimals = 3) {
  const bases = (rows ?? []).filter((r) => r.id !== INTERCEPT_ID);
  const intercept = (rows ?? []).find((r) => r.id === INTERCEPT_ID);
  if (!bases.length || bases.some((r) => !Number.isFinite(r.alpha) || !Number.isFinite(r.p))) return null;
  /** @type {{sign: number, text: string}[]} */
  const terms = [];
  if (intercept && Number.isFinite(intercept.contribution)) terms.push({ sign: Math.sign(intercept.contribution) || 1, text: Math.abs(intercept.contribution).toFixed(decimals) });
  for (const r of bases) terms.push({ sign: Math.sign(r.alpha) || 1, text: `${Math.abs(r.alpha).toFixed(decimals)}·${Number(r.p).toFixed(decimals)}` });
  // the first term carries its own sign, every later one is written after a "+" or a "-": "-0.368 + 0.392·4.668 - 0.012·4.0"
  const text = terms.map((t, i) => (i === 0 ? `${t.sign < 0 ? MINUS : ""}${t.text}` : ` ${t.sign < 0 ? MINUS : "+"} ${t.text}`)).join("");
  const sum = bases.reduce((s, r) => s + r.alpha * r.p, 0) + (intercept && Number.isFinite(intercept.contribution) ? intercept.contribution : 0);
  return { level: Boolean(intercept), terms: text, sum };
}
