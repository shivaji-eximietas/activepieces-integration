import { createAction, Property } from '@activepieces/pieces-framework';
import type { CustomPropertyCodeFunctionParams } from '@activepieces/pieces-framework';

function visualMapperCode(params: CustomPropertyCodeFunctionParams): (() => void) | void {
  const el = document.getElementById(params.containerId);
  if (!el) return;

  const cb = params.onChange;
  const dis = !!params.disabled;
  const flowSteps = params.flowSteps || [];
  const stepSampleData = params.stepSampleData || {};

  type FieldType = 'string' | 'number' | 'boolean' | 'object' | 'array' | 'null' | 'unknown';

  type Transform = 'none' | 'trim' | 'toUpperCase' | 'toLowerCase' | 'toNumber' | 'toBoolean' | 'toString' | 'parseJSON' | 'stringify' | 'iterateMap';

  type MapperState = {
    stepRef: string;
    inputFields: string[];
    inputTypes: Record<string, FieldType>;
    outputFields: string[];
    outputTypes: Record<string, FieldType>;
    connections: Record<string, string[]>;
    transforms: Record<string, Transform[]>;
    excludeEmptyValues: boolean;
    mapping: Record<string, unknown>;
  };

  const stored = params.value && typeof params.value === 'object'
    ? params.value as Record<string, unknown>
    : {};

  const availableStepNames = flowSteps.map((st) => st.name);
  const storedRef = stored.stepRef as string | undefined;
  const validStepRef = storedRef && availableStepNames.includes(storedRef)
    ? storedRef
    : (flowSteps.length > 0 ? flowSteps[0].name : 'trigger');

  const s: MapperState = {
    stepRef: validStepRef,
    inputFields: (stored.inputFields as string[]) || [],
    inputTypes: (stored.inputTypes as Record<string, FieldType>) || {},
    outputFields: (stored.outputFields as string[]) || [],
    outputTypes: (stored.outputTypes as Record<string, FieldType>) || {},
    connections: (stored.connections as Record<string, string[]>) || {},
    transforms: (stored.transforms as Record<string, Transform[]>) || {},
    excludeEmptyValues: Boolean(stored.excludeEmptyValues),
    mapping: (stored.mapping as Record<string, unknown>) || {},
  };

  // If stepRef was corrected, clear stale mapping that references the wrong step
  if (storedRef && storedRef !== validStepRef && Object.keys(s.mapping).length > 0) {
    s.mapping = {};
  }

  let pendingInputs: string[] = [];
  const scrollListeners: (() => void)[] = [];
  const expandedInputNodes = new Set<string>();
  const expandedOutputNodes = new Set<string>();
  let inputAutoExpandDone = false;
  let outputAutoExpandDone = false;
  let inputSearchTerm = '';
  let outputSearchTerm = '';

  type TreeNode = {
    segment: string;
    path: string;
    type: FieldType;
    children: TreeNode[];
    isLeaf: boolean;
    flatIndex: number;
  };

  function buildTree(fields: string[], types: Record<string, FieldType>): TreeNode[] {
    const root: TreeNode[] = [];
    fields.forEach((field, idx) => {
      const segments = field.split('.');
      let children = root;
      let pathSoFar = '';
      segments.forEach((seg, si) => {
        pathSoFar = pathSoFar ? pathSoFar + '.' + seg : seg;
        const isLast = si === segments.length - 1;
        let existing = children.find((c) => c.segment === seg && c.path === pathSoFar);
        if (!existing) {
          existing = {
            segment: seg,
            path: pathSoFar,
            type: isLast ? (types[field] || 'unknown') : 'object',
            children: [],
            isLeaf: isLast,
            flatIndex: isLast ? idx : -1,
          };
          children.push(existing);
        }
        if (isLast) {
          existing.isLeaf = true;
          existing.flatIndex = idx;
          existing.type = types[field] || 'unknown';
        }
        children = existing.children;
      });
    });
    return root;
  }

  function collectAllPaths(nodes: TreeNode[]): string[] {
    const paths: string[] = [];
    function walk(n: TreeNode): void {
      if (n.children.length > 0) paths.push(n.path);
      n.children.forEach(walk);
    }
    nodes.forEach(walk);
    return paths;
  }

  function getValueForPath(path: string): string {
    const data = stepSampleData[s.stepRef];
    if (!data || typeof data !== 'object') return '';
    const parts = path.split('.');
    let cur: unknown = data;
    for (const part of parts) {
      if (cur === null || cur === undefined || typeof cur !== 'object') return '';
      const arrMatch = part.match(/^(.+)\[(\d+)\]$/);
      if (arrMatch) {
        cur = (cur as Record<string, unknown>)[arrMatch[1]];
        if (Array.isArray(cur)) cur = cur[Number(arrMatch[2])];
        else return '';
      } else {
        cur = (cur as Record<string, unknown>)[part];
      }
    }
    if (cur === null || cur === undefined) return '';
    if (typeof cur === 'object') return JSON.stringify(cur);
    return String(cur);
  }

  function filterTree(nodes: TreeNode[], term: string): TreeNode[] {
    if (!term) return nodes;
    const lc = term.toLowerCase();
    function leafMatches(path: string): boolean {
      if (path.toLowerCase().indexOf(lc) >= 0) return true;
      const val = getValueForPath(path);
      return val.toLowerCase().indexOf(lc) >= 0;
    }
    function prune(n: TreeNode): TreeNode | null {
      if (n.isLeaf && !n.children.length) {
        return leafMatches(n.path) ? n : null;
      }
      const filteredChildren = n.children.map(prune).filter(Boolean) as TreeNode[];
      if (filteredChildren.length > 0 || n.path.toLowerCase().indexOf(lc) >= 0) {
        return { ...n, children: filteredChildren };
      }
      return null;
    }
    return nodes.map(prune).filter(Boolean) as TreeNode[];
  }

  // ─── Type detection ───────────────────────────────────────────────────────

  function detectType(value: unknown): FieldType {
    if (value === null || value === undefined) return 'null';
    if (Array.isArray(value)) return 'array';
    const t = typeof value;
    if (t === 'string' || t === 'number' || t === 'boolean') return t;
    if (t === 'object') return 'object';
    return 'unknown';
  }

  function typeColor(t: FieldType): string {
    switch (t) {
      case 'string': return '#2563eb';
      case 'number': return '#d97706';
      case 'boolean': return '#7c3aed';
      case 'object': return '#059669';
      case 'array': return '#dc2626';
      case 'null': return '#6b7280';
      default: return '#6b7280';
    }
  }

  function typesCompatible(input: FieldType, output: FieldType): boolean {
    if (output === 'unknown' || input === 'unknown') return true;
    if (output === 'string') return true;
    return input === output;
  }

  // ─── Utilities ────────────────────────────────────────────────────────────

  function flattenWithTypes(obj: unknown, prefix: string, fields: string[], types: Record<string, FieldType>): void {
    if (obj === null || obj === undefined) {
      if (prefix) { fields.push(prefix); types[prefix] = 'null'; }
      return;
    }
    if (Array.isArray(obj)) {
      if (prefix) { fields.push(prefix); types[prefix] = 'array'; }
      if (obj.length > 0 && typeof obj[0] === 'object' && obj[0] !== null) {
        flattenWithTypes(obj[0], prefix + '[0]', fields, types);
      }
      return;
    }
    if (typeof obj === 'object') {
      const keys = Object.keys(obj as Record<string, unknown>);
      if (!keys.length) {
        if (prefix) { fields.push(prefix); types[prefix] = 'object'; }
        return;
      }
      if (prefix) { fields.push(prefix); types[prefix] = 'object'; }
      keys.forEach((k) => {
        const newPrefix = prefix ? prefix + '.' + k : k;
        const val = (obj as Record<string, unknown>)[k];
        flattenWithTypes(val, newPrefix, fields, types);
      });
      return;
    }
    if (prefix) { fields.push(prefix); types[prefix] = detectType(obj); }
  }

  function pathToTemplate(path: string): string {
    const parts: string[] = [];
    path.split('.').forEach((segment) => {
      const arrMatch = segment.match(/^(.+)\[(\d+)\]$/);
      if (arrMatch) {
        parts.push("['" + arrMatch[1] + "']");
        parts.push('[' + arrMatch[2] + ']');
      } else {
        parts.push("['" + segment + "']");
      }
    });
    return '{{' + s.stepRef + parts.join('') + '}}';
  }

  function setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): void {
    const parts = path.split('.');
    let cur: Record<string, unknown> = obj;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!cur[parts[i]] || typeof cur[parts[i]] !== 'object') cur[parts[i]] = {};
      cur = cur[parts[i]] as Record<string, unknown>;
    }
    cur[parts[parts.length - 1]] = value;
  }

  function applyTransformExpression(template: string, transforms: Transform[]): unknown {
    if (!transforms || transforms.length === 0) return template;
    return { __value: template, __transforms: transforms };
  }

  function buildMapping(): Record<string, unknown> {
    const m: Record<string, unknown> = {};
    Object.keys(s.connections).forEach((outField) => {
      const inputs = s.connections[outField];
      if (!inputs || inputs.length === 0) return;
      const txforms = s.transforms[outField] || [];
      if (inputs.length === 1) {
        const raw = pathToTemplate(inputs[0]);
        setNestedValue(m, outField, applyTransformExpression(raw, txforms));
      } else {
        const joined = inputs.map((inp) => pathToTemplate(inp)).join(' ');
        setNestedValue(m, outField, applyTransformExpression(joined, txforms));
      }
    });
    return m;
  }

  function persist(): void {
    s.mapping = buildMapping();
    cb({
      stepRef: s.stepRef,
      inputFields: s.inputFields.slice(),
      inputTypes: Object.assign({}, s.inputTypes),
      outputFields: s.outputFields.slice(),
      outputTypes: Object.assign({}, s.outputTypes),
      connections: JSON.parse(JSON.stringify(s.connections)),
      transforms: JSON.parse(JSON.stringify(s.transforms)),
      excludeEmptyValues: s.excludeEmptyValues,
      mapping: s.mapping,
    });
    renderMain();
  }

  function updateJsonEditor(): void {
    const ta = document.getElementById(params.containerId + '-json-editor') as HTMLTextAreaElement | null;
    if (ta && document.activeElement !== ta) {
      ta.value = JSON.stringify(buildMapping(), null, 2) || '{}';
    }
    updateBridge();
  }

  // ─── DOM helpers ──────────────────────────────────────────────────────────

  function mk(tag: string, css?: string): HTMLElement {
    const e = document.createElement(tag);
    if (css) e.style.cssText = css;
    return e;
  }
  function mkText(tag: string, text: string, css?: string): HTMLElement {
    const e = mk(tag, css);
    e.textContent = text;
    return e;
  }
  function mkBtn(label: string, css: string, onClick: () => void): HTMLElement {
    const b = mk('button', css) as HTMLButtonElement;
    b.textContent = label;
    b.disabled = dis;
    b.onclick = (ev) => { ev.stopPropagation(); ev.preventDefault(); onClick(); };
    return b;
  }
  function mkSelect(options: { value: string; label: string }[], selected: string, onChange: (v: string) => void, css?: string): HTMLElement {
    const sel = mk('select', css || 'border:1px solid #d1d5db;border-radius:5px;padding:4px 8px;font-size:12px;background:#fff;') as HTMLSelectElement;
    options.forEach((opt) => {
      const o = document.createElement('option');
      o.value = opt.value;
      o.textContent = opt.label;
      if (opt.value === selected) o.selected = true;
      sel.appendChild(o);
    });
    sel.onchange = () => onChange(sel.value);
    sel.disabled = dis;
    return sel;
  }
  function mkTypeBadge(t: FieldType): HTMLElement {
    return mkText('span', t, 'font-size:9px;background:' + typeColor(t) + '20;color:' + typeColor(t) + ';border-radius:3px;padding:1px 4px;font-weight:600;text-transform:uppercase;flex-shrink:0;');
  }

  // ─── SVG lines (with clip to container bounds) ────────────────────────────

  const lineColors = ['#7c3aed', '#059669', '#2563eb', '#d97706', '#dc2626', '#0891b2', '#be185d', '#4f46e5'];

  function drawLines(): void {
    const bodyEl = document.getElementById(params.containerId + '-mapper-body');
    const svg = document.getElementById(params.containerId + '-svg') as SVGElement | null;
    if (!svg || !bodyEl) return;
    svg.innerHTML = '';
    const br = bodyEl.getBoundingClientRect();
    if (!br.width) return;

    let colorIdx = 0;
    Object.keys(s.connections).forEach((outField) => {
      const inputs = s.connections[outField];
      if (!inputs || inputs.length === 0) return;
      const oi = s.outputFields.indexOf(outField);
      if (oi < 0) return;
      const color = lineColors[colorIdx % lineColors.length];
      colorIdx++;

      inputs.forEach((inField) => {
        const ii = s.inputFields.indexOf(inField);
        if (ii < 0) return;
        const inDot = document.getElementById(params.containerId + '-in-dot-' + ii);
        const outDot = document.getElementById(params.containerId + '-out-dot-' + oi);
        if (!inDot || !outDot) return;

        const r1 = inDot.getBoundingClientRect();
        const r2 = outDot.getBoundingClientRect();

        // Skip lines for dots scrolled out of view
        if (r1.bottom < br.top || r1.top > br.bottom) return;
        if (r2.bottom < br.top || r2.top > br.bottom) return;

        const x1 = r1.right - br.left;
        const y1 = (r1.top + r1.bottom) / 2 - br.top;
        const x2 = r2.left - br.left;
        const y2 = (r2.top + r2.bottom) / 2 - br.top;
        const cx = (x1 + x2) / 2;

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', 'M' + x1 + ',' + y1 + ' C' + cx + ',' + y1 + ' ' + cx + ',' + y2 + ' ' + x2 + ',' + y2);
        path.setAttribute('stroke', color);
        path.setAttribute('stroke-width', '2');
        path.setAttribute('fill', 'none');
        path.setAttribute('opacity', '0.8');
        svg.appendChild(path);

        // Draw small circles at endpoints
        const c1 = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        c1.setAttribute('cx', String(x1)); c1.setAttribute('cy', String(y1));
        c1.setAttribute('r', '3'); c1.setAttribute('fill', color);
        svg.appendChild(c1);
        const c2 = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        c2.setAttribute('cx', String(x2)); c2.setAttribute('cy', String(y2));
        c2.setAttribute('r', '3'); c2.setAttribute('fill', color);
        svg.appendChild(c2);
      });
    });
  }

  // ─── Input panel (left) ───────────────────────────────────────────────────

  function loadFieldsFromStep(): void {
    const data = stepSampleData[s.stepRef];
    if (data && typeof data === 'object') {
      s.inputFields = [];
      s.inputTypes = {};
      flattenWithTypes(data, '', s.inputFields, s.inputTypes);
      Object.keys(s.connections).forEach((out) => {
        s.connections[out] = (s.connections[out] || []).filter((inp) => s.inputFields.indexOf(inp) >= 0);
        if (s.connections[out].length === 0) delete s.connections[out];
      });
    }
  }

  function buildLeftPanel(): HTMLElement {
    const panel = mk('div', 'flex:1;min-width:0;display:flex;flex-direction:column;border-right:1px solid var(--border, #e5e7eb);');

    const hdr = mk('div', 'padding:10px;border-bottom:1px solid var(--border, #e5e7eb);flex-shrink:0;');
    hdr.appendChild(mkText('div', 'SOURCE STEP', 'font-weight:600;font-size:9px;color:var(--muted-foreground, #6b7280);margin-bottom:4px;text-transform:uppercase;letter-spacing:0.5px;'));

    const stepOptions = flowSteps.map((step) => ({ value: step.name, label: step.displayName + ' (' + step.name + ')' }));
    if (stepOptions.length === 0) stepOptions.push({ value: 'trigger', label: 'trigger' });
    hdr.appendChild(mkSelect(stepOptions, s.stepRef, (v) => {
      s.stepRef = v;
      loadFieldsFromStep();
      updateJsonEditor();
      renderFloatingContent();
    }, 'width:100%;border:1px solid #d1d5db;border-radius:5px;padding:4px 8px;font-size:11px;background:#fff;margin-bottom:6px;'));

    // Actions row matching target schema style
    const actionsRow = mk('div', 'display:flex;gap:3px;align-items:center;');
    const addIn = mk('input', 'flex:1;border:1px solid #d1d5db;border-radius:4px;padding:3px 6px;font-size:10px;min-width:0;') as HTMLInputElement;
    addIn.placeholder = 'field (e.g. data.name)';
    addIn.disabled = dis;
    const addBtn = mkBtn('+', 'background:#7c3aed;color:#fff;border:none;border-radius:4px;padding:3px 7px;cursor:pointer;font-size:12px;line-height:1;', () => {
      const v = addIn.value.trim();
      if (v && s.inputFields.indexOf(v) < 0) { s.inputFields.push(v); if (!s.inputTypes[v]) s.inputTypes[v] = 'string'; addIn.value = ''; renderFloatingContent(); }
    });
    addIn.onkeydown = (e: KeyboardEvent) => { if (e.key === 'Enter') (addBtn as HTMLButtonElement).click(); };
    actionsRow.appendChild(addIn);
    actionsRow.appendChild(addBtn);
    actionsRow.appendChild(mkBtn('Import', 'background:#fff;color:#374151;border:1px solid #d1d5db;border-radius:4px;padding:3px 6px;cursor:pointer;font-size:9px;white-space:nowrap;', showSourceImport));
    hdr.appendChild(actionsRow);

    if (!stepSampleData[s.stepRef] && s.inputFields.length === 0) {
      const hint = mkText('div', 'No sample data. Paste JSON or add fields manually.', 'color:#9ca3af;font-size:10px;margin-top:4px;');
      hdr.appendChild(hint);
    } else if (s.inputFields.length === 0) {
      loadFieldsFromStep();
    }

    panel.appendChild(hdr);

    // Search + expand/collapse toolbar
    const toolbar = mk('div', 'display:flex;gap:3px;align-items:center;padding:4px 6px;border-bottom:1px solid var(--border, #e5e7eb);flex-shrink:0;');
    const searchIn = mk('input', 'flex:1;border:1px solid var(--border, #e5e7eb);border-radius:4px;padding:3px 6px;font-size:10px;min-width:0;background:var(--background, #fff);color:var(--foreground, #0a0a0a);') as HTMLInputElement;
    searchIn.id = params.containerId + '-search-input';
    searchIn.placeholder = '🔍 Search keys or values...';
    searchIn.value = inputSearchTerm;
    searchIn.oninput = () => { inputSearchTerm = searchIn.value; renderFloatingContent(); };
    toolbar.appendChild(searchIn);
    const expandAllInBtn = mkBtn('⊞ Expand', 'background:none;border:1px solid #e5e7eb;border-radius:3px;padding:2px 6px;cursor:pointer;font-size:9px;color:#6b7280;white-space:nowrap;', () => {
      inputAutoExpandDone = true;
      const allTree = buildTree(s.inputFields, s.inputTypes);
      collectAllPaths(allTree).forEach((p) => expandedInputNodes.add(p));
      renderFloatingContent();
    });
    expandAllInBtn.title = 'Expand all fields';
    toolbar.appendChild(expandAllInBtn);
    const collapseAllInBtn = mkBtn('⊟ Collapse', 'background:none;border:1px solid #e5e7eb;border-radius:3px;padding:2px 6px;cursor:pointer;font-size:9px;color:#6b7280;white-space:nowrap;', () => {
      inputAutoExpandDone = true;
      expandedInputNodes.clear();
      renderFloatingContent();
    });
    collapseAllInBtn.title = 'Collapse all fields';
    toolbar.appendChild(collapseAllInBtn);
    panel.appendChild(toolbar);

    const fieldsList = mk('div', 'flex:1;overflow-y:auto;padding:4px;');
    fieldsList.id = params.containerId + '-left-scroll';
    if (s.inputFields.length > 0 && !inputSearchTerm) {
      fieldsList.appendChild(mkText('div', 'Select field(s) → click target', 'color:#6b7280;font-size:9px;margin-bottom:3px;padding:0 4px;'));
    }

    const fullTree = buildTree(s.inputFields, s.inputTypes);
    const tree = filterTree(fullTree, inputSearchTerm);
    if (inputSearchTerm) { collectAllPaths(tree).forEach((p) => expandedInputNodes.add(p)); }

    // Auto-expand top 2 levels on first render only
    if (!inputAutoExpandDone && expandedInputNodes.size === 0 && !inputSearchTerm) {
      inputAutoExpandDone = true;
      tree.forEach((n) => {
        if (n.children.length > 0) {
          expandedInputNodes.add(n.path);
          n.children.forEach((c) => { if (c.children.length > 0) expandedInputNodes.add(c.path); });
        }
      });
    }

    function renderInputNode(node: TreeNode, depth: number, isLast: boolean): void {
      const hasChildren = node.children.length > 0;
      const isExpanded = expandedInputNodes.has(node.path);
      const isSelectable = node.isLeaf || node.type === 'object' || node.type === 'array';
      const isSelected = isSelectable && pendingInputs.indexOf(node.path) >= 0;
      const isConnected = isSelectable && Object.values(s.connections).some((arr) => arr.indexOf(node.path) >= 0);
      const indent = depth * 18;

      const row = mk('div',
        'display:flex;align-items:center;gap:4px;padding:3px 5px;border-radius:4px;margin-bottom:1px;cursor:pointer;transition:all 0.1s;position:relative;' +
        'padding-left:' + (indent + 5) + 'px;' +
        'border:1px solid ' + (isSelected ? '#7c3aed' : isConnected ? '#059669' : 'transparent') +
        ';background:' + (isSelected ? '#ede9fe' : isConnected ? '#ecfdf5' : 'transparent') + ';',
      );

      // Tree guide lines
      if (depth > 0) {
        const guide = mk('span', 'position:absolute;left:' + ((depth - 1) * 18 + 10) + 'px;top:0;bottom:' + (isLast ? '50%' : '0') + ';width:1px;background:#e5e7eb;pointer-events:none;');
        row.appendChild(guide);
        const hGuide = mk('span', 'position:absolute;left:' + ((depth - 1) * 18 + 10) + 'px;top:50%;width:8px;height:1px;background:#e5e7eb;pointer-events:none;');
        row.appendChild(hGuide);
      }

      row.onmouseenter = () => { if (!isSelected && !isConnected) row.style.background = '#f9fafb'; };
      row.onmouseleave = () => { if (!isSelected && !isConnected) row.style.background = isSelected ? '#ede9fe' : isConnected ? '#ecfdf5' : 'transparent'; };

      // Expand/collapse chevron for parent nodes
      if (hasChildren) {
        const chevron = mkText('span', isExpanded ? '▾' : '▸', 'font-size:10px;color:#6b7280;flex-shrink:0;width:12px;text-align:center;cursor:pointer;');
        chevron.setAttribute('data-role', 'chevron');
        chevron.onclick = (e) => {
          e.stopPropagation();
          if (dis) return;
          if (isExpanded) expandedInputNodes.delete(node.path);
          else expandedInputNodes.add(node.path);
          renderFloatingContent();
        };
        row.appendChild(chevron);
      } else {
        row.appendChild(mk('span', 'width:12px;flex-shrink:0;'));
      }

      row.appendChild(mkTypeBadge(node.type));
      const txt = mkText('span', node.segment, 'flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;font-family:monospace;color:#374151;' + (hasChildren ? 'font-weight:600;' : ''));
      txt.title = node.path;
      row.appendChild(txt);

      if (isSelectable) {
        const dot = mk('span', 'width:8px;height:8px;border-radius:50%;flex-shrink:0;background:' + (isSelected ? '#7c3aed' : isConnected ? '#059669' : '#d1d5db') + ';border:2px solid ' + (isSelected ? '#5b21b6' : isConnected ? '#047857' : '#9ca3af') + ';');
        dot.id = params.containerId + '-in-dot-' + node.flatIndex;
        row.appendChild(dot);
      }

      // Show mapped target badge for connected input fields
      if (isConnected) {
        const targets = Object.entries(s.connections).filter(([_, arr]) => arr.indexOf(node.path) >= 0).map(([out]) => out.split('.').pop()!);
        const lbl = targets.length === 1 ? '→ ' + targets[0] : '→ ' + targets.length + ' targets';
        const tag = mkText('span', lbl, 'font-size:8px;color:#059669;background:#d1fae5;border-radius:3px;padding:1px 3px;max-width:80px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex-shrink:0;');
        tag.title = targets.join(', ');
        row.appendChild(tag);
      }

      row.onclick = (_ev) => {
        if (dis) return;
        if (isSelectable) {
          const idx = pendingInputs.indexOf(node.path);
          if (idx >= 0) pendingInputs.splice(idx, 1);
          else pendingInputs.push(node.path);
          renderFloatingContent();
        } else if (hasChildren) {
          if (isExpanded) expandedInputNodes.delete(node.path);
          else expandedInputNodes.add(node.path);
          renderFloatingContent();
        }
      };
      fieldsList.appendChild(row);

      if (hasChildren && isExpanded) {
        node.children.forEach((child, ci) => renderInputNode(child, depth + 1, ci === node.children.length - 1));
      }
    }

    tree.forEach((node, ni) => renderInputNode(node, 0, ni === tree.length - 1));

    if (s.inputFields.length === 0 && stepSampleData[s.stepRef]) {
      fieldsList.appendChild(mkText('div', 'No fields in sample data', 'text-align:center;color:#9ca3af;font-size:10px;padding:16px 0;'));
    }
    panel.appendChild(fieldsList);

    if (pendingInputs.length > 0) {
      const hint = mk('div', 'padding:4px 8px;background:#ede9fe;border-top:1px solid #c4b5fd;font-size:9px;color:#5b21b6;flex-shrink:0;');
      hint.innerHTML = '<b>' + pendingInputs.length + '</b> selected → click target';
      panel.appendChild(hint);
    }

    return panel;
  }

  // ─── Output panel (right) ─────────────────────────────────────────────────

  function buildRightPanel(): HTMLElement {
    const panel = mk('div', 'flex:1;min-width:0;display:flex;flex-direction:column;');

    const hdr = mk('div', 'padding:10px;border-bottom:1px solid var(--border, #e5e7eb);flex-shrink:0;');
    hdr.appendChild(mkText('div', 'TARGET SCHEMA', 'font-weight:600;font-size:9px;color:var(--muted-foreground, #6b7280);margin-bottom:4px;text-transform:uppercase;letter-spacing:0.5px;'));

    const actionsRow = mk('div', 'display:flex;gap:3px;align-items:center;');
    const addIn = mk('input', 'flex:1;border:1px solid #d1d5db;border-radius:4px;padding:3px 6px;font-size:10px;min-width:0;') as HTMLInputElement;
    addIn.placeholder = 'field (e.g. data.name)';
    addIn.disabled = dis;
    const addBtn = mkBtn('+', 'background:#059669;color:#fff;border:none;border-radius:4px;padding:3px 7px;cursor:pointer;font-size:12px;line-height:1;', () => {
      const v = addIn.value.trim();
      if (v && s.outputFields.indexOf(v) < 0) { s.outputFields.push(v); if (!s.outputTypes[v]) s.outputTypes[v] = 'string'; addIn.value = ''; renderFloatingContent(); }
    });
    addIn.onkeydown = (e: KeyboardEvent) => { if (e.key === 'Enter') (addBtn as HTMLButtonElement).click(); };
    actionsRow.appendChild(addIn);
    actionsRow.appendChild(addBtn);
    actionsRow.appendChild(mkBtn('Import', 'background:#fff;color:#374151;border:1px solid #d1d5db;border-radius:4px;padding:3px 6px;cursor:pointer;font-size:9px;white-space:nowrap;', showOutputImport));
    hdr.appendChild(actionsRow);
    panel.appendChild(hdr);

    // Search + expand/collapse toolbar
    const toolbar = mk('div', 'display:flex;gap:3px;align-items:center;padding:4px 6px;border-bottom:1px solid var(--border, #e5e7eb);flex-shrink:0;');
    const searchOut = mk('input', 'flex:1;border:1px solid var(--border, #e5e7eb);border-radius:4px;padding:3px 6px;font-size:10px;min-width:0;background:var(--background, #fff);color:var(--foreground, #0a0a0a);') as HTMLInputElement;
    searchOut.id = params.containerId + '-search-output';
    searchOut.placeholder = '🔍 Search keys or values...';
    searchOut.value = outputSearchTerm;
    searchOut.oninput = () => { outputSearchTerm = searchOut.value; renderFloatingContent(); };
    toolbar.appendChild(searchOut);
    const expandAllOutBtn = mkBtn('⊞ Expand', 'background:none;border:1px solid #e5e7eb;border-radius:3px;padding:2px 6px;cursor:pointer;font-size:9px;color:#6b7280;white-space:nowrap;', () => {
      outputAutoExpandDone = true;
      const allTree = buildTree(s.outputFields, s.outputTypes);
      collectAllPaths(allTree).forEach((p) => expandedOutputNodes.add(p));
      renderFloatingContent();
    });
    expandAllOutBtn.title = 'Expand all fields';
    toolbar.appendChild(expandAllOutBtn);
    const collapseAllOutBtn = mkBtn('⊟ Collapse', 'background:none;border:1px solid #e5e7eb;border-radius:3px;padding:2px 6px;cursor:pointer;font-size:9px;color:#6b7280;white-space:nowrap;', () => {
      outputAutoExpandDone = true;
      expandedOutputNodes.clear();
      renderFloatingContent();
    });
    collapseAllOutBtn.title = 'Collapse all fields';
    toolbar.appendChild(collapseAllOutBtn);
    panel.appendChild(toolbar);

    const fieldsList = mk('div', 'flex:1;overflow-y:auto;padding:4px;');
    fieldsList.id = params.containerId + '-right-scroll';

    if (s.outputFields.length === 0) {
      fieldsList.appendChild(mkText('div', 'Add fields or import JSON', 'text-align:center;color:#9ca3af;font-size:10px;padding:16px 0;'));
    }

    const fullTree = buildTree(s.outputFields, s.outputTypes);
    const tree = filterTree(fullTree, outputSearchTerm);
    if (outputSearchTerm) { collectAllPaths(tree).forEach((p) => expandedOutputNodes.add(p)); }

    // Auto-expand top 2 levels on first render only
    if (!outputAutoExpandDone && expandedOutputNodes.size === 0 && !outputSearchTerm) {
      outputAutoExpandDone = true;
      tree.forEach((n) => {
        if (n.children.length > 0) {
          expandedOutputNodes.add(n.path);
          n.children.forEach((c) => { if (c.children.length > 0) expandedOutputNodes.add(c.path); });
        }
      });
    }

    function renderOutputNode(node: TreeNode, depth: number, isLastNode: boolean): void {
      const hasChildren = node.children.length > 0;
      const isExpanded = expandedOutputNodes.has(node.path);
      const isTargetable = node.isLeaf || s.outputFields.indexOf(node.path) >= 0;
      const connInputs = isTargetable ? (s.connections[node.path] || []) : [];
      const isConnected = connInputs.length > 0;
      const indent = depth * 18;

      const row = mk('div',
        'display:flex;align-items:center;gap:4px;padding:3px 5px;border-radius:4px;margin-bottom:1px;cursor:pointer;transition:all 0.1s;position:relative;' +
        'padding-left:' + (indent + 5) + 'px;' +
        'border:1px solid ' + (isConnected ? '#6ee7b7' : 'transparent') +
        ';background:' + (isConnected ? '#ecfdf5' : 'transparent') + ';',
      );

      // Tree guide lines
      if (depth > 0) {
        const guide = mk('span', 'position:absolute;left:' + ((depth - 1) * 18 + 10) + 'px;top:0;bottom:' + (isLastNode ? '50%' : '0') + ';width:1px;background:#e5e7eb;pointer-events:none;');
        row.appendChild(guide);
        const hGuide = mk('span', 'position:absolute;left:' + ((depth - 1) * 18 + 10) + 'px;top:50%;width:8px;height:1px;background:#e5e7eb;pointer-events:none;');
        row.appendChild(hGuide);
      }

      row.onmouseenter = () => { if (!isConnected) row.style.background = '#f9fafb'; };
      row.onmouseleave = () => { row.style.background = isConnected ? '#ecfdf5' : 'transparent'; };

      // Expand/collapse chevron for parent nodes
      if (hasChildren) {
        const chevron = mkText('span', isExpanded ? '▾' : '▸', 'font-size:10px;color:#6b7280;flex-shrink:0;width:12px;text-align:center;cursor:pointer;');
        chevron.setAttribute('data-role', 'chevron');
        chevron.onclick = (e) => {
          e.stopPropagation();
          if (dis) return;
          if (isExpanded) expandedOutputNodes.delete(node.path);
          else expandedOutputNodes.add(node.path);
          renderFloatingContent();
        };
        row.appendChild(chevron);
      } else {
        row.appendChild(mk('span', 'width:12px;flex-shrink:0;'));
      }

      if (isTargetable) {
        const dot = mk('span', 'width:8px;height:8px;border-radius:50%;flex-shrink:0;background:' + (isConnected ? '#059669' : '#d1d5db') + ';border:2px solid ' + (isConnected ? '#047857' : '#9ca3af') + ';');
        dot.id = params.containerId + '-out-dot-' + node.flatIndex;
        row.appendChild(dot);
      }

      row.appendChild(mkTypeBadge(node.type));
      const txt = mkText('span', node.segment, 'flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;font-family:monospace;color:#374151;' + (hasChildren ? 'font-weight:600;' : ''));
      txt.title = node.path;
      row.appendChild(txt);

      if (isConnected) {
        const lbl = connInputs.length === 1 ? connInputs[0].split('.').pop()! : connInputs.length + ' joined';
        const tag = mkText('span', lbl, 'font-size:8px;color:#059669;background:#d1fae5;border-radius:3px;padding:1px 3px;max-width:80px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex-shrink:0;');
        tag.title = connInputs.join(' + ');
        row.appendChild(tag);
        row.appendChild(mkBtn('⊘', 'background:none;border:none;color:#ef4444;cursor:pointer;font-size:11px;padding:0 2px;flex-shrink:0;', () => {
          delete s.connections[node.path]; delete s.transforms[node.path]; updateJsonEditor(); renderFloatingContent();
        }));
      }
      if (node.isLeaf) {
        row.appendChild(mkBtn('×', 'background:none;border:none;color:#9ca3af;cursor:pointer;font-size:12px;padding:0 2px;flex-shrink:0;', () => {
          const fi = s.outputFields.indexOf(node.path);
          if (fi >= 0) s.outputFields.splice(fi, 1);
          delete s.connections[node.path]; delete s.transforms[node.path]; delete s.outputTypes[node.path]; updateJsonEditor(); renderFloatingContent();
        }));
      }

      row.onclick = (ev) => {
        if ((ev.target as HTMLElement).tagName === 'BUTTON') return;
        if ((ev.target as HTMLElement).tagName === 'SELECT') return;
        if (dis) return;
        if (isTargetable && pendingInputs.length > 0) {
          const inTypes = pendingInputs.map((inp) => s.inputTypes[inp] || 'unknown');
          const outType = s.outputTypes[node.path] || 'unknown';
          const allCompatible = inTypes.every((it) => typesCompatible(it, outType));
          if (!allCompatible) {
            if (!confirm('Type mismatch: connecting ' + inTypes.join('+') + ' → ' + outType + '. Continue?')) return;
          }
          s.connections[node.path] = pendingInputs.slice();
          pendingInputs = [];
          updateJsonEditor();
          persist();
          renderFloatingContent();
        } else if (isTargetable && isConnected) {
          delete s.connections[node.path];
          delete s.transforms[node.path];
          updateJsonEditor();
          persist();
          renderFloatingContent();
        } else if (hasChildren) {
          if (isExpanded) expandedOutputNodes.delete(node.path);
          else expandedOutputNodes.add(node.path);
          renderFloatingContent();
        }
      };
      fieldsList.appendChild(row);

      // Transform row for connected fields
      if (isConnected) {
        const txRow = mk('div', 'display:flex;align-items:center;gap:3px;padding:2px 5px 4px;padding-left:' + (indent + 25) + 'px;margin-bottom:2px;');
        const txLabel = mkText('span', 'ƒ', 'font-size:10px;color:#7c3aed;font-weight:700;flex-shrink:0;');
        txLabel.title = 'Transform';
        txRow.appendChild(txLabel);

        const currentTx = s.transforms[node.path] || [];
        const txDisplay = mk('div', 'display:flex;flex-wrap:wrap;gap:2px;flex:1;align-items:center;');

        currentTx.forEach((t, ti) => {
          const chip = mk('span', 'font-size:8px;background:#ede9fe;color:#5b21b6;border-radius:3px;padding:1px 4px;display:inline-flex;align-items:center;gap:2px;');
          chip.textContent = t;
          const removeBtn = mk('span', 'cursor:pointer;font-size:9px;color:#7c3aed;font-weight:bold;');
          removeBtn.textContent = '×';
          removeBtn.onclick = (ev) => { ev.stopPropagation(); currentTx.splice(ti, 1); if (currentTx.length === 0) delete s.transforms[node.path]; else s.transforms[node.path] = currentTx; updateJsonEditor(); persist(); renderFloatingContent(); };
          chip.appendChild(removeBtn);
          txDisplay.appendChild(chip);
        });

        const addTxSelect = mk('select', 'font-size:9px;border:1px solid #d1d5db;border-radius:3px;padding:1px 3px;background:#fff;color:#374151;cursor:pointer;') as HTMLSelectElement;
        const txOptions: { value: Transform; label: string }[] = [
          { value: 'none', label: '+ transform' },
          { value: 'trim', label: 'Trim' },
          { value: 'toUpperCase', label: 'Uppercase' },
          { value: 'toLowerCase', label: 'Lowercase' },
          { value: 'toNumber', label: 'To Number' },
          { value: 'toBoolean', label: 'To Boolean' },
          { value: 'toString', label: 'To String' },
          { value: 'parseJSON', label: 'Parse JSON' },
          { value: 'stringify', label: 'Stringify' },
          { value: 'iterateMap', label: 'Iterate (array→objects)' },
        ];
        txOptions.forEach((opt) => { const o = document.createElement('option'); o.value = opt.value; o.textContent = opt.label; addTxSelect.appendChild(o); });
        addTxSelect.onchange = () => {
          const val = addTxSelect.value as Transform;
          if (val && val !== 'none') {
            if (!s.transforms[node.path]) s.transforms[node.path] = [];
            s.transforms[node.path].push(val);
            updateJsonEditor();
            persist();
            renderFloatingContent();
          }
        };
        txDisplay.appendChild(addTxSelect);
        txRow.appendChild(txDisplay);
        fieldsList.appendChild(txRow);
      }

      if (hasChildren && isExpanded) {
        node.children.forEach((child, ci) => renderOutputNode(child, depth + 1, ci === node.children.length - 1));
      }
    }

    tree.forEach((node, ni) => renderOutputNode(node, 0, ni === tree.length - 1));

    panel.appendChild(fieldsList);
    return panel;
  }

  // ─── Source import (shown in floating panel) ───────────────────────────────

  let showingSourceImport = false;

  function showSourceImport(): void {
    showingSourceImport = true;
    renderFloatingContent();
  }

  function buildSourceImportView(): HTMLElement {
    const wrap = mk('div', 'padding:16px;');
    wrap.appendChild(mkText('div', 'Import Source Schema', 'font-size:14px;font-weight:600;color:#374151;margin-bottom:6px;'));
    wrap.appendChild(mkText('div', 'Paste a JSON sample of your source data. Fields will be extracted with their types.', 'color:#6b7280;font-size:12px;margin-bottom:10px;'));

    const ta = mk('textarea', 'width:100%;min-height:160px;border:1px solid #d1d5db;border-radius:6px;padding:10px;font-size:12px;font-family:monospace;resize:vertical;box-sizing:border-box;') as HTMLTextAreaElement;
    ta.placeholder = '{\n  "id": 1,\n  "name": "John",\n  "address": { "city": "NY" }\n}';
    ta.disabled = dis;
    wrap.appendChild(ta);

    const errDiv = mk('div', 'color:#dc2626;font-size:11px;margin-top:4px;min-height:14px;');
    wrap.appendChild(errDiv);

    const btnRow = mk('div', 'display:flex;gap:8px;margin-top:10px;');
    btnRow.appendChild(mkBtn('← Back', 'background:#fff;color:#374151;border:1px solid #d1d5db;border-radius:6px;padding:7px 14px;cursor:pointer;font-size:12px;', () => { showingSourceImport = false; renderFloatingContent(); }));
    btnRow.appendChild(mkBtn('Extract & Apply', 'background:#7c3aed;color:#fff;border:none;border-radius:6px;padding:7px 14px;cursor:pointer;font-size:12px;font-weight:600;', () => {
      try {
        const parsed = JSON.parse(ta.value) as unknown;
        const fields: string[] = [];
        const types: Record<string, FieldType> = {};
        flattenWithTypes(parsed, '', fields, types);
        if (fields.length === 0) { errDiv.textContent = 'No fields found'; return; }
        s.inputFields = fields;
        s.inputTypes = types;
        s.connections = {};
        s.transforms = {};
        s.mapping = {};
        pendingInputs = [];
        showingSourceImport = false;
        persist();
        renderFloatingContent();
      } catch (err) { errDiv.textContent = 'Invalid JSON: ' + (err as Error).message; }
    }));
    wrap.appendChild(btnRow);
    return wrap;
  }

  // ─── Output import (shown in floating panel) ──────────────────────────────

  let showingImport = false;

  function showOutputImport(): void {
    showingImport = true;
    renderFloatingContent();
  }

  function buildImportView(): HTMLElement {
    const wrap = mk('div', 'padding:16px;');
    wrap.appendChild(mkText('div', 'Import Target Schema', 'font-size:14px;font-weight:600;color:#374151;margin-bottom:6px;'));
    wrap.appendChild(mkText('div', 'Paste a JSON sample of your desired output. Fields will be extracted with their types.', 'color:#6b7280;font-size:12px;margin-bottom:10px;'));

    const ta = mk('textarea', 'width:100%;min-height:160px;border:1px solid #d1d5db;border-radius:6px;padding:10px;font-size:12px;font-family:monospace;resize:vertical;box-sizing:border-box;') as HTMLTextAreaElement;
    ta.placeholder = '{\n  "data": {\n    "name": "",\n    "status": "active"\n  }\n}';
    ta.disabled = dis;
    wrap.appendChild(ta);

    const errDiv = mk('div', 'color:#dc2626;font-size:11px;margin-top:4px;min-height:14px;');
    wrap.appendChild(errDiv);

    const btnRow = mk('div', 'display:flex;gap:8px;margin-top:10px;');
    btnRow.appendChild(mkBtn('← Back', 'background:#fff;color:#374151;border:1px solid #d1d5db;border-radius:6px;padding:7px 14px;cursor:pointer;font-size:12px;', () => { showingImport = false; renderFloatingContent(); }));
    btnRow.appendChild(mkBtn('Extract & Apply', 'background:#059669;color:#fff;border:none;border-radius:6px;padding:7px 14px;cursor:pointer;font-size:12px;font-weight:600;', () => {
      try {
        const parsed = JSON.parse(ta.value) as unknown;
        const fields: string[] = [];
        const types: Record<string, FieldType> = {};
        flattenWithTypes(parsed, '', fields, types);
        if (fields.length === 0) { errDiv.textContent = 'No fields found'; return; }
        s.outputFields = fields;
        s.outputTypes = types;
        s.connections = {};
        s.transforms = {};
        s.mapping = {};
        pendingInputs = [];
        showingImport = false;
        persist();
        renderFloatingContent();
      } catch (err) { errDiv.textContent = 'Invalid JSON: ' + (err as Error).message; }
    }));
    wrap.appendChild(btnRow);
    return wrap;
  }

  // ─── React panel bridge (renders content into DataMapperPanel component) ──

  let isPanelOpen = false;

  function openPanel(): void {
    if (isPanelOpen) return;
    isPanelOpen = true;
    const bridge = {
      open: true,
      renderContent: (container: HTMLElement) => { renderFloatingContent(container); },
      onClose: () => { closePanel(); renderMain(); },
      mappedCount: Object.keys(s.connections).length,
    };
    (window as unknown as Record<string, unknown>).__apDataMapperBridge = bridge;
    window.dispatchEvent(new CustomEvent('ap-data-mapper-open'));
  }

  function closePanel(): void {
    isPanelOpen = false;
    scrollListeners.forEach((fn) => fn());
    scrollListeners.length = 0;
    const bridge = (window as unknown as Record<string, unknown>).__apDataMapperBridge as Record<string, unknown> | undefined;
    if (bridge) bridge.open = false;
    (window as unknown as Record<string, unknown>).__apDataMapperBridge = null;
    window.dispatchEvent(new CustomEvent('ap-data-mapper-close'));
  }

  function updateBridge(): void {
    const bridge = (window as unknown as Record<string, unknown>).__apDataMapperBridge as Record<string, unknown> | undefined;
    if (bridge) {
      bridge.mappedCount = Object.keys(s.connections).length;
    }
    window.dispatchEvent(new CustomEvent('ap-data-mapper-update'));
  }

  function renderFloatingContent(container?: HTMLElement): void {
    const target = container || document.querySelector('[data-ap-data-mapper-content]') as HTMLElement | null;
    if (!target) return;

    // Save scroll positions and focused element before rebuilding
    const leftScrollEl = document.getElementById(params.containerId + '-left-scroll');
    const rightScrollEl = document.getElementById(params.containerId + '-right-scroll');
    const savedLeftScroll = leftScrollEl ? leftScrollEl.scrollTop : 0;
    const savedRightScroll = rightScrollEl ? rightScrollEl.scrollTop : 0;
    const activeEl = document.activeElement as HTMLInputElement | null;
    const focusedId = activeEl && activeEl.id ? activeEl.id : null;
    const cursorPos = activeEl && typeof activeEl.selectionStart === 'number' ? activeEl.selectionStart : null;

    target.innerHTML = '';
    scrollListeners.forEach((fn) => fn());
    scrollListeners.length = 0;

    if (showingSourceImport) {
      target.appendChild(buildSourceImportView());
      return;
    }

    if (showingImport) {
      target.appendChild(buildImportView());
      return;
    }

    const mapperBody = mk('div', 'display:flex;position:relative;flex:1;overflow:hidden;');
    mapperBody.id = params.containerId + '-mapper-body';
    mapperBody.appendChild(buildLeftPanel());
    mapperBody.appendChild(buildRightPanel());

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.id = params.containerId + '-svg';
    svg.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;overflow:visible;z-index:10;';
    mapperBody.appendChild(svg);
    target.appendChild(mapperBody);

    // Restore scroll positions
    const newLeftScroll = document.getElementById(params.containerId + '-left-scroll');
    const newRightScroll = document.getElementById(params.containerId + '-right-scroll');
    if (newLeftScroll) newLeftScroll.scrollTop = savedLeftScroll;
    if (newRightScroll) newRightScroll.scrollTop = savedRightScroll;

    // Restore focus to the search input that was active
    if (focusedId) {
      const toFocus = document.getElementById(focusedId) as HTMLInputElement | null;
      if (toFocus) {
        toFocus.focus();
        if (cursorPos !== null && typeof toFocus.setSelectionRange === 'function') {
          toFocus.setSelectionRange(cursorPos, cursorPos);
        }
      }
    }

    // Attach scroll listeners for both panels to redraw lines on scroll
    const scrollHandler = () => requestAnimationFrame(drawLines);
    if (newLeftScroll) { newLeftScroll.addEventListener('scroll', scrollHandler); scrollListeners.push(() => newLeftScroll.removeEventListener('scroll', scrollHandler)); }
    if (newRightScroll) { newRightScroll.addEventListener('scroll', scrollHandler); scrollListeners.push(() => newRightScroll.removeEventListener('scroll', scrollHandler)); }

    requestAnimationFrame(() => requestAnimationFrame(drawLines));
  }

  // ─── Main render (JSON editor always visible + open panel button) ─────────

  function renderMain(): void {
    el!.innerHTML = '';
    el!.style.cssText = 'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-size:13px;';

    // JSON editor (always visible, old format)
    const jsonSection = mk('div', 'margin-bottom:10px;');
    const jsonHeader = mk('div', 'display:flex;align-items:center;margin-bottom:4px;');
    jsonHeader.appendChild(mkText('div', 'Mapping JSON', 'font-weight:600;font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:0.3px;flex:1;'));
    if (s.excludeEmptyValues) {
      jsonHeader.appendChild(mkText('span', 'Sanitize ON', 'font-size:10px;color:#059669;font-weight:600;margin-right:6px;'));
    }
    const clearBtn = mkBtn('Clear', 'background:none;border:1px solid #dc2626;color:#dc2626;border-radius:4px;padding:2px 8px;cursor:pointer;font-size:10px;font-weight:500;', () => {
      s.connections = {};
      s.transforms = {};
      s.mapping = {};
      updateJsonEditor();
      updateBridge();
      if (isPanelOpen) renderFloatingContent();
      renderMain();
    });
    if (!dis) jsonHeader.appendChild(clearBtn);
    jsonSection.appendChild(jsonHeader);
    const jsonTa = mk('textarea', 'width:100%;min-height:60px;max-height:300px;border:1px solid #d1d5db;border-radius:6px;padding:8px;font-size:11px;font-family:monospace;resize:none;box-sizing:border-box;background:#fafbfc;color:#1f2937;overflow-y:auto;') as HTMLTextAreaElement;
    jsonTa.id = params.containerId + '-json-editor';
    jsonTa.value = JSON.stringify(s.mapping, null, 2) || '{}';
    // Auto-grow textarea to fit content up to max-height
    const autoGrow = () => { jsonTa.style.height = 'auto'; jsonTa.style.height = Math.min(jsonTa.scrollHeight, 300) + 'px'; };
    jsonTa.addEventListener('input', autoGrow);
    setTimeout(autoGrow, 0);
    jsonTa.disabled = dis;
    jsonTa.onblur = () => {
      try {
        const parsed = JSON.parse(jsonTa.value) as Record<string, unknown>;
        s.mapping = parsed;
        cb({
          stepRef: s.stepRef,
          inputFields: s.inputFields.slice(),
          inputTypes: Object.assign({}, s.inputTypes),
          outputFields: s.outputFields.slice(),
          outputTypes: Object.assign({}, s.outputTypes),
          connections: JSON.parse(JSON.stringify(s.connections)),
          transforms: JSON.parse(JSON.stringify(s.transforms)),
          excludeEmptyValues: s.excludeEmptyValues,
          mapping: s.mapping,
        });
        jsonTa.style.borderColor = '#d1d5db';
      } catch (_e) { jsonTa.style.borderColor = '#dc2626'; }
    };
    jsonSection.appendChild(jsonTa);

    const sanitizeRow = mk('label', 'display:flex;align-items:center;gap:6px;margin-top:6px;font-size:11px;color:#374151;cursor:pointer;');
    const sanitizeToggle = mk('input') as HTMLInputElement;
    sanitizeToggle.type = 'checkbox';
    sanitizeToggle.checked = s.excludeEmptyValues;
    sanitizeToggle.disabled = dis;
    sanitizeToggle.onchange = () => {
      s.excludeEmptyValues = sanitizeToggle.checked;
      persist();
    };
    sanitizeRow.appendChild(sanitizeToggle);
    sanitizeRow.appendChild(mkText('span', 'Exclude null, undefined, and empty string values'));
    jsonSection.appendChild(sanitizeRow);
    el!.appendChild(jsonSection);

    // Open Visual Mapper button
    const btnRow = mk('div', 'display:flex;gap:6px;align-items:center;');
    btnRow.appendChild(mkBtn(
      isPanelOpen ? '✓ Visual Mapper Open' : 'Open Visual Mapper',
      'background:' + (isPanelOpen ? '#059669' : '#7c3aed') + ';color:#fff;border:none;border-radius:6px;padding:8px 14px;cursor:pointer;font-size:12px;font-weight:600;flex:1;',
      () => {
        if (isPanelOpen) { closePanel(); renderMain(); }
        else { openPanel(); renderMain(); }
      },
    ));
    const connCount = Object.keys(s.connections).length;
    if (connCount > 0) {
      btnRow.appendChild(mkText('span', connCount + ' field' + (connCount > 1 ? 's' : '') + ' mapped', 'font-size:10px;color:#059669;font-weight:500;'));
    }
    el!.appendChild(btnRow);
  }

  renderMain();
  return () => { closePanel(); scrollListeners.forEach((fn) => fn()); };
}

