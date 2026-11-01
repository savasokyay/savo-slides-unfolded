// @ts-check
// WP-109 (6) + WP-110 (a): what the three mean-convention chips of the Parameters panel show for the pair on the page and the measure chosen.
//
// WP-109 (6) - `dynamic` (the active user's mean without the target's rating) and `static` (with it) are the same number when the active
// user has NOT rated the target: there is no rating to leave out. The panel then keeps both chips enabled, draws the one that is not selected
// like the selected one with a dashed edge (`equivalent`) and gives both the "identical here" tip. When the user HAS rated the target the chips
// are the two different things they say, and the static tip names the leak. `corated_only` is a different mean in every case.
//
// WP-110 (a) - the mean convention reaches the user-based prediction for EVERY measure (the baseline ū_a), but the SIMILARITY only for the
// measures that centre on a user mean (`uses_centre` of /api/config/similarities). So on the user-based page a measure without a centre
// disables only the `corated_only` chip (there it is the same number as dynamic) and, when it was the chosen one, the choice falls back to
// dynamic; on the item-based page the chips are inert (all three faded) unless the measure centres AND is not the user-centred adjusted cosine,
// whose centre is always each user's own mean (the item-based prediction uses no user mean).
// Pure, so tests/app/js/mean_chips_check.mjs can pin the rules under node.

/** @typedef {"dynamic" | "static" | "corated_only"} MeanConvention */

/**
 * @param {{ selected: string, targetRated: boolean | null | undefined, usesCentre?: boolean | null }} state `targetRated` is `null` while the
 *   pair's trace is not known yet (the chips then read as they do for a rated target: nothing is claimed that has not been seen);
 *   `usesCentre` is the measure's flag (a missing flag claims nothing: the chip stays enabled)
 * @returns {Record<MeanConvention, { equivalent: boolean, tipKey: string, disabled: boolean }>} `tipKey` is a `param_tip.<key>` i18n key
 */
export function meanChipStates({ selected, targetRated, usesCentre = true }) {
  const same = targetRated === false;
  const noCentre = usesCentre === false;
  return {
    dynamic: { equivalent: same && selected === "static", tipKey: same ? "mc_identical" : "mc_dynamic", disabled: false },
    static: { equivalent: same && selected === "dynamic", tipKey: same ? "mc_identical" : "mc_static", disabled: false },
    corated_only: { equivalent: false, tipKey: noCentre ? "mc_no_centre" : "mc_corated_only", disabled: noCentre },
  };
}

/**
 * The choice that stands for the measure: the foil is not offered where it is the same number as dynamic.
 * @param {{ selected: string, usesCentre?: boolean | null }} state
 * @returns {string}
 */
export function meanSelection({ selected, usesCentre = true }) {
  return selected === "corated_only" && usesCentre === false ? "dynamic" : selected;
}

/**
 * Item-based pages: are the three chips inert (faded)? The convention matters only for a measure that centres on a mean AND is not the
 * user-centred adjusted cosine (that one always uses each user's own mean, the active user's without the target).
 * @param {{ usesCentre?: boolean | null, similarity: string, centering: string }} state `centering` is the config value (`user_mean` | `item_mean`)
 * @returns {boolean}
 */
export function icfMeanChipsInert({ usesCentre = true, similarity, centering }) {
  return usesCentre === false || (similarity === "adjusted_cosine" && centering === "user_mean");
}
