// @ts-check
// WP-18 (DECK_SCHEMA 7.1, D-110): the renderer of the colophon, the page about the deck itself: who wrote it, how it was made (the AI statement the user approved, the models and the roles they
// played, the review), how to cite it, its licence and its version. The data is engine/pages/colophon-model.js (checked by hand); this file only draws it, as text: every value is plain text.
// The page is STILL (state 0 only, no motion), like the contents page: a page to read, not a story. The look is engine/css/pages.css (tokens only).
//
// DOM (stable, documented in engine/README.md; the harness rows q7, q8 and k38 read it):
//   section.savo-slide.savo-colophon[data-slide=colophon][data-kind=colophon][data-layout=colophon]
//     header.savo-head > h1.savo-title[data-part=title]                       the name of the page (the strip's label)
//     div.savo-colo[data-part=blocks]
//       div.savo-colo-block.savo-colo-author[data-part=author]   h2.savo-colo-label, p.savo-colo-name, p.savo-colo-line (institution), p.savo-colo-line[data-part=orcid] > (a|span).savo-colo-link.savo-colo-orcid > img.savo-colo-orcid-icon + span.savo-colo-orcid-id (WP-66), p.savo-colo-line[data-part=mail] > a.savo-colo-link (mailto, D-125)
//       div.savo-colo-block.savo-colo-license[data-part=license] h2.savo-colo-label, p.savo-colo-line > (a|span).savo-colo-link
//       div.savo-colo-block.savo-colo-version[data-part=version] h2.savo-colo-label, p.savo-colo-line (the deck's version, the engine's and the build date)
//       div.savo-colo-block.savo-colo-ai[data-part=ai]           h2.savo-colo-label, p.savo-colo-statement, ul.savo-colo-items > li > b.savo-colo-model + span.savo-colo-dash + span.savo-colo-roles (WP-66: three grid columns), p.savo-colo-review
//       div.savo-colo-block.savo-colo-cite[data-part=cite]       h2.savo-colo-label, p.savo-colo-citation
// A link is an <a href target=_blank rel="noopener noreferrer"> only where it can be used: the student's page (body[data-savo-role=student]); the audience window has no UI (plan 3.3) and the
// console shows the audience's picture, so there it is a span. Only https addresses are linked (D-088), with TWO exceptions that hold in every role: (D-125) the author's e-mail address is a `mailto:` link
// (the page does not leave, so the audience window may have it; no target, no query), `p.savo-colo-line[data-part=mail] > a.savo-colo-link`; an address that is not a plain one (chrome/mailto.js) stays text.
// (WP-97, D-169, the user's w07 review of 2026-11-01) the author's ORCID iD is a link to `https://orcid.org/<iD>` (colophon-model.js orcidHref: computed from the iD, never read from a config address) in the
// student's page, the console and the console's preview frame (`?mode=mirror`, the lecturer's own windows): new tab, no opener, no referrer, no query. The REAL audience window (the projector: no pointer, and a new
// tab would take over the screen) draws the same pair with the same look, underlined, but as a span (`savo-colo-orcid-still`): the user's choice "only the look on the audience". An iD that is not four blocks of four stays text.
import { colophonCheck, colophonModel } from './colophon-model.js';
import { releaseFocusAfterClick } from '../chrome/mailto.js';

// WP-66 (D-147): the ORCID iD icon, the file ORCID's own site serves, kept as it came (engine/vendor/orcid/SOURCE.txt: address, date, sha256, terms). It is an image, never recoloured: its green is ORCID's.
const ORCID_ICON = new URL('../vendor/orcid/orcid-id-icon.svg', import.meta.url).href;

/** @typedef {import('../core/deck.js').Slide} Slide @typedef {import('../core/deck.js').Deck} Deck @typedef {import('../core/placeholder.js').RenderContext} RenderContext @typedef {import('../core/placeholder.js').SlideRenderer} SlideRenderer */

/**
 * Everything wrong with the colophon of this deck in every language, as `slide colophon (<lang>): ...` strings, found at load (core/renderers.js).
 * @param {Deck} deck @param {Slide} slide @returns {string[]}
 */
export function colophonProblems(deck, slide) {
  return deck.langs.flatMap((lang) => colophonCheck(deck, slide, lang).map((p) => `slide colophon (${lang}): ${p}`));
}

