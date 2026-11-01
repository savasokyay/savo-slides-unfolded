// @ts-check
// WP-32: transport controls for the TracePlayer (first/prev/play/next/last, phase jump, speed,
// step counter with sub-step dots, progress bar). Pure DOM; the player owns the logic.

import { candidateProgress } from "../util/candidate-progress.js"; // WP-107 (i)
import { CANDIDATE_LOOPS, CB_TOPK_LOOPS, TRAINED_LOOPS, macroSteps } from "../util/macro-steps.js"; // WP-115 (3); WP-123: the loops of the MF / DNN pages; WP-212: the content page's top-K loops
import { topkProgress } from "../util/topk-progress.js"; // WP-212
import { trainingProgress } from "../util/training-progress.js"; // WP-123
import { hybridProgress } from "../util/hybrid-progress.js"; // WP-235

// WP-82: the transport glyphs as inline SVG, media-player conventions (the instructor compared the
// bar with Spotify): |◀ and ▶| step ONE click, |◀◀ and ▶▶| jump to the ends, ▶ / ▌▌ play and
// pause. The Unicode set (⏮ ◀ ▶▶ ⏭) mixed fonts, and "▶▶" reads as fast-forward, not as one step.
const ICONS = {
  first: '<path d="M2 3h1.8v10H2zM9 3 4.2 8 9 13zM14.6 3 9.8 8l4.8 5z"/>',
  prev: '<path d="M3 3h2v10H3zM13.5 3 5.5 8l8 5z"/>',
  play: '<path d="M4 2.5 14 8 4 13.5z"/>',
  pause: '<path d="M4 3h3v10H4zM9 3h3v10H9z"/>',
  next: '<path d="M11 3h2v10h-2zM2.5 3l8 5-8 5z"/>',
  last: '<path d="M12.2 3H14v10h-1.8zM1.4 3l4.8 5-4.8 5zM7 3l4.8 5L7 13z"/>',
  // WP-107: "finish this step" sits between ▶| (one sub-step) and ▶▶| (the last step): a triangle and a DOUBLE bar - one
  // sub-step's play head run on to the end of the step's own bars
  finish: '<path d="M1.5 3l7 5-7 5zM9.8 3h1.6v10H9.8zM12.6 3h1.6v10h-1.6z"/>',
};

/**
 * WP-115 (3): "Step 4 / 8" -> ["Step 4", "8"] - the translated counter text cut at its slash, so the numerator, the slash and the denominator can sit
 * in the three columns of the strip's counter grid (the slashes of the two counters stand at the same x). No slash: the whole text is the numerator.
 * @param {string} text
 * @returns {[string, string]}
 */
export function splitRatio(text) {
  const at = text.indexOf("/");
  return at < 0 ? [text.trim(), ""] : [text.slice(0, at).trim(), text.slice(at + 1).trim()];
}

/**
 * @param {string} className
 * @returns {{row: HTMLElement, num: HTMLElement, slash: HTMLElement, den: HTMLElement}} one counter line: a row of the strip's three-column grid
 */
function ratioRow(className) {
  const row = document.createElement("span");
  row.className = `pc-row ${className}`;
  const [num, slash, den] = ["pc-num", "pc-slash", "pc-den"].map((cls) => {
    const cell = document.createElement("span");
    cell.className = cls;
    return cell;
  });
  slash.textContent = "/";
  row.append(num, slash, den);
  return { row, num, slash, den };
}

/**
 * @param {{row: HTMLElement, num: HTMLElement, den: HTMLElement}} line
 * @param {string} text "a / b" (empty: the line keeps its place and shows nothing)
 */
function setRatio(line, text) {
  const [a, b] = splitRatio(text);
  line.num.textContent = a;
  line.den.textContent = b;
  line.row.classList.toggle("empty", text === "");
  if (text) line.row.setAttribute("aria-label", text);
  else line.row.removeAttribute("aria-label");
}

