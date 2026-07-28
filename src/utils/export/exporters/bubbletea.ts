import type { ComponentNode } from '../../../types';
import { escGo } from '../escape';
import { SPINNER_PRESETS, renderBar } from '../../../constants/assets';

// Generates a runnable Bubble Tea program: the tree becomes lipgloss
// JoinVertical/JoinHorizontal compositions with per-node styles. Interactive
// widgets render as static previews; comments point at the matching
// charmbracelet/bubbles component for live behaviour.

interface Ctx {
  stmts: string[];
  usedVars: Set<string>;
  skipped: string[];
}

/** Features of the design a static Bubble Tea view cannot express. */
export function getBubbleTeaWarnings(root: ComponentNode): string[] {
  const warnings: string[] = [];
  const walk = (node: ComponentNode) => {
    if (node.hidden) return;
    if (node.type === 'Modal')
      warnings.push(`Modal "${node.name}" is skipped — a static Bubble Tea view has no overlays (use bubbletea's tea.Model state + lipgloss.Place to build one).`);
    if (node.props.width === 'fill' || node.props.height === 'fill')
      warnings.push(`"${node.name}" uses fill sizing, which lipgloss cannot express — it renders at content size.`);
    node.children.forEach(walk);
  };
  walk(root);
  return warnings;
}

export function exportToBubbleTea(root: ComponentNode): string {
  const ctx: Ctx = {
    stmts: [],
    usedVars: new Set(['m', 'model', 'main', 'msg', 'p', 'err']),
    skipped: [],
  };
  const rootExpr = genNode(root, ctx);

  const body = ctx.stmts.length ? `${ctx.stmts.join('\n')}\n\treturn ${rootExpr}` : `\treturn ${rootExpr}`;
  const skippedNote = ctx.skipped.length
    ? `// NOT exported (unsupported in a static view):\n${ctx.skipped.map((s) => `//   - ${s}`).join('\n')}\n\n`
    : '';

  return `${skippedNote}package main

import (
	"fmt"
	"os"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
)

type model struct{}

func (m model) Init() tea.Cmd {
	return nil
}

func (m model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.KeyMsg:
		if msg.String() == "ctrl+c" || msg.String() == "q" {
			return m, tea.Quit
		}
	}
	return m, nil
}

func (m model) View() string {
${body}
}

func main() {
	p := tea.NewProgram(model{}, tea.WithAltScreen())
	if _, err := p.Run(); err != nil {
		fmt.Println("Error:", err)
		os.Exit(1)
	}
}
`;
}

