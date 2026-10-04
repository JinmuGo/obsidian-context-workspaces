// Launches a throwaway Obsidian instance on a throwaway vault and drives it over CDP.
// Nothing touches the user's own Obsidian profile or vaults: the instance gets its own
// --user-data-dir, and only the newest app package is copied from the user's profile so
// the test runs on the same Obsidian version the user has.

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { listPages, Page } from './cdp.mjs';

const PLUGIN_ID = 'context-workspaces';
const OBSIDIAN_BIN =
	process.env.OBSIDIAN_BIN ?? '/Applications/Obsidian.app/Contents/MacOS/Obsidian';
const OBSIDIAN_USER_DATA =
	process.env.OBSIDIAN_USER_DATA ??
	path.join(os.homedir(), 'Library', 'Application Support', 'obsidian');

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitFor(read, { timeout = 15000, interval = 250, label = 'condition' } = {}) {
	const deadline = Date.now() + timeout;
	let lastError;
	while (Date.now() < deadline) {
		try {
			const value = await read();
			if (value) {
				return value;
			}
		} catch (error) {
			lastError = error;
		}
		await sleep(interval);
	}
	throw new Error(`Timed out waiting for ${label}${lastError ? `: ${lastError.message}` : ''}`);
}

async function freePort() {
	return new Promise((resolve, reject) => {
		const server = net.createServer();
		server.listen(0, '127.0.0.1', () => {
			const { port } = server.address();
			server.close(() => resolve(port));
		});
		server.on('error', reject);
	});
}

function newestAppPackage() {
	if (!fs.existsSync(OBSIDIAN_USER_DATA)) {
		return null;
	}
	const packages = fs
		.readdirSync(OBSIDIAN_USER_DATA)
		.filter((name) => /^obsidian-[\d.]+\.asar$/.test(name))
		.sort((a, b) =>
			a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
		);
	return packages.length > 0 ? path.join(OBSIDIAN_USER_DATA, packages.at(-1)) : null;
}

export const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const writeJson = (file, value) => {
	fs.mkdirSync(path.dirname(file), { recursive: true });
	fs.writeFileSync(file, JSON.stringify(value, null, 2));
};

/** A layout with one markdown tab, the shape Obsidian stores in workspaces.json. */
export function layoutWithFile(file) {
	const id = file.replace(/\W/g, '');
	return {
		main: {
			id: `main-${id}`,
			type: 'split',
			direction: 'vertical',
			children: [
				{
					id: `tabs-${id}`,
					type: 'tabs',
					children: [
						{
							id: `leaf-${id}`,
							type: 'leaf',
							state: { type: 'markdown', state: { file, mode: 'source' } },
						},
					],
				},
			],
		},
		active: `leaf-${id}`,
	};
}

/** Files open in a stored layout, e.g. ['A.md', 'note.md']. */
export function filesInLayout(layout) {
	return [...JSON.stringify(layout ?? {}).matchAll(/"file":"([^"]+)"/g)].map((m) => m[1]);
}

/**
 * Create a vault.
 * spec: { notes, workspaces, activeWorkspace, settings, appearance, themes }
 */
function createVault(root, pluginBuildDir, spec) {
	const vault = path.join(root, 'vault');
	const configDir = path.join(vault, '.obsidian');
	const pluginDir = path.join(configDir, 'plugins', PLUGIN_ID);
	fs.mkdirSync(pluginDir, { recursive: true });

	for (const note of spec.notes ?? []) {
		fs.writeFileSync(path.join(vault, note), `# ${note}\n`);
	}
	writeJson(path.join(configDir, 'community-plugins.json'), [PLUGIN_ID]);
	writeJson(path.join(configDir, 'core-plugins.json'), { workspaces: true, 'file-explorer': true });
	writeJson(path.join(configDir, 'appearance.json'), spec.appearance ?? { theme: 'moonstone' });
	writeJson(path.join(configDir, 'workspaces.json'), {
		workspaces: spec.workspaces ?? {},
		active: spec.activeWorkspace ?? '',
	});
	for (const [name, css] of Object.entries(spec.themes ?? {})) {
		const themeDir = path.join(configDir, 'themes', name);
		writeJson(path.join(themeDir, 'manifest.json'), {
			name,
			version: '1.0.0',
			minAppVersion: '0.16.0',
			author: 'e2e',
		});
		fs.writeFileSync(path.join(themeDir, 'theme.css'), css);
	}
	writeJson(path.join(pluginDir, 'data.json'), spec.settings);
	for (const file of ['main.js', 'manifest.json', 'styles.css']) {
		fs.copyFileSync(path.join(pluginBuildDir, file), path.join(pluginDir, file));
	}
	return { vault, configDir, pluginDir };
}

/**
 * Run one scenario in a fresh Obsidian instance and return its check results.
 */
