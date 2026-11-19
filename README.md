# clan

Several personas talk with the user in one chat: to weigh a decision from different sides or just to chat with characters.

Status: steps 1 and 4 (version 0.1.1). A clan chat is the user's chat with a profile: the moderator is the main model with only `Agent` and `SendMessage`, and each persona is a tool-less subagent whose reply is its line. The moderator speaks only as a stage director: a muted third-person action before a persona's call, never speech; the personas hear the user's words and the lines said in the turn, not the moderator's cue. A turn where nobody answers shows `No one answered`. A clan session can be listed and resumed; there is no memory across sessions yet.

## Commands
| Command | What it does |
|---|---|
| `clan` | Shows the help |
| `clan start [persona]…` | Opens a clan chat with the named personas (deny for assistants); none means every persona in the hub; at most 6 |
| `clan list` (alias `ls`) | Lists the earlier clan sessions: id, title, last activity, personas (safe) |
| `clan resume [session]` | Reopens a clan session with the same personas (deny for assistants); a full id or at least 8 characters of it, none means the newest |
| `clan personas` | Lists the personas (name, label, tier, colour, kind), the folder and the skipped files with their reasons (safe, read-only) |

The chat opens from the user's console only; an assistant or an unattended run cannot start or write to a clan chat.

## Personas (the hub)
- A persona is a Markdown file `<name>.md` in the clan folder of the md hub, `<hub>/clan` (today `/data/md/clan`); the hub path comes from md's public entry. Clan never writes there.
- The starter personas `skeptic`, `pragmatist` and `dreamer` are plain hub files, not code.
- Frontmatter, one `key: value` per line:
  - `name`: optional; must equal the file name without `.md`.
  - `label`: optional, at most 40 characters; defaults to the name capitalised.
  - `tone`: required, at most 200 characters; the persona's description for the moderator.
  - `tier`: optional, `light` by default; one of `light`, `standard`, `strong`, `max`.
  - `colour`: required; one of `teal`, `green`, `yellow`, `orange`, `blue`, `violet`.
  - `kind`: `archetype` (default) or `parody`.
- The body after the closing `---` is the persona's card: required, at most 8 KiB. The file is at most 16 KiB, a regular file (no symlinks).
- File names match `[a-z][a-z0-9-]{0,23}`; a name or label containing `claude` or `anthropic` (any case) is refused.
- A `parody` persona's label gets the suffix ` (parody)`, and the persona says it is a parody.
- At most 32 `.md` files are read; an invalid file is skipped and `clan personas` shows why.

## Disclosure
The chat opens with a banner: "The personas are AI characters (fiction); their lines come from Claude Code through yena's chat."

## Environment
None: the clan chat uses the login or API key of the chat (`claude` module, see its README).

## Data
None of its own: clan writes no files; the personas are the hub files above. The chat module keeps the session bindings and the finished persona lines of clan sessions in its data dir (`chat/profiles.json`, `chat/profile-lines/`).

## Events
None.

## Dependencies
- `chat` `^0.7.0` (the chat profile API: `openProfileChat`, `checkProfile`, the tiers and tones; the profile sets `mainText` and `agentInput`): the chat runs the profile through claude.
- `md` `^0.1.1` (`hubDirFor`, the hub folder).
- Core is not imported directly. Needs the `claude` module to run a chat.

## Limits and known risks
- No memory across chats. A resumed clan session shows the saved persona lines, but the personas themselves are respawned; a clan session does not appear in `chat resume`, and fork and rewind are refused for it.
- Personas have no tools: their subagents cannot read files, run commands or use MCP servers.
- The personas' lines are model output: the card and the names reach the model and the transcript.
- Names and cards are static: no renaming from the chat.
- A persona line reaches the next persona as one row (line breaks become ` / `), so it cannot fake another speaker's row; the user's text goes in as is.
- Not verified live yet: the foreground persona line, the `SendMessage` reply after the turn ended, `PASS` hidden, the call cap, `settingSources: []` with a claude-login credential, direction only before a persona, no trailing summary, `No one answered`, the personas reacting to the user's words, `clan resume` replays, and `SendMessage` accepting the rewritten message.

## Development
`./yena dev check clan` (from the console: `dev check clan`). The scripts run inside the yena tree: `tsc` and `tsx` come from the root's `node_modules`, and the module imports host types from `src/api.ts`. The architecture is in `/data/md/architecture/clan.md`.
