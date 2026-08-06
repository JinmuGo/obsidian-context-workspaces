# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Context Workspaces is an Obsidian plugin that extends Obsidian's built-in Workspace functionality to provide a fast and intuitive context switching experience. The plugin provides bidirectional synchronization with Obsidian's internal Workspace API, allowing seamless integration with existing workspaces.

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

### Bidirectional Workspace Synchronization

The plugin maintains two-way sync between Context Workspaces and Obsidian's internal Workspace API:

1. **Obsidian → Context Workspaces**: Import existing workspaces as spaces on initialization
2. **Context Workspaces → Obsidian**: Create Obsidian workspaces when new spaces are created
3. **Change Detection**: Monitor workspace changes via `workspace-changed` event (debounced to 1 second)
4. **Deletion Detection**: Delete spaces immediately when a trusted registry snapshot shows their workspace is gone (see "Deletion Detection Safety")

Key synchronization utilities in `src/utils/sync-utils.ts`:
- `performBidirectionalSync()`: Handles two-way sync with conflict resolution
- `safeBidirectionalSync()`: Wrapper with error handling
- `needsSync()`: Determines if sync is needed

### State Management

Spaces are stored in plugin settings with the following structure:
- `spaces`: Record of space configurations (name, icon, autoSave, theme, themeMode, description)
- `spaceOrder`: Array defining display order for DnD support
- `currentSpaceId`: Currently active space
- `workspaceLastSeen`: Marks workspaces previously observed in Obsidian (deletion eligibility; also prevents sync from resurrecting deleted workspaces)

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
- `sync-utils.ts`: Bidirectional synchronization logic
- `space-utils.ts`: Space manipulation (search, ID generation, parsing)
- `deletion-detection-utils.ts`: Workspace deletion detection with safety checks
- `error-handling.ts`: Error handling utilities
- `validation.ts`: Input validation
- `performance-monitor.ts`: Performance tracking
- `memory-management.ts`: Memory optimization

### Event Handling

Key event listeners:
- `layout-change`: Auto-save current space (debounced 500ms)
- `workspace-changed`: Detect workspace additions/deletions (debounced 1s)
- `file-open`: Currently unused (auto-connection feature removed)

### Workspace Load Monitoring

`setupWorkspaceLoadMonitoring()` in `obsidian-utils.ts` patches Obsidian's `loadWorkspace` method to auto-switch Context Spaces when workspaces are loaded via Obsidian's native interface.

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
- Workspace changes: 1000ms debounce

### Safe Error Handling

Critical operations wrap theme/workspace changes with try-catch and restore original state on failure.

### Deletion Detection Safety

Deletions are applied immediately, but only from a trusted registry snapshot (`WorkspaceRegistrySnapshot` in `src/types/index.ts`):
1. Registry status must be `available` — `unavailable` (read failure) or `empty` registries abort all deletion and sync work
2. Anchor check: at least one previously observed workspace must be present, otherwise the snapshot is indistinguishable from a registry wipe and is ignored
3. Only spaces with a prior trusted observation (`workspaceLastSeen`) are deletion candidates — newly created spaces that were never seen in Obsidian are creation candidates for sync instead
4. Sync never recreates an Obsidian workspace for a space that has history but is missing (prevents resurrecting deleted workspaces)
5. Special handling for current workspace deletion (switch to a surviving space)
