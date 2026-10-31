import {
  ASSISTANT_INTENT_PROMPT_VERSION,
  COMMAND_EXAMPLES,
  CONNECTION_STATE_LABELS,
  type Command,
  METRICS,
  PLATFORM_LABELS,
  commandFromModel,
  extractJson,
  intentPrompt,
  parseCommand,
} from '@gencut/core';
import type { RequestContext } from '../context.ts';
import type { Sql } from '../db.ts';
import { type ModelRouter, recordModelRun } from '../models.ts';
import { requireCapability } from '../membership.ts';
import { type Figure, getDashboard } from './dashboard.ts';
import { loadProfile } from './profile.ts';

export interface AssistantReply {
  readonly command: Command | null;
  /** Which path understood the question: the parser, the model, or neither. */
  readonly understoodBy: 'parser' | 'model' | 'none';
  readonly lines: readonly string[];
  readonly link: { readonly href: string; readonly label: string } | null;
}

const n = (v: number) => v.toLocaleString('en-US');
const when = (d: Date) => d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' });
const fig = (f: Figure) =>
  f.value === null ? `${METRICS[f.metric].label}: not available (${f.availability.replace('_', ' ')})` : `${METRICS[f.metric].label}: ${n(f.value)} (${f.periodLabel}, ${PLATFORM_LABELS[f.source as keyof typeof PLATFORM_LABELS] ?? 'GenCut'}, read ${when(f.retrievedAt)})`;

/**
 * Answer a read-only question from stored records. The fast model, when
 * configured, may only choose a command; it never writes the answer, so the
 * answer cannot contain a number GenCut did not read.
 */
export async function askAssistant(sql: Sql, ctx: RequestContext, workspaceId: string, text: string, router: ModelRouter | null, siteUrl: string): Promise<AssistantReply> {
  await requireCapability(sql, ctx, workspaceId, 'view');
  let command = parseCommand(text);
  let understoodBy: AssistantReply['understoodBy'] = command ? 'parser' : 'none';
  if (!command && router && text.trim().length > 2) {
    const p = intentPrompt(text);
    const run = { workspaceId, purpose: 'assistant_intent', role: 'fast', promptVersion: ASSISTANT_INTENT_PROMPT_VERSION } as const;
    try {
      const r = await router.complete({ role: 'fast', system: p.system, user: p.user, maxOutputTokens: 60 });
      await recordModelRun(sql, run, { ok: true, response: r });
      try {
        command = commandFromModel(extractJson(r.text));
      } catch {
        command = null;
      }
      if (command) understoodBy = 'model';
    } catch (e) {
      const { provider, model } = router.route('fast');
      await recordModelRun(sql, run, { ok: false, provider, model, error: e instanceof Error ? e.message : 'model call failed' });
      command = null;
    }
  }
  if (!command) {
    return {
      command: null, understoodBy: 'none', link: null,
      lines: ["I can only read your GenCut records in this version. Try one of these:", ...Object.values(COMMAND_EXAMPLES).slice(0, 6)],
    };
  }

  const profile = await loadProfile(sql, workspaceId);
  const d = await getDashboard(sql, ctx, workspaceId);
  const noChannels = d.channels.length === 0;
  const connectHint = { href: '/channels', label: 'Connect an account' };

  switch (command) {
    case 'help':
      return { command, understoodBy, link: null, lines: ['Ask me about your numbers and your page. For example:', ...Object.values(COMMAND_EXAMPLES).filter((e) => e !== COMMAND_EXAMPLES.help)] };
    case 'connections':
      return {
        command, understoodBy, link: { href: '/channels', label: 'Open Channels' },
        lines: noChannels ? ['No accounts are connected yet.'] : d.channels.map((c) => `${PLATFORM_LABELS[c.channel.platform]} @${c.channel.username}: ${CONNECTION_STATE_LABELS[c.channel.state]}${c.channel.lastSyncedAt ? `, last read ${when(c.channel.lastSyncedAt)}` : ', not read yet'}`),
      };
    case 'followers': {
      if (noChannels) return { command, understoodBy, link: connectHint, lines: ['No accounts are connected, so I have no follower counts.'] };
      const lines = d.channels.map((c) => (c.followers ? `${PLATFORM_LABELS[c.channel.platform]} @${c.channel.username} — ${fig(c.followers)}` : `${PLATFORM_LABELS[c.channel.platform]} @${c.channel.username} — not read yet`));
      if (d.combinedFollowers && d.combinedFollowers.sources.length > 1) lines.push(`${n(d.combinedFollowers.value)} in total. ${d.combinedFollowers.label}.`);
      return { command, understoodBy, link: { href: '/home', label: 'Open dashboard' }, lines };
    }
    case 'week': {
      if (noChannels) return { command, understoodBy, link: connectHint, lines: ['No accounts are connected, so I have no numbers for your week.'] };
      const lines: string[] = [];
      for (const c of d.channels) {
        lines.push(`${PLATFORM_LABELS[c.channel.platform]} @${c.channel.username}:`);
        if (c.growth7) lines.push(`Followers ${c.growth7.change >= 0 ? 'up' : 'down'} ${n(Math.abs(c.growth7.change))} over 7 days (${n(c.growth7.from)} → ${n(c.growth7.to)}).`);
        else lines.push(`Follower change: not enough history yet${c.historyStarts ? ` (readings start ${c.historyStarts.toISOString().slice(0, 10)})` : ''}.`);
        if (c.week.length) for (const f of c.week) lines.push(fig(f));
        else lines.push('Weekly insights: not read yet.');
      }
      lines.push(`Media kit visits: ${n(d.visits.last7)} in the last 7 days (GenCut).`);
      return { command, understoodBy, link: { href: '/home', label: 'Open dashboard' }, lines };
    }
    case 'top_content': {
      if (!d.topContent.length) return { command, understoodBy, link: noChannels ? connectHint : { href: '/analytics', label: 'Open Analytics' }, lines: ['I have no post readings yet.'] };
      const lines = d.topContent.slice(0, 3).map((c, i) => {
        const f = c.figures.find((x) => x.metric === c.rankedBy);
        const title = c.caption ? `“${c.caption.slice(0, 60)}${c.caption.length > 60 ? '…' : ''}”` : 'Untitled post';
        return `${i + 1}. ${title} — ${f ? fig(f) : ''}`;
      });
      lines.push('Ranked by views where Instagram reports them, otherwise interactions, otherwise likes.');
      return { command, understoodBy, link: { href: '/analytics', label: 'Open Analytics' }, lines };
    }
    case 'profile_link': {
      const [page] = await sql<{ published: boolean }[]>`SELECT published FROM profile_pages WHERE workspace_id = ${workspaceId}`;
      const url = `${siteUrl.replace(/\/$/, '')}/@${profile?.handle ?? ''}`;
      return page?.published
        ? { command, understoodBy, link: { href: url, label: url.replace(/^https?:\/\//, '') }, lines: [`Your media kit is live at ${url}.`, `Add ?src=instagram (or tiktok, youtube…) to see where visits come from.`] }
        : { command, understoodBy, link: { href: '/page', label: 'Open Media kit' }, lines: ['Your media kit is not published yet. Publish it from the Media kit page.'] };
    }
    case 'inquiries':
      return { command, understoodBy, link: { href: '/inquiries', label: 'Open Inquiries' }, lines: [`${n(d.inquiries.unread)} unread inquir${d.inquiries.unread === 1 ? 'y' : 'ies'}; ${n(d.inquiries.last30)} in the last 30 days.`] };
  }
}
