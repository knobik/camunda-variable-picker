import { h, render as preactRender } from '@bpmn-io/properties-panel/preact';
import { buildSpinExpression } from './SpinExpressionBuilder';

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

const CATEGORY_ORDER = [
  'api-variable',
  'output-mapping',
  'input-mapping',
  'form-field',
  'result-variable',
  'script-variable',
  'multi-instance',
  'listener-variable'
];

const TYPE_ICONS = {
  'string': 'S',
  'number': '#',
  'boolean': '?',
  'date': 'D',
  'json': '{}',
  'object': '{}',
  'array': '[]',
  'null': '0'
};

let panelEl = null;

export function renderPanel(props) {
  if (!panelEl) {
    panelEl = document.createElement('div');
    panelEl.className = 'variable-picker-portal';
    document.body.appendChild(panelEl);
  }

  preactRender(h(VariablePanel, props), panelEl);
}

export function destroyPanel() {
  if (panelEl) {
    preactRender(null, panelEl);
    panelEl.remove();
    panelEl = null;
  }
}

function VariablePanel({
  position, variables, searchQuery, collapsedCategories, collapsedPaths,
  onSearchChange, onToggleCategory, onTogglePath, onDragStart, onDragEnd,
  apiStatus, apiError, endpointUrl, processInstanceId, onRefreshApi
}) {
  const query = (searchQuery || '').toLowerCase().trim();
  const filtered = query
    ? variables.filter(v => v.name.toLowerCase().includes(query) || matchesJsonStructure(v.jsonStructure, query))
    : variables;

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

  return h('div', { class: 'variable-picker-panel', style },
    h('div', { class: 'variable-picker-header' },
      h('span', { class: 'variable-picker-title' }, 'Variables'),
      h('span', { class: 'variable-picker-count' }, filtered.length)
    ),
    h('div', { class: 'variable-picker-search' },
      h('input', {
        type: 'text', placeholder: 'Search variables...', class: 'variable-picker-search-input',
        value: searchQuery || '',
        onInput: (e) => onSearchChange(e.target.value),
        onMouseDown: (e) => e.stopPropagation()
      })
    ),
    h('div', { class: 'variable-picker-body' },
      filtered.length === 0 && h('div', { class: 'variable-picker-empty' },
        variables.length === 0 ? 'No variables found in this process.' : 'No variables match your search.'
      ),
      CATEGORY_ORDER.map(category => {
        const vars = grouped[category];
        if (!vars || vars.length === 0) return null;
        return h(CategoryGroup, {
          key: category, category, variables: vars,
          isCollapsed: collapsedCategories[category], collapsedPaths,
          onToggleCategory, onTogglePath, onDragStart, onDragEnd,
          searchQuery: query
        });
      })
    ),
    h('div', { class: 'variable-picker-footer' },
      h('span', { class: statusDotClass }),
      endpointUrl
        ? h('span', { class: 'variable-picker-footer-url', title: endpointUrl },
          endpointUrl.replace(/^https?:\/\//, '')
        )
        : h('span', { class: 'variable-picker-footer-url variable-picker-footer-no-endpoint' }, 'No endpoint'),
      processInstanceId && h('span', {
        class: 'variable-picker-footer-pid',
        title: 'Process Instance: ' + processInstanceId
      }, processInstanceId.substring(0, 8) + '...'),
      apiError && h('span', { class: 'variable-picker-footer-error', title: apiError }, '!'),
      h('button', {
        class: 'variable-picker-footer-refresh',
        onClick: onRefreshApi,
        disabled: apiStatus === 'loading' || !endpointUrl,
        title: 'Refresh API variables'
      }, apiStatus === 'loading' ? '\u23F3' : '\u21BB')
    )
  );
}


function CategoryGroup({ category, variables, isCollapsed, collapsedPaths, onToggleCategory, onTogglePath, onDragStart, onDragEnd, searchQuery }) {
  return h('div', { class: 'variable-picker-category' },
    h('div', { class: 'variable-picker-category-header', onClick: () => onToggleCategory(category) },
      h('span', { class: 'variable-picker-chevron' + (isCollapsed ? ' collapsed' : '') }, '\u25BE'),
      h('span', { class: 'variable-picker-category-label' }, CATEGORY_LABELS[category] || category),
      h('span', { class: 'variable-picker-category-count' }, variables.length)
    ),
    !isCollapsed && variables.map(variable => {
      if (variable.type === 'json' && variable.jsonStructure) {
        return h(JsonVariable, { key: variable.name, variable, collapsedPaths, onTogglePath, onDragStart, onDragEnd, searchQuery });
      }
      return h(SimpleVariable, { key: variable.name, variable, onDragStart, onDragEnd });
    })
  );
}

function SimpleVariable({ variable, onDragStart, onDragEnd }) {
  const icon = TYPE_ICONS[variable.type] || '?';
  const valueStr = formatValue(variable.value);

  return h('div', {
    class: 'variable-picker-item', draggable: true,
    'data-variable': JSON.stringify(variable),
    onDragStart: (e) => onDragStart(e, variable), onDragEnd,
    title: variable.name + ' (' + variable.type + ')' +
      (variable.value !== undefined ? '\nValue: ' + String(variable.value) : '') +
      '\nFrom: ' + variable.source.elementName
  },
    h('span', { class: 'variable-picker-type-icon type-' + variable.type }, icon),
    h('div', { class: 'variable-picker-item-content' },
      h('div', { class: 'variable-picker-item-row' },
        h('span', { class: 'variable-picker-item-name' }, variable.name),
        variable.apiEnriched && h('span', { class: 'variable-picker-api-badge' }, '\u26A1'),
        h('span', { class: 'variable-picker-item-type' }, variable.type)
      ),
      valueStr && h('div', { class: 'variable-picker-item-value-row' }, valueStr)
    )
  );
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

function JsonVariable({ variable, collapsedPaths, onTogglePath, onDragStart, onDragEnd, searchQuery }) {
  const pathKey = variable.name;
  // Auto-expand when searching
  const isExpanded = searchQuery ? true : !collapsedPaths[pathKey];

  return h('div', null,
    h('div', {
      class: 'variable-picker-item variable-picker-json-root',
      title: 'From: ' + variable.source.elementName + ' (' + variable.source.elementType + ')'
    },
      h('span', {
        class: 'variable-picker-tree-toggle' + (isExpanded ? '' : ' collapsed'),
        onClick: (e) => { e.stopPropagation(); onTogglePath(pathKey); }
      }, '\u25BE'),
      h('span', {
        class: 'variable-picker-json-drag', draggable: true,
        onDragStart: (e) => onDragStart(e, variable), onDragEnd
      },
        h('span', { class: 'variable-picker-type-icon type-json' }, '{}'),
        h('span', { class: 'variable-picker-item-name' }, variable.name),
        h('span', { class: 'variable-picker-item-type' }, 'json')
      )
    ),
    isExpanded && variable.jsonStructure && h(TreeChildren, {
      varName: variable.name, node: variable.jsonStructure, parentPath: [],
      collapsedPaths, onTogglePath, onDragStart, onDragEnd, searchQuery, depth: 1
    })
  );
}

function TreeChildren({ varName, node, parentPath, collapsedPaths, onTogglePath, onDragStart, onDragEnd, searchQuery, depth }) {
  if (node.type === 'object' && node.children) {
    const entries = Object.entries(node.children).filter(([key, child]) => {
      if (!searchQuery) return true;
      return key.toLowerCase().includes(searchQuery) || matchesJsonStructure(child, searchQuery);
    });

    if (entries.length === 0) return null;

    return h('div', null,
      entries.map(([key, child]) => {
        const path = [...parentPath, key];
        return h(TreeNode, {
          key: path.join('.'), varName, label: key, node: child, path,
          collapsedPaths, onTogglePath, onDragStart, onDragEnd, searchQuery, depth
        });
      })
    );
  }

  if (node.type === 'array' && node.children) {
    const items = node.children.map((child, i) => ({ child, i })).filter(({ child }) => {
      if (!searchQuery) return true;
      return matchesJsonStructure(child, searchQuery);
    });

    if (items.length === 0) return null;

    return h('div', null,
      items.map(({ child, i }) => {
        const path = [...parentPath, '[' + i + ']'];
        return h(TreeNode, {
          key: path.join('.'), varName, label: '[' + i + ']', node: child, path,
          collapsedPaths, onTogglePath, onDragStart, onDragEnd, searchQuery, depth
        });
      })
    );
  }

  return null;
}

function TreeNode({ varName, label, node, path, collapsedPaths, onTogglePath, onDragStart, onDragEnd, searchQuery, depth }) {
  const pathKey = varName + '.' + path.join('.');
  const hasChildren = (node.type === 'object' && node.children && Object.keys(node.children).length > 0)
    || (node.type === 'array' && node.children && node.children.length > 0);
  const isLeaf = !hasChildren;
  const isExpanded = searchQuery ? true : !collapsedPaths[pathKey];
  const icon = TYPE_ICONS[node.type] || '?';
  const paddingLeft = 12 + depth * 16;
  const spinExpr = buildSpinExpression(varName, path, isLeaf);
  const dragData = { name: varName, spinExpression: spinExpr, isLeaf };

  return h('div', null,
    h('div', {
      class: 'variable-picker-tree-node', draggable: true,
      'data-var-name': varName,
      'data-path': JSON.stringify(path),
      'data-leaf': String(isLeaf),
      onDragStart: (e) => onDragStart(e, dragData), onDragEnd,
      style: { paddingLeft: paddingLeft + 'px' },
      title: 'SPIN: ' + spinExpr
    },
      hasChildren
        ? h('span', {
          class: 'variable-picker-tree-toggle' + (isExpanded ? '' : ' collapsed'),
          onClick: (e) => { e.stopPropagation(); onTogglePath(pathKey); }
        }, '\u25BE')
        : h('span', { class: 'variable-picker-tree-leaf-spacer' }),
      h('span', { class: 'variable-picker-type-icon type-' + node.type }, icon),
      h('div', { class: 'variable-picker-item-content' },
        h('div', { class: 'variable-picker-item-row' },
          h('span', { class: 'variable-picker-tree-label' }, label),
          h('span', { class: 'variable-picker-item-type' }, node.type)
        ),
        isLeaf && node.value !== undefined && h('div', { class: 'variable-picker-item-value-row' }, formatValue(node.value))
      )
    ),
    hasChildren && isExpanded && h(TreeChildren, {
      varName, node, parentPath: path,
      collapsedPaths, onTogglePath, onDragStart, onDragEnd, searchQuery, depth: depth + 1
    })
  );
}
