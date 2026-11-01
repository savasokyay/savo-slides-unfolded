// @ts-check
// WP-93 (the user's w07 review of 2026-11-01, pages 8 `trust-system` and 9 `rating-error`): the one small mark-up for the formulas of the widgets, shared by compare-columns (its lines) and table-errors (the MAE and RMSE
// formulas). Before it a formula was plain text on one line: "A+ / (A+ + A−)" mixed the SIGN of a quantity (A plus, A minus: the positive and the negative answers) with the OPERATORS of the formula, "mean = sum of costs /
// successful attacks" ran onto a second line, and a slash had to stand for a fraction. Now a text may hold:
//   frac(NUM|DEN)    a fraction with a horizontal bar: the numerator above, the denominator below; both may hold any mark-up, nested
//   sqrt(BODY)       a radical sign with a bar over its body
//   {A+} {A-} {A−}   a signed quantity as ONE badge: 1 to 3 letters or digits and one of + - −, so the sign belongs to the symbol and the + and − that are operators stay plain; {r}, a badge without a sign, is allowed
//   \x               the character x as it is (\| \( \) \{ \} \\)
// Every other character is plain, Σ ² √ ± × included. A `|` outside a frac( is a plain character (|r − p|); inside a frac( only the first `|` of its own level is the separator, a `|` inside parentheses is plain
// (and `\|` is always plain). A text that does not parse (unbalanced, a frac with no `|`, an odd badge) is shown AS IT IS, as plain text, and `formulaProblem` names it: nothing is guessed.
// PURE parsing (checked by hand in tests/js/formula.test.mjs); the DOM is built with createElement, never innerHTML, so no text can inject mark-up. A text with none of the three constructs is not touched at all
// (a plain line keeps whatever the text pipeline made of it). The look is css/widgets-w07.css (.fm-*); the shape of a badge (a small circle around the symbol, or a raised sign) is that stylesheet's alone.

// WP-93 (the user's w07 review, 2026-11-01: "log2'de 2 altindis gibi olmasi gerekmez mi?"): `_` followed by a run of letters or digits is a SUBSCRIPT: log_2(x) is log with a lowered 2, r_ui is r with "ui" lowered. A literal
// underscore is `\_`; an underscore with no letter or digit after it, inside a text that is parsed, is refused. The subscript is a real element (`<sub class="fm-sub">`, smaller and lowered by the stylesheet), never the
// Unicode characters U+2080 to U+2089 (the vendored font subsets may not carry them).

// WP-93 (D-175, the user chose it on review board 2: "like LaTeX \left( \right)"): a pair of parentheses that ENCLOSES A FRACTION grows to the fraction's height, so log_2(frac(u|k)) is not a tall fraction between two small
// brackets. The parser marks such a pair as two `par` nodes (instead of two characters of the text) and the stylesheet stretches them (`.fm-par`); a pair with no fraction inside stays text, e.g. log_2(1 + position) or (r − p)².
// "Encloses" is a fraction at any depth of groups ((frac(a|b)) in (… (frac(a|b)) …) both grow) and through a radical (sqrt(frac(a|b)) inside the pair); a fraction nested in another fraction's numerator is that fraction's own business.

/** @typedef {{t: 'text', s: string}|{t: 'frac', num: Node[], den: Node[]}|{t: 'sqrt', body: Node[]}|{t: 'badge', base: string, sign: string}|{t: 'sub', s: string}|{t: 'par', s: string}} Node */

const BADGE = /^([A-Za-z][A-Za-z0-9]{0,2})([+\-−]?)$/;
const WORD = /[A-Za-z0-9_]/;

