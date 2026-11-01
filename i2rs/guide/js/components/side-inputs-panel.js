// @ts-check
// WP-244: the feature page's "Side inputs" tab - the numbers each side input hands the network for the pair on screen, read from `trace.result.side_inputs` (only the groups that are ON are there):
//   * the user's taste profile and the film's content row: how many of the vocabulary's terms are non-zero (673 of 2000; 16 of 2000), the count per field (film) or the terms pushed up / down and the
//     films the profile was built from (user), and the five heaviest terms (the film's TF-IDF weights; the profile's signed weights: + liked, − disliked);
//   * the user's rating statistics and the film's numbers: the raw value and the standardised one the network reads.
// The terms are catalogue terms ("kw: pacific war"), never a person's name. The user's side stands at the left and the film's at the right, as in the diagram; a step that lights one of the
// side-input boxes lights its card (`hl-active`, the same frame the box has). Which tab is open is util/side-tab.js's rule and the page's; this module only draws.

import { sideGroups, signed } from "../util/dnn-features.js";

/**
 * @param {HTMLElement} root the tab's body
 * @param {{i18n: any}} ctx
 */
export function createSideInputsPanel(root, ctx) {
  /** the cards by their group key (`user_profile` ...) @type {Map<string, HTMLElement>} */
  let cards = new Map();
  /** the rows of the network view that are side inputs, by group key (a highlight names a stage by its row) @type {Map<number, string>} */
  let rowKeys = new Map();
  /** @type {string | null} */
  let lastKey = null;

  /** @param {string} tag @param {string} [className] @param {string} [text] */
  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  /** @param {number} value @returns {string} integers as they are, the rest with two decimals */
  const plain = (value) => (Number.isInteger(value) ? String(value) : value.toFixed(2));

  /** A list of the heaviest terms: the term and its weight (the profile's with its sign). @param {{text?: string, term?: string, weight: number}[]} top @param {boolean} withSign */
  function termList(top, withSign) {
    const list = el("ol", "side-terms");
    for (const entry of top) {
      const item = el("li");
      item.append(el("span", "side-term", entry.text ?? entry.term ?? ""), el("span", "side-weight", withSign ? signed(entry.weight) : entry.weight.toFixed(2)));
      list.appendChild(item);
    }
    return list;
  }

  /** @param {{key: string, terms: boolean, data: any}} group @returns {HTMLElement} */
  function card({ key, terms, data }) {
    const { i18n } = ctx;
    const user = key.startsWith("user");
    const node = el("section", `side-card role-${user ? "user" : "item"}`);
    node.dataset.group = key;
    const title = el("h4", "side-title");
    title.appendChild(el("span", "side-name-text", i18n.t(`layer.${key}`)));
    node.appendChild(title);
    if (terms) {
      // the count stands at the right of the title ("673 of 2000"); the whole sentence is its tooltip
      const count = el("span", "side-nz", i18n.t("mf.net_nonzero", { nz: data.nonzero, n: data.size }));
      count.title = i18n.t(user ? "mf.side_count_user" : "mf.side_count_item", { nz: data.nonzero, n: data.size });
      title.appendChild(count);
      if (user) {
        node.appendChild(el("p", "side-sub", i18n.t("mf.side_profile", { pos: data.n_positive, neg: data.n_negative, films: data.n_films })));
      } else {
        const fields = Object.entries(data.fields ?? {}).map(([name, n]) => `${name} ${n}`).join(" · ");
        if (fields) node.appendChild(el("p", "side-sub", i18n.t("mf.side_fields", { fields })));
      }
      const list = termList(data.top ?? [], user);
      list.title = i18n.t(user ? "mf.side_top_user" : "mf.side_top_item"); // what the weights are: the film's TF-IDF weights; the profile's signed ones (+ liked, - disliked)
      node.appendChild(list);
    } else {
      const table = el("table", "side-numbers");
      const head = el("tr");
      head.append(el("th"), el("th", "side-col", i18n.t("mf.side_col_raw")), el("th", "side-col", i18n.t("mf.side_col_z")));
      const thead = el("thead");
      thead.appendChild(head);
      const body = el("tbody");
      for (const row of data) {
        const line = el("tr");
        const label = i18n.t(`mf.side_num_${row.name}`);
        line.append(el("th", "side-name", label.startsWith("mf.") ? row.name : label), el("td", "side-raw", plain(row.raw)), el("td", "side-z", signed(row.z)));
        body.appendChild(line);
      }
      table.append(thead, body);
      node.appendChild(table);
    }
    return node;
  }

  return {
    /** @param {any} trace */
    reset(trace) {
      root.replaceChildren();
      cards = new Map();
      rowKeys = new Map();
      lastKey = null;
      const groups = sideGroups(trace);
      if (!groups.length) {
        root.appendChild(el("p", "formula-idle", ctx.i18n.t("mf.no_side_inputs")));
        return;
      }
      (trace.views?.network?.layers ?? []).forEach((/** @type {{id: string}} */ layer, /** @type {number} */ row) => {
        if (groups.some((g) => g.key === layer.id)) rowKeys.set(row, layer.id);
      });
      const grid = el("div", "side-grid");
      for (const group of groups) {
        const node = card(group);
        cards.set(group.key, node);
        grid.appendChild(node); // the user's cards take the first column, the film's the second (trace.css `.role-user` / `.role-item`)
      }
      root.appendChild(grid);
    },
    /** @param {import("./trace-player.js").Frame} frame */
    apply(frame) {
      if (!cards.size) return;
      const lit = new Set();
      for (const h of frame.highlights) {
        if (h.view !== "network" || (h.style !== "active" && h.style !== "result")) continue;
        for (const row of h.rows || []) if (rowKeys.has(row)) lit.add(rowKeys.get(row));
      }
      const key = [...lit].sort().join(",");
      if (key === lastKey) return;
      lastKey = key;
      for (const [group, node] of cards) node.classList.toggle("hl-active", lit.has(group));
    },
  };
}