/** @param {keyof typeof ICONS} name */
function iconSvg(name) {
  return `<svg class="player-icon" viewBox="0 0 16 16" width="12" height="12" fill="currentColor" aria-hidden="true">${ICONS[name]}</svg>`;
}

/**
 * @param {HTMLElement} root
 * @param {{i18n: any, player: any, trace: any, finishStep?: boolean, candidates?: "user" | "item" | null, training?: boolean, topk?: boolean, loops?: string[][], hybrid?: boolean}} ctx `finishStep` (WP-107): add the
 *   "finish this step" button between next and last - the uCF / iCF pages; every other page (decks, Metrics, MF / DNN / content) keeps its bar.
 *   `candidates` (WP-107 i): a second counter "c / C" under the step counter while the walk goes through the candidates, in the role colour
 *   of the candidates ("user" = the neighbours of a uCF page, "item" = the items of an iCF page); it keeps its place when empty.
 *   `training` (WP-123): the same two counters for the MF / DNN pages - the epoch walk and the forward pass's stages are ONE step each of the counter
 *   above, the one under it counts inside them ("Epoch 3 / 8", "Stage 7 / 10"; util/training-progress.js), in the text colour (no role)
 *   `topk` (WP-212): with `candidates`, the trace is the content page's top-K walk - its two loops (scoring the films, re-ranking the list) are ONE step each of the counter above
 *   (util/macro-steps.js `CB_TOPK_LOOPS`) and the one under it reads "3 / 5" while the films are scored and "Place 3 / 10" while the list is re-ranked (util/topk-progress.js)
 *   WP-235: `hybrid` - the hybrid walks: with `loops`, the second counter reads "Iteration 15 / 30" in the gradient descent and "Recommender 2 / 4" while the bases are fitted
 *   or scored (util/hybrid-progress.js), the same line the training pages use
 */
