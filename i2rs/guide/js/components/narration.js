// @ts-check
// WP-32: narration line (i18n text_key + formatted params), phase pill, detail badge, pitfall
// warning banner and the status strip of the step's values.

import { fmt, fmtParams } from "../util/format.js";
import { linkedText } from "../util/user-link.js"; // WP-96
import { fillClampedTitle } from "../util/title-clamp.js"; // WP-135

/**
 * The narration's DOM: the phase pill, the detail pill, the sentence, the warning banner and the strip of the step's values.
 * @param {HTMLElement} root
 * @returns {Record<string, HTMLElement>}
 */
function buildNarration(root) {
  root.innerHTML = "";
  const top = document.createElement("div");
  top.className = "narration-top";
  const phase = document.createElement("span");
  phase.className = "chip on";
  const detail = document.createElement("span");
  detail.className = "pill";
  const scope = document.createElement("span"); // WP-239: the scope of the choice the step makes (the hybrid walks): "Scope: whole class"
  scope.className = "chip scope-chip";
  scope.hidden = true;
  top.append(phase, detail, scope);
  const text = document.createElement("p");
  text.className = "narration-text";
  const warn = document.createElement("div");
  warn.className = "warn-banner";
  warn.hidden = true;
  const strip = document.createElement("div");
  strip.className = "status-strip";
  root.append(top, text, warn, strip);
  return { phase, detail, scope, text, warn, strip }; // WP-239: scope
}

/**
 * WP-135: how many films a sentence names - the params whose role is "item" that the sentence's params carry (a role for a param the step does not
 * have counts for nothing). Pure, so tests/app/js/narration_films_check.mjs can pin it under node.
 * @param {Record<string, "user" | "item"> | null | undefined} roles
 * @param {Record<string, unknown>} params
 * @returns {number}
 */
export function countFilms(roles, params) {
  return Object.keys(roles ?? {}).filter((name) => roles?.[name] === "item" && name in params).length;
}

/**
 * WP-159: how many film NAMES the translated sentence draws - a film the sentence names twice is two names, two boxes in the strip's two lines (the BPR triple: "A but
 * not B ... pushes A above B"). `countFilms` counts the params; the clamp's share of the line (`--films`) follows the names, or four boxes of 47 % each filled three lines.
 * Counted on the sentence the translator wrote (a marker in place of each film's param, as `linkedText` does), so the word order of EN / TR decides, not the key.
 * @param {Record<string, "user" | "item"> | null | undefined} roles
 * @param {Record<string, unknown>} params
 * @param {(key: string, params?: Record<string, unknown>) => string} t
 * @param {string} key
 * @returns {number}
 */
export function countFilmMentions(roles, params, t, key) {
  const names = Object.keys(roles ?? {}).filter((name) => roles?.[name] === "item" && name in params);
  if (!names.length) return 0;
  const marked = { ...params };
  for (const name of names) marked[name] = `\u0001${name}\u0002`;
  return (t(key, marked).match(/\u0001\w+\u0002/g) ?? []).length;
}

/**
 * WP-109 (10): the player strip is never empty. Before a pair is chosen there is no trace to narrate, so the strip shows what the walk will
 * open with - the "Setup" pill and one sentence that says what to do - and no chips; the page skeleton below stays where it is.
 * @param {HTMLElement} root
 * @param {any} i18n
 */
export function showIdleNarration(root, i18n) {
  const els = buildNarration(root);
  els.phase.textContent = i18n.t("phase.setup");
  els.detail.hidden = true;
  els.text.textContent = i18n.t("trace.pick_to_start");
}

/**
 * @param {HTMLElement} root
 * @param {{i18n: any, roles?: Record<string, "user" | "item"> | null, chipRoles?: Record<string, "user" | "item"> | null, alias?: Record<string, string>, scope?: (step: any) => {chip: string, text: string, tip: string} | null}} ctx
 *   `roles` (WP-106 3b): a text param -> the role of the entity it names, so the sentence draws users and items in the app's role
 *   colours (the uCF / iCF pages); `chipRoles`: the same for the value chips of the strip (`user`, `item`); WP-233: `alias` - display names: a word of a text param that equals a key is
 *   written as its value (the hybrid page says CBF where the engine's sentence params say CB); WP-239: `scope` - the scope a step states (util/hybrid-scope.js), or null: a chip
 *   beside the phase pill and the same sentence at the end of the narration
 */
