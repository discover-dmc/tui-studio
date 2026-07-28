# TUI-Studio + tui-design Skill — Master TODO

Source of truth for enhancing/fixing both tools. Backed by the audit in
[docs/deep_anal_1.md](docs/deep_anal_1.md). Update this file as items land; one PR per item
unless grouped.

Repo setup: fork `discover-dmc/tui-studio` is `origin`; `jalonsogo/tui-studio` is
`upstream` (inactive ~2 months, 7 open PRs). Work on branches off `main`, PR into the fork.

---

## P0 — Correctness (broken today, user-visible)

- [ ] **Adopt upstream PR #19** (`fix/export-type-alignment`, by upstream owner): aligns
  `ExportFormatId` with runtime strings, adds shared `escape.ts` (escJs/escGo/escPy/escRust/
  safeIdent), removes `type CodeFormat = any`, removes fictional `tview-go`, adds `html`.
  Fetch branch from upstream, review, merge into fork. Solves deep_anal §2.2 wholesale.
- [ ] **Adopt upstream PR #20** (`fix/ratatui-export-complete`): supersedes PRs #8–#11.
  Review against our already-merged ratatui fix (commit 551319b) for overlap/conflicts.
- [ ] **Rebuild Textual exporter** (task chip `task_5f523ab8` exists):
  - [ ] Fix indentation (compose body at 8 spaces)
  - [ ] Escape all interpolated strings (use escape.ts from PR #19)
  - [ ] Map containers → `Vertical`/`Horizontal`, preserve tree structure
  - [ ] Full widget coverage: Box, List (`ListView`), Table (`DataTable`), Tree, Tabs
    (`TabbedContent`), ProgressBar, Checkbox, RadioButton, Switch, Select, Label
  - [ ] Style translation → inline `styles` or generated TCSS (implement the dead
    `includeCSS` setting for real)
- [ ] **Rebuild BubbleTea exporter**: `generateBubbleTeaView` never recurses — whole tree
  becomes one string. Emit lipgloss styles + joined layout (`lipgloss.JoinVertical/
  Horizontal`), per-component view funcs, escaped strings.
- [ ] **Fix Blessed exporter**:
  - [ ] `safeIdent` + collision counter for variable names (root "Screen" currently
    redeclares `const screen` → SyntaxError on every export)
  - [ ] Append children to parent var, not flat `screen.append` for everything
  - [ ] Use computed layout (top/left/width/height) instead of raw `props.width`
  - [ ] Translate colors/styles (`style: { fg, bg, border: { fg } }`)
- [ ] **Fix OpenTUI exporter**: text content silently dropped (`<Text />` self-closing with
  no content); only 4 type mappings. Emit children/content, verify actual `@opentui/core`
  API before mapping (current imports may be fictional).
- [ ] **Ink exporter, one-line bug**: border color uses `node.style.color` instead of
  `node.style.borderColor` ([codeExporter.ts:278](src/utils/export/codeExporter.ts:278)).
- [ ] **Gate broken exporters in the UI** until fixed: hide Textual/BubbleTea/Blessed/
  OpenTUI from the dropdown or badge them "experimental". Broken export is worse than none.
  (Cheap interim ship while the rebuilds land.)
- [ ] **Fix lint failure**: empty `RatatuiExportSettings` interface in
  [types/export.ts:56](src/types/export.ts) (PR #19 likely removes it; otherwise delete).
- [ ] **Validate `.tui` file on open**: `openTuiFile` feeds parsed JSON straight into
  `setRoot` — malformed tree shape crashes the editor. Wire up the currently-unused
  [validation.ts](src/utils/validation.ts) (or a small shape check) at this boundary.

## P1 — Export parity & quality

- [ ] **Decide Tview**: implement `tview-go` for real, or remove the claim from
  README/CLAUDE.md permanently (PR #19 removes the type; docs must follow).
- [ ] **Shared exporter architecture**: extract per-framework exporters into
  `src/utils/export/exporters/` (ratatui.ts is already the pattern); common walk +
  style-translation layer so each new framework implements a widget map, not a tree walker.
- [ ] **Wire ExportSettings into the UI**: indent size, include-comments, color mode
  (ansi/hex/rgb) exist as dead types — implement or delete per framework.
- [ ] **Color-tier degradation in code exports**: exporters emit truecolor hex only. Offer
  ANSI-16 named-color mapping (the tui-design skill's tier model is the spec; ratatui's
  `ratatuiColor` named-color table is a starting point).
- [ ] **Export snapshot tests**: no test runner exists. Add vitest + snapshot per
  (framework × fixture tree). The esbuild-bundle harness from the audit proves this is easy.
  Optional gold standard: compile-check generated output in CI (rustc/go/python/node).
- [ ] **Round-trip fidelity pass**: canvas preview vs generated code for gap audit per
  framework (padding, gap, justify/align, borders, gradients).

## P2 — Editor UX & robustness

- [ ] **Autosave**: design tree is lost on refresh — only settings persist to localStorage.
  Persist `componentStore.root` (+ theme) with zustand persist middleware, debounced;
  "restore last session?" on load.
- [ ] **Flexbox `stretch` sizing**: unimplemented
  ([flexbox.ts:216](src/utils/layout/flexbox.ts:216) TODO returns 0).
- [ ] **Canvas.tsx decomposition**: 1,370 lines mixing render/selection/drag/keyboard.
  Split into hooks (useCanvasDrag, useCanvasSelection, useCanvasKeyboard) before adding
  features. Toolbar.tsx (981) and ComponentToolbar.tsx (710) next.
- [ ] **Code-split the bundle**: single 970 KB chunk; lazy-load ExportPanel + CommandPalette.
- [ ] **Cross-window event cleanup**: custom `window` events (`toolbar-docked-changed`,
  `open-command-palette`) as ad-hoc bus — migrate to store state.
- [ ] Component wishlist (from skill's catalog, matching real TUI needs): Sparkline, Gauge
  (labeled), Log/viewport, StatusBar/footer keybinding hints, Separator/Rule.

## P3 — Housekeeping

- [ ] Delete dead `wailsjs/` (no src references; abandoned Wails wrapper)
- [ ] Delete or archive stale `docs/TUI_DESIGNER_*` planning docs (pre-implementation, misleading)
- [ ] Sync `package.json` version (0.0.1) with release tags (v0.3.6)
- [x] Commit pending `react-router-dom` removal (2026-07-28)
- [ ] `.gitignore`: add + untrack `tsconfig.tsbuildinfo`; consider upstream PR #16
  (same territory). `skills/` ignored 2026-07-28.
- [ ] Add `.claude/launch.json` (dev server on 5173) for one-command preview
- [ ] `npx update-browserslist-db` (build warning)
- [ ] README: correct the export-framework claims to match reality (7 → what actually works)

## Skill track — `skills/tui-design-mcpmarket`

- [ ] **Decide placement**: repo-root `skills/` copy is inert (Claude Code loads the skill
  from the installed MCPmarket plugin, not from here; its hooks never run from this path).
  Options: (a) gitignore it — it's sync-owned output and `sync.sh` overwrites it;
  (b) move a curated copy to `.claude/skills/tui-design/` for true project-local discovery
  and gitignore the sync target. Recommend (a) now, (b) only if plugin is ever removed.
- [ ] **Author a studio-specific companion skill** (`.claude/skills/tui-studio/`): maps
  studio component types → per-framework idioms, documents the `.tui` file format, the
  export architecture, and the theme palettes. The generic tui-design skill covers design;
  this covers *this codebase*. High leverage for future agent sessions.
- [ ] **Upstream feedback to skill content** (nice-to-have): skill's semantic-slot table
  could name the studio's 10 themes; app-patterns gallery could cite tui-studio as the
  design tool.
- [ ] Telemetry awareness (no action): plugin phones home per session-start sync and per
  skill invocation (slug/outcome/source only, no prompt content). Acceptable; revisit if
  policy changes.

## Process / repo

- [x] Fork to `discover-dmc/tui-studio`, rewire `origin`, add `upstream` remote (2026-07-28)
- [x] Push local main + todo/audit to fork (2026-07-28)
- [ ] Triage remaining upstream PRs: #8–#11 (close as superseded by #20), #16 (cherry-pick
  or redo), #19/#20 (adopt — see P0)
- [ ] Decide contribution posture: PR fixes back to upstream (inactive ~2 months) vs
  diverge on fork. Default: land on fork, offer upstream PRs opportunistically.
- [ ] CI on fork: GitHub Action for `build + lint` (+ vitest once P1 tests exist)
