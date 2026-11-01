// @ts-check
// WP-98 (phase A, revised by A2): the rater profile - a radar of six scores plus the chips of what stands out
// (docs/rater-types.md §1, §2, §4, §5). The API gives `traits {axes, raw?, chips, dominant}` on a user's detail;
// `normalizeTraits` is the one place that reads it, and returns null when it is absent or has no axis we know
// (a server without the `traits:` thresholds, a static bundle) - the caller then draws nothing.
//
// Drawing rules (the instructor's decisions, WP-98):
//   * the spokes run clockwise from the top in the FIXED order Activity, Generosity, Spread, Mainstream,
//     Agreement, Diversity - never data-dependent, so a profile always has the same shape language;
//   * A2: nothing is ranked against classmates. A5: a spoke's length is the server's `axes` value - how far the score
//     is from the middle of the typical band, in band units (the middle 0, each cut-off 50, the outer anchors 100):
//     a short hexagon is a typical rater, a long spoke a distinctive one in EITHER direction. The one guide ring is
//     50 (the cut-offs: a chip begins there; a stronger stroke, no legend) and 100 the rim; a `null` axis (too
//     little data) goes to the centre with a hollow dot - never a filler midpoint. The direction is NOT the length:
//     it is the word beside the value and its colour (below);
//   * the corner label is the axis name and, when the API sends `traits.raw`, the RAW score with its unit
//     (`-0.62 ★`) on a second line, followed - beyond a cut-off, i.e. when the axis' word is among `traits.chips` - by
//     that direction word in the axis colour's low-end / high-end tone (harsh maroon, generous amber ...); inside the
//     band only the value shows. Without `raw` the corner is the name alone. The tooltip is the definition sentence
//     (`cohort.trait.tip.<axis>`) and, with `raw`, " - value: b_u = -0.62 stars (harsh <= -0.50, generous >= +0.50)"; the
//     Mainstream tooltip adds the two film counts behind the ratio (`traits.counts`) and where "popular" comes from
//     (`traits.source`, with `/api/meta` `traits.popular_top_share`); the cut-offs are the dataset's
//     (`traits.cutoffs`: one of them is pooled over the data), the chip words, the unit keys and the tooltip keys come
//     from `/api/meta` `traits` - never from this file;
//   * the chart is `width` px wide (the card passes the rating histogram's width) and about 0.6 x that tall:
//     the hexagon is as large as the corner labels allow;
//   * two series (the compare view) share one hexagon: A navy, B maroon, 30 % fills; corner labels then carry
//     the axis name only and the values move into the hover titles.
// Colours are tokens (cohort.css), so the dark theme is free.

const SVG_NS = "http://www.w3.org/2000/svg";

/** The six spokes, clockwise from the top (docs/rater-types.md §2). */
export const TRAIT_AXES = ["activity", "generosity", "spread", "mainstream", "agreement", "diversity"];

/**
 * The axis a chip word belongs to - only for its colour and tooltip. The source is `/api/meta` `traits.words`
 * ({@link wordAxis}); this table is the fallback of a server that sends no meta, and it still knows the legacy
 * percentile word "extreme". A word that is in neither (a composite such as "selective", or "polarised") gets the
 * neutral colour.
 * @type {Record<string, string>}
 */
const WORD_AXIS = {
  light: "activity",
  heavy: "activity",
  harsh: "generosity",
  generous: "generosity",
  narrow: "spread",
  wide: "spread",
  extreme: "spread",
  niche: "mainstream",
  mainstream: "mainstream",
  blockbuster: "mainstream", // A5: the high word of Mainstream
  grey_sheep: "agreement",
  consensual: "agreement",
  focused: "diversity",
  omnivore: "diversity",
};

/**
 * Which end of its axis a chip word is, for the colour tone - only the fallback of a server that sends no meta
 * ({@link wordEnd} reads `/api/meta` `traits.words` first).
 * @type {Record<string, "low" | "high">}
 */
const WORD_END = {
  light: "low",
  heavy: "high",
  harsh: "low",
  generous: "high",
  narrow: "low",
  wide: "high",
  extreme: "high",
  niche: "low",
  mainstream: "high",
  blockbuster: "high",
  grey_sheep: "low",
  consensual: "high",
  focused: "low",
  omnivore: "high",
};

/**
 * The first (percentile-scheme) API called the high word of Spread "extreme"; A2 renamed it - show the new word.
 * @type {Record<string, string>}
 */
const LEGACY_WORD = { extreme: "wide" };

