# TUI-Studio + tui-design Skill — Master TODO

Source of truth for enhancing/fixing both tools. Backed by the audit in
[docs/deep_anal_1.md](docs/deep_anal_1.md). Update this file as items land; one PR per item
unless grouped.

Repo setup: fork `discover-dmc/tui-studio` is `origin`; `jalonsogo/tui-studio` is
`upstream` (inactive ~2 months, 7 open PRs). Work on branches off `main`, PR into the fork.

---

## P0 — Correctness (broken today, user-visible)

- [x] **Adopt upstream PR #19** (2026-07-28, merge 9baaa3d): `ExportFormatId` aligned with
  runtime strings, shared `escape.ts` added and wired into Ink/BubbleTea/Textual/Ratatui,
  `type CodeFormat = any` removed, fictional `tview-go` removed, `html` added.
  Solves deep_anal §2.2 wholesale; Textual/BubbleTea now escape strings (structure bugs remain).
- [x] **Adopt upstream PR #20** (2026-07-28, merge c9403f4): complete Ratatui exporter —
  usage-gated imports, Grid layout, Modal centering (saturating u16 math), Spacer/auto
  constraints, 3-digit hex, `Block::new()`, Cargo.toml hint. Also fixed the lint error.
  Conflicts vs #19 resolved: shared `escRust` kept over local copy, README keeps no-Tview line.
- [x] **Rebuild Textual exporter** (2026-07-28, commit 99b476c): new
  `exporters/textual.ts` module — containers → Vertical/Horizontal/Grid with-blocks,
  all 20 component types mapped (ListView, DataTable, Tree, Tabs, ProgressBar, Checkbox,
  RadioButton, Switch, Select, OptionList, LoadingIndicator…), styles → TCSS in `App.CSS`,
  data widgets populated in `on_mount`. Verified: py_compile + live `run_test()` mount
  under real textual. Niceties done 2026-07-28 (commit 7d28e62): `activeTab` set in
  on_mount, `gap` → child margins (`grid-gutter` on Grid), Modal → real `ModalScreen`
  subclass pushed at startup — all runtime-verified.
- [x] **Rebuild BubbleTea exporter** (2026-07-28, commit c648716): new
  `exporters/bubbletea.ts` — lipgloss JoinVertical/JoinHorizontal layout, Grid row
  chunking, gap spacers, full style translation (hex + named-ANSI colors, borders,
  padding), all 20 types, asset presets for spinner/bar, bubbles pointers in comments.
  Verified: gofmt-clean, compiles against real bubbletea+lipgloss, go test executes View().
- [x] **Fix Blessed exporter** (2026-07-28, commit 6e6182a): new `exporters/blessed.ts` —
  runs the studio LayoutEngine and emits absolute positions matching the canvas, real
  widget types, collision-safe vars, colors/labels/borders. Runtime-verified against real
  blessed under a pty (clean init, q-to-quit, exit 0).
- [x] **Fix OpenTUI exporter** (2026-07-28, commit 6e6182a): rewritten against the real
  `@opentui/react` API (lowercase box/text/input/select/tab-select intrinsics, Yoga
  flexbox with flexGrow for fill, strong/em/u modifiers, createCliRenderer bootstrap).
  Content no longer dropped; TSX esbuild-verified.
- [x] **Surface unsupported features** (2026-07-28): `getExportWarnings(root, format)` +
  amber banner in the export panel; BubbleTea skips Modals with a NOT-exported header
  comment and warns on fill sizing instead of silently degrading.
- [x] **Ink borderColor bug** fixed (2026-07-28, commit 208b511).
- [x] ~~Gate broken exporters in the UI~~ — obsolete: all exporters rebuilt (2026-07-28);
  unsupported features surface via the warnings banner instead.
- [x] **Fix lint failure**: resolved by PR #20's eslint-disable on `RatatuiExportSettings`
  (2026-07-28). `npm run lint` is clean.
- [x] **Validate `.tui` file on open** (2026-07-28, commit 175cb27): added
  `isValidComponentTree` to [validation.ts](src/utils/validation.ts) — recursively checks
  required fields and validates `node.type` against real `COMPONENT_LIBRARY` keys.
  `openTuiFile` now rejects malformed trees with the existing alert instead of crashing.
  Verified against good/malformed fixtures (bad type, non-array children, malformed child).

