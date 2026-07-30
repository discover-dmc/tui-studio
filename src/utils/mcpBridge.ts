// Browser side of the AI-integration Phase 1 agent bridge (see
// mcp-server/index.mjs and todo.md). Opens a WebSocket to the local MCP
// server and executes its tool-call requests against componentStore —
// the same action API the human UI already uses, so every agent edit rides
// the existing undo/redo stack.

import { createPatch } from 'diff';
import { useComponentStore } from '../stores/componentStore';
import { useUIStore } from '../stores/uiStore';
import { useCanvasStore } from '../stores/canvasStore';
import { COMPONENT_LIBRARY } from '../constants/components';
import { TEMPLATES } from '../constants/templates';
import { isValidComponentTree } from './validation';
import { exportToText } from './export/textExporter';
import { layoutEngine } from './layout';
import {
  applyAddComponent,
  applyUpdateProps,
  applyUpdateLayout,
  applyMoveComponent,
  applyRemoveComponent,
  applyDuplicateComponent,
  applyGroupComponents,
  applyUngroupComponents,
} from './treeUtils';
import type { ComponentNode, ComponentType } from '../types';

const BRIDGE_URL = 'ws://127.0.0.1:5175';

interface BridgeRequest {
  id: string;
  action: string;
  payload: Record<string, unknown>;
}

let socket: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

function isComponentType(type: string): type is ComponentType {
  return type in COMPONENT_LIBRARY;
}

/** Unified diff (AI integration Phase 4) between the current tree and a would-be one — never committed. */
function diffTrees(oldRoot: ComponentNode | null, newRoot: ComponentNode | null): string {
  const oldJson = JSON.stringify(oldRoot, null, 2) + '\n';
  const newJson = JSON.stringify(newRoot, null, 2) + '\n';
  if (oldJson === newJson) return '(no changes)';
  return createPatch('component-tree.json', oldJson, newJson);
}