/** Returns a Go expression for the node; containers emit intermediate statements. */
function genNode(node: ComponentNode, ctx: Ctx): string {
  if (node.hidden) return '""';

  switch (node.type) {
    case 'Modal':
      ctx.skipped.push(`Modal "${node.name}" — no overlay support; build with tea.Model state + lipgloss.Place`);
      return '""';

    case 'Screen':
    case 'Box': {
      const isRow = node.layout.direction === 'row';
      const gap = Math.max(0, Number(node.layout.gap ?? 0));
      const childExprs: string[] = [];
      for (const child of node.children) {
        const expr = genNode(child, ctx);
        if (expr === '""' && child.type !== 'Spacer') continue; // skipped node (e.g. Modal)
        if (childExprs.length > 0 && gap > 0) {
          if (isRow) childExprs.push(escGoStr(' '.repeat(gap)));
          else for (let g = 0; g < gap; g++) childExprs.push('""'); // blank line per gap row
        }
        childExprs.push(expr);
      }
      return emitContainer(node, ctx, childExprs, isRow);
    }

    case 'Grid': {
      const cols = Math.max(1, Number(node.layout.columns ?? 2));
      const rowExprs: string[] = [];
      for (let i = 0; i < node.children.length; i += cols) {
        const cells = node.children.slice(i, i + cols).map((c) => genNode(c, ctx));
        rowExprs.push(
          cells.length > 1 ? `lipgloss.JoinHorizontal(lipgloss.Top, ${cells.join(', ')})` : cells[0]
        );
      }
      return emitContainer(node, ctx, rowExprs, false);
    }

    case 'Spacer':
      return '""';

    case 'Text':
      return styled(node, escGoStr((node.props.content as string) || 'Text'));

    case 'Button': {
      const label = ` ${(node.props.label as string) || 'Button'} `;
      const base = goStyle(node, ['Bold(true)', 'Reverse(true)']);
      return `${base}.Render(${escGoStr(label)})`;
    }

    case 'TextInput': {
      // consider charmbracelet/bubbles/textinput for a live input
      const value = ((node.props.value as string) || (node.props.placeholder as string) || '') + '_';
      return styled(node, escGoStr(value));
    }

    case 'Checkbox': {
      const checked = !!node.props.checked;
      const icon = checked
        ? (node.props.checkedIcon as string) || '✓'
        : (node.props.uncheckedIcon as string) || ' ';
      return styled(node, escGoStr(`[${icon}] ${(node.props.label as string) || 'Checkbox'}`));
    }

    case 'Radio': {
      const selected = !!node.props.checked;
      const icon = selected
        ? (node.props.selectedIcon as string) || '●'
        : (node.props.unselectedIcon as string) || '○';
      return styled(node, escGoStr(`(${icon}) ${(node.props.label as string) || 'Radio'}`));
    }

    case 'Toggle': {
      const on = !!(node.props.value ?? node.props.checked);
      return styled(node, escGoStr(`${on ? '[ON ]' : '[OFF]'} ${(node.props.label as string) || ''}`.trim()));
    }

    case 'Select': {
      const options = (node.props.options as string[]) || ['Option 1'];
      const idx = Math.max(0, Math.min(Number(node.props.selectedIndex ?? 0), options.length - 1));
      return styled(node, escGoStr(`${options[idx]} ▼`));
    }

    case 'Spinner': {
      // consider charmbracelet/bubbles/spinner for a live spinner
      const preset =
        SPINNER_PRESETS[(node.props.spinnerStyle as string) || 'dots'] || SPINNER_PRESETS.dots;
      const idx = Math.max(0, Math.min(Number(node.props.frame ?? 0), preset.frames.length - 1));
      const label = (node.props.label as string) ?? 'Loading...';
      return styled(node, escGoStr(label ? `${preset.frames[idx]} ${label}` : preset.frames[idx]));
    }

    case 'ProgressBar': {
      // consider charmbracelet/bubbles/progress for a live bar
      const value = Number(node.props.value ?? 0);
      const max = Number(node.props.max ?? 100) || 100;
      const width = typeof node.props.width === 'number' ? node.props.width : 20;
      const pct = Math.min(100, Math.max(0, (value / max) * 100));
      const showPercent = (node.props.showPercent as boolean) ?? true;
      const styleName = (node.props.barStyle as string) || 'blocks';
      const bar = renderBar(styleName, width - (showPercent ? 5 : 0), pct);
      return styled(node, escGoStr(showPercent ? `${bar} ${pct.toFixed(0)}%` : bar));
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
        const icon = d.icon ? `${d.icon} ` : '';
        const hotkey = d.hotkey ? `  ${d.hotkey}` : '';
        return `${marker}${icon}${d.label || 'Item'}${hotkey}`;
      });
      return styled(node, escGoStr(lines.join('\n')));
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
      return styled(node, escGoStr(lines.join('\n')));
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
      return styled(node, escGoStr(lines.join('\n')));
    }

    case 'Tabs': {
      const active = Number(node.props.activeTab ?? 0);
      const tabExprs = ((node.props.tabs as unknown[]) || []).map((tab, i) => {
        const t = tab as { label?: string };
        const label = ` ${typeof tab === 'string' ? tab : t.label || 'Tab'} `;
        return i === active
          ? `lipgloss.NewStyle().Bold(true).Underline(true).Render(${escGoStr(label)})`
          : escGoStr(label);
      });
      const joined =
        tabExprs.length > 1
          ? `lipgloss.JoinHorizontal(lipgloss.Top, ${tabExprs.join(', ')})`
          : tabExprs[0] || '""';
      return assignVar(node, ctx, joined);
    }

    case 'Breadcrumb': {
      const sep = (node.props.separator as string) || ' / ';
      const text = ((node.props.items as unknown[]) || [])
        .map((i) => (typeof i === 'string' ? i : (i as { label?: string }).label || ''))
        .join(sep);
      return styled(node, escGoStr(text));
    }

    default:
      return escGoStr(node.type);
  }
}

