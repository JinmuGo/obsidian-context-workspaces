# Context Workspaces

**A workspace toolkit to build focused, clutter-free zones for every task**

Context Workspaces extends Obsidian's built-in Workspace functionality to provide a fast and intuitive context switching experience similar to Arc browser.

## Quick Demo
 
https://github.com/user-attachments/assets/3e9b9ffa-e861-431d-88f4-cbb306b79c4f

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
- **Import Existing Workspaces**: Automatically imports existing Obsidian workspaces as spaces
- **Auto-switch on Workspace Load**: Automatically switch to corresponding Context Space when using Obsidian's `loadWorkspace` API

## Installation

### Manual Installation

1. Download the latest release from the releases page
2. Copy `main.js`, `manifest.json`, `styles.css` files to your Obsidian vault's `.obsidian/plugins/context-workspaces/` folder
3. Enable Context Workspaces in Obsidian under Community plugins

### BRAT Installation (Beta Testing)

1. Install the [BRAT plugin](https://github.com/TfTHacker/obsidian42-brat) in Obsidian
2. Go to **Settings > Community plugins > Beta plugin list**
3. Add this repository: `jinmugo/obsidian-context-workspaces`
4. Enable Context Workspaces in the Community plugins list

### Development Installation

```bash
cd /path/to/your/vault/.obsidian/plugins/
git clone https://github.com/jinmugo/obsidian-context-workspaces.git context-workspaces
cd context-workspaces
pnpm install
pnpm build
```

## Usage

### Basic Usage

1. **Switch Spaces**: Click or double-click space icons in the sidebar
2. **Create New Space**: Run "Create New Space" from command palette
3. **Keyboard Shortcuts**: Set shortcuts for "Switch to Next Space", "Switch to Previous Space" commands

### Space Mode Settings

- Toggle auto-save mode for each space in **Settings > Context Workspaces**
- **Auto-save ON**: Automatically saves and restores current state when switching spaces
- **Auto-save OFF**: Default Workspace behavior (manual save/load)

### Theme Settings

- Set theme and mode for each space in **Space Edit**
- **Theme**: Choose from all available Obsidian themes
- **Mode**: Choose Light, Dark, or System mode
- Theme and mode are automatically applied when switching spaces

## Commands

- `Switch to Next Space`: Switch to next space in the list
- `Switch to Previous Space`: Switch to previous space in the list
- `Create New Space`: Create new workspace
- `Manage Spaces`: Manage space list and settings
- `Edit Current Space`: Edit settings for current active space

### Recommended Keyboard Shortcuts

```text
Switch to Next Space: Ctrl + Tab (or Cmd + Option + →)
Switch to Previous Space: Ctrl + Shift + Tab (or Cmd + Option + ←)
Create New Space: Ctrl + Shift + N
```

## Contributing

Contributions are welcome! You can participate in the following ways:

- **Bug Reports**: Report issues on GitHub
- **Feature Requests**: Suggest new features
- **Code Contributions**: Submit pull requests
- **Documentation**: Help improve documentation
