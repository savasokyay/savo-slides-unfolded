// @ts-check
// WP-20: the params of a widget. Every widget names its params as a JSON Schema in its module; the same schema stands in engine/registry.json, where the build
// reads it (savo_slides/registry.py; the build's own check runs a pinned `jsonschema`, a separate job). Two validators must never disagree, so this one
// implements a SMALL subset of JSON Schema and refuses to define a widget whose schema uses anything else (`schemaProblems`): what is here means exactly
// what the full validator means.
//
// The subset: type (object, array, string, number, integer, boolean, null), properties, required, additionalProperties (a boolean), enum, minimum, maximum,
// minLength, maxLength (counted in code points, like JSON Schema), items (one schema), minItems, maxItems, default, title, description.
// `default` is not part of validation (JSON Schema never changes an instance): `withDefaults` fills it in AFTER the params passed.

export const KEYWORDS = Object.freeze(['type', 'properties', 'required', 'additionalProperties', 'enum', 'minimum', 'maximum', 'minLength', 'maxLength', 'items', 'minItems', 'maxItems', 'default', 'title', 'description']);
const TYPES = Object.freeze(['object', 'array', 'string', 'number', 'integer', 'boolean', 'null']);

const isObj = (/** @type {unknown} */ v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isCount = (/** @type {unknown} */ v) => typeof v === 'number' && Number.isInteger(v) && v >= 0;
const codePoints = (/** @type {string} */ s) => [...s].length;

/** The JSON Schema type names `v` has (an integer is also a number). @param {unknown} v @returns {string[]} */
function typesOf(v) {
  if (v === null) return ['null'];
  if (Array.isArray(v)) return ['array'];
  if (typeof v === 'number') return Number.isFinite(v) ? (Number.isInteger(v) ? ['integer', 'number'] : ['number']) : [];
  if (typeof v === 'string' || typeof v === 'boolean') return [typeof v];
  return isObj(v) ? ['object'] : [];
}
/** @param {unknown} a @param {unknown} b */
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Why a schema is outside the subset (an empty list: it is inside). Nothing is accepted silently: an unknown keyword is the way two validators come to disagree.
 * @param {unknown} schema @param {string} [path] @returns {string[]}
 */
export function schemaProblems(schema, path = '$') {
  if (!isObj(schema)) return [`${path}: a schema is an object`];
  /** @type {string[]} */ const out = [];
  const s = /** @type {Record<string, any>} */ (schema);
  for (const key of Object.keys(s)) if (!KEYWORDS.includes(key)) out.push(`${path}: the keyword "${key}" is outside the subset (${KEYWORDS.join(', ')})`);
  if ('type' in s && !(typeof s.type === 'string' && TYPES.includes(s.type))) out.push(`${path}.type: one of ${TYPES.join(', ')} (one name, no list)`);
  if ('properties' in s) {
    if (!isObj(s.properties)) out.push(`${path}.properties: an object of schemas`);
    else for (const [k, v] of Object.entries(s.properties)) out.push(...schemaProblems(v, `${path}.properties.${k}`));
  }
  if ('required' in s && !(Array.isArray(s.required) && s.required.every((/** @type {unknown} */ r) => typeof r === 'string') && new Set(s.required).size === s.required.length)) out.push(`${path}.required: a list of distinct property names`);
  if ('additionalProperties' in s && typeof s.additionalProperties !== 'boolean') out.push(`${path}.additionalProperties: true or false (a schema is outside the subset)`);
  if ('enum' in s && !(Array.isArray(s.enum) && s.enum.length > 0)) out.push(`${path}.enum: a non-empty list`);
  for (const k of ['minimum', 'maximum']) if (k in s && !(typeof s[k] === 'number' && Number.isFinite(s[k]))) out.push(`${path}.${k}: a number`);
  for (const k of ['minLength', 'maxLength', 'minItems', 'maxItems']) if (k in s && !isCount(s[k])) out.push(`${path}.${k}: a whole number, 0 or more`);
  if ('items' in s) out.push(...schemaProblems(s.items, `${path}.items`));
  for (const k of ['title', 'description']) if (k in s && typeof s[k] !== 'string') out.push(`${path}.${k}: a string`);
  if ('default' in s && 'type' in s && TYPES.includes(s.type) && !typesOf(s.default).includes(s.type)) out.push(`${path}.default: not a ${s.type}`);
  return out;
}

/**
 * Problems of `value` against `schema` (one `{path, detail}` each; empty: valid). The schema must be inside the subset (`schemaProblems`).
 * @param {any} schema @param {unknown} value @param {string} [path] @returns {Array<{path: string, detail: string}>}
 */
export function validateParams(schema, value, path = '$') {
  /** @type {Array<{path: string, detail: string}>} */ const out = [];
  const bad = (/** @type {string} */ detail) => out.push({ path, detail });
  if ('type' in schema && !typesOf(value).includes(schema.type)) { bad(`expected ${schema.type}, found ${value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value === 'number' ? JSON.stringify(value) : typeof value}`); return out; }
  if ('enum' in schema && !schema.enum.some((/** @type {unknown} */ e) => same(e, value))) bad(`expected one of ${JSON.stringify(schema.enum)}, found ${JSON.stringify(value)}`);
  if (typeof value === 'number') {
    if ('minimum' in schema && value < schema.minimum) bad(`${value} is below the minimum ${schema.minimum}`);
    if ('maximum' in schema && value > schema.maximum) bad(`${value} is above the maximum ${schema.maximum}`);
  }
  if (typeof value === 'string') {
    if ('minLength' in schema && codePoints(value) < schema.minLength) bad(`shorter than ${schema.minLength} characters`);
    if ('maxLength' in schema && codePoints(value) > schema.maxLength) bad(`longer than ${schema.maxLength} characters`);
  }
  if (Array.isArray(value)) {
    if ('minItems' in schema && value.length < schema.minItems) bad(`fewer than ${schema.minItems} items`);
    if ('maxItems' in schema && value.length > schema.maxItems) bad(`more than ${schema.maxItems} items`);
    if ('items' in schema) value.forEach((v, i) => out.push(...validateParams(schema.items, v, `${path}[${i}]`)));
  }
  if (isObj(value)) {
    const o = /** @type {Record<string, unknown>} */ (value);
    const props = isObj(schema.properties) ? schema.properties : {};
    for (const r of schema.required ?? []) if (!(r in o)) out.push({ path: `${path}.${r}`, detail: 'is required' });
    for (const [k, v] of Object.entries(o)) {
      if (k in props) out.push(...validateParams(props[k], v, `${path}.${k}`));
      else if (schema.additionalProperties === false) out.push({ path: `${path}.${k}`, detail: 'is not a param of this widget' });
    }
  }
  return out;
}

/**
 * `value` with the defaults of the schema filled in, recursively for objects (a copy: the input is not changed). It does not validate: call `validateParams` on
 * the params as given, then this.
 * @param {any} schema @param {unknown} value @returns {any}
 */
export function withDefaults(schema, value) {
  if (isObj(value) && isObj(schema.properties)) {
    const o = { .../** @type {Record<string, unknown>} */ (value) };
    for (const [k, sub] of Object.entries(schema.properties)) {
      if (k in o) o[k] = withDefaults(sub, o[k]);
      else if (isObj(sub) && 'default' in sub) o[k] = structuredClone(/** @type {any} */ (sub).default);
    }
    return o;
  }
  return value;
}
