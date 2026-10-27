// @ts-check
// WP-09: the boot contract of every generated page (build brief 02, decision 3):
//   <script type="application/json" id="savo-deck">  the deck JSON of THIS page
//   <script type="module" src="<engine_base>/core/boot.js">  this file
//   <body data-savo-role="console|audience|student">
// Pages and their JSON: console.html carries the presenter JSON, audience.html the student view with target "presenter"
// (no notes), index.html the student JSON.
//
// boot validates the deck LOUDLY (error on the screen and in the console, never a silent pass) and wires one of three roles:
//   student   Player with the cut-and-go lock (D-028), router, keys. WP-12c: the stage (core/stage.js), the chrome of every slide (core/chrome-model.js + engine/chrome),
//             the display controls (D-073, core/student-controls.js) and the choices the reader made before (core/prefs.js). WP-59 (D-142): a finger or a pen
//             (core/touch.js: tap zones and swipes), the Back / Next pair and the "always show" pin of the controls, and the one-time hint of a touch screen
//   console   WP-10: the presenter console (engine/presenter/console.js): it owns the state and the lock policy (D-027), and has NO Player of
//             its own: its preview is an iframe of the audience page. Loaded only on the console page.
//   audience  WP-10: a Player that is never started and never touched by a key: engine/presenter/audience.js draws what the console says
//             (zero UI; a key becomes a request to the console). `?mode=mirror` is the console's preview frame: the same page, reduced motion.
//             WP-12c: the same stage and chrome as the student page, and no controls.
// The address `#/<slide>/<step>?lang=&theme=` is the state: opened cold it draws exactly what the presses would (plan 3.2);
// moving inside a slide replaces the history entry, changing slide pushes one, Back and a hand-edited hash redraw instantly.
// A link that cannot be read exactly is corrected AND reported in the console, never silently rewritten.
// WP-10: boot() is async because the console and audience code is imported only by the pages that need it (a student never loads it).
// WP-12c: so are the stylesheets and the chrome modules of the student and the audience page: the chrome of every slide is checked and everything the first
// picture needs is loaded BEFORE the Player exists, so no path of boot() sets `window.__savo` before boot() returns. `window.__savoBoot` is the promise of the
// whole boot: tests and tools wait for it (`window.__savo` is set just before it resolves).
import { loadDeck, resolveLang, resolveTheme, text, THEMES } from './deck.js';
import { Player } from './player.js';
import { createRouter, parseLocation } from './router.js';
import { bindKeys } from './input.js';
import { bindTouch } from './touch.js';                                     // WP-59 (D-142): the student page's tap zones and swipes
import { defaultPolicy } from './lock.js';
import { chromeModelFor, chromeProblems } from './chrome-model.js';       // WP-12c: what the strip and the footer say, and the check that every slide's chrome can be drawn
import { loadStylesheets, styleUrls } from './styles.js';                 // WP-12c: the engine loads its own stylesheets, in one place
import { mountStage } from './stage.js';                                  // WP-12c: the 1920 x 1080 box, fitted to the window
import { setCues, setTheme } from './root.js';                            // WP-12c: data-theme, data-cues and data-key-style of <html>, written the same way in every window
import { createPrefs, initialView } from './prefs.js';                    // WP-12c: the student's remembered choices

export const ROLES = Object.freeze(['console', 'audience', 'student']);
/** The deck target each role must be handed: a student build never runs a console, a console always has the notes. */
const ROLE_TARGET = Object.freeze({ console: 'presenter', audience: 'presenter', student: 'student' });
/** WP-12c: how many problems of a check the error page lists (a deck with a broken section title has one per slide and language). */
const PROBLEMS_SHOWN = 12;

/**
 * The error a failed load-time check throws: `code` and `path` for the panel, the problems listed (the first ones) in `detail`.
 * @param {string} code @param {string} path @param {string} what @param {string[]} problems
 */