/**
 * How a score is written - presentation only, never a threshold: decimals, a forced "+" (a signed bias) and a
 * factor (Mainstream is a ratio 0-1, written as a percent). The evenness unit (Diversity) takes 3 decimals: its
 * omnivore cut-off is the dataset's pooled evenness (a number such as 0.869 that a user can sit a hair under), the
 * other units take 2 (counts and percents none).
 * @type {Record<string, {decimals: number, sign?: boolean, factor?: number}>}
 */
const SCORE_FORMAT = {
  activity: { decimals: 0 },
  generosity: { decimals: 2, sign: true },
  spread: { decimals: 2 },
  mainstream: { decimals: 0, factor: 100 },
  agreement: { decimals: 2 },
  diversity: { decimals: 3 }, // WP-98: evenness
};

const HEIGHT_RATIO = 0.6; // chart height / width
const FONT_PX = 11; // corner labels
const LINE_PX = FONT_PX + 1; // the second label line (the value) sits one line lower
const CHAR_PX = 6.2; // average glyph width at FONT_PX (Segoe UI) - sizes the room the side labels take when no canvas can measure
const WORD_GAP_PX = 4; // between a corner's value and its direction word (the tspan's dx)
const LABEL_GAP_PX = 6; // between a vertex and its label
const BAND_PX = FONT_PX + 8; // the label band above the top vertex / below the bottom one (one line incl. descent)
const RINGS = [50, 100]; // gridlines on the 0-100 spoke scale (A5): 50 is the guide ring, 100 the rim
const GUIDE_RINGS = [50]; // the cut-offs, where a chip begins (docs/rater-types.md §1b)
const NULL_DOT_FRACTION = 0.14; // where the hollow dot of a null axis sits on its spoke (0 = centre, 1 = rim)
const DOT_R = 3;

/**
 * @typedef {{low: number, high: number}} Cutoffs the two cut-offs of an axis, in its unit
 * @typedef {{
 *   axes: (number | null)[], raw: (number | null)[] | null, cutoffs: Record<string, Cutoffs> | null,
 *   chips: string[], dominant: string | null,
 *   counts: {popular: number, longTail: number} | null, source: Record<string, string> | null
 * }} Traits
 *   `axes` (spoke lengths, 0-100: the distance from the typical band) and `raw` (the scores in their units) are in
 *   {@link TRAIT_AXES} order; `raw` and `cutoffs` (the dataset's cut-offs; one of them is pooled over the data) are null
 *   when the API did not send them; `counts` (A5: the popular / long-tail films behind a Mainstream ratio) and `source`
 *   (A4: where "popular" comes from, per axis) likewise
 */

/**
 * @typedef {{
 *   units: Record<string, string>,
 *   words: Record<string, {low: string, high: string}>,
 *   tooltipKeys: Record<string, string>,
 *   popularShare: number | null
 * }} TraitsMeta
 *   the fixed part of `/api/meta` `traits`: per axis the unit key (films, stars, ratio, corr, evenness) and the two
 *   chip words, the i18n key of every tooltip (axes, the extra chip, the composites), and (A4) the share of items that
 *   count as popular (0.2) that the Mainstream tooltip prints
 */

