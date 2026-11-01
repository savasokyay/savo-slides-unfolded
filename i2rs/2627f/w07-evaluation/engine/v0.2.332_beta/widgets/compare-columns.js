// @ts-check
// WP-74 (D-149, D-150; brief 09 Ek 1 and Ek 2 P2; the pages `paradigms`, `trust-system` and `offline-online` of the I2RS w07 deck, storyboard §3): the mode `columns` of compare. Two or three columns side by side, each a way of doing things or a thing to
// look at, with a title, a picture and a few lines that carry a tick (a strength), a cross (a weakness) or a plain dot; the lines come press by press, and up to three footer lines (a number, a gold sentence) close the story. The mode draws the text it is
// given and never makes a claim of its own; the deck's notes and evidence records hold the sources.
//
// State 0 is empty. Four presses: a column comes in at its `press` (1 to 4) and so does each of its lines (`press` of the column unless the line names a later one: a line then rises into a column that is already there); a footer comes at its own
// `press`. The three pages of the deck are the examples:
//   paradigms        columns user study, online, offline in presses 1, 2, 3; the footer of press 4: 92 % of 117 recommender papers used offline evaluation only
//   trust-system     columns confidence and trust, robustness, scalability in presses 1, 2, 3; the footer of press 4: none of them shows in an offline evaluation table
//   offline-online   columns offline and online in presses 1 and 2; the lines of press 3 (Wide and Deep: a lower offline AUC, a better online gain) rise into them; the gold footer of press 4
//
// duration(k) = pressDuration (u = 380 ms; the tests work them out by hand; the browser reports the same): a column 100 + u, its j-th line 200 + j * 120 + u, a footer 100 + i * 200 + u. paradigms: 820 / 940 / 1060 / 480 ms.
//
// WP-93 (D-164): the page `trust-system` carries its measures' formulas and toy numbers IN the columns (the number beside the thing it measures, D-083): a line with the mark `formula` is a boxed, bold line (a formula or a worked number),
// and `density: tight` gives the columns the room a slide of five short lines each needs (a taller column, 24 px type). 1060 / 1060 / 1060 / 480 ms for the five lines of each column.
//
// Motion: opacity and transform (a rise). Nothing else.
import { h, s } from './frames.js';
import { icon } from './pictos.js';
import { formulaProblem, renderFormula } from './formula.js';
import { U, finish, frag, pressDuration, rise, scene } from './w07-common.js';

const COL = { y: 100, h: 380, gap: 45, margin: 60 };
const ICONS = ['users', 'screen', 'matrix', 'target', 'tag', 'funnel', 'magnifier', 'clipboard', 'sliders', 'bucket', 'eye', 'items'];

const FRAGMENT = { type: 'object', required: ['en'], additionalProperties: true, properties: { en: { type: 'string' }, tr: { type: 'string' } } };
const ITEM = { type: 'object', required: ['text'], additionalProperties: false, properties: { text: FRAGMENT, mark: { type: 'string', enum: ['none', 'pro', 'con', 'formula'], default: 'none' }, press: { type: 'integer', minimum: 1, maximum: 4 } } };
const COLUMN = {
  type: 'object', required: ['title', 'items'], additionalProperties: false,
  properties: { title: FRAGMENT, icon: { type: 'string', enum: ICONS, default: 'users' }, press: { type: 'integer', minimum: 1, maximum: 4, default: 1 }, items: { type: 'array', minItems: 1, maxItems: 5, items: ITEM } },
};
const FOOTER = { type: 'object', required: ['text'], additionalProperties: false, properties: { text: FRAGMENT, press: { type: 'integer', minimum: 1, maximum: 4, default: 4 }, role: { type: 'string', enum: ['plain', 'key'], default: 'plain' } } };

