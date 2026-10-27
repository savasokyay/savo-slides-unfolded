// @ts-check
// WP-09: language handling and fragment insertion for the DOM.
//
// Language (CLAUDE.md invariant): `text-transform` is language-aware: under lang="tr" the English word "machine" in an
// uppercase element becomes "MACHİNE" (measured in the prototype). So the engine keeps <html lang> equal to the language on
// screen, and any text that is NOT in that language carries its own lang attribute.
//
// Fragments: setFragment() is the ONE place where a text fragment enters the DOM. It inserts the (already validated) fragment,
// labels its language and then fills every math placeholder with the KaTeX html of deck.math. That html is trusted build
// output and deliberately does not pass the text gate (deck.js checkFragment).
// The element helpers touch only innerHTML / setAttribute / removeAttribute / querySelectorAll, so node --test drives them with fakes.

/**
 * The text of an i18n value in `lang`, else in the deck's default language; `lang` of the result says which one it is.
 * @param {Record<string, string>|null|undefined} value @param {string} lang @param {string} defaultLang
 * @returns {{text: string, lang: string}}
 */
export function pickText(value, lang, defaultLang) {
  if (!value) return { text: '', lang };
  if (typeof value[lang] === 'string') return { text: value[lang], lang };
  return { text: value[defaultLang] ?? '', lang: defaultLang };
}

/**
 * Label an element: it gets a `lang` attribute exactly when its text is not in the document language; otherwise the
 * attribute is removed so the element inherits.
 * @param {{setAttribute: (n: string, v: string) => void, removeAttribute: (n: string) => void}} el @param {string} textLang @param {string} docLang
 */
export function labelLang(el, textLang, docLang) {
  if (textLang !== docLang) el.setAttribute('lang', textLang); else el.removeAttribute('lang');
}

/**
 * Pour the rendered KaTeX into every `[data-math]` placeholder below `el`. A placeholder without an entry is a contract
 * breach (deck.js already refused such a deck): it throws instead of leaving a hole in a formula.
 * @param {any} el @param {Record<string, {html: string, display?: boolean}>|undefined|null} math @returns {number} how many were filled
 */
export function fillMath(el, math) {
  if (typeof el.querySelectorAll !== 'function') return 0;
  let n = 0;
  for (const span of el.querySelectorAll('[data-math]')) {
    const id = span.getAttribute('data-math');
    const m = math && id ? math[id] : undefined;
    if (!m || typeof m.html !== 'string') throw new Error(`math placeholder "${id}" has no entry in deck.math`);
    span.innerHTML = m.html;                              // trusted build output (KaTeX), not authored text
    if (m.display) span.setAttribute('data-display', 'true');
    n++;
  }
  return n;
}

/**
 * Put an i18n fragment (already validated by deck.js) into an element, label its language and fill its math.
 * `lang` is the language to show, `docLang` the language of the document (what <html lang> says), `math` is `deck.math`.
 * @param {any} el
 * @param {Record<string, string>|null|undefined} value
 * @param {{lang: string, docLang: string, defaultLang: string, math?: Record<string, {html: string, display?: boolean}>}} o
 * @returns {string} the language the text is actually in
 */
export function setFragment(el, value, { lang, docLang, defaultLang, math }) {
  const p = pickText(value, lang, defaultLang);
  el.innerHTML = p.text;
  labelLang(el, p.lang, docLang);
  fillMath(el, math);
  return p.lang;
}