/** @param {unknown} v @returns {number | null} */
function finiteOrNull(v) {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/**
 * The dataset's cut-offs in a user's `traits` (`cutoffs[axis] = {low, high}`, in the axis' unit), or null when the
 * API sent none (the legacy percentile scheme) or not one complete pair.
 * @param {any} raw
 * @returns {Record<string, Cutoffs> | null}
 */
function readCutoffs(raw) {
  if (!raw || typeof raw !== "object") return null;
  /** @type {Record<string, Cutoffs>} */
  const out = {};
  for (const axis of TRAIT_AXES) {
    const c = raw[axis];
    if (c && Number.isFinite(c.low) && Number.isFinite(c.high)) out[axis] = { low: Number(c.low), high: Number(c.high) };
  }
  return Object.keys(out).length ? out : null;
}

/**
 * The two film counts behind a Mainstream ratio (A5), or null when the API sent none (no ratio, an older server).
 * @param {any} raw
 * @returns {{popular: number, longTail: number} | null}
 */
function readCounts(raw) {
  if (!raw || typeof raw !== "object") return null;
  const popular = finiteOrNull(raw.popular);
  const longTail = finiteOrNull(raw.long_tail);
  return popular !== null && longTail !== null && popular >= 0 && longTail >= 0 ? { popular, longTail } : null;
}

/**
 * Where the dataset-bound quantities come from, per axis (A4: `{mainstream: "tmdb_votes" | "dataset"}`), or null.
 * @param {any} raw
 * @returns {Record<string, string> | null}
 */
function readSource(raw) {
  if (!raw || typeof raw !== "object") return null;
  /** @type {Record<string, string>} */
  const out = {};
  for (const [axis, value] of Object.entries(raw)) if (typeof value === "string") out[axis] = value;
  return Object.keys(out).length ? out : null;
}

/**
 * The API's `traits` as the drawing wants it, or null when there is nothing to draw.
 * @param {any} raw
 * @returns {Traits | null}
 */
export function normalizeTraits(raw) {
  if (!raw || typeof raw !== "object" || !raw.axes || typeof raw.axes !== "object") return null;
  if (!TRAIT_AXES.some((axis) => axis in raw.axes)) return null;
  const scores = raw.raw && typeof raw.raw === "object" ? raw.raw : null;
  return {
    axes: TRAIT_AXES.map((axis) => {
      const v = finiteOrNull(raw.axes[axis]);
      return v === null ? null : Math.min(100, Math.max(0, v));
    }),
    raw: scores ? TRAIT_AXES.map((axis) => finiteOrNull(scores[axis])) : null,
    cutoffs: readCutoffs(raw.cutoffs),
    chips: Array.isArray(raw.chips) ? raw.chips.map(String) : [],
    dominant: typeof raw.dominant === "string" ? raw.dominant : null,
    counts: readCounts(raw.counts), // WP-98 (A5)
    source: readSource(raw.source), // WP-98 (A4)
  };
}

/**
 * The fixed part of `/api/meta` `traits`, read defensively (an older server has none: the corner then shows the bare
 * number and the chips use the fallback table). Null when nothing usable is there.
 * @param {any} raw
 * @returns {TraitsMeta | null}
 */
export function normalizeTraitsMeta(raw) {
  if (!raw || typeof raw !== "object") return null;
  const share = finiteOrNull(raw.popular_top_share);
  /** @type {TraitsMeta} */
  const meta = { units: {}, words: {}, tooltipKeys: {}, popularShare: share !== null && share > 0 && share < 1 ? share : null };
  for (const axis of TRAIT_AXES) {
    const unit = raw.units?.[axis];
    if (typeof unit === "string") meta.units[axis] = unit;
    const w = raw.words?.[axis];
    if (w && typeof w.low === "string" && typeof w.high === "string") meta.words[axis] = { low: w.low, high: w.high };
  }
  if (raw.tooltip_keys && typeof raw.tooltip_keys === "object") {
    for (const [key, value] of Object.entries(raw.tooltip_keys)) if (typeof value === "string") meta.tooltipKeys[key] = value;
  }
  return Object.keys(meta.units).length || Object.keys(meta.words).length ? meta : null;
}

/** @type {Record<string, CanvasRenderingContext2D | null>} one 2D context per font weight, made on first use */
const measurers = {};

/**
 * The width of a corner text in px: measured with the page's font when a canvas is there (the direction words widen
 * the value line, and a guess per character made the hexagon needlessly small), else {@link CHAR_PX} per character.
 * @param {string} text
 * @param {boolean} bold the value line and the direction word are bold, the axis name is not
 * @returns {number}
 */
function textWidth(text, bold) {
  const weight = bold ? "700" : "400";
  try {
    if (!(weight in measurers)) {
      const c = document.createElement("canvas").getContext("2d");
      if (c) c.font = `${weight} ${FONT_PX}px ${getComputedStyle(document.body).fontFamily}`;
      measurers[weight] = c;
    }
    const c = measurers[weight];
    if (c) return c.measureText(text).width;
  } catch {
    /* no DOM / no canvas: the estimate below */
  }
  return text.length * CHAR_PX;
}

/**
 * Where a spoke is: `index` 0 is straight up, then 60 degrees clockwise per spoke.
 * @param {number} index spoke 0..5
 * @param {number} fraction 0 = centre, 1 = rim
 * @param {number} cx
 * @param {number} cy
 * @param {number} radius the rim, px
 * @returns {{x: number, y: number}}
 */
export function spokePoint(index, fraction, cx, cy, radius) {
  const angle = ((-90 + 60 * index) * Math.PI) / 180;
  return { x: cx + radius * fraction * Math.cos(angle), y: cy + radius * fraction * Math.sin(angle) };
}

/**
 * True when no axis could be computed (a user with too few ratings for any score) - the radar then stays an
 * empty hexagon and the caller says why.
 * @param {{axes: (number | null)[]}} traits
 */
export function isEmptyProfile(traits) {
  return traits.axes.every((v) => v === null);
}

/**
 * A score as text, in the axis' own unit (without the unit's word): "-0.62", "128", "79".
 * @param {string} axis
 * @param {number} value the raw score (Mainstream: the ratio 0-1)
 * @returns {string}
 */
export function formatScore(axis, value) {
  const f = SCORE_FORMAT[axis] ?? { decimals: 2 };
  const x = value * (f.factor ?? 1);
  const digits = Math.abs(x).toFixed(f.decimals);
  const zero = Number(digits) === 0;
  return `${x < 0 && !zero ? "−" : f.sign && !zero ? "+" : ""}${digits}`;
}

/** @typedef {(key: string, params?: Record<string, unknown>) => string} Translate */

/**
 * The axis a chip word belongs to: from the meta's words when it has them, else the fallback table, else null.
 * @param {string} word
 * @param {TraitsMeta | null} meta
 * @returns {string | null}
 */
function wordAxis(word, meta) {
  for (const [axis, w] of Object.entries(meta?.words ?? {})) if (w.low === word || w.high === word) return axis;
  return WORD_AXIS[word] ?? null;
}

/**
 * Which end of its axis a chip word is (the colour tone): from the meta's words when it has them, else the fallback
 * table, else null.
 * @param {string} word
 * @param {TraitsMeta | null} meta
 * @returns {"low" | "high" | null}
 */
function wordEnd(word, meta) {
  for (const w of Object.values(meta?.words ?? {})) {
    if (w.low === word) return "low";
    if (w.high === word) return "high";
  }
  return WORD_END[word] ?? null;
}

/**
 * The direction word an axis shows beside its value: the axis' low or high word when it is among the user's `chips`
 * (the server's call, so the word and the chip are one decision), else null - inside the typical band only the value
 * shows. Needs the meta's words.
 * @param {string} axis
 * @param {string[] | null | undefined} chips
 * @param {TraitsMeta | null} meta
 * @returns {{word: string, end: "low" | "high"} | null}
 */
export function directionWord(axis, chips, meta) {
  const w = meta?.words[axis];
  if (!w || !chips) return null;
  if (chips.includes(w.high)) return { word: w.high, end: "high" };
  if (chips.includes(w.low)) return { word: w.low, end: "low" };
  return null;
}

/**
 * A chip word as the user reads it (`cohort.trait.word.<word>`); the legacy percentile word "extreme" shows as "wide".
 * @param {string} word
 * @param {Translate} t
 * @returns {string}
 */
function wordLabel(word, t) {
  const key = `cohort.trait.word.${LEGACY_WORD[word] ?? word}`;
  const label = t(key);
  return label === key ? (LEGACY_WORD[word] ?? word).replace(/_/g, " ") : label;
}

/**
 * WP-115 (14): what a rater-type WORD means, in full (`cohort.trait.word_tip.<word>`: the label in a sentence, the rule in words, how it reads in class, where
 * the word comes from) - not the axis' sentence, which says what is measured.
 * @param {string} word
 * @param {Translate} t
 * @returns {string} "" when the catalogue has none
 */
export function wordTip(word, t) {
  const key = `cohort.trait.word_tip.${LEGACY_WORD[word] ?? word}`;
  const text = t(key);
  return text === key ? "" : text;
}

/**
 * WP-115 (14): a hover with the word's own tip first and the axis' sentence (the definition, the user's value, the cut-offs) after it, as two paragraphs; either alone
 * when the other is missing.
 * @param {string} own
 * @param {string} sentence
 * @returns {string}
 */
export function withWordTip(own, sentence) {
  return own && sentence ? `${own}\n\n${sentence}` : own || sentence;
}

/**
 * The i18n key of a tooltip: the server's `tooltip_keys` when it sends them, else `cohort.trait.tip.<key>`.
 * @param {string} key an axis, the extra chip or a composite
 * @param {TraitsMeta | null} meta
 * @returns {string}
 */
function tipKey(key, meta) {
  return meta?.tooltipKeys[key] ?? `cohort.trait.tip.${key}`;
}

/**
 * A score as the corner writes it: the number with its unit (`cohort.trait.unit.<unit>`, the unit key being the
 * server's); without the meta's unit, the bare number.
 * @param {string} axis
 * @param {number} value
 * @param {Translate} t
 * @param {TraitsMeta | null} meta
 * @returns {string}
 */
export function cornerText(axis, value, t, meta) {
  const text = formatScore(axis, value);
  const unit = meta?.units[axis];
  if (!unit) return text;
  const key = `cohort.trait.unit.${unit}`;
  const out = t(key, { value: text });
  return out === key ? text : out;
}

/**
 * A whole number grouped in thousands with a no-break space ("1 203"), the same in both languages.
 * @param {number} n
 * @returns {string}
 */
export function thousands(n) {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, "\u00a0");
}

