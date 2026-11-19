import type {ChatProfile} from './deps/chat.js';
import {loadPersonas, personaDir, type Persona} from './personas.js';
import {moderatorPrompt, personaPrompt} from './prompts.js';

export const CLAN_BANNER = "The personas are AI characters (fiction); their lines come from Claude Code through yena's chat.";

export function buildProfile(personas: readonly Persona[]): ChatProfile {
	const agents: ChatProfile['agents'] = {};
	for (const p of personas) {
		agents[p.name] = {description: p.tone, prompt: personaPrompt(p), label: p.label, tone: p.colour, tier: p.tier};
	}
	return {
		id: 'clan',
		owner: 'clan',
		banner: CLAN_BANNER,
		noun: 'clan',
		args: personas.map(p => p.name),
		appendSystemPrompt: moderatorPrompt(personas),
		mainTools: ['Agent', 'SendMessage'],
		agents,
		turnAgentCalls: 3,
		keepAliveMs: 600_000,
		mainTier: 'standard',
		loadInstructions: false,
		passWord: 'PASS',
		mainText: 'direction',
		agentInput: 'turn',
	};
}

// Rebuilds the profile of a saved session from exactly the personas it was started with.
export async function buildFromArgs(dataDir: string, names: readonly string[]): Promise<ChatProfile> {
	const dir = personaDir(dataDir);
	const {personas} = await loadPersonas(dir);
	const chosen = names.map(name => {
		const found = personas.find(p => p.name === name);
		if (!found) throw new Error(`Persona "${name.slice(0, 64)}" of this session is missing in ${dir}`);
		return found;
	});
	return buildProfile(chosen);
}
