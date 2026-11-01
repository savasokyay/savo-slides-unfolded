// @ts-check
// WP-96 / WP-99: the name of a user or a film as a link. The ADDRESS always comes from the server and the
// client never builds one:
//   * a user's `profile_url` (Letterboxd profile) is filled only while that user's real handle is displayed
//     (ui.show_handles, WP-93) - never derived from a pseudonym;
//   * a film's `film_url` (Letterboxd page, TMDB without a Letterboxd id) is filled in every mode - films are
//     public data (WP-99).
// No address = plain text, exactly what the page drew before. Only an http(s) address ever reaches an `href`.
//
// Usage:   cell.appendChild(entityLabel(row, { className: "cohort-label", t }));  // row = {label | title, profile_url?, film_url?}
//          p.replaceChildren(linkedText(t, "step.ucf.corated", params, step.param_links)); // names inside a sentence

import { fillClampedTitle } from "./title-clamp.js"; // WP-135

/**
 * @param {unknown} url
 * @returns {url is string} true for an http(s) address (what a link may point to)
 */
export function isLinkUrl(url) {
  return typeof url === "string" && /^https?:\/\//i.test(url);
}

/** WP-96 name of {@link isLinkUrl}. */
export const isProfileUrl = isLinkUrl;

/**
 * The host of an address without `www.`, for a tooltip ("boxd.it", "themoviedb.org").
 * @param {string} url
 */
function siteOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/**
 * A user's or a film's name: a link when the reference carries an address, otherwise a plain span with the
 * same classes and a tooltip that repeats the text. The link opens in a new tab and does not bubble its
 * click, so a row it sits in (a table row that selects a user) keeps its own click behaviour. A reference
 * with a `profile_url` is a user (class `user-link`), one with a `film_url` a film (class `film-link`).
 * @param {{label?: string, title?: string, profile_url?: string | null, film_url?: string | null}} ref
 * @param {{
 *   className?: string,
 *   text?: string,
 *   title?: string,
 *   clamp?: boolean,
 *   t?: (key: string, params?: Record<string, unknown>) => string,
 * }} [opts] `className` is put on the element (the host's truncation / alignment class); `text` overrides
 *   the shown text (default `ref.label`, else `ref.title`); `title` overrides the plain tooltip (a film's
 *   "title · year"); `clamp` (WP-135) writes the text as a film title that clamps its NAME and keeps its "(Year)"
 *   (util/title-clamp.js `fillClampedTitle`); `t` gives the link's tooltip its text
 * @returns {HTMLElement}
 */
export function entityLabel(ref, opts = {}) {
  const text = opts.text ?? ref.label ?? ref.title ?? "";
  const profile = isLinkUrl(ref.profile_url) ? ref.profile_url : null;
  const film = profile === null && isLinkUrl(ref.film_url) ? ref.film_url : null;
  const url = profile ?? film;
  const node = document.createElement(url ? "a" : "span");
  const kind = profile ? "user-link" : film ? "film-link" : "";
  node.className = [kind, opts.className ?? ""].filter(Boolean).join(" ");
  if (opts.clamp) fillClampedTitle(node, text); // WP-135
  else node.textContent = text;
  const plain = opts.title ?? text;
  if (url) {
    const anchor = /** @type {HTMLAnchorElement} */ (node);
    anchor.href = url;
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
    const tip = opts.t ? (profile ? opts.t("shell.profile_link") : opts.t("shell.film_link", { site: siteOf(url) })) : "";
    anchor.title = tip ? `${plain} — ${tip}` : plain;
    anchor.addEventListener("click", (event) => event.stopPropagation());
  } else {
    node.title = plain;
  }
  return node;
}

/** WP-96 name of {@link entityLabel} (a user reference: `{label, profile_url}`). */
export const userLabel = entityLabel;

/**
 * WP-105: the tooltip text of a film's name - the title, and its year when the title does not already say it. The film titles of
 * the store are written "Your Name. (2016)", so appending the year again printed "Your Name. (2016) · 2016".
 * @param {string} title
 * @param {number | null | undefined} year
 * @returns {string}
 */
export function filmTipText(title, year) {
  if (year === null || year === undefined) return title;
  return title.includes(`(${year})`) ? title : `${title} · ${year}`;
}

/**
 * A translated sentence whose names are links: `links` maps a param name (`user`, `a`) to the address of the
 * entity that param names; params without an address stay plain text. Without any address the result is one
 * text node - the same words as `t(key, params)`.
 * @param {(key: string, params?: Record<string, unknown>) => string} t
 * @param {string} key
 * @param {Record<string, unknown>} params
 * @param {Record<string, string | {profile_url?: string | null, film_url?: string | null} | null | undefined> | null | undefined} links
 *   a param name -> its address as a string (of the kind `field` says) or as a reference
 *   `{profile_url}` / `{film_url}` - the latter lets one sentence link a user AND a film (the trace title)
 * @param {"profile_url" | "film_url"} [field] what a plain-string address is: users' profiles (default) or films
 * @param {Record<string, "user" | "item"> | null} [roles] WP-106: a param name -> the role of the entity it names; such a
 *   name is drawn in its own element with the class `role-user` / `role-item` (the app's role colours) whether or not it is
 *   a link, so a sentence can show users and items in their colours
 * @param {{ clamp?: boolean }} [opts] WP-135: `clamp` writes each name as a title that clamps its name and keeps its "(Year)" (a heading that
 *   has to fit one line: the words around the name stay whole, the name gives way)
 * @returns {Node}
 */
export function linkedText(t, key, params, links, field = "profile_url", roles = null, opts = {}) {
  /** @param {string} name @returns {{profile_url?: string | null, film_url?: string | null} | null} */
  const refOf = (name) => {
    const value = links?.[name];
    if (typeof value === "string") return isLinkUrl(value) ? { [field]: value } : null;
    return value && (isLinkUrl(value.profile_url) || isLinkUrl(value.film_url)) ? value : null;
  };
  const names = [...new Set([...Object.keys(links ?? {}), ...Object.keys(roles ?? {})])].filter(
    (name) => refOf(name) !== null || (roles?.[name] !== undefined && name in params)
  );
  if (!names.length) return document.createTextNode(t(key, params));
  // translate with a marker in place of each linked param, then cut the sentence at the markers:
  // the word order of the translation (EN / TR) stays the translator's
  const marked = { ...params };
  for (const name of names) marked[name] = `\u0001${name}\u0002`;
  const text = t(key, marked);
  const out = document.createDocumentFragment();
  let from = 0;
  for (const match of text.matchAll(/\u0001(\w+)\u0002/g)) {
    const at = match.index ?? 0;
    if (at > from) out.appendChild(document.createTextNode(text.slice(from, at)));
    const name = match[1];
    const role = roles?.[name];
    out.appendChild(entityLabel({ label: String(params[name]), ...refOf(name) }, { t, className: role ? `role-${role}` : undefined, clamp: opts.clamp }));
    from = at + match[0].length;
  }
  if (from < text.length) out.appendChild(document.createTextNode(text.slice(from)));
  return out;
}
