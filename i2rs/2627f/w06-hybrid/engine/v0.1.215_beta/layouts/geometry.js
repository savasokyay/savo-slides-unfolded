// @ts-check
// WP-20: where the parts of a content layout stand on the 1920 x 1080 stage (stage pixels). One source for the layouts' CSS (engine/css/content.css, held to these
// numbers by tests/js/layout-geometry.test.mjs) and for the widgets (`ctx.size`: a widget reads its room, it never hard-codes it).
//
// ONE LEFT AXIS (lead and ui-agent finding, 2026-10-25: the caption band stood at x 120 and the title at x 150, so the slide had two left edges). Everything a reader
// follows down the slide stands on x 150 and ends on x 1770, 150 from each side: the title block and the hook (prototypes/directions .tblock: left 150, right 150), the
// text lines (.body: left 150), the widget slot and its caption band. Why 150 and not another edge:
//   - the chrome's own margin is 60 (the strip's and the footer's `left: 60px; right: 60px`, design-brief section 2): it belongs to the strip, the emblem and the
//     footer, which frame the page; the content sits inside that frame with 90 px of air, as the prototype's title block and body do;
//   - 150 is the value the prototype's content slide was approved with (D-059), so the text slides and the widget slides share their axis with no new number;
//   - the right edge mirrors the left (1920 - 150 = 1770): a slot centred on the stage, so the widget and the chrome around it stay symmetric.
// A slot of 1620 is 60 px narrower than the 1680 the first prototypes assumed (x 120); the widgets read `ctx.size`, so only their own composition moves.
//
//   head      title and hook: left 150, top 186; the title is 70 px / 1.06, the hook 36 px / 1.25, so a one-line title and a hook end at y 319
//   slot      the room of a widget in `widget-stage`: 1620 x 600 at (150, 330); the head is above it, the caption band below it
//   caption   the band under the slot: the short text of the current step, one line of 30 px (design-brief section 3, "small body"), y 940 to 996: it ends above the footer's rule (1007)
// The content area these sit in is core/area.js (strip and footer band bound it); the slot and the band together end at y 996.

/** The left edge (and, mirrored, the right) of the head, of the text lines, of the widget slot and of the caption band. */
export const TEXT_INSET = 150;
/** The room of a widget, in stage pixels. */
export const WIDGET_SLOT = Object.freeze({ x: TEXT_INSET, y: 330, width: 1920 - 2 * TEXT_INSET, height: 600 });
/** The caption band under the slot, in stage pixels. */
export const CAPTION_BAND = Object.freeze({ x: TEXT_INSET, y: 940, width: 1920 - 2 * TEXT_INSET, height: 56 });
/** Where the title block starts. */
export const HEAD_TOP = 186;
/** Where the first text line of `text-steps` starts (prototype `.body`): the same y on every slide, so the eye finds the body in one place. */
export const STEPS_TOP = 404;
