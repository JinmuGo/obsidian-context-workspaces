# Context Spaces

**A workspace toolkit to build focused, clutter-free zones for every task**

Context Spaces extends Obsidian's built-in Workspace functionality to provide a fast and intuitive context switching experience similar to Arc browser.

## Key Features

### Auto Save/Restore Mode

- **Live Mode**: Automatically saves and restores current state when switching spaces
- **Snapshot Mode**: Default Workspace behavior, manual save/load

### Sidebar UI

- Shows your spaces as icons in a custom sidebar
- Double-click an icon to switch spaces
- Right-click for context menu (edit, toggle auto-save, delete)
- Previous/Next buttons for quick navigation

### Space-Specific Theme Settings

- Unique theme and mode settings for each space
- Automatically changes theme when switching spaces
- Light/Dark/System mode support
- Choose from all available Obsidian themes

### Drag & Drop Interface

- **Space reordering**: Drag and drop to reorder spaces

### Obsidian Workspace API Integration

- **Bidirectional Sync**: Automatic synchronization with Obsidian's built-in Workspace API
- **Real-time Updates**: Changes in Context Spaces are immediately reflected in Obsidian's workspace list
- **Import Existing Workspaces**: Automatically imports existing Obsidian workspaces as spaces
- **Consistent Naming**: Space names are synchronized with Obsidian workspace names
- **Automatic Cleanup**: Deleting a space also removes the corresponding Obsidian workspace
- **Auto-switch on Workspace Load**: Automatically switch to corresponding Context Space when using Obsidian's `loadWorkspace` API

## Installation

### Manual Installation

1. Download the latest release from the releases page
2. Copy `main.js`, `manifest.json`, `styles.css` files to your Obsidian vault's `.obsidian/plugins/context-workspaces/` folder
3. Enable Context Spaces in Obsidian under Community plugins

### BRAT Installation (Beta Testing)

For beta testing and early access to new features:

1. Install the [BRAT plugin](https://github.com/TfTHacker/obsidian42-brat) in Obsidian
2. Go to **Settings > Community plugins > Beta plugin list**
3. Add this repository: `jinmugo/obsidian-context-workspaces`
4. Enable Context Spaces in the Community plugins list
5. You'll automatically receive beta updates

### Development Installation

```bash
# Navigate to your vault's plugins folder
cd /path/to/your/vault/.obsidian/plugins/

# Clone the repository
git clone https://github.com/jinmugo/obsidian-context-workspaces.git context-workspaces

# Install dependencies and build
cd context-workspaces
pnpm install
pnpm run build
```

## Usage

### Basic Usage

1. **Switch Spaces**: Click or double-click space icons in the sidebar
2. **Create New Space**: Run "Create New Space" from command palette
3. **Keyboard Shortcuts**: Set shortcuts for "Switch to Next Space", "Switch to Previous Space" commands

### Space Mode Settings

- Toggle auto-save mode for each space in **Settings > Context Spaces**
- **Auto-save ON**: Automatically saves and restores current state when switching spaces
- **Auto-save OFF**: Default Workspace behavior (manual save/load)

### Theme Settings

- Set theme and mode for each space in **Space Edit**
- **Theme**: Choose from all available Obsidian themes
- **Mode**: Choose Light, Dark, or System mode
- Theme and mode are automatically applied when switching spaces

### Workspace API Integration

- **Automatic Sync**: All space operations (create, rename, delete) are automatically synchronized with Obsidian's built-in Workspace API
- **Import Existing Workspaces**: When you first install Context Spaces, existing Obsidian workspaces are automatically imported as spaces
- **Consistent Experience**: Changes made in Context Spaces appear immediately in Obsidian's workspace switcher
- **Bidirectional Updates**: Changes made in Obsidian's workspace manager are also reflected in Context Spaces
- **Automatic Workspace Integration**: Automatically switch to corresponding Context Space when using Obsidian's `loadWorkspace` API

## Settings

### General Settings

- **Automatic Workspace Integration**: Context Spaces automatically integrates with Obsidian's `loadWorkspace` API. When other plugins or scripts use Obsidian's workspace API, Context Spaces will automatically switch to the corresponding space.

### Commands

- `Switch to Next Space`: Switch to next space in the list
- `Switch to Previous Space`: Switch to previous space in the list
- `Create New Space`: Create new workspace
- `Manage Spaces`: Manage space list and settings
- `Edit Current Space`: Edit settings for current active space

### Recommended Keyboard Shortcuts

```
Switch to Next Space: Ctrl + Tab (or Cmd + Option + →)
Switch to Previous Space: Ctrl + Shift + Tab (or Cmd + Option + ←)
Create New Space: Ctrl + Shift + N
```

## Requirements

- Obsidian v0.15.0 or higher
- **Workspaces plugin must be enabled** (built-in Obsidian plugin)
- Node.js >= 24.4.1 (for development)

## Troubleshooting

### Common Issues

**Plugin not appearing in sidebar:**

- Ensure the Workspaces plugin is enabled in Obsidian settings
- Restart Obsidian after installation
- Check the console for any error messages

**Spaces not syncing with Obsidian workspaces:**

- Verify that the Workspaces plugin is enabled
- Try refreshing the plugin (disable and re-enable)
- Check if there are any conflicting plugins

**Theme not changing when switching spaces:**

- Ensure the theme specified in space settings is installed
- Check if the theme supports the selected mode (light/dark/system)

**Performance issues with many spaces:**

- Consider reducing the number of spaces
- Disable auto-save for spaces that don't need it
- Check if other plugins are causing conflicts

### Getting Help

- Check the [Issues page](https://github.com/jinmugo/obsidian-context-workspaces/issues) for known problems
- Create a new issue with detailed information about your problem
- Include your Obsidian version and any error messages from the console

## Development

### Prerequisites

- Node.js >= 24.4.1
- pnpm >= 10.13.1

### Tech Stack

- **React 18**: Modern UI components with hooks
- **@dnd-kit**: Modern drag and drop functionality
- **@emoji-mart**: Professional emoji picker
- **TypeScript**: Type-safe development
- **esbuild**: Fast bundling and development

### Setup

```bash
# Install dependencies
pnpm install

# Development mode with hot reload
pnpm dev

# Build for production
pnpm build

# Lint code
pnpm lint

# Fix linting issues
pnpm lint:fix

# Format code
pnpm format
```

### Git Hooks

This project uses [lefthook](https://github.com/evilmartians/lefthook) for Git hooks:

- **Pre-commit**: Automatically runs `biome lint --write` on staged files
- **Auto-fix**: Automatically stages fixed files after linting

The hooks are automatically installed when you run `pnpm install`.

## Contributing

Contributions are welcome! You can participate in the following ways:

- **Bug Reports**: Report issues on GitHub
- **Feature Requests**: Suggest new features
- **Code Contributions**: Submit pull requests
- **Documentation**: Help improve documentation

### Development Workflow

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes and ensure all tests pass
4. Commit your changes: `git commit -m 'Add amazing feature'`
5. Push to the branch: `git push origin feature/amazing-feature`
6. Open a Pull Request

### Code Quality

- All code must pass linting: `pnpm lint`
- All tests must pass: `pnpm test`
- TypeScript compilation must succeed: `pnpm build`
- Pre-commit hooks will automatically run these checks

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Inspired by Arc browser's space switching experience
- Built on top of Obsidian's excellent plugin system
- Thanks to the Obsidian community for feedback and suggestions
