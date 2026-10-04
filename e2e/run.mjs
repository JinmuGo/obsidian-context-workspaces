#!/usr/bin/env node
// End-to-end checks for reported issues, run against a real Obsidian install.
//
//   pnpm test:e2e                       # all scenarios, current working tree
//   pnpm test:e2e issue-22              # one scenario
//   pnpm test:e2e issue-22 --ref main   # build a git ref instead, e.g. to reproduce a bug
//   pnpm test:e2e --keep                # keep the temporary vaults for inspection
//
// Requires macOS with Obsidian installed (override with OBSIDIAN_BIN).

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runScenario } from './lib/obsidian.mjs';
import issue18 from './scenarios/issue-18.mjs';
import issue22 from './scenarios/issue-22.mjs';
import issue23 from './scenarios/issue-23.mjs';

const SCENARIOS = [issue18, issue22, issue23];
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function parseArgs(argv) {
	const args = { ids: [], ref: null, keep: false };
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		if (arg === '--ref') {
			args.ref = argv[++i];
		} else if (arg === '--keep') {
			args.keep = true;
		} else {
			args.ids.push(arg);
		}
	}
	return args;
}

function run(command, args, cwd) {
	execFileSync(command, args, { cwd, stdio: ['ignore', 'ignore', 'inherit'] });
}

/** Build the plugin and return the directory holding main.js, manifest.json and styles.css. */
function buildPlugin(ref) {
	if (!ref) {
		console.log('Building the working tree');
		run('pnpm', ['prod'], repoRoot);
		return { dir: repoRoot, cleanup: () => undefined };
	}

	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cw-e2e-build-'));
	console.log(`Building ${ref}`);
	run('git', ['worktree', 'add', '--detach', dir, ref], repoRoot);
	try {
		run('pnpm', ['install', '--frozen-lockfile', '--prefer-offline', '--ignore-scripts'], dir);
		run('pnpm', ['prod'], dir);
	} catch (error) {
		run('git', ['worktree', 'remove', '--force', dir], repoRoot);
		throw error;
	}
	return { dir, cleanup: () => run('git', ['worktree', 'remove', '--force', dir], repoRoot) };
}

const args = parseArgs(process.argv.slice(2));
const unknown = args.ids.filter((id) => !SCENARIOS.some((s) => s.id === id));
if (unknown.length > 0) {
	console.error(`Unknown scenario: ${unknown.join(', ')}. Known: ${SCENARIOS.map((s) => s.id).join(', ')}`);
	process.exit(2);
}
const selected = args.ids.length > 0 ? SCENARIOS.filter((s) => args.ids.includes(s.id)) : SCENARIOS;

const build = buildPlugin(args.ref);
let failed = 0;
try {
	for (const scenario of selected) {
		const results = await runScenario(scenario, build.dir, { keep: args.keep });
		failed += results.filter((result) => !result.passed).length;
	}
} finally {
	build.cleanup();
}

console.log(failed === 0 ? '\nAll checks passed' : `\n${failed} check(s) failed`);
process.exit(failed === 0 ? 0 : 1);
