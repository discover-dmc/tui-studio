import type { ComponentNode } from '../../../types';
import { escPy } from '../escape';

// Generates a runnable Textual app: containers preserve the tree, widgets map to
// real Textual classes, styles become TCSS in App.CSS, and data widgets
// (DataTable/Tree/ProgressBar) are populated in on_mount.

interface Ctx {
  widgets: Set<string>;
  containers: Set<string>;
  ids: Map<string, string>; // node.id -> css id
  usedIds: Set<string>;
  css: string[];
  mount: string[];
  needsSpacerCss: boolean;
}

export function exportToTextual(root: ComponentNode): string {
  const ctx: Ctx = {
    widgets: new Set(),
    containers: new Set(),
    ids: new Map(),
    usedIds: new Set(),
    css: [],
    mount: [],
    needsSpacerCss: false,
  };

  const topNodes = root.type === 'Screen' ? root.children : [root];
  if (root.type === 'Screen') {
    const rules = tcssRules(root, true);
    if (rules.length) ctx.css.push(`    Screen {\n${rules.map((r) => `        ${r}`).join('\n')}\n    }`);
  }

  let body = '';
  for (const child of topNodes) body += genNode(child, ctx, 8);
  if (!body) body = `${' '.repeat(8)}yield Static("")\n`;

  if (ctx.needsSpacerCss) ctx.css.push('    .spacer {\n        width: 1fr;\n        height: 1fr;\n    }');
  ctx.widgets.add('Static');

  const importLines = [
    'from textual.app import App, ComposeResult',
    ctx.containers.size
      ? `from textual.containers import ${[...ctx.containers].sort().join(', ')}`
      : '',
    `from textual.widgets import ${[...ctx.widgets].sort().join(', ')}`,
  ].filter(Boolean);

  const cssBlock = ctx.css.length ? `    CSS = """\n${ctx.css.join('\n\n')}\n    """\n\n` : '';

  const mountBlock = ctx.mount.length
    ? `\n    def on_mount(self) -> None:\n${ctx.mount.map((l) => `        ${l}`).join('\n')}\n`
    : '';

  const buttonHandler = ctx.widgets.has('Button')
    ? `\n    def on_button_pressed(self, event: Button.Pressed) -> None:\n        pass\n`
    : '';

  return `${importLines.join('\n')}


class MyApp(App):
${cssBlock}    def compose(self) -> ComposeResult:
${body}${mountBlock}${buttonHandler}

if __name__ == "__main__":
    MyApp().run()
`;
}

