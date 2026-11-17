import assert from 'node:assert/strict';
import {copyFileSync, mkdirSync, symlinkSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {test} from 'node:test';
import {loadPersonas, personaDir} from '../src/personas.js';
import {putPersona, tempHub, valid} from './helpers.js';

const HUB_CLAN = '/data/md/clan';

test('personaDir sits in the md hub', () => {
	assert.equal(personaDir('/data/clan'), '/data/md/clan');
});

test('a missing folder gives no personas', async () => {
	const {dir} = tempHub();
	assert.deepEqual(await loadPersonas(dir), {personas: [], skipped: []});
});

test('the starter files in the hub parse', async t => {
	const {dir} = tempHub();
	mkdirSync(dir, {recursive: true});
	try {
		for (const f of ['skeptic', 'pragmatist', 'dreamer']) copyFileSync(path.join(HUB_CLAN, `${f}.md`), path.join(dir, `${f}.md`));
	} catch {
		t.skip('no starter files in this hub');
		return;
	}
	const {personas, skipped} = await loadPersonas(dir);
	assert.deepEqual(skipped, []);
	assert.deepEqual(personas.map(p => [p.name, p.label, p.tier, p.colour, p.kind]), [
		['dreamer', 'Dreamer', 'light', 'violet', 'archetype'],
		['pragmatist', 'Pragmatist', 'light', 'orange', 'archetype'],
		['skeptic', 'Skeptic', 'light', 'teal', 'archetype'],
	]);
});

test('the label defaults to the capitalised name and a parody is marked', async () => {
	const {dir} = tempHub();
	putPersona(dir, 'sage', valid);
	putPersona(dir, 'duke', {...valid, kind: 'parody', label: 'The Duke'});
	const {personas} = await loadPersonas(dir);
	assert.deepEqual(personas.map(p => p.label), ['The Duke (parody)', 'Sage']);
});

test('invalid files are skipped with a reason and no content', async () => {
	const {dir} = tempHub();
	putPersona(dir, 'ok', valid);
	putPersona(dir, 'Bad_Name', valid);
	putPersona(dir, 'colourless', {...valid, colour: 'red'});
	putPersona(dir, 'tiers', {...valid, tier: 'huge'});
	putPersona(dir, 'kinds', {...valid, kind: 'other'});
	putPersona(dir, 'longlabel', {...valid, label: 'x'.repeat(41)});
	putPersona(dir, 'longtone', {...valid, tone: 'x'.repeat(201)});
	putPersona(dir, 'claude-fan', valid);
	putPersona(dir, 'labelled', {...valid, label: 'Anthropic Rep'});
	putPersona(dir, 'bodyless', valid, '');
	putPersona(dir, 'bigcard', valid, 'x'.repeat(8193));
	putPersona(dir, 'renamed', {...valid, name: 'other'});
	writeFileSync(path.join(dir, 'nofront.md'), 'just text');
	const {personas, skipped} = await loadPersonas(dir);
	assert.deepEqual(personas.map(p => p.name), ['ok']);
	assert.equal(skipped.length, 12);
	assert.ok(skipped.every(s => s.reason.length < 50 && !s.reason.includes('x'.repeat(10))));
});

test('a file over the size cap is skipped', async () => {
	const {dir} = tempHub();
	putPersona(dir, 'huge', valid, 'x'.repeat(17_000));
	const {personas, skipped} = await loadPersonas(dir);
	assert.equal(personas.length, 0);
	assert.deepEqual(skipped, [{file: 'huge.md', reason: 'file too large'}]);
});

test('a symlink is skipped, not followed', async () => {
	const {dir} = tempHub();
	putPersona(dir, 'real', valid);
	symlinkSync(path.join(dir, 'real.md'), path.join(dir, 'link.md'));
	const {personas, skipped} = await loadPersonas(dir);
	assert.deepEqual(personas.map(p => p.name), ['real']);
	assert.deepEqual(skipped, [{file: 'link.md', reason: 'not a regular file'}]);
});

test('files beyond 32 are skipped', async () => {
	const {dir} = tempHub();
	for (let i = 0; i < 34; i++) putPersona(dir, `p${String(i).padStart(2, '0')}`, valid);
	const {personas, skipped} = await loadPersonas(dir);
	assert.equal(personas.length, 32);
	assert.equal(skipped.length, 2);
});