export function createPlayerControls(root, ctx) {
  const { i18n, player, trace } = ctx;
  const withFinish = ctx.finishStep === true && typeof player.finishStep === "function";
  // WP-107 (i): which candidate of the walk each step is about (util/candidate-progress.js); null = no second counter on this bar
  const candidateRole = ctx.candidates === "user" || ctx.candidates === "item" ? ctx.candidates : null;
  // WP-212: the content page's top-K trace has its own two loops (scoring the films, re-ranking the list) - without this its `score` / `mmr` steps were no loop to the rule below, so every film
  // and every place was a step of its own ("Step 5 / 20" on an 80 x 120 set, "Step 4 / 6" on the 5x6 toy) and the second counter stayed empty
  const cbTopk = candidateRole !== null && ctx.topk === true;
  /** @type {{perStep: ({c: number, kind?: "place"} | null)[], walked: number, total: number | null, places?: number, placesTotal?: number | null} | null} */
  const walk = candidateRole ? (cbTopk ? topkProgress(trace) : candidateProgress(trace)) : null;
  // WP-123: on the MF / DNN pages the second counter walks the epochs and the stages of the forward pass instead (never both on one page)
  // WP-235: the hybrid walks' second counter is the same line - "Iteration 15 / 30" in the gradient descent, "Recommender 2 / 4" while the bases are fitted (util/hybrid-progress.js)
  const trainingRun = !candidateRole && ctx.training === true ? trainingProgress(trace) : !candidateRole && ctx.hybrid === true ? hybridProgress(trace) : null;
  // WP-115 (3): the step counter of these pages counts the algorithm's own steps - the whole candidate loop is ONE (util/macro-steps.js);
  // WP-123: on the MF / DNN pages the epoch walk and the forward pass are ONE each
  // WP-222: the weighted hybrid names its own two loops (`loops`: util/hybrid-tabs.js `HYBRID_LOOPS` - the bases being fitted, the gradient steps), each ONE step of the counter
  const macro = ctx.loops ? macroSteps(trace, ctx.loops) : candidateRole ? macroSteps(trace, cbTopk ? CB_TOPK_LOOPS : CANDIDATE_LOOPS) : trainingRun ? macroSteps(trace, TRAINED_LOOPS) : null;
  /** @type {{top: ReturnType<typeof ratioRow>, bot: ReturnType<typeof ratioRow>} | null} */
  let lines = null; // the two counter lines of the strip (null on the pages with one plain counter)
  /** @type {Record<string, HTMLElement>} */
  let els = {};
  let reserved = false; // WP-105: the counter and the dots already hold the width of their widest content

  /**
   * WP-105 (the instructor, three times: the RS tree, the uCF page, ...): the transport must not move while stepping. The
   * step counter ("Step 3 / 55") and the sub-step dots ("●●○") change width from step to step, which pushed every control to
   * their left or right around. Each of the two spans reserves the width of its widest possible content - measured once
   * with the real font, both dot glyphs (they differ by a pixel or two) - so nothing after or before them ever moves, on
   * every page that uses this bar. A zero measurement (the bar is not laid out yet) leaves the span alone and is retried.
   * @param {HTMLElement} el
   * @param {string[]} candidates
   * @returns {boolean} true when a width was reserved
   */
  function reserveWidth(el, candidates) {
    const keep = el.textContent;
    el.style.minWidth = "";
    let width = 0;
    for (const text of candidates) {
      el.textContent = text;
      width = Math.max(width, el.getBoundingClientRect().width);
    }
    el.textContent = keep;
    if (width > 0) el.style.minWidth = `${Math.ceil(width)}px`;
    return width > 0;
  }

  function reserveWidths() {
    if (!els.counter || !els.dots) return;
    const n = macro ? macro.total : trace.steps.length;
    const maxSubs = Math.max(1, ...trace.steps.map((/** @type {any} */ s) => Number(s.substeps) || 1));
    let counterOk;
    if (lines && walk) {
      // WP-115 (3): each of the four cells holds the width of its widest content (the columns of the grid are shared by the two lines)
      const [stepNum, stepDen] = splitRatio(i18n.t("player.step_of", { i: n, n }));
      const [candNum, candDen] = splitRatio(i18n.t("player.candidate_of", { c: walk.walked, n: walk.walked })); // WP-107 (i)
      counterOk = [reserveWidth(lines.top.num, [stepNum]), reserveWidth(lines.top.den, [stepDen])].every(Boolean);
      const nums = [candNum];
      const dens = [candDen];
      if (walk.places) {
        // WP-212: the top-K walk's second loop counts places of the list ("Place 10 / 10"): the line holds the wider of the two counters
        const [placeNum, placeDen] = splitRatio(i18n.t("player.place_of", { c: walk.places, n: walk.places }));
        nums.push(placeNum);
        dens.push(placeDen);
      }
      reserveWidth(lines.bot.num, nums);
      reserveWidth(lines.bot.den, dens);
    } else if (lines && trainingRun) {
      // WP-123: the second line's widest content is the longest of the loops the trace has ("Epoch 100", "Stage 10"), in both languages' words
      const [stepNum, stepDen] = splitRatio(i18n.t("player.step_of", { i: n, n }));
      const inner = trainingRun.widest.map((w) => splitRatio(i18n.t(`player.${w.kind}_of`, { c: w.c, n: w.n })));
      counterOk = [reserveWidth(lines.top.num, [stepNum]), reserveWidth(lines.top.den, [stepDen])].every(Boolean);
      reserveWidth(lines.bot.num, inner.length ? inner.map(([num]) => num) : [""]);
      reserveWidth(lines.bot.den, inner.length ? inner.map(([, den]) => den) : [""]);
    } else {
      counterOk = reserveWidth(els.counter, [i18n.t("player.step_of", { i: n, n })]);
    }
    const dotsOk = reserveWidth(els.dots, maxSubs > 1 ? ["●".repeat(maxSubs), "○".repeat(maxSubs)] : [""]);
    reserved = counterOk && (dotsOk || maxSubs <= 1);
  }

  /**
   * @param {keyof typeof ICONS} icon
   * @param {string} title
   * @param {() => void} onClick
   */
  function button(icon, title, onClick) {
    const b = document.createElement("button");
    b.className = "btn btn-sm";
    b.type = "button";
    b.innerHTML = iconSvg(icon);
    b.title = title;
    b.setAttribute("aria-label", title);
    b.addEventListener("click", onClick);
    return b;
  }

  function build() {
    root.innerHTML = "";
    const bar = document.createElement("div");
    bar.className = "player-controls";
    const first = button("first", i18n.t("player.first"), () => player.goto(0));
    const prev = button("prev", i18n.t("player.prev"), () => player.prev());
    const play = button("play", i18n.t("player.play"), () => player.toggle());
    play.classList.add("btn-primary");
    const next = button("next", i18n.t("player.next"), () => player.next());
    const finish = withFinish ? button("finish", i18n.t("player.step_end"), () => player.finishStep()) : null;
    const last = button("last", i18n.t("player.last"), () => player.goto(trace.steps.length - 1));

    let counter = document.createElement("span");
    counter.className = "player-counter num";
    const dots = document.createElement("span");
    dots.className = "player-dots";
    // WP-107 (i): the step counter and, under it, the candidate counter: one block as tall as the bar's selects (26 px), so no control moves
    /** @type {HTMLElement | null} */
    let counters = null;
    /** @type {HTMLElement | null} */
    let cand = null;
    if (candidateRole || trainingRun) {
      // WP-115 (3): two lines of one three-column grid (numerator to the right, the slash in the middle, the denominator to the left), so the slashes of "Step 4 / 8"
      // and "12 / 45" stand at the same x; each line is a subgrid of the block, the line itself keeps its box (title, accessible name)
      // WP-123: the training pages' second line has no role colour (`player-cand-train`: the text colour)
      lines = { top: ratioRow("player-counter num"), bot: ratioRow(`player-cand num player-cand-${candidateRole ?? "train"}`) };
      counter = lines.top.row;
      cand = lines.bot.row;
      counters = document.createElement("span");
      counters.className = "player-counters";
      counters.append(counter, cand);
    }

    const phaseSel = document.createElement("select");
    phaseSel.title = i18n.t("player.phase");
    for (const p of trace.phases) {
      const opt = document.createElement("option");
      opt.value = String(p.first_step);
      opt.textContent = i18n.t(p.label_key);
      phaseSel.appendChild(opt);
    }
    phaseSel.addEventListener("change", () => player.goto(Number(phaseSel.value)));

    const speedSel = document.createElement("select");
    speedSel.title = i18n.t("player.speed");
    for (const s of [0.5, 1, 2, 4]) {
      const opt = document.createElement("option");
      opt.value = String(s);
      opt.textContent = `${s}×`;
      speedSel.appendChild(opt);
    }
    speedSel.value = "1";
    speedSel.addEventListener("change", () => player.setSpeed(Number(speedSel.value)));

    const keys = document.createElement("span");
    keys.className = "player-keys";
    keys.textContent = i18n.t("player.keys");

    if (withFinish) keys.textContent = `${i18n.t("player.keys")} · ${i18n.t("player.keys_step_end")}`;
    bar.append(first, prev, play, next, ...(finish ? [finish] : []), last, counters ?? counter, dots, phaseSel, speedSel, keys);
    bar.title = keys.textContent ?? ""; // WP-105: the player strip hides the key list line; it is the bar's tooltip
    const progress = document.createElement("div");
    progress.className = "player-progress";
    const fill = document.createElement("div");
    fill.className = "player-progress-fill";
    progress.appendChild(fill);
    root.append(bar, progress);
    els = { first, prev, play, next, ...(finish ? { finish } : {}), last, counter, ...(cand ? { cand } : {}), dots, phaseSel, speedSel, fill };
    reserved = false;
    reserveWidths();
    // a web font that arrives after the first layout changes the measurement: measure again once the fonts are ready
    document.fonts?.ready.then(() => {
      if (root.isConnected && els.counter === counter) reserveWidths();
    });
  }

  return {
    reset() {
      build();
    },
    /** @param {import("./trace-player.js").Frame} frame */
    apply(frame) {
      if (!reserved) reserveWidths(); // WP-105: the bar was not laid out when it was built
      const st = player.state();
      els.play.innerHTML = iconSvg(st.playing ? "pause" : "play"); // WP-82: SVG glyphs
      els.play.title = i18n.t(st.playing ? "player.pause" : "player.play");
      // WP-115 (3): on the uCF / iCF pages the loop over the candidates is one step of the counter above (the counter under it moves inside it)
      const stepText = macro
        ? i18n.t("player.step_of", { i: macro.perStep[frame.index], n: macro.total })
        : i18n.t("player.step_of", { i: frame.index + 1, n: frame.total });
      if (lines) setRatio(lines.top, stepText);
      else els.counter.textContent = stepText;
      if (lines && els.cand && walk) {
        // WP-107 (i): "3 / 12" while the walk is about a candidate, empty (but in place) on every other step; the hover title says it in words
        // and, when the engine capped a long list, how many exist ("50 of 73 shown"). WP-115 (3): empty only OUTSIDE the loop and on the
        // significance-weighting step (WP-107 i2) - inside the loop it is the one sign of progress
        const at = walk.perStep[frame.index];
        if (at?.kind === "place") {
          // WP-212: a place of the re-ranked list ("Place 3 / 10"; a long list folds its rest, so "20 of 30 shown")
          const n = walk.places ?? at.c;
          setRatio(lines.bot, i18n.t("player.place_of", { c: at.c, n }));
          const placesCapped = walk.placesTotal != null && walk.placesTotal > n;
          els.cand.title = i18n.t("player.place_title", { c: at.c, n }) + (placesCapped ? ` (${i18n.t("player.place_capped", { n, total: walk.placesTotal })})` : "");
        } else {
          setRatio(lines.bot, at ? i18n.t("player.candidate_of", { c: at.c, n: walk.walked }) : "");
          const capped = walk.total !== null && walk.total > walk.walked;
          els.cand.title = at
            ? i18n.t("player.candidate_title", { c: at.c, n: walk.walked }) +
              (capped ? ` (${i18n.t("player.candidate_capped", { n: walk.walked, total: walk.total })})` : "")
            : "";
        }
      }
      if (lines && els.cand && trainingRun) {
        // WP-123: "Epoch 3 / 8" while the walk is in the epochs, "Stage 7 / 10" in the forward pass, empty (but in place) on every other step
        const at = trainingRun.perStep[frame.index];
        setRatio(lines.bot, at ? i18n.t(`player.${at.kind}_of`, { c: at.c, n: at.n }) : "");
        els.cand.title = at ? i18n.t(`player.${at.kind}_title`, { c: at.c, n: at.n }) : "";
      }
      els.dots.textContent = st.substeps > 1 ? "●".repeat(frame.sub + 1) + "○".repeat(st.substeps - frame.sub - 1) : "";
      if (frame.phase) els.phaseSel.value = String(frame.phase.first_step);
      // WP-77: nothing before the first click, nothing after the last sub-step of the last step -
      // the buttons say so instead of silently doing nothing (keyboard shortcuts already no-op)
      const atStart = frame.index === 0 && frame.sub === 0;
      const atEnd = frame.index === frame.total - 1 && frame.sub >= Math.max(st.substeps, 1) - 1;
      /** @type {HTMLButtonElement} */ (els.first).disabled = atStart;
      /** @type {HTMLButtonElement} */ (els.prev).disabled = atStart;
      /** @type {HTMLButtonElement} */ (els.next).disabled = atEnd;
      if (els.finish) /** @type {HTMLButtonElement} */ (els.finish).disabled = atEnd; // WP-107: nothing left to finish at the very end
      /** @type {HTMLButtonElement} */ (els.last).disabled = atEnd;
      els.speedSel.value = String(st.speed);
      const done = frame.total > 1 ? frame.index / (frame.total - 1) : 1;
      els.fill.style.width = `${Math.round(done * 100)}%`;
    },
  };
}
