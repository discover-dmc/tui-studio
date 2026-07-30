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

- [x] **Delete dead `wailsjs/`** (2026-07-29, commit 34875aa): confirmed zero references
  anywhere in src/, package.json, or vite.config.ts before removing.
- [x] **Delete stale `docs/TUI_DESIGNER_*` planning docs** (2026-07-29, commit c365cdd):
  5 pre-implementation files (dated 2026-02-09, "working title"), only cross-referenced each
  other, not linked from README/CLAUDE.md/code. Deleted outright (git history keeps them if
  ever needed) rather than archived.
- [x] **Sync `package.json` version with CHANGELOG** (2026-07-29, commit 574b1e8): was stuck
  at `0.0.1` vs CHANGELOG's `0.3.6` — also fixes the About dialog's version display, which
  reads `__APP_VERSION__` from `package.json` at build time (a real, if minor, user-visible bug).
- [x] Commit pending `react-router-dom` removal (2026-07-28)
- [x] **`.gitignore`: add + untrack `tsconfig.tsbuildinfo`** (2026-07-29, commits 574b1e8,
  2eb46ca). Upstream PR #16 not adopted separately — same outcome achieved directly.
- [x] **`.claude/launch.json`** — already existed from an earlier session (commit 7e579fe);
  confirmed present and correct, no new work needed.
- [x] **`npx update-browserslist-db`** (2026-07-29, commit 574b1e8): caniuse-lite refreshed,
  build warning gone.
- [x] **README export-framework claims** (2026-07-29, commit b680d0e): the export table itself
  was already accurate (all 7 exporters fixed in P0/P1) — nothing to change there. Found and
  fixed a related real bug instead: the clone URL and Issues link both pointed at the inactive
  `jalonsogo/tui-studio` upstream instead of this fork.

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

- [x] **Separator / Rule** (2026-07-29): horizontal/vertical divider line, `lineStyle`
  single/double/thick/dashed. New `ComponentType`, `COMPONENT_LIBRARY` entry, canvas render
  case (+ orientation-aware resize handles: width-only when horizontal, height-only when
  vertical), PropertyPanel orientation/lineStyle controls, ANSI/text-export renderer case,
  and all 7 code exporters. Verified real per-framework APIs rather than guessing: Textual
  has a native `Rule` widget (`orientation`/`line_style`, confirmed via
  textual.textualize.io) — used directly, and its real headless mount was tested (`Rule`
  actually mounts and unmounts cleanly). Blessed has a native `line` widget (verified from
  its source: `orientation` + a `ch` fill-character option) — used directly. Ratatui,
  Tview, BubbleTea, OpenTUI, and Ink have no native rule primitive (confirmed — e.g.
  docs.rs/ratatui has no `Rule` widget) — all hand-roll a repeated line character; Ratatui's
  version is notable since width/height aren't known at export time, so the generated Rust
  reads the real `Rect.width`/`.height` field at render time (`"─".repeat(area.width as
  usize)`) rather than baking in a static guess. All 7 exporters' generated output was
  handed to its real toolchain (not just snapshot strings): `cargo build` (3 Ratatui
  variants), `go test`/`go build`+`go vet` (3 BubbleTea + 3 Tview variants), `py_compile` +
  a real headless Textual mount (2 variants), `node --check` (3 Blessed variants), and
  `esbuild --jsx=automatic` (6 OpenTUI/Ink variants) — all passed. Also verified live in the
  browser: add via palette, orientation/lineStyle controls, canvas rendering (horizontal +
  vertical + all 4 line styles), resize-handle restriction, and both the Text/ANSI and Code
  export tabs (Textual `Rule.vertical(line_style="double")`, Ratatui's runtime-width
  expression) end to end.
