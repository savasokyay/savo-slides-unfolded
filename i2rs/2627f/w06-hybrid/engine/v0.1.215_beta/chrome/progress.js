// @ts-check
// WP-12b / D-069: the progress block, drawn from layout.js. B style: a ring per section (R 14), a 12 x 5 pill per slide below it, a tick in a
// finished section, NO line under the current section. Colours are not set here: every item carries `data-state` (done | cur | todo) and
// engine/css/chrome.css paints it with the tokens --done, --cur and --todo. The svg has an accessible name (role="img").
// WP-60 (D-143, the user's note of 2026-10-27): on the student's page (body[data-savo-role=student], as the contents page decides, engine/pages/toc.js)
// and when the model names the slide of every pill (progress.targets), each pill is a link to its slide (`#/<slide>/0`, the address the router reads),
// with the slide's number and title as its name and tooltip; the rings stay pictures. A link's hit area is the pill's column (its pitch) from under
// the rings to the bottom of the block, wider than the 12 x 5 pill. The svg is then a named group, so the links inside it are reachable. The audience
// window has no link (zero UI, plan 3.3).
import { progressLayout, PROGRESS } from './layout.js';
import { assertModel } from './model.js';
import { createT } from './strings.js';
import { s, num } from './dom.js';

/**
 * @param {Document} doc
 * @param {import('./model.js').ChromeModel} model  progress.variant must not be `none` (the footer decides that)
 * @returns {SVGElement}
 */
export function buildProgress(doc, model) {
  assertModel(model);
  const { sections, section, slide, variant } = model.progress;
  if (variant === 'none') throw new Error('chrome: buildProgress called for variant "none"');
  const layout = progressLayout(sections, { section, slide }, variant);
  const t = createT(model.lang);
  const total = sections.reduce((a, b) => a + b, 0);
  const index = sections.slice(0, section).reduce((a, b) => a + b, 0) + slide + 1;
  const label = variant === 'ring'
    ? t('progress.flat', { slide: index, slides: total })
    : t('progress.label', { section: section + 1, sections: sections.length, slide: slide + 1, slides: sections[section] });
  const { targets, titles } = model.progress;
  const linked = layout.variant === 'constellation' && Array.isArray(targets) && Array.isArray(titles)
    && /** @type {any} */ (doc).body?.getAttribute?.('data-savo-role') === 'student';
  const svg = s(doc, 'svg', {
    class: 'savo-prog', 'data-variant': layout.variant, width: num(layout.width), height: num(layout.height),
    viewBox: `0 0 ${num(layout.width)} ${num(layout.height)}`, role: linked ? 'group' : 'img', 'aria-label': label,
  });
  const before = sections.map((_, i) => sections.slice(0, i).reduce((a, b) => a + b, 0));   // pills before each section: the flat number of a pill
  const hitTop = PROGRESS.ringCy + PROGRESS.ringR + PROGRESS.ringStroke / 2;
  for (const it of layout.items) {
    if (linked && it.kind === 'pill' && targets && titles) {
      const name = t('progress.goto', { slide: before[it.section] + it.slide + 1, slides: total, title: titles[it.section][it.slide] });
      const a = s(doc, 'a', { class: 'savo-pill-link', href: `#/${targets[it.section][it.slide]}/0`, 'aria-label': name });
      const tip = s(doc, 'title', {});
      tip.textContent = name;
      a.appendChild(tip);
      a.appendChild(s(doc, 'rect', { class: 'savo-pill-hit', x: num(it.x - PROGRESS.pillGap / 2), y: num(hitTop), width: num(it.w + PROGRESS.pillGap), height: num(PROGRESS.height - hitTop) }));
      a.appendChild(s(doc, 'rect', {
        class: 'savo-pill', 'data-state': it.state, x: num(it.x), y: num(it.y), width: num(it.w), height: num(it.h), rx: num(it.rx),
        'stroke-width': it.state === 'todo' ? num(PROGRESS.pillOutline) : undefined,
      }));
      svg.appendChild(a);
      continue;
    }
    if (it.kind === 'ring') {
      svg.appendChild(s(doc, 'circle', { class: 'savo-ring', 'data-state': it.state, cx: num(it.cx), cy: num(it.cy), r: num(it.r), 'stroke-width': it.stroke ? num(it.stroke) : undefined }));
    } else if (it.kind === 'dot') {
      svg.appendChild(s(doc, 'circle', { class: 'savo-dot', cx: num(it.cx), cy: num(it.cy), r: num(it.r) }));
    } else if (it.kind === 'tick') {
      svg.appendChild(s(doc, 'path', { class: 'savo-tick', d: it.d, 'stroke-width': num(PROGRESS.tickStroke) }));
    } else {
      svg.appendChild(s(doc, 'rect', {
        class: 'savo-pill', 'data-state': it.state, x: num(it.x), y: num(it.y), width: num(it.w), height: num(it.h), rx: num(it.rx),
        'stroke-width': it.state === 'todo' ? num(PROGRESS.pillOutline) : undefined,
      }));
    }
  }
  return svg;
}
