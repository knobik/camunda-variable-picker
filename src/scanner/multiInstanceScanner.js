/**
 * Extract variables from multi-instance loop characteristics.
 *
 * @param {ModdleElement} element - BPMN element business object
 * @returns {Array<{name: string, type: string, category: string}>}
 */
export function scanMultiInstance(element) {
  const variables = [];

  const loopCharacteristics = element.get('loopCharacteristics');
  if (!loopCharacteristics || loopCharacteristics.$type !== 'bpmn:MultiInstanceLoopCharacteristics') {
    return variables;
  }

  const source = {
    elementId: element.get('id'),
    elementName: element.get('name') || element.get('id'),
    elementType: element.$type
  };

  const collection = loopCharacteristics.get('camunda:collection');
  if (collection) {
    variables.push({
      name: collection,
      type: 'array',
      category: 'multi-instance',
      source
    });
  }

  const elementVariable = loopCharacteristics.get('camunda:elementVariable');
  if (elementVariable) {
    variables.push({
      name: elementVariable,
      type: 'string',
      category: 'multi-instance',
      source
    });
  }

  return variables;
}