type MappingValue = {
  stepRef: string;
  inputFields: string[];
  inputTypes: Record<string, string>;
  outputFields: string[];
  outputTypes: Record<string, string>;
  connections: Record<string, string[]>;
  transforms: Record<string, string[]>;
  excludeEmptyValues: boolean;
  mapping: Record<string, unknown>;
};

export const advancedMapping = createAction({
  name: 'advanced_mapping',
  displayName: 'Advanced Mapping',
  description: 'Visually map fields from incoming data to an output structure',
  errorHandlingOptions: {
    continueOnFailure: {
      hide: true,
    },
    retryOnFailure: {
      hide: true,
    },
  },
  props: {
    mapping: Property.Custom<true>({
      displayName: 'Mapping',
      description: 'Visual field mapper with type validation. Use the Data Selector in the sidebar for quick insertions, or open the Visual Mapper for drag-and-drop style mapping.',
      required: true,
      defaultValue: {
        stepRef: 'trigger',
        inputFields: [],
        inputTypes: {},
        outputFields: [],
        outputTypes: {},
        connections: {},
        transforms: {},
        excludeEmptyValues: false,
        mapping: {},
      } satisfies MappingValue,
      code: visualMapperCode,
    }),
  },
  async run(ctx) {
    const val = ctx.propsValue.mapping as MappingValue | null;
    if (!val?.mapping) return {};
    const mapping = val.mapping;
    if (Object.keys(mapping).length === 0) return {};
    const processed = processMapping(mapping);
    const result = val.excludeEmptyValues
      ? (sanitizeMappingValues(processed) as Record<string, unknown> ?? {})
      : processed;
    const hasAnyValue = JSON.stringify(result) !== JSON.stringify(emptyLeaves(result));
    if (!hasAnyValue) {
      return {
        ...result,
        _debug: {
          message: 'All mapped values resolved to empty. Ensure the source step has been tested and fields contain data.',
          rawMapping: mapping,
          stepRef: val.stepRef,
        },
      };
    }
    return result;
  },
});

