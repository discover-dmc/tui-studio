import type { ComponentNode } from '../../../types';
import { LayoutEngine } from '../../layout';
import { SPINNER_PRESETS, renderBar } from '../../../constants/assets';

// Generates a runnable blessed program. Blessed positions widgets absolutely,
// so we run the studio's own LayoutEngine and emit each node's computed
// top/left/width/height relative to its parent — the output matches the canvas.

const DEFAULT_WIDTH = 80;
const DEFAULT_HEIGHT = 25;

interface Ctx {
  engine: LayoutEngine;
  stmts: string[];
  usedVars: Set<string>;
}

export function exportToBlessed(root: ComponentNode): string {
  const width = typeof root.props.width === 'number' ? root.props.width : DEFAULT_WIDTH;
  const height = typeof root.props.height === 'number' ? root.props.height : DEFAULT_HEIGHT;
  const engine = new LayoutEngine();
  engine.calculateLayout(root, width, height);

  const ctx: Ctx = { engine, stmts: [], usedVars: new Set(['blessed', 'screen', 'process']) };
  for (const child of root.type === 'Screen' ? root.children : [root]) {
    genNode(child, ctx, 'screen', root.type === 'Screen' ? layoutOf(root, ctx) : null, false);
  }

  return `const blessed = require('blessed');

const screen = blessed.screen({
  smartCSR: true,
  title: ${js(root.name)},
});

${ctx.stmts.join('\n\n')}

screen.key(['escape', 'q', 'C-c'], () => process.exit(0));

screen.render();
`;
}

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

function layoutOf(node: ComponentNode, ctx: Ctx): Box {
  const l = ctx.engine.getLayout(node.id);
  return l ? { x: l.x, y: l.y, width: l.width, height: l.height } : { x: 0, y: 0, width: 10, height: 3 };
}