/** @param {string} en @param {string} tr @param {'none'|'pro'|'con'} [mark] @param {number} [press] */
const item = (en, tr, mark = 'none', press) => ({ text: frag(en, tr), mark, ...(press ? { press } : {}) });
const PARADIGMS = {
  columns: [
    { title: frag('User study', 'Kullanıcı çalışması'), icon: 'users', press: 1, items: [item('invited participants do a task', 'davet edilen katılımcılar bir görev yapar'), item('feedback before, during and after', 'geri bildirim görevden önce, görev sırasında ve sonra'), item('knowing it is a test changes the choice', 'test edildiğini bilmek seçimi etkiler', 'con')] },
    { title: frag('Online', 'Çevrimiçi'), icon: 'screen', press: 2, items: [item('real users on a live system', 'gerçek kullanıcılar, canlı sistem'), item('usually engagement or conversion', 'tipik ölçüt etkileşim ya da dönüşüm'), item('realistic', 'gerçekçi', 'pro'), item('risky, and it needs active users', 'riskli ve aktif kullanıcı ister', 'con')] },
    { title: frag('Offline', 'Çevrimdışı'), icon: 'matrix', press: 3, items: [item('past data', 'geçmiş veri'), item('safe and repeatable', 'güvenli, tekrarlanabilir', 'pro'), item('open to statistical tests', 'istatistiksel sınamaya elverişli', 'pro'), item('does not see the user\'s new reaction', 'kullanıcının yeni tepkisini görmez', 'con'), item('misleads if built wrongly', 'yanlış kurulursa yanıltır', 'con')] },
  ],
  footers: [{ text: frag('92 % of 117 recommender papers (AAAI and IJCAI, 2018 to 2019) used offline evaluation only', '117 öneri makalesinin %92\'si (AAAI ve IJCAI, 2018–2019) yalnız çevrimdışı değerlendirme kullandı'), press: 4, role: 'plain' }],
};
const TRUST = {
  density: 'tight',
  columns: [
    { title: frag('Confidence and trust', 'Emin olma ve güven'), icon: 'eye', press: 1, items: [item('confidence: the system\'s faith in its own prediction', 'emin olma: sistemin kendi tahminine inancı'), item('frac({A+}|{A+} + {A−})', 'frac({A+}|{A+} + {A−})', 'formula'), item('95% interval: A frac(97|100) · B frac(94|100)', '%95 aralık: A frac(97|100) · B frac(94|100)'), item('trust: ask the users; offline cannot measure it', 'güven: kullanıcıya sorulur, çevrimdışı ölçülmez'), item('online proxy: frac(followed|shown) = frac(60|400) = 15%', 'çevrimiçi vekil: frac(uyulan|gösterilen) = frac(60|400) = %15')] },
    { title: frag('Robustness', 'Sağlamlık'), icon: 'funnel', press: 2, items: [item('fake profiles try to push items', 'sahte profiller öğeleri öne çıkarmaya çalışır'), item('cost of an attack = fake profiles needed', 'saldırı maliyeti = gereken sahte profil sayısı'), item('mean = frac(sum of costs|successful attacks)', 'ortalama = frac(maliyetler toplamı|başarılı saldırı)', 'formula'), item('8, 12, 10 profiles: frac(8+12+10|3) = 10', '8, 12, 10 profil: frac(8+12+10|3) = 10'), item('the higher the cost, the more robust', 'maliyet ne kadar yüksekse o kadar sağlam', 'pro')] },
    { title: frag('Scalability', 'Ölçeklenebilirlik'), icon: 'bucket', press: 3, items: [item('speed and resources, measured as the data grow', 'veri büyüdükçe hız ve kaynak ölçülür'), item('throughput = frac(recommendations|second)', 'verim = frac(öneri sayısı|saniye)', 'formula'), item('frac(1,200|6 s) = 200/s; one recommendation: 40 ms', 'frac(1.200|6 s) = 200/s; bir öneri: 40 ms'), item('data ×2 → latency ×2: 20, 40, 80 ms', 'veri ×2 → gecikme ×2: 20, 40, 80 ms'), item('training time (hours are fine) and memory', 'eğitim süresi (saatler olur) ve bellek')] },
  ],
  footers: [{ text: frag('none of these shows in an offline evaluation table', 'bunlar çevrimdışı değerlendirme tablosunda görünmez'), press: 4, role: 'key' }],      // D-171: "accuracy table" became "offline evaluation table"
};
const ONLINE = {
  columns: [
    { title: frag('Offline table', 'Çevrimdışı tablo'), icon: 'matrix', press: 1, items: [item('news: "most popular" is the best strategy', 'haber önerisi: "en popüler" en iyisi', 'pro'), item('Deep: AUC 0.722, below Wide (0.726)', 'Deep: AUC 0,722, Wide\'ın (0,726) altında', 'con', 3), item('Wide & Deep: AUC 0.728', 'Wide & Deep: AUC 0,728', 'pro', 3)] },
    { title: frag('Online', 'Çevrimiçi'), icon: 'screen', press: 2, items: [item('the same strategy is the worst', 'aynı strateji en kötüsü', 'con'), item('Deep: +2.9 % online', 'Deep: çevrimiçinde +%2,9', 'pro', 3), item('Wide & Deep: +3.9 % online', 'Wide & Deep: çevrimiçinde +%3,9', 'pro', 3)] },
  ],
  footers: [{ text: frag('offline gains need online proof', 'çevrimdışı kazanç çevrimiçi kanıt ister'), press: 4, role: 'key' }],
};

