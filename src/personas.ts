import {lstat, readdir, readFile} from 'node:fs/promises';
import path from 'node:path';
import {PROFILE_TONES, TIERS, type ProfileTone} from './deps/chat.js';
import {hubDirFor} from './deps/md.js';

export type Tier = (typeof TIERS)[number];
export type PersonaKind = 'archetype' | 'parody';

export type Persona = {
	name: string;
	label: string;
	tone: string;
	tier: Tier;
	colour: ProfileTone;
	kind: PersonaKind;
	card: string;
};

export type SkippedFile = {file: string; reason: string};
export type LoadedPersonas = {personas: Persona[]; skipped: SkippedFile[]};

export const PERSONA_LIMITS = {files: 32, fileBytes: 16_384, bodyBytes: 8192, label: 40, tone: 200} as const;

const NAME_RE = /^[a-z][a-z0-9-]{0,23}$/;
const FORBIDDEN_RE = /claude|anthropic/i;
const CONTROL_RE = new RegExp('[\\u0000-\\u001f\\u007f-\\u009f]');
const PARODY_SUFFIX = ' (parody)';

export const personaDir = (dataDir: string): string => path.join(hubDirFor(dataDir), 'clan');

class Refusal extends Error {}

function split(raw: string): {fields: Map<string, string>; body: string} {
	const text = raw.replace(/\r\n?/g, '\n');
	const lines = text.split('\n');
	if (lines[0] !== '---') throw new Refusal('missing frontmatter');
	const end = lines.indexOf('---', 1);
	if (end < 0) throw new Refusal('unterminated frontmatter');
	const fields = new Map<string, string>();
	for (const l of lines.slice(1, end)) {
		if (l.trim() === '') continue;
		const m = /^([a-z]+):\s*(.*)$/.exec(l);
		if (!m) throw new Refusal('malformed frontmatter line');
		fields.set(m[1]!, m[2]!.trim());
	}
	return {fields, body: lines.slice(end + 1).join('\n').trim()};
}

const capitalise = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

function parse(base: string, raw: string): Persona {
	if (!NAME_RE.test(base)) throw new Refusal('invalid name');
	const {fields, body} = split(raw);
	const named = fields.get('name');
	if (named !== undefined && named !== base) throw new Refusal('name differs from the file name');
	const kind = fields.get('kind') ?? 'archetype';
	if (kind !== 'archetype' && kind !== 'parody') throw new Refusal('invalid kind');
	const baseLabel = fields.get('label') || capitalise(base);
	const label = kind === 'parody' ? baseLabel + PARODY_SUFFIX : baseLabel;
	if (label.length > PERSONA_LIMITS.label || CONTROL_RE.test(label)) throw new Refusal('invalid label');
	if (FORBIDDEN_RE.test(base) || FORBIDDEN_RE.test(label)) throw new Refusal('name or label not allowed');
	const tone = fields.get('tone') ?? '';
	if (tone === '' || tone.length > PERSONA_LIMITS.tone || CONTROL_RE.test(tone)) throw new Refusal('invalid tone');
	const tier = fields.get('tier') ?? 'light';
	if (!TIERS.includes(tier as Tier)) throw new Refusal('invalid tier');
	const colour = fields.get('colour') ?? '';
	if (!Object.hasOwn(PROFILE_TONES, colour)) throw new Refusal('invalid colour');
	if (body === '') throw new Refusal('empty card');
	if (Buffer.byteLength(body) > PERSONA_LIMITS.bodyBytes) throw new Refusal('card too long');
	return {name: base, label, tone, tier: tier as Tier, colour: colour as ProfileTone, kind, card: body};
}

export async function loadPersonas(dir: string): Promise<LoadedPersonas> {
	let entries: string[];
	try {
		entries = (await readdir(dir)).filter(f => f.endsWith('.md')).sort();
	} catch (err) {
		if ((err as NodeJS.ErrnoException).code === 'ENOENT' || (err as NodeJS.ErrnoException).code === 'ENOTDIR') return {personas: [], skipped: []};
		throw err;
	}
	const personas: Persona[] = [];
	const skipped: SkippedFile[] = [];
	for (const [i, file] of entries.entries()) {
		if (i >= PERSONA_LIMITS.files) {
			skipped.push({file, reason: `more than ${PERSONA_LIMITS.files} files`});
			continue;
		}
		try {
			const full = path.join(dir, file);
			const st = await lstat(full);
			if (!st.isFile()) throw new Refusal('not a regular file');
			if (st.size > PERSONA_LIMITS.fileBytes) throw new Refusal('file too large');
			personas.push(parse(file.slice(0, -3), await readFile(full, 'utf8')));
		} catch (err) {
			if (!(err instanceof Refusal)) throw err;
			skipped.push({file, reason: err.message});
		}
	}
	return {personas, skipped};
}