function emitContainer(node: ComponentNode, ctx: Ctx, childExprs: string[], isRow: boolean): string {
  let expr: string;
  if (childExprs.length === 0) expr = '""';
  else if (childExprs.length === 1) expr = childExprs[0];
  else
    expr = isRow
      ? `lipgloss.JoinHorizontal(lipgloss.Top, ${childExprs.join(', ')})`
      : `lipgloss.JoinVertical(lipgloss.Left, ${childExprs.join(', ')})`;

  const style = goStyle(node);
  if (style) expr = `${style}.Render(${expr})`;
  return assignVar(node, ctx, expr);
}

function assignVar(node: ComponentNode, ctx: Ctx, expr: string): string {
  if (expr === '""') return expr;
  const name = goIdent(node.name, ctx);
  ctx.stmts.push(`\t${name} := ${expr}`);
  return name;
}

/** Wrap a leaf expression in its style, if any. */
function styled(node: ComponentNode, expr: string): string {
  const style = goStyle(node);
  return style ? `${style}.Render(${expr})` : expr;
}

/** Build a lipgloss.NewStyle() chain from node style/layout; '' when default. */
function goStyle(node: ComponentNode, extra: string[] = []): string {
  const parts: string[] = [...extra];
  const s = node.style;

  if (s.color) pushColor(parts, 'Foreground', s.color);
  if (s.backgroundColor) pushColor(parts, 'Background', s.backgroundColor);
  if (s.bold && !extra.includes('Bold(true)')) parts.push('Bold(true)');
  if (s.italic) parts.push('Italic(true)');
  if (s.underline) parts.push('Underline(true)');
  if (s.strikethrough) parts.push('Strikethrough(true)');

  if (s.border) {
    const borderMap: Record<string, string> = {
      single: 'lipgloss.NormalBorder()',
      double: 'lipgloss.DoubleBorder()',
      rounded: 'lipgloss.RoundedBorder()',
      bold: 'lipgloss.ThickBorder()',
      hidden: 'lipgloss.HiddenBorder()',
    };
    parts.push(`Border(${borderMap[s.borderStyle || 'single'] || 'lipgloss.NormalBorder()'})`);
    if (s.borderColor) pushColor(parts, 'BorderForeground', s.borderColor);
  }

  const pad = node.layout.padding;
  if (typeof pad === 'number' && pad > 0) parts.push(`Padding(${pad})`);
  if (typeof node.props.width === 'number' && node.type !== 'ProgressBar')
    parts.push(`Width(${node.props.width})`);
  if (typeof node.props.height === 'number') parts.push(`Height(${node.props.height})`);

  return parts.length ? `lipgloss.NewStyle().${parts.join('.')}` : '';
}

function pushColor(parts: string[], method: string, value: string): void {
  const color = goColor(value);
  if (color) parts.push(`${method}(lipgloss.Color(${color}))`);
}

/** lipgloss.Color takes hex strings or ANSI palette index strings. */
function goColor(value: string): string | null {
  const named: Record<string, number> = {
    black: 0, red: 1, green: 2, yellow: 3, blue: 4, magenta: 5, cyan: 6, white: 7,
    brightblack: 8, gray: 8, grey: 8, darkgray: 8,
    brightred: 9, lightred: 9, brightgreen: 10, lightgreen: 10,
    brightyellow: 11, lightyellow: 11, brightblue: 12, lightblue: 12,
    brightmagenta: 13, lightmagenta: 13, brightcyan: 14, lightcyan: 14, brightwhite: 15,
  };
  let v = String(value).trim();
  if (/^#[0-9a-fA-F]{3}$/.test(v)) v = '#' + v[1] + v[1] + v[2] + v[2] + v[3] + v[3];
  if (/^#[0-9a-fA-F]{6}$/.test(v)) return `"${v}"`;
  const idx = named[v.toLowerCase().replace(/[^a-z]/g, '')];
  return idx != null ? `"${idx}"` : null;
}

function goIdent(name: string, ctx: Ctx): string {
  let base = name.replace(/[^a-zA-Z0-9]+/g, ' ').trim().split(' ')
    .map((w, i) => (i === 0 ? w.charAt(0).toLowerCase() + w.slice(1) : w.charAt(0).toUpperCase() + w.slice(1)))
    .join('');
  if (!base || /^[0-9]/.test(base)) base = `v${base}`;
  let ident = base;
  let n = 2;
  while (ctx.usedVars.has(ident)) ident = `${base}${n++}`;
  ctx.usedVars.add(ident);
  return ident;
}

function escGoStr(s: string): string {
  return `"${escGo(s)}"`;
}
