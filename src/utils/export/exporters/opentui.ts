import type { ComponentNode } from '../../../types';
import { escJsx } from '../escape';
import { SPINNER_PRESETS, renderBar } from '../../../constants/assets';

// Generates an @opentui/react app using its real intrinsic elements
// (<box>, <text>, <input>, <select>, <tab-select>) and Yoga flexbox styles.

export function getOpenTuiWarnings(root: ComponentNode): string[] {
  const warnings: string[] = [];
  const walk = (node: ComponentNode) => {
    if (node.hidden) return;
    if (node.type === 'Modal')
      warnings.push(`Modal "${node.name}" renders in normal flow — overlay positioning needs app state (conditionally render it on top).`);
    node.children.forEach(walk);
  };
  walk(root);
  return warnings;
}

export function exportToOpenTUI(root: ComponentNode): string {
  const body = genNode(root, 1);

  return `import { createCliRenderer } from "@opentui/core";
import { createRoot } from "@opentui/react";

function App() {
  return (
${body}  );
}

const renderer = await createCliRenderer();
createRoot(renderer).render(<App />);
`;
}

function genNode(node: ComponentNode, indent: number): string {
  if (node.hidden) return '';
  const sp = '  '.repeat(indent + 1);

  switch (node.type) {
    case 'Screen':
    case 'Box':
    case 'Modal': {
      const attrs = boxAttrs(node);
      const children = node.children.map((c) => genNode(c, indent + 1)).join('');
      const comment = node.type === 'Modal' ? '{/* Modal: render conditionally on top */}\n' + sp : '';
      return children
        ? `${sp}${comment}<box${attrs}>\n${children}${sp}</box>\n`
        : `${sp}${comment}<box${attrs} />\n`;
    }

    case 'Grid': {
      const cols = Math.max(1, Number(node.layout.columns ?? 2));
      const rows: string[] = [];
      for (let i = 0; i < node.children.length; i += cols) {
        const cells = node.children
          .slice(i, i + cols)
          .map((c) => genNode(c, indent + 2))
          .join('');
        rows.push(`${sp}  <box style={{ flexDirection: "row" }}>\n${cells}${sp}  </box>\n`);
      }
      return `${sp}<box${boxAttrs(node)}>\n${rows.join('')}${sp}</box>\n`;
    }

    case 'Spacer':
      return `${sp}<box style={{ flexGrow: 1 }} />\n`;

    case 'Text':
      return `${sp}${textEl(node, (node.props.content as string) || 'Text')}\n`;

    case 'Button': {
      const label = (node.props.label as string) || 'Button';
      return `${sp}<box border borderStyle="${node.style.borderStyle === 'double' ? 'double' : 'single'}">\n${sp}  ${textEl(node, ` ${label} `, true)}\n${sp}</box>\n`;
    }

    case 'TextInput': {
      const placeholder = (node.props.placeholder as string) || '';
      return `${sp}<input placeholder={${JSON.stringify(placeholder)}} onInput={() => {}} />\n`;
    }

    case 'Select': {
      const options = (node.props.options as string[]) || ['Option 1'];
      const opts = options
        .map((o) => `{ name: ${JSON.stringify(o)}, description: "", value: ${JSON.stringify(o.toLowerCase().replace(/\s+/g, '_'))} }`)
        .join(', ');
      return `${sp}<select options={[${opts}]} />\n`;
    }

    case 'Tabs': {
      const tabs = ((node.props.tabs as unknown[]) || []).map((tab) => {
        const label = typeof tab === 'string' ? tab : (tab as { label?: string }).label || 'Tab';
        return `{ name: ${JSON.stringify(label)}, description: "", value: ${JSON.stringify(label.toLowerCase().replace(/\s+/g, '_'))} }`;
      });
      return `${sp}<tab-select options={[${tabs.join(', ')}]} />\n`;
    }

    case 'Checkbox': {
      const checked = !!node.props.checked;
      const icon = checked
        ? (node.props.checkedIcon as string) || '✓'
        : (node.props.uncheckedIcon as string) || ' ';
      return `${sp}${textEl(node, `[${icon}] ${(node.props.label as string) || 'Checkbox'}`)}\n`;
    }

    case 'Radio': {
      const selected = !!node.props.checked;
      const icon = selected
        ? (node.props.selectedIcon as string) || '●'
        : (node.props.unselectedIcon as string) || '○';
      return `${sp}${textEl(node, `(${icon}) ${(node.props.label as string) || 'Radio'}`)}\n`;
    }

    case 'Toggle': {
      const on = !!(node.props.value ?? node.props.checked);
      return `${sp}${textEl(node, `${on ? '[ON ]' : '[OFF]'} ${(node.props.label as string) || ''}`.trim())}\n`;
    }

    case 'Spinner': {
      const preset =
        SPINNER_PRESETS[(node.props.spinnerStyle as string) || 'dots'] || SPINNER_PRESETS.dots;
      const idx = Math.max(0, Math.min(Number(node.props.frame ?? 0), preset.frames.length - 1));
      const label = (node.props.label as string) ?? 'Loading...';
      return `${sp}${textEl(node, label ? `${preset.frames[idx]} ${label}` : preset.frames[idx])}\n`;
    }

    case 'ProgressBar': {
      const value = Number(node.props.value ?? 0);
      const max = Number(node.props.max ?? 100) || 100;
      const width = typeof node.props.width === 'number' ? node.props.width : 20;
      const pct = Math.min(100, Math.max(0, (value / max) * 100));
      const showPercent = (node.props.showPercent as boolean) ?? true;
      const bar = renderBar((node.props.barStyle as string) || 'blocks', width - (showPercent ? 5 : 0), pct);
      return `${sp}${textEl(node, showPercent ? `${bar} ${pct.toFixed(0)}%` : bar)}\n`;
    }

    case 'List':
    case 'Menu': {
      const selectedIndex = Number(node.props.selectedIndex ?? -1);
      const lines = ((node.props.items as unknown[]) || []).map((item, i) => {
        const d =
          typeof item === 'string'
            ? { label: item, icon: node.type === 'List' ? '•' : '', hotkey: '' }
            : (item as { label?: string; icon?: string; hotkey?: string });
        const marker = i === selectedIndex ? '▶ ' : '  ';
        return `${marker}${d.icon ? `${d.icon} ` : ''}${d.label || 'Item'}${d.hotkey ? `  ${d.hotkey}` : ''}`;
      });
      return `${sp}<box${boxAttrs(node)}>\n${lines.map((l) => `${sp}  ${textEl(node, l, false, true)}`).join('\n')}\n${sp}</box>\n`;
    }

    case 'Tree': {
      const lines: string[] = [];
      const walk = (item: unknown, depth: number) => {
        const d =
          typeof item === 'string'
            ? { label: item, children: [] as unknown[] }
            : (item as { label?: string; children?: unknown[] });
        lines.push(`${'  '.repeat(depth)}${depth > 0 ? '├─ ' : ''}${d.label || 'Item'}`);
        (d.children || []).forEach((c) => walk(c, depth + 1));
      };
      ((node.props.items as unknown[]) || []).forEach((i) => walk(i, 0));
      return `${sp}<box${boxAttrs(node)}>\n${lines.map((l) => `${sp}  ${textEl(node, l, false, true)}`).join('\n')}\n${sp}</box>\n`;
    }

    case 'Table': {
      const columns = (node.props.columns as string[]) || ['Column 1', 'Column 2'];
      const rows = (node.props.rows as string[][]) || [];
      const colW = 14;
      const fit = (s: string) => s.slice(0, colW).padEnd(colW);
      const lines = [
        columns.map(fit).join(' │ '),
        columns.map(() => '─'.repeat(colW)).join('─┼─'),
        ...rows.map((row) => columns.map((_, ci) => fit(String(row[ci] ?? ''))).join(' │ ')),
      ];
      return `${sp}<box${boxAttrs(node)}>\n${lines.map((l) => `${sp}  ${textEl(node, l, false, true)}`).join('\n')}\n${sp}</box>\n`;
    }

    case 'Breadcrumb': {
      const sep = (node.props.separator as string) || ' / ';
      const text = ((node.props.items as unknown[]) || [])
        .map((i) => (typeof i === 'string' ? i : (i as { label?: string }).label || ''))
        .join(sep);
      return `${sp}${textEl(node, text)}\n`;
    }

    default:
      return `${sp}{/* ${node.type}: ${escJsx(node.name)} */}\n`;
  }
}