/** The params of the mode `columns`, merged into compare's schema (the registry carries the whole). */
export const columnsSchema = {
  type: 'object', additionalProperties: false, title: 'columns side by side (mode columns)',
  description: '`columns` are two or three columns: a title, a picture (`icon`), the press in which the column comes in, and up to five lines (a `mark`: `pro` a tick, `con` a cross, `none` a dot, `formula` a boxed bold line for a formula or a worked number; a line comes with its column unless it names a later `press`). `density` `tight` gives five short lines a column the room (taller columns, 24 px type). `footers` are up to three lines '
    + 'under the columns (`role` `key` is the gold sentence). Texts are fragments (`en`, `tr`); the mode draws the text it is given and makes no claim of its own. '
    + 'A line may hold `frac(NUM|DEN)` (a fraction with a horizontal bar), `sqrt(BODY)` and `{A+}` (a signed quantity as one badge); a backslash makes the next character plain (engine/widgets/formula.js); a text that does not parse is refused.',
  default: PARADIGMS,
  properties: {
    columns: { type: 'array', minItems: 2, maxItems: 3, items: COLUMN, default: PARADIGMS.columns },
    footers: { type: 'array', maxItems: 3, items: FOOTER, default: PARADIGMS.footers },
    density: { type: 'string', enum: ['normal', 'tight'], default: 'normal' },
  },
};
export const columnsExamples = [{ mode: 'columns' }, { mode: 'columns', columns: TRUST }, { mode: 'columns', columns: ONLINE }];
export const columnsPresses = 4;

/**
 * What the picture needs of the params that the schema subset cannot say (empty: fine). Pure.
 * @param {any} P @returns {Array<{path: string, detail: string}>}
 */
export function columnsProblems(P) {
  /** @type {Array<{path: string, detail: string}>} */ const out = [];
  const Q = P.columns;
  /** @type {Array<{press?: number, items: Array<{press?: number}>}>} */ const cols = Q.columns;
  cols.forEach((c, i) => {
    const cp = c.press ?? 1;
    c.items.forEach((it, j) => {
      if (it.press !== undefined && it.press < cp) out.push({ path: `$.columns.columns[${i}].items[${j}].press`, detail: `is ${it.press}, before the column itself comes in (press ${cp})` });
      for (const [lang, txt] of Object.entries(/** @type {Record<string, any>} */ (it.text ?? {}))) {      // WP-93: a formula mark-up that does not parse is refused with its place
        const problem = typeof txt === 'string' ? formulaProblem(txt) : null;
        if (problem) out.push({ path: `$.columns.columns[${i}].items[${j}].text.${lang}`, detail: problem });
      }
    });
  });
  const shown = new Set([...cols.flatMap((c) => [c.press ?? 1, ...c.items.map((it) => it.press ?? c.press ?? 1)]), ...(Q.footers ?? []).map((f) => f.press ?? 4)]);
  for (let k = 1; k <= columnsPresses; k++) if (!shown.has(k)) out.push({ path: '$.columns.columns', detail: `nothing comes in at press ${k}: the mode has ${columnsPresses} presses and each must show something` });
  return out;
}

/**
 * The plan of the picture: each animated element with its press and the start of its entrance (ms; the duration is u). Pure.
 * @param {any} P the resolved params of compare @returns {Array<{key: string, k: number, start: number}>}
 */
export function columnsPlan(P) {
  const Q = P.columns;
  /** @type {Array<{key: string, k: number, start: number}>} */ const plan = [];
  /** @type {Array<{press?: number, items: Array<{press?: number}>}>} */ const cols = Q.columns;
  cols.forEach((c, i) => {
    const cp = c.press ?? 1;
    plan.push({ key: `cl:${i}`, k: cp, start: 100 });
    /** @type {Map<number, number>} */ const seen = new Map();
    c.items.forEach((it, j) => {
      const k = it.press ?? cp, n = seen.get(k) ?? 0;
      seen.set(k, n + 1);
      plan.push({ key: `it:${i}:${j}`, k, start: 200 + n * 120 });
    });
  });
  /** @type {Array<{press?: number}>} */ const footers = Q.footers ?? [];
  /** @type {Map<number, number>} */ const fseen = new Map();
  footers.forEach((f, i) => { const k = f.press ?? 4, n = fseen.get(k) ?? 0; fseen.set(k, n + 1); plan.push({ key: `ft:${i}`, k, start: 100 + n * 200 }); });
  return plan;
}

