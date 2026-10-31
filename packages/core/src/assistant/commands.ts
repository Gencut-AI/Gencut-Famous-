/**
 * The creator assistant, read-only in this version. A deterministic parser
 * first; services may ask the fast model to pick one of these commands when
 * the parser does not recognise the text, and the model's choice is parsed
 * again here. Answers are built only from stored records, with source and date.
 */
export const COMMANDS = ['week', 'top_content', 'followers', 'connections', 'profile_link', 'inquiries', 'help'] as const;
export type Command = (typeof COMMANDS)[number];

export const COMMAND_EXAMPLES: Readonly<Record<Command, string>> = {
  week: 'How did my week perform?',
  top_content: 'What content performed best?',
  followers: 'How many followers do I have?',
  connections: 'Which accounts are connected?',
  profile_link: 'What is my profile link?',
  inquiries: 'Any new inquiries?',
  help: 'What can you do?',
};

const RULES: ReadonlyArray<{ command: Command; re: RegExp }> = [
  { command: 'top_content', re: /\b(top|best|most popular|best[- ]performing|performed best)\b.*\b(post|posts|content|video|videos|reel|reels)\b|\b(post|content|video|reel)s?\b.*\b(performed|did) best\b/ },
  { command: 'week', re: /\b(week|weekly|7 days|seven days|last few days)\b|\bhow (am i|are we|is it) doing\b|\bperform/ },
  { command: 'followers', re: /\b(followers?|subscribers?|audience size|how big)\b/ },
  { command: 'connections', re: /\b(connected|connections?|accounts?|channels?|linked)\b/ },
  { command: 'profile_link', re: /\b(profile link|my link|media kit|public (page|profile)|share my)\b/ },
  { command: 'inquiries', re: /\b(inquir(y|ies)|enquir(y|ies)|messages?|leads?|brands? (reached|contacted))\b/ },
  { command: 'help', re: /^(help|\?|what can you do|commands?)\b/ },
];

/** The command a message asks for, or null when it is not one of them. */
export function parseCommand(text: string): Command | null {
  const t = text.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!t) return null;
  for (const r of RULES) if (r.re.test(t)) return r.command;
  return null;
}

export const ASSISTANT_INTENT_PROMPT_VERSION = 'creator-intent-v1';

/** Prompt for the fast model: it may only answer with one command name or "none". */
export function intentPrompt(message: string): { system: string; user: string } {
  const list = COMMANDS.map((c) => `${c}: ${COMMAND_EXAMPLES[c]}`).join('\n');
  return {
    system: `You route a creator's question to one read-only command. Reply with JSON only: {"command":"<name>"} using one of these names, or {"command":"none"} if none fits. Never answer the question yourself.\n${list}`,
    user: message.slice(0, 500),
  };
}

/** The model's reply, accepted only if it names a known command. */
export function commandFromModel(value: unknown): Command | null {
  const c = (value as { command?: unknown })?.command;
  return typeof c === 'string' && (COMMANDS as readonly string[]).includes(c) ? (c as Command) : null;
}
