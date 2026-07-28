import type { ComponentNode, ComponentType, LayoutProps, StyleProps } from '../../../types';

let counter = 0;
function nextId(): string {
  counter += 1;
  return `n${counter}`;
}

export function node(
  type: ComponentType,
  name: string,
  props: Record<string, unknown> = {},
  children: ComponentNode[] = [],
  style: StyleProps = {},
  layout: Partial<LayoutProps> = {}
): ComponentNode {
  return {
    id: nextId(),
    type,
    name,
    props,
    layout: { type: 'flexbox', direction: 'column', gap: 0, padding: 0, ...layout },
    style,
    events: {},
    children,
    locked: false,
    hidden: false,
    collapsed: false,
  };
}

/** A single Text leaf — exercises minimal-import gating (Ratatui) and empty-Box handling. */
export function textOnlyTree(): ComponentNode {
  return node('Screen', 'Screen', {}, [node('Text', 'Title', { content: 'Hello' })]);
}

/** Screen with no children — every exporter must handle the empty-tree case without crashing. */
export function emptyScreenTree(): ComponentNode {
  return node('Screen', 'Screen', {}, []);
}

/**
 * One tree touching every component type, nested containers, a Grid, a Modal,
 * duplicate names (collision-safe var/id generation), quotes and angle
 * brackets in text (escaping), hex + named colors, gap/padding, and fill
 * sizing (drives the BubbleTea "fill unsupported" warning).
 */
export function kitchenSinkTree(): ComponentNode {
  return node('Screen', 'Screen', {}, [
    node(
      'Box',
      'Header',
      {},
      [
        node('Text', 'Title', { content: 'Say "hi" to <all>' }, [], {
          bold: true,
          color: '#7dcfff',
        }),
        node('Tabs', 'Nav', {
          tabs: [{ label: 'Dashboard' }, { label: 'Agent' }],
          activeTab: 1,
        }),
      ],
      { border: true, borderStyle: 'rounded', borderColor: '#414868' },
      { direction: 'row', gap: 2, padding: 1 }
    ),
    node(
      'Box',
      'Body',
      { width: 'fill' },
      [
        node(
          'List',
          'Files',
          {
            items: [
              { label: 'main.rs', icon: '•', hotkey: '1' },
              { label: 'lib.rs', icon: '•', hotkey: '2' },
            ],
            selectedIndex: 0,
          },
          [],
          { border: true, borderColor: 'red' }
        ),
        node('Tree', 'Explorer', {
          items: [
            {
              label: 'Root',
              expanded: true,
              children: [
                { label: 'Child 1', children: [] },
                { label: 'Child 2', expanded: false, children: [{ label: 'Nested', children: [] }] },
              ],
            },
          ],
        }),
        node('Table', 'Stats', {
          columns: ['PID', 'CPU'],
          rows: [
            ['123', '45%'],
            ['456', '2%'],
          ],
        }),
        node('Menu', 'Nav2', {
          items: [{ label: 'Home', icon: '⌂', hotkey: '^H' }],
        }),
      ],
      {},
      { direction: 'row' }
    ),
    node(
      'Grid',
      'Controls',
      {},
      [
        node('Button', 'OK', { label: 'OK' }),
        // duplicate name on purpose — regression test for collision handling
        node('Button', 'OK', { label: 'Cancel' }, [], { color: 'red' }),
        node('TextInput', 'Search', { placeholder: 'type "here"...' }),
        node('Checkbox', 'Opt', { label: 'Enable', checked: true }),
        node('Radio', 'R1', { label: 'Choice A', checked: true }),
        node('Toggle', 'Dark', { label: 'Dark mode', value: true }),
        node('Select', 'Sel', { options: ['One', 'Two'], selectedIndex: 1 }),
        node('Spinner', 'Load', { spinnerStyle: 'bouncingBar', frame: 4, label: 'Working' }),
        node('ProgressBar', 'Prog', { value: 67, max: 100, width: 24, barStyle: 'equals' }),
        node('Breadcrumb', 'Crumb', {
          items: [{ label: 'Home' }, { label: 'Docs' }],
          separator: ' / ',
        }),
        node('Spacer', 'Sp'),
      ],
      {},
      { columns: 2 }
    ),
    node('Box', 'Empty', {}, [], { border: true }),
    node(
      'Modal',
      'Confirm',
      {},
      [node('Text', 'Msg', { content: 'Sure?' })],
      { border: true, borderStyle: 'double', borderColor: 'red' }
    ),
  ]);
}
