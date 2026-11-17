import assert from 'node:assert/strict';
import {test} from 'node:test';
import type {PluginHost} from '../../../src/api.js';
import {registerChatProfile} from '../src/deps/chat.js';
import plugin from '../src/index.js';

const host = (): PluginHost => ({
	dataDir: '/nonexistent/clan',
	events: {emit() {}, on: () => () => {}},
	log: undefined as never,
});

test('registers the clan command with its subcommands', async () => {
	const commands = await plugin(host());
	assert.deepEqual(commands.map(c => c.name), ['clan']);
	assert.deepEqual(commands[0]!.subcommands!.map(s => s.name), ['start', 'list', 'resume', 'personas']);
});

test('registers the clan profile source with chat: the id is taken afterwards', async () => {
	await plugin(host());
	assert.equal(registerChatProfile({id: 'clan', owner: 'clan', build: async () => ({}) as never}), undefined);
});