- [x] **Gauge (labeled)** (2026-07-29): ProgressBar-like widget with a `label`, overlaid/centered
  on the bar rather than trailing it — real per-framework APIs verified rather than assumed.
  Ratatui uses its native `Gauge::label()` directly (confirmed via docs.rs — replaces the
  default percentage text, exactly the feature that makes Gauge distinct from a re-skinned
  ProgressBar). Textual's `ProgressBar` has no free-text label slot (confirmed via its docs),
  so it composes `Horizontal(Static(label) + ProgressBar)` — the same pattern this file
  already uses for a labeled Toggle. BubbleTea/Tview/Blessed/OpenTUI/Ink have no gauge
  primitive, so they share one new helper, `renderGauge()` (`constants/assets.ts`), which
  splices the label text into the center of a rendered bar — mirroring how ratatui's real
  `Gauge::label()` behaves and how terminal resource meters (htop/btop) typically render.
  Also required layout-engine changes ProgressBar already needed (leaf auto-height,
  width-only resize handle) since Gauge follows the same no-explicit-height convention.
  All 7 exporters' generated output verified against real toolchains (cargo build, go
  test/build+vet, py_compile + a real headless Textual mount, node --check, esbuild) — the
  Textual variant's `Horizontal(Static+ProgressBar)` mounted cleanly. Verified live in the
  browser: add via search, Label/Value/Max/Style/Show-percentage controls, canvas rendering,
  width-only resize, and the Ratatui code export tab showing the real
  `Gauge::default().ratio(0.450).label("CPU 45%")` call.
- [x] **Sparkline** (2026-07-29): inline mini bar chart from a numeric series (`data`, optional
  `max`). Correction to this item's own assumption: **Textual also has a native `Sparkline`
  widget** (confirmed via textual.textualize.io/widgets/sparkline) — used directly
  (`Sparkline(data, summary_function=max)`), not hand-rolled like originally guessed. Ratatui
  uses its real `widgets::Sparkline` (`.data(&[u64...]).max(n)`, confirmed via docs.rs; values
  rounded/clamped to u64, direction left at its documented default rather than specified).
  BubbleTea/Tview/Blessed/OpenTUI/Ink have no native primitive, so they share one new helper,
  `renderSparkline()` (`constants/assets.ts`) — buckets the series into `width` columns
  (max-per-bucket, matching Textual's own `summary_function=max` convention) and maps each to
  one of the 8 eighths-block levels (▁▂▃▄▅▆▇█), the same default character set ratatui's real
  Sparkline uses (`symbols::bar::NINE_LEVELS`). All 7 exporters' generated output verified
  against real toolchains (cargo build, go test/build+vet, py_compile + a real headless
  Textual mount, node --check, esbuild) — the Textual variant mounted the real Sparkline
  widget cleanly. Verified live in the browser: add via search, editable comma-separated data
  field, canvas rendering (both the default upsampled data and a hand-entered triangular
  series), width-only resize, and both the Textual and Ratatui code export tabs showing the
  real widget calls.
- [x] **Log / viewport** (2026-07-29): scrolling log/output panel (`lines: string[]`). Real
  per-framework primitives verified — more frameworks had native support than this item's own
  original guess assumed. Textual's real `RichLog` (`.write()` per line in `on_mount`).
  Blessed's real `log` widget (`scrollable: true, alwaysScroll: true` — genuine tail-scroll,
  not hand-rolled). Tview's real `TextView.SetScrollable(true)` + `.ScrollToEnd()` (confirmed:
  "discards lines moving out of the visible area at the top" — an actual native log-tail
  mechanism, not a guess). OpenTUI's real `<scrollbox>` intrinsic (confirmed via
  opentui.com/docs/components/scrollbox). Only BubbleTea and Ink have no native fit: BubbleTea
  gets a static preview + a `bubbles/viewport` pointer comment (matching this file's existing
  convention for Spinner/ProgressBar); Ink hand-rolls a `Box` column of `Text` lines. Ratatui
  uses a real multi-line `Paragraph` — since both content and height are known at export time,
  the visible tail is pre-sliced there rather than using Paragraph's real runtime `.scroll()`
  offset (which would only matter if content could still change after export). All 7
  exporters' generated output verified against real toolchains (cargo build, go
  test/build+vet, py_compile + a real headless Textual mount, node --check, esbuild) — the
  Textual variant's real `RichLog` mounted cleanly. Verified live in the browser: add via
  search, editable "one per line" textarea, canvas rendering (bottom-anchored tail), full
  resize (unlike the single-line Gauge/Sparkline/ProgressBar, Log resizes in both axes), and
  the Textual/Tview code export tabs showing the real widget calls.
