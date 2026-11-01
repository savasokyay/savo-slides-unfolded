// @ts-check
// WP-20: where a slide may draw. A content slide lives on the 1920 x 1080 stage between the top strip and the footer band, both of which engine/chrome draws
// (engine/css/chrome.css). `ctx.area` hands this box to layouts and widgets, so a widget sizes its drawing to the room it has and never reaches under the chrome.
// The numbers are stage pixels and come from chrome.css (design-brief section 2); tests/js/content-area.test.mjs parses chrome.css and fails when the two disagree.
//   top    the strip ends at y 138: `.savo-topbar` top 26 + height 112 (its 1 px rule is the last pixel of that box)
//   bottom the footer band begins at y 1007: `.savo-foot` bottom 14 + height 64 puts its box at y 1002, and its rule (`.savo-foot-rule`) lies 5 px below that (D-072)
//   sides  60 px, the strip's and the footer's own margins (`left: 60px; right: 60px`)
import { STAGE } from '../chrome/layout.js';

/** The room between the strip and the footer band, in stage pixels. @type {Readonly<{x: number, y: number, width: number, height: number}>} */
export const CONTENT_AREA = Object.freeze({ x: 60, y: 138, width: STAGE.width - 2 * 60, height: 1007 - 138 });
