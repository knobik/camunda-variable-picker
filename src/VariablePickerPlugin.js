import DragDropManager from './DragDropManager';
import ApiClient from './ApiClient';
import { buildExpression, insertTextAtCursor } from './expressionUtils';
import { buildSpinExpression } from './SpinExpressionBuilder';
import { renderPanel, destroyPanel } from './PanelRenderer';

export default class VariablePickerPlugin {

  constructor(eventBus, canvas, variableScanner, config) {
    this._eventBus = eventBus;
    this._canvas = canvas;
    this._variableScanner = variableScanner;
    this._configApi = config.variablePickerConfigApi || null;

    this._variables = [];
    this._apiVariables = [];
    this._panelOpen = false;
    this._searchQuery = '';
    this._collapsedCategories = {};
    this._collapsedPaths = {};
    this._panelPosition = null;
    this._apiStatus = 'disconnected';
    this._apiError = null;
    this._endpointUrl = null;
    this._processInstanceId = null;

    this._activeField = null;
    this._highlightedIndex = -1;
    this._dragDropManager = new DragDropManager();
    this._apiClient = null;
    this._tabFile = null;
    // Bind callbacks once so Preact gets stable references
    this._onSearchChange = (query) => {
      this._searchQuery = query;
      this._renderOverlayPanel();
    };
    this._onToggleCategory = (cat) => {
      this._collapsedCategories = {
        ...this._collapsedCategories,
        [cat]: !this._collapsedCategories[cat]
      };
      this._renderOverlayPanel();
    };
    this._onTogglePath = (pathKey) => {
      this._collapsedPaths = {
        ...this._collapsedPaths,
        [pathKey]: !this._collapsedPaths[pathKey]
      };
      this._renderOverlayPanel();
    };
    this._boundOnDragStart = (e, variable) => this._onDragStart(e, variable);
    this._boundOnDragEnd = () => this._onDragEnd();
    this._boundOnRefreshApi = () => this._fetchApiVariables();

    this._onDocumentClick = (e) => {
      if (!this._panelOpen) return;
      const panel = document.querySelector('.variable-picker-panel');
      const propsContainer = document.querySelector('.properties-container');
      if (panel && panel.contains(e.target)) return;
      if (propsContainer && propsContainer.contains(e.target)) return;
      this._highlightedIndex = -1;
      this._panelOpen = false;
      this._renderOverlayPanel();
    };

    this._onKeyDown = (e) => {
      if (!this._panelOpen) return;

      if (e.key === 'Escape') {
        this._highlightedIndex = -1;
        this._panelOpen = false;
        this._renderOverlayPanel();
        return;
      }

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
        this._insertFromHighlightedItem(items[this._highlightedIndex]);
      }
    };

    document.addEventListener('mousedown', this._onDocumentClick, true);
    document.addEventListener('keydown', this._onKeyDown, true);

    eventBus.on('variableScanner.variablesChanged', (e) => {
      if (this._variables === e.variables) return;
      this._variables = e.variables;
      this._renderOverlayPanel();
    });

    eventBus.on('diagram.destroy', () => {
      this._destroy();
    });

