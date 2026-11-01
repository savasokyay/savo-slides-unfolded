// @ts-check
// WP-32: the generic TracePlayer. It never knows what an algorithm is: it walks `trace.steps`
// (and their sub-steps: symbolic -> expanded -> numeric), derives the *frame* every panel needs
// and calls `panel.apply(frame)`. Panels implement `{ reset(trace), apply(frame), destroy?() }`.
//
// Frame derivation is a pure function of (trace, index) - no replay side effects - so `goto(k)`
// from a deep link renders exactly what stepping there would have shown:
//   * highlights = every `persist: true` highlight of an EARLIER step (they stay for the rest of
//                  the trace: the target column, the active row, the selected/dropped neighbours)
//                  + the current step's own highlights;
//   * tables[id]  = { reveal_upto: max so far (reveals accumulate), sort_by: latest set so far,
//                     focus_rows: this step's only }.

/**
 * @typedef {Object} Frame
 * @property {number} index
 * @property {number} sub
 * @property {number} total
 * @property {any} step
 * @property {any} phase
 * @property {any[]} highlights
 * @property {Record<string, {reveal_upto: number | null, sort_by: string | null, focus_rows: number[]}>} tables
 * @property {any} trace
 * @property {Set<string>} visitedNodes
 */

/**
 * @param {any} trace
 * @param {number} index
 * @returns {any}
 */
export function phaseOf(trace, index) {
  let current = trace.phases[0] || null;
  for (const p of trace.phases) if (p.first_step <= index) current = p;
  return current;
}

/**
 * @param {any} trace
 * @param {number} index
 * @param {number} sub
 * @returns {Frame}
 */
export function buildFrame(trace, index, sub) {
  const step = trace.steps[index];
  const phase = phaseOf(trace, index);
  const highlights = [];
  for (let k = 0; k < index; k += 1) {
    for (const h of trace.steps[k].highlights || []) if (h.persist) highlights.push(h);
  }
  highlights.push(...(step.highlights || []));

  /** @type {Frame["tables"]} */
  const tables = {};
  for (const id of Object.keys(trace.tables || {})) {
    tables[id] = { reveal_upto: null, sort_by: null, focus_rows: [] };
  }
  for (let k = 0; k <= index; k += 1) {
    for (const ref of trace.steps[k].tables || []) {
      const t =
        tables[ref.table_id] ||
        (tables[ref.table_id] = { reveal_upto: null, sort_by: null, focus_rows: [] });
      if (ref.reveal_upto !== null && ref.reveal_upto !== undefined) {
        t.reveal_upto = Math.max(t.reveal_upto ?? 0, ref.reveal_upto);
      }
      if (ref.sort_by) t.sort_by = ref.sort_by;
      if (k === index) t.focus_rows = ref.focus_rows || []; // focus belongs to the current step only
    }
  }
  const visitedNodes = new Set();
  for (let k = 0; k < index; k += 1) visitedNodes.add(trace.steps[k].node_id);
  return { index, sub, total: trace.steps.length, step, phase, highlights, tables, trace, visitedNodes };
}

// WP-204: what Space belongs to. The player listens on the window and turns Space into "next step" with preventDefault - which also cancels a focused button's own press (a button
// clicks on the key's RELEASE, and only when the key's press was not prevented): after "Random pick" the next Space stepped the walk instead of picking again, the 💾 icon had to stop
// every key to be pressable at all, and a screen-reader or keyboard user could not press any button on a trace page. Space is the control's when the focus is on one; the player takes it
// only when the focus is on the page (the body, a panel, a link, a figure node), where Space has no other meaning. The text fields never reached the player (see onKey).
const SPACE_TAGS = new Set(["BUTTON", "INPUT", "SELECT", "TEXTAREA", "SUMMARY"]);
const SPACE_ROLES = new Set(["button", "tab", "switch", "checkbox", "radio", "menuitem", "menuitemcheckbox", "menuitemradio", "option", "slider", "spinbutton", "combobox", "textbox", "searchbox"]);

/**
 * WP-204: whether Space on `target` presses (or edits) that control instead of stepping the trace: a native button / field / summary, an element with a control's ARIA role, a toggle
 * (`aria-pressed`) or an editable one. Read from properties, not from a selector, so a plain object can stand in for the element under node.
 * @param {any} target the event's target (the element that has the focus)
 * @returns {boolean}
 */
export function spaceBelongsToControl(target) {
  if (!target) return false;
  if (SPACE_TAGS.has(String(target.tagName).toUpperCase()) || target.isContentEditable === true) return true;
  const role = typeof target.getAttribute === "function" ? target.getAttribute("role") : null;
  if (role && SPACE_ROLES.has(role)) return true;
  return typeof target.hasAttribute === "function" && target.hasAttribute("aria-pressed");
}

