// @ts-check
// WP-140: the strip and the look of a trace that is on its way. A model page's trace is a FIT (seconds on the class data), and the page used to wait for it with nothing but a
// word in the narration - everything the trace does not decide (the pickers, the Parameters, the task switch) was ready and the trace on screen stayed live. Now:
//   * a thin strip above the trace panels says what is being fitted and for how long ("Fitting FunkSVD (k = 2, <= 40 epochs) ... 3.2 s"), with an (i) that says why the wait is
//     there (the model is trained again for the held-out pair; the same data, settings and seed a second time come back at once);
//   * the FIRST trace of a page: the trace panels are grey placeholders (`.is-loading`);
//   * a NEWER trace over one on screen: the old one fades and is inert (`.is-stale`, the `inert` attribute: no click, no focus, no key of the player) and comes back if the
//     request fails (the summary bar fades with it; the page TITLE does not - it names the pair asked for and is written as soon as the names arrive, in ~30 ms);
//   * WP-161: a request the server REFUSES (it asks for the person's word before it trains) leaves the old trace on screen as the PREVIOUS PAIR's: faded and inert like a stale one,
//     the held-out chip with it, and the strip says so ("Previous pair" + one sentence, no spinner, no clock) until a decision starts a request - the title already names the new pair;
//   * the loading look appears only when the request outlasts `delayMs` (150 ms): a user-based page's trace comes in ~70-150 ms and would flicker; `inert` is immediate.
// WP-191: a request that carries a `progress_id` (the content-based page's) also shows WHAT the server is doing: `2/5  Scoring the candidates  40/100 (40 %)  2.0 s  ~3.0 s` - the stage's place
//   and name, the loop count and percentage, the clock, the stage's estimate - read from `GET /api/progress/{id}` every 250 ms while the request is pending. The cells have a width of their
//   own (`.has-progress`, css/trace.css) and a part the record does not carry is an EMPTY cell, so the strip does not change size between two polls; a 404 (or any failed poll) keeps the
//   last text, and the polling ends with the request. A strip with no `progressId` is exactly the strip it was.
// The states and the words are util/trace-loading.js, the progress texts util/progress-format.js; this file puts them on screen. Checked under node on a fake DOM with a fake clock
// (tests/app/js/trace_loading_check.mjs).

import { LOAD_DELAY_MS, fmtElapsed, isBusy, isFrozen, nextLoadState, showsEstimate } from "../util/trace-loading.js";
import { PROGRESS_POLL_MS, PROGRESS_STAGES, counterText, labelChars, parseProgress, stageLabel, stageText } from "../util/progress-format.js";
import { browserStorage } from "../util/safe-storage.js"; // WP-210
import { readRuns, wholeEstimate, writeRun } from "../util/trace-eta.js"; // WP-210: the estimate of the whole request, from the browser's earlier runs of the same kind

/**
 * @typedef {Object} Clock
 * @property {() => number} now
 * @property {(fn: () => void, ms: number) => any} setTimeout
 * @property {(id: any) => void} clearTimeout
 * @property {(fn: () => void, ms: number) => any} setInterval
 * @property {(id: any) => void} clearInterval
 */

/** @returns {Clock} the browser's */
function browserClock() {
  return {
    now: () => performance.now(),
    setTimeout: (fn, ms) => window.setTimeout(fn, ms),
    clearTimeout: (id) => window.clearTimeout(id),
    setInterval: (fn, ms) => window.setInterval(fn, ms),
    clearInterval: (id) => window.clearInterval(id),
  };
}

/**
 * WP-210: where the durations of earlier requests are kept - the browser's `localStorage` (every read and write guarded, util/trace-eta.js); a node check passes a fake.
 * @returns {{read: (key: string) => number[], write: (key: string, ms: number) => void}}
 */
function browserHistory() {
  return { read: (key) => readRuns(browserStorage(), key), write: (key, ms) => void writeRun(browserStorage(), key, ms) };
}

