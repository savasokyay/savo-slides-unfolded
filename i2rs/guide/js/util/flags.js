// @ts-check
// WP-91: the data-quality flag pill (`unreleased` / `no_metadata` / `tv`) in one place - the pair
// explorer (pair-films.js) and the iCF candidate table (data-table.js `setFlags`) draw the same amber
// pill with the same tooltip. The text carries the meaning, the tint only supports it.

/**
 * @param {(key: string, params?: Record<string, unknown>) => string} t translate function
 * @param {string} flag one of `unreleased`, `no_metadata`, `tv`
 * @returns {HTMLElement}
 */
export function flagPill(t, flag) {
  const pill = document.createElement("span");
  pill.className = `pill tag-flag flag-${flag}`;
  pill.textContent = t(`pairfilms.flag.${flag}`);
  pill.title = t(`pairfilms.flag_tip.${flag}`);
  return pill;
}
