// Autosaves the design tree to localStorage so a refresh or crash doesn't
// lose work — a safety net alongside the explicit .tui save/open flow in
// fileOps.ts, whose data shape this reuses.

import { useComponentStore } from '../stores/componentStore';
import { useThemeStore } from '../stores/themeStore';
import { isValidComponentTree } from './validation';
import type { ComponentNode } from '../types';

const AUTOSAVE_KEY = 'tuistudio-autosave';
const DEBOUNCE_MS = 1000;

let saveTimer: ReturnType<typeof setTimeout> | null = null;

/** Subscribes to the component tree and debounce-writes it to localStorage. Call once on app start. */
export function initAutosave(): () => void {
  return useComponentStore.subscribe((state) => {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      if (!state.root) return;
      const data = {
        version: '1',
        meta: { theme: useThemeStore.getState().currentTheme, savedAt: new Date().toISOString() },
        tree: state.root,
      };
      try {
        localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(data));
      } catch {
        // Storage full or unavailable — autosave is a safety net, not critical path.
      }
    }, DEBOUNCE_MS);
  });
}

/** Reads back the last autosave, if any, validating it the same way an opened .tui file is validated. */
export function loadAutosave(): { tree: ComponentNode; theme?: any } | null {
  try {
    const raw = localStorage.getItem(AUTOSAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data.version !== '1' || !isValidComponentTree(data.tree)) return null;
    return { tree: data.tree, theme: data.meta?.theme };
  } catch {
    return null;
  }
}