/**
 * @param {{trace: any, panels: any[], onPosition?: (index: number, sub: number) => void, stepEndKey?: boolean, bursts?: string[][], burstMs?: number}} opts
 *   `stepEndKey` (WP-107): the E key finishes the current step (see `finishStep`); off unless a page asks for it
 *   `bursts` (WP-235a): loops of steps (lists of node ids) that the reader's NEXT plays as ONE macro step - the step that enters the loop is shown, the rest of the loop's steps follow by themselves,
 *   `burstMs` apart (the weighted hybrid's bases being fitted: four rows, one number each, appear one after the other on a single click); the next click inside a running burst finishes it at
 *   once, the one after goes on; BACK from anywhere in the loop goes to the step before it. The trace is unchanged (every step is still there: a link, the phase list and the autoplay walk them one by one)
 */
export function createTracePlayer({ trace, panels, onPosition, stepEndKey = false, bursts = [], burstMs = 350 }) { // WP-235a: bursts, burstMs
  let index = 0;
  let sub = 0;
  let playing = false;
  let speed = 1;
  /** @type {number | null} */
  let timer = null;

  const total = trace.steps.length;

  function substepsOf(i) {
    return Math.max(1, trace.steps[i]?.substeps || 1);
  }

  let destroyed = false;
  // WP-140: while the page waits for a newer trace this one stays on screen, frozen: no key, no move, no frame. A frame would reach the page's onPosition, which writes this
  // trace's parameters into the URL - over the new ones the reader just asked for.
  let locked = false;

  function emit() {
    // WP-43 finding: a frame emitted while destroying (pause() inside destroy()) reached the page's
    // onPosition -> router.replace and dragged the URL back to the trace the user was leaving.
    if (destroyed || locked) return;
    const frame = buildFrame(trace, index, sub);
    for (const panel of panels) panel.apply(frame);
    if (onPosition) onPosition(index, sub);
  }

  /**
   * WP-235a: which burst loop a step belongs to (the index in `bursts`), -1 for none.
   * @param {number} i
   */
  function burstOf(i) {
    const node = String(trace.steps[i]?.node_id);
    return bursts.findIndex((nodes) => nodes.includes(node));
  }

  /**
   * WP-235a: the first and the last step of the run of the same burst loop that step `i` stands in; null for a step outside every loop.
   * @param {number} i
   * @returns {{first: number, last: number} | null}
   */
  function burstRun(i) {
    const loop = burstOf(i);
    if (loop < 0) return null;
    let first = i;
    let last = i;
    while (first > 0 && burstOf(first - 1) === loop) first -= 1;
    while (last + 1 < total && burstOf(last + 1) === loop) last += 1;
    return { first, last };
  }

  /** @type {number | null} WP-235a: the clock of a running burst */
  let burstTimer = null;

  /** WP-235a: stop a running burst where it stands (any move of the reader's, play, pause, lock and destroy do) */
  function cancelBurst() {
    if (burstTimer !== null) {
      clearTimeout(burstTimer);
      burstTimer = null;
    }
  }

  /**
   * WP-235a: play the rest of a loop by itself - one step every `burstMs` (the player's speed counts) up to its last, each a frame like any other, so the counters, the narration and the rows follow.
   * @param {number} last the loop's last step
   */
  function startBurst(last) {
    const tick = () => {
      burstTimer = null;
      if (destroyed || locked || playing || index >= last) return; // a move of the reader's or the autoplay took over
      moveTo(index + 1, 0);
      if (index < last) burstTimer = window.setTimeout(tick, burstMs / speed);
    };
    burstTimer = window.setTimeout(tick, burstMs / speed);
  }

  /**
   * @param {number} i
   * @param {number} [s]
   */
  function moveTo(i, s = 0) { // WP-235a: the move itself (`goto` also ends a running burst)
    if (locked) return; // WP-140
    index = Math.min(Math.max(i, 0), total - 1);
    sub = Math.min(Math.max(s, 0), substepsOf(index) - 1);
    emit();
  }

  /**
   * @param {number} i
   * @param {number} [s]
   */
  function goto(i, s = 0) {
    cancelBurst(); // WP-235a: a jump of the reader's ends a burst
    moveTo(i, s);
  }

  /**
   * One step on: the next sub-step, else the next step. The autoplay's move (`schedule`); a burst loop is walked step by step here, at the autoplay's pace.
   * @returns {boolean}
   */
  function advance() {
    if (sub + 1 < substepsOf(index)) {
      goto(index, sub + 1);
      return true;
    }
    if (index + 1 < total) {
      goto(index + 1, 0);
      return true;
    }
    pause();
    return false;
  }

  /**
   * The reader's next (button, Space, arrow). WP-235a: INTO a burst loop it shows the loop's first step and plays the rest by itself; INSIDE a loop that still has steps it finishes the loop at once;
   * from the loop's last step it goes on. Everywhere else it is `advance`.
   * @returns {boolean}
   */
  function next() {
    cancelBurst();
    if (sub + 1 < substepsOf(index)) {
      goto(index, sub + 1);
      return true;
    }
    const run = burstRun(index);
    if (run && index < run.last) {
      goto(run.last, substepsOf(run.last) - 1); // the click inside a running (or interrupted) loop: all of it, now
      return true;
    }
    if (index + 1 < total) {
      const target = index + 1;
      goto(target, 0);
      const into = burstRun(target);
      if (into && into.first === target && into.last > into.first) startBurst(into.last); // entered a loop from outside: its steps follow by themselves
      return true;
    }
    pause();
    return false;
  }

  function prev() {
    if (sub > 0) {
      goto(index, sub - 1);
      return;
    }
    const run = burstRun(index);
    if (run && run.first > 0) {
      goto(run.first - 1, substepsOf(run.first - 1) - 1); // WP-235a: a loop is one macro step, back leaves it whole
      return;
    }
    if (index > 0) goto(index - 1, substepsOf(index - 1) - 1);
  }

  /**
   * WP-107: finish the step - skip the sub-steps still to come and land on the step's last one (the numbers, after symbolic
   * and expanded). Already on a step's last sub-step it goes on to the last sub-step of the NEXT step, so one click per step
   * walks a long run of identical steps (the mean of every candidate) at the speed the instructor wants after the first one
   * has been shown in full. Nothing left to finish at the very end: pauses and reports false, like next().
   * @returns {boolean} whether the position changed
   */
  function finishStep() {
    const last = substepsOf(index) - 1;
    if (sub < last) {
      goto(index, last);
      return true;
    }
    if (index + 1 < total) {
      goto(index + 1, substepsOf(index + 1) - 1);
      return true;
    }
    pause();
    return false;
  }

  function nextPhase() {
    const current = phaseOf(trace, index);
    const after = trace.phases.find((p) => p.first_step > index && p !== current);
    if (after) goto(after.first_step);
    else goto(total - 1);
  }

  function prevPhase() {
    const current = phaseOf(trace, index);
    if (current && index > current.first_step) {
      goto(current.first_step);
      return;
    }
    const before = [...trace.phases].reverse().find((p) => p.first_step < index);
    goto(before ? before.first_step : 0);
  }

  function schedule() {
    if (!playing) return;
    const step = trace.steps[index];
    const ms = Math.max(200, (step?.duration_ms || 900) / substepsOf(index) / speed);
    timer = window.setTimeout(() => {
      timer = null;
      if (!playing) return;
      if (advance()) schedule(); // WP-235a: the autoplay walks every step (a burst loop at its own pace)
    }, ms);
  }

  function play() {
    cancelBurst(); // WP-235a
    if (playing || locked) return; // WP-140: a frozen player does not start a clock (its moves are ignored: it would tick for nothing)
    playing = true;
    emit();
    schedule();
  }

  function pause() {
    cancelBurst(); // WP-235a
    playing = false;
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    emit();
  }

  /** @param {KeyboardEvent} e */
  function onKey(e) {
    if (locked) return; // WP-140
    const target = /** @type {HTMLElement | null} */ (e.target);
    if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
    if (e.key === " " && spaceBelongsToControl(target)) return; // WP-204: Space presses the focused control (Shift+Space too); the arrows, Home / End, P, +/- and E stay the player's
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    switch (e.key) {
      case " ":
      case "ArrowRight":
        e.preventDefault();
        if (e.shiftKey) nextPhase();
        else next();
        break;
      case "ArrowLeft":
        e.preventDefault();
        if (e.shiftKey) prevPhase();
        else prev();
        break;
      case "Home":
        e.preventDefault();
        goto(0);
        break;
      case "End":
        e.preventDefault();
        goto(total - 1, substepsOf(total - 1) - 1);
        break;
      case "p":
      case "P":
        if (playing) pause();
        else play();
        break;
      case "e":
      case "E":
        // WP-107: opt-in (the uCF / iCF pages); Shift+→ and Shift+Space are the phase jumps, so the step end has a key of its own
        if (stepEndKey) {
          e.preventDefault();
          finishStep();
        }
        break;
      case "+":
      case "=":
        setSpeed(speed * 2);
        break;
      case "-":
        setSpeed(speed / 2);
        break;
      default:
        break;
    }
  }

  /** @param {number} value */
  function setSpeed(value) {
    speed = Math.min(8, Math.max(0.25, value));
    emit();
  }

  window.addEventListener("keydown", onKey);
  for (const panel of panels) panel.reset(trace);

  return {
    goto,
    next,
    prev,
    finishStep,
    nextPhase,
    prevPhase,
    play,
    pause,
    toggle() {
      if (playing) pause();
      else play();
    },
    setSpeed,
    /**
     * WP-140: freeze the player (a newer trace is on its way): playback stops WITHOUT a frame, keys and moves are ignored until `unlock()`. The position is kept.
     */
    lock() {
      locked = true;
      cancelBurst(); // WP-235a
      playing = false;
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
    },
    /** WP-140: the newer trace failed - this one is the page's again (no frame: the URL names the request that failed, the page keeps what it shows). */
    unlock() {
      locked = false;
    },
    state() {
      return { index, sub, playing, speed, total, substeps: substepsOf(index) };
    },
    destroy() {
      destroyed = true; // silence emit() first, then stop the clock without a farewell frame
      cancelBurst(); // WP-235a
      playing = false;
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
      window.removeEventListener("keydown", onKey);
      for (const panel of panels) if (panel.destroy) panel.destroy();
    },
  };
}
