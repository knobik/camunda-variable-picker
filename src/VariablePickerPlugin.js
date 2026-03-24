import React, { PureComponent } from 'react';

import VariableScannerModule from './VariableScannerModule';
import DragDropManager from './DragDropManager';
import ApiClient from './ApiClient';
import { buildExpression, insertTextAtCursor } from './expressionUtils';
import { buildSpinExpression } from './SpinExpressionBuilder';
import { renderPanel, destroyPanel } from './PanelRenderer';

export default class VariablePickerPlugin extends PureComponent {

  constructor(props) {
    super(props);

    this.state = {
      variables: [],
      apiVariables: [],
      panelOpen: false,
      searchQuery: '',
      collapsedCategories: {},
      collapsedPaths: {},
      isBpmnTab: false,
      panelPosition: null,
      apiStatus: 'disconnected', // disconnected | loading | connected | error
      apiError: null,
      endpointUrl: null,
      processInstanceId: null
    };

    this._modeler = null;
    this._activeTab = null;
    this._dragDropManager = new DragDropManager();
    this._apiClient = null;
    this._activeField = null;
    this._focusCount = 0;
    this._highlightedIndex = -1;

    this._onDocumentClick = (e) => {
      if (!this.state.panelOpen) return;
      const panel = document.querySelector('.variable-picker-panel');
      const propsContainer = document.querySelector('.properties-container');
      if (panel && panel.contains(e.target)) return;
      if (propsContainer && propsContainer.contains(e.target)) return;
      this._focusCount = 0;
      this._highlightedIndex = -1;
      this.setState({ panelOpen: false });
    };

    this._onKeyDown = (e) => {
      if (!this.state.panelOpen) return;

      if (e.key === 'Escape') {
        this._highlightedIndex = -1;
        this.setState({ panelOpen: false });
        return;
      }

      // Get all draggable items in the panel
      const items = document.querySelectorAll('.variable-picker-panel .variable-picker-item, .variable-picker-panel .variable-picker-tree-node');
      if (!items.length) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        this._highlightedIndex = Math.min(this._highlightedIndex + 1, items.length - 1);
        this._updateHighlight(items);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        this._highlightedIndex = Math.max(this._highlightedIndex - 1, 0);
        this._updateHighlight(items);
      } else if (e.key === 'Enter' && this._highlightedIndex >= 0) {
        e.preventDefault();
        const item = items[this._highlightedIndex];
        if (item && this._activeField) {
          // Read the variable data from the item and insert
          const varData = item.dataset.variable;
          const varName = item.dataset.varName;
          if (varData) {
            const variable = JSON.parse(varData);
            const expr = buildExpression(variable, this._activeField);
            insertTextAtCursor(this._activeField, expr);
            this._activeField.focus();
          } else if (varName) {
            const path = JSON.parse(item.dataset.path || '[]');
            const isLeaf = item.dataset.leaf === 'true';
            const spinExpr = buildSpinExpression(varName, path, isLeaf);
            const expr = buildExpression({ name: varName, spinExpression: spinExpr }, this._activeField);
            insertTextAtCursor(this._activeField, expr);
            this._activeField.focus();
          }
        }
      }
    };

    document.addEventListener('mousedown', this._onDocumentClick, true);
    document.addEventListener('keydown', this._onKeyDown, true);

    const { subscribe } = props;

    subscribe('bpmn.modeler.configure', (event) => {
      const { middlewares } = event;
      middlewares.push((config) => {
        const additionalModules = config.additionalModules || [];
        return {
          ...config,
          additionalModules: [...additionalModules, VariableScannerModule]
        };
      });
    });

    subscribe('bpmn.modeler.created', (event) => {
      const { modeler, tab } = event;
      this._modeler = modeler;
      this._activeTab = tab;

      modeler.on('variableScanner.variablesChanged', (e) => {
        this.setState({ variables: e.variables });
      });

      this._attachDragDrop();
      this._initApiClient(tab);
    });