/** @param {Slide} slide @param {RenderContext} ctx @returns {SlideRenderer} */
export function createColophon(slide, ctx) {
  const m = colophonModel(ctx.deck, slide, ctx.lang);
  const role = ctx.doc.body?.getAttribute('data-savo-role') ?? null;
  const linked = role === 'student';
  // WP-97 (D-169): the console's preview is the audience page with `?mode=mirror` (core/boot.js); only the page without that is the projector. The same read as boot.js's, from the window the page runs in.
  const mirror = new URLSearchParams(ctx.win?.location?.search ?? '').get('mode') === 'mirror';
  const projector = role === 'audience' && !mirror;
  return {
    mount(host) {
      const doc = ctx.doc;
      /** @param {string} tag @param {string} cls @param {string} [part] @param {{text: string, lang?: string}|string} [say] */
      const make = (tag, cls, part, say) => {
        const el = doc.createElement(tag);
        el.className = cls;
        if (part) el.setAttribute('data-part', part);
        if (say !== undefined) { el.textContent = typeof say === 'string' ? say : say.text; if (typeof say !== 'string' && say.lang) el.setAttribute('lang', say.lang); }
        return el;
      };
      /** A link to an https address in the student's page, a plain span elsewhere (and for a text that has no address). @param {string} text @param {string|null} url */
      const link = (text, url) => {
        const el = make(linked && url ? 'a' : 'span', 'savo-colo-link', undefined, text);
        if (linked && url) { el.setAttribute('href', url); el.setAttribute('target', '_blank'); el.setAttribute('rel', 'noopener noreferrer'); }
        return el;
      };
      /** @param {string} cls @param {string} part @param {{text: string, lang?: string}} label */
      const block = (cls, part, label) => { const b = make('div', `savo-colo-block ${cls}`, part); b.appendChild(make('h2', 'savo-colo-label', undefined, label)); return b; };

      const root = make('section', 'savo-slide savo-colophon');
      root.setAttribute('data-slide', slide.id);
      root.setAttribute('data-kind', slide.kind);
      root.setAttribute('data-layout', 'colophon');
      const head = make('header', 'savo-head');
      const title = make('h1', 'savo-title', 'title', m.title.title);
      if (m.title.lang) title.setAttribute('lang', m.title.lang);
      head.appendChild(title);
      root.appendChild(head);
      const blocks = make('div', 'savo-colo', 'blocks');

      const author = block('savo-colo-author', 'author', m.author.label);
      author.appendChild(make('p', 'savo-colo-name', undefined, m.author.name));
      for (const line of m.author.institution) author.appendChild(make('p', 'savo-colo-line', undefined, line));
      if (m.author.orcid) {
        // WP-66 (D-147): the icon and the iD instead of the word ORCID. ORCID's display guidelines: the icon accompanies every displayed iD, the iD is a link to its https address, the icon's alt is "ORCID iD".
        // In the link the image is decorative (alt empty) and the link's own name tells the iD. WP-97 (D-169, w07 review 2026-11-01): the link is there in every role but the projector, not only the student's page
        // (the lecturer's own windows are where the page is reviewed); the projector draws the pair as a span that looks the same (`savo-colo-orcid-still`: underlined iD); a span with a self-naming image and no
        // underline is only an iD that has no address (`url` null: not four blocks of four).
        // Like the e-mail link, a click of the mouse gives the keyboard back to the page (chrome/mailto.js), or the Space that means "next" would activate the link instead.
        const { id, url, label } = m.author.orcid;
        const p = make('p', 'savo-colo-line', 'orcid');
        const go = url !== null && !projector;
        const still = url !== null && projector;                              // looks like the link, is not one
        const holder = make(go ? 'a' : 'span', `savo-colo-link savo-colo-orcid${still ? ' savo-colo-orcid-still' : ''}`);
        if (go) { holder.setAttribute('href', /** @type {string} */ (url)); holder.setAttribute('target', '_blank'); holder.setAttribute('rel', 'noopener noreferrer'); holder.setAttribute('aria-label', `${label.text} iD: ${id}`); releaseFocusAfterClick(holder); }
        // the image's alt names the iD wherever the pair is not a link (the projector's still pair too: nothing there names the iD but the image and the text)
        const icon = make('img', 'savo-colo-orcid-icon');
        icon.setAttribute('src', ORCID_ICON); icon.setAttribute('alt', go ? '' : `${label.text} iD`); icon.setAttribute('width', '32'); icon.setAttribute('height', '32'); icon.setAttribute('draggable', 'false');
        holder.appendChild(icon);
        holder.appendChild(make('span', 'savo-colo-orcid-id', undefined, id));
        p.appendChild(holder);
        author.appendChild(p);
      }
      if (m.author.mail) {
        const p = make('p', 'savo-colo-line', 'mail');
        if (m.author.mailHref) {
          const a = make('a', 'savo-colo-link', undefined, m.author.mail);
          a.setAttribute('href', m.author.mailHref);                         // D-125: a mailto link in every role; no target (the mail program opens, the page stays), no query
          releaseFocusAfterClick(a);
          p.appendChild(a);
        } else p.textContent = m.author.mail;
        author.appendChild(p);
      }
      blocks.appendChild(author);

      const license = block('savo-colo-license', 'license', m.license.label);
      const lp = make('p', 'savo-colo-line');
      lp.appendChild(link(m.license.name, m.license.url));
      license.appendChild(lp);
      blocks.appendChild(license);

      const version = block('savo-colo-version', 'version', m.version.label);
      for (const line of m.version.lines) version.appendChild(make('p', 'savo-colo-line', undefined, line));
      blocks.appendChild(version);

      const ai = block('savo-colo-ai', 'ai', m.ai.label);
      ai.appendChild(make('p', 'savo-colo-statement', undefined, m.ai.statement));
      if (m.ai.items.length > 0) {
        const list = make('ul', 'savo-colo-items');
        for (const it of m.ai.items) {
          const li = make('li', 'savo-colo-item');
          li.appendChild(make('b', 'savo-colo-model', undefined, it.model));
          const dash = make('span', 'savo-colo-dash', undefined, ' — ');       // WP-66 (D-147): its own grid column, so every dash starts at the same x whatever the model name's width
          dash.setAttribute('aria-hidden', 'true');
          li.appendChild(dash);
          li.appendChild(make('span', 'savo-colo-roles', undefined, it.roles));
          list.appendChild(li);
        }
        ai.appendChild(list);
      }
      if (m.ai.review) ai.appendChild(make('p', 'savo-colo-review', undefined, m.ai.review));
      blocks.appendChild(ai);

      const cite = block('savo-colo-cite', 'cite', m.cite.label);
      cite.appendChild(make('p', 'savo-colo-citation', undefined, m.cite.text));
      blocks.appendChild(cite);

      root.appendChild(blocks);
      host.appendChild(root);
    },
    render(k) { if (!Number.isInteger(k) || k < 0 || k > slide.stepCount) throw new RangeError(`the colophon has no state ${k} (0 ... ${slide.stepCount})`); },
    timeline: () => [],
    duration: () => 0,
  };
}
