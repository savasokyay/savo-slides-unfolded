// @ts-check
// WP-107 (f): a small Python tokenizer for the Code panel - keywords, constants, strings, comments, numbers, the name a `def` / `class`
// introduces, decorators - so the real source of the explain function reads like it does in an editor. No vendored library (the lab
// runs offline and the snippets are plain Python of this repository): one pass over the text, no grammar. It is a highlighter, not a
// parser: unusual syntax may be coloured imperfectly, but NO CHARACTER IS EVER LOST OR CHANGED (the tokens' texts joined are the input),
// and a broken string or comment cannot swallow the rest of the file (a single-quoted string ends at its line; only a triple-quoted
// one runs on, to its closing quotes or the end of the text).
//
// Usage:   const lines = tokenizeLines(sourceLines);   // Token[][], one array per line
//          lines[i].forEach(({type, text}) => ...);     // type "" = no colour

/** @typedef {{type: "" | "kw" | "const" | "str" | "com" | "num" | "fn" | "dec", text: string}} Token */

const KEYWORDS = new Set([
  "and", "as", "assert", "async", "await", "break", "class", "continue", "def", "del", "elif", "else", "except", "finally",
  "for", "from", "global", "if", "import", "in", "is", "lambda", "nonlocal", "not", "or", "pass", "raise", "return", "try",
  "while", "with", "yield",
]); // fmt: skip
const CONSTANTS = new Set(["True", "False", "None"]);
/** the letters that may sit in front of a quote (case-insensitive): raw, bytes, formatted, unicode and their pairs */
const STRING_PREFIXES = new Set(["r", "u", "b", "f", "br", "rb", "fr", "rf"]);

const IDENT = /[\p{L}_][\p{L}\p{N}_]*/uy;
const NUMBER = /(?:0[xX][0-9a-fA-F_]+|0[bB][01_]+|0[oO][0-7_]+|(?:\d[\d_]*\.?[\d_]*|\.\d[\d_]*)(?:[eE][+-]?\d[\d_]*)?[jJ]?)/y;
const DECORATOR = /@[\p{L}\p{N}_.]*/uy;

/**
 * The end (exclusive) of the string literal whose opening quote is at `start`.
 * @param {string} s
 * @param {number} start index of the first quote character
 * @returns {number}
 */
function stringEnd(s, start) {
  const q = s[start];
  const triple = s.startsWith(q + q + q, start);
  let p = start + (triple ? 3 : 1);
  while (p < s.length) {
    const c = s[p];
    if (c === "\\") {
      p += 2; // an escaped character (also an escaped quote or newline)
    } else if (triple) {
      if (s.startsWith(q + q + q, p)) return p + 3;
      p += 1;
    } else if (c === q) {
      return p + 1;
    } else if (c === "\n") {
      return p; // an unterminated single-quoted string ends with its line
    } else {
      p += 1;
    }
  }
  return s.length;
}

/**
 * @param {string} text
 * @returns {Token[]} the text cut into runs; runs of type "" are everything that gets no colour; the texts joined are `text`
 */
export function tokenizePython(text) {
  /** @type {Token[]} */
  const out = [];
  let plain = "";
  const flush = () => {
    if (plain) out.push({ type: "", text: plain });
    plain = "";
  };
  /** @param {Token["type"]} type @param {string} t */
  const push = (type, t) => {
    flush();
    out.push({ type, text: t });
  };
  let i = 0;
  let afterDef = false; // the next name is the one a `def` / `class` introduces
  let lineStart = true; // nothing but blanks since the line began (an `@` there is a decorator)
  let depth = 0; // open brackets: a line that begins inside them continues an expression (`@` there multiplies matrices)
  while (i < text.length) {
    const c = text[i];
    if (c === "\n") {
      plain += c;
      i += 1;
      lineStart = true;
      afterDef = false;
      continue;
    }
    if (c === " " || c === "\t" || c === "\r") {
      plain += c;
      i += 1;
      continue;
    }
    const wasLineStart = lineStart;
    lineStart = false;
    if (c === "#") {
      const nl = text.indexOf("\n", i);
      const end = nl < 0 ? text.length : nl;
      push("com", text.slice(i, end));
      i = end;
      afterDef = false;
      continue;
    }
    if (c === '"' || c === "'") {
      const end = stringEnd(text, i);
      push("str", text.slice(i, end));
      i = end;
      afterDef = false;
      continue;
    }
    if (c === "@" && wasLineStart && depth === 0) {
      DECORATOR.lastIndex = i;
      const m = DECORATOR.exec(text);
      const t = m ? m[0] : "@";
      push("dec", t);
      i += t.length;
      continue;
    }
    if (/[\p{L}_]/u.test(c)) {
      IDENT.lastIndex = i;
      const id = /** @type {RegExpExecArray} */ (IDENT.exec(text))[0];
      const next = text[i + id.length];
      if ((next === '"' || next === "'") && STRING_PREFIXES.has(id.toLowerCase())) {
        const end = stringEnd(text, i + id.length); // the prefix belongs to the string
        push("str", text.slice(i, end));
        i = end;
        afterDef = false;
        continue;
      }
      if (afterDef) {
        push("fn", id);
        afterDef = false;
      } else if (KEYWORDS.has(id)) {
        push("kw", id);
        afterDef = id === "def" || id === "class";
      } else if (CONSTANTS.has(id)) {
        push("const", id);
      } else {
        plain += id;
      }
      i += id.length;
      continue;
    }
    if (/\d/.test(c) || (c === "." && /\d/.test(text[i + 1] ?? ""))) {
      NUMBER.lastIndex = i;
      const m = NUMBER.exec(text);
      if (m && m[0]) {
        push("num", m[0]);
        i += m[0].length;
        afterDef = false;
        continue;
      }
    }
    plain += c; // an operator or punctuation
    if (c === "(" || c === "[" || c === "{") depth += 1;
    else if (c === ")" || c === "]" || c === "}") depth = Math.max(0, depth - 1);
    i += 1;
    afterDef = false;
  }
  flush();
  return out;
}

/**
 * The tokens of a whole source, cut per line: a token that spans lines (a docstring) is split so that every line carries its own
 * part, in the same type.
 * @param {string[]} lines the source lines (without their newlines)
 * @returns {Token[][]} exactly one array per input line
 */
export function tokenizeLines(lines) {
  /** @type {Token[][]} */
  const result = [[]];
  for (const token of tokenizePython(lines.join("\n"))) {
    const parts = token.text.split("\n");
    parts.forEach((part, k) => {
      if (k > 0) result.push([]);
      if (part) result[result.length - 1].push({ type: token.type, text: part });
    });
  }
  return result;
}
