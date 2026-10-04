# AGENTS.md

This file provides guidance to coding agents when working with code in this repository.

## Project Overview

Context Workspaces is an Obsidian plugin that extends Obsidian's built-in Workspace functionality to provide a fast and intuitive context switching experience. The plugin provides bidirectional synchronization with Obsidian's internal Workspace API, allowing seamless integration with existing workspaces.

## GitHub Language

- Write all public GitHub text in English. This includes commit titles and messages, pull request titles and bodies, issue comments, review comments, and release notes.
- Apply this rule regardless of the language used in the conversation or task request.

## Build Commands

### Development
```bash
pnpm dev              # Watch mode with hot reload
```

### Production Build
```bash
pnpm build            # Type check + production build
pnpm prod             # Production build only (no type check)
```

### Code Quality
```bash
pnpm lint             # Run Biome linter
pnpm lint:fix         # Run linter with auto-fix
pnpm format           # Format code with Biome
pnpm check            # Run all checks (lint + format)
pnpm check:fix        # Run all checks with auto-fix
```

### Testing
```bash
pnpm test             # Run all tests
pnpm test:watch       # Run tests in watch mode
pnpm test:coverage    # Run tests with coverage report
pnpm test:e2e         # Run issue scenarios in a real Obsidian (macOS)
```

## Development Setup

This plugin must be developed inside an Obsidian vault's `.obsidian/plugins/` directory:

```bash
cd /path/to/your/vault/.obsidian/plugins/
git clone https://github.com/jinmugo/obsidian-context-workspaces.git context-workspaces
cd context-workspaces
pnpm install
pnpm dev
```

Reload the plugin in Obsidian to see changes.

## Architecture

### Core Plugin Pattern

The main plugin class (`ContextWorkspacesPlugin` in `src/main.ts`) follows Obsidian's standard plugin lifecycle:
- `onload()`: Initialize sidebar, register events, add commands, setup workspace sync
- `onunload()`: Save state, restore theme, cleanup resources

### Workspace Synchronization

Spaces live in this plugin's `data.json`; layouts live in Obsidian's `workspaces.json`. Both files may be replaced by a sync tool (Syncthing, Obsidian Sync) at any time, so the plugin only acts on explicit events, never on the absence of a workspace:

