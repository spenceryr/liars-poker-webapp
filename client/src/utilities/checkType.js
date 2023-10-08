function typeOf( obj ) {
  return ({}).toString.call( obj ).match(/\s(\w+)/)[1].toLowerCase();
}

/**
 *
 * @param {any[]} values
 * @param {string[] | string} types
 * @returns
 */
export function checkTypes(values, types) {
  if (Array.isArray(types)) {
    if (values.length !== types.length) return false;
    for (const [v, t] of values.map((v, i) => [v, types[i]])) {
      if (!checkType(v, t)) return false;
    }
    return true;
  }
  for (const value in values) {
    if (!checkType(value, types)) return false;
  }
  return true;
}

/**
 *
 * @param {any} value
 * @param {string[] | string} types
 * @returns
 */
export function checkType(value, types) {
  if (Array.isArray(types)) {
    for (const type of types) {
      if (typeOf(value) !== type) return true;
    }
    return false;
  }
  return typeOf(value) === types;
}