/** Runs one bridge request against componentStore, returning its result or throwing a plain-text error. */
function handleRequest({ action, payload }: BridgeRequest): unknown {
  const store = useComponentStore.getState();

  switch (action) {
    case 'get_tree':
      return store.root;

    case 'render_preview': {
      const { format } = payload as { format?: 'text' | 'ansi' };
      const canvas = useCanvasStore.getState();
      return exportToText(store.root, {
        format: format === 'ansi' ? 'ansi' : 'text',
        width: canvas.width,
        height: canvas.height,
      });
    }

    case 'list_component_types':
      return Object.values(COMPONENT_LIBRARY).map((def) => ({
        type: def.type,
        name: def.name,
        description: def.description,
        category: def.category,
      }));

    case 'get_component_schema': {
      const type = payload.type as string;
      if (!isComponentType(type)) throw new Error(`Unknown component type: ${type}`);
      const def = COMPONENT_LIBRARY[type];
      return {
        type: def.type,
        name: def.name,
        description: def.description,
        category: def.category,
        defaultProps: def.defaultProps,
        defaultLayout: def.defaultLayout,
        defaultStyle: def.defaultStyle,
        defaultEvents: def.defaultEvents ?? {},
      };
    }

    case 'get_layout_warnings': {
      const canvas = useCanvasStore.getState();
      layoutEngine.calculateLayout(store.root, canvas.width, canvas.height);
      return layoutEngine
        .getNodesWithWarnings()
        .map((nodeId) => layoutEngine.getDebugInfo(nodeId))
        .filter((info): info is NonNullable<typeof info> => !!info);
    }

    case 'list_templates':
      return TEMPLATES.map((t) => ({ id: t.id, name: t.name, description: t.description }));

    case 'apply_template': {
      const { id, dryRun } = payload as { id: string; dryRun?: boolean };
      const template = TEMPLATES.find((t) => t.id === id);
      if (!template) throw new Error(`Unknown template id: ${id}`);
      const built = template.build();
      if (dryRun) return diffTrees(store.root, built);
      store.setRoot(built);
      assertTreeStillValid();
      notifyAgentActivity(`Agent applied the "${template.name}" template`);
      return { ok: true };
    }

    case 'add_component': {
      const { parentId, type, props, layout, style, events, index, dryRun } = payload as {
        parentId: string;
        type: string;
        props?: Record<string, unknown>;
        layout?: Record<string, unknown>;
        style?: Record<string, unknown>;
        events?: Record<string, string>;
        index?: number;
        dryRun?: boolean;
      };
      if (!isComponentType(type)) throw new Error(`Unknown component type: ${type}`);
      if (!store.getComponent(parentId)) throw new Error(`No component with id: ${parentId}`);

      const def = COMPONENT_LIBRARY[type];
      const newComponent: Omit<ComponentNode, 'id'> = {
        type: def.type,
        name: def.name,
        props: { ...def.defaultProps, ...props },
        layout: { ...def.defaultLayout, ...layout },
        style: { ...def.defaultStyle, ...style },
        events: { ...def.defaultEvents, ...events },
        children: [],
        locked: false,
        hidden: false,
        collapsed: false,
      };

      if (dryRun) {
        const result = applyAddComponent(store.root, parentId, newComponent, index);
        return diffTrees(store.root, result?.root ?? store.root);
      }

      const id = store.addComponent(parentId, newComponent, index);
      assertTreeStillValid();
      notifyAgentActivity(`Agent added a ${type}`);
      return { id };
    }

    case 'update_props': {
      const { id, props, dryRun } = payload as {
        id: string;
        props: Record<string, unknown>;
        dryRun?: boolean;
      };
      const target = store.getComponent(id);
      if (!target) throw new Error(`No component with id: ${id}`);
      if (dryRun) return diffTrees(store.root, applyUpdateProps(store.root, id, props));
      store.updateProps(id, props);
      assertTreeStillValid();
      notifyAgentActivity(`Agent updated props on "${target.name}"`);
      return { ok: true };
    }

    case 'update_layout': {
      const { id, layout, dryRun } = payload as {
        id: string;
        layout: Record<string, unknown>;
        dryRun?: boolean;
      };
      const target = store.getComponent(id);
      if (!target) throw new Error(`No component with id: ${id}`);
      if (dryRun) return diffTrees(store.root, applyUpdateLayout(store.root, id, layout));
      store.updateLayout(id, layout);
      assertTreeStillValid();
      notifyAgentActivity(`Agent updated layout on "${target.name}"`);
      return { ok: true };
    }

    case 'move_component': {
      const { id, newParentId, index, dryRun } = payload as {
        id: string;
        newParentId: string;
        index?: number;
        dryRun?: boolean;
      };
      const target = store.getComponent(id);
      if (!target) throw new Error(`No component with id: ${id}`);
      if (!store.getComponent(newParentId)) throw new Error(`No component with id: ${newParentId}`);
      if (dryRun) return diffTrees(store.root, applyMoveComponent(store.root, id, newParentId, index));
      store.moveComponent(id, newParentId, index);
      assertTreeStillValid();
      notifyAgentActivity(`Agent moved "${target.name}"`);
      return { ok: true };
    }

    case 'remove_component': {
      const { id, dryRun } = payload as { id: string; dryRun?: boolean };
      if (!store.root || id === store.root.id) throw new Error('Cannot remove the root Screen.');
      const target = store.getComponent(id);
      if (!target) throw new Error(`No component with id: ${id}`);
      if (dryRun) return diffTrees(store.root, applyRemoveComponent(store.root, id));
      store.removeComponent(id);
      assertTreeStillValid();
      notifyAgentActivity(`Agent removed "${target.name}"`);
      return { ok: true };
    }

    case 'duplicate_component': {
      const { id, dryRun } = payload as { id: string; dryRun?: boolean };
      const target = store.getComponent(id);
      if (!target) throw new Error(`No component with id: ${id}`);
      if (dryRun) {
        const result = applyDuplicateComponent(store.root, id);
        return diffTrees(store.root, result?.root ?? store.root);
      }
      const newId = store.duplicateComponent(id);
      if (!newId) throw new Error('Duplicate failed.');
      assertTreeStillValid();
      notifyAgentActivity(`Agent duplicated "${target.name}"`);
      return { id: newId };
    }

    case 'group_components': {
      const { ids, name, props, layout, style, dryRun } = payload as {
        ids: string[];
        name?: string;
        props?: Record<string, unknown>;
        layout?: Record<string, unknown>;
        style?: Record<string, unknown>;
        dryRun?: boolean;
      };
      for (const cid of ids) {
        if (!store.getComponent(cid)) throw new Error(`No component with id: ${cid}`);
      }
      const def = COMPONENT_LIBRARY.Box;
      const boxData: Omit<ComponentNode, 'id' | 'children'> = {
        type: 'Box',
        name: name || def.name,
        props: { ...def.defaultProps, ...props },
        layout: { ...def.defaultLayout, ...layout },
        style: { ...def.defaultStyle, ...style },
        events: { ...def.defaultEvents },
        locked: false,
        hidden: false,
        collapsed: false,
      };
      if (dryRun) {
        const result = applyGroupComponents(store.root, ids, boxData);
        return diffTrees(store.root, result?.root ?? store.root);
      }
      const newId = store.groupComponents(ids, boxData);
      if (!newId) throw new Error('Group failed — every id must share the same parent.');
      assertTreeStillValid();
      notifyAgentActivity(`Agent grouped ${ids.length} component${ids.length === 1 ? '' : 's'}`);
      return { id: newId };
    }

    case 'ungroup_components': {
      const { ids, dryRun } = payload as { ids: string[]; dryRun?: boolean };
      for (const cid of ids) {
        if (!store.getComponent(cid)) throw new Error(`No component with id: ${cid}`);
      }
      if (dryRun) {
        const result = applyUngroupComponents(store.root, ids);
        return diffTrees(store.root, result?.root ?? store.root);
      }
      const childIds = store.ungroupComponents(ids);
      assertTreeStillValid();
      notifyAgentActivity(`Agent ungrouped ${ids.length} container${ids.length === 1 ? '' : 's'}`);
      return { childIds };
    }

    default:
      throw new Error(`Unknown bridge action: ${action}`);
  }
}