/**
 * The Mainstream tooltip's extra part (A4 / A5): the two film counts behind the ratio and where "popular" comes from
 * ("1 203 popular films, 4 300 long-tail films rated · popular = TMDB top 20 %"); parts the API did not send (or the
 * meta has no share for) are left out. Empty for every other axis.
 * @param {string} axis
 * @param {Translate} t
 * @param {{counts?: {popular: number, longTail: number} | null, source?: Record<string, string> | null} | undefined} extra
 * @param {TraitsMeta | null} meta
 * @returns {string}
 */
function popularityNote(axis, t, extra, meta) {
  if (axis !== "mainstream" || !extra) return "";
  const parts = [];
  if (extra.counts) {
    parts.push(t("cohort.trait.counts", { popular: thousands(extra.counts.popular), long_tail: thousands(extra.counts.longTail) }));
  }
  const origin = extra.source?.mainstream;
  if (origin && meta?.popularShare != null) {
    const key = `cohort.trait.source.${origin}`;
    const text = t(key, { share: Math.round(meta.popularShare * 100) });
    if (text !== key) parts.push(text);
  }
  return parts.join(" · ");
}

/**
 * "harsh ≤ −0.50, generous ≥ +0.50" - the two cut-offs of an axis with the axis' two chip words, or "" when the API
 * sent no cut-offs (or no meta, hence no words).
 * @param {string} axis
 * @param {Translate} t
 * @param {Record<string, Cutoffs> | null} cutoffs the user's `traits.cutoffs`
 * @param {TraitsMeta | null} meta
 * @returns {string}
 */