## P1 — Export parity & quality

- [x] **Tview implemented for real** (2026-07-28, commit 6e90ade): new
  `exporters/tview.ts` against the verified real `rivo/tview` + `gdamore/tcell/v2`
  API (pkg.go.dev + source-level checks for tag-parsing behavior, not guessed).
  Handles tview's real constraints: Box-embedding return-type chaining trap (every
  primitive is a named var, no chained Set* calls), tag-escaping rules that differ
  per widget (List parses `[tags]`, Table/TreeView never do — `tview.Escape()`
  applied uniformly since it's a harmless no-op elsewhere), the inverted
  FlexRow/FlexColumn naming, and tcell.GetColor's native hex+W3C-name resolution
  (only ANSI "bright" variants needed a manual palette-index map). Modal gets real
  support via `tview.Pages` + a Grid-centering wrapper — better than any other
  exporter can offer for Modal today. `ExportFormatId`, dropdown, extension,
  README table all updated. Verified: `go build` + `go vet` against the real
  packages (not just snapshots), plus a new CI step (`go-check-tview` in the
  `verify-go` job) doing the same on every push.
- [x] **Shared exporter architecture** (2026-07-28, commit d526a02): extracted Ink into
  `exporters/ink.ts` (the last one still inline in codeExporter.ts) and added
  `exporters/shared.ts` — consolidates logic that was genuinely duplicated across 3+
  files (a byte-identical ident generator in tview/blessed/bubbletea, ANSI16 name/index
  table, hex-nearest-neighbor matcher, gradient fallback). Deliberately did NOT build a
  single universal tree-walker/widget-map abstraction across all 7 languages — Rust
  widget dispatch, Python containers, Go Box-embedding chains, and JSX nesting are
  different enough that forcing one shape would be the premature abstraction the audit
  originally warned about. Consolidated only what was concretely duplicated.
- [x] **Wire ExportSettings into the UI** (2026-07-28, commit d526a02): deleted the fully
  dead `ExportSettings`/6 subtypes/`ExportFormat`/`ProjectExportData` (verified zero
  consumers anywhere). Replaced with one real, wired setting — see color-tier below —
  rather than resurrecting speculative fields (`indentSize`, `useAsyncIO`, etc.) that
  were never implemented and don't obviously matter to users.
- [x] **Color-tier degradation in code exports** (2026-07-28, commit d526a02): real
  `truecolor | ansi16` mode, dropdown in the export panel, threaded through
  `exportToCode`. Every exporter except Textual (TCSS ansi16 needs separate design,
  excluded rather than faked — see "Deferred" below). Each language verified against real
  docs: Ratatui's Color enum table, lipgloss indexed color strings, Tview's
  `tcell.PaletteColor` (chosen over `GetColor` since palette-index is the only
  guaranteed-adaptive form), Ink's chalk `xBright` suffix (verified distinct from the
  `brightX` prefix used elsewhere), OpenTUI's real `RGBA.fromIndex` API instead of a
  hex guess.
- [x] **Export snapshot tests** (2026-07-28, commit e36c799): vitest added (native Vite 7
  compat). Snapshot coverage of all 6 code formats × 3 fixtures (kitchen-sink, empty
  screen, text-only) in `src/utils/export/__tests__/`. Plus explicit regression assertions
  locking in this session's fixes (Blessed var collision, Textual indentation, OpenTUI
  content/intrinsics, Ink borderColor, Ratatui import gating, BubbleTea warnings).
  Compile-checking generated output in CI (rustc/go/python) is done — see the CI section.