function problemsError(code, path, what, problems) {
  const shown = problems.slice(0, PROBLEMS_SHOWN);
  const more = problems.length > shown.length ? [`... and ${problems.length - shown.length} more`] : [];
  return Object.assign(new Error(`${problems.length} problem(s) in ${what}`), { code, path, detail: [...shown, ...more].join('\n') });
}

/**
 * Show a failure on the page and in the console. Nothing is rendered from a deck that did not load.
 * @param {Document} doc @param {{code?: string, path?: string, detail?: string, message: string}} err
 */
export function showError(doc, err) {
  const code = err.code ?? 'boot_failed', path = err.path ?? '', detail = err.detail ?? err.message;   // DeckError carries the bare explanation in `detail`
  console.error(`[savo-slides] ${code}${path ? ' at ' + path : ''}: ${detail}`);
  const main = doc.createElement('main');
  main.setAttribute('role', 'alert');
  main.setAttribute('data-savo-error', code);
  main.style.cssText = 'margin:2rem;padding:1.25rem 1.5rem;border-radius:10px;background:#FADADA;color:#8C1717;font:16px/1.5 system-ui,sans-serif;max-width:60rem';
  const h = doc.createElement('h1');
  h.style.cssText = 'margin:0 0 .5rem;font-size:1.25rem';
  h.textContent = 'savo-slides could not start this page';
  const p = doc.createElement('p');
  p.style.margin = '0 0 .5rem';
  p.textContent = 'The page refuses to render a deck it does not understand (no fallback rendering).';
  const pre = doc.createElement('pre');
  pre.style.cssText = 'margin:0;white-space:pre-wrap;font:14px ui-monospace,Consolas,monospace';
  pre.textContent = `${code}${path ? ' at ' + path : ''}\n${detail}`;
  main.append(h, p, pre);
  doc.body.replaceChildren(main);
  doc.title = 'savo-slides: error';
  /** @type {any} */ (doc.defaultView).__savoBootError = { code, path, message: detail };
}

/**
 * Read role and deck from the page. Throws an Error that carries `code` when the page breaks the boot contract.
 * @param {Document} doc
 */
export function readPage(doc) {
  const role = doc.body?.dataset?.savoRole;
  if (!role || !ROLES.includes(role)) throw Object.assign(new Error(`<body data-savo-role> must be one of ${ROLES.join(', ')}, found ${JSON.stringify(role)}`), { code: 'role_invalid', path: 'body[data-savo-role]' });
  const script = doc.getElementById('savo-deck');
  if (!script) throw Object.assign(new Error('the page has no <script type="application/json" id="savo-deck">'), { code: 'deck_missing', path: '#savo-deck' });
  let raw;
  try { raw = JSON.parse(script.textContent ?? ''); } catch (e) { throw Object.assign(new Error(`the deck JSON does not parse: ${/** @type {Error} */ (e).message}`), { code: 'deck_json_invalid', path: '#savo-deck' }); }
  const deck = loadDeck(raw);                           // throws DeckError: unknown format, format_version, target, bad text, missing math, ...
  const want = ROLE_TARGET[/** @type {keyof typeof ROLE_TARGET} */ (role)];
  if (deck.target !== want) throw Object.assign(new Error(`the ${role} page must carry a "${want}" deck, found target "${deck.target}"`), { code: 'role_target_mismatch', path: '$.target' });
  return { role: /** @type {'console'|'audience'|'student'} */ (role), deck };
}

/** Corrections of a link are reported, not hidden. @param {Array<{code: string, value: string}>} problems */
function reportProblems(problems) {
  for (const p of problems) console.warn(`[savo-slides] the address was corrected: ${p.code} (${p.value})`);
}

/**
 * Plain-text document title from a deck title fragment. WP-10: the fragment is parsed inside a <template>, whose content belongs to an inert document: nothing in it
 * loads or runs. A detached <span> of the LIVE document is not inert (measured in Chrome 156: an <img onerror> written into its innerHTML still requests the image
 * and fires onerror). The fragment is the build's and checkFragment (deck.js) already restricts it to <span>; this keeps the title path safe even if that gate is bypassed.
 * @param {Document} doc @param {string} fragment
 */