/** <text> element with fg/bg and strong/em/u wrappers from node style. */
function textEl(node: ComponentNode, content: string, forceBold = false, plain = false): string {
  let inner = escJsx(content);
  if (!plain) {
    if (node.style.bold || forceBold) inner = `<strong>${inner}</strong>`;
    if (node.style.italic) inner = `<em>${inner}</em>`;
    if (node.style.underline) inner = `<u>${inner}</u>`;
  }
  const attrs: string[] = [];
  if (node.style.color) attrs.push(`fg=${JSON.stringify(node.style.color)}`);
  if (node.style.backgroundColor && !plain)
    attrs.push(`style={{ bg: ${JSON.stringify(node.style.backgroundColor)} }}`);
  return `<text${attrs.length ? ' ' + attrs.join(' ') : ''}>${inner}</text>`;
}

function boxAttrs(node: ComponentNode): string {
  const attrs: string[] = [];
  const style: string[] = [];

  if (node.layout.direction === 'row') style.push(`flexDirection: "row"`);
  else if (node.children.length > 1) style.push(`flexDirection: "column"`);
  const gap = Number(node.layout.gap ?? 0);
  if (gap > 0) style.push(`gap: ${gap}`);
  const pad = node.layout.padding;
  if (typeof pad === 'number' && pad > 0) style.push(`padding: ${pad}`);

  if (typeof node.props.width === 'number') style.push(`width: ${node.props.width}`);
  else if (node.props.width === 'fill') style.push(`flexGrow: 1`);
  if (typeof node.props.height === 'number') style.push(`height: ${node.props.height}`);

  if (node.style.backgroundColor)
    style.push(`backgroundColor: ${JSON.stringify(node.style.backgroundColor)}`);

  if (node.style.border) {
    attrs.push('border');
    const bsMap: Record<string, string> = {
      single: 'single',
      double: 'double',
      rounded: 'rounded',
      bold: 'heavy',
    };
    const bs = bsMap[(node.style.borderStyle as string) || 'single'];
    if (bs && bs !== 'single') attrs.push(`borderStyle="${bs}"`);
    if (node.name && node.name !== node.type)
      attrs.push(`title={${JSON.stringify(` ${node.name} `)}}`);
    if (node.style.borderColor) style.push(`borderColor: ${JSON.stringify(node.style.borderColor)}`);
  }

  if (style.length) attrs.push(`style={{ ${style.join(', ')} }}`);
  return attrs.length ? ' ' + attrs.join(' ') : '';
}
