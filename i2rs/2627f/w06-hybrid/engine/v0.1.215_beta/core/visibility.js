// @ts-check
// WP-43 (D-096): is anybody looking? A document that is hidden (a minimised audience window, a tab behind another, another virtual desktop) gets no frames: Chrome runs no animation
// of it, so a 500 ms step pressed there did not finish in 212.7 s and the console's lock waited for it (headed row 14b, runs/2610251236-presenter-headed). The Player therefore treats
// "hidden" like reduced motion: a step is drawn at its last frame at once, and the endless ambient loops stop. This module is the whole of what the engine knows about visibility, so it
// can be tested with a fake document; the decisions are the Player's (core/player.js).
// Nothing here waits for a timer: a hidden page throttles timers too, so the way out of a frozen step is the `visibilitychange` event and `Animation.finish()`, never a deadline.

/** Is this document hidden? `prerender` is not `visible` either: nobody sees it. @param {{visibilityState?: string}} doc @returns {boolean} */
export const isHidden = (doc) => doc.visibilityState !== undefined && doc.visibilityState !== 'visible';

/**
 * Call `onChange(hidden)` each time the document's visibility changes (the `visibilitychange` event), with the state it has then.
 * @param {{visibilityState?: string, addEventListener: Function, removeEventListener: Function}} doc @param {(hidden: boolean) => void} onChange @returns {() => void} unsubscribe
 */
export function watchVisibility(doc, onChange) {
  const handler = () => onChange(isHidden(doc));
  doc.addEventListener('visibilitychange', handler);
  return () => doc.removeEventListener('visibilitychange', handler);
}