function cutText(axis, t, cutoffs, meta) {
  const c = cutoffs?.[axis];
  const w = meta?.words[axis];
  if (!c || !w) return "";
  return t(`cohort.trait.cut.${axis}`, {
    lowWord: wordLabel(w.low, t),
    highWord: wordLabel(w.high, t),
    low: formatScore(axis, c.low),
    high: formatScore(axis, c.high),
  });
}

/**
 * The tooltip of an axis: the definition sentence and - when the API sent the user's raw score - the value with
 * its unit and the cut-offs: "... - value: b_u = −0.62 stars (harsh ≤ −0.50, generous ≥ +0.50)".
 * @param {string} axis
 * @param {Translate} t
 * @param {number | null | undefined} raw undefined: the API sent no `raw` (the definition only); null: not computable
 * @param {Record<string, Cutoffs> | null} cutoffs the user's `traits.cutoffs`
 * @param {TraitsMeta | null} meta
 * @param {{counts?: {popular: number, longTail: number} | null, source?: Record<string, string> | null}} [extra] the
 *   user's `traits.counts` / `traits.source`: the Mainstream tooltip prints them (WP-98 A4 / A5)
 * @returns {string}
 */
export function axisTip(axis, t, raw, cutoffs, meta, extra) {
  const sentence = t(tipKey(axis, meta));
  if (raw === undefined) return sentence;
  const label = t("cohort.trait.value");
  if (raw === null) return `${sentence} — ${label}: ${t("cohort.trait.no_data")}`;
  const cut = cutText(axis, t, cutoffs, meta);
  const value = t(`cohort.trait.raw.${axis}`, { value: formatScore(axis, raw) });
  const note = popularityNote(axis, t, extra, meta);
  return `${sentence} — ${label}: ${value}${cut ? ` (${cut})` : ""}${note ? ` · ${note}` : ""}`;
}

/**
 * @param {string} tag
 * @param {Record<string, string | number>} attrs
 * @param {Element} [parent]
 * @returns {SVGElement}
 */
function svgEl(tag, attrs, parent) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  if (parent) parent.appendChild(node);
  return /** @type {SVGElement} */ (node);
}

/** @param {{x: number, y: number}[]} points */
function polyPoints(points) {
  return points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
}