function genNode(
  node: ComponentNode,
  ctx: Ctx,
  parentVar: string,
  parentBox: Box | null,
  parentBordered: boolean
): void {
  if (node.hidden) return;
  const box = layoutOf(node, ctx);

  // blessed child coordinates are relative to the parent's inner area
  const inset = parentBordered ? 1 : 0;
  const top = parentBox ? box.y - parentBox.y - inset : box.y;
  const left = parentBox ? box.x - parentBox.x - inset : box.x;

  const varName = ident(node.name, ctx);
  const opts: string[] = [
    `parent: ${parentVar}`,
    `top: ${top}`,
    `left: ${left}`,
    `width: ${box.width}`,
    `height: ${box.height}`,
  ];

  const style: string[] = [];
  if (node.style.color) style.push(`fg: ${js(node.style.color)}`);
  if (node.style.backgroundColor) style.push(`bg: ${js(node.style.backgroundColor)}`);
  if (node.style.bold) style.push(`bold: true`);
  if (node.style.underline) style.push(`underline: true`);

  const bordered = !!node.style.border;
  if (bordered) {
    opts.push(`border: { type: 'line' }`);
    if (node.style.borderColor) style.push(`border: { fg: ${js(node.style.borderColor)} }`);
    if (node.name && node.name !== node.type) opts.push(`label: ${js(` ${node.name} `)}`);
  }

  let widget = 'box';
  let content: string | null = null;
  let extraOpts: string[] = [];

  switch (node.type) {
    case 'Box':
    case 'Grid':
    case 'Screen':
    case 'Modal':
      break;

    case 'Spacer':
      return;

    case 'Text':
      content = (node.props.content as string) || 'Text';
      break;

    case 'Button':
      widget = 'button';
      content = ` ${(node.props.label as string) || 'Button'} `;
      extraOpts = [`mouse: true`, `keys: true`];
      if (!style.length) style.push(`bold: true`, `inverse: true`);
      break;

    case 'TextInput':
      widget = 'textbox';
      extraOpts = [
        `mouse: true`,
        `keys: true`,
        `inputOnFocus: true`,
        `value: ${js((node.props.value as string) || '')}`,
      ];
      break;

    case 'Checkbox': {
      widget = 'checkbox';
      extraOpts = [
        `mouse: true`,
        `checked: ${!!node.props.checked}`,
        `text: ${js((node.props.label as string) || 'Checkbox')}`,
      ];
      break;
    }

    case 'Radio': {
      widget = 'radiobutton';
      extraOpts = [
        `mouse: true`,
        `checked: ${!!node.props.checked}`,
        `text: ${js((node.props.label as string) || 'Radio')}`,
      ];
      break;
    }

    case 'Toggle': {
      const on = !!(node.props.value ?? node.props.checked);
      content = `${on ? '[ON ]' : '[OFF]'} ${(node.props.label as string) || ''}`.trim();
      break;
    }

    case 'Select': {
      const options = (node.props.options as string[]) || ['Option 1'];
      const idx = Math.max(0, Math.min(Number(node.props.selectedIndex ?? 0), options.length - 1));
      content = `${options[idx]} ▼`;
      break;
    }

    case 'Spinner': {
      const preset =
        SPINNER_PRESETS[(node.props.spinnerStyle as string) || 'dots'] || SPINNER_PRESETS.dots;
      const idx = Math.max(0, Math.min(Number(node.props.frame ?? 0), preset.frames.length - 1));
      const label = (node.props.label as string) ?? 'Loading...';
      content = label ? `${preset.frames[idx]} ${label}` : preset.frames[idx];
      break;
    }

    case 'ProgressBar': {
      // static bar text; use blessed.progressbar for a live one
      const value = Number(node.props.value ?? 0);
      const max = Number(node.props.max ?? 100) || 100;
      const pct = Math.min(100, Math.max(0, (value / max) * 100));
      const showPercent = (node.props.showPercent as boolean) ?? true;
      const innerW = box.width - (bordered ? 2 : 0) - (showPercent ? 5 : 0);
      const bar = renderBar((node.props.barStyle as string) || 'blocks', innerW, pct);
      content = showPercent ? `${bar} ${pct.toFixed(0)}%` : bar;
      break;
    }

    case 'List':
    case 'Menu': {
      widget = 'list';
      const items = ((node.props.items as unknown[]) || []).map((item) => {
        const d =
          typeof item === 'string'
            ? { label: item, icon: node.type === 'List' ? '•' : '', hotkey: '' }
            : (item as { label?: string; icon?: string; hotkey?: string });
        const icon = d.icon ? `${d.icon} ` : '';
        const hotkey = d.hotkey ? `  ${d.hotkey}` : '';
        return `${icon}${d.label || 'Item'}${hotkey}`;
      });
      extraOpts = [
        `mouse: true`,
        `keys: true`,
        `items: [${items.map(js).join(', ')}]`,
        `selected: ${Number(node.props.selectedIndex ?? 0)}`,
      ];
      style.push(`selected: { inverse: true }`);
      break;
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
      content = lines.join('\n');
      break;
    }

    case 'Table': {
      widget = 'listtable';
      const columns = (node.props.columns as string[]) || ['Column 1', 'Column 2'];
      const rows = (node.props.rows as string[][]) || [];
      const data = [columns, ...rows.map((r) => columns.map((_, ci) => String(r[ci] ?? '')))];
      extraOpts = [
        `rows: [${data.map((r) => `[${r.map(js).join(', ')}]`).join(', ')}]`,
        `align: 'left'`,
      ];
      style.push(`header: { bold: true }`);
      break;
    }

    case 'Tabs': {
      const active = Number(node.props.activeTab ?? 0);
      const text = ((node.props.tabs as unknown[]) || [])
        .map((tab, i) => {
          const label = typeof tab === 'string' ? tab : (tab as { label?: string }).label || 'Tab';
          return i === active ? `{bold}[ ${label} ]{/bold}` : `  ${label}  `;
        })
        .join('');
      content = text;
      extraOpts = [`tags: true`];
      break;
    }

    case 'Breadcrumb': {
      const sep = (node.props.separator as string) || ' / ';
      content = ((node.props.items as unknown[]) || [])
        .map((i) => (typeof i === 'string' ? i : (i as { label?: string }).label || ''))
        .join(sep);
      break;
    }

    default:
      content = node.type;
  }

  if (content != null) opts.push(`content: ${js(content)}`);
  opts.push(...extraOpts);
  if (style.length) opts.push(`style: { ${style.join(', ')} }`);

  ctx.stmts.push(
    `const ${varName} = blessed.${widget}({\n${opts.map((o) => `  ${o}`).join(',\n')},\n});`
  );

  if (node.children.length && ['Box', 'Grid', 'Screen', 'Modal'].includes(node.type)) {
    for (const child of node.children) genNode(child, ctx, varName, box, bordered);
  }
}

function ident(name: string, ctx: Ctx): string {
  let base = name.replace(/[^a-zA-Z0-9]+/g, ' ').trim().split(' ')
    .map((w, i) => (i === 0 ? w.charAt(0).toLowerCase() + w.slice(1) : w.charAt(0).toUpperCase() + w.slice(1)))
    .join('');
  if (!base || /^[0-9]/.test(base)) base = `w${base}`;
  let id = base;
  let n = 2;
  while (ctx.usedVars.has(id)) id = `${base}${n++}`;
  ctx.usedVars.add(id);
  return id;
}

function js(s: string): string {
  return JSON.stringify(String(s));
}