export function createNarration(root, ctx) {
  /** @type {Record<string, HTMLElement>} */
  let els = {};

  function build() {
    els = buildNarration(root);
  }

  return {
    reset() {
      build();
    },
    /** @param {import("./trace-player.js").Frame} frame */
    apply(frame) {
      const { step, phase } = frame;
      els.phase.textContent = phase ? ctx.i18n.t(phase.label_key) : "";
      els.detail.textContent = step.detail === "full" ? "" : ctx.i18n.t(`player.detail_${step.detail}`);
      els.detail.hidden = step.detail === "full";
      // WP-135: a sentence that names two films or more (iCF: "<film> and <film> share 4 raters") is clamped to two lines by the strip; written as plain text
      // its second title - and the year that ends it - fell onto the third line and was cut. Such a sentence writes each name as a clamped title (the NAME gives
      // way with an ellipsis, the "(Year)" stays: util/title-clamp.js) and `is-clamped` + `--films` let trace.css give every film its share of the line. A
      // sentence with one film (or none) flows as text: a long title is allowed to wrap over the two lines.
      const params = fmtParams(step.text_params);
      if (ctx.alias) {
        // WP-233: the page's own names for the engine's (CB -> CBF): whole words only, in the text params ("blending 4 recommenders (uCF, iCF, MF, CB)")
        for (const [k, v] of Object.entries(params)) {
          if (typeof v !== "string") continue;
          params[k] = Object.entries(ctx.alias).reduce((text, [from, to]) => (from === to ? text : text.replace(new RegExp(`\\b${from}\\b`, "g"), to)), v);
        }
      }
      const films = countFilmMentions(ctx.roles, params, (k, p) => ctx.i18n.t(k, p), step.text_key); // WP-159: the names drawn, not the params carried
      els.text.classList.toggle("is-clamped", films >= 2);
      els.text.style.setProperty("--films", String(films));
      // WP-96: a user named in the sentence is a link when the server tagged the param (handles mode)
      els.text.replaceChildren(
        linkedText((k, p) => ctx.i18n.t(k, p), step.text_key, params, step.param_links, "profile_url", ctx.roles ?? null, { clamp: films >= 2 })
      );
      // WP-239: a step that makes a choice says for whom: the short form in a chip (its tip: the sentence, and what the literature does instead), the sentence itself ends the narration
      const scope = ctx.scope ? ctx.scope(step) : null;
      els.scope.hidden = !scope;
      els.scope.textContent = scope?.chip ?? "";
      els.scope.title = scope?.tip ?? "";
      if (scope) {
        const sentence = document.createElement("span");
        sentence.className = "narration-scope";
        sentence.textContent = scope.text;
        els.text.append(" ", sentence);
      }
      els.text.title = els.text.textContent ?? ""; // WP-105: the player strip clamps the sentence to two lines; the full text is the tooltip
      if (step.warn_key) {
        els.warn.hidden = false;
        els.warn.textContent = ctx.i18n.t(step.warn_key);
      } else {
        els.warn.hidden = true;
      }
      els.strip.innerHTML = "";
      for (const [k, v] of Object.entries(step.values || {})) {
        const chip = document.createElement("span");
        chip.className = "chip";
        const role = ctx.chipRoles?.[k]; // WP-106 3b: the user's and the item's name in their role colours, the numbers stay neutral
        // WP-106 3c: the role colour says "user" / "item", so the word is not drawn any more; it stays as the chip's hover title and for
        // screen readers (the `.status-key` of a role chip is visually hidden, trace.css), in the viewer's language
        const word = role ? ctx.i18n.t(`picker.${role}`) : k;
        if (role) {
          chip.classList.add("chip-role", `chip-role-${role}`);
          chip.title = word;
        }
        const key = document.createElement("span");
        key.className = "status-key";
        key.textContent = `${word} `;
        const val = document.createElement("span");
        val.className = "num";
        val.textContent = fmt(v);
        // WP-135: the item chip names a film, and a long title made it as wide as the strip's room (a 76-character title: 400 px, which squeezed the
        // sentence of the first step to 74 px). The same rule as everywhere: the NAME shortens (ellipsis), the "(Year)" stays, the full title is the
        // chip's hover title; trace.css caps the chip's width. The user chip is left as it was.
        if (role === "item") {
          fillClampedTitle(val, fmt(v));
          chip.title = `${word}: ${fmt(v)}`;
        }
        chip.append(key, val);
        els.strip.appendChild(chip);
      }
    },
  };
}
