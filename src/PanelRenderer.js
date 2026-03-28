import { render as preactRender } from '@bpmn-io/properties-panel/preact';
import { buildSpinExpression } from './SpinExpressionBuilder';
import { SearchIcon, EmptySetIcon, RefreshIcon, SpinnerIcon, ChevronIcon, LightningIcon } from './Icons';

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
  'null': 'N'
};

let panelEl = null;

export function renderPanel(props) {
  if (!panelEl) {
    panelEl = document.createElement('div');
    panelEl.className = 'variable-picker-portal';
    document.body.appendChild(panelEl);
  }

  preactRender(<VariablePanel {...props} />, panelEl);
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

  return (
    <div class="variable-picker-panel" style={style}>
      <div class="variable-picker-header">
        <span class="variable-picker-title">Variables</span>
        <span class="variable-picker-count">{filtered.length}</span>
      </div>
      <div class="variable-picker-search">
        <span class="variable-picker-search-icon"><SearchIcon /></span>
        <input
          type="text"
          placeholder="Search variables..."
          class="variable-picker-search-input"
          value={searchQuery || ''}
          onInput={(e) => onSearchChange(e.target.value)}
          onMouseDown={(e) => e.stopPropagation()}
        />
      </div>
      <div class="variable-picker-body">
        {filtered.length === 0 && (
          <div class="variable-picker-empty">
            <span class="variable-picker-empty-icon">
              {variables.length === 0 ? <EmptySetIcon /> : <SearchIcon />}
            </span>
            {variables.length === 0 ? 'No variables found in this process.' : 'No variables match your search.'}
          </div>
        )}
        {CATEGORY_ORDER.map(category => {
          const vars = grouped[category];
          if (!vars || vars.length === 0) return null;
          return (
            <CategoryGroup
              key={category}
              category={category}
              variables={vars}
              isCollapsed={collapsedCategories[category]}
              collapsedPaths={collapsedPaths}
              onToggleCategory={onToggleCategory}
              onTogglePath={onTogglePath}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              searchQuery={query}
            />
          );
        })}
      </div>
      <div class="variable-picker-footer">
        <span class="variable-picker-footer-label">API</span>
        <span class={statusDotClass} />
        {endpointUrl
          ? (
            <span class="variable-picker-footer-url" title={endpointUrl}>
              {endpointUrl.replace(/^https?:\/\//, '')}
            </span>
          )
          : (
            <span class="variable-picker-footer-url variable-picker-footer-no-endpoint">No endpoint</span>
          )}
        {processInstanceId && (
          <span
            class="variable-picker-footer-pid"
            title={'Process Instance: ' + processInstanceId}
          >
            {processInstanceId.substring(0, 8) + '...'}
          </span>
        )}
        {apiError && (
          <span class="variable-picker-footer-error" title={apiError}>!</span>
        )}
        <button
          class="variable-picker-footer-refresh"
          onClick={onRefreshApi}
          disabled={apiStatus === 'loading' || !endpointUrl}
          title="Refresh API variables"
        >
          {apiStatus === 'loading' ? <SpinnerIcon /> : <RefreshIcon />}
        </button>
      </div>
    </div>
  );
}


function CategoryGroup({ category, variables, isCollapsed, collapsedPaths, onToggleCategory, onTogglePath, onDragStart, onDragEnd, searchQuery }) {
  return (
    <div class="variable-picker-category">
      <div class="variable-picker-category-header" onClick={() => onToggleCategory(category)}>
        <span class={'variable-picker-chevron' + (isCollapsed ? ' collapsed' : '')}><ChevronIcon /></span>
        <span class="variable-picker-category-label">{CATEGORY_LABELS[category] || category}</span>
        <span class="variable-picker-category-count">{variables.length}</span>
      </div>
      {!isCollapsed && (
        <div class="variable-picker-category-items">
          {variables.map(variable => {
            if (variable.type === 'json' && variable.jsonStructure) {
              return (
                <JsonVariable
                  key={variable.name}
                  variable={variable}
                  collapsedPaths={collapsedPaths}
                  onTogglePath={onTogglePath}
                  onDragStart={onDragStart}
                  onDragEnd={onDragEnd}
                  searchQuery={searchQuery}
                />
              );
            }
            return <SimpleVariable key={variable.name} variable={variable} onDragStart={onDragStart} onDragEnd={onDragEnd} />;
          })}
        </div>
      )}
    </div>
  );
}

function SimpleVariable({ variable, onDragStart, onDragEnd }) {
  const icon = TYPE_ICONS[variable.type] || '?';
  const valueStr = formatValue(variable.value);

  return (
    <div
      class="variable-picker-item"
      draggable={true}
      data-variable={JSON.stringify(variable)}
      onDragStart={(e) => onDragStart(e, variable)}
      onDragEnd={onDragEnd}
      title={variable.name + ' (' + variable.type + ')' +
        (variable.value !== undefined ? '\nValue: ' + String(variable.value) : '') +
        '\nFrom: ' + variable.source.elementName}
    >
      <span class="variable-picker-toggle-spacer" />
      <span class={'variable-picker-type-icon type-' + variable.type}>{icon}</span>
      <div class="variable-picker-item-content">
        <div class="variable-picker-item-row">
          <span class="variable-picker-item-name">{variable.name}</span>
          {variable.apiEnriched && <span class="variable-picker-api-badge"><LightningIcon /></span>}
          <span class="variable-picker-item-type">{variable.type}</span>
        </div>
        {valueStr && <div class="variable-picker-item-value-row">{valueStr}</div>}
      </div>
    </div>
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
  const isExpanded = searchQuery ? true : !collapsedPaths[pathKey];

  return (
    <div>
      <div
        class="variable-picker-item variable-picker-json-root"
        title={'From: ' + variable.source.elementName + ' (' + variable.source.elementType + ')'}
      >
        <span
          class={'variable-picker-json-toggle' + (isExpanded ? '' : ' collapsed')}
          onClick={(e) => { e.stopPropagation(); onTogglePath(pathKey); }}
        >
          <ChevronIcon />
        </span>
        <span
          class="variable-picker-json-drag"
          draggable={true}
          onDragStart={(e) => onDragStart(e, variable)}
          onDragEnd={onDragEnd}
        >
          <span class="variable-picker-type-icon type-json">{'{}'}</span>
          <span class="variable-picker-item-name">{variable.name}</span>
          <span class="variable-picker-item-type">json</span>
        </span>
      </div>
      {isExpanded && variable.jsonStructure && (
        <div class="variable-picker-tree-children" style={{ '--tree-guide-offset': '17px' }}>
          <TreeChildren
            varName={variable.name}
            node={variable.jsonStructure}
            parentPath={[]}
            collapsedPaths={collapsedPaths}
            onTogglePath={onTogglePath}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            searchQuery={searchQuery}
            depth={1}
          />
        </div>
      )}
    </div>
  );
}

function TreeChildren({ varName, node, parentPath, collapsedPaths, onTogglePath, onDragStart, onDragEnd, searchQuery, depth }) {
  if (node.type === 'object' && node.children) {
    const entries = Object.entries(node.children).filter(([key, child]) => {
      if (!searchQuery) return true;
      return key.toLowerCase().includes(searchQuery) || matchesJsonStructure(child, searchQuery);
    });

    if (entries.length === 0) return null;

    return (
      <div>
        {entries.map(([key, child]) => {
          const path = [...parentPath, key];
          return (
            <TreeNode
              key={path.join('.')}
              varName={varName}
              label={key}
              node={child}
              path={path}
              collapsedPaths={collapsedPaths}
              onTogglePath={onTogglePath}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              searchQuery={searchQuery}
              depth={depth}
            />
          );
        })}
      </div>
    );
  }

  if (node.type === 'array' && node.children) {
    const items = node.children.map((child, i) => ({ child, i })).filter(({ child }) => {
      if (!searchQuery) return true;
      return matchesJsonStructure(child, searchQuery);
    });

    if (items.length === 0) return null;

    return (
      <div>
        {items.map(({ child, i }) => {
          const path = [...parentPath, '[' + i + ']'];
          return (
            <TreeNode
              key={path.join('.')}
              varName={varName}
              label={'[' + i + ']'}
              node={child}
              path={path}
              collapsedPaths={collapsedPaths}
              onTogglePath={onTogglePath}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              searchQuery={searchQuery}
              depth={depth}
            />
          );
        })}
      </div>
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
  const spinExpr = buildSpinExpression(varName, path, isLeaf);
  const dragData = { name: varName, spinExpression: spinExpr, isLeaf };

  return (
    <div>
      <div
        class="variable-picker-tree-node"
        draggable={true}
        data-var-name={varName}
        data-path={JSON.stringify(path)}
        data-leaf={String(isLeaf)}
        onDragStart={(e) => onDragStart(e, dragData)}
        onDragEnd={onDragEnd}
        title={'SPIN: ' + spinExpr}
      >
        {hasChildren
          ? (
            <span
              class={'variable-picker-tree-toggle' + (isExpanded ? '' : ' collapsed')}
              onClick={(e) => { e.stopPropagation(); onTogglePath(pathKey); }}
            >
              <ChevronIcon />
            </span>
          )
          : <span class="variable-picker-tree-leaf-spacer" />}
        <span class={'variable-picker-type-icon type-' + node.type}>{icon}</span>
        <div class="variable-picker-item-content">
          <div class="variable-picker-item-row">
            <span class="variable-picker-tree-label">{label}</span>
            <span class="variable-picker-item-type">{node.type}</span>
          </div>
          {isLeaf && node.value !== undefined && (
            <div class="variable-picker-item-value-row">{formatValue(node.value)}</div>
          )}
        </div>
      </div>
      {hasChildren && isExpanded && (
        <div class="variable-picker-tree-children">
          <TreeChildren
            varName={varName}
            node={node}
            parentPath={path}
            collapsedPaths={collapsedPaths}
            onTogglePath={onTogglePath}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            searchQuery={searchQuery}
            depth={depth + 1}
          />
        </div>
      )}
    </div>
  );
}
