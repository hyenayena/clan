import type {ModulePlugin} from '../../../src/api.js';
import {createCommand} from './commands.js';
import {openProfileChat, profileSessions, registerChatProfile, resumeProfileChat} from './deps/chat.js';
import {noopLog} from './log.js';
import {buildFromArgs} from './profile.js';

const plugin: ModulePlugin = host => {
	const log = (host.log ?? noopLog).child('clan');
	log.debug('plugin loaded');
	const dataDir = host.dataDir;
	if (!registerChatProfile({id: 'clan', owner: 'clan', build: names => buildFromArgs(dataDir, names)})) log.warn('chat profile source refused');
	return [
		createCommand({
			openChat: openProfileChat,
			profileSessions,
			resumeChat: resumeProfileChat,
			dataDir,
			onSkipped: count => log.warn('persona files skipped', {count}),
		}),
	];
};

export default plugin;
