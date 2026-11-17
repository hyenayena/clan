import {mkdirSync, mkdtempSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';

export type TempHub = {dataDir: string; dir: string};

// dataDir is <root>/clan, so the hub is <root>/md and the persona folder <root>/md/clan.
export function tempHub(): TempHub {
	const root = mkdtempSync(path.join(tmpdir(), 'clan-test-'));
	const dataDir = path.join(root, 'clan');
	mkdirSync(dataDir);
	return {dataDir, dir: path.join(root, 'md', 'clan')};
}

export function putPersona(dir: string, name: string, fields: Record<string, string>, body = 'You are a test character.'): void {
	mkdirSync(dir, {recursive: true});
	const head = Object.entries(fields).map(([k, v]) => `${k}: ${v}`).join('\n');
	writeFileSync(path.join(dir, `${name}.md`), `---\n${head}\n---\n\n${body}\n`);
}

export const valid = {tone: 'Calm and brief', tier: 'light', colour: 'teal', kind: 'archetype'};