/**
 * @param {{
 *   i18n: {t: (key: string, params?: Record<string, unknown>) => string, lang: () => string},
 *   infoTip: (text: string, label?: string, heading?: string) => HTMLElement,
 *   host: {grid: HTMLElement, summary: HTMLElement, extra?: () => Array<HTMLElement | null | undefined>},
 *   delayMs?: number,
 *   clock?: Clock,
 *   progress?: ((id: string) => Promise<unknown>) | null,
 *   history?: {read: (key: string) => number[], write: (key: string, ms: number) => void},
 * }} opts `history` (WP-210): the durations of earlier live requests of the same kind (`begin`'s `etaKey`) - the strip's estimate of the whole request is their median minus the time gone;
 *   `host`: the elements the look is put on - the trace panels' grid and the summary bar; `extra` (WP-161) names more elements that belong to the trace on screen and
 *   fade with it while it is stale or the previous pair's (the held-out chip beside the title); `progress` (WP-191) asks the server for the record of a request's `progress_id`
 *   (the answer of `GET /api/progress/{id}`; null / a rejection: no record, the strip keeps its last text)
 */
export function createTraceLoading({ i18n, infoTip, host, delayMs = LOAD_DELAY_MS, clock = browserClock(), progress = null, history = browserHistory() }) {
  const el = document.createElement("div");
  el.className = "trace-loading";
  el.hidden = true;
  el.setAttribute("role", "status");
  const spinner = document.createElement("span");
  spinner.className = "trace-loading-spinner";
  spinner.setAttribute("aria-hidden", "true");
  // WP-191: three cells that exist only while a request reports progress (`.has-progress`; display: none otherwise): the stage's place before the label, the loop count after it,
  // the stage's estimate after the clock
  const stage = document.createElement("span");
  stage.className = "trace-loading-stage num";
  const text = document.createElement("span");
  text.className = "trace-loading-text";
  const counter = document.createElement("span");
  counter.className = "trace-loading-counter num";
  const time = document.createElement("span");
  time.className = "trace-loading-time num";
  const eta = document.createElement("span");
  eta.className = "trace-loading-eta num";
  const tip = document.createElement("span");
  tip.className = "trace-loading-tip";
  el.append(spinner, stage, text, counter, time, eta, tip);

  /** @type {import("../util/trace-loading.js").LoadState} */
  let state = "idle";
  /** @type {{words: () => {key: string, params: Record<string, unknown>}, why: string | null, estimateSeconds?: number | null, progressId?: string | null} | null} */
  let spec = null;
  /** WP-191: the running request's `progress_id` (null: it reports none - the strip is the plain one) */
  let progressId = null;
  /** @type {import("../util/progress-format.js").ProgressSnapshot | null} the last record that came; none yet (or a 404): the page's own sentence stays in the label cell */
  let snapshot = null;
  /** the waiting sentence of the page (`spec.words()`), the label cell's text until a record names a stage */
  let sentence = "";
  /** @type {any} */
  let pollTimer = null;
  /** counts the polling sessions: an answer that comes after a newer request began (or the request ended) is not shown */
  let pollToken = 0;
  let pollBusy = false;
  /** WP-210: the running request's kind (null: not a request whose duration is kept) and the earlier runs of that kind, read once when it begins */
  let etaKey = null;
  /** @type {number[]} */
  let etaRuns = [];
  let startedAt = 0;
  let shown = false;
  /** @type {any} */
  let showTimer = null;
  /** @type {any} */
  let tickTimer = null;
  /** @type {HTMLElement[]} the `extra` elements marked now (a chip is rewritten with its class when the next trace is drawn: the marks are taken off by reference) */
  let marked = [];

  function tick() {
    const elapsed = clock.now() - startedAt;
    const n = fmtElapsed(elapsed, i18n.lang());
    // WP-146: a fit the server has put a number on (the "too large" warning's estimate) counts against it; the tip of the strip keeps the room for the longer text
    const estimate = spec?.estimateSeconds;
    const counting = showsEstimate(elapsed, estimate);
    time.classList.toggle("has-estimate", counting);
    time.textContent = counting ? i18n.t("trace.large_seconds_of", { n, estimate: Math.round(/** @type {number} */ (estimate)) }) : i18n.t("trace.loading_seconds", { n });
    paintEta(); // WP-210: the estimate counts down with the clock
  }

  /**
   * WP-210: "~3.0 s left (estimate)" - what the whole request has still to run (util/trace-eta.js `wholeEstimate`): the median of the earlier runs of this kind minus the clock, else the
   * running stage's own estimate as before; empty (the cell keeps its room) when there is none or the median has been overtaken. The hover text says where the number comes from.
   */
  function paintEta() {
    if (!el.classList.contains("has-progress")) return;
    const left = wholeEstimate({ runs: etaRuns, elapsedMs: clock.now() - startedAt, stageEtaMs: snapshot && !snapshot.finished ? snapshot.etaMs : null });
    eta.textContent = left.ms === null ? "" : i18n.t("trace.loading_eta", { n: fmtElapsed(left.ms, i18n.lang()) });
    eta.title = left.source === "history" ? i18n.t("trace.loading_eta_history", { runs: etaRuns.length }) : left.source === "stage" ? i18n.t("trace.loading_eta_stage") : "";
  }

  /** the look for the state: placeholders for a first trace, a faded trace for a newer one */
  function look() {
    const stale = state === "stale" || state === "previous";
    host.grid.classList.toggle("is-stale", stale);
    host.grid.classList.toggle("is-loading", !stale);
    host.summary.classList.toggle("is-stale", stale);
    host.summary.classList.toggle("is-loading", !stale);
    for (const node of marked) node.classList.toggle("is-stale", false);
    marked = stale ? /** @type {HTMLElement[]} */ ((host.extra?.() ?? []).filter(Boolean)) : [];
    for (const node of marked) node.classList.toggle("is-stale", true);
  }

  /**
   * WP-191: the label, stage and loop-count cells. A strip with no `progressId` is the plain one (the sentence, nothing else); with one, the label cell holds the page's sentence until a
   * record names a stage and then that stage's words, and the cells of the record (empty for a part it does not carry) stand around it in the room `.has-progress` reserves for them.
   */
  function paintProgress() {
    const lang = i18n.lang();
    const active = progressId !== null && progress !== null;
    el.classList.toggle("has-progress", active);
    if (!active) {
      text.textContent = sentence;
      return;
    }
    const label = snapshot ? stageLabel(snapshot.stage, (key) => i18n.t(key)) : sentence;
    text.textContent = label;
    text.title = label; // (a stage a language file does not know could be longer than the room: the hover text is whole)
    stage.textContent = stageText(snapshot);
    counter.textContent = counterText(snapshot, lang);
    paintEta(); // WP-210: (was the stage's estimate alone)
    // the label cell is as wide as the longest thing it will ever say - every stage's label and the waiting sentence - so a new stage never moves its neighbours
    const room = labelChars([...PROGRESS_STAGES.map((name) => stageLabel(name, (key) => i18n.t(key))), sentence]);
    el.style.setProperty("--progress-label-ch", String(room));
  }

  function say() {
    if (!spec) return;
    el.classList.toggle("is-notice", false); // WP-161: the strip is the loading strip again (spinner, clock) once a request runs
    el.classList.toggle("is-failed", false); // WP-222: ... and the failed request's stamp is gone with it
    const words = spec.words();
    sentence = i18n.t(words.key, words.params);
    tip.replaceChildren();
    if (spec.why) tip.appendChild(infoTip(spec.why, i18n.t("trace.loading_why_label")));
    paintProgress();
    tick();
  }

  /** WP-191: ask the server for the request's record once now and then every PROGRESS_POLL_MS; never two questions in flight; a 404 / nothing keeps the last text */
  function poll() {
    if (pollBusy || progressId === null || progress === null) return;
    const id = progressId;
    const token = pollToken;
    pollBusy = true;
    /** @type {Promise<unknown>} */
    let asked;
    try {
      asked = Promise.resolve(/** @type {(id: string) => Promise<unknown>} */ (progress)(id)); // (asked now, not a microtask later: the first question goes out when the strip shows)
    } catch (error) {
      asked = Promise.reject(error);
    }
    asked.then(
      (raw) => {
        if (token !== pollToken) return; // a newer request began, or this one ended
        pollBusy = false;
        const next = parseProgress(raw);
        if (!next) return;
        snapshot = next;
        paintProgress();
      },
      () => {
        if (token === pollToken) pollBusy = false;
      },
    );
  }

  function startPolling() {
    if (pollTimer !== null || progressId === null || progress === null) return;
    pollTimer = clock.setInterval(poll, PROGRESS_POLL_MS);
    poll();
  }

  function stopPolling() {
    if (pollTimer !== null) clock.clearInterval(pollTimer);
    pollTimer = null;
    pollToken += 1;
    pollBusy = false;
  }

  function show() {
    showTimer = null;
    shown = true;
    look();
    say();
    el.hidden = false;
    if (tickTimer === null) tickTimer = clock.setInterval(tick, 100);
    startPolling();
  }

  /** every timer and every mark off: the page is what the state says */
  function clear() {
    if (showTimer !== null) clock.clearTimeout(showTimer);
    if (tickTimer !== null) clock.clearInterval(tickTimer);
    showTimer = null;
    tickTimer = null;
    stopPolling(); // WP-191: the polling ends with the request, whichever way it ends
    progressId = null;
    snapshot = null;
    etaKey = null; // WP-210
    etaRuns = [];
    el.classList.toggle("has-progress", false);
    shown = false;
    el.hidden = true;
    for (const node of [host.grid, host.summary, ...marked]) {
      node.classList.toggle("is-stale", false);
      node.classList.toggle("is-loading", false);
    }
    marked = [];
    el.classList.toggle("is-notice", false);
    el.classList.toggle("is-failed", false); // WP-222
    host.grid.inert = false;
    host.grid.removeAttribute("aria-busy");
  }

  return {
    el,
    /** @returns {import("../util/trace-loading.js").LoadState} */
    state: () => state,
    busy: () => isBusy(state),
    /** WP-161: a request is running OR the trace on screen is the previous pair's (a refusal) - the route's step / view changes wait */
    frozen: () => isFrozen(state),
    /**
     * A request begins (a newer one replaces a running one: the look stays, its clock restarts). With a trace on screen the page goes stale - inert at once, faded once the
     * request has lasted `delayMs`.
     * @param {{words: () => {key: string, params: Record<string, unknown>}, why: string | null, estimateSeconds?: number | null, progressId?: string | null, etaKey?: string | null}} next the strip's words (read
     *   when they are shown, so late defaults count), the (i)'s text (null: no tip), - WP-146 - the server's estimate of the fit in seconds when it gave one (the time reads "3.2 s of
     *   about 100 s") and - WP-191 - the `progress_id` the request carries (null / absent: the request reports no progress and the strip is the plain one)
     */
    begin(next) {
      state = nextLoadState(state, "start");
      spec = next;
      startedAt = clock.now();
      stopPolling(); // WP-191: a newer request replaces the running one's record (its late answers are not shown)
      progressId = next.progressId ?? null;
      snapshot = null;
      etaKey = progressId !== null ? (next.etaKey ?? null) : null; // WP-210: only a request that reports progress has a strip that can say what is left
      etaRuns = etaKey ? history.read(etaKey) : [];
      host.grid.inert = state === "stale";
      host.grid.setAttribute("aria-busy", "true");
      if (shown) {
        look();
        say();
        el.hidden = false;
        if (tickTimer === null) tickTimer = clock.setInterval(tick, 100); // (WP-161: after a refusal the strip was a notice with no clock running)
        startPolling();
        return;
      }
      if (showTimer !== null) clock.clearTimeout(showTimer);
      if (delayMs <= 0) show();
      else showTimer = clock.setTimeout(show, delayMs);
    },
    /** the new trace is drawn */
    done() {
      // WP-210: a request that really ran the engine - the server reported a stage while it waited - leaves its wall time behind for the next of its kind; a saved walk or a repeated
      // request comes back at once, with no record, and says nothing about the work (nor does a request that finished before the first question)
      if (etaKey !== null && snapshot !== null) history.write(etaKey, clock.now() - startedAt);
      state = nextLoadState(state, "done");
      clear();
    },
    /**
     * The request failed while the old trace still stands: it is the page's again (live, not faded: it can still be walked) - and the strip keeps a STAMP, a notice with no spinner and no
     * clock, until a request succeeds (WP-222: a toast of four seconds was the only sign, and the old trace looked like the answer to the settings just applied). The next request replaces
     * the stamp with the loading strip (`say`), its trace removes it (`done` -> `clear`).
     * @param {{lead: string, text: string}} [words] the stamp ("Request failed.") and the sentence after it; none: the old, silent return to the trace
     */
    fail(words) {
      state = nextLoadState(state, "fail");
      clear();
      if (state !== "failed" || !words) return;
      const lead = document.createElement("strong");
      lead.className = "trace-loading-stamp";
      lead.textContent = words.lead;
      text.replaceChildren(lead, ` ${words.text}`);
      stage.textContent = ""; // (the progress cells of the request that failed: hidden without `.has-progress`, and not left holding its numbers)
      counter.textContent = "";
      eta.textContent = "";
      time.textContent = "";
      time.classList.toggle("has-estimate", false);
      tip.replaceChildren();
      el.classList.toggle("is-notice", true);
      el.classList.toggle("is-failed", true);
      el.hidden = false;
    },
    /** the request failed after the old trace was gone: no trace */
    broken() {
      state = nextLoadState(state, "broken");
      clear();
    },
    /**
     * WP-161: the running request was refused over a trace on screen (the server wants the person's word, 413 `trace_too_large`): that trace is the PREVIOUS pair's. It stays
     * faded, inert and stamped until a decision starts a request (`begin`), the strip is a notice (no spinner, no clock) at once - there is nothing to wait for.
     * @param {{lead: string, text: string}} words the stamp ("Previous pair") and the sentence under it
     */
    refused(words) {
      state = nextLoadState(state, "refused");
      if (state !== "previous") return;
      if (showTimer !== null) clock.clearTimeout(showTimer);
      if (tickTimer !== null) clock.clearInterval(tickTimer);
      showTimer = null;
      tickTimer = null;
      stopPolling(); // WP-191: the refused request reports nothing more; the notice has no progress cells
      progressId = null;
      snapshot = null;
      etaKey = null; // WP-210
      etaRuns = [];
      el.classList.toggle("has-progress", false);
      shown = true;
      host.grid.inert = true;
      host.grid.setAttribute("aria-busy", "false");
      look();
      const lead = document.createElement("strong");
      lead.className = "trace-loading-stamp";
      lead.textContent = words.lead;
      text.replaceChildren(lead, ` ${words.text}`);
      time.textContent = "";
      time.classList.toggle("has-estimate", false);
      tip.replaceChildren();
      el.classList.toggle("is-notice", true);
      el.hidden = false;
    },
    /** the page is mounted or left */
    reset() {
      state = nextLoadState(state, "reset");
      spec = null;
      clear();
    },
  };
}
