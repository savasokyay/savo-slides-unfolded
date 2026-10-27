// @ts-check
// WP-12b: the strings the chrome and the student controls show or announce, in both languages. Same convention as
// engine/presenter/strings.js: one table per language with the same keys and the same {placeholders} (tests/js/chrome-strings.test.mjs
// checks it), and a lookup that fails loudly on an unknown key. Language names are written in their own language and carry their
// own lang attribute where they are drawn.

/** @typedef {'en'|'tr'} Lang */

/** @type {Record<Lang, Record<string, string>>} */
export const STRINGS = {
  en: {
    'controls.label': 'Display options',
    'lang.label': 'Language',
    'lang.en': 'English',
    'lang.tr': 'Türkçe',
    'theme.label': 'Theme',
    'theme.light': 'Light',
    'theme.dark': 'Dark',
    'cues.label': 'Non-colour cues',
    'cues.hint': 'Underlines and italics that mark the roles without colour',
    'progress.label': 'Section {section} of {sections}, slide {slide} of {slides}',
    'progress.flat': 'Slide {slide} of {slides}',
    'progress.goto': 'Slide {slide} of {slides}: {title}',
    'page.label': 'Page {index} of {total}',
    'pin.label': 'Always show the buttons',
    'pin.hint': 'On: the buttons stay on screen. Off: they appear when the pointer comes near',
    'nav.label': 'Slides',
    'nav.back': 'Back',
    'nav.next': 'Next',
    'hint.back': 'Back',
    'hint.next': 'Next',
    'hint.swipe': 'or swipe',
  },
  tr: {
    'controls.label': 'Görünüm seçenekleri',
    'lang.label': 'Dil',
    'lang.en': 'English',
    'lang.tr': 'Türkçe',
    'theme.label': 'Tema',
    'theme.light': 'Açık',
    'theme.dark': 'Koyu',
    'cues.label': 'Renk dışı ipuçları',
    'cues.hint': 'Rolleri renksiz de ayıran alt çizgiler ve italik',
    'progress.label': 'Bölüm {section} / {sections}, slayt {slide} / {slides}',
    'progress.flat': 'Slayt {slide} / {slides}',
    'progress.goto': 'Slayt {slide} / {slides}: {title}',
    'page.label': 'Sayfa {index} / {total}',
    'pin.label': 'Düğmeleri sürekli göster',
    'pin.hint': 'Açık: düğmeler ekranda kalır. Kapalı: imleç yaklaşınca belirir',
    'nav.label': 'Slaytlar',
    'nav.back': 'Geri',
    'nav.next': 'İleri',
    'hint.back': 'Geri',
    'hint.next': 'İleri',
    'hint.swipe': 'ya da kaydırın',
  },
};

/**
 * @param {Lang} lang
 * @returns {(key: string, params?: Record<string, string|number>) => string}
 */
export function createT(lang) {
  const table = STRINGS[lang];
  if (!table) throw new Error(`chrome strings: no table for language "${lang}"`);
  return (key, params = {}) => {
    const template = table[key];
    if (template === undefined) throw new Error(`chrome strings: no key "${key}" in "${lang}"`);
    return template.replace(/\{(\w+)\}/g, (_, name) => {
      if (!(name in params)) throw new Error(`chrome strings: "${key}" needs {${name}}`);
      return String(params[name]);
    });
  };
}
