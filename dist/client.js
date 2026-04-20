/******/ (() => { // webpackBootstrap
/******/ 	var __webpack_modules__ = ({

/***/ "./src/ApiClient.js"
/*!**************************!*\
  !*** ./src/ApiClient.js ***!
  \**************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ ApiClient)
/* harmony export */ });
/* harmony import */ var _SpinExpressionBuilder__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./SpinExpressionBuilder */ "./src/SpinExpressionBuilder.js");

const FETCH_TIMEOUT = 5000;

/**
 * Lightweight client for Camunda 7 REST API.
 * Fetches runtime variables from process history.
 */
class ApiClient {
  constructor(endpoint) {
    this._url = endpoint.url;
    this._authType = endpoint.authType;
    this._username = endpoint.username;
    this._password = endpoint.password;
    this._token = endpoint.token;
  }

  /**
   * Fetch the latest process instance for a given process definition key.
   * @param {string} processDefinitionKey
   * @returns {Promise<{id: string}|null>}
   */
  async getLatestProcessInstance(processDefinitionKey) {
    const params = new URLSearchParams({
      processDefinitionKey,
      sortBy: 'startTime',
      sortOrder: 'desc',
      maxResults: '1'
    });
    const response = await this._fetch('/history/process-instance?' + params.toString());
    if (!response.ok) {
      throw new Error('Failed to fetch process instances: ' + response.status);
    }
    const instances = await response.json();
    return instances.length > 0 ? instances[0] : null;
  }

  /**
   * Fetch all variable instances for a process instance.
   * @param {string} processInstanceId
   * @returns {Promise<Array<{name, type, category, source, jsonStructure?}>>}
   */
  async getVariables(processInstanceId) {
    const params = new URLSearchParams({
      processInstanceId,
      deserializeValues: 'false'
    });
    const response = await this._fetch('/history/variable-instance?' + params.toString());
    if (!response.ok) {
      throw new Error('Failed to fetch variables: ' + response.status);
    }
    const rawVars = await response.json();
    return rawVars.map(v => this._parseVariable(v));
  }
  _parseVariable(raw) {
    const variable = {
      name: raw.name,
      type: mapCamundaType(raw.type),
      value: raw.value,
      category: 'api-variable',
      source: {
        elementId: raw.activityInstanceId || 'process',
        elementName: 'Runtime (' + raw.state + ')',
        elementType: 'API'
      }
    };

    // For JSON/Object types, try to parse the value into a tree
    if ((raw.type === 'Json' || raw.type === 'Object') && raw.value) {
      try {
        const parsed = typeof raw.value === 'string' ? JSON.parse(raw.value) : raw.value;
        variable.type = 'json';
        variable.jsonStructure = (0,_SpinExpressionBuilder__WEBPACK_IMPORTED_MODULE_0__.buildJsonStructure)(parsed);
      } catch {
        // Not parseable — keep as string
      }
    }
    return variable;
  }
  async _fetch(path) {
    const url = this._url + path;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
    try {
      return await fetch(url, {
        headers: this._getHeaders(),
        signal: controller.signal
      });
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error('Request timed out');
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }
  _getHeaders() {
    const headers = {
      accept: 'application/json'
    };
    if (this._authType === 'bearer' && this._token) {
      headers.authorization = 'Bearer ' + this._token;
    } else if (this._authType === 'basic' && this._username && this._password) {
      headers.authorization = 'Basic ' + window.btoa(this._username + ':' + this._password);
    }
    return headers;
  }
}
function mapCamundaType(camundaType) {
  switch (camundaType) {
    case 'String':
      return 'string';
    case 'Integer':
    case 'Long':
    case 'Short':
    case 'Double':
      return 'number';
    case 'Boolean':
      return 'boolean';
    case 'Date':
      return 'date';
    case 'Json':
      return 'json';
    case 'Object':
      return 'json';
    case 'Null':
      return 'null';
    default:
      return 'string';
  }
}

/***/ },

/***/ "./src/DragDropManager.js"
/*!********************************!*\
  !*** ./src/DragDropManager.js ***!
  \********************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ DragDropManager)
/* harmony export */ });
/* harmony import */ var _expressionUtils__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./expressionUtils */ "./src/expressionUtils.js");

const DROP_HOVER_CLASS = 'variable-picker-drop-hover';
const INPUT_SELECTOR = ['input.bio-properties-panel-input[type="text"]', 'textarea.bio-properties-panel-input', '[contenteditable].bio-properties-panel-input'].join(', ');
class DragDropManager {
  constructor() {
    this._isDragging = false;
    this._propertiesContainer = null;
    this._onFieldFocus = null;
    this._onFieldBlur = null;
    this._handlers = null;
  }
  attach(propertiesContainer, onFieldFocus, onFieldBlur) {
    this.detach();
    this._propertiesContainer = propertiesContainer;
    this._onFieldFocus = onFieldFocus;
    this._onFieldBlur = onFieldBlur;
    this._handlers = {
      focusin: e => {
        const input = e.target.closest(INPUT_SELECTOR);
        if (input && this._onFieldFocus) {
          this._onFieldFocus(input);
        }
      },
      focusout: e => {
        const input = e.target.closest(INPUT_SELECTOR);
        if (input && this._onFieldBlur) {
          this._onFieldBlur(input);
        }
      },
      dragover: e => {
        const input = e.target.closest(INPUT_SELECTOR);
        if (input) {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'copy';
        }
      },
      dragenter: e => {
        const input = e.target.closest(INPUT_SELECTOR);
        if (input) {
          e.preventDefault();
          input.classList.add(DROP_HOVER_CLASS);
        }
      },
      dragleave: e => {
        const input = e.target.closest(INPUT_SELECTOR);
        if (input) {
          input.classList.remove(DROP_HOVER_CLASS);
        }
      },
      drop: e => {
        const input = e.target.closest(INPUT_SELECTOR);
        if (!input) return;
        e.preventDefault();
        input.classList.remove(DROP_HOVER_CLASS);
        const data = e.dataTransfer.getData('application/variable-picker');
        if (!data) return;
        let variable;
        try {
          variable = JSON.parse(data);
        } catch {
          return;
        }
        const expression = (0,_expressionUtils__WEBPACK_IMPORTED_MODULE_0__.buildExpression)(variable, input);
        (0,_expressionUtils__WEBPACK_IMPORTED_MODULE_0__.insertTextAtCursor)(input, expression);
        this._isDragging = false;
      }
    };
    for (const [event, handler] of Object.entries(this._handlers)) {
      propertiesContainer.addEventListener(event, handler, true);
    }
  }
  detach() {
    if (this._propertiesContainer && this._handlers) {
      for (const [event, handler] of Object.entries(this._handlers)) {
        this._propertiesContainer.removeEventListener(event, handler, true);
      }
    }
    this._handlers = null;
    this._propertiesContainer = null;
  }
  get isDragging() {
    return this._isDragging;
  }
  setDragging(value) {
    this._isDragging = value;
  }
}

/***/ },

/***/ "./src/Icons.js"
/*!**********************!*\
  !*** ./src/Icons.js ***!
  \**********************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   ChevronIcon: () => (/* binding */ ChevronIcon),
/* harmony export */   EmptySetIcon: () => (/* binding */ EmptySetIcon),
/* harmony export */   LightningIcon: () => (/* binding */ LightningIcon),
/* harmony export */   RefreshIcon: () => (/* binding */ RefreshIcon),
/* harmony export */   SearchIcon: () => (/* binding */ SearchIcon),
/* harmony export */   SpinnerIcon: () => (/* binding */ SpinnerIcon)
/* harmony export */ });
/* harmony import */ var _bpmn_io_properties_panel_preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @bpmn-io/properties-panel/preact/jsx-runtime */ "./node_modules/camunda-modeler-plugin-helpers/vendor/@bpmn-io/properties-panel/preact/jsx-runtime.js");
/* harmony import */ var _bpmn_io_properties_panel_preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_bpmn_io_properties_panel_preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__);