- [x] **Round-trip fidelity pass** (2026-07-28, commit d526a02): audited padding/gap/
  justify/align/borders/gradients against every exporter, fixed real gaps —
  background gradient now degrades everywhere to its first stop as a flat color (with
  a warning) instead of being silently dropped; OpenTUI/BubbleTea translate
  justify/align to real Yoga props / lipgloss Join position; Ratatui emulates justify
  with `Constraint::Fill(1)` spacers and gets real gap via `Layout::spacing()`; Tview
  gets gap via a spacer Box (Flex has no native gap). Surfaced two real bugs, both
  fixed + regression-tested: Ratatui was skipping the Block entirely for an unbordered
  background-only container (nothing painted); Textual was emitting our internal
  color names ("brightGreen") as literal TCSS, which doesn't parse — real
  `ansi_bright_green` convention verified and wired in. Deferred: Tview/Blessed/Textual
  justify-content-style space distribution beyond what's listed above (no clean 1:1
  mapping in those layout models — see "Deferred" below).

## Deferred (deliberate, not forgotten)

- **Textual ansi16 color mode**: TCSS has its own `ansi_*` named-color convention
  (verified this session, now used for truecolor named-color translation) but no
  established "force everything to 16 colors" idiom the way `tcell.PaletteColor` or
  `RGBA.fromIndex` do for the other exporters — needs its own design pass, not a
  copy-paste of the pattern used elsewhere.
- **Tview/Blessed justify-content-style space distribution** (center/space-between
  distributing extra space, not just cross-axis align): Blessed doesn't need it — the
  LayoutEngine already bakes justify into absolute positions. Tview's Flex has no
  built-in weighted-space-distribution primitive; would need the same
  Fill-spacer-emulation technique Ratatui got, just not done yet.
- **Textual justify/align**: Textual's `align: <h> <v>` positions a container's
  children as one block, not a per-item distribution — doesn't map to CSS
  justify-content at all without a structural rework.

## P2 — Editor UX & robustness

