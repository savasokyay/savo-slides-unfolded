// @ts-check
// WP-31: i18n. Dictionaries come from `/api/config/i18n/{lang}` (live) or `i18n/{lang}.json`
// (static export, WP-50); the same nested-YAML-as-JSON shape either way. Interpolation matches
// the `{name}` placeholders used throughout config/i18n/*.yaml and the trace step text_params.

/**
 * @param {any} obj
 * @param {string} path
 */
function get(obj, path) {
  return path.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

/**
 * @param {string} template
 * @param {Record<string, unknown>} [params]
 */
export function interpolate(template, params) {
  return template.replace(/\{(\w+)\}/g, (match, key) =>
    params && key in params ? String(params[key]) : match
  );
}

export function createI18n() {
  /** @type {Record<string, unknown>} */
  let dict = {};
  let lang = "en";
  // WP-97: ticket of the newest load. Two quick language clicks start two loads and the slower one may finish last;
  // only the newest load's dictionary is installed, so the dictionary, `lang()` and the caller's follow-up (store,
  // localStorage) all say what the last click asked for
  let loadSeq = 0;
  return {
    /**
     * @param {{i18n: (lang: string) => Promise<Record<string, unknown>>}} api
     * @param {string} newLang
     * @returns {Promise<boolean>} true when this load was installed, false when a newer `load` superseded it (the
     *   caller then does nothing: the newer call carries the switch through)
     */
    async load(api, newLang) {
      const mine = (loadSeq += 1);
      const next = await api.i18n(newLang);
      if (mine !== loadSeq) return false;
      dict = next;
      lang = newLang;
      return true;
    },
    lang() {
      return lang;
    },
    /**
     * @param {string} key
     * @param {Record<string, unknown>} [params]
     * @returns {string}
     */
    t(key, params) {
      const value = get(dict, key);
      if (typeof value !== "string") return key;
      return params ? interpolate(value, params) : value;
    },
  };
}