/**
 * The radar.
 * @param {{axes: (number | null)[], raw?: (number | null)[] | null, cutoffs?: Record<string, Cutoffs> | null,
 *   chips?: string[] | null, counts?: {popular: number, longTail: number} | null, source?: Record<string, string> | null,
 *   tone: "a" | "b"}[]} series one profile, or two for the compare view; `raw` (the scores in their units) is what
 *   the corner labels and tooltips print, `cutoffs` (the dataset's, the same for both) what the tooltips add, `chips`
 *   decide which direction word a single profile's corner shows, `counts` / `source` the Mainstream tooltip's note
 * @param {{t: Translate, width: number, meta?: TraitsMeta | null}} opts
 * @returns {SVGSVGElement}
 */
export function traitRadar(series, { t, width, meta = null }) {
  const height = Math.round(width * HEIGHT_RATIO);
  const single = series.length === 1;
  const names = TRAIT_AXES.map((axis) => t(`cohort.trait.axis.${axis}`));
  /** @param {{raw?: (number | null)[] | null}} s @param {number} i @returns {number | null | undefined} */
  const rawAt = (s, i) => (s.raw ? s.raw[i] : undefined);
  /** a raw score as the corner writes it (value and unit), "—" when it could not be computed */
  const corner = (/** @type {number} */ i, /** @type {number | null} */ v) =>
    v === null ? "—" : cornerText(TRAIT_AXES[i], v, t, meta);
  /** the same for speech and hover titles: the words "not enough data" instead of a dash */
  const spokenValue = (/** @type {number} */ i, /** @type {number | null} */ v) => (v === null ? t("cohort.trait.no_data") : corner(i, v));
  // the corner's second line (the value) exists only for a single profile whose API sent `raw`
  const values = TRAIT_AXES.map((_, i) => {
    const v = single ? rawAt(series[0], i) : undefined;
    return v === undefined ? "" : corner(i, v);
  });
  const lines = values[0] === "" ? 1 : 2;
  // A5: beyond a cut-off the corner's value line goes on with the direction word (the axis' low or high word that is
  // among the user's chips), in the axis colour's tone for that end; only a single profile with values has them
  const dirs = TRAIT_AXES.map((axis) => (single && lines === 2 ? directionWord(axis, series[0].chips, meta) : null));
  // the room a side label takes is reserved for the axis' LONGEST word whether or not this user has one, so the
  // hexagon does not change size from one user to the next
  const wordRoom = TRAIT_AXES.map((axis) => {
    const w = single && lines === 2 && series[0].chips ? meta?.words[axis] : null;
    return w ? WORD_GAP_PX + Math.max(textWidth(wordLabel(w.low, t), true), textWidth(wordLabel(w.high, t), true)) : 0;
  });

  // the hexagon is as big as the room allows: vertically the label bands above and below, horizontally the
  // widest of the four side labels (spokes 1, 2, 4, 5 sit at 30 degrees off the horizontal)
  const cx = width / 2;
  const cy = height / 2;
  const band = BAND_PX + (lines - 1) * LINE_PX;
  const fitV = (height - 2 * band) / 2;
  const widest = Math.max(
    ...[1, 2, 4, 5].map((i) => Math.max(textWidth(names[i], false), values[i] === "" ? 0 : textWidth(values[i], true) + wordRoom[i]))
  );
  const fitH = (width / 2 - LABEL_GAP_PX - widest) / Math.cos(Math.PI / 6);
  const radius = Math.max(24, Math.floor(Math.min(fitV, fitH)));

  const svg = /** @type {SVGSVGElement} */ (
    svgEl("svg", { class: "trait-radar", viewBox: `0 0 ${width} ${height}`, width, height, role: "img" })
  );
  // the accessible name lists the axes (and, when the API sent them, the values in their units) - no ranks
  /** @param {number} i the values of every series on axis `i`, or null when the API sent no `raw` for one of them */
  const seriesValues = (i) => {
    const all = series.map((s) => rawAt(s, i));
    return all.some((v) => v === undefined) ? null : all.map((v) => spokenValue(i, /** @type {number | null} */ (v)));
  };
  const spoken = names.map((name, i) => {
    const vals = seriesValues(i);
    const d = dirs[i];
    const dir = d ? ` (${wordLabel(d.word, t)})` : ""; // A5: the direction is a word, so speech gets it too
    return vals ? `${name} ${vals.join(" / ")}${dir}` : name;
  });
  svg.setAttribute("aria-label", `${t("cohort.trait.aria")}: ${spoken.join(", ")}`);

  const rim = (/** @type {number} */ f) => TRAIT_AXES.map((_, i) => spokePoint(i, f, cx, cy, radius));
  for (const ring of [...RINGS].reverse()) {
    const cls = ring === 100 ? "tr-ring tr-rim" : GUIDE_RINGS.includes(ring) ? "tr-ring tr-guide" : "tr-ring";
    svgEl("polygon", { class: cls, points: polyPoints(rim(ring / 100)) }, svg);
  }
  for (let i = 0; i < TRAIT_AXES.length; i += 1) {
    const end = spokePoint(i, 1, cx, cy, radius);
    svgEl("line", { class: "tr-spoke", x1: cx, y1: cy, x2: end.x.toFixed(1), y2: end.y.toFixed(1) }, svg);
  }

  for (const s of series) {
    if (isEmptyProfile(s)) continue; // an empty hexagon, not a polygon collapsed into the centre
    const arms = s.axes.map((v, i) => spokePoint(i, v === null ? 0 : v / 100, cx, cy, radius));
    svgEl("polygon", { class: `tr-area ${s.tone}`, points: polyPoints(arms) }, svg);
    s.axes.forEach((v, i) => {
      const at = v === null ? spokePoint(i, NULL_DOT_FRACTION, cx, cy, radius) : arms[i];
      svgEl(
        "circle",
        { class: `tr-dot ${s.tone}${v === null ? " tr-null" : ""}`, cx: at.x.toFixed(1), cy: at.y.toFixed(1), r: DOT_R },
        svg
      );
    });
  }

  TRAIT_AXES.forEach((axis, i) => {
    const vertex = spokePoint(i, 1, cx, cy, radius);
    const top = i === 0;
    const bottom = i === 3;
    const right = i === 1 || i === 2;
    const x = top || bottom ? vertex.x : vertex.x + (right ? LABEL_GAP_PX : -LABEL_GAP_PX);
    // the baseline of the first line: a two-line label grows upwards at the top, downwards at the bottom and
    // around the vertex at the sides
    const y = top
      ? vertex.y - LABEL_GAP_PX - (lines - 1) * LINE_PX
      : bottom
        ? vertex.y + LABEL_GAP_PX + FONT_PX - 2
        : vertex.y + 4 - ((lines - 1) * LINE_PX) / 2;
    const text = svgEl(
      "text",
      { class: "tr-label", x: x.toFixed(1), y: y.toFixed(1), "text-anchor": top || bottom ? "middle" : right ? "start" : "end" },
      svg
    );
    text.appendChild(document.createTextNode(names[i]));
    if (lines === 2) {
      const val = svgEl("tspan", { class: `tr-val${series[0].raw?.[i] == null ? " tr-none" : ""}`, x: x.toFixed(1), dy: LINE_PX }, text);
      val.appendChild(document.createTextNode(values[i]));
      const dir = dirs[i];
      if (dir) {
        const word = svgEl("tspan", { class: `tr-word tr-${axis} tone-${dir.end}`, dx: WORD_GAP_PX }, val);
        word.textContent = wordLabel(dir.word, t);
      }
    }
    const title = svgEl("title", {}, text);
    if (single) {
      // WP-115 (14): a corner that shows a direction word says what the word means first, then the axis' sentence with the value
      const dir = dirs[i];
      title.textContent = withWordTip(dir ? wordTip(dir.word, t) : "", axisTip(axis, t, rawAt(series[0], i), series[0].cutoffs ?? null, meta, series[0]));
    } else {
      // the compare view: names only in the corner, so the values (A, then B) and the definition go here
      const vals = seriesValues(i);
      const head = vals ? `${names[i]}: ${vals.join(" · ")}` : names[i];
      const cut = vals ? cutText(axis, t, series[0].cutoffs ?? null, meta) : "";
      title.textContent = [head, t(tipKey(axis, meta)), cut].filter(Boolean).join("\n");
    }
  });
  return svg;
}

