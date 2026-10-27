// @ts-check
// WP-41: "all similarities for this pair" - the legacy lecture's 13 equations side by side for
// one (active user, neighbour) pair, from GET /api/datasets/{ds}/pair-similarities. Foils and
// the item-centring fault carry their tag so students see that the numbers differ AND why.
// WP-42: `kind: "item"` compares the target item with one candidate item (`other` is then an item
// index); the user-centred adjusted cosine (course) and the item-centred fault sit side by side.
// WP-91: for a user pair (uCF) the film sets of the two users - rated by both, only A, only B, with
// data-quality flags (pair-films.js). The chosen neighbour lives in the route
// as `nb` (a dense index): `update({neighbour})` takes it from the URL, `ctx.onNeighbour(index)` hands
// a choice made in the dropdown back to the page (null = the URL named a neighbour that is not a
// candidate of this trace, so the page drops it).
// WP-105: the film sets no longer sit under this table: the page shows them in its sub-matrix panel's second tab (WP-115 1: this table is the third), and
// `ctx.onPair({dataset, a, b})` tells it which pair is shown (a, b = the two users, or the two items for kind "item");
// `onPair(null)` = no pair (no candidates). This block is itself a tab of that panel: the table is asked for only while the
// tab is the one on screen (`setActive`), the pair is reported to the page at once.
// WP-114: the rows read by family (util/pair-rows.js: Pearson, its library twin, constrained, median, the two cosines, adjusted cosine, Jaccard,
// the distances, the rank foils); the co-rated count is no column any more - it stands once beside the neighbour selector ("Neighbour: <name>
// · 12 co-rated films"); the value column sits right next to the measure's name; an (i) (`ctx.infoTip`, given by the page) says what the table is,
// what a foil is and why the cosine and Jaccard do not rest on that count.
// WP-110 (b''): the page's centre z (`cz` of the route) goes into the request as `cz` - only the constrained Pearson's row changes with it; absent =
// the scale midpoint (the request then carries no `cz` at all). The route that serves this table takes no `cs`: its two cosine rows always come together.

import { fmt } from "../util/format.js";
import { orderPairRows, pairCoratedCount } from "../util/pair-rows.js"; // WP-114

/**
 * @typedef {{dataset: string, user: number, item: number | null, mc: string, cz?: number, candidates: {index: number, label: string}[], neighbour?: number | null}} PairState
 */

/**
 * @param {HTMLElement} root
 * @param {{
 *   i18n: any, api: any, kind?: "user" | "item",
 *   onNeighbour?: (index: number | null) => void,
 *   onPair?: (pair: {dataset: string, a: number, b: number} | null) => void,
 *   active?: boolean,
 *   infoTip?: (text: string, label?: string, heading?: string) => HTMLElement,
 * }} ctx `active: false` holds the table back until `setActive(true)` (default: asked for at once); `infoTip` (WP-114) builds the (i) beside the count -
 *   injected, not imported, so the component still runs against the tiny fake DOM of its test
 */