    this._dragDropManager.attach(
      document.body,
      (field) => this._onFieldFocus(field),
      () => this._onFieldBlur()
    );
  }

  setTabFile(file) {
    this._tabFile = file;
    this._initApiClient();
  }

  _insertFromHighlightedItem(item) {
    if (!item || !this._activeField) return;

    const varData = item.dataset.variable;
    const varName = item.dataset.varName;

    let variable;
    if (varData) {
      variable = JSON.parse(varData);
    } else if (varName) {
      const path = JSON.parse(item.dataset.path || '[]');
      const isLeaf = item.dataset.leaf === 'true';
      variable = { name: varName, spinExpression: buildSpinExpression(varName, path, isLeaf) };
    } else {
      return;
    }

    const expr = buildExpression(variable, this._activeField);
    insertTextAtCursor(this._activeField, expr);
    this._activeField.focus();
  }

  _updateHighlight(items) {
    items.forEach((item, i) => {
      item.classList.toggle('variable-picker-item-highlighted', i === this._highlightedIndex);
    });

    if (this._highlightedIndex >= 0 && items[this._highlightedIndex]) {
      items[this._highlightedIndex].scrollIntoView({ block: 'nearest' });
    }
  }

  _connectToEndpoint(endpoint) {
    this._apiClient = new ApiClient(endpoint);
    this._endpointUrl = endpoint.url;
    this._apiStatus = 'disconnected';
    this._fetchApiVariables();
  }

  async _initApiClient() {
    if (!this._configApi) return;

    try {
      const endpoints = await this._configApi.get('camundaEngineEndpoints', []);
      const tabConfig = this._tabFile
        ? await this._configApi.getForFile(this._tabFile, 'deployment-tool')
        : null;

      if (!tabConfig || !tabConfig.endpointId || endpoints.length === 0) {
        if (endpoints.length > 0) {
          this._connectToEndpoint(endpoints[0]);
          return;
        }

        this._apiStatus = 'disconnected';
        this._endpointUrl = null;
        return;
      }

      const endpoint = endpoints.find(ep => ep.id === tabConfig.endpointId);
      if (!endpoint) {
        this._apiStatus = 'disconnected';
        this._endpointUrl = null;
        return;
      }

      this._connectToEndpoint(endpoint);
    } catch (err) {
      console.warn('[VariablePicker] Failed to init API client', err);
      this._apiStatus = 'error';
      this._apiError = err.message;
    }
  }

  async _fetchApiVariables() {
    if (!this._apiClient) return;

    this._apiStatus = 'loading';
    this._apiError = null;
    this._renderOverlayPanel();

    try {
      const rootElement = this._canvas.getRootElement();
      const processId = rootElement.businessObject.get('id');

      if (!processId) {
        this._apiStatus = 'error';
        this._apiError = 'No process ID found';
        this._renderOverlayPanel();
        return;
      }

      const instance = await this._apiClient.getLatestProcessInstance(processId);

      if (!instance) {
        this._apiStatus = 'connected';
        this._apiVariables = [];
        this._processInstanceId = null;
        this._renderOverlayPanel();
        return;
      }

      const apiVars = await this._apiClient.getVariables(instance.id);

      this._apiStatus = 'connected';
      this._apiVariables = apiVars;
      this._processInstanceId = instance.id;
      this._renderOverlayPanel();
    } catch (err) {
      console.warn('[VariablePicker] API fetch failed', err);
      this._apiStatus = 'error';
      this._apiError = err.message;
      this._renderOverlayPanel();
    }
  }

  _getMergedVariables() {
    const merged = new Map();

    for (const v of this._variables) {
      merged.set(v.name, v);
    }

    for (const v of this._apiVariables) {
      if (merged.has(v.name)) {
        const existing = merged.get(v.name);
        const updates = {};

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

  _onFieldFocus(field) {
    this._activeField = field;

    const propsPanel = document.querySelector('.properties-container');
    if (!propsPanel) return;

    const panelRect = propsPanel.getBoundingClientRect();
    const fieldRect = field.getBoundingClientRect();

    const statusBarHeight = 30;
    const bottomLimit = window.innerHeight - statusBarHeight;
    const panelHeight = 600;
    let top = fieldRect.top;
    if (top + panelHeight > bottomLimit) {
      top = bottomLimit - panelHeight;
    }
    top = Math.max(top, 40);

    this._highlightedIndex = -1;
    this._panelOpen = true;
    this._panelPosition = {
      top,
      left: panelRect.left - 440,
      maxHeight: Math.min(panelHeight, bottomLimit - top)
    };
    this._renderOverlayPanel();
  }

  _onFieldBlur() {
    // intentionally empty — panel stays open until explicit close
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
    if (!this._panelOpen || !this._panelPosition) {
      destroyPanel();
      return;
    }

    const mergedVariables = this._getMergedVariables();

    renderPanel({
      position: this._panelPosition,
      variables: mergedVariables,
      searchQuery: this._searchQuery,
      collapsedCategories: this._collapsedCategories,
      collapsedPaths: this._collapsedPaths,
      apiStatus: this._apiStatus,
      apiError: this._apiError,
      endpointUrl: this._endpointUrl,
      processInstanceId: this._processInstanceId,
      onSearchChange: this._onSearchChange,
      onToggleCategory: this._onToggleCategory,
      onTogglePath: this._onTogglePath,
      onDragStart: this._boundOnDragStart,
      onDragEnd: this._boundOnDragEnd,
      onRefreshApi: this._boundOnRefreshApi
    });
  }

  _destroy() {
    this._dragDropManager.detach();
    document.removeEventListener('mousedown', this._onDocumentClick, true);
    document.removeEventListener('keydown', this._onKeyDown, true);
    destroyPanel();
  }
}

VariablePickerPlugin.$inject = ['eventBus', 'canvas', 'variableScanner', 'config'];