/** Whether a text holds one of the constructs (frac, sqrt, a badge, a subscript): a quick test, a text without them is a plain text and is never parsed. @param {string} src */
export function hasFormulaMarkup(src) {
  return /(?:^|[^A-Za-z0-9_])(?:frac|sqrt)\(|\{[^{}]*\}|(?:^|[^\\])_[A-Za-z0-9]/.test(src);
}

/** Whether the nodes hold a fraction a pair of parentheses around them would have to match in height: a fraction, or a radical whose body holds one. (A group inside is already flattened into the nodes, so a fraction at any depth of groups is found here.) @param {Node[]} nodes @returns {boolean} */
function holdsFraction(nodes) {
  return nodes.some((n) => n.t === 'frac' || (n.t === 'sqrt' && holdsFraction(n.body)));
}

/** @param {Node[]} nodes @returns {Node[]} the same nodes with neighbouring texts joined */
function merge(nodes) {
  /** @type {Node[]} */ const out = [];
  for (const n of nodes) {
    const last = out[out.length - 1];
    if (n.t === 'text' && last && last.t === 'text') last.s += n.s; else out.push(n);
  }
  return out;
}

/**
 * Parse a text.
 * @param {string} src
 * @returns {{ok: true, nodes: Node[]}|{ok: false, error: string, at: number}}
 */
export function parseFormula(src) {
  let i = 0;
  /** @param {string} error @returns {never} */
  const fail = (error) => { throw Object.assign(new Error(error), { at: i }); };
  /**
   * One level: reads until its terminator (not consumed). `ctx`: top (the end), group (`)`), num (`|` or `)`: the latter is an error the caller reports), den and body (`)`).
   * @param {'top'|'group'|'num'|'den'|'body'} ctx @returns {Node[]}
   */
  const seq = (ctx) => {
    /** @type {Node[]} */ const out = [];
    while (i < src.length) {
      const c = src[i];
      if (c === '\\') {
        if (i + 1 >= src.length) fail('a backslash at the end of the text');
        out.push({ t: 'text', s: src[i + 1] }); i += 2;
      } else if ((src.startsWith('frac(', i) || src.startsWith('sqrt(', i)) && (i === 0 || !WORD.test(src[i - 1]))) {
        const kind = src.slice(i, i + 4);
        i += 5;
        if (kind === 'frac') {
          const num = seq('num');
          if (src[i] !== '|') fail('frac( needs a | between the numerator and the denominator');
          i += 1;
          const den = seq('den');
          if (src[i] !== ')') fail('frac( is not closed with )');
          i += 1;
          if (num.length === 0 || den.length === 0) fail('frac( has an empty numerator or denominator');
          out.push({ t: 'frac', num, den });
        } else {
          const body = seq('body');
          if (src[i] !== ')') fail('sqrt( is not closed with )');
          i += 1;
          if (body.length === 0) fail('sqrt( is empty');
          out.push({ t: 'sqrt', body });
        }
      } else if (c === '{') {
        const end = src.indexOf('}', i);
        if (end < 0) fail('a { without a }');
        const m = BADGE.exec(src.slice(i + 1, end));
        if (!m) fail(`{${src.slice(i + 1, end)}} is not a badge: 1 to 3 letters or digits and one of + - −`);
        out.push({ t: 'badge', base: m[1], sign: m[2] === '-' ? '−' : m[2] });
        i = end + 1;
      } else if (c === '(') {
        i += 1;
        const inner = seq('group');
        if (src[i] !== ')') fail('a ( without a )');
        i += 1;
        const grown = holdsFraction(inner);                 // WP-93 (D-175): only a pair that encloses a fraction grows
        out.push({ t: grown ? 'par' : 'text', s: '(' }, ...inner, { t: grown ? 'par' : 'text', s: ')' });
      } else if (c === '_') {
        const m = /^[A-Za-z0-9]+/.exec(src.slice(i + 1));
        if (!m) fail('an underscore needs letters or digits after it (a literal underscore is \\_)');
        out.push({ t: 'sub', s: m[0] }); i += 1 + m[0].length;
      } else if (c === ')') {
        if (ctx === 'top') fail('a ) without a (');
        break;
      } else if (c === '|' && ctx === 'num') {
        break;
      } else {
        out.push({ t: 'text', s: c }); i += 1;
      }
    }
    return merge(out);
  };
  try {
    const nodes = seq('top');
    return { ok: true, nodes };
  } catch (e) {
    return { ok: false, error: /** @type {Error} */ (e).message, at: /** @type {any} */ (e).at ?? i };
  }
}

/**
 * The text as plain characters, for a screen reader and for a message: a fraction is (num)/(den), a radical √(body), a badge the symbol with a raised sign (A⁺, A⁻). Pure.
 * @param {Node[]} nodes @returns {string}
 */
export function formulaPlain(nodes) {
  const SUP = { '+': '⁺', '−': '⁻', '': '' };
  return nodes.map((n) => {
    if (n.t === 'text' || n.t === 'par') return n.s;
    if (n.t === 'frac') return `(${formulaPlain(n.num)})/(${formulaPlain(n.den)})`;
    if (n.t === 'sqrt') return `√(${formulaPlain(n.body)})`;
    if (n.t === 'sub') return `_${n.s}`;
    return `${n.base}${/** @type {Record<string, string>} */ (SUP)[n.sign] ?? n.sign}`;
  }).join('');
}

/**
 * The problem of a text, or null: a text with none of the constructs is never a problem, one that has them must parse. (The load check of a widget names the path.)
 * @param {string} src @returns {string|null}
 */
export function formulaProblem(src) {
  if (!hasFormulaMarkup(src)) return null;
  const r = parseFormula(src);
  return r.ok ? null : `${r.error} (at character ${r.at + 1} of "${src}")`;
}

/** @param {Document} doc @param {string} s */
const textNode = (doc, s) => (typeof doc.createTextNode === 'function' ? doc.createTextNode(s) : Object.assign(doc.createElement('span'), { textContent: s }));
/** @param {Document} doc @param {string} cls @param {string} [text] */
const span = (doc, cls, text) => { const e = doc.createElement('span'); e.className = cls; if (text !== undefined) e.textContent = text; return e; };

/** The radical sign: a stroke that stretches to the height of its body and meets the bar over it. @param {Document} doc */
function radical(doc) {
  const sv = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
  sv.setAttribute('class', 'fm-rad'); sv.setAttribute('viewBox', '0 0 14 24'); sv.setAttribute('preserveAspectRatio', 'none'); sv.setAttribute('aria-hidden', 'true'); sv.setAttribute('focusable', 'false');
  const p = doc.createElementNS('http://www.w3.org/2000/svg', 'path');
  p.setAttribute('d', 'M1 14L4.5 11.5L8 22L13 1.5');
  sv.append(p);
  return sv;
}

/**
 * Put nodes into an element (createElement and text nodes only).
 * @param {Document} doc @param {HTMLElement} el @param {Node[]} nodes
 */
export function appendNodes(doc, el, nodes) {
  for (const n of nodes) {
    if (n.t === 'text') el.append(textNode(doc, n.s));
    else if (n.t === 'par') el.append(span(doc, 'fm-par', n.s));       // a parenthesis grown to the height of the fraction it encloses (WP-93, D-175): its own element, stretched by the stylesheet
    else if (n.t === 'frac') {
      const f = span(doc, 'fm-frac'), num = span(doc, 'fm-num'), den = span(doc, 'fm-den');
      appendNodes(doc, num, n.num); appendNodes(doc, den, n.den);
      f.append(num, den);
      el.append(f);
    } else if (n.t === 'sqrt') {
      const r = span(doc, 'fm-sqrt'), body = span(doc, 'fm-body');
      appendNodes(doc, body, n.body);
      r.append(radical(doc), body);
      el.append(r);
    } else if (n.t === 'sub') {
      const e = doc.createElement('sub'); e.className = 'fm-sub'; e.textContent = n.s;      // a real subscript element (WP-93); the stylesheet lowers and shrinks it without touching the line height
      el.append(e);
    } else {
      const b = span(doc, 'fm-badge'), sym = span(doc, 'fm-sym', n.base);
      b.append(sym);
      if (n.sign) { b.setAttribute('data-sign', n.sign); b.append(span(doc, 'fm-sign', n.sign)); }
      el.append(b);
    }
  }
}

/**
 * Draw a text into an element: a text with the mark-up becomes its nodes, a text without it stays as the caller set it; a text that does not parse is left as plain text. Returns what happened.
 * @param {Document} doc @param {HTMLElement} el the element already holds the text (what `say` put there) @param {string} [src] the text, default `el.textContent`
 * @returns {'plain'|'drawn'|'broken'}
 */
export function renderFormula(doc, el, src = el.textContent ?? '') {
  if (!hasFormulaMarkup(src)) return 'plain';
  const r = parseFormula(src);
  if (!r.ok) { el.textContent = src; return 'broken'; }
  el.textContent = '';
  el.setAttribute('data-formula', 'true');
  appendNodes(doc, el, r.nodes);
  return 'drawn';
}
