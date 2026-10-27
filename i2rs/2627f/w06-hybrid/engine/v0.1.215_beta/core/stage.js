// @ts-check
// WP-12c: the stage. Every slide is drawn on a 1920 x 1080 box (chrome.css `.savo-stage`, design-brief section 2) and the box is scaled to the window:
// `--stage-scale` and the box's `left`/`top` are the only things this module writes, in a `resize` handler (no timer, no frame loop: D-039).
// The box is centred and fits the window both ways, so a window that is not 16:9 shows bars:
//   student    the wrapper is `.savo-student` (controls.css): its ground is `var(--surround)` (D-075, #14161C in both themes)
//   audience   the wrapper has no colour of its own: the page's `html` ground is the surround, and the build writes `html{background:#000}` into the audience page
//              before any stylesheet (config chrome.audience_ground; plan section 12, 2026-10-22 20:14), so a projector shows black bars and never flashes white.
//              The preview in the console is the same page and has the same bars.
// The wrapper is `position: fixed; inset: 0; overflow: hidden`, so the page never scrolls whatever the window size.
import { STAGE } from '../chrome/layout.js';

/**
 * How the stage fits an area: the largest scale that keeps the whole stage inside, and the offset that centres it. `left` and `top` are whole pixels (a half
 * pixel would blur the text at scale 1); `scale` has six decimals.
 * @param {{width: number, height: number}} area the room for the stage (the wrapper's size)
 * @param {{width: number, height: number}} [size] the stage (1920 x 1080)
 * @returns {{scale: number, left: number, top: number}}
 */
export function fitStage(area, size = STAGE) {
  const w = Math.max(0, area.width), h = Math.max(0, area.height);
  const scale = Math.min(w / size.width, h / size.height);
  return { scale: Number(scale.toFixed(6)), left: Math.round((w - size.width * scale) / 2) + 0, top: Math.round((h - size.height * scale) / 2) + 0 };   // + 0: Math.round of a tiny negative is -0
}

/**
 * Put the page's stage (`#savo-stage`, created when the page has none) into its wrapper and keep it fitted to the window.
 * @param {Document} doc @param {'student'|'audience'} kind which surround: the student page's, or the audience window's and the preview's
 * @returns {{wrap: HTMLElement, stage: HTMLElement, fit: () => {scale: number, left: number, top: number}, destroy: () => void}}
 */
export function mountStage(doc, kind) {
  const win = /** @type {Window} */ (doc.defaultView);
  let stage = doc.getElementById('savo-stage');
  const given = stage !== null;
  if (!stage) { stage = doc.createElement('main'); stage.id = 'savo-stage'; }
  stage.classList.add('savo-stage');
  const wrap = doc.createElement('div');
  wrap.setAttribute('data-savo-surround', kind);
  if (kind === 'student') wrap.className = 'savo-student';
  else wrap.style.cssText = 'position:fixed;inset:0;margin:0;overflow:hidden';
  if (given && stage.parentNode) stage.parentNode.replaceChild(wrap, stage); else doc.body.appendChild(wrap);
  wrap.appendChild(stage);
  const host = stage;
  const fit = () => {
    const f = fitStage({ width: wrap.clientWidth || win.innerWidth, height: wrap.clientHeight || win.innerHeight });
    host.style.setProperty('--stage-scale', String(f.scale));
    host.style.left = `${f.left}px`;
    host.style.top = `${f.top}px`;
    return f;
  };
  fit();
  win.addEventListener('resize', fit);
  return { wrap, stage: host, fit, destroy() { win.removeEventListener('resize', fit); } };
}
