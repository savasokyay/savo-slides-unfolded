// @ts-check
// WP-15 (D-106): the renderer of the contents page. The page comes right after the cover and is mandatory; it lists the sections of the deck, each with its number, its title and the page
// number of the slide it opens, and in the student's page every row is a link to that slide (`#/<slide-id>/0`, the address the router reads). The AI badge (one line, only when the
// deck declares AI use) stands under the rows. The data is engine/pages/toc-model.js (checked by hand); this file only draws it.
// The page is STILL: no state but 0, no motion (the plain cover's reasons: it is a page to look something up in, not a story). The look is engine/css/pages.css (tokens only).
//
// DOM (stable, documented in engine/README.md; the harness rows q5 and k37 read it):
//   section.savo-slide.savo-toc[data-slide=toc][data-kind=toc][data-layout=toc]
//     header.savo-head > h1.savo-title[data-part=title]                       the name of the page (the strip's label)
//     ol.savo-toc-rows[data-part=rows]  (font-size inline: rowSizePx(rows))
//       li.savo-toc-row[data-section=<id>] > (a|span).savo-toc-link[data-part=link][href=#/<slide>/0 in the student's page]
//         span.savo-toc-num[data-part=number]   only when the section has a number
//         span.savo-toc-title[data-part=section-title]   the section's title (a text fragment)
//         span.savo-toc-lead[aria-hidden]       the dotted leader
//         span.savo-toc-page[data-part=page]
//     p.savo-toc-badge[data-part=badge]        only with an AI badge
// An <a> only where it can be used: the student's page (body[data-savo-role=student]). The audience window has no UI (plan 3.3) and the console shows it as the audience's picture.
import { tocModel } from './toc-model.js';

/** @typedef {import('../core/deck.js').Slide} Slide @typedef {import('../core/deck.js').Deck} Deck @typedef {import('../core/placeholder.js').RenderContext} RenderContext @typedef {import('../core/placeholder.js').SlideRenderer} SlideRenderer */

/**
 * Everything wrong with the contents page of this deck in every language, as `slide toc (<lang>): ...` strings, found at load (core/renderers.js).
 * @param {Deck} deck @param {Slide} slide @returns {string[]}
 */
export function tocProblems(deck, slide) {
  /** @type {string[]} */ const out = [];
  if (!deck.sections.some((s) => s.slides.length > 0)) out.push('slide toc: no section has a slide, there is nothing to list');
  const badge = slide.entry?.badge ?? null;
  for (const lang of deck.langs) {
    try {
      const m = tocModel(deck, slide, lang);
      if (badge !== null && m.badge === null) out.push(`slide toc (${lang}): the badge has no text in ${lang} and none in the default language ${deck.defaultLang}`);
    } catch (e) { out.push(`slide toc (${lang}): ${/** @type {any} */ (e).detail ?? /** @type {Error} */ (e).message}`); }
  }
  return out;
}

/** @param {Slide} slide @param {RenderContext} ctx @returns {SlideRenderer} */
export function createToc(slide, ctx) {
  const model = tocModel(ctx.deck, slide, ctx.lang);
  const linked = ctx.doc.body?.getAttribute('data-savo-role') === 'student';
  return {
    mount(host) {
      const doc = ctx.doc;
      /** @param {string} tag @param {string} cls @param {string} [part] @param {string} [content] */
      const make = (tag, cls, part, content) => {
        const el = doc.createElement(tag);
        el.className = cls;
        if (part) el.setAttribute('data-part', part);
        if (content !== undefined) el.textContent = content;
        return el;
      };
      const root = make('section', 'savo-slide savo-toc');
      root.setAttribute('data-slide', slide.id);
      root.setAttribute('data-kind', slide.kind);
      root.setAttribute('data-layout', 'toc');
      const head = make('header', 'savo-head');
      const title = make('h1', 'savo-title', 'title', model.title.title);
      if (model.title.lang) title.setAttribute('lang', model.title.lang);
      head.appendChild(title);
      root.appendChild(head);
      const list = make('ol', 'savo-toc-rows', 'rows');
      list.style.fontSize = `${model.sizePx}px`;
      for (const r of model.rows) {
        const li = make('li', 'savo-toc-row');
        li.setAttribute('data-section', r.id);
        const link = make(linked ? 'a' : 'span', 'savo-toc-link', 'link');
        if (linked) link.setAttribute('href', `#/${r.slideId}/0`);
        if (r.number !== null) link.appendChild(make('span', 'savo-toc-num', 'number', r.number));
        const name = make('span', 'savo-toc-title', 'section-title');
        ctx.setText(name, r.title);
        link.appendChild(name);
        const lead = make('span', 'savo-toc-lead');
        lead.setAttribute('aria-hidden', 'true');
        link.appendChild(lead);
        link.appendChild(make('span', 'savo-toc-page', 'page', String(r.page)));
        li.appendChild(link);
        list.appendChild(li);
      }
      root.appendChild(list);
      if (model.badge) {
        const badge = make('p', 'savo-toc-badge', 'badge', model.badge.text);
        if (model.badge.lang) badge.setAttribute('lang', model.badge.lang);
        root.appendChild(badge);
      }
      host.appendChild(root);
    },
    render(k) { if (!Number.isInteger(k) || k < 0 || k > slide.stepCount) throw new RangeError(`the contents page has no state ${k} (0 ... ${slide.stepCount})`); },
    timeline: () => [],
    duration: () => 0,
  };
}
