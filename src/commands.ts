import type {Command, CommandContext, CommandErrorKind, StyledBlock} from '../../../src/api.js';
import type {ChatProfile, ProfileSessionInfo} from './deps/chat.js';
import {loadPersonas, personaDir, type LoadedPersonas} from './personas.js';
import {buildProfile} from './profile.js';

export const MAX_PERSONAS = 6;
const MIN_PREFIX = 8;
const LISTED = 100;
const NO_SESSIONS = 'No clan sessions yet; start one with "clan start"';

export type ClanDeps = {
	openChat: (profile: ChatProfile, ctx: CommandContext) => Promise<void>;
	profileSessions: (id: string, limit?: number) => Promise<ProfileSessionInfo[]>;
	resumeChat: (sessionId: string, ctx: CommandContext) => Promise<void>;
	dataDir: string;
	onSkipped?: (count: number) => void;
};

const fail = (kind: CommandErrorKind, message: string): Error => Object.assign(new Error(message), {kind});

async function load(deps: ClanDeps): Promise<{dir: string} & LoadedPersonas> {
	const dir = personaDir(deps.dataDir);
	const loaded = await loadPersonas(dir);
	if (loaded.skipped.length > 0) deps.onSkipped?.(loaded.skipped.length);
	return {dir, ...loaded};
}

async function start(names: string[], deps: ClanDeps, ctx: CommandContext): Promise<void> {
	const {dir, personas} = await load(deps);
	if (personas.length === 0) throw fail('invalid', `No personas in ${dir}; add <name>.md files there`);
	const chosen = [];
	if (names.length === 0) chosen.push(...personas);
	for (const name of new Set(names)) {
		const found = personas.find(p => p.name === name);
		if (!found) throw fail('invalid', `Unknown persona: ${name.slice(0, 64)}. Run "clan personas"`);
		chosen.push(found);
	}
	if (chosen.length > MAX_PERSONAS) {
		throw fail('usage', `A clan chat takes at most ${MAX_PERSONAS} personas; name them: clan start <persona>…`);
	}
	await deps.openChat(buildProfile(chosen), ctx);
}

const stamp = (at: number): string => new Date(at).toISOString().slice(0, 16).replace('T', ' ');
const oneLine = (text: string, max: number): string => {
	const flat = Array.from(text.replace(/\s+/gu, ' ').trim());
	return flat.length <= max ? flat.join('') : `${flat.slice(0, max - 1).join('')}…`;
};

async function list(deps: ClanDeps, ctx: CommandContext): Promise<void> {
	const sessions = await deps.profileSessions('clan', LISTED);
	if (sessions.length === 0) {
		ctx.print(NO_SESSIONS);
		return;
	}
	const rows = sessions.map(s => [s.sessionId.slice(0, 8), oneLine(s.title ?? '', 60), stamp(s.lastAt), s.args.join(', ')]);
	if (ctx.printStyled) ctx.printStyled([{kind: 'table', head: ['Session', 'Title', 'Last', 'Personas'], rows}]);
	else for (const row of rows) ctx.print(row.join('  '));
}

async function resume(wanted: string | undefined, deps: ClanDeps, ctx: CommandContext): Promise<void> {
	const sessions = await deps.profileSessions('clan', LISTED);
	if (wanted === undefined) {
		if (sessions.length === 0) throw fail('not-found', NO_SESSIONS);
		return deps.resumeChat(sessions[0]!.sessionId, ctx);
	}
	const exact = sessions.find(s => s.sessionId === wanted);
	if (exact) return deps.resumeChat(exact.sessionId, ctx);
	if (wanted.length < MIN_PREFIX) throw fail('usage', `Give at least ${MIN_PREFIX} characters of the session id; "clan list" shows them`);
	const matches = sessions.filter(s => s.sessionId.startsWith(wanted));
	if (matches.length === 0) throw fail('not-found', `No clan session matches "${wanted.slice(0, 64)}". See "clan list"`);
	if (matches.length > 1) throw fail('usage', `"${wanted.slice(0, 64)}" matches ${matches.length} clan sessions; type more of the id`);
	return deps.resumeChat(matches[0]!.sessionId, ctx);
}

async function personasList(deps: ClanDeps, ctx: CommandContext): Promise<void> {
	const {dir, personas, skipped} = await load(deps);
	const blocks: StyledBlock[] = [{kind: 'text', text: `Folder: ${dir}`}];
	if (personas.length === 0) blocks.push({kind: 'text', text: 'No personas; add <name>.md files there'});
	else {
		blocks.push({
			kind: 'table',
			head: ['Name', 'Label', 'Tier', 'Colour', 'Kind'],
			rows: personas.map(p => [p.name, p.label, p.tier, p.colour, p.kind]),
		});
	}
	if (skipped.length > 0) {
		blocks.push({kind: 'text', text: 'Skipped files:'});
		blocks.push({kind: 'table', head: ['File', 'Reason'], rows: skipped.map(s => [s.file.slice(0, 80), s.reason])});
	}
	if (ctx.printStyled) ctx.printStyled(blocks);
	else {
		for (const b of blocks) {
			if (b.kind === 'text') ctx.print(b.text);
			else if (b.kind === 'table') for (const row of b.rows) ctx.print(row.map(c => String(c)).join('  '));
		}
	}
}

export function createCommand(deps: ClanDeps): Command {
	return {
		name: 'clan',
		description: 'Talk with several personas: weigh a decision or just chat',
		usage: 'clan <subcommand>',
		args: [{name: 'subcommand', description: 'What to do; clan help lists them'}],
		notes: ['Personas are <name>.md files in the clan folder of the md hub.', 'Their lines come from Claude Code through yena\'s chat.'],
		agent: 'confirm',
		subcommands: [
			{
				name: 'start',
				usage: `clan start [persona]…`,
				description: 'Open a chat with the personas',
				agent: 'deny',
				args: [{name: 'persona', description: `Up to ${MAX_PERSONAS}; none means every persona`}],
			},
			{
				name: 'list',
				aliases: ['ls'],
				usage: 'clan list',
				description: 'List the earlier clan sessions',
				agent: 'safe',
			},
			{
				name: 'resume',
				usage: 'clan resume [session]',
				description: 'Reopen an earlier clan session',
				agent: 'deny',
				args: [{name: 'session', description: 'Id or at least 8 characters of it; without it, the newest'}],
			},
			{
				name: 'personas',
				usage: 'clan personas',
				description: 'List the personas and skipped files',
				agent: 'safe',
			},
		],
		run: async ([sub, ...rest], ctx) => {
			switch (sub) {
				case undefined:
					if (ctx.showHelp) ctx.showHelp();
					else ctx.print('clan <subcommand>');
					return;
				case 'start':
					return start(rest, deps, ctx);
				case 'list':
				case 'ls':
					if (rest.length > 0) throw fail('usage', 'Usage: clan list');
					return list(deps, ctx);
				case 'resume':
					if (rest.length > 1) throw fail('usage', 'Usage: clan resume [session]');
					return resume(rest[0], deps, ctx);
				case 'personas':
					return personasList(deps, ctx);
				default:
					throw new Error(`Unknown subcommand: ${sub.slice(0, 64)}. See "clan help"`);
			}
		},
	};
}