const SIZE = {
  width: '1em',
  height: '1em',
  viewBox: '0 0 16 16',
  fill: 'none',
  stroke: 'currentColor'
};
const FILL = {
  width: '1em',
  height: '1em',
  viewBox: '0 0 16 16',
  fill: 'currentColor'
};
function SearchIcon() {
  return (0,_bpmn_io_properties_panel_preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("svg", {
    ...SIZE,
    "stroke-width": "1.5",
    children: [(0,_bpmn_io_properties_panel_preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("circle", {
      cx: "7",
      cy: "7",
      r: "4.5"
    }), (0,_bpmn_io_properties_panel_preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("line", {
      x1: "10.5",
      y1: "10.5",
      x2: "14",
      y2: "14"
    })]
  });
}
function EmptySetIcon() {
  return (0,_bpmn_io_properties_panel_preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("svg", {
    ...SIZE,
    "stroke-width": "1.5",
    children: [(0,_bpmn_io_properties_panel_preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("circle", {
      cx: "8",
      cy: "8",
      r: "5.5"
    }), (0,_bpmn_io_properties_panel_preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("line", {
      x1: "4",
      y1: "12",
      x2: "12",
      y2: "4"
    })]
  });
}
function RefreshIcon() {
  return (0,_bpmn_io_properties_panel_preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)("svg", {
    ...SIZE,
    "stroke-width": "1.5",
    "stroke-linecap": "round",
    children: [(0,_bpmn_io_properties_panel_preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("path", {
      d: "M13 8A5 5 0 1 1 8 3"
    }), (0,_bpmn_io_properties_panel_preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("polyline", {
      points: "13 3 13 7 9 7"
    })]
  });
}
function ChevronIcon() {
  return (0,_bpmn_io_properties_panel_preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("svg", {
    ...FILL,
    viewBox: "0 0 10 10",
    children: (0,_bpmn_io_properties_panel_preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("path", {
      d: "M2 3.5L5 7L8 3.5"
    })
  });
}
function SpinnerIcon() {
  return (0,_bpmn_io_properties_panel_preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("svg", {
    ...SIZE,
    "stroke-width": "1.5",
    "stroke-linecap": "round",
    class: "variable-picker-spinner",
    children: (0,_bpmn_io_properties_panel_preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("path", {
      d: "M8 3a5 5 0 1 0 5 5"
    })
  });
}
function LightningIcon() {
  return (0,_bpmn_io_properties_panel_preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("svg", {
    ...FILL,
    viewBox: "0 0 10 16",
    children: (0,_bpmn_io_properties_panel_preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("path", {
      d: "M6 0L1 9h4l-1 7 5-9H5l1-7z"
    })
  });
}

/***/ },

/***/ "./src/PanelRenderer.js"
/*!******************************!*\
  !*** ./src/PanelRenderer.js ***!
  \******************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   destroyPanel: () => (/* binding */ destroyPanel),
/* harmony export */   renderPanel: () => (/* binding */ renderPanel)
/* harmony export */ });
/* harmony import */ var _bpmn_io_properties_panel_preact__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @bpmn-io/properties-panel/preact */ "./node_modules/camunda-modeler-plugin-helpers/vendor/@bpmn-io/properties-panel/preact/index.js");
/* harmony import */ var _bpmn_io_properties_panel_preact__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_bpmn_io_properties_panel_preact__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _SpinExpressionBuilder__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./SpinExpressionBuilder */ "./src/SpinExpressionBuilder.js");
/* harmony import */ var _Icons__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./Icons */ "./src/Icons.js");
/* harmony import */ var _bpmn_io_properties_panel_preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @bpmn-io/properties-panel/preact/jsx-runtime */ "./node_modules/camunda-modeler-plugin-helpers/vendor/@bpmn-io/properties-panel/preact/jsx-runtime.js");
/* harmony import */ var _bpmn_io_properties_panel_preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(_bpmn_io_properties_panel_preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__);




const CATEGORY_LABELS = {
  'output-mapping': 'Output Mappings',
  'input-mapping': 'Input Mappings',
  'form-field': 'Form Fields',
  'result-variable': 'Result Variables',
  'script-variable': 'Script Variables',
  'multi-instance': 'Multi-Instance',
  'listener-variable': 'Listener Variables',
  'api-variable': 'API Variables'
};
const CATEGORY_ORDER = ['api-variable', 'output-mapping', 'input-mapping', 'form-field', 'result-variable', 'script-variable', 'multi-instance', 'listener-variable'];
const TYPE_ICONS = {
  'string': 'S',
  'number': '#',
  'boolean': '?',
  'date': 'D',
  'json': '{}',
  'object': '{}',
  'array': '[]',
  'null': 'N'
};
let panelEl = null;
function renderPanel(props) {
  if (!panelEl) {
    panelEl = document.createElement('div');
    panelEl.className = 'variable-picker-portal';
    document.body.appendChild(panelEl);
  }
  (0,_bpmn_io_properties_panel_preact__WEBPACK_IMPORTED_MODULE_0__.render)((0,_bpmn_io_properties_panel_preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(VariablePanel, {
    ...props
  }), panelEl);
}
function destroyPanel() {
  if (panelEl) {
    (0,_bpmn_io_properties_panel_preact__WEBPACK_IMPORTED_MODULE_0__.render)(null, panelEl);
    panelEl.remove();
    panelEl = null;
  }
}
function VariablePanel({
  position,
  variables,
  searchQuery,
  collapsedCategories,
  collapsedPaths,
  onSearchChange,
  onToggleCategory,
  onTogglePath,
  onDragStart,
  onDragEnd,
  apiStatus,
  apiError,
  endpointUrl,
  processInstanceId,
  onRefreshApi
}) {
  const query = (searchQuery || '').toLowerCase().trim();
  const filtered = query ? variables.filter(v => v.name.toLowerCase().includes(query) || matchesJsonStructure(v.jsonStructure, query)) : variables;
  const grouped = {};
  for (const v of filtered) {
    const cat = v.category || 'other';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(v);
  }
  const style = {
    position: 'fixed',
    top: position.top + 'px',
    left: position.left + 'px',
    width: '440px',
    maxHeight: position.maxHeight + 'px',
    zIndex: 1000,
    display: 'flex'
  };
  const statusDotClass = 'variable-picker-status-dot status-' + (apiStatus || 'disconnected');
  return (0,_bpmn_io_properties_panel_preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsxs)("div", {
    class: "variable-picker-panel",
    style: style,
    children: [(0,_bpmn_io_properties_panel_preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsxs)("div", {
      class: "variable-picker-header",
      children: [(0,_bpmn_io_properties_panel_preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("span", {
        class: "variable-picker-title",
        children: "Variables"
      }), (0,_bpmn_io_properties_panel_preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("span", {
        class: "variable-picker-count",
        children: filtered.length
      })]
    }), (0,_bpmn_io_properties_panel_preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsxs)("div", {
      class: "variable-picker-search",
      children: [(0,_bpmn_io_properties_panel_preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("span", {
        class: "variable-picker-search-icon",
        children: (0,_bpmn_io_properties_panel_preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(_Icons__WEBPACK_IMPORTED_MODULE_2__.SearchIcon, {})
      }), (0,_bpmn_io_properties_panel_preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("input", {
        type: "text",
        placeholder: "Search variables...",
        class: "variable-picker-search-input",
        value: searchQuery || '',
        onInput: e => onSearchChange(e.target.value),
        onMouseDown: e => e.stopPropagation()
      })]
    }), (0,_bpmn_io_properties_panel_preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsxs)("div", {
      class: "variable-picker-body",
      children: [filtered.length === 0 && (0,_bpmn_io_properties_panel_preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsxs)("div", {
        class: "variable-picker-empty",
        children: [(0,_bpmn_io_properties_panel_preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("span", {
          class: "variable-picker-empty-icon",
          children: variables.length === 0 ? (0,_bpmn_io_properties_panel_preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(_Icons__WEBPACK_IMPORTED_MODULE_2__.EmptySetIcon, {}) : (0,_bpmn_io_properties_panel_preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(_Icons__WEBPACK_IMPORTED_MODULE_2__.SearchIcon, {})
        }), variables.length === 0 ? 'No variables found in this process.' : 'No variables match your search.']
      }), CATEGORY_ORDER.map(category => {
        const vars = grouped[category];
        if (!vars || vars.length === 0) return null;
        return (0,_bpmn_io_properties_panel_preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(CategoryGroup, {
          category: category,
          variables: vars,
          isCollapsed: collapsedCategories[category],
          collapsedPaths: collapsedPaths,
          onToggleCategory: onToggleCategory,
          onTogglePath: onTogglePath,
          onDragStart: onDragStart,
          onDragEnd: onDragEnd,
          searchQuery: query
        }, category);
      })]
    }), (0,_bpmn_io_properties_panel_preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsxs)("div", {
      class: "variable-picker-footer",
      children: [(0,_bpmn_io_properties_panel_preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("span", {
        class: "variable-picker-footer-label",
        children: "API"
      }), (0,_bpmn_io_properties_panel_preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("span", {
        class: statusDotClass
      }), endpointUrl ? (0,_bpmn_io_properties_panel_preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("span", {
        class: "variable-picker-footer-url",
        title: endpointUrl,
        children: endpointUrl.replace(/^https?:\/\//, '')
      }) : (0,_bpmn_io_properties_panel_preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("span", {
        class: "variable-picker-footer-url variable-picker-footer-no-endpoint",
        children: "No endpoint"
      }), processInstanceId && (0,_bpmn_io_properties_panel_preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("span", {
        class: "variable-picker-footer-pid",
        title: 'Process Instance: ' + processInstanceId,
        children: processInstanceId.substring(0, 8) + '...'
      }), apiError && (0,_bpmn_io_properties_panel_preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("span", {
        class: "variable-picker-footer-error",
        title: apiError,
        children: "!"
      }), (0,_bpmn_io_properties_panel_preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("button", {
        class: "variable-picker-footer-refresh",
        onClick: onRefreshApi,
        disabled: apiStatus === 'loading' || !endpointUrl,
        title: "Refresh API variables",
        children: apiStatus === 'loading' ? (0,_bpmn_io_properties_panel_preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(_Icons__WEBPACK_IMPORTED_MODULE_2__.SpinnerIcon, {}) : (0,_bpmn_io_properties_panel_preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(_Icons__WEBPACK_IMPORTED_MODULE_2__.RefreshIcon, {})
      })]
    })]
  });
}
function CategoryGroup({
  category,
  variables,
  isCollapsed,
  collapsedPaths,
  onToggleCategory,
  onTogglePath,
  onDragStart,
  onDragEnd,
  searchQuery
}) {
  return (0,_bpmn_io_properties_panel_preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsxs)("div", {
    class: "variable-picker-category",
    children: [(0,_bpmn_io_properties_panel_preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsxs)("div", {
      class: "variable-picker-category-header",
      onClick: () => onToggleCategory(category),
      children: [(0,_bpmn_io_properties_panel_preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("span", {
        class: 'variable-picker-chevron' + (isCollapsed ? ' collapsed' : ''),
        children: (0,_bpmn_io_properties_panel_preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(_Icons__WEBPACK_IMPORTED_MODULE_2__.ChevronIcon, {})
      }), (0,_bpmn_io_properties_panel_preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("span", {
        class: "variable-picker-category-label",
        children: CATEGORY_LABELS[category] || category
      }), (0,_bpmn_io_properties_panel_preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("span", {
        class: "variable-picker-category-count",
        children: variables.length
      })]
    }), !isCollapsed && (0,_bpmn_io_properties_panel_preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("div", {
      class: "variable-picker-category-items",
      children: variables.map(variable => {
        if (variable.type === 'json' && variable.jsonStructure) {
          return (0,_bpmn_io_properties_panel_preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(JsonVariable, {
            variable: variable,
            collapsedPaths: collapsedPaths,
            onTogglePath: onTogglePath,
            onDragStart: onDragStart,
            onDragEnd: onDragEnd,
            searchQuery: searchQuery
          }, variable.name);
        }
        return (0,_bpmn_io_properties_panel_preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(SimpleVariable, {
          variable: variable,
          onDragStart: onDragStart,
          onDragEnd: onDragEnd
        }, variable.name);
      })
    })]
  });
}
function SimpleVariable({
  variable,
  onDragStart,
  onDragEnd
}) {
  const icon = TYPE_ICONS[variable.type] || '?';
  const valueStr = formatValue(variable.value);
  return (0,_bpmn_io_properties_panel_preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsxs)("div", {
    class: "variable-picker-item",
    draggable: true,
    "data-variable": JSON.stringify(variable),
    onDragStart: e => onDragStart(e, variable),
    onDragEnd: onDragEnd,
    title: variable.name + ' (' + variable.type + ')' + (variable.value !== undefined ? '\nValue: ' + String(variable.value) : '') + '\nFrom: ' + variable.source.elementName,
    children: [(0,_bpmn_io_properties_panel_preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("span", {
      class: "variable-picker-toggle-spacer"
    }), (0,_bpmn_io_properties_panel_preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("span", {
      class: 'variable-picker-type-icon type-' + variable.type,
      children: icon
    }), (0,_bpmn_io_properties_panel_preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsxs)("div", {
      class: "variable-picker-item-content",
      children: [(0,_bpmn_io_properties_panel_preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsxs)("div", {
        class: "variable-picker-item-row",
        children: [(0,_bpmn_io_properties_panel_preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("span", {
          class: "variable-picker-item-name",
          children: variable.name
        }), variable.apiEnriched && (0,_bpmn_io_properties_panel_preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("span", {
          class: "variable-picker-api-badge",
          children: (0,_bpmn_io_properties_panel_preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(_Icons__WEBPACK_IMPORTED_MODULE_2__.LightningIcon, {})
        }), (0,_bpmn_io_properties_panel_preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("span", {
          class: "variable-picker-item-type",
          children: variable.type
        })]
      }), valueStr && (0,_bpmn_io_properties_panel_preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("div", {
        class: "variable-picker-item-value-row",
        children: valueStr
      })]
    })]
  });
}
function matchesJsonStructure(node, query) {
  if (!node) return false;
  if (node.type === 'object' && node.children) {
    for (const key of Object.keys(node.children)) {
      if (key.toLowerCase().includes(query)) return true;
      if (matchesJsonStructure(node.children[key], query)) return true;
    }
  }
  if (node.type === 'array' && node.children) {
    for (const child of node.children) {
      if (matchesJsonStructure(child, query)) return true;
    }
  }
  if (node.value !== undefined && String(node.value).toLowerCase().includes(query)) return true;
  return false;
}
function formatValue(value) {
  if (value === undefined || value === null) return null;
  const str = String(value);
  if (str.length > 50) return str.substring(0, 47) + '...';
  return str;
}
function JsonVariable({
  variable,
  collapsedPaths,
  onTogglePath,
  onDragStart,
  onDragEnd,
  searchQuery
}) {
  const pathKey = variable.name;
  const isExpanded = searchQuery ? true : !collapsedPaths[pathKey];
  return (0,_bpmn_io_properties_panel_preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsxs)("div", {
    children: [(0,_bpmn_io_properties_panel_preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsxs)("div", {
      class: "variable-picker-item variable-picker-json-root",
      title: 'From: ' + variable.source.elementName + ' (' + variable.source.elementType + ')',
      children: [(0,_bpmn_io_properties_panel_preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("span", {
        class: 'variable-picker-json-toggle' + (isExpanded ? '' : ' collapsed'),
        onClick: e => {
          e.stopPropagation();
          onTogglePath(pathKey);
        },
        children: (0,_bpmn_io_properties_panel_preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(_Icons__WEBPACK_IMPORTED_MODULE_2__.ChevronIcon, {})
      }), (0,_bpmn_io_properties_panel_preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsxs)("span", {
        class: "variable-picker-json-drag",
        draggable: true,
        onDragStart: e => onDragStart(e, variable),
        onDragEnd: onDragEnd,
        children: [(0,_bpmn_io_properties_panel_preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("span", {
          class: "variable-picker-type-icon type-json",
          children: '{}'
        }), (0,_bpmn_io_properties_panel_preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("span", {
          class: "variable-picker-item-name",
          children: variable.name
        }), (0,_bpmn_io_properties_panel_preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("span", {
          class: "variable-picker-item-type",
          children: "json"
        })]
      })]
    }), isExpanded && variable.jsonStructure && (0,_bpmn_io_properties_panel_preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("div", {
      class: "variable-picker-tree-children",
      style: {
        '--tree-guide-offset': '17px'
      },
      children: (0,_bpmn_io_properties_panel_preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(TreeChildren, {
        varName: variable.name,
        node: variable.jsonStructure,
        parentPath: [],
        collapsedPaths: collapsedPaths,
        onTogglePath: onTogglePath,
        onDragStart: onDragStart,
        onDragEnd: onDragEnd,
        searchQuery: searchQuery,
        depth: 1
      })
    })]
  });
}
function TreeChildren({
  varName,
  node,
  parentPath,
  collapsedPaths,
  onTogglePath,
  onDragStart,
  onDragEnd,
  searchQuery,
  depth
}) {
  if (node.type === 'object' && node.children) {
    const entries = Object.entries(node.children).filter(([key, child]) => {
      if (!searchQuery) return true;
      return key.toLowerCase().includes(searchQuery) || matchesJsonStructure(child, searchQuery);
    });
    if (entries.length === 0) return null;
    return (0,_bpmn_io_properties_panel_preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("div", {
      children: entries.map(([key, child]) => {
        const path = [...parentPath, key];
        return (0,_bpmn_io_properties_panel_preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(TreeNode, {
          varName: varName,
          label: key,
          node: child,
          path: path,
          collapsedPaths: collapsedPaths,
          onTogglePath: onTogglePath,
          onDragStart: onDragStart,
          onDragEnd: onDragEnd,
          searchQuery: searchQuery,
          depth: depth
        }, path.join('.'));
      })
    });
  }
  if (node.type === 'array' && node.children) {
    const items = node.children.map((child, i) => ({
      child,
      i
    })).filter(({
      child
    }) => {
      if (!searchQuery) return true;
      return matchesJsonStructure(child, searchQuery);
    });
    if (items.length === 0) return null;
    return (0,_bpmn_io_properties_panel_preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("div", {
      children: items.map(({
        child,
        i
      }) => {
        const path = [...parentPath, '[' + i + ']'];
        return (0,_bpmn_io_properties_panel_preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(TreeNode, {
          varName: varName,
          label: '[' + i + ']',
          node: child,
          path: path,
          collapsedPaths: collapsedPaths,
          onTogglePath: onTogglePath,
          onDragStart: onDragStart,
          onDragEnd: onDragEnd,
          searchQuery: searchQuery,
          depth: depth
        }, path.join('.'));
      })
    });
  }
  return null;
}
function TreeNode({
  varName,
  label,
  node,
  path,
  collapsedPaths,
  onTogglePath,
  onDragStart,
  onDragEnd,
  searchQuery,
  depth
}) {
  const pathKey = varName + '.' + path.join('.');
  const hasChildren = node.type === 'object' && node.children && Object.keys(node.children).length > 0 || node.type === 'array' && node.children && node.children.length > 0;
  const isLeaf = !hasChildren;
  const isExpanded = searchQuery ? true : !collapsedPaths[pathKey];
  const icon = TYPE_ICONS[node.type] || '?';
  const spinExpr = (0,_SpinExpressionBuilder__WEBPACK_IMPORTED_MODULE_1__.buildSpinExpression)(varName, path, isLeaf);
  const dragData = {
    name: varName,
    spinExpression: spinExpr,
    isLeaf
  };
  return (0,_bpmn_io_properties_panel_preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsxs)("div", {
    children: [(0,_bpmn_io_properties_panel_preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsxs)("div", {
      class: "variable-picker-tree-node",
      draggable: true,
      "data-var-name": varName,
      "data-path": JSON.stringify(path),
      "data-leaf": String(isLeaf),
      onDragStart: e => onDragStart(e, dragData),
      onDragEnd: onDragEnd,
      title: 'SPIN: ' + spinExpr,
      children: [hasChildren ? (0,_bpmn_io_properties_panel_preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("span", {
        class: 'variable-picker-tree-toggle' + (isExpanded ? '' : ' collapsed'),
        onClick: e => {
          e.stopPropagation();
          onTogglePath(pathKey);
        },
        children: (0,_bpmn_io_properties_panel_preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(_Icons__WEBPACK_IMPORTED_MODULE_2__.ChevronIcon, {})
      }) : (0,_bpmn_io_properties_panel_preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("span", {
        class: "variable-picker-tree-leaf-spacer"
      }), (0,_bpmn_io_properties_panel_preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("span", {
        class: 'variable-picker-type-icon type-' + node.type,
        children: icon
      }), (0,_bpmn_io_properties_panel_preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsxs)("div", {
        class: "variable-picker-item-content",
        children: [(0,_bpmn_io_properties_panel_preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsxs)("div", {
          class: "variable-picker-item-row",
          children: [(0,_bpmn_io_properties_panel_preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("span", {
            class: "variable-picker-tree-label",
            children: label
          }), (0,_bpmn_io_properties_panel_preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("span", {
            class: "variable-picker-item-type",
            children: node.type
          })]
        }), isLeaf && node.value !== undefined && (0,_bpmn_io_properties_panel_preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("div", {
          class: "variable-picker-item-value-row",
          children: formatValue(node.value)
        })]
      })]
    }), hasChildren && isExpanded && (0,_bpmn_io_properties_panel_preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)("div", {
      class: "variable-picker-tree-children",
      children: (0,_bpmn_io_properties_panel_preact_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(TreeChildren, {
        varName: varName,
        node: node,
        parentPath: path,
        collapsedPaths: collapsedPaths,
        onTogglePath: onTogglePath,
        onDragStart: onDragStart,
        onDragEnd: onDragEnd,
        searchQuery: searchQuery,
        depth: depth + 1
      })
    })]
  });
}

/***/ },

/***/ "./src/SpinExpressionBuilder.js"
/*!**************************************!*\
  !*** ./src/SpinExpressionBuilder.js ***!
  \**************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   buildJsonStructure: () => (/* binding */ buildJsonStructure),
/* harmony export */   buildSpinExpression: () => (/* binding */ buildSpinExpression)
/* harmony export */ });
/**
 * Builds Camunda 7 SPIN expressions from a variable name and JSON property path.
 *
 * @param {string} variableName - The root variable name
 * @param {string[]} path - Array of path segments, e.g. ['customer', 'name'] or ['items', '[0]', 'productId']
 * @param {boolean} isLeaf - Whether this is a leaf (primitive) node — appends .value()
 * @returns {string} SPIN expression, e.g. S(order).prop('customer').prop('name').value()
 */
function buildSpinExpression(variableName, path, isLeaf) {
  let expr = 'S(' + variableName + ')';
  for (const segment of path) {
    const arrayMatch = segment.match(/^\[(\d+)\]$/);
    if (arrayMatch) {
      expr += '.elements().get(' + arrayMatch[1] + ')';
    } else {
      expr += ".prop('" + segment + "')";
    }
  }
  if (isLeaf) {
    expr += '.value()';
  }
  return expr;
}

/**
 * Build a JSON structure tree from a parsed JSON value.
 *
 * @param {*} value - Parsed JSON value
 * @returns {{ type: string, children?: object|array }}
 */
function buildJsonStructure(value) {
  if (value === null) {
    return {
      type: 'null',
      value: 'null'
    };
  }
  if (Array.isArray(value)) {
    const children = value.map(item => buildJsonStructure(item));
    return {
      type: 'array',
      children
    };
  }
  if (typeof value === 'object') {
    const children = {};
    for (const [key, val] of Object.entries(value)) {
      children[key] = buildJsonStructure(val);
    }
    return {
      type: 'object',
      children
    };
  }
  if (typeof value === 'boolean') {
    return {
      type: 'boolean',
      value: String(value)
    };
  }
  if (typeof value === 'number') {
    return {
      type: 'number',
      value: String(value)
    };
  }
  return {
    type: 'string',
    value: String(value)
  };
}

/***/ },

/***/ "./src/VariablePickerPlugin.js"
/*!*************************************!*\
  !*** ./src/VariablePickerPlugin.js ***!
  \*************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ VariablePickerPlugin)
/* harmony export */ });
/* harmony import */ var _DragDropManager__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./DragDropManager */ "./src/DragDropManager.js");
/* harmony import */ var _ApiClient__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./ApiClient */ "./src/ApiClient.js");
/* harmony import */ var _expressionUtils__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./expressionUtils */ "./src/expressionUtils.js");
/* harmony import */ var _SpinExpressionBuilder__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./SpinExpressionBuilder */ "./src/SpinExpressionBuilder.js");
/* harmony import */ var _PanelRenderer__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./PanelRenderer */ "./src/PanelRenderer.js");





class VariablePickerPlugin {
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
    this._dragDropManager = new _DragDropManager__WEBPACK_IMPORTED_MODULE_0__["default"]();
    this._apiClient = null;
    this._tabFile = null;
    // Bind callbacks once so Preact gets stable references
    this._onSearchChange = query => {
      this._searchQuery = query;
      this._renderOverlayPanel();
    };
    this._onToggleCategory = cat => {
      this._collapsedCategories = {
        ...this._collapsedCategories,
        [cat]: !this._collapsedCategories[cat]
      };
      this._renderOverlayPanel();
    };
    this._onTogglePath = pathKey => {
      this._collapsedPaths = {
        ...this._collapsedPaths,
        [pathKey]: !this._collapsedPaths[pathKey]
      };
      this._renderOverlayPanel();
    };
    this._boundOnDragStart = (e, variable) => this._onDragStart(e, variable);
    this._boundOnDragEnd = () => this._onDragEnd();
    this._boundOnRefreshApi = () => this._fetchApiVariables();
    this._onDocumentClick = e => {
      if (!this._panelOpen) return;
      const panel = document.querySelector('.variable-picker-panel');
      const propsContainer = document.querySelector('.properties-container');
      if (panel && panel.contains(e.target)) return;
      if (propsContainer && propsContainer.contains(e.target)) return;
      this._highlightedIndex = -1;
      this._panelOpen = false;
      this._renderOverlayPanel();
    };
    this._onKeyDown = e => {
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
    eventBus.on('variableScanner.variablesChanged', e => {
      if (this._variables === e.variables) return;
      this._variables = e.variables;
      this._renderOverlayPanel();
    });
    eventBus.on('diagram.destroy', () => {
      this._destroy();
    });
    this._dragDropManager.attach(document.body, field => this._onFieldFocus(field), () => this._onFieldBlur());
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
      variable = {
        name: varName,
        spinExpression: (0,_SpinExpressionBuilder__WEBPACK_IMPORTED_MODULE_3__.buildSpinExpression)(varName, path, isLeaf)
      };
    } else {
      return;
    }
    const expr = (0,_expressionUtils__WEBPACK_IMPORTED_MODULE_2__.buildExpression)(variable, this._activeField);
    (0,_expressionUtils__WEBPACK_IMPORTED_MODULE_2__.insertTextAtCursor)(this._activeField, expr);
    this._activeField.focus();
  }
  _updateHighlight(items) {
    items.forEach((item, i) => {
      item.classList.toggle('variable-picker-item-highlighted', i === this._highlightedIndex);
    });
    if (this._highlightedIndex >= 0 && items[this._highlightedIndex]) {
      items[this._highlightedIndex].scrollIntoView({
        block: 'nearest'
      });
    }
  }
  _connectToEndpoint(endpoint) {
    this._apiClient = new _ApiClient__WEBPACK_IMPORTED_MODULE_1__["default"](endpoint);
    this._endpointUrl = endpoint.url;
    this._apiStatus = 'disconnected';
    this._fetchApiVariables();
  }
  async _initApiClient() {
    if (!this._configApi) return;
    try {
      const endpoints = await this._configApi.get('camundaEngineEndpoints', []);
      const tabConfig = this._tabFile ? await this._configApi.getForFile(this._tabFile, 'deployment-tool') : null;
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
        merged.set(v.name, {
          ...existing,
          ...updates
        });
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
    ghost.textContent = variable.spinExpression ? '${' + variable.spinExpression + '}' : '${' + variable.name + '}';
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 0, 0);
    setTimeout(() => document.body.removeChild(ghost), 0);
  }
  _onDragEnd() {
    this._dragDropManager.setDragging(false);
  }
  _renderOverlayPanel() {
    if (!this._panelOpen || !this._panelPosition) {
      (0,_PanelRenderer__WEBPACK_IMPORTED_MODULE_4__.destroyPanel)();
      return;
    }
    const mergedVariables = this._getMergedVariables();
    (0,_PanelRenderer__WEBPACK_IMPORTED_MODULE_4__.renderPanel)({
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
    (0,_PanelRenderer__WEBPACK_IMPORTED_MODULE_4__.destroyPanel)();
  }
}
VariablePickerPlugin.$inject = ['eventBus', 'canvas', 'variableScanner', 'config'];

/***/ },

/***/ "./src/VariableScanner.js"
/*!********************************!*\
  !*** ./src/VariableScanner.js ***!
  \********************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ VariableScanner)
/* harmony export */ });
/* harmony import */ var _scanner__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./scanner */ "./src/scanner/index.js");


/**
 * bpmn-js module that scans the BPMN model for process variables.
 * Only scans elements upstream of the currently selected element.
 * Emits 'variableScanner.variablesChanged' when variables are updated.
 */
class VariableScanner {
  constructor(elementRegistry, eventBus, canvas) {
    this._elementRegistry = elementRegistry;
    this._eventBus = eventBus;
    this._canvas = canvas;
    this._variables = [];
    this._selectedElement = null;
    eventBus.on('selection.changed', e => {
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
    const {
      newSelection
    } = event;
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
      const scanners = [_scanner__WEBPACK_IMPORTED_MODULE_0__.scanInputOutput, _scanner__WEBPACK_IMPORTED_MODULE_0__.scanFormFields, _scanner__WEBPACK_IMPORTED_MODULE_0__.scanResultVariable, _scanner__WEBPACK_IMPORTED_MODULE_0__.scanScriptVariables, _scanner__WEBPACK_IMPORTED_MODULE_0__.scanMultiInstance, _scanner__WEBPACK_IMPORTED_MODULE_0__.scanExecutionListeners];
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
      const id = current.id || current.businessObject && current.businessObject.id;
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

/***/ },

/***/ "./src/VariableScannerModule.js"
/*!**************************************!*\
  !*** ./src/VariableScannerModule.js ***!
  \**************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _VariableScanner__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./VariableScanner */ "./src/VariableScanner.js");

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ({
  __init__: ['variableScanner'],
  variableScanner: ['type', _VariableScanner__WEBPACK_IMPORTED_MODULE_0__["default"]]
});

/***/ },

/***/ "./src/expressionUtils.js"
/*!********************************!*\
  !*** ./src/expressionUtils.js ***!
  \********************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   buildExpression: () => (/* binding */ buildExpression),
/* harmony export */   insertTextAtCursor: () => (/* binding */ insertTextAtCursor)
/* harmony export */ });
/**
 * Build the expression to insert based on context.
 * If cursor is inside ${...}, insert just the expression.
 * Otherwise wrap in ${expression}.
 */
function buildExpression(variable, input) {
  const expr = variable.spinExpression || variable.name;
  const value = input.value || input.textContent || '';
  const cursorPos = input.selectionStart != null ? input.selectionStart : value.length;
  const before = value.substring(0, cursorPos);
  const lastDollarBrace = before.lastIndexOf('${');
  const lastCloseBrace = before.lastIndexOf('}');
  if (lastDollarBrace !== -1 && lastDollarBrace > lastCloseBrace) {
    return expr;
  }
  return '${' + expr + '}';
}

/**
 * Insert text at the current cursor position in an input/textarea.
 */
function insertTextAtCursor(input, text) {
  if (input.tagName === 'INPUT' || input.tagName === 'TEXTAREA') {
    const start = input.selectionStart || 0;
    const end = input.selectionEnd || 0;
    const before = input.value.substring(0, start);
    const after = input.value.substring(end);
    const proto = input.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
    const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    if (nativeSetter) {
      nativeSetter.call(input, before + text + after);
    } else {
      input.value = before + text + after;
    }
    input.dispatchEvent(new Event('input', {
      bubbles: true
    }));
    input.dispatchEvent(new Event('change', {
      bubbles: true
    }));
    const newPos = start + text.length;
    input.setSelectionRange(newPos, newPos);
    input.focus();
  } else if (input.contentEditable === 'true') {
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      range.deleteContents();
      range.insertNode(document.createTextNode(text));
      range.collapse(false);
    } else {
      input.textContent += text;
    }
    input.dispatchEvent(new Event('input', {
      bubbles: true
    }));
  }
}

/***/ },

/***/ "./src/scanner/executionListenerScanner.js"
/*!*************************************************!*\
  !*** ./src/scanner/executionListenerScanner.js ***!
  \*************************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   scanExecutionListeners: () => (/* binding */ scanExecutionListeners)
/* harmony export */ });
/**
 * Extract variables from execution listener scripts.
 * Looks for camunda:executionListener with inline scripts
 * and applies regex to find execution.setVariable calls.
 *
 * @param {ModdleElement} element - BPMN element business object
 * @returns {Array<{name: string, type: string, category: string}>}
 */
function scanExecutionListeners(element) {
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
    const scriptText = typeof script === 'string' ? script : script.get && script.get('value');
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

/***/ },

/***/ "./src/scanner/formFieldScanner.js"
/*!*****************************************!*\
  !*** ./src/scanner/formFieldScanner.js ***!
  \*****************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   scanFormFields: () => (/* binding */ scanFormFields)
/* harmony export */ });
/**
 * Extract variables from camunda:FormData extension elements.
 *
 * @param {ModdleElement} element - BPMN element business object
 * @returns {Array<{name: string, type: string, category: string}>}
 */
function scanFormFields(element) {
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
    case 'string':
      return 'string';
    case 'long':
    case 'double':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'date':
      return 'date';
    case 'enum':
      return 'string';
    default:
      return 'string';
  }
}

/***/ },

/***/ "./src/scanner/index.js"
/*!******************************!*\
  !*** ./src/scanner/index.js ***!
  \******************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   scanExecutionListeners: () => (/* reexport safe */ _executionListenerScanner__WEBPACK_IMPORTED_MODULE_5__.scanExecutionListeners),
/* harmony export */   scanFormFields: () => (/* reexport safe */ _formFieldScanner__WEBPACK_IMPORTED_MODULE_1__.scanFormFields),
/* harmony export */   scanInputOutput: () => (/* reexport safe */ _inputOutputScanner__WEBPACK_IMPORTED_MODULE_0__.scanInputOutput),
/* harmony export */   scanMultiInstance: () => (/* reexport safe */ _multiInstanceScanner__WEBPACK_IMPORTED_MODULE_4__.scanMultiInstance),
/* harmony export */   scanResultVariable: () => (/* reexport safe */ _resultVariableScanner__WEBPACK_IMPORTED_MODULE_2__.scanResultVariable),
/* harmony export */   scanScriptVariables: () => (/* reexport safe */ _scriptScanner__WEBPACK_IMPORTED_MODULE_3__.scanScriptVariables)
/* harmony export */ });
/* harmony import */ var _inputOutputScanner__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./inputOutputScanner */ "./src/scanner/inputOutputScanner.js");
/* harmony import */ var _formFieldScanner__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./formFieldScanner */ "./src/scanner/formFieldScanner.js");
/* harmony import */ var _resultVariableScanner__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./resultVariableScanner */ "./src/scanner/resultVariableScanner.js");
/* harmony import */ var _scriptScanner__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./scriptScanner */ "./src/scanner/scriptScanner.js");
/* harmony import */ var _multiInstanceScanner__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./multiInstanceScanner */ "./src/scanner/multiInstanceScanner.js");
/* harmony import */ var _executionListenerScanner__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ./executionListenerScanner */ "./src/scanner/executionListenerScanner.js");







/***/ },

/***/ "./src/scanner/inputOutputScanner.js"
/*!*******************************************!*\
  !*** ./src/scanner/inputOutputScanner.js ***!
  \*******************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   scanInputOutput: () => (/* binding */ scanInputOutput)
/* harmony export */ });
/* harmony import */ var _SpinExpressionBuilder__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../SpinExpressionBuilder */ "./src/SpinExpressionBuilder.js");


/**
 * Extract variables from camunda:InputOutput extension elements.
 *
 * @param {ModdleElement} element - BPMN element business object
 * @returns {Array<{name: string, type: string, category: string}>}
 */
function scanInputOutput(element) {
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
  if (!value) return {
    type: 'string'
  };
  if (value === 'true' || value === 'false') return {
    type: 'boolean'
  };
  if (!isNaN(value) && value.trim() !== '') return {
    type: 'number'
  };
  if (value.startsWith('{') || value.startsWith('[')) {
    try {
      const parsed = JSON.parse(value);
      return {
        type: 'json',
        jsonStructure: (0,_SpinExpressionBuilder__WEBPACK_IMPORTED_MODULE_0__.buildJsonStructure)(parsed)
      };
    } catch {
      // Not valid JSON — still mark as json type but no structure
      return {
        type: 'json'
      };
    }
  }
  return {
    type: 'string'
  };
}

/***/ },

/***/ "./src/scanner/multiInstanceScanner.js"
/*!*********************************************!*\
  !*** ./src/scanner/multiInstanceScanner.js ***!
  \*********************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   scanMultiInstance: () => (/* binding */ scanMultiInstance)
/* harmony export */ });
/**
 * Extract variables from multi-instance loop characteristics.
 *
 * @param {ModdleElement} element - BPMN element business object
 * @returns {Array<{name: string, type: string, category: string}>}
 */
function scanMultiInstance(element) {
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

/***/ },

/***/ "./src/scanner/resultVariableScanner.js"
/*!**********************************************!*\
  !*** ./src/scanner/resultVariableScanner.js ***!
  \**********************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   scanResultVariable: () => (/* binding */ scanResultVariable)
/* harmony export */ });
/**
 * Extract variables from camunda:resultVariable attribute.
 * Used on service tasks, business rule tasks, send tasks, etc.
 *
 * @param {ModdleElement} element - BPMN element business object
 * @returns {Array<{name: string, type: string, category: string}>}
 */
function scanResultVariable(element) {
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

/***/ },

/***/ "./src/scanner/scriptScanner.js"
/*!**************************************!*\
  !*** ./src/scanner/scriptScanner.js ***!
  \**************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   scanScriptVariables: () => (/* binding */ scanScriptVariables)
/* harmony export */ });
/**
 * Best-effort extraction of variables from script tasks.
 * Looks for execution.setVariable('name', ...) patterns in Groovy/JS scripts.
 *
 * Phase 1: basic regex matching only.
 *
 * @param {ModdleElement} element - BPMN element business object
 * @returns {Array<{name: string, type: string, category: string}>}
 */
function scanScriptVariables(element) {
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

/***/ },

/***/ "./node_modules/camunda-modeler-plugin-helpers/helper.js"
/*!***************************************************************!*\
  !*** ./node_modules/camunda-modeler-plugin-helpers/helper.js ***!
  \***************************************************************/
(module) {

function returnOrThrow(getter, minimalModelerVersion) {
  let result;
  try {
    result = getter();
  } catch (error) {}

  if (!result) {
    throw new Error(`Not compatible with Camunda Modeler < ${minimalModelerVersion}`);
  }

  return result;
}

module.exports = {
  returnOrThrow
};


/***/ },

/***/ "./node_modules/camunda-modeler-plugin-helpers/index.js"
/*!**************************************************************!*\
  !*** ./node_modules/camunda-modeler-plugin-helpers/index.js ***!
  \**************************************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   getModelerDirectory: () => (/* binding */ getModelerDirectory),
/* harmony export */   getPluginsDirectory: () => (/* binding */ getPluginsDirectory),
/* harmony export */   registerBpmnJSModdleExtension: () => (/* binding */ registerBpmnJSModdleExtension),
/* harmony export */   registerBpmnJSPlugin: () => (/* binding */ registerBpmnJSPlugin),
/* harmony export */   registerClientExtension: () => (/* binding */ registerClientExtension),
/* harmony export */   registerClientPlugin: () => (/* binding */ registerClientPlugin),
/* harmony export */   registerCloudBpmnJSModdleExtension: () => (/* binding */ registerCloudBpmnJSModdleExtension),
/* harmony export */   registerCloudBpmnJSPlugin: () => (/* binding */ registerCloudBpmnJSPlugin),
/* harmony export */   registerCloudDmnJSModdleExtension: () => (/* binding */ registerCloudDmnJSModdleExtension),
/* harmony export */   registerCloudDmnJSPlugin: () => (/* binding */ registerCloudDmnJSPlugin),
/* harmony export */   registerDmnJSModdleExtension: () => (/* binding */ registerDmnJSModdleExtension),
/* harmony export */   registerDmnJSPlugin: () => (/* binding */ registerDmnJSPlugin),
/* harmony export */   registerPlatformBpmnJSModdleExtension: () => (/* binding */ registerPlatformBpmnJSModdleExtension),
/* harmony export */   registerPlatformBpmnJSPlugin: () => (/* binding */ registerPlatformBpmnJSPlugin),
/* harmony export */   registerPlatformDmnJSModdleExtension: () => (/* binding */ registerPlatformDmnJSModdleExtension),
/* harmony export */   registerPlatformDmnJSPlugin: () => (/* binding */ registerPlatformDmnJSPlugin)
/* harmony export */ });
/**
 * Validate and register a client plugin.
 *
 * @param {Object} plugin
 * @param {String} type
 */
function registerClientPlugin(plugin, type) {
  var plugins = window.plugins || [];
  window.plugins = plugins;

  if (!plugin) {
    throw new Error('plugin not specified');
  }

  if (!type) {
    throw new Error('type not specified');
  }

  plugins.push({
    plugin: plugin,
    type: type
  });
}

/**
 * Validate and register a client plugin.
 *
 * @param {import('react').ComponentType} extension
 *
 * @example
 *
 * import MyExtensionComponent from './MyExtensionComponent';
 *
 * registerClientExtension(MyExtensionComponent);
 */
function registerClientExtension(component) {
  registerClientPlugin(component, 'client');
}

/**
 * Validate and register a bpmn-js plugin.
 *
 * @param {Object} module
 *
 * @example
 *
 * import {
 *   registerBpmnJSPlugin
 * } from 'camunda-modeler-plugin-helpers';
 *
 * const BpmnJSModule = {
 *   __init__: [ 'myService' ],
 *   myService: [ 'type', ... ]
 * };
 *
 * registerBpmnJSPlugin(BpmnJSModule);
 */
function registerBpmnJSPlugin(module) {
  registerClientPlugin(module, 'bpmn.modeler.additionalModules');
}

/**
 * Validate and register a platform specific bpmn-js plugin.
 *
 * @param {Object} module
 *
 * @example
 *
 * import {
 *   registerPlatformBpmnJSPlugin
 * } from 'camunda-modeler-plugin-helpers';
 *
 * const BpmnJSModule = {
 *   __init__: [ 'myService' ],
 *   myService: [ 'type', ... ]
 * };
 *
 * registerPlatformBpmnJSPlugin(BpmnJSModule);
 */
function registerPlatformBpmnJSPlugin(module) {
  registerClientPlugin(module, 'bpmn.platform.modeler.additionalModules');
}

/**
 * Validate and register a cloud specific bpmn-js plugin.
 *
 * @param {Object} module
 *
 * @example
 *
 * import {
 *   registerCloudBpmnJSPlugin
 * } from 'camunda-modeler-plugin-helpers';
 *
 * const BpmnJSModule = {
 *   __init__: [ 'myService' ],
 *   myService: [ 'type', ... ]
 * };
 *
 * registerCloudBpmnJSPlugin(BpmnJSModule);
 */
function registerCloudBpmnJSPlugin(module) {
  registerClientPlugin(module, 'bpmn.cloud.modeler.additionalModules');
}

/**
 * Validate and register a bpmn-moddle extension plugin.
 *
 * @param {Object} descriptor
 *
 * @example
 * import {
 *   registerBpmnJSModdleExtension
 * } from 'camunda-modeler-plugin-helpers';
 *
 * var moddleDescriptor = {
 *   name: 'my descriptor',
 *   uri: 'http://example.my.company.localhost/schema/my-descriptor/1.0',
 *   prefix: 'mydesc',
 *
 *   ...
 * };
 *
 * registerBpmnJSModdleExtension(moddleDescriptor);
 */
function registerBpmnJSModdleExtension(descriptor) {
  registerClientPlugin(descriptor, 'bpmn.modeler.moddleExtension');
}

/**
 * Validate and register a platform specific bpmn-moddle extension plugin.
 *
 * @param {Object} descriptor
 *
 * @example
 * import {
 *   registerPlatformBpmnJSModdleExtension
 * } from 'camunda-modeler-plugin-helpers';
 *
 * var moddleDescriptor = {
 *   name: 'my descriptor',
 *   uri: 'http://example.my.company.localhost/schema/my-descriptor/1.0',
 *   prefix: 'mydesc',
 *
 *   ...
 * };
 *
 * registerPlatformBpmnJSModdleExtension(moddleDescriptor);
 */
function registerPlatformBpmnJSModdleExtension(descriptor) {
  registerClientPlugin(descriptor, 'bpmn.platform.modeler.moddleExtension');
}

/**
 * Validate and register a cloud specific bpmn-moddle extension plugin.
 *
 * @param {Object} descriptor
 *
 * @example
 * import {
 *   registerCloudBpmnJSModdleExtension
 * } from 'camunda-modeler-plugin-helpers';
 *
 * var moddleDescriptor = {
 *   name: 'my descriptor',
 *   uri: 'http://example.my.company.localhost/schema/my-descriptor/1.0',
 *   prefix: 'mydesc',
 *
 *   ...
 * };
 *
 * registerCloudBpmnJSModdleExtension(moddleDescriptor);
 */
function registerCloudBpmnJSModdleExtension(descriptor) {
  registerClientPlugin(descriptor, 'bpmn.cloud.modeler.moddleExtension');
}

/**
 * Validate and register a dmn-moddle extension plugin.
 *
 * @param {Object} descriptor
 *
 * @example
 * import {
 *   registerDmnJSModdleExtension
 * } from 'camunda-modeler-plugin-helpers';
 *
 * var moddleDescriptor = {
 *   name: 'my descriptor',
 *   uri: 'http://example.my.company.localhost/schema/my-descriptor/1.0',
 *   prefix: 'mydesc',
 *
 *   ...
 * };
 *
 * registerDmnJSModdleExtension(moddleDescriptor);
 */
function registerDmnJSModdleExtension(descriptor) {
  registerClientPlugin(descriptor, 'dmn.modeler.moddleExtension');
}

/**
 * Validate and register a cloud specific dmn-moddle extension plugin.
 *
 * @param {Object} descriptor
 *
 * @example
 * import {
 *   registerCloudDmnJSModdleExtension
 * } from 'camunda-modeler-plugin-helpers';
 *
 * var moddleDescriptor = {
 *   name: 'my descriptor',
 *   uri: 'http://example.my.company.localhost/schema/my-descriptor/1.0',
 *   prefix: 'mydesc',
 *
 *   ...
 * };
 *
 * registerCloudDmnJSModdleExtension(moddleDescriptor);
 */
function registerCloudDmnJSModdleExtension(descriptor) {
  registerClientPlugin(descriptor, 'dmn.cloud.modeler.moddleExtension');
}

/**
 * Validate and register a platform specific dmn-moddle extension plugin.
 *
 * @param {Object} descriptor
 *
 * @example
 * import {
 *   registerPlatformDmnJSModdleExtension
 * } from 'camunda-modeler-plugin-helpers';
 *
 * var moddleDescriptor = {
 *   name: 'my descriptor',
 *   uri: 'http://example.my.company.localhost/schema/my-descriptor/1.0',
 *   prefix: 'mydesc',
 *
 *   ...
 * };
 *
 * registerPlatformDmnJSModdleExtension(moddleDescriptor);
 */
function registerPlatformDmnJSModdleExtension(descriptor) {
  registerClientPlugin(descriptor, 'dmn.platform.modeler.moddleExtension');
}

/**
 * Validate and register a dmn-js plugin.
 *
 * @param {Object} module
 *
 * @example
 *
 * import {
 *   registerDmnJSPlugin
 * } from 'camunda-modeler-plugin-helpers';
 *
 * const DmnJSModule = {
 *   __init__: [ 'myService' ],
 *   myService: [ 'type', ... ]
 * };
 *
 * registerDmnJSPlugin(DmnJSModule, [ 'drd', 'literalExpression' ]);
 * registerDmnJSPlugin(DmnJSModule, 'drd')
 */
function registerDmnJSPlugin(module, components) {

  if (!Array.isArray(components)) {
    components = [ components ]
  }

  components.forEach(c => registerClientPlugin(module, `dmn.modeler.${c}.additionalModules`));
}

/**
 * Validate and register a cloud specific dmn-js plugin.
 *
 * @param {Object} module
 *
 * @example
 *
 * import {
 *   registerCloudDmnJSPlugin
 * } from 'camunda-modeler-plugin-helpers';
 *
 * const DmnJSModule = {
 *   __init__: [ 'myService' ],
 *   myService: [ 'type', ... ]
 * };
 *
 * registerCloudDmnJSPlugin(DmnJSModule, [ 'drd', 'literalExpression' ]);
 * registerCloudDmnJSPlugin(DmnJSModule, 'drd')
 */
function registerCloudDmnJSPlugin(module, components) {

  if (!Array.isArray(components)) {
    components = [ components ]
  }

  components.forEach(c => registerClientPlugin(module, `dmn.cloud.modeler.${c}.additionalModules`));
}

/**
 * Validate and register a platform specific dmn-js plugin.
 *
 * @param {Object} module
 *
 * @example
 *
 * import {
 *   registerPlatformDmnJSPlugin
 * } from 'camunda-modeler-plugin-helpers';
 *
 * const DmnJSModule = {
 *   __init__: [ 'myService' ],
 *   myService: [ 'type', ... ]
 * };
 *
 * registerPlatformDmnJSPlugin(DmnJSModule, [ 'drd', 'literalExpression' ]);
 * registerPlatformDmnJSPlugin(DmnJSModule, 'drd')
 */
function registerPlatformDmnJSPlugin(module, components) {

  if (!Array.isArray(components)) {
    components = [ components ]
  }

  components.forEach(c => registerClientPlugin(module, `dmn.platform.modeler.${c}.additionalModules`));
}

/**
 * Return the modeler directory, as a string.
 *
 * @deprecated Will be removed in future Camunda Modeler versions without replacement.
 *
 * @return {String}
 */
function getModelerDirectory() {
  return window.getModelerDirectory();
}

/**
 * Return the modeler plugin directory, as a string.
 *
 * @deprecated Will be removed in future Camunda Modeler versions without replacement.
 *
 * @return {String}
 */
function getPluginsDirectory() {
  return window.getPluginsDirectory();
}

/***/ },

/***/ "./node_modules/camunda-modeler-plugin-helpers/vendor/@bpmn-io/properties-panel/preact/index.js"
/*!******************************************************************************************************!*\
  !*** ./node_modules/camunda-modeler-plugin-helpers/vendor/@bpmn-io/properties-panel/preact/index.js ***!
  \******************************************************************************************************/
(module, __unused_webpack_exports, __webpack_require__) {

const { returnOrThrow } = __webpack_require__(/*! ../../../../helper.js */ "./node_modules/camunda-modeler-plugin-helpers/helper.js");

module.exports = returnOrThrow(() => window.vendor?.propertiesPanel?.preact?.root, '5.0.0');


/***/ },

/***/ "./node_modules/camunda-modeler-plugin-helpers/vendor/@bpmn-io/properties-panel/preact/jsx-runtime.js"
/*!************************************************************************************************************!*\
  !*** ./node_modules/camunda-modeler-plugin-helpers/vendor/@bpmn-io/properties-panel/preact/jsx-runtime.js ***!
  \************************************************************************************************************/
(module, __unused_webpack_exports, __webpack_require__) {

const { returnOrThrow } = __webpack_require__(/*! ../../../../helper.js */ "./node_modules/camunda-modeler-plugin-helpers/helper.js");

module.exports = returnOrThrow(() => window.vendor?.propertiesPanel?.preact?.jsxRuntime, '5.0.0');


/***/ }

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		if (!(moduleId in __webpack_modules__)) {
/******/ 			delete __webpack_module_cache__[moduleId];
/******/ 			var e = new Error("Cannot find module '" + moduleId + "'");
/******/ 			e.code = 'MODULE_NOT_FOUND';
/******/ 			throw e;
/******/ 		}
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/compat get default export */
/******/ 	(() => {
/******/ 		// getDefaultExport function for compatibility with non-harmony modules
/******/ 		__webpack_require__.n = (module) => {
/******/ 			var getter = module && module.__esModule ?
/******/ 				() => (module['default']) :
/******/ 				() => (module);
/******/ 			__webpack_require__.d(getter, { a: getter });
/******/ 			return getter;
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/define property getters */
/******/ 	(() => {
/******/ 		// define getter functions for harmony exports
/******/ 		__webpack_require__.d = (exports, definition) => {
/******/ 			for(var key in definition) {
/******/ 				if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 					Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 				}
/******/ 			}
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	(() => {
/******/ 		__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/make namespace object */
/******/ 	(() => {
/******/ 		// define __esModule on exports
/******/ 		__webpack_require__.r = (exports) => {
/******/ 			if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 				Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 			}
/******/ 			Object.defineProperty(exports, '__esModule', { value: true });
/******/ 		};
/******/ 	})();
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};
// This entry needs to be wrapped in an IIFE because it needs to be in strict mode.
(() => {
"use strict";
/*!**********************!*\
  !*** ./src/index.js ***!
  \**********************/
__webpack_require__.r(__webpack_exports__);
/* harmony import */ var camunda_modeler_plugin_helpers__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! camunda-modeler-plugin-helpers */ "./node_modules/camunda-modeler-plugin-helpers/index.js");
/* harmony import */ var _VariableScannerModule__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./VariableScannerModule */ "./src/VariableScannerModule.js");
/* harmony import */ var _VariablePickerPlugin__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./VariablePickerPlugin */ "./src/VariablePickerPlugin.js");



const VariablePickerModule = {
  __init__: ['variablePickerPlugin'],
  variablePickerPlugin: ['type', _VariablePickerPlugin__WEBPACK_IMPORTED_MODULE_2__["default"]]
};
(0,camunda_modeler_plugin_helpers__WEBPACK_IMPORTED_MODULE_0__.registerPlatformBpmnJSPlugin)(_VariableScannerModule__WEBPACK_IMPORTED_MODULE_1__["default"]);
(0,camunda_modeler_plugin_helpers__WEBPACK_IMPORTED_MODULE_0__.registerPlatformBpmnJSPlugin)(VariablePickerModule);

// Minimal client extension to pass modeler config API into the bpmn-js module.
// The bpmn-js DI container doesn't have access to the modeler's config/subscribe APIs,
// so we bridge them via bpmn.modeler.configure (for config) and bpmn.modeler.created (for tab file).
class ConfigBridge {
  constructor(props) {
    const {
      subscribe,
      config
    } = props;
    subscribe('bpmn.modeler.configure', event => {
      const {
        middlewares
      } = event;
      middlewares.push(options => ({
        ...options,
        variablePickerConfigApi: config
      }));
    });
    subscribe('bpmn.modeler.created', event => {
      const {
        modeler,
        tab
      } = event;
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
(0,camunda_modeler_plugin_helpers__WEBPACK_IMPORTED_MODULE_0__.registerClientExtension)(ConfigBridge);
})();

/******/ })()
;
//# sourceMappingURL=client.js.map