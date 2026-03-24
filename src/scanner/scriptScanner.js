/**
 * Best-effort extraction of variables from script tasks.
 * Looks for execution.setVariable('name', ...) patterns in Groovy/JS scripts.
 *
 * Phase 1: basic regex matching only.
 *
 * @param {ModdleElement} element - BPMN element business object
 * @returns {Array<{name: string, type: string, category: string}>}
 */
export function scanScriptVariables(element) {
  const variables = [];

  if (element.$type !== 'bpmn:ScriptTask') {
    return variables;
  }

  const script = element.get('script');
  if (!script) {
    return variables;
  }

  const source = {
    elementId: element.get('id'),
    elementName: element.get('name') || element.get('id'),
    elementType: element.$type
  };

  // Match execution.setVariable("name", ...) or execution.setVariable('name', ...)
  const setVarRegex = /execution\.setVariable\s*\(\s*['"]([^'"]+)['"]/g;
  let match;
  while ((match = setVarRegex.exec(script)) !== null) {
    variables.push({
      name: match[1],
      type: 'string',
      category: 'script-variable',
      source
    });
  }

  return variables;
}
