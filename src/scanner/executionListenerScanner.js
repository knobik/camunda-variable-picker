/**
 * Extract variables from execution listener scripts.
 * Looks for camunda:executionListener with inline scripts
 * and applies regex to find execution.setVariable calls.
 *
 * @param {ModdleElement} element - BPMN element business object
 * @returns {Array<{name: string, type: string, category: string}>}
 */
export function scanExecutionListeners(element) {
  const variables = [];
  const extensionElements = element.get('extensionElements');

  if (!extensionElements) {
    return variables;
  }

  const values = extensionElements.get('values') || [];
  const source = {
    elementId: element.get('id'),
    elementName: element.get('name') || element.get('id'),
    elementType: element.$type
  };

  for (const ext of values) {
    if (ext.$type !== 'camunda:ExecutionListener') continue;

    const script = ext.get('script');
    if (!script) continue;

    // Script can be a camunda:Script element with a value, or inline
    const scriptText = typeof script === 'string' ? script : (script.get && script.get('value'));
    if (!scriptText) continue;

    const setVarRegex = /execution\.setVariable\s*\(\s*['"]([^'"]+)['"]/g;
    let match;
    while ((match = setVarRegex.exec(scriptText)) !== null) {
      variables.push({
        name: match[1],
        type: 'string',
        category: 'listener-variable',
        source
      });
    }
  }

  return variables;
}
