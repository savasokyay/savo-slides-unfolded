// @ts-check
// WP-54 (D-125): the author's e-mail address as a link, on the colophon and on the closing page. D-088 says a slide links only to https addresses; the author's own address is the ONE exception, and
// it is `mailto:<address>` and nothing else: no query (so no subject, body or tracking parameter), no fragment, no second recipient. A mailto link does not take the page away (the mail program
// opens), so it is clickable in the student's page and in the presenter's windows alike. The address is checked against a plain pattern before it becomes a link: one that does not match stays text,
// as before, instead of becoming a link that says more than the author wrote.

/** The local part (letters, digits and . _ + -), one @, a domain of dot-separated labels (letters, digits, hyphen) that ends in a top-level label of letters. No %, ?, &, #, comma, quote or space. */
const ADDRESS = /^[A-Za-z0-9._+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;

/**
 * @param {unknown} address the address as the deck says it
 * @returns {string|null} `mailto:<address>`, or null when the text is not a plain address (it is then shown as text)
 */
export function mailtoHref(address) {
  return typeof address === 'string' && ADDRESS.test(address) ? `mailto:${address}` : null;
}

/**
 * After a click of the MOUSE the link gives the keyboard focus back to the page. A link that keeps the focus makes the key mapping (core/input.js) ignore Space, because Space and Enter on a focused link
 * are the link's own keys, and Space is the key a lecturer presses for "next": the first press after a click on the address would do nothing. The click itself is not touched: the mail program opens as for
 * any link. A click that comes from the keyboard (Enter on a focused link, `detail` 0) keeps its focus: someone who tabbed to the link is moving by keyboard and must not lose their place.
 * @param {HTMLElement} link
 */
export function releaseFocusAfterClick(link) {
  link.addEventListener('click', (/** @type {MouseEvent} */ e) => { if (e.detail > 0) link.blur(); });
}
