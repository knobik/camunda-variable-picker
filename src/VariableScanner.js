import {
  scanInputOutput,
  scanFormFields,
  scanResultVariable,
  scanScriptVariables,
  scanMultiInstance,
  scanExecutionListeners
} from './scanner';

/**
 * bpmn-js module that scans the BPMN model for process variables.
 * Only scans elements upstream of the currently selected element.
 * Emits 'variableScanner.variablesChanged' when variables are updated.
 */
export default class VariableScanner {

  constructor(elementRegistry, eventBus, canvas) {
    this._elementRegistry = elementRegistry;
    this._eventBus = eventBus;
    this._canvas = canvas;
    this._variables = [];
    this._selectedElement = null;

    eventBus.on('selection.changed', (e) => {
      this._onSelectionChanged(e);
    });

    eventBus.on('commandStack.changed', () => {
      this._rescan();
    });

    eventBus.on('import.done', () => {
      this._rescan();
    });
  }

  getVariables() {
    return this._variables;
  }

  _onSelectionChanged(event) {
    const { newSelection } = event;

    if (newSelection && newSelection.length === 1) {
      this._selectedElement = newSelection[0];
    } else {
      this._selectedElement = null;
    }

    this._rescan();
  }

  _rescan() {
    const variableMap = new Map();
    let elementsToScan;

    if (this._selectedElement) {
      // Get upstream elements from the selected element
      elementsToScan = this._getUpstreamElements(this._selectedElement);
    } else {
      // No selection — scan all
      elementsToScan = this._elementRegistry.getAll();
    }

    for (const element of elementsToScan) {
      const bo = element.businessObject || element;

      if (!bo || typeof bo.get !== 'function') {
        continue;
      }

      const scanners = [
        scanInputOutput,
        scanFormFields,
        scanResultVariable,
        scanScriptVariables,
        scanMultiInstance,
        scanExecutionListeners
      ];

      for (const scanner of scanners) {
        try {
          const vars = scanner(bo);
          for (const v of vars) {
            if (!variableMap.has(v.name)) {
              variableMap.set(v.name, v);
            }
          }
        } catch (err) {
          console.warn('[VariableScanner] Error scanning element', bo.id, err);
        }
      }
    }

    this._variables = Array.from(variableMap.values());
    this._variables.sort((a, b) => a.name.localeCompare(b.name));

    this._eventBus.fire('variableScanner.variablesChanged', {
      variables: this._variables
    });
  }

  /**
   * Walk backwards through incoming sequence flows to find
   * all elements that are upstream of the given element.
   */
  _getUpstreamElements(element) {
    const visited = new Set();
    const result = [];
    const queue = [element];

    while (queue.length > 0) {
      const current = queue.shift();
      const id = current.id || (current.businessObject && current.businessObject.id);

      if (!id || visited.has(id)) continue;
      visited.add(id);
      result.push(current);

      // Walk incoming sequence flows
      const incoming = current.incoming || [];
      for (const flow of incoming) {
        if (flow.source) {
          queue.push(flow.source);
        }
      }
    }

    // Also include the parent process/subprocess for process-level variables
    if (element.parent) {
      const parentBo = element.parent.businessObject;
      if (parentBo && typeof parentBo.get === 'function') {
        result.push(element.parent);
      }
    }

    return result;
  }
}

VariableScanner.$inject = ['elementRegistry', 'eventBus', 'canvas'];
