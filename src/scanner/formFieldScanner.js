/**
 * Extract variables from camunda:FormData extension elements.
 *
 * @param {ModdleElement} element - BPMN element business object
 * @returns {Array<{name: string, type: string, category: string}>}
 */
export function scanFormFields(element) {
  const variables = [];
  const extensionElements = element.get('extensionElements');

  if (!extensionElements) {
    return variables;
  }

  const values = extensionElements.get('values') || [];

  for (const ext of values) {
    if (ext.$type === 'camunda:FormData') {
      const fields = ext.get('fields') || [];

      for (const field of fields) {
        variables.push({
          name: field.get('id'),
          type: mapFormFieldType(field.get('type')),
          category: 'form-field',
          source: {
            elementId: element.get('id'),
            elementName: element.get('name') || element.get('id'),
            elementType: element.$type
          }
        });
      }
    }
  }

  return variables;
}

function mapFormFieldType(type) {
  switch (type) {
  case 'string': return 'string';
  case 'long':
  case 'double': return 'number';
  case 'boolean': return 'boolean';
  case 'date': return 'date';
  case 'enum': return 'string';
  default: return 'string';
  }
}