- [x] **Autosave** (2026-07-28, commit 8913271): `src/utils/autosave.ts` subscribes to
  componentStore and debounce-writes `{version, meta:{theme}, tree}` to localStorage
  (reuses fileOps.ts's exact .tui shape). Restores silently on load — no prompt, matching
  Figma/Excalidraw/VS Code — validated through the same `isValidComponentTree` check used
  for opened .tui files. Plain manual localStorage read/write, not zustand persist
  middleware (nothing else in the codebase uses that pattern). Verified end-to-end in the
  browser: add component → wait past debounce → confirm write → reload → confirmed restored.
- [x] **Flexbox `stretch` sizing** (2026-07-28, commit 4025525): an item with
  `align: 'stretch'` and no explicit cross-axis size now fills the container's cross
  dimension (real CSS semantic) instead of a no-op default. Explicit sizes still win;
  limited to the common single-line case (multiple wrapped lines can't each stretch to
  the full container without overlapping). Verified directly against
  `calculateFlexboxLayout`; `src/utils/layout/__tests__/flexbox.test.ts` added.
- [x] **Canvas.tsx decomposition** (2026-07-28, commits 850f055, current): arrow-key nudge
  extracted verbatim into `useCanvasKeyboardNudge` (`src/hooks/useCanvasKeyboard.ts`), then
  selection/hover/context-menu extracted into `useComponentSelection` and
  drag-reorder/reparent/resize extracted into `useComponentDrag`
  (`src/hooks/useComponentSelection.ts`, `src/hooks/useComponentDrag.ts`). `Canvas.tsx` shed
  ~210 lines. Correction to an earlier note here: the "nudge doesn't move anything" finding
  (`task_61c608d2`) was a false positive — the browser automation tool used to test it
  dispatches synthetic keydown/mouse events with empty `key`/`code`, which the app's own
  `.includes(e.key)` guard correctly rejects. Dispatching a real `KeyboardEvent`/`DragEvent`
  confirms nudge, resize, click-select, hover ring, context menu, and drag reorder/reparent
  all work correctly; task dismissed as non-issue.
- [x] **Toolbar.tsx / ComponentToolbar.tsx decomposition** (2026-07-28, commit f4b6a59):
  `Toolbar.tsx` was a 944-line kitchen sink of independent modals + the app menu — split
  into `SaveDialog.tsx`, `ChangelogModal.tsx`, `HelpModal.tsx`, `AboutModal.tsx`,
  `SettingsModal.tsx`, `AppMenu.tsx`, plus shared `useEscapeKey` hook and `accentColor.ts`
  utils. `Toolbar.tsx` now just wires them together (944 → 195 lines). `ComponentToolbar.tsx`
  is one cohesive component (not independent pieces), so only extracted the genuinely
  self-contained drag-to-reposition/preset-position logic into `useToolbarPosition` and its
  static data into `constants/componentToolbar.ts` (697 → 506 lines); left the
  dropdown/hotkey/dock-mode render logic in place rather than force a split that would add
  risk without reducing complexity. Verified in-browser: app menu, all 5 modals, accent
  color live-apply, dock/undock round-trip, drag-reposition, position presets, and group
  dropdown add-component all confirmed working post-split.
- [x] **Code-split the bundle** (2026-07-28, commit 104c8ba): `ExportModal` (75KB — bundles
  all 7 exporters) and `CommandPalette` (4.9KB) converted to `React.lazy()`, gated at the
  JSX call site by their own `isOpen`/`open` flag so the dynamic import only fires on
  first actual open. Verified: build output shows them as separate chunks; both open
  correctly in the browser post-split.
- [x] **Cross-window event cleanup** (2026-07-28, commit 2bdef6d): new `src/stores/uiStore.ts`
  replaces `toolbar-docked-changed`, `open-save-dialog`, `command-export/settings/help/
  changelog/about`, and `open-command-palette` — 6 booleans + 7 window-event effects in
  Toolbar.tsx alone collapse into 3 store selectors (`toolbarDocked`, `commandPaletteOpen`,
  `activeDialog: DialogName | null`). Surfaced and fixed a dead wire along the way (command
  palette's Save action fired an event nothing listened for); deliberately left the
  Copy/Paste menu items' identical dead-wire bug alone (flagged separately as
  `task_7b18da74` — needs new clipboard plumbing, not just an event-to-store swap).
  Verified in the browser: every dialog opens via shortcut + app menu, dock toggle
  round-trips between producer and both consumers, survives reload.
- [x] Spinner + progress bar asset libraries (2026-07-28, commit 7e579fe): 46 cli-spinners
  presets (terminal-safe subset) and 13 bar charsets incl. smooth eighth-block partials, in
  `src/constants/assets.ts`; wired through canvas, export renderer, PropertyPanel dropdowns,
  Ink (ink-spinner type passthrough) and Ratatui exporters.
- [x] Animate spinner preview on canvas (2026-07-28, commit dcdf514): `ComponentRenderer`
  ticks a local `spinnerFrame` state via `setInterval` at the preset's real interval,
  scoped per-instance. `node.props.frame` (the exporters' static frame) is untouched —
  purely a canvas preview concern. Verified live: sampled the rendered glyph twice ~300ms
  apart and confirmed it changed.

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

## P4 — Component wishlist (new component types)

Extracted from P2 (2026-07-29) — bigger than a line item. Every new `ComponentType` touches
all of: `types/` (union + prop types), `constants/components.ts` (`COMPONENT_LIBRARY` entry:
defaultProps/defaultLayout/defaultStyle/defaultEvents), canvas rendering
(`Canvas.tsx`'s `ComponentRenderer.renderComponent` switch + any layout-engine auto-size
special case), property editing (`PropertyPanel`/`LayoutEditor`/`StyleEditor` — type-specific
controls), and all 7 exporters (Ink, BubbleTea, Blessed, Textual, OpenTUI, Tview, Ratatui) —
each needs real, verified support per this session's standing rule (check the actual
framework API/docs, don't guess), plus export-fixture/CI coverage. That's ~10 touch points
per component. Do one component fully — every touch point, CI-verified — before starting the
next, matching the "finish a section before moving on" preference from this session.

Suggested order (simplest/most-reusable first, to prove the full pipeline cheaply):

- [ ] **Separator / Rule** — horizontal/vertical divider line. Smallest surface area, good
  first template. Native support varies: Textual has `Rule`; Ratatui and Tview don't (draw a
  bordered Block/Box with zero content instead); Blessed/OpenTUI/Ink/BubbleTea likely need a
  hand-rolled line character repeated across width/height.
- [ ] **Gauge (labeled)** — ProgressBar variant with a label and distinct framing. Ratatui has
  a native `Gauge` widget; other frameworks likely map to a styled ProgressBar composition
  rather than a distinct primitive — verify per-framework before assuming a 1:1 widget exists.
- [ ] **Sparkline** — inline mini bar/line chart from a numeric array. Ratatui has a native
  `Sparkline` widget; BubbleTea/Textual/Tview/Blessed/OpenTUI/Ink have no built-in equivalent
  and would need hand-rolled Unicode block rendering (can likely reuse the existing
  progress-bar block-character presets in `constants/assets.ts`).
- [ ] **Log / viewport** — scrolling log/output panel. Real per-framework primitives differ a
  lot: Textual has `RichLog`; BubbleTea has `bubbles/viewport`; Blessed has `log`/
  `scrollablebox`; Ratatui/Tview have no built-in scrollback (hand-rolled `Paragraph`/TextView
  + scroll offset). Needs static placeholder content in the canvas since there's no real log
  stream at design time.
- [ ] **StatusBar / footer keybinding hints** — bottom bar showing keybindings (e.g.
  `^Q Quit  ^S Save`). Open design question before coding: does this need a real new
  `ComponentType`, or is it already achievable today by composing existing Box+Text? Decide
  that first — may turn out to need zero exporter work.

## Wishlist — unscoped ideas

Lower-confidence or exploratory ideas, not yet sized or committed to a priority tier.

- [ ] **Expose TUIStudio to AI agents/LLMs for live co-creation** (raised 2026-07-29): let an
  agent manipulate the design directly (add/edit/query components) alongside the human, not
  just via one-shot export. Viable — the component tree is already a clean JSON structure
  (`ComponentNode`) mutated through a small, well-defined action API on `componentStore`
  (`addComponent`, `updateProps`, `updateLayout`, `moveComponent`, `removeComponent`, plus
  existing undo/redo history as a safety net), and `.tui` save/open already round-trips the
  whole tree. The natural shape: an MCP server whose tools map ~1:1 onto those existing store
  actions, bridged to the live browser tab over a small local WebSocket (the app has no
  backend today — this bridge would be the first one). Main open question, not a blocker:
  MCP tool calls are pull/turn-based (agent asks, gets state, acts), not a push feed, so
  "co-creation" in practice looks like turn-taking — the agent catches up on human edits by
  calling a `get_tree`-style tool each turn, rather than seeing them the instant they happen.
  Not sized or scoped yet; needs its own design pass (transport bridge, tool surface, and a
  decision on how conflicting human/agent edits are surfaced) before estimating.

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
- [ ] Triage remaining upstream PRs: #8–#11 superseded by adopted #20 (nothing to do on the
  fork; closing them is upstream's call), #16 (cherry-pick or redo). #19/#20 adopted 2026-07-28.
- [ ] Decide contribution posture: PR fixes back to upstream (inactive ~2 months) vs
  diverge on fork. Default: land on fork, offer upstream PRs opportunistically.
- [x] CI on fork (2026-07-28, commit e36c799): `.github/workflows/ci.yml` runs
  lint + test + build on push/PR, Node 22. First run green: https://github.com/discover-dmc/tui-studio/actions/runs/30374434316
- [x] CI compile-checks generated output for real (2026-07-28, commit 3504160):
  `scripts/generate-export-fixtures.mjs` bundles the exporters and writes the
  kitchen-sink fixture's output for all 6 formats; `build` uploads it as an artifact;
  4 new jobs each hand it to a real toolchain — `verify-rust` (cargo build vs real
  ratatui), `verify-go` (go test calling model{}.View() vs real bubbletea+lipgloss),
  `verify-python` (py_compile + headless run_test() vs real textual),
  `verify-node-exports` (node --check on Blessed — the exact check that would've
  caught the `const screen` collision — plus esbuild syntax checks on OpenTUI/Ink
  TSX). All reproduced locally first (installed rust via brew for this); ratatui.rs
  had never actually been rustc-verified before — it compiles cleanly. First full
  run green: https://github.com/discover-dmc/tui-studio/actions/runs/30375505811
  Extended 2026-07-28 (commit d526a02) to cover 3 fixture variants per format
  (kitchen-sink, style-edge-cases, ansi16) — 19 generated files total, all reproduced
  locally before the workflow change. This is what caught the Ratatui/Textual bugs
  above for real, not just via snapshot string-matching.