function plainTitle(doc, fragment) {
  const t = doc.createElement('template');
  t.innerHTML = fragment;
  return t.content.textContent ?? '';
}

/**
 * The suffix the build appended to this page's <title> (config build.title_suffix: " (console)", " (audience)", ""): it tells the two presenter windows apart in the task
 * bar. The engine retitles the page with the language on screen and must keep it. Empty when the title of the page does not start with the deck title.
 * @param {Document} doc @param {import('./deck.js').Deck} deck
 */
export function titleSuffix(doc, deck) {
  const built = doc.title;
  const base = plainTitle(doc, text(deck, deck.title, deck.defaultLang));
  return built.startsWith(base) ? built.slice(base.length) : '';
}

/**
 * WP-12c: the address with the non-colour cues in it: `cues=on` while they are on, no `cues` at all while they are off (off is the default, D-068), every other
 * unknown parameter kept as it was.
 * @param {Array<[string, string]>} extra @param {boolean} on @returns {Array<[string, string]>}
 */
export function withCues(extra, on) {
  const rest = extra.filter(([k]) => k !== 'cues');
  return on ? [...rest, ['cues', 'on']] : rest;
}

/**
 * Boot the page. Never throws: a failure is shown on the page and in the console.
 * @param {Document} [doc]
 * @returns {Promise<{role: 'console'|'audience'|'student', deck: import('./deck.js').Deck, player: Player|null, router: ReturnType<typeof createRouter>|null, console?: any, audience?: any, controls?: any, stage?: any, prefs?: any}|null>}
 */