    subscribe('app.activeTabChanged', ({ activeTab }) => {
      const isBpmn = activeTab.type === 'bpmn';
      this._activeTab = activeTab;
      this.setState({
        isBpmnTab: isBpmn, panelOpen: false,
        apiVariables: [], apiStatus: 'disconnected', endpointUrl: null
      });

      if (isBpmn) {
        this._attachDragDrop();
        this._initApiClient(activeTab);
      } else {
        this._dragDropManager.detach();
      }
    });
  }

  componentDidUpdate() {
    this._renderOverlayPanel();
  }

  componentWillUnmount() {
    this._dragDropManager.detach();
    document.removeEventListener('mousedown', this._onDocumentClick, true);
    document.removeEventListener('keydown', this._onKeyDown, true);
    destroyPanel();
  }

  _updateHighlight(items) {
    items.forEach((item, i) => {
      item.classList.toggle('variable-picker-item-highlighted', i === this._highlightedIndex);
    });

    // Scroll highlighted item into view
    if (this._highlightedIndex >= 0 && items[this._highlightedIndex]) {
      items[this._highlightedIndex].scrollIntoView({ block: 'nearest' });
    }
  }

  async _initApiClient(tab) {
    const { config } = this.props;

    try {
      const endpoints = await config.get('camundaEngineEndpoints', []);
      const tabConfig = await config.getForFile(tab.file, 'deployment-tool');

      if (!tabConfig || !tabConfig.endpointId || endpoints.length === 0) {
        // Fallback: if no per-file config, use the first endpoint
        if (endpoints.length > 0) {
          const endpoint = endpoints[0];
          this._apiClient = new ApiClient(endpoint);
          this.setState({ endpointUrl: endpoint.url, apiStatus: 'disconnected' });
          this._fetchApiVariables();
          return;
        }

        this.setState({ apiStatus: 'disconnected', endpointUrl: null });
        return;
      }

      const endpoint = endpoints.find(ep => ep.id === tabConfig.endpointId);
      if (!endpoint) {
        this.setState({ apiStatus: 'disconnected', endpointUrl: null });
        return;
      }

      this._apiClient = new ApiClient(endpoint);
      this.setState({ endpointUrl: endpoint.url, apiStatus: 'disconnected' });

      // Auto-fetch variables
      this._fetchApiVariables();
    } catch (err) {
      console.warn('[VariablePicker] Failed to init API client', err);
      this.setState({ apiStatus: 'error', apiError: err.message });
    }
  }

  async _fetchApiVariables() {
    if (!this._apiClient || !this._modeler) return;

    this.setState({ apiStatus: 'loading', apiError: null });

    try {
      // Get process definition key from the BPMN model
      const canvas = this._modeler.get('canvas');
      const rootElement = canvas.getRootElement();
      const processId = rootElement.businessObject.get('id');

      if (!processId) {
        this.setState({ apiStatus: 'error', apiError: 'No process ID found' });
        return;
      }

      // Get latest process instance
      const instance = await this._apiClient.getLatestProcessInstance(processId);

      if (!instance) {
        this.setState({
          apiStatus: 'connected',
          apiVariables: [],
          processInstanceId: null
        });
        return;
      }

      // Fetch variables for that instance
      const apiVars = await this._apiClient.getVariables(instance.id);

      this.setState({
        apiStatus: 'connected',
        apiVariables: apiVars,
        processInstanceId: instance.id
      });
    } catch (err) {
      console.warn('[VariablePicker] API fetch failed', err);
      this.setState({ apiStatus: 'error', apiError: err.message });
    }
  }

  _getMergedVariables() {
    const { variables, apiVariables } = this.state;

    // Merge: scanned variables first, then API-only variables
    const merged = new Map();

    for (const v of variables) {
      merged.set(v.name, v);
    }

    for (const v of apiVariables) {
      if (merged.has(v.name)) {
        // API data enriches scanned variable — update type and jsonStructure
        const existing = merged.get(v.name);
        const updates = {};

        // API always has accurate type info — use it over static 'string' guess
        if (existing.type === 'string' && v.type !== 'string') {
          updates.type = v.type;
        }
        if (v.type === 'json' && v.jsonStructure) {
          updates.type = 'json';
          updates.jsonStructure = v.jsonStructure;
        }

        updates.apiEnriched = true;
        if (v.value !== undefined) {
          updates.value = v.value;
        }

        merged.set(v.name, { ...existing, ...updates });
      } else {
        merged.set(v.name, v);
      }
    }

    const result = Array.from(merged.values());
    result.sort((a, b) => a.name.localeCompare(b.name));
    return result;
  }

  _attachDragDrop() {
    setTimeout(() => {
      const container = document.querySelector('.properties-container');
      if (container) {
        this._dragDropManager.attach(
          container,
          (field) => this._onFieldFocus(field),
          () => this._onFieldBlur()
        );
      }
    }, 500);
  }

  _onFieldFocus(field) {
    this._activeField = field;
    this._focusCount++;

    const propsPanel = document.querySelector('.properties-container');
    if (!propsPanel) return;

    const panelRect = propsPanel.getBoundingClientRect();
    const fieldRect = field.getBoundingClientRect();

    // Account for status bar (~30px) at the bottom
    const statusBarHeight = 30;
    const bottomLimit = window.innerHeight - statusBarHeight;
    const panelHeight = 600;
    let top = fieldRect.top;
    if (top + panelHeight > bottomLimit) {
      top = bottomLimit - panelHeight;
    }
    top = Math.max(top, 40);

    this._highlightedIndex = -1;
    this.setState({
      panelOpen: true,
      panelPosition: {
        top,
        left: panelRect.left - 440,
        maxHeight: Math.min(panelHeight, bottomLimit - top)
      }
    });
  }

  _onFieldBlur() {
    this._focusCount--;
  }

  _onDragStart(e, variable) {
    this._dragDropManager.setDragging(true);

    e.dataTransfer.setData('application/variable-picker', JSON.stringify(variable));
    e.dataTransfer.effectAllowed = 'copy';

    const ghost = document.createElement('div');
    ghost.className = 'variable-picker-drag-ghost';
    ghost.textContent = variable.spinExpression
      ? '${' + variable.spinExpression + '}'
      : '${' + variable.name + '}';
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 0, 0);
    setTimeout(() => document.body.removeChild(ghost), 0);
  }

  _onDragEnd() {
    this._dragDropManager.setDragging(false);
  }

  _renderOverlayPanel() {
    const { panelOpen, panelPosition, searchQuery, collapsedCategories, collapsedPaths, isBpmnTab,
      apiStatus, apiError, endpointUrl, processInstanceId } = this.state;

    if (!isBpmnTab || !panelOpen || !panelPosition) {
      destroyPanel();
      return;
    }

    const mergedVariables = this._getMergedVariables();

    renderPanel({
      position: panelPosition,
      variables: mergedVariables,
      searchQuery,
      collapsedCategories,
      collapsedPaths,
      apiStatus,
      apiError,
      endpointUrl,
      processInstanceId,
      onSearchChange: (query) => this.setState({ searchQuery: query }),
      onToggleCategory: (cat) => this.setState((s) => ({
        collapsedCategories: { ...s.collapsedCategories, [cat]: !s.collapsedCategories[cat] }
      })),
      onTogglePath: (pathKey) => this.setState((s) => ({
        collapsedPaths: { ...s.collapsedPaths, [pathKey]: !s.collapsedPaths[pathKey] }
      })),
      onDragStart: (e, variable) => this._onDragStart(e, variable),
      onDragEnd: () => this._onDragEnd(),
      onRefreshApi: () => this._fetchApiVariables()
    });
  }

  render() {
    return null;
  }
}
