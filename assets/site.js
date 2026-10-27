// savo-slides-publisher: the reader's two display choices, language and theme, shared with the slides and the course guide.
// Loaded in <head> without defer, so the first paint already shows the chosen language and theme.
//   - Defaults are the decks' and the guide's: the page's own language (config default_language) and the light theme, whatever the
//     system says (the classroom projector default). Only what the reader CHOSE here is remembered (localStorage, optional: in a private
//     window or with storage blocked, a choice lasts until the page is closed).
//   - Shared with the slides through the address: a savo-slides deck reads ?lang= and ?theme= before its own memory (engine/core/prefs.js,
//     "the address wins"), so every link to a deck carries the choices made here.
//   - Shared with the course guide through its own storage keys (same origin): config share_storage names them, the page lists them in
//     data-share-lang / data-share-theme, and a choice made here is written there too.
(function () {
  'use strict';
  var root = document.documentElement;
  var LANG_KEY = 'savo-site:lang';
  var THEME_KEY = 'savo-site:theme';
  var THEMES = ['light', 'dark'];
  function load(key) { try { return window.localStorage.getItem(key); } catch (e) { return null; } }
  function save(key, value) { try { window.localStorage.setItem(key, value); } catch (e) { /* not kept */ } }
  function list(name) { return (root.getAttribute(name) || '').split(/\s+/).filter(Boolean); }

  var langs = list('data-langs');
  var chosenLang = load(LANG_KEY);
  if (langs.indexOf(chosenLang) < 0) chosenLang = null;
  var chosenTheme = load(THEME_KEY);
  if (THEMES.indexOf(chosenTheme) < 0) chosenTheme = null;
  var lang = chosenLang || root.getAttribute('lang') || langs[0];
  var theme = chosenTheme || 'light';

  function press(selector, value) {
    var buttons = document.querySelectorAll(selector);
    for (var i = 0; i < buttons.length; i++) {
      var b = buttons[i];
      b.setAttribute('aria-pressed', String((b.getAttribute('data-set-lang') || b.getAttribute('data-set-theme')) === value));
    }
  }
  function applyLang() {
    root.setAttribute('lang', lang);   // <html lang> is the language on screen; the other language's spans keep their own lang
    var title = root.getAttribute('data-title-' + lang);
    if (title) document.title = title;
    var labelled = document.querySelectorAll('[data-label-' + lang + ']');
    for (var i = 0; i < labelled.length; i++) {
      var el = labelled[i], text = el.getAttribute('data-label-' + lang);
      el.setAttribute(el.tagName === 'IMG' ? 'alt' : 'aria-label', text);
      if (el.hasAttribute('title')) el.setAttribute('title', text);
    }
    press('[data-set-lang]', lang);
  }
  function applyTheme() {
    root.setAttribute('data-theme', theme);
    press('[data-set-theme]', theme);
  }
  function carry() {
    // a deck link carries only what the reader chose here; without a choice the deck keeps its own memory and defaults
    var query = [];
    if (chosenLang) query.push('lang=' + chosenLang);
    if (chosenTheme) query.push('theme=' + chosenTheme);
    var decks = document.querySelectorAll('a[data-kind="slides"]');
    for (var i = 0; i < decks.length; i++) {
      var href = decks[i].getAttribute('href').split('?')[0];
      decks[i].setAttribute('href', query.length ? href + '?' + query.join('&') : href);
    }
  }
  function share(kind, value) {
    var keys = list('data-share-' + kind);
    for (var i = 0; i < keys.length; i++) save(keys[i], value);
  }

  root.classList.add('js');
  root.setAttribute('lang', lang);
  root.setAttribute('data-theme', theme);
  document.addEventListener('DOMContentLoaded', function () {
    applyLang();
    applyTheme();
    carry();
    document.addEventListener('click', function (event) {
      var target = event.target && event.target.closest ? event.target.closest('[data-set-lang],[data-set-theme]') : null;
      if (!target) return;
      if (target.hasAttribute('data-set-lang')) {
        lang = chosenLang = target.getAttribute('data-set-lang');
        save(LANG_KEY, lang);
        share('lang', lang);
        applyLang();
      } else {
        theme = chosenTheme = target.getAttribute('data-set-theme');
        save(THEME_KEY, theme);
        share('theme', theme);
        applyTheme();
      }
      carry();
    });
  });
})();
