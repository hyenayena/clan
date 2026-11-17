import assert from 'node:assert/strict';
import {test} from 'node:test';
import type {CommandContext} from '../../../src/api.js';
import {createCommand} from '../src/commands.js';
import type {ChatProfile, ProfileSessionInfo} from '../src/deps/chat.js';
import {putPersona, tempHub, valid} from './helpers.js';

function setup(names: string[] = ['alpha', 'beta'], sessions: ProfileSessionInfo[] = []) {
	const hub = tempHub();
	for (const n of names) putPersona(hub.dir, n, valid);
	const opened: ChatProfile[] = [];
	const printed: string[] = [];
	let shown = 0;
	const resumed: string[] = [];
	const command = createCommand({
		dataDir: hub.dataDir,
		openChat: async p => void opened.push(p),
		profileSessions: async () => sessions,
		resumeChat: async id => void resumed.push(id),
	});
	const ctx = {print: (t: string) => printed.push(t), showHelp: () => shown++} as unknown as CommandContext;
	return {hub, command, ctx, opened, printed, resumed, shown: () => shown};
}

test('policies: start is denied to the assistant, personas is safe', () => {
	const {command} = setup();
	const sub = (n: string) => command.subcommands!.find(s => s.name === n)!;
	assert.equal(sub('start').agent, 'deny');
	assert.equal(sub('personas').agent, 'safe');
	assert.equal(sub('list').agent, 'safe');
	assert.deepEqual(sub('list').aliases, ['ls']);
	assert.equal(sub('resume').agent, 'deny');
});

test('no subcommand shows help, or prints the usage without showHelp', async () => {
	const s = setup();
	await s.command.run([], s.ctx);
	assert.equal(s.shown(), 1);
	await s.command.run([], {print: (t: string) => s.printed.push(t)} as unknown as CommandContext);
	assert.deepEqual(s.printed, ['clan <subcommand>']);
});

test('an unknown subcommand throws', async () => {
	const s = setup();
	await assert.rejects(async () => s.command.run(['nope'], s.ctx), /Unknown subcommand: nope/);
});

test('start with no names opens a chat with every persona', async () => {
	const s = setup();
	await s.command.run(['start'], s.ctx);
	assert.equal(s.opened.length, 1);
	assert.deepEqual(Object.keys(s.opened[0]!.agents), ['alpha', 'beta']);
});

test('start with chosen names opens only those', async () => {
	const s = setup();
	await s.command.run(['start', 'beta', 'beta'], s.ctx);
	assert.deepEqual(Object.keys(s.opened[0]!.agents), ['beta']);
});

test('start with an unknown name is an invalid error', async () => {
	const s = setup();
	await assert.rejects(
		async () => s.command.run(['start', 'zed'], s.ctx),
		(err: Error & {kind?: string}) => err.kind === 'invalid' && /Unknown persona: zed/.test(err.message),
	);
	assert.equal(s.opened.length, 0);
});

test('start with more than 6 personas is a usage error', async () => {
	const names = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
	const s = setup(names);
	await assert.rejects(
		async () => s.command.run(['start', ...names], s.ctx),
		(err: Error & {kind?: string}) => err.kind === 'usage',
	);
	await assert.rejects(async () => s.command.run(['start'], s.ctx), (err: Error & {kind?: string}) => err.kind === 'usage');
});

test('start with an empty or missing folder names the folder', async () => {
	const s = setup([]);
	await assert.rejects(async () => s.command.run(['start'], s.ctx), new RegExp(`No personas in ${s.hub.dir}; add <name>.md files there`));
});

test('personas lists the table and the skipped files', async () => {
	const s = setup(['alpha']);
	putPersona(s.hub.dir, 'bad', {...valid, colour: 'red'});
	await s.command.run(['personas'], s.ctx);
	const out = s.printed.join('\n');
	assert.match(out, new RegExp(`Folder: ${s.hub.dir}`));
	assert.match(out, /alpha\s+Alpha\s+light\s+teal\s+archetype/);
	assert.match(out, /bad\.md\s+invalid colour/);
	assert.equal(s.opened.length, 0);
});

const info = (sessionId: string, lastAt: number, args = ['alpha'], title = 'Some title'): ProfileSessionInfo => ({sessionId, title, startedAt: 1, lastAt, args});
const kindOf = (kind: string, re: RegExp) => (err: Error & {kind?: string}) => err.kind === kind && re.test(err.message);

test('list prints the empty hint, or a table of id8, title, last activity and personas (ls too)', async () => {
	const empty = setup();
	await empty.command.run(['list'], empty.ctx);
	assert.deepEqual(empty.printed, ['No clan sessions yet; start one with "clan start"']);
	const s = setup(['alpha'], [info('11111111-aaaa', Date.UTC(2026, 10, 17, 9, 5), ['alpha', 'beta'], 'Line one\nline two')]);
	const blocks: unknown[] = [];
	const ctx = {print: () => {}, printStyled: (b: unknown) => blocks.push(b)} as unknown as CommandContext;
	await s.command.run(['ls'], ctx);
	assert.deepEqual(blocks, [[{kind: 'table', head: ['Session', 'Title', 'Last', 'Personas'], rows: [['11111111', 'Line one line two', '2026-11-17 09:05', 'alpha, beta']]}]]);
	await assert.rejects(async () => s.command.run(['list', 'x'], s.ctx), kindOf('usage', /Usage: clan list/));
});

test('resume with no id takes the newest, or fails when there is none', async () => {
	const s = setup(['alpha'], [info('aaaaaaaa-1', 20), info('bbbbbbbb-2', 10)]);
	await s.command.run(['resume'], s.ctx);
	assert.deepEqual(s.resumed, ['aaaaaaaa-1']);
	const none = setup();
	await assert.rejects(async () => none.command.run(['resume'], none.ctx), kindOf('not-found', /No clan sessions yet/));
});

test('resume takes a full id or a prefix of at least 8 characters; unknown and ambiguous ones fail with a kind', async () => {
	const s = setup(['alpha'], [info('aaaaaaaa-1', 20), info('aaaaaaaa-2', 10), info('bbbbbbbb-3', 5)]);
	await s.command.run(['resume', 'bbbbbbbb'], s.ctx);
	await s.command.run(['resume', 'aaaaaaaa-2'], s.ctx);
	assert.deepEqual(s.resumed, ['bbbbbbbb-3', 'aaaaaaaa-2']);
	await assert.rejects(async () => s.command.run(['resume', 'aaaaaaaa'], s.ctx), kindOf('usage', /matches 2 clan sessions/));
	await assert.rejects(async () => s.command.run(['resume', 'cccccccc'], s.ctx), kindOf('not-found', /No clan session matches/));
	await assert.rejects(async () => s.command.run(['resume', 'aaa'], s.ctx), kindOf('usage', /at least 8 characters/));
	await assert.rejects(async () => s.command.run(['resume', 'a', 'b'], s.ctx), kindOf('usage', /Usage: clan resume/));
	assert.equal(s.resumed.length, 2);
});
