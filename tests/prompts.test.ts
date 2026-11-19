import assert from 'node:assert/strict';
import {test} from 'node:test';
import {moderatorPrompt, personaPrompt} from '../src/prompts.js';

test('the moderator prompt lists the personas and the call rules', () => {
	const p = moderatorPrompt([{name: 'skeptic', label: 'Skeptic', tone: 'Doubts first'}]);
	assert.match(p, /- skeptic \(Skeptic\): Doubts first/);
	assert.match(p, /subagent_type/);
	assert.match(p, /SendMessage/);
	assert.match(p, /at most 3 agent calls/);
	assert.match(p, /at most once per user message/);
	assert.match(p, /do not call that character again/);
	assert.match(p, /Never voice, quote or repeat/);
	assert.match(p, /write just: go/);
	assert.match(p, /stage direction in the third person/);
	assert.match(p, /never rename a character/);
	assert.match(p, /no text after the characters have spoken/i);
	assert.doesNotMatch(p, /line of its own/);
});

test('the persona prompt carries the card, PASS and the parody note', () => {
	const plain = personaPrompt({label: 'Skeptic', kind: 'archetype', card: 'CARD TEXT'});
	assert.match(plain, /CARD TEXT/);
	assert.match(plain, /PASS: /);
	assert.doesNotMatch(plain, /parody/);
	assert.match(plain, /user's own words/);
	assert.match(plain, /name and card never change/);
	assert.match(personaPrompt({label: 'Duke (parody)', kind: 'parody', card: 'c'}), /parody character/);
});