- [x] **StatusBar / footer keybinding hints** (2026-07-29): bottom bar showing keybindings
  (`items: { key, label }[]`, e.g. `^Q Quit  ^S Save`). Resolved this item's own open design
  question — decided a real `ComponentType` over Box+Text composition specifically *because*
  two frameworks have a genuinely more powerful native mechanism a generic composition could
  never produce: Textual's real `Footer` widget auto-renders from a `BINDINGS` class attribute
  (confirmed via textual.textualize.io/widgets/footer) — used directly, generating a real
  `BINDINGS = [("ctrl+q", "exit", "Exit"), ...]` list on `MyApp` (our "^Q" caret notation is
  converted to Textual's real "ctrl+q" key-name convention; each label is slugified into a
  Python-identifier-safe action name — no matching `action_*` methods are required for the
  app to mount, confirmed by the real headless mount test). BubbleTea's `bubbles/help`
  package (`key.Map`/`ShortHelp()`) is the analogous real primitive there, but — matching
  this file's existing Spinner/ProgressBar convention — gets a static preview + a pointer
  comment rather than a live keymap, since help.Model needs a running Bubble Tea program to
  drive it. The other 5 frameworks have no comparable primitive, so they share one new
  helper, `renderStatusBar()` (`constants/assets.ts`), joining key+label pairs with
  gap-separated spaces. All 7 exporters' generated output verified against real toolchains
  (cargo build, go test/build+vet, py_compile + a real headless Textual mount, node --check,
  esbuild) — the Textual variant's real `Footer`+`BINDINGS` mounted cleanly with no stub
  action methods defined, confirming the earlier hypothesis. Verified live in the browser:
  add via search (Navigation category), a key/label items editor (add/edit/remove), canvas
  rendering (full-width colored bar), width-only resize, and the Textual code export tab
  showing the real `BINDINGS`/`Footer()` output with a live-edited label reflected in both
  the binding description and its auto-generated action name.

This closes out the P4 component wishlist (Separator, Gauge, Sparkline, Log, StatusBar) that
this file's own P2 wishlist entry was extracted into — see the P4 section above for the full
per-component breakdown and verification notes.

## Wishlist — unscoped ideas

Lower-confidence or exploratory ideas, not yet sized or committed to a priority tier.

### AI integration — let any capable model design TUIs via API

Raised 2026-07-29, fleshed out 2026-07-29 into achievable phases after
researching how existing LLM-facing TUI tooling keeps a model on-track
(`gfargo/tui-design-skill`'s reference-loaded-on-demand structure; Hyperbliss's
`ghostty-automator` screen-state-introspection loop — see `docs/design_anal.md`
and `.claude/skills/tui-studio/SKILL.md`). Goal: an agent — not just this one,
any capable model via a documented API — can manipulate an sTUIdio design
directly (add/edit/query components) alongside or instead of a human, not
just via one-shot export. Viable today: the component tree is already a
clean JSON structure (`ComponentNode`) mutated through a small, well-defined
action API on `componentStore` (`addComponent`, `updateProps`, `updateLayout`,
`moveComponent`, `removeComponent`, plus existing undo/redo history as a
safety net), and `.tui` save/open already round-trips the whole tree.
`isValidComponentTree` (`src/utils/validation.ts`) already exists as a
ready-made guardrail. Phased so each phase is independently shippable and
testable, matching this project's "finish a section before moving on" habit:

- [ ] **Phase 1 — MCP server + transport bridge**: an MCP server whose tools
  map ~1:1 onto existing `componentStore` actions (`add_component`,
  `update_props`, `update_layout`, `move_component`, `remove_component`,
  `get_tree`, `list_component_types`, `get_component_schema`), bridged to the
  live browser tab over a small local WebSocket (the app has no backend
  today — this bridge would be the first one). MCP tool calls are
  pull/turn-based (agent asks, gets state, acts), not a push feed, so
  "co-creation" in practice is turn-taking — the agent catches up on human
  edits by calling `get_tree` each turn, not by watching them happen live.
  Every mutating tool validates through `isValidComponentTree` before
  committing and rides the existing undo/redo stack — no new safety
  mechanism needed, reuse what's there.
- [ ] **Phase 2 — guardrail skill for the *consuming* model**: a companion
  skill (siblings to `.claude/skills/tui-studio/`) that any capable model
  loads to *use* sTUIdio's MCP tools correctly, not just to hack on this
  codebase. Mirrors `gfargo/tui-design-skill`'s proven shape — a compact
  top-level file (component vocabulary, the tool surface from Phase 1, and
  hard constraints) plus on-demand reference docs (per-framework export
  idioms — reuse the idiom map already written in
  `.claude/skills/tui-studio/SKILL.md`; the seven canonical layout patterns
  and keybinding conventions from `docs/design_anal.md`) so a model builds
  designs that match real-world TUI conventions instead of merely
  structurally-valid trees.
