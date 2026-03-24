/**
 * Extract variables from camunda:resultVariable attribute.
 * Used on service tasks, business rule tasks, send tasks, etc.
 *
 * @param {ModdleElement} element - BPMN element business object
 * @returns {Array<{name: string, type: string, category: string}>}
 */
export function scanResultVariable(element) {
  const variables = [];

  const resultVariable = element.get('camunda:resultVariable');
  if (resultVariable) {
    variables.push({
      name: resultVariable,
      type: 'string',
      category: 'result-variable',
      source: {
        elementId: element.get('id'),
        elementName: element.get('name') || element.get('id'),
        elementType: element.$type
      }
    });
  }

  return variables;
}
