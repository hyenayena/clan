import assert from 'node:assert/strict';
import {test} from 'node:test';
import {checkProfile, PROFILE_TONES} from '../src/deps/chat.js';
import {buildFromArgs, buildProfile} from '../src/profile.js';
import {putPersona, tempHub, valid} from './helpers.js';
import type {Persona} from '../src/personas.js';

const persona = (name: string, colour: Persona['colour']): Persona => ({
	name,
	label: name.toUpperCase(),
	tone: `${name} tone`,
	tier: 'light',
	colour,
	kind: 'archetype',
	card: `${name} card`,
});

test('the profile passes the chat module check', () => {
	const profile = buildProfile([persona('skeptic', 'teal'), persona('dreamer', 'violet')]);
	const checked = checkProfile(profile);
	assert.equal(checked.id, 'clan');
	assert.deepEqual(Object.keys(checked.agents), ['skeptic', 'dreamer']);
	assert.deepEqual(checked.mainTools, ['Agent', 'SendMessage']);
	assert.equal(checked.passWord, 'PASS');
	assert.equal(checked.loadInstructions, false);
	assert.equal(checked.noun, 'clan');
	assert.equal(checked.mainText, 'direction');
	assert.equal(checked.agentInput, 'turn');
});

test('agents carry the label, colour, tier and card', () => {
	const {agents} = buildProfile([persona('skeptic', 'teal')]);
	assert.equal(agents.skeptic!.label, 'SKEPTIC');
	assert.equal(agents.skeptic!.tone, 'teal');
	assert.equal(agents.skeptic!.description, 'skeptic tone');
	assert.match(agents.skeptic!.prompt, /skeptic card/);
});

test('every colour name is known to chat', () => {
	for (const colour of Object.keys(PROFILE_TONES) as Persona['colour'][]) {
		checkProfile(buildProfile([persona('a', colour)]));
	}
});

test('the profile carries the persona names as args', () => {
	assert.deepEqual(checkProfile(buildProfile([persona('skeptic', 'teal'), persona('dreamer', 'violet')])).args, ['skeptic', 'dreamer']);
});

test('buildFromArgs loads exactly the named personas, in the given order', async () => {
	const hub = tempHub();
	for (const n of ['alpha', 'beta', 'gamma']) putPersona(hub.dir, n, valid);
	const profile = await buildFromArgs(hub.dataDir, ['gamma', 'alpha']);
	assert.deepEqual(Object.keys(profile.agents), ['gamma', 'alpha']);
	assert.deepEqual(profile.args, ['gamma', 'alpha']);
});

test('buildFromArgs names a persona that is gone', async () => {
	const hub = tempHub();
	putPersona(hub.dir, 'alpha', valid);
	await assert.rejects(buildFromArgs(hub.dataDir, ['alpha', 'zed']), new RegExp(`Persona "zed" of this session is missing in ${hub.dir}`));
});