- [ ] **Phase 3 — self-verification loop**: a read-only `render_preview` (or
  `get_ansi_preview`) tool returning the existing ANSI/text-export output
  (`src/utils/rendering/components.ts` — already built, just needs exposing)
  for the current tree, so the agent can inspect its own result and correct
  course without a human relaying a screenshot. This is the same
  "design → build → see → fix" loop Hyperbliss's `ghostty-automator`
  provides for hand-written TUI code, applied instead to sTUIdio's own tree
  state — cheaper to build here since the render pipeline already exists.
- [ ] **Phase 4 — dry-run / diff preview**: a tool that returns the
  would-be tree diff for a mutation without committing it (mirrors how
  coding agents show a diff before writing a file), so a model can preview
  a risky change (e.g. `remove_component` on a subtree, bulk restyle)
  before applying it. Layers on top of Phase 1's action API — no new store
  mechanism, just a "compute, don't commit" path through the same reducers.
- [ ] **Phase 5 — conflict surfacing for concurrent human/agent edits**:
  the open question from the original idea — decide how a human's live
  edit and an agent's in-flight turn are reconciled (last-write-wins with a
  visible toast, an optimistic-lock version counter on `get_tree`/mutations,
  or a simple "agent turn" mode toggle that pauses human edits while the
  agent is active). Needs its own design pass before estimating; the other
  four phases don't block on this being resolved first.

### Design gaps found via competitive analysis

Sourced from `docs/design_anal.md` (2026-07-29) — a survey of
[awesometui.com](https://awesometui.com)'s 2026 Award winners (btop,
lazygit, glow, micro, opencode) cross-referenced against published TUI
design guidance. Each gap was verified against sTUIdio's actual source
before being listed here — see `docs/design_anal.md` for the file/line
citations and the validated (already-correct) findings.

- [x] **Add an ansi256 tier to the 6 color-capable code exporters** (2026-07-30):
  `ExportColorMode` now has `truecolor`/`ansi16`/`ansi256`. Added
  `nearestAnsi256(hex)` to `shared.ts` — a real xterm-256 palette
  implementation (0-15 base colors, 16-231 as the 6x6x6 cube with levels
  `[0,95,135,175,215,255]`, 232-255 as the 24-step grayscale ramp `8 +
  10*n`), verified against the published xterm-256 spec, not guessed.
  Verified the real per-framework 256-color API before using it: Ratatui's
  `Color::Indexed(u8)` (docs.rs), lipgloss's `Color("N")` numeric-string
  form (same mechanism ansi16 already used, just a wider index range),
  Tview's `tcell.PaletteColor(0-255)` (confirmed full-range, not just 16),
  OpenTUI's `RGBA.fromIndex(0-255)` (confirmed full-range via opentui.com
  docs), Blessed's `colors.convert()` (confirmed it pass-throughs a raw JS
  `number` as an already-resolved index — required a new
  `blessedColorExpr()` emitting a bare numeric literal instead of the
  quoted-string form the other two tiers use), and Ink's `color="ansi256(N)"`
  string syntax (confirmed via Ink's actual `colorize.ts` source, not
  assumed from chalk's API alone). Textual excluded — it has no color-tier
  mode at all yet (see Deferred). Wired into `ExportPanel`'s dropdown,
  `generate-export-fixtures.mjs`, and CI's 4 verify jobs (new
  `-edge-ansi256` variant per format). Verified: 5 new/extended vitest
  assertions (all passing, including a check that Blessed emits `fg: 88`
  not `fg: "88"`), plus real toolchain checks — `cargo build`, `go test`
  (BubbleTea) + `go build`/`go vet` (Tview), `node --check` (Blessed),
  `esbuild` (OpenTUI/Ink) all clean on the new variants. Browser-verified
  live: Ratatui + ANSI-256 mode in the Export panel renders
  `Color::Indexed(7)`/`Color::Indexed(4)` for the sample tree's white/blue.
- [ ] **`TextArea` component**: no multiline editable text input exists
  today (`TextInput` is explicitly single-line) — needed for commit-message
  boxes, chat compose fields, etc.