/**
 * The picture's pure functions, `frame(k)` and `timing(key, k)`, without a DOM.
 * @param {any} P the resolved params of compare
 */
export function columnsModel(P) {
  const plan = columnsPlan(P);
  const by = new Map(plan.map((e) => [e.key, e]));
  /** @param {number} k */
  const frame = (k) => new Map(plan.map((e) => /** @type {[string, Record<string, string>]} */ ([e.key, rise(k >= e.k)])));
  /** @param {string} key @returns {import('./frames.js').Timing} */
  const timing = (key) => ({ start: /** @type {{start: number}} */ (by.get(key)).start, duration: U });
  return { plan, frame, timing, n: columnsPresses, duration: (/** @type {number} */ k) => pressDuration(k, frame, timing) };
}

/**
 * The picture of the mode `columns`.
 * @param {import('./kit.js').WidgetContext} ctx @param {Record<string, any>} P the resolved params of compare
 * @returns {import('./kit.js').WidgetBuild}
 */
export function columnsBuild(ctx, P) {
  const Q = P.columns;
  const M = columnsModel(P);
  const dense = Q.density === 'tight';                                                                  // WP-93 (D-164): five short lines, formulas boxed
  const sc = scene(ctx, `mx-root cl-root${dense ? ' cl-tight' : ''}`);
  const { doc, box, put, say } = sc;
  /** @type {Array<{title: Record<string, string>, icon?: string, items: Array<{text: Record<string, string>, mark?: string}>}>} */ const cols = Q.columns;
  const geo = dense ? { y: 20, h: 470, fy: 506, fh: 78 } : { y: COL.y, h: COL.h, fy: 500, fh: 84 };
  const n = cols.length, w = Math.floor((1680 - 2 * COL.margin - (n - 1) * COL.gap) / n);
  cols.forEach((c, i) => {
    const el = h(doc, 'div', 'cl-col', { 'aria-hidden': 'true', 'data-gfx': 'border' });
    const head = h(doc, 'div', 'cl-head');
    const ic = icon(doc, /** @type {any} */ (c.icon ?? 'users'), 48); ic.classList.add('cl-icon');
    head.append(ic, say(h(doc, 'div', 'cl-title'), c.title));
    el.append(head);
    const list = h(doc, 'div', 'cl-list');
    c.items.forEach((it, j) => {
      const row = h(doc, 'div', `cl-item cl-${it.mark ?? 'none'}`);
      // WP-93 (the user's w07 review, page 8): a line may hold frac(num|den), sqrt(body) and {A+} badges (formula.js); a line without them is untouched
      const line = say(h(doc, 'span', 'cl-text'), it.text);
      renderFormula(doc, line);
      if (it.mark === 'formula') row.append(line);
      else row.append(mark(doc, /** @type {'none'|'pro'|'con'} */ (it.mark ?? 'none')), line);
      put(`it:${i}:${j}`, row, '', list);
    });
    el.append(list);
    put(`cl:${i}`, el, box(COL.margin + i * (w + COL.gap), geo.y, w, geo.h));
  });
  /** @type {Array<{text: Record<string, string>, role?: string}>} */ const footers = Q.footers ?? [];
  const fw = footers.length ? Math.floor((1680 - 2 * COL.margin - (footers.length - 1) * 30) / footers.length) : 0;
  footers.forEach((f, i) => put(`ft:${i}`, say(h(doc, 'div', `cl-foot${f.role === 'key' ? ' cl-gold' : ''}`, f.role === 'key' ? { 'data-role': 'key' } : {}), f.text), box(COL.margin + i * (fw + 30), geo.fy, fw, geo.fh)));
  return finish(ctx, sc, M.n, M.frame, M.timing);
}

/** A tick (a strength), a cross (a weakness) or a dot (neither), in currentColor. @param {Document} doc @param {'none'|'pro'|'con'} kind */
function mark(doc, kind) {
  const sv = s(doc, 'svg', { class: `cl-mark cl-mark-${kind}`, width: '30', height: '30', viewBox: '0 0 34 34', 'aria-hidden': 'true' });
  if (kind === 'pro') sv.append(s(doc, 'path', { d: 'M6 18l8 8 14-16' }));
  else if (kind === 'con') sv.append(s(doc, 'path', { d: 'M8 8l18 18M26 8L8 26' }));
  else sv.append(s(doc, 'circle', { cx: '17', cy: '17', r: '5' }));
  return sv;
}
