/**
 * Builds Camunda 7 SPIN expressions from a variable name and JSON property path.
 *
 * @param {string} variableName - The root variable name
 * @param {string[]} path - Array of path segments, e.g. ['customer', 'name'] or ['items', '[0]', 'productId']
 * @param {boolean} isLeaf - Whether this is a leaf (primitive) node — appends .value()
 * @returns {string} SPIN expression, e.g. S(order).prop('customer').prop('name').value()
 */
export function buildSpinExpression(variableName, path, isLeaf) {
  let expr = 'S(' + variableName + ')';

  for (const segment of path) {
    const arrayMatch = segment.match(/^\[(\d+)\]$/);
    if (arrayMatch) {
      expr += '.elements().get(' + arrayMatch[1] + ')';
    } else {
      expr += ".prop('" + segment + "')";
    }
  }

  if (isLeaf) {
    expr += '.value()';
  }

  return expr;
}

/**
 * Build a JSON structure tree from a parsed JSON value.
 *
 * @param {*} value - Parsed JSON value
 * @returns {{ type: string, children?: object|array }}
 */
export function buildJsonStructure(value) {
  if (value === null) {
    return { type: 'null', value: 'null' };
  }

  if (Array.isArray(value)) {
    const children = value.map(item => buildJsonStructure(item));
    return { type: 'array', children };
  }

  if (typeof value === 'object') {
    const children = {};
    for (const [key, val] of Object.entries(value)) {
      children[key] = buildJsonStructure(val);
    }
    return { type: 'object', children };
  }

  if (typeof value === 'boolean') {
    return { type: 'boolean', value: String(value) };
  }

  if (typeof value === 'number') {
    return { type: 'number', value: String(value) };
  }

  return { type: 'string', value: String(value) };
}