export async function runScenario(scenario, pluginBuildDir, { keep = false } = {}) {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), `cw-e2e-${scenario.id}-`));
	const paths = createVault(root, pluginBuildDir, scenario.vault);
	const userData = path.join(root, 'user-data');
	fs.mkdirSync(userData);
	const appPackage = newestAppPackage();
	if (appPackage) {
		fs.copyFileSync(appPackage, path.join(userData, path.basename(appPackage)));
	}
	writeJson(path.join(userData, 'obsidian.json'), {
		vaults: { e2evault000000001: { path: paths.vault, ts: Date.now(), open: true } },
	});

	const port = await freePort();
	const child = spawn(OBSIDIAN_BIN, [`--user-data-dir=${userData}`, `--remote-debugging-port=${port}`], {
		stdio: 'ignore',
		detached: true,
	});
	const pages = new Map();
	const results = [];

	const pageFor = async (matches, label) => {
		const target = await waitFor(
			async () => (await listPages(port)).find((t) => !t.url.startsWith('devtools') && matches(t)),
			{ label }
		);
		let page = pages.get(target.id);
		if (!page) {
			page = new Page(target);
			pages.set(target.id, page);
		}
		return page;
	};
	const mainPage = () =>
		pageFor((t) => t.url.startsWith('app://') && !t.title.startsWith('Settings'), 'main window');

	const ctx = {
		paths,
		sleep,
		readJson,
		filesInLayout,
		workspacesFile: path.join(paths.configDir, 'workspaces.json'),
		dataFile: path.join(paths.pluginDir, 'data.json'),
		appearanceFile: path.join(paths.configDir, 'appearance.json'),
		plugin: `app.plugins.plugins['${PLUGIN_ID}']`,
		registry: 'app.internalPlugins.plugins.workspaces.instance',

		check(label, passed, detail) {
			results.push({ label, passed: Boolean(passed), detail });
			const mark = passed ? 'PASS' : 'FAIL';
			console.log(`  ${mark}  ${label}${!passed && detail !== undefined ? `\n        ${JSON.stringify(detail)}` : ''}`);
		},
		async eval(expression) {
			return (await mainPage()).eval(expression);
		},
		mainPage,
		/** Settings open in a separate window by default; fall back to the main window. */
		async openPluginSettings() {
			await ctx.eval(`(async () => {
				app.setting.open();
				await new Promise((r) => setTimeout(r, 400));
				app.setting.openTabById('${PLUGIN_ID}');
			})()`);
			await sleep(600);
			const popout = (await listPages(port)).find((t) => t.title.startsWith('Settings'));
			return popout ? pageFor((t) => t.id === popout.id, 'settings window') : mainPage();
		},
		async closePluginSettings() {
			await ctx.eval('app.setting.close()');
			await sleep(300);
		},
		/** Write a file the way a sync tool does: temp file, then rename over the old one. */
		deliver(file, value) {
			const temp = path.join(path.dirname(file), `.syncthing.${path.basename(file)}.tmp`);
			fs.writeFileSync(temp, JSON.stringify(value, null, 2));
			fs.renameSync(temp, file);
		},
		async switchToSpace(spaceId) {
			const switched = await ctx.eval(`${ctx.plugin}.switchToSpace(${JSON.stringify(spaceId)})`);
			await sleep(800);
			return switched;
		},
		async openFileInNewTab(file) {
			await ctx.eval(`app.workspace.getLeaf(true).openFile(app.vault.getAbstractFileByPath(${JSON.stringify(file)}))`);
		},
		/** Reload the window in (or out of) Obsidian's mobile emulation. */
		async emulateMobile(enabled) {
			await ctx.eval(`app.emulateMobile(${enabled})`).catch(() => undefined);
			for (const page of pages.values()) page.close();
			pages.clear();
			await sleep(1500);
			await waitForPluginLoaded();
		},
	};

	const waitForPluginLoaded = () =>
		waitFor(() => ctx.eval(`Boolean(app.workspace.layoutReady && ${ctx.plugin})`), {
			timeout: 30000,
			label: 'plugin to load',
		});

	console.log(`\n${scenario.id}: ${scenario.title}`);
	try {
		await waitFor(() => ctx.eval('Boolean(window.app?.workspace?.layoutReady)'), {
			timeout: 30000,
			label: 'Obsidian to start',
		});
		await ctx.eval(`(async () => {
			await app.plugins.setEnable(true);
			await app.plugins.enablePluginAndSave('${PLUGIN_ID}');
		})()`);
		await waitForPluginLoaded();
		// Let startup work (initial sync, theme application) finish.
		await sleep(1500);
		await scenario.run(ctx);
	} catch (error) {
		ctx.check('scenario ran to completion', false, error.message);
	} finally {
		for (const page of pages.values()) page.close();
		try {
			process.kill(-child.pid, 'SIGTERM');
		} catch {
			// Already exited.
		}
		await sleep(1000);
		if (keep) {
			console.log(`  kept ${root}`);
		} else {
			fs.rmSync(root, { recursive: true, force: true });
		}
	}
	return results;
}