/**
 * A chip with the word of what stands out (generous, wide, polarised, selective ...), coloured by its axis.
 * @param {string} word the API's chip key
 * @param {{t: Translate, traits?: Traits | null, meta?: TraitsMeta | null}} opts `traits.raw` / `traits.cutoffs`
 *   add the user's value and the cut-offs to an axis word's tooltip (`meta` supplies the words and the keys);
 *   without them it is the definition sentence only
 * @returns {HTMLElement}
 */
export function traitChip(word, { t, traits = null, meta = null }) {
  const axis = wordAxis(word, meta);
  const end = axis ? wordEnd(word, meta) : null; // A5: the colour tone of the word's end of its axis
  const chip = document.createElement("span");
  chip.className = `trait-chip tr-${axis ?? "mixed"}${end ? ` tone-${end}` : ""}`;
  chip.textContent = wordLabel(word, t);
  // WP-115 (14): the word's own tip first; an axis word then also carries the axis' sentence (what is measured, the user's value, the cut-offs)
  const own = wordTip(word, t);
  let tip = "";
  if (axis) {
    tip = withWordTip(own, axisTip(axis, t, traits?.raw ? traits.raw[TRAIT_AXES.indexOf(axis)] : undefined, traits?.cutoffs ?? null, meta, traits ?? undefined));
  } else {
    const key = tipKey(LEGACY_WORD[word] ?? word, meta);
    const text = t(key);
    tip = own || (text !== key ? text : "");
  }
  if (tip) chip.title = tip;
  return chip;
}

