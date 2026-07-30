// Starter templates for the "New from Template" gallery — seeds the canvas
// with the 7 recurring TUI layout archetypes (docs/design_anal.md) instead of
// always starting from a blank Screen.

import type { ComponentNode, ComponentType, StyleProps } from '../types';
import { generateComponentId } from '../utils/idGenerator';

/** A leaf widget with no children, positioned by its parent's layout engine. */
function leaf(
  type: ComponentType,
  name: string,
  props: Record<string, unknown> = {},
  style: StyleProps = {}
): ComponentNode {
  return {
    id: generateComponentId(),
    type,
    name,
    props,
    layout: { type: 'none' },
    style,
    events: {},
    children: [],
    locked: false,
    hidden: false,
    collapsed: false,
  };
}

/** Places a node directly under the (absolute-layout) Screen root at x,y. */
function at<T extends ComponentNode>(node: T, x: number, y: number): T {
  node.layout = { ...node.layout, x, y };
  return node;
}

/** A nested flexbox Box (no absolute position — flows inside its parent). */
function row(name: string, children: ComponentNode[]): ComponentNode {
  return {
    id: generateComponentId(),
    type: 'Box',
    name,
    props: {},
    layout: { type: 'flexbox', direction: 'row', gap: 2 },
    style: {},
    events: {},
    children,
    locked: false,
    hidden: false,
    collapsed: false,
  };
}

/** A top-level absolute-positioned container: a Box that flows its own children with flexbox. */
function panel(
  name: string,
  x: number,
  y: number,
  width: number,
  height: number,
  children: ComponentNode[],
  direction: 'row' | 'column' = 'column',
  style: StyleProps = { border: true }
): ComponentNode {
  return {
    id: generateComponentId(),
    type: 'Box',
    name,
    props: { width, height },
    layout: { type: 'flexbox', direction, padding: 1, gap: 1, x, y },
    style,
    events: {},
    children,
    locked: false,
    hidden: false,
    collapsed: false,
  };
}

function screen(children: ComponentNode[]): ComponentNode {
  return {
    id: 'root',
    type: 'Screen',
    name: 'Main Screen',
    props: { width: 80, height: 24, theme: 'dracula' },
    layout: { type: 'absolute' },
    style: { border: false },
    events: {},
    children,
    locked: false,
    hidden: false,
    collapsed: false,
  };
}

export interface Template {
  id: string;
  name: string;
  description: string;
  build: () => ComponentNode;
}