export async function boot(doc = document) {
  const win = /** @type {Window} */ (doc.defaultView);
  /** @type {ReturnType<typeof mountStage>|null} */
  let stage = null;                                           // the catch below detaches its resize handler when the boot fails half way
  try {
    const { role, deck } = readPage(doc);
    const params = new URLSearchParams(win.location.search);
    const suffix = titleSuffix(doc, deck);                    // read before anything retitles the page
    if (role === 'console') {
      const route = parseLocation({ hash: win.location.hash, search: win.location.search });
      reportProblems(route.problems);
      const { startConsole } = await import('../presenter/console.js');
      const handle = await startConsole({ doc, win, deck, titleSuffix: suffix, requested: { slideId: route.slideId, step: route.step, lang: route.lang, theme: route.theme, cues: params.get('cues') === 'on' } });
      const result = { role, deck, player: null, router: null, console: handle };
      /** @type {any} */ (win).__savo = result;
      return result;
    }

    // WP-12c: student and audience (and the console's preview). Everything the first picture needs is checked and loaded BEFORE the Player exists. The chrome of EVERY
    // slide in BOTH languages is built once on paper: a deck whose chrome cannot be drawn (an unreadable section title, a progress variant the chrome does not know)
    // stops the page here, loudly, not at slide 17 of the lecture.
    const chromeIn = { plain: (/** @type {string} */ f) => plainTitle(doc, f), assetBase: doc.baseURI };
    const badChrome = chromeProblems(deck, chromeIn);
    if (badChrome.length > 0) throw problemsError('chrome_invalid', '$.chrome', 'the chrome of the deck', badChrome);
    const [{ buildChrome }, controlsModule, { createRenderer, rendererProblems }] = await Promise.all([
      import('../chrome/index.js'), role === 'student' ? import('./student-controls.js') : null, import('./renderers.js')]);   // the student alone loads the controls
    // WP-20: the same for what draws the slides: a layout or a widget the engine does not know, a widget in a layout without a slot, params the widget refuses
    const badRenderers = rendererProblems(deck);
    if (badRenderers.length > 0) throw problemsError('renderer_invalid', '$.slides', 'the layouts and widgets of the deck', badRenderers);
    for (const failure of await loadStylesheets(doc, styleUrls(role))) console.warn(`[savo-slides] ${failure}`);   // a sheet that did not load is reported; an unstyled slide beats a blank screen

    stage = mountStage(doc, role === 'student' ? 'student' : 'audience');
    const host = stage.stage;
    host.setAttribute('data-savo-role', role);
    host.setAttribute('data-savo-target', deck.target);
    const prefs = role === 'student' ? createPrefs(win, deck) : null;
    // The student's first view: the address, else what the reader chose before, else the deck's defaults (core/prefs.js). The audience follows the console from its first state on.
    const view = prefs
      ? initialView(deck, params, prefs.read())
      : { lang: resolveLang(deck, params.get('lang')), theme: resolveTheme(deck, params.get('theme')), cues: params.get('cues') === 'on' };
    setTheme(doc, deck, view.theme);
    setCues(doc, view.cues);                                 // D-068: the non-colour cues are off by default; the audience follows the console, the student's choice is remembered
    const kind = role === 'audience' && params.get('mode') === 'mirror' ? 'mirror' : 'audience';
    const motion = kind === 'mirror' || params.get('motion') === 'reduce' ? 'reduce' : (params.get('motion') === 'full' ? 'full' : 'auto');
    const player = new Player({
      deck, host, lang: view.lang, motion, policy: defaultPolicy(role, deck.chrome.lock_default), window: win,
      createRenderer,                                          // WP-20: the layout of every slide, the page renderers, the widgets (core/renderers.js)
      chrome: (slide, l) => { const model = chromeModelFor(deck, slide, l, chromeIn); return model ? buildChrome(doc, model) : null; },   // WP-12c: the strip and the footer, after the slide
    });
    if (role === 'audience') {
      // WP-10: the player is started by the first state of the console (black until then), never by this page's own address or keys
      doc.title = plainTitle(doc, text(deck, deck.title, player.lang)) + suffix;
      player.on('lang', ({ lang: l }) => { doc.title = plainTitle(doc, text(deck, deck.title, l)) + suffix; });
      const { startAudience } = await import('../presenter/audience.js');
      const audience = startAudience({ doc, win, deck, player, kind });
      const result = { role, deck, player, router: null, audience, stage };
      /** @type {any} */ (win).__savo = result;
      return result;
    }

    // student: the address is the state, the keys drive the player
    let fromRouter = false;                                  // a redraw caused by Back or an edited hash must not be written back
    const router = createRouter({ window: win, onChange: (route) => {
      fromRouter = true;
      try { reportProblems([...route.problems, ...player.goto(route.slideId ?? '', route.step)]); } finally { fromRouter = false; }
    } });
    const first = router.current();
    const problems = player.start({ slideId: first.slideId, step: first.step });
    doc.title = plainTitle(doc, text(deck, deck.title, player.lang)) + suffix;
    reportProblems([...first.problems, ...problems]);
    /** The address of the state we are in, with `patch` on top (a display choice of the reader): a replace, so Back does not step through button presses. @param {Partial<Parameters<typeof router.navigate>[0]>} [patch] */
    const writeAddress = (patch = {}) => {
      const cur = router.current();
      router.navigate({ slideId: player.state.slideId, step: player.state.step, lang: cur.lang, theme: cur.theme, mode: cur.mode, extra: cur.extra, ...patch }, { replace: true });
    };
    const write = (/** @type {{slideId: string, step: number}} */ s, /** @type {boolean} */ replace) => {
      const cur = router.current();
      router.navigate({ slideId: s.slideId, step: s.step, lang: cur.lang, theme: cur.theme, mode: cur.mode, extra: cur.extra }, { replace });
    };
    write(player.state, true);                               // the canonical address of the state we are in (a bare URL gains #/<first>/0)
    let lastSlide = player.state.slideId;
    player.on('state', (s) => {
      if (fromRouter) { lastSlide = s.slideId; return; }
      write(s, s.slideId === lastSlide);                     // changing slide pushes a history entry, moving inside a slide replaces it
      lastSlide = s.slideId;
    });
    /** @type {{refresh: () => void}|null} */
    let controls = null;
    player.on('lang', ({ lang: l }) => {
      writeAddress({ lang: l });
      doc.title = plainTitle(doc, text(deck, deck.title, l)) + suffix;
      /** @type {NonNullable<typeof prefs>} */ (prefs).write({ lang: l });   // the reader chose it: the buttons are the only way to change the language (core/input.js has no key for it)
      controls?.refresh();
    });
    bindKeys(doc, player);
    // WP-59 (D-142): a touch screen gets the controls pinned on screen by default (a mouse keeps D-073's reveal), until the reader chooses with the pin
    const touchScreen = win.matchMedia?.('(hover: none) and (pointer: coarse)').matches === true;
    const saved = /** @type {NonNullable<typeof prefs>} */ (prefs).read();
    let pinned = saved.pin ?? touchScreen;
    const controlsApi = /** @type {typeof import('./student-controls.js')} */ (controlsModule);
    // WP-12c / D-073: the display controls sit in <body>, OUTSIDE the deck root (their CSS transition would count as one of the engine's own animations and hold the lock)
    const state = () => ({ lang: /** @type {'en'|'tr'} */ (player.lang), theme: /** @type {'light'|'dark'} */ (doc.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'), cues: doc.documentElement.dataset.cues === 'on', pinned });
    const mounted = controlsApi.mountStudentControls({
      doc, state,
      geometry: () => ({ ...stage.fit(), width: stage.wrap.clientWidth || win.innerWidth, height: stage.wrap.clientHeight || win.innerHeight }),
      actions: {
        lang: (l) => { player.setLang(l); },                  // the 'lang' handler above writes the address and the preference and refreshes the controls
        theme: (t) => {
          if (!THEMES.includes(t)) return;
          setTheme(doc, deck, t);
          /** @type {NonNullable<typeof prefs>} */ (prefs).write({ theme: t });
          writeAddress({ theme: t });
          mounted.refresh();
        },
        cues: (on) => {
          setCues(doc, on);
          /** @type {NonNullable<typeof prefs>} */ (prefs).write({ cues: on });
          writeAddress({ extra: withCues(router.current().extra, on) });
          mounted.refresh();
        },
        // WP-59 (D-142): the pin is remembered like the other choices (it has no address); Back and Next are the keys' own commands
        pin: (on) => {
          pinned = on;
          /** @type {NonNullable<typeof prefs>} */ (prefs).write({ pin: on });
          mounted.refresh();
        },
        next: () => { player.next(); },
        back: () => { player.prev(); },
      },
    });
    controls = mounted;
    // WP-59 (D-142): a finger or a pen drives the player too (core/touch.js: tap zones and swipes); the tap that closes the open rail does nothing else
    bindTouch(doc, player, { win, consumed: (id) => mounted.consumed(id) });
    if (touchScreen && saved.hint !== true) {
      controlsApi.mountTouchHint({ doc, lang: /** @type {'en'|'tr'} */ (player.lang), onDone: () => { /** @type {NonNullable<typeof prefs>} */ (prefs).write({ hint: true }); } });
    }
    const result = { role, deck, player, router, controls: mounted, stage, prefs };
    /** @type {any} */ (win).__savo = result;
    return result;
  } catch (e) {
    try { stage?.destroy(); } catch (_) { /* the page is replaced by the error anyway */ }
    showError(doc, /** @type {any} */ (e));
    return null;
  }
}

// Run when this file is the entry module of a generated page: either contract element present means "this is a page";
// a page that lost one of them must fail loudly rather than stay blank. Imported by tests without either: no auto-run.
if (typeof document !== 'undefined' && document.body && (document.body.dataset.savoRole !== undefined || document.getElementById('savo-deck'))) /** @type {any} */ (window).__savoBoot = boot(document);