- [ ] **Multi-select `List` variant**: `List` only tracks a single
  `selectedIndex`; no per-item checked state for lazygit-style
  multi-selection (e.g. staging several files at once).
- [ ] **Notification/Toast component**: a non-blocking, self-dismissing
  status message, distinct from the existing blocking `Modal` — the
  async-feedback pattern top TUIs use so the UI never has to freeze just to
  report "saved" or "connection lost."
- [ ] **Keybinding-convention preset in PropertyPanel**: not a new
  component — a dropdown for nav-capable components (List/Table/Tree) that
  offers the near-universal `j`/`k`/`/`/`?`/`Esc` vocabulary (fzf, lazygit,
  helix) as a one-click preset instead of hand-typing `EventHandlers`.
- [ ] **"New from template" starter gallery**: seed the canvas-creation flow
  with the seven recurring layout archetypes (Persistent Multi-Panel,
  Miller Columns, Drill-Down Stack, Widget Dashboard, IDE Three-Panel,
  Overlay/Popup, Header+Scrollable-List) instead of always starting blank.
- [ ] **Monochrome-first preview mode**: an explicit "preview with no
  color" toggle to sanity-check that layout/semantics survive without
  color, not just palette swaps — an accessibility check none of the
  existing color-mode controls currently do.

## Skill track — `skills/tui-design-mcpmarket`

- [x] **Decide placement** (2026-07-29): went with (a) — confirmed repo-root `skills/`
  was already gitignored and never tracked (commit 6130778, before this session). Found
  and fixed a real bug in the same rule while adding the new skill below: `skills/` (no
  leading slash) matched *any* directory named `skills` anywhere in the tree, silently
  swallowing `.claude/skills/` too. Anchored to `/skills/` so only the sync target is
  ignored.
- [x] **Author a studio-specific companion skill** (2026-07-29):
  [`.claude/skills/tui-studio/SKILL.md`](.claude/skills/tui-studio/SKILL.md) — the
  12-point new-`ComponentType` checklist, a verified component→framework native-widget
  idiom map (which of the 7 exporters have a real primitive for which studio component,
  sourced from this session's P1/P4 work rather than re-guessed), the `.tui` file schema,
  and the theme/color-mode system. Generic tui-design skill covers TUI design in
  general; this one covers this codebase specifically.
- [ ] **Upstream feedback to skill content** (nice-to-have): skill's semantic-slot table
  could name the studio's 10 themes; app-patterns gallery could cite tui-studio as the
  design tool.
- [x] Telemetry awareness (no action needed): plugin phones home per session-start sync and per
  skill invocation (slug/outcome/source only, no prompt content). Acceptable; revisit if
  policy changes.

## Process / repo

- [x] Fork to `discover-dmc/tui-studio`, rewire `origin`, add `upstream` remote (2026-07-28)
- [x] Push local main + todo/audit to fork (2026-07-28)
- [x] **Triage remaining upstream PRs** (2026-07-29): confirmed we only have read access to
  upstream (`push: false` via `gh api repos/jalonsogo/tui-studio` — permissions object).
  #8–#11 (Demwunz's staged Ratatui fidelity chain: baseline → layout → input-widget →
  nav/data) fully superseded by jalonsogo's own #20, already adopted (commit c9403f4) —
  nothing to backport; can't close them ourselves, that's upstream's call. #16 (tembo-bot:
  gitignore `tsconfig.tsbuildinfo` + package-lock peer-flag cleanup) fully moot — verified
  our current `package-lock.json` already has zero `"peer": true` entries (stale-npm-version
  lockfile artifact, not a real fix to port) and the gitignore half was already done directly
  in P3. #19/#20 (jalonsogo's own) already adopted 2026-07-28; remain open upstream since we
  can't merge there.
- [x] **Decide contribution posture** (2026-07-29): land on fork, no new upstream PRs for
  now. Evidence, not assumption: upstream's last push was 2026-06-10 (opening #19/#20), last
  actual merge 2026-04-07 — even the maintainer's own PRs sit with 0–1 comments and no merge
  after 7 weeks; 11 open issues, no recent activity. A dormant maintainer sitting on their
  own unreviewed PRs won't review ours either. Revisit if jalonsogo shows renewed activity
  (merges #19/#20, comments, pushes). Tradeoff accepted: forgoes upstream credit/visibility
  for the P0/P1 exporter rewrites, but that cost is low given nothing is being merged there
  regardless.
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