export function createPairSimilarities(root, ctx) {
  const { i18n, api } = ctx;
  const kind = ctx.kind || "user";
  /** @type {PairState | null} */
  let state = null;
  /** @type {number | null} */
  let other = null;
  // WP-97: the newest `load()` owns the table - a neighbour picked quickly twice, or a trace reloaded, must
  // not let the older pair's answer (arriving last) overwrite the pair that is selected.
  let loadSeq = 0;
  // WP-105: the table of a pair is asked for once, and only while this block is on screen (its tab is open)
  let active = ctx.active !== false;
  let pending = false; // a pair was chosen while the block was not on screen: asked for when it is

  root.innerHTML = "";
  const head = document.createElement("div");
  head.className = "pairsim-head";
  const label = document.createElement("span");
  label.textContent = `${i18n.t(kind === "item" ? "pairsim.other_item" : "pairsim.neighbour")}: `;
  const select = document.createElement("select");
  // WP-114: the co-rated count of the shown pair, once, beside the selector (empty until the table has answered) and the (i)
  const count = document.createElement("span");
  count.className = "pairsim-count num";
  head.append(label, select, count);
  if (ctx.infoTip) {
    const info = ctx.infoTip(
      [i18n.t(kind === "item" ? "pairsim.hint_item" : "pairsim.hint"), i18n.t("pairsim.foil_note"), i18n.t("pairsim.support_note")].join(" "),
      i18n.t("pairsim.info_label"),
      i18n.t(kind === "item" ? "pairsim.title_item" : "pairsim.title")
    );
    info.title = "";
    head.append(info);
  }
  const body = document.createElement("div");
  body.className = "table-wrap";
  root.append(head, body);

  select.addEventListener("change", () => {
    other = Number(select.value);
    if (ctx.onNeighbour) ctx.onNeighbour(other); // WP-91: the choice goes into the URL (`nb`)
    load();
  });

  /** WP-105: tell the page which pair this block shows (null: none) - at once, whether or not the table is asked for */
  function report() {
    if (!ctx.onPair) return;
    // WP-91: the two ends of the pair - users (uCF: active user, neighbour) or items (iCF: target, candidate)
    ctx.onPair(
      !state || other === null
        ? null
        : { dataset: state.dataset, a: kind === "item" ? (state.item ?? 0) : state.user, b: other }
    );
  }

  async function load() {
    report();
    if (!state || other === null) return;
    if (!active) {
      pending = true;
      loadSeq += 1; // an answer still in flight is for a pair nobody looks at any more
      body.innerHTML = "";
      return;
    }
    pending = false;
    const mine = ++loadSeq;
    body.innerHTML = "";
    count.textContent = ""; // the old pair's count must not stand beside the new pair
    try {
      const data = await api.pairSimilarities(state.dataset, {
        user: state.user,
        other,
        item: state.item ?? undefined,
        mc: state.mc,
        kind,
        ...(state.cz !== undefined ? { cz: state.cz } : {}), // WP-110 (b'')
      });
      if (mine !== loadSeq) return; // WP-97: a newer pair was asked for meanwhile
      render(data);
    } catch (err) {
      if (mine !== loadSeq) return; // WP-97
      const p = document.createElement("p");
      p.className = "warn-banner";
      p.textContent =
        err && typeof err === "object" && "messageKey" in err
          ? i18n.t(/** @type {any} */ (err).messageKey, /** @type {any} */ (err).params)
          : String(err);
      body.appendChild(p);
    }
  }

  /** @param {any} data */
  function render(data) {
    const table = document.createElement("table");
    table.className = "data-table";
    const thead = document.createElement("thead");
    const tr = document.createElement("tr");
    for (const [text, cls] of [
      [i18n.t("pairsim.measure"), ""],
      [i18n.t("pairsim.value"), "num"],
    ]) {
      const th = document.createElement("th");
      th.textContent = text;
      th.className = cls;
      tr.appendChild(th);
    }
    thead.appendChild(tr);
    const tbody = document.createElement("tbody");
    // WP-114: the co-rated count once, beside the selector (users: films, items: raters; one has its own singular)
    const n = pairCoratedCount(data.rows);
    count.textContent =
      n === null ? "" : `· ${i18n.t(kind === "item" ? (n === 1 ? "pairsim.count_raters_one" : "pairsim.count_raters") : n === 1 ? "pairsim.count_films_one" : "pairsim.count_films", { n })}`;
    for (const row of orderPairRows(data.rows)) {
      const trEl = document.createElement("tr");
      const name = document.createElement("td");
      // WP-114: in THIS table the course's Pearson and the library's stand side by side and the cosine has two rows, so three rows are named by what
      // they compute (`pairsim.label.<name>`); every other row (and a measure the server adds) keeps the catalogue's name, else the raw name
      const named = i18n.t(`pairsim.label.${row.name}`);
      const text = named !== `pairsim.label.${row.name}` ? named : i18n.t(row.label_key);
      name.textContent = text !== row.label_key ? text : String(row.name);
      for (const tag of row.tags) {
        if (tag === "core") continue;
        const pill = document.createElement("span");
        pill.className = `pill tag-${tag}`;
        pill.textContent = i18n.t(`tag.${tag}`);
        name.appendChild(pill);
      }
      const value = document.createElement("td");
      value.className = "num";
      value.textContent = row.value === null ? "—" : fmt(row.value);
      trEl.append(name, value);
      tbody.appendChild(trEl);
    }
    table.append(thead, tbody);
    body.appendChild(table);
  }

  return {
    /**
     * @param {PairState} next
     */
    update(next) {
      state = next;
      select.innerHTML = "";
      for (const c of next.candidates) {
        const opt = document.createElement("option");
        opt.value = String(c.index);
        opt.textContent = c.label;
        select.appendChild(opt);
      }
      // WP-91: a neighbour named by the URL wins; one that is not a candidate is reported back
      const named = next.neighbour ?? null;
      const valid = named !== null && next.candidates.some((c) => c.index === named);
      if (named !== null && !valid && ctx.onNeighbour) ctx.onNeighbour(null);
      if (valid) {
        other = named;
      } else if (other === null || !next.candidates.some((c) => c.index === other)) {
        other = next.candidates.length ? next.candidates[0].index : null;
      }
      if (other !== null) select.value = String(other);
      load();
    },
    /**
     * WP-105: the block is on screen (its tab is open) or not; the table of a pair chosen meanwhile is asked for when it comes.
     * @param {boolean} on
     */
    setActive(on) {
      active = on;
      if (on && pending) void load();
    },
    /**
     * WP-91: follow a neighbour change that came from the URL (an edited address, back / forward);
     * a no-op when it already is the shown neighbour, so the page's own `replace` does not reload.
     * @param {number | null} index
     */
    setNeighbour(index) {
      if (!state || index === null || index === other) return;
      if (!state.candidates.some((c) => c.index === index)) {
        if (ctx.onNeighbour) ctx.onNeighbour(null); // not a candidate of this trace: the page drops it
        return;
      }
      other = index;
      select.value = String(index);
      load();
    },
  };
}
