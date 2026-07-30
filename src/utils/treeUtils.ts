// Utilities for working with component trees

import type { ComponentNode } from '../types';
import { generateComponentId } from './idGenerator';

/**
 * Find a component node by ID in a tree
 */
export function findNodeById(root: ComponentNode | null, id: string): ComponentNode | null {
  if (!root) return null;
  if (root.id === id) return root;

  for (const child of root.children) {
    const found = findNodeById(child, id);
    if (found) return found;
  }

  return null;
}

/**
 * Find the parent of a node
 */
export function findParentNode(root: ComponentNode | null, targetId: string): ComponentNode | null {
  if (!root) return null;

  for (const child of root.children) {
    if (child.id === targetId) return root;
    const found = findParentNode(child, targetId);
    if (found) return found;
  }

  return null;
}

/**
 * Get all ancestors of a node (from root to parent)
 */
export function getAncestors(root: ComponentNode | null, targetId: string): ComponentNode[] {
  const ancestors: ComponentNode[] = [];

  function traverse(node: ComponentNode | null, path: ComponentNode[]): boolean {
    if (!node) return false;
    if (node.id === targetId) {
      ancestors.push(...path);
      return true;
    }

    for (const child of node.children) {
      if (traverse(child, [...path, node])) {
        return true;
      }
    }

    return false;
  }

  traverse(root, []);
  return ancestors;
}

/**
 * Get all descendants of a node
 */
export function getDescendants(node: ComponentNode): ComponentNode[] {
  const descendants: ComponentNode[] = [];

  function traverse(n: ComponentNode) {
    descendants.push(n);
    n.children.forEach(traverse);
  }

  node.children.forEach(traverse);
  return descendants;
}

/**
 * Clone a component node deeply
 */
export function cloneNode(node: ComponentNode): ComponentNode {
  return {
    ...node,
    props: { ...node.props },
    layout: { ...node.layout },
    style: { ...node.style },
    events: { ...node.events },
    children: node.children.map(cloneNode),
  };
}

/**
 * Flatten a tree into a Map for quick lookup
 */
export function flattenTree(root: ComponentNode | null): Map<string, ComponentNode> {
  const map = new Map<string, ComponentNode>();

  function traverse(node: ComponentNode) {
    map.set(node.id, node);
    node.children.forEach(traverse);
  }

  if (root) {
    traverse(root);
  }

  return map;
}

/**
 * Count total nodes in a tree
 */
export function countNodes(root: ComponentNode | null): number {
  if (!root) return 0;
  return 1 + root.children.reduce((sum, child) => sum + countNodes(child), 0);
}

/**
 * Get the depth of a tree
 */
export function getTreeDepth(root: ComponentNode | null): number {
  if (!root || root.children.length === 0) return 0;
  return 1 + Math.max(...root.children.map(getTreeDepth));
}

// Pure tree-mutation functions — the actual logic behind componentStore's
// addComponent/removeComponent/updateProps/updateLayout/moveComponent
// actions, factored out so the MCP agent bridge's dry-run tool (AI
// integration Phase 4) can compute a would-be tree without committing it
// through the store. componentStore's actions call these, then set() +
// saveHistory(); never duplicate this logic elsewhere.

/** Mirrors componentStore's addComponent. Returns null if parentId doesn't resolve. */
export function applyAddComponent(
  root: ComponentNode | null,
  parentId: string,
  componentData: Omit<ComponentNode, 'id'>,
  index?: number
): { root: ComponentNode; id: string } | null {
  if (!root) return null;
  const newRoot = cloneNode(root);
  const parent = findNodeById(newRoot, parentId);
  if (!parent) return null;

  const id = generateComponentId();
  const newComponent: ComponentNode = { ...componentData, id, children: [] };

  if (['Box', 'Grid'].includes(parent.type)) {
    if (typeof parent.props.height === 'number') parent.props.height = 'auto';
    if (typeof parent.props.width === 'number' && parent.layout.direction !== 'column') {
      parent.props.width = 'auto';
    }
  }

  if (index !== undefined) parent.children.splice(index, 0, newComponent);
  else parent.children.push(newComponent);

  return { root: newRoot, id };
}

/** Mirrors componentStore's removeComponent. Returns null if id is the root or doesn't resolve. */
export function applyRemoveComponent(root: ComponentNode | null, id: string): ComponentNode | null {
  if (!root || root.id === id) return null;
  const newRoot = cloneNode(root);
  const parent = findParentNode(newRoot, id);
  if (!parent) return null;
  parent.children = parent.children.filter((child) => child.id !== id);
  return newRoot;
}

/** Mirrors componentStore's updateProps. Returns null if id doesn't resolve. */
export function applyUpdateProps(
  root: ComponentNode | null,
  id: string,
  props: Partial<ComponentNode['props']>
): ComponentNode | null {
  if (!root) return null;
  const newRoot = cloneNode(root);
  const component = findNodeById(newRoot, id);
  if (!component) return null;
  component.props = { ...component.props, ...props };
  return newRoot;
}

/** Mirrors componentStore's updateLayout. Returns null if id doesn't resolve. */
export function applyUpdateLayout(
  root: ComponentNode | null,
  id: string,
  layout: Partial<ComponentNode['layout']>
): ComponentNode | null {
  if (!root) return null;
  const newRoot = cloneNode(root);
  const component = findNodeById(newRoot, id);
  if (!component) return null;
  component.layout = { ...component.layout, ...layout };
  return newRoot;
}

/** Mirrors componentStore's moveComponent. Returns null if id/newParentId don't resolve, or id === newParentId. */
export function applyMoveComponent(
  root: ComponentNode | null,
  id: string,
  newParentId: string,
  index?: number
): ComponentNode | null {
  if (!root || id === newParentId) return null;
  const newRoot = cloneNode(root);

  const oldParent = findParentNode(newRoot, id);
  if (!oldParent) return null;
  const componentIndex = oldParent.children.findIndex((c) => c.id === id);
  if (componentIndex === -1) return null;

  const [component] = oldParent.children.splice(componentIndex, 1);
  const newParent = findNodeById(newRoot, newParentId);
  if (!newParent) return null;

  if (index !== undefined) newParent.children.splice(index, 0, component);
  else newParent.children.push(component);

  return newRoot;
}