1. **Obsidian → Context Workspaces**: Workspaces without a space are imported on load and when saved under a new name in Obsidian's UI (`importObsidianWorkspaces()` in `src/utils/sync-utils.ts`)
2. **Context Workspaces → Obsidian**: Creating a space creates its workspace. A space whose workspace is missing gets one from the current layout only when the user switches to it on desktop
3. **External file changes**: `onExternalSettingsChange()` reloads `data.json` (keeping this device's current space), and `setupWorkspaceRegistryMonitoring()` reloads `workspaces.json` into Obsidian's in-memory registry so the next save does not revert another device's changes
4. **Deletion**: A space is removed only when the user deletes it in the plugin or deletes its workspace in Obsidian's UI. Deletions on other devices arrive through `data.json`
5. **Mobile**: Read-only. Mobile loads layouts but never saves or creates them, so mobile tabs cannot overwrite shared desktop layouts

### State Management

Spaces are stored in plugin settings with the following structure:
- `spaces`: Record of space configurations (name, icon, autoSave, theme, themeMode, description)
- `spaceOrder`: Array defining display order for DnD support
- `currentSpaceId`: Currently active space

### Auto-Save vs Snapshot Mode

Each space has an `autoSave` flag:
- **Auto-Save Mode** (`autoSave: true`): Automatically saves/restores state on space switch
- **Snapshot Mode** (`autoSave: false`): Manual save/load (default Obsidian behavior)

### Theme Management

Spaces support per-space theme settings:
- Theme backup/restore system preserves original Obsidian theme
- Themes are applied/restored during space switches
- Fallback to original theme on errors or unload

### React Components

UI components are in `src/components/`:
- `SidebarManager.tsx`: Main sidebar with drag-and-drop space reordering
- `SpaceCreateModal.tsx`: Space creation dialog with emoji picker
- `SpaceEditModal.tsx`: Space editing dialog
- `SpaceManagerModal.tsx`: Bulk space management interface
- `ContextWorkspacesSettingTab.tsx`: Plugin settings tab
- `DndProvider.tsx`: Drag-and-drop context wrapper using @dnd-kit

### Utilities Organization

`src/utils/` contains modular utility functions:
- `obsidian-utils.ts`: Obsidian API interactions (workspace CRUD, theme management)
- `sync-utils.ts`: One-way import of Obsidian workspaces as spaces
- `space-utils.ts`: Space manipulation (search, ID generation, parsing)
- `error-handling.ts`: Error handling utilities
- `validation.ts`: Input validation
- `performance-monitor.ts`: Performance tracking
- `memory-management.ts`: Memory optimization

### Event Handling

Key event listeners:
- `layout-change`: Auto-save current space (debounced 500ms)
- `file-open`: Currently unused (auto-connection feature removed)

### Workspace Load Monitoring

`setupWorkspaceLoadMonitoring()` in `obsidian-utils.ts` patches Obsidian's `loadWorkspace` method to auto-switch Context Spaces when workspaces are loaded via Obsidian's native interface. `setupWorkspaceRegistryMonitoring()` patches `saveWorkspace`/`deleteWorkspace` to report native workspace creation and deletion, and adds `onExternalSettingsChange` to the workspaces plugin.

## Type Safety

- TypeScript strict mode enabled (`noImplicitAny`, `strictNullChecks`)
- Never use `any` type - create proper type interfaces
- Core types defined in `src/types/index.ts`:
  - `SpaceConfig`: Space configuration
  - `ContextWorkspacesSettings`: Plugin settings
  - `WorkspacesInstance`: Obsidian workspace API interface
  - `ThemeMode`: 'light' | 'dark' | 'system'

## Code Style

Enforced by Biome (see `biome.json`):
- Tabs for indentation (width: 4)
- Single quotes for strings
- Semicolons required
- Line width: 100 characters
- ES5 trailing commas

Git hooks (lefthook):
- Pre-commit: lint, type check, run tests

## Testing

- Jest with ts-jest preset
- JSDOM environment for React component testing
- Obsidian API mocked in `tests/mocks/obsidian.ts`
- Test files: `tests/*.test.ts`

### End-to-End Issue Scenarios

`e2e/` runs one scenario per reported issue against the installed Obsidian app. Each scenario starts a separate Obsidian instance with its own `--user-data-dir` and a temporary vault, so the user's Obsidian profile and vaults are never touched. The newest app package (`obsidian-*.asar`) is copied from `~/Library/Application Support/obsidian` so the test uses the user's Obsidian version.

```bash
pnpm test:e2e                                   # all scenarios, working tree build
pnpm test:e2e issue-22                          # one scenario
pnpm test:e2e issue-22 --ref origin/main        # build a git ref, e.g. to reproduce the bug
pnpm test:e2e --keep                            # keep temporary vaults for inspection
```

- Scenarios live in `e2e/scenarios/issue-<number>.mjs` and export `{ id, title, vault, run(ctx) }`
- `ctx` drives Obsidian over the Chrome DevTools Protocol: `eval`, `switchToSpace`, `openPluginSettings`, `deliver` (write a file the way a sync tool does), `emulateMobile`, `check`
- A scenario fails on the buggy build and passes on the fix. Run it with `--ref` against both before opening a PR
- Set `OBSIDIAN_BIN` to use another Obsidian binary

## Common Patterns

### Accessing Obsidian Internal APIs

The plugin accesses Obsidian's internal Workspace API (not officially documented):

```typescript
// @ts-expect-error - Obsidian internal API access
const workspaces = app.internalPlugins.plugins.workspaces;
```

### Debounced Operations

Many operations use setTimeout with delays to prevent race conditions:
- Sidebar updates: 50ms delay
- Layout changes: 500ms debounce

### Safe Error Handling

Critical operations wrap theme/workspace changes with try-catch and restore original state on failure.

### Sync Safety

A workspace missing from the registry usually means `workspaces.json` has not arrived from another device yet. Never delete a space or recreate its layout from the screen because of that absence (#18, #22).
