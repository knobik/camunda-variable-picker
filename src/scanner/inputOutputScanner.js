import { buildJsonStructure } from '../SpinExpressionBuilder';

/**
 * Extract variables from camunda:InputOutput extension elements.
 *
 * @param {ModdleElement} element - BPMN element business object
 * @returns {Array<{name: string, type: string, category: string}>}
 */
export function scanInputOutput(element) {
  const variables = [];
  const extensionElements = element.get('extensionElements');

  if (!extensionElements) {
    return variables;
  }

  const values = extensionElements.get('values') || [];

  for (const ext of values) {
    if (ext.$type === 'camunda:InputOutput') {
      const inputParams = ext.get('inputParameters') || [];
      const outputParams = ext.get('outputParameters') || [];

      for (const param of outputParams) {
        const varInfo = buildVariableInfo(param, element, 'output-mapping');
        variables.push(varInfo);
      }

      for (const param of inputParams) {
        const varInfo = buildVariableInfo(param, element, 'input-mapping');
        variables.push(varInfo);
      }
    }
  }

  return variables;
}

function buildVariableInfo(param, element, category) {
  const value = param.get('value');
  const typeInfo = inferTypeFromValue(value);

  const variable = {
    name: param.get('name'),
    type: typeInfo.type,
    category,
    source: {
      elementId: element.get('id'),
      elementName: element.get('name') || element.get('id'),
      elementType: element.$type
    }
  };

  if (typeInfo.jsonStructure) {
    variable.jsonStructure = typeInfo.jsonStructure;
  }

  return variable;
}

function inferTypeFromValue(value) {
  if (!value) return { type: 'string' };

  if (value === 'true' || value === 'false') return { type: 'boolean' };
  if (!isNaN(value) && value.trim() !== '') return { type: 'number' };

  if (value.startsWith('{') || value.startsWith('[')) {
    try {
      const parsed = JSON.parse(value);
      return {
        type: 'json',
        jsonStructure: buildJsonStructure(parsed)
      };
    } catch {
      // Not valid JSON — still mark as json type but no structure
      return { type: 'json' };
    }
  }

  return { type: 'string' };
}
