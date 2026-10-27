// @ts-check
// WP-32: the real source of the explain function (embedded in the trace as SourceSnippet) with
// true file line numbers; the step's marker line is highlighted and scrolled into view. Because
// snippets travel inside the trace, a static export shows exactly the code that ran.

import { tokenizeLines } from "../util/py-highlight.js"; // WP-107
import { keepInView } from "../util/scroll-within.js"; // WP-107

/**
 * @param {HTMLElement} root
 * @param {{i18n: any, highlight?: boolean}} ctx `highlight` (WP-107): colour the Python (keywords, strings, comments, numbers) -
 *   the uCF / iCF pages; every other page keeps the plain text
 */
export function createCodePanel(root, ctx) {
  /** @type {Record<string, any>} */
  let sources = {};
  /** @type {string | null} */
  let shownSource = null;
  /** @type {HTMLElement[]} */
  let lineEls = [];

  /** @param {any} src */
  function show(src) {
    root.innerHTML = "";
    const head = document.createElement("div");
    head.className = "code-head";
    const name = document.createElement("span");
    name.className = "code-qualname";
    name.textContent = src.qualname;
    const file = document.createElement("span");
    file.className = "code-file";
    file.textContent = `${src.file}:${src.first_line}`;
    head.append(name, file);
    root.appendChild(head);

    const pre = document.createElement("div");
    pre.className = "code-panel";
    lineEls = [];
    const markerLines = new Map(Object.entries(src.markers || {}).map(([m, l]) => [Number(l), m]));
    const lines = String(src.text).replace(/\n$/, "").split("\n");
    // the `# @step:` markers are not part of the code that is shown: cut them first, so that they are neither drawn nor coloured
    const shown = lines.map((t) => t.replace(/\s*#\s*@step:[A-Za-z0-9_.\-]+/g, ""));
    const colored = ctx.highlight === true ? tokenizeLines(shown) : null;
    lines.forEach((_text, i) => {
      const line = document.createElement("div");
      line.className = "line";
      const marker = markerLines.get(i + 1);
      if (marker) {
        line.classList.add("has-marker");
        line.title = marker;
      }
      const ln = document.createElement("span");
      ln.className = "ln";
      ln.textContent = String(src.first_line + i);
      const code = document.createElement("span");
      code.className = "src";
      if (colored) {
        // one span per coloured token, plain runs as text nodes: the line's text is exactly what it was without colour
        for (const token of colored[i]) {
          if (!token.type) {
            code.appendChild(document.createTextNode(token.text));
          } else {
            const span = document.createElement("span");
            span.className = `tok-${token.type}`;
            span.textContent = token.text;
            code.appendChild(span);
          }
        }
      } else {
        code.textContent = shown[i];
      }
      line.append(ln, code);
      pre.appendChild(line);
      lineEls.push(line);
    });
    root.appendChild(pre);
    shownSource = src.source_id;
  }

  function idle() {
    root.innerHTML = "";
    const p = document.createElement("p");
    p.className = "formula-idle";
    p.textContent = ctx.i18n.t("player.no_code");
    root.appendChild(p);
    shownSource = null;
    lineEls = [];
  }

  return {
    /** @param {any} trace */
    reset(trace) {
      sources = trace.sources || {};
      idle();
    },
    /** @param {import("./trace-player.js").Frame} frame */
    apply(frame) {
      const ref = frame.step.code;
      if (!ref || !sources[ref.source_id]) {
        idle();
        return;
      }
      if (shownSource !== ref.source_id) show(sources[ref.source_id]);
      for (const el of lineEls) el.classList.remove("hl");
      const target = lineEls[ref.line - 1];
      if (target) {
        target.classList.add("hl");
        if (ref.line_end) {
          for (let l = ref.line; l <= ref.line_end && lineEls[l - 1]; l += 1) lineEls[l - 1].classList.add("hl");
        }
        // WP-107 (e2): the uCF / iCF pages scroll the panel itself - `scrollIntoView` also scrolled the PAGE (measured: main-content moved
        // 349 px at step 2), and stepping never scrolls the page; the other pages keep the call they had
        if (ctx.highlight === true) {
          // two nested scrollers, either may be the one that clips: the listing (capped height) and the panel body around it
          const listing = root.querySelector(".code-panel");
          if (listing instanceof HTMLElement) keepInView(listing, target);
          keepInView(root, target);
        }
        else target.scrollIntoView({ block: "nearest" });
      }
    },
  };
}