/**
 * The compare view's overlay: two users' radars on one hexagon with a legend and the caption "profile
 * similarity is not taste similarity". It fetches both details itself (the page owns no profile cache) and
 * stays hidden when either has no `traits`. The newest `show` wins: a slow answer for an earlier pair is dropped.
 * @param {HTMLElement} root
 * @param {{
 *   i18n: {t: (key: string, params?: Record<string, unknown>) => string},
 *   api: {user: (ds: string, index: number) => Promise<any>},
 *   width: number,
 *   traitsMeta?: () => any,
 * }} opts `width` is the card's inner width (the radar is as wide as the rating histogram); `traitsMeta` returns
 *   the `traits` block of `/api/meta` (units, words, tooltip keys) when the page has it (read at drawing time:
 *   the meta may load later)
 */
export function createTraitCompare(root, { i18n, api, width, traitsMeta }) {
  const t = (/** @type {string} */ key, /** @type {Record<string, unknown>} */ params) => i18n.t(key, params);
  let seq = 0;
  root.hidden = true;

  /** @param {string} tone @param {string} label */
  function legendItem(tone, label) {
    const item = document.createElement("span");
    item.className = "trait-legend-item";
    const swatch = document.createElement("span");
    swatch.className = `trait-swatch ${tone}`;
    swatch.setAttribute("aria-hidden", "true");
    const name = document.createElement("span");
    name.className = "trait-legend-name";
    name.textContent = label;
    name.title = label;
    item.append(swatch, name);
    return item;
  }

  return {
    /** @param {{dataset: string, a: number, b: number}} pair dense user indices */
    async show({ dataset, a, b }) {
      const mine = ++seq;
      root.hidden = true;
      root.replaceChildren();
      try {
        const [da, db] = await Promise.all([api.user(dataset, a), api.user(dataset, b)]);
        if (mine !== seq) return; // WP-97 pattern: a newer pair was asked for meanwhile
        const ta = normalizeTraits(da?.traits);
        const tb = normalizeTraits(db?.traits);
        if (!ta || !tb) return; // the server has no profiles: the overlay is left out
        const title = document.createElement("div");
        title.className = "tile-label";
        title.textContent = t("cohort.trait.compare_title");
        const legend = document.createElement("div");
        legend.className = "trait-legend";
        legend.append(legendItem("a", String(da.label ?? "")), legendItem("b", String(db.label ?? "")));
        const note = document.createElement("p");
        note.className = "card-note";
        note.textContent = t("cohort.trait.compare_note");
        root.append(
          title,
          legend,
          traitRadar(
            [
              { axes: ta.axes, raw: ta.raw, cutoffs: ta.cutoffs, tone: "a" },
              { axes: tb.axes, raw: tb.raw, cutoffs: tb.cutoffs, tone: "b" },
            ],
            { t, width, meta: normalizeTraitsMeta(traitsMeta?.()) }
          )
        );
        // a user with no profile (too few ratings for any score) is left off the hexagon; say who and why
        for (const [traits, who] of [
          [ta, da],
          [tb, db],
        ]) {
          if (!isEmptyProfile(traits)) continue;
          const why = document.createElement("p");
          why.className = "card-note";
          why.textContent = t("cohort.trait.not_enough_for", { name: String(who.label ?? "") });
          root.appendChild(why);
        }
        root.appendChild(note);
        root.hidden = false;
      } catch {
        if (mine === seq) root.hidden = true; // a failed lookup only leaves the overlay out
      }
    },
    clear() {
      seq += 1;
      root.hidden = true;
      root.replaceChildren();
    },
  };
}
