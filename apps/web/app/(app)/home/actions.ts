'use server';

import { askAssistant, modelRouterFromEnv, syncWorkspace } from '@gencut/services';
import { revalidatePath } from 'next/cache';
import { connectorDeps, publicBase } from '../../../lib/connectors.ts';
import { db } from '../../../lib/db.ts';
import { requireSession } from '../../../lib/session.ts';

export type AskState = { status: 'idle' } | { status: 'answered'; question: string; lines: string[]; link: { href: string; label: string } | null };

export async function ask(_prev: AskState, form: FormData): Promise<AskState> {
  const { ctx, workspace } = await requireSession();
  const question = String(form.get('q') ?? '').trim().slice(0, 500);
  if (!question) return { status: 'idle' };
  const r = await askAssistant(db(), ctx, workspace.workspaceId, question, modelRouterFromEnv(), await publicBase());
  return { status: 'answered', question, lines: [...r.lines], link: r.link };
}

export async function refreshNow(): Promise<void> {
  const { ctx, workspace } = await requireSession();
  const deps = connectorDeps();
  if (deps) await syncWorkspace(db(), ctx, workspace.workspaceId, deps, true);
  revalidatePath('/home');
  revalidatePath('/analytics');
}
