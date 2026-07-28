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
- [ ] **Shared exporter architecture**: extract per-framework exporters into
  `src/utils/export/exporters/` (ratatui.ts is already the pattern); common walk +
  style-translation layer so each new framework implements a widget map, not a tree walker.
- [ ] **Wire ExportSettings into the UI**: indent size, include-comments, color mode
  (ansi/hex/rgb) exist as dead types — implement or delete per framework.
- [ ] **Color-tier degradation in code exports**: exporters emit truecolor hex only. Offer
  ANSI-16 named-color mapping (the tui-design skill's tier model is the spec; ratatui's
  `ratatuiColor` named-color table is a starting point).
- [x] **Export snapshot tests** (2026-07-28, commit e36c799): vitest added (native Vite 7
  compat). Snapshot coverage of all 6 code formats × 3 fixtures (kitchen-sink, empty
  screen, text-only) in `src/utils/export/__tests__/`. Plus explicit regression assertions
  locking in this session's fixes (Blessed var collision, Textual indentation, OpenTUI
  content/intrinsics, Ink borderColor, Ratatui import gating, BubbleTea warnings).
  Compile-checking generated output in CI (rustc/go/python) is still open — see below.
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
- [x] Spinner + progress bar asset libraries (2026-07-28, commit 7e579fe): 46 cli-spinners
  presets (terminal-safe subset) and 13 bar charsets incl. smooth eighth-block partials, in
  `src/constants/assets.ts`; wired through canvas, export renderer, PropertyPanel dropdowns,
  Ink (ink-spinner type passthrough) and Ratatui exporters.
- [ ] Component wishlist (from skill's catalog, matching real TUI needs): Sparkline, Gauge
  (labeled), Log/viewport, StatusBar/footer keybinding hints, Separator/Rule.
- [ ] Animate spinner preview on canvas (presets carry `interval`; currently static frame).

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
