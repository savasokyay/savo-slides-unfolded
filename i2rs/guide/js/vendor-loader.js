// @ts-check
// WP-32: lazy-load a vendored library by NAME; the pinned version comes from vendor/VERSIONS.json
// (written by `i2rs vendor`), so no call site ever hardcodes "katex@0.18.7". Libraries load only
// when a panel first needs them - the Data page never pays for KaTeX.

/** @type {Promise<Record<string, {version: string}>> | null} */
let versionsPromise = null;

function versions() {
  if (!versionsPromise) {
    versionsPromise = fetch("vendor/VERSIONS.json").then((r) => {
      if (!r.ok) throw new Error("vendor/VERSIONS.json missing - run: i2rs vendor");
      return r.json();
    });
  }
  return versionsPromise;
}

/**
 * @param {string} name
 * @param {string} file
 */
export async function vendorUrl(name, file) {
  const all = await versions();
  const entry = all[name];
  if (!entry || !entry.version) throw new Error(`vendor package "${name}" is not pinned`);
  return `vendor/${name}@${entry.version}/${file}`;
}

/** @type {Map<string, Promise<void>>} */
const loading = new Map();

/**
 * @param {string} name
 * @param {string} file
 */
export function loadVendorCss(name, file) {
  const key = `css:${name}/${file}`;
  if (!loading.has(key)) {
    loading.set(
      key,
      vendorUrl(name, file).then((url) => {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = url;
        document.head.appendChild(link);
      })
    );
  }
  return /** @type {Promise<void>} */ (loading.get(key));
}

/**
 * @param {string} name
 * @param {string} file
 */
export function loadVendorScript(name, file) {
  const key = `js:${name}/${file}`;
  if (!loading.has(key)) {
    loading.set(
      key,
      vendorUrl(name, file).then(
        (url) =>
          new Promise((resolve, reject) => {
            const script = document.createElement("script");
            script.src = url;
            script.onload = () => resolve(undefined);
            script.onerror = () => reject(new Error(`failed to load ${url}`));
            document.head.appendChild(script);
          })
      )
    );
  }
  return /** @type {Promise<void>} */ (loading.get(key));
}