/**
 * AI integration Phase 5 — conflict surfacing. There's no live push feed or
 * locking, so a human editing at the same moment as an agent's turn can have
 * their change silently overwritten (last-write-wins). This doesn't prevent
 * that; it makes an agent-driven commit visible in the tab the instant it
 * happens, via the AgentActivityToast component.
 */
function notifyAgentActivity(message: string): void {
  useUIStore.getState().setAgentActivity(message);
}

/** Defensive backstop from todo.md's spec: undo and fail rather than leave an invalid tree committed. */
function assertTreeStillValid(): void {
  const { root, undo } = useComponentStore.getState();
  if (root && !isValidComponentTree(root)) {
    undo();
    throw new Error('Mutation produced an invalid component tree — rolled back.');
  }
}

function scheduleReconnect(): void {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    if (useUIStore.getState().agentBridgeEnabled) connectAgentBridge();
  }, 2000);
}

export function connectAgentBridge(): void {
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
    return;
  }
  useUIStore.getState().setAgentBridgeStatus('connecting');
  const ws = new WebSocket(BRIDGE_URL);
  socket = ws;

  ws.onopen = () => {
    useUIStore.getState().setAgentBridgeStatus('connected');
  };

  ws.onmessage = (event) => {
    let request: BridgeRequest;
    try {
      request = JSON.parse(event.data);
    } catch {
      return;
    }
    try {
      const result = handleRequest(request);
      ws.send(JSON.stringify({ id: request.id, ok: true, result }));
    } catch (err) {
      ws.send(JSON.stringify({ id: request.id, ok: false, error: (err as Error).message }));
    }
  };

  ws.onclose = () => {
    if (socket === ws) socket = null;
    useUIStore.getState().setAgentBridgeStatus('disconnected');
    if (useUIStore.getState().agentBridgeEnabled) scheduleReconnect();
  };

  ws.onerror = () => {
    // onclose fires right after — reconnect handling lives there.
  };
}

export function disconnectAgentBridge(): void {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  socket?.close();
  socket = null;
  useUIStore.getState().setAgentBridgeStatus('disconnected');
}

/** Call once on app start: reconnects automatically if the user last left the bridge enabled. */
export function initAgentBridge(): void {
  if (useUIStore.getState().agentBridgeEnabled) connectAgentBridge();
}
