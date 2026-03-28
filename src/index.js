import {
  registerClientExtension,
  registerPlatformBpmnJSPlugin
} from 'camunda-modeler-plugin-helpers';

import VariableScannerModule from './VariableScannerModule';
import VariablePickerPlugin from './VariablePickerPlugin';

const VariablePickerModule = {
  __init__: ['variablePickerPlugin'],
  variablePickerPlugin: ['type', VariablePickerPlugin]
};

registerPlatformBpmnJSPlugin(VariableScannerModule);
registerPlatformBpmnJSPlugin(VariablePickerModule);

// Minimal client extension to pass modeler config API into the bpmn-js module.
// The bpmn-js DI container doesn't have access to the modeler's config/subscribe APIs,
// so we bridge them via bpmn.modeler.configure (for config) and bpmn.modeler.created (for tab file).
class ConfigBridge {
  constructor(props) {
    const { subscribe, config } = props;

    subscribe('bpmn.modeler.configure', (event) => {
      const { middlewares } = event;
      middlewares.push((options) => ({
        ...options,
        variablePickerConfigApi: config
      }));
    });

    subscribe('bpmn.modeler.created', (event) => {
      const { modeler, tab } = event;
      const plugin = modeler.get('variablePickerPlugin');
      if (plugin && tab && tab.file) {
        plugin.setTabFile(tab.file);
      }
    });
  }

  render() {
    return null;
  }
}

// Mark as React class component so the modeler's React can instantiate it
// without needing to import React in this bundle
ConfigBridge.prototype.isReactComponent = {};

registerClientExtension(ConfigBridge);
