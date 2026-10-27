// @ts-check
// WP-115 (10): the "Keep negative similarities" box and its route parameter `keepneg`.
//
// The box's default is the PAGE's (config/algorithms.yaml: the user-based page keeps negative weights, `keep_negative: true`; the item-based page does not,
// `false`, because its plain weighted average has no centring: a negative weight there subtracts whole ratings). The route says so only when the box differs from
// that default - and it must say it in BOTH directions: `keepneg=0` on the user-based page, `keepneg=1` on the item-based one. It used to send `0` only, so on the
// item-based page (default false) ticking the box and pressing Apply sent nothing and the engine used its own default: the box did nothing.
// Pure, so tests/app/js/keep_negative_check.mjs can pin the rule under node.

/**
 * @param {string | undefined} route the route's `keepneg` ("1" / "true" / "0" ...), undefined when absent
 * @param {boolean | undefined} pageDefault the page's `keep_negative` from /api/config/algorithms (undefined: the user-based default, true)
 * @returns {boolean} whether the box is ticked
 */
export function keepNegativeChecked(route, pageDefault) {
  return route !== undefined ? route === "1" || route === "true" : pageDefault !== false;
}

/**
 * @param {boolean} checked the box
 * @param {boolean | undefined} pageDefault the page's `keep_negative` (undefined: true)
 * @returns {"1" | "0" | undefined} the route value: undefined when the box is what the page does anyway (a plain link stays short)
 */
export function keepNegativeParam(checked, pageDefault) {
  return checked === (pageDefault !== false) ? undefined : checked ? "1" : "0";
}