export const TEMPLATES: Template[] = [
  {
    id: 'persistent-multi-panel',
    name: 'Persistent Multi-Panel',
    description: 'Sidebar list + main detail view + a persistent status bar (lazygit-style).',
    build: () =>
      screen([
        panel('Sidebar', 0, 0, 24, 21, [
          leaf('List', 'Branches', {
            items: [
              { label: 'main', icon: '•', hotkey: '1' },
              { label: 'feature/ui', icon: '•', hotkey: '2' },
              { label: 'fix/bug-123', icon: '•', hotkey: '3' },
            ],
            selectedIndex: 0,
          }),
        ]),
        panel('Main', 24, 0, 56, 21, [
          leaf(
            'Text',
            'DetailTitle',
            { content: 'main', wrap: false, align: 'left' },
            { bold: true }
          ),
          leaf('Log', 'Detail', {
            lines: ['+ added feature flag', '+ updated tests', '- removed dead code'],
            width: 52,
            height: 16,
          }),
        ]),
        at(
          leaf('StatusBar', 'Footer', {
            items: [
              { key: '^Q', label: 'Quit' },
              { key: 'Tab', label: 'Switch panel' },
              { key: '?', label: 'Help' },
            ],
            gap: 2,
            width: 'fill',
            height: 1,
          }),
          0,
          22
        ),
      ]),
  },
  {
    id: 'miller-columns',
    name: 'Miller Columns',
    description: 'Three side-by-side drill-down columns, each previewing the next (ranger-style).',
    build: () =>
      screen([
        panel('Directories', 0, 0, 26, 24, [
          leaf('Tree', 'DirTree', {
            items: [
              {
                label: 'src',
                icon: '📁',
                expanded: true,
                children: [
                  { label: 'components', icon: '📁', children: [] },
                  { label: 'utils', icon: '📁', children: [] },
                ],
              },
            ],
          }),
        ]),
        panel('Files', 26, 0, 26, 24, [
          leaf('List', 'FileList', {
            items: [
              { label: 'App.tsx', icon: '•', hotkey: '1' },
              { label: 'index.ts', icon: '•', hotkey: '2' },
            ],
            selectedIndex: 0,
          }),
        ]),
        panel('Preview', 52, 0, 28, 24, [
          leaf('Text', 'PreviewTitle', { content: 'App.tsx', wrap: false }, { bold: true }),
          leaf('Log', 'PreviewBody', {
            lines: ['import React from "react"', '', 'export default function App() {'],
            width: 24,
            height: 18,
          }),
        ]),
      ]),
  },
  {
    id: 'drill-down-stack',
    name: 'Drill-Down Stack',
    description: 'A single full-width list with a breadcrumb showing the current drill path.',
    build: () =>
      screen([
        at(
          leaf('Breadcrumb', 'Path', {
            items: [{ label: 'Home' }, { label: 'Projects' }, { label: 'tui-studio' }],
            separator: ' / ',
          }),
          0,
          0
        ),
        panel(
          'CurrentLevel',
          0,
          2,
          80,
          22,
          [
            leaf('List', 'Items', {
              items: [
                { label: 'README.md', icon: '•', hotkey: '1' },
                { label: 'package.json', icon: '•', hotkey: '2' },
                { label: 'src/', icon: '•', hotkey: '3' },
              ],
              selectedIndex: 0,
            }),
          ],
          'column'
        ),
      ]),
  },
  {
    id: 'widget-dashboard',
    name: 'Widget Dashboard',
    description: 'A 2x2 grid of independent monitoring widgets (btop-style).',
    build: () =>
      screen([
        panel('CpuPanel', 0, 0, 40, 12, [
          leaf('Gauge', 'CPU', {
            label: 'CPU',
            value: 42,
            max: 100,
            width: 34,
            barStyle: 'blocks',
            showPercent: true,
          }),
        ]),
        panel('MemPanel', 40, 0, 40, 12, [
          leaf('Gauge', 'Memory', {
            label: 'Memory',
            value: 67,
            max: 100,
            width: 34,
            barStyle: 'blocks',
            showPercent: true,
          }),
        ]),
        panel('NetPanel', 0, 12, 40, 12, [
          leaf('Text', 'NetTitle', { content: 'Network', wrap: false }, { bold: true }),
          leaf('Sparkline', 'NetTrend', {
            data: [1, 3, 2, 5, 4, 8, 6, 9, 7, 10, 8, 5],
            width: 34,
          }),
        ]),
        panel('ProcPanel', 40, 12, 40, 12, [
          leaf('Table', 'Processes', {
            columns: ['PID', 'CPU', 'MEM'],
            rows: [
              ['1204', '12%', '4%'],
              ['891', '3%', '1%'],
            ],
          }),
        ]),
      ]),
  },
  {
    id: 'ide-three-panel',
    name: 'IDE Three-Panel',
    description: 'File explorer + editor + outline, with a persistent status bar (VS Code-style).',
    build: () =>
      screen([
        panel('Explorer', 0, 0, 20, 23, [
          leaf('Tree', 'Files', {
            items: [
              {
                label: 'src',
                icon: '📁',
                expanded: true,
                children: [{ label: 'App.tsx', icon: '📄', children: [] }],
              },
            ],
          }),
        ]),
        panel('Editor', 20, 0, 40, 23, [
          leaf('TextArea', 'Notes', {
            placeholder: 'Enter text...',
            value: 'function App() {\n  return <div />;\n}',
            width: 36,
            height: 18,
          }),
        ]),
        panel('Outline', 60, 0, 20, 23, [
          leaf('List', 'Symbols', {
            items: [
              { label: 'App()', icon: 'ƒ', hotkey: '' },
              { label: 'useState', icon: 'ƒ', hotkey: '' },
            ],
            selectedIndex: 0,
          }),
        ]),
        at(
          leaf('StatusBar', 'Footer', {
            items: [
              { key: 'main', label: 'branch' },
              { key: 'Ln 1, Col 1', label: '' },
            ],
            gap: 2,
            width: 'fill',
            height: 1,
          }),
          0,
          23
        ),
      ]),
  },
  {
    id: 'overlay-popup',
    name: 'Overlay / Popup',
    description: 'A background view with a centered modal confirmation dialog on top.',
    build: () =>
      screen([
        panel('Background', 0, 0, 80, 24, [
          leaf(
            'Text',
            'BackgroundTitle',
            { content: 'Dashboard', wrap: false },
            { bold: true }
          ),
          leaf('Table', 'Stats', {
            columns: ['Metric', 'Value'],
            rows: [
              ['Uptime', '4d 12h'],
              ['Requests', '18,204'],
            ],
          }),
        ]),
        (() => {
          const modal: ComponentNode = {
            id: generateComponentId(),
            type: 'Modal',
            name: 'ConfirmModal',
            props: { title: 'Confirm', width: 40, height: 12 },
            layout: { type: 'flexbox', direction: 'column', padding: 2, gap: 1, x: 20, y: 6 },
            style: { border: true, borderStyle: 'double' },
            events: {},
            children: [
              leaf('Text', 'Question', { content: 'Delete this file?', wrap: true }),
              row('Actions', [
                leaf('Button', 'Confirm', { label: 'Delete', width: 10 }, { color: 'red' }),
                leaf('Button', 'Cancel', { label: 'Cancel', width: 10 }),
              ]),
            ],
            locked: false,
            hidden: false,
            collapsed: false,
          };
          return modal;
        })(),
      ]),
  },
  {
    id: 'header-scrollable-list',
    name: 'Header + Scrollable List',
    description: 'A title bar, a scrollable list body, and a summary status bar.',
    build: () =>
      screen([
        panel(
          'Header',
          0,
          0,
          80,
          3,
          [leaf('Text', 'Title', { content: 'Inbox', wrap: false }, { bold: true })],
          'row',
          {}
        ),
        panel('Body', 0, 3, 80, 20, [
          leaf('Table', 'Messages', {
            columns: ['From', 'Subject', 'Date'],
            rows: [
              ['alice@example.com', 'Weekly sync notes', 'Mon'],
              ['bob@example.com', 'Re: deploy window', 'Tue'],
              ['carol@example.com', 'Design review', 'Wed'],
            ],
          }),
        ]),
        at(
          leaf('StatusBar', 'Footer', {
            items: [{ key: '3', label: 'messages' }],
            gap: 2,
            width: 'fill',
            height: 1,
          }),
          0,
          23
        ),
      ]),
  },
];