function genNode(node: ComponentNode, ctx: Ctx, indent: number): string {
  if (node.hidden) return '';
  const sp = ' '.repeat(indent);

  switch (node.type) {
    case 'Screen':
    case 'Box':
    case 'Grid':
    case 'Modal': {
      const cls =
        node.type === 'Grid' ? 'Grid' : node.layout.direction === 'row' ? 'Horizontal' : 'Vertical';
      ctx.containers.add(cls);
      const extraCss: string[] = [];
      if (node.type === 'Grid') {
        const cols = Math.max(1, Number(node.layout.columns ?? 2));
        const rows = Math.max(1, Number(node.layout.rows ?? Math.ceil(node.children.length / cols)));
        extraCss.push(`grid-size: ${cols} ${rows};`);
      }
      const id = registerStyles(node, ctx, extraCss);
      const comment = node.type === 'Modal' ? '  # Modal: consider textual.screen.ModalScreen' : '';
      const out = `${sp}with ${cls}(${idArg(id, true)}):${comment}\n`;
      const children = node.children.map((c) => genNode(c, ctx, indent + 4)).join('');
      return out + (children || `${sp}    pass\n`);
    }

    case 'Spacer':
      ctx.needsSpacerCss = true;
      return `${sp}yield Static("", classes="spacer")\n`;

    case 'Text': {
      const id = registerStyles(node, ctx);
      return `${sp}yield Static(${py(node.props.content, 'Text')}${idArg(id)})\n`;
    }

    case 'Button': {
      ctx.widgets.add('Button');
      const id = registerStyles(node, ctx);
      return `${sp}yield Button(${py(node.props.label, 'Button')}${idArg(id)})\n`;
    }

    case 'TextInput': {
      ctx.widgets.add('Input');
      const id = registerStyles(node, ctx);
      const value = node.props.value ? `, value=${py(node.props.value, '')}` : '';
      return `${sp}yield Input(placeholder=${py(node.props.placeholder, '')}${value}${idArg(id)})\n`;
    }

    case 'Checkbox': {
      ctx.widgets.add('Checkbox');
      const id = registerStyles(node, ctx);
      return `${sp}yield Checkbox(${py(node.props.label, 'Checkbox')}, value=${pyBool(node.props.checked)}${idArg(id)})\n`;
    }

    case 'Radio': {
      ctx.widgets.add('RadioButton');
      const id = registerStyles(node, ctx);
      return `${sp}yield RadioButton(${py(node.props.label, 'Radio')}, value=${pyBool(node.props.checked)}${idArg(id)})\n`;
    }

    case 'Toggle': {
      ctx.widgets.add('Switch');
      const id = registerStyles(node, ctx);
      const label = (node.props.label as string) || '';
      if (!label) return `${sp}yield Switch(value=${pyBool(node.props.value ?? node.props.checked)}${idArg(id)})\n`;
      ctx.containers.add('Horizontal');
      return (
        `${sp}with Horizontal():\n` +
        `${sp}    yield Static(${py(label, '')})\n` +
        `${sp}    yield Switch(value=${pyBool(node.props.value ?? node.props.checked)}${idArg(id)})\n`
      );
    }

    case 'Select': {
      ctx.widgets.add('Select');
      const id = registerStyles(node, ctx);
      const options = (node.props.options as string[]) || ['Option 1'];
      const idx = Math.min(Math.max(0, Number(node.props.selectedIndex ?? 0)), options.length - 1);
      const pairs = options.map((o, i) => `(${py(o, '')}, ${i})`).join(', ');
      return `${sp}yield Select([${pairs}], allow_blank=False, value=${idx}${idArg(id)})\n`;
    }

    case 'Spinner': {
      ctx.widgets.add('LoadingIndicator');
      const id = registerStyles(node, ctx);
      return `${sp}yield LoadingIndicator(${idArg(id, true)})\n`;
    }

    case 'ProgressBar': {
      ctx.widgets.add('ProgressBar');
      const id = registerStyles(node, ctx, [], true)!;
      const value = Number(node.props.value ?? 0);
      const max = Number(node.props.max ?? 100) || 100;
      ctx.mount.push(
        `self.query_one("#${id}", ProgressBar).update(total=${max}, progress=${value})`
      );
      return `${sp}yield ProgressBar(total=${max}, show_eta=False${idArg(id)})\n`;
    }

    case 'List': {
      ctx.widgets.add('ListView');
      ctx.widgets.add('ListItem');
      ctx.widgets.add('Label');
      const id = registerStyles(node, ctx);
      const items = itemLabels(node.props.items).map(
        (t) => `ListItem(Label(${escPyStr(t)}))`
      );
      const initial =
        node.props.selectedIndex != null ? `, initial_index=${Number(node.props.selectedIndex)}` : '';
      return `${sp}yield ListView(${items.join(', ')}${initial}${idArg(id)})\n`;
    }

    case 'Menu': {
      ctx.widgets.add('OptionList');
      const id = registerStyles(node, ctx);
      const items = itemLabels(node.props.items).map((t) => escPyStr(t));
      return `${sp}yield OptionList(${items.join(', ')}${idArg(id)})\n`;
    }

    case 'Table': {
      ctx.widgets.add('DataTable');
      const id = registerStyles(node, ctx, [], true)!;
      const cols = ((node.props.columns as string[]) || []).map((c) => escPyStr(c)).join(', ');
      const rows = ((node.props.rows as string[][]) || [])
        .map((r) => `(${r.map((c) => escPyStr(String(c))).join(', ')}${r.length === 1 ? ',' : ''})`)
        .join(', ');
      ctx.mount.push(`table_${sanitize(id)} = self.query_one("#${id}", DataTable)`);
      ctx.mount.push(`table_${sanitize(id)}.add_columns(${cols})`);
      if (rows) ctx.mount.push(`table_${sanitize(id)}.add_rows([${rows}])`);
      return `${sp}yield DataTable(${idArg(id, true)})\n`;
    }

    case 'Tree': {
      ctx.widgets.add('Tree');
      const id = registerStyles(node, ctx, [], true)!;
      const varName = `tree_${sanitize(id)}`;
      ctx.mount.push(`${varName} = self.query_one("#${id}", Tree)`);
      ctx.mount.push(`${varName}.root.expand()`);
      emitTreeItems(node.props.items, `${varName}.root`, ctx, 0, sanitize(id));
      return `${sp}yield Tree(${py(node.name, 'Tree')}${idArg(id)})\n`;
    }

    case 'Tabs': {
      ctx.widgets.add('Tabs');
      const id = registerStyles(node, ctx);
      const labels = ((node.props.tabs as unknown[]) || []).map((tab) => {
        const t = tab as { label?: string };
        return escPyStr(typeof tab === 'string' ? tab : t.label || 'Tab');
      });
      return `${sp}yield Tabs(${labels.join(', ')}${idArg(id)})\n`;
    }

    case 'Breadcrumb': {
      const id = registerStyles(node, ctx);
      const sep = (node.props.separator as string) || ' / ';
      const text = itemLabels(node.props.items).join(sep);
      return `${sp}yield Static(${escPyStr(text)}${idArg(id)})\n`;
    }

    default:
      return `${sp}yield Static(${escPyStr(node.type)})\n`;
  }
}

