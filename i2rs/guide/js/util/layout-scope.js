// @ts-check
// WP-115 (13): the reader's layout choices of the uCF and the iCF page are ONE set.
//
// The Formula | Code divider, the flowchart / candidate-table divider and the text size of the four panels (Formula, Code, Flowchart, Candidates) were kept per page
// (`i2rs.split.fc.ucf`, `i2rs.zoom.formula.icf`, ...). The two pages have the same layout (layout F): the instructor arranged the uCF page, opened the iCF page and
// found it arranged differently. Both pages now keep their choices under one scope, "cf" (`i2rs.split.fc.cf`, `i2rs.zoom.formula.cf`, ...): a change on one page is in force
// on the other. The content-based (WP-176: layout F too), MF and DNN pages keep their own keys.
//
// Migration, once: the choices a reader already made on the uCF page (else the iCF page) become the shared ones. The old keys are only READ, never removed or changed. It is
// ONCE because the double click on a divider resets by removing the shared key: if the migration looked at an empty shared key every time, the reset would bring the old
// value back at the next load. A marker key says it has run.
// Pure (the storage is passed in), so tests/app/js/layout_scope_check.mjs can pin the rules under node.

import { zoomKey } from "./zoom-steps.js";

/** the pages that share one layout, and the scope their choices are kept under */
export const SHARED_ENGINES = ["ucf", "icf"];
export const SHARED_SCOPE = "cf";
/** the two dividers and the four zoomed panels of layout F */
export const SPLIT_KINDS = ["fc", "flow"];
export const ZOOM_PANELS = ["formula", "code", "flow", "table"];
/** written once the migration has run (any value) */
export const MIGRATION_MARK = "i2rs.layout.migrated.cf";

/**
 * @param {string} engine "ucf" | "icf" | "cb" | "mf" | "dnn"
 * @returns {string} the scope the page keeps its layout choices under
 */
export function layoutScope(engine) {
  return SHARED_ENGINES.includes(engine) ? SHARED_SCOPE : engine;
}

/**
 * The localStorage key of a divider on a page.
 * @param {string} kind "fc" (Formula | Code) | "flow" (the flowchart over the candidate table)
 * @param {string} engine
 * @returns {string}
 */
export function splitKey(kind, engine) {
  return `i2rs.split.${kind}.${layoutScope(engine)}`;
}

/** @returns {{ shared: string, legacy: string[] }[]} every shared key with the old per-page keys it takes over from, the uCF page's first */
export function sharedLayoutKeys() {
  return [
    ...SPLIT_KINDS.map((kind) => ({ shared: splitKey(kind, "ucf"), legacy: SHARED_ENGINES.map((engine) => `i2rs.split.${kind}.${engine}`) })),
    ...ZOOM_PANELS.map((panel) => ({ shared: zoomKey(panel, SHARED_SCOPE), legacy: SHARED_ENGINES.map((engine) => zoomKey(panel, engine)) })),
  ];
}

/**
 * Makes the choices already made on the uCF page (else the iCF page) the shared ones - once. A shared key that has a value is not touched; the old keys are not
 * removed. Never throws: a storage that cannot be read or written (a private window, blocked site data, a full quota) leaves things as they were.
 * @param {{ getItem: (key: string) => string | null, setItem: (key: string, value: string) => void } | null | undefined} storage
 * @returns {string[]} the shared keys that were filled from an old one
 */
export function migrateLayout(storage) {
  /** @type {string[]} */
  const copied = [];
  if (!storage) return copied;
  try {
    if (storage.getItem(MIGRATION_MARK) !== null) return copied;
    for (const { shared, legacy } of sharedLayoutKeys()) {
      if (storage.getItem(shared) !== null) continue;
      for (const old of legacy) {
        const value = storage.getItem(old);
        if (value === null) continue;
        storage.setItem(shared, value);
        copied.push(shared);
        break;
      }
    }
    storage.setItem(MIGRATION_MARK, "1");
  } catch {
    /* the shared keys then fill as the reader makes choices */
  }
  return copied;
}
