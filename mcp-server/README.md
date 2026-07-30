# sTUIdio MCP server

Lets any MCP-capable model manipulate a live sTUIdio design directly — add,
edit, move, and remove components — instead of only ever exporting once at
the end. This is AI-integration Phases 1, 3, and 4 (see `todo.md`) — the
transport, the self-verification tool, and dry-run previews. For an agent
to actually use this well, load the `.claude/skills/stuidio-agent/` skill
(Phase 2) first — it covers the component vocabulary and the constraints a
valid-but-wrong tree can still violate.

## How it works

This is a standalone Node process, separate from `npm run dev`. It speaks
MCP over stdio to whatever client spawns it, and bridges tool calls to the
browser tab over a local WebSocket on `ws://127.0.0.1:5175`. Only one
browser tab can be bridged at a time.

```
MCP client --stdio--> mcp-server/index.mjs --ws(127.0.0.1:5175)--> sTUIdio tab
```

## Setup

1. Open sTUIdio in the browser (`npm run dev`) and turn on **Settings →
   Agent Bridge**. The status line there should read "Connected" once the
   server below is running.
2. Point your MCP client at this server. For Claude Code, from the repo
   root:

   ```
   claude mcp add stuidio -- node mcp-server/index.mjs
   ```

   This is the same command on Windows, macOS, and Linux — it's plain
   `node <path>`, no shell-specific syntax. For other MCP clients, configure
   them to run `node mcp-server/index.mjs` from this repo's root directory.

## Tools

| Tool | Purpose |
| --- | --- |
| `get_bridge_status` | Report the bridge's own connection health (connected?, since when, last error) — works even with no browser attached. |
| `get_tree` | Read the current full component tree. |
| `render_preview` | Render the current design to text/ANSI — the same output the app's own Export panel produces — so you can inspect your result and self-correct. |
| `get_layout_warnings` | List components with a layout warning (overflow, negative space) — the same detection behind the app's own "N Layout Warnings" banner. |
| `list_component_types` | List every available component type. |
| `get_component_schema` | Get one type's default props/layout/style/events. |
| `list_templates` | List the 7 starter layouts built into the app's "New from Template" gallery. |
| `apply_template` | Replace the current tree with one of those templates. |
| `add_component` | Add a new component under an existing parent. |
| `update_props` | Merge props into an existing component. |
| `update_layout` | Merge layout fields into an existing component. |
| `move_component` | Move a component to a new parent. |
| `remove_component` | Remove a component and its children. |
| `duplicate_component` | Duplicate a component (and its children) as a sibling. |
| `group_components` | Wrap same-parent components in a new Box. |
| `ungroup_components` | Remove a container, promoting its children in place. |

Every mutating call rides sTUIdio's existing undo/redo history — Cmd/Ctrl+Z
in the browser tab undoes an agent's change exactly like a human edit.

### Dry runs

`add_component`, `update_props`, `update_layout`, `move_component`,
`remove_component`, `duplicate_component`, `group_components`,
`ungroup_components`, and `apply_template` all accept an optional
`dryRun: true`. When set, the tool computes the change and returns a
unified diff of the would-be tree — the same shape a code-editing tool
shows before writing a file — without committing anything. Nothing is
written to the store, no undo/redo entry is created, and a human watching
the tab sees no change. Use this before a risky mutation (removing a
subtree, restyling broadly) to preview the effect first.

### Diagnosing a failed connection

If tool calls are failing and you're not sure why, call
`get_bridge_status` first — it works even when nothing is connected. It
reports the last transport-level error (e.g. `EADDRINUSE` if another
mcp-server instance already holds the port, or `NOT_CONNECTED` if no
browser tab has enabled Agent Bridge yet), which is exactly what would have
made an earlier real incident (an unhandled port collision that crashed the
whole MCP connection — see `todo.md`) self-diagnosable from inside the
conversation instead of needing `claude mcp list` from a shell.

## Limitations (Phase 1)

- One bridged browser tab at a time; connecting a second tab takes over
  from the first.
- No live push feed — an agent only sees human edits by calling `get_tree`
  again, not as they happen.
- If no tab is connected, every tool call fails fast with a clear error
  instead of hanging.