// ── TCSS ──────────────────────────────────────────────────────────────────────

/** Register CSS rules for a node; returns its css id if one is needed. */
function registerStyles(
  node: ComponentNode,
  ctx: Ctx,
  extraRules: string[] = [],
  forceId = false
): string | null {
  const rules = [...extraRules, ...tcssRules(node, false)];
  if (!rules.length && !forceId) return null;
  const id = allocId(node, ctx);
  if (rules.length)
    ctx.css.push(`    #${id} {\n${rules.map((r) => `        ${r}`).join('\n')}\n    }`);
  return id;
}

function tcssRules(node: ComponentNode, isScreen: boolean): string[] {
  const rules: string[] = [];
  const s = node.style;
  if (s.color) rules.push(`color: ${s.color};`);
  if (s.backgroundColor) rules.push(`background: ${s.backgroundColor};`);

  const textStyles = [
    s.bold && 'bold',
    s.italic && 'italic',
    s.underline && 'underline',
    s.strikethrough && 'strike',
  ].filter(Boolean);
  if (textStyles.length) rules.push(`text-style: ${textStyles.join(' ')};`);

  if (s.border) {
    const borderMap: Record<string, string> = {
      single: 'solid',
      double: 'double',
      rounded: 'round',
      bold: 'heavy',
      hidden: 'none',
    };
    const kind = borderMap[s.borderStyle || 'single'] || 'solid';
    rules.push(kind === 'none' ? 'border: none;' : `border: ${kind} ${s.borderColor || 'white'};`);
  }

  if (!isScreen) {
    if (typeof node.props.width === 'number') rules.push(`width: ${node.props.width};`);
    else if (node.props.width === 'fill') rules.push('width: 1fr;');
    if (typeof node.props.height === 'number') rules.push(`height: ${node.props.height};`);
    else if (node.props.height === 'fill') rules.push('height: 1fr;');
  }

  const pad = node.layout.padding;
  if (typeof pad === 'number' && pad > 0) rules.push(`padding: ${pad};`);

  return rules;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function allocId(node: ComponentNode, ctx: Ctx): string {
  const existing = ctx.ids.get(node.id);
  if (existing) return existing;
  let base = node.name.toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
  if (!base || /^[0-9]/.test(base)) base = `w-${base || 'idget'}`;
  let id = base;
  let n = 2;
  while (ctx.usedIds.has(id)) id = `${base}-${n++}`;
  ctx.usedIds.add(id);
  ctx.ids.set(node.id, id);
  return id;
}

function sanitize(id: string): string {
  return id.replace(/[^a-zA-Z0-9_]/g, '_');
}

function idArg(id: string | null, first = false): string {
  if (!id) return '';
  return `${first ? '' : ', '}id="${id}"`;
}

function py(value: unknown, fallback: string): string {
  return escPyStr(String(value ?? '') || fallback);
}

function escPyStr(s: string): string {
  return `"${escPy(s)}"`;
}

function pyBool(value: unknown): string {
  return value ? 'True' : 'False';
}

function itemLabels(items: unknown): string[] {
  return ((items as unknown[]) || []).map((item) => {
    if (typeof item === 'string') return item;
    const d = item as { label?: string; icon?: string };
    return `${d.icon ? `${d.icon} ` : ''}${d.label || 'Item'}`;
  });
}

function emitTreeItems(
  items: unknown,
  parentExpr: string,
  ctx: Ctx,
  depth: number,
  scope: string
): void {
  ((items as unknown[]) || []).forEach((item, i) => {
    const d =
      typeof item === 'string'
        ? { label: item, children: [], expanded: false }
        : (item as { label?: string; expanded?: boolean; children?: unknown[] });
    const label = escPyStr(d.label || 'Item');
    if (d.children && d.children.length) {
      const varName = `node_${scope}_${depth}_${i}`;
      ctx.mount.push(`${varName} = ${parentExpr}.add(${label}, expand=${pyBool(d.expanded)})`);
      emitTreeItems(d.children, varName, ctx, depth + 1, scope);
    } else {
      ctx.mount.push(`${parentExpr}.add_leaf(${label})`);
    }
  });
}