function emptyLeaves(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = emptyLeaves(value as Record<string, unknown>);
    } else {
      result[key] = '';
    }
  }
  return result;
}

function processMapping(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      const record = value as Record<string, unknown>;
      if ('__value' in record && '__transforms' in record) {
        const resolved = record['__value'];
        const transforms = record['__transforms'] as string[];
        result[key] = applyTransformChain(resolved, transforms);
      } else {
        result[key] = processMapping(record);
      }
    } else {
      result[key] = value;
    }
  }
  return result;
}

function sanitizeMappingValues(value: unknown): unknown {
  if (value === null || value === undefined || value === '') {
    return undefined;
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => sanitizeMappingValues(item))
      .filter((item) => item !== undefined);
  }

  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .flatMap(([key, item]) => {
          const sanitized = sanitizeMappingValues(item);
          return sanitized !== undefined ? [[key, sanitized]] : [];
        })
    );
  }

  return value;
}

function applyTransformChain(value: unknown, transforms: string[]): unknown {
  let v = value;
  for (const tx of transforms) {
    switch (tx) {
      case 'trim':
        v = typeof v === 'string' ? v.trim() : v; break;
      case 'toUpperCase':
        v = typeof v === 'string' ? v.toUpperCase() : v; break;
      case 'toLowerCase':
        v = typeof v === 'string' ? v.toLowerCase() : v; break;
      case 'toNumber':
        v = typeof v === 'string' || typeof v === 'boolean' ? Number(v) : v; break;
      case 'toBoolean':
        v = v === 'true' || v === '1' || v === 1 || v === true; break;
      case 'toString':
        v = v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v); break;
      case 'parseJSON':
        if (typeof v === 'string') { try { v = JSON.parse(v); } catch { /* keep as-is */ } } break;
      case 'stringify':
        v = typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v ?? ''); break;
      case 'iterateMap':
        if (Array.isArray(v)) { v = v.map((item: unknown) => typeof item === 'object' && item !== null ? item : { value: item }); } break;
      default: break;
    }
  }
  return v;
}
