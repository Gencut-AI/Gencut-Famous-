import { INQUIRY_KIND_LABELS } from '@gencut/core';
import { listInquiries } from '@gencut/services';
import type { Metadata } from 'next';
import Link from 'next/link';
import { db } from '../../../lib/db.ts';
import { when } from '../../../lib/format.ts';
import { requireSession } from '../../../lib/session.ts';
import { markInquiry } from './actions.ts';

export const metadata: Metadata = { title: 'Inquiries' };

export default async function InquiriesPage() {
  const { ctx, workspace } = await requireSession();
  const items = await listInquiries(db(), ctx, workspace.workspaceId);
  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="display text-4xl font-bold">Inquiries</h1>
        <p className="mt-2 max-w-[62ch] text-ink-soft">Messages sent from your media kit. Each sender agreed to be contacted by email about their inquiry. GenCut does not reply for you: use your own email.</p>
      </header>
      {items.length === 0 ? (
        <div className="panel flex flex-col items-start gap-3">
          <p className="text-ink-soft">No inquiries yet.</p>
          <Link href="/page" className="btn-quiet">Share your media kit</Link>
        </div>
      ) : (
        <ul className="flex flex-col gap-4">
          {items.map((i) => (
            <li key={i.id} className={`panel flex flex-col gap-3 ${i.status === 'new' ? 'border-bay' : ''}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold">
                  {i.status === 'new' && <span className="rec-dot mr-2 inline-block size-2 rounded-full bg-flamingo align-middle" aria-label="Unread" />}
                  {i.name}{i.organization ? <span className="font-normal text-ink-soft"> · {i.organization}</span> : null}
                </p>
                <span className="text-xs text-ink-soft">{INQUIRY_KIND_LABELS[i.kind]} · {when(i.createdAt)}{i.src ? ` · via ${i.src}` : ''}</span>
              </div>
              <p className="whitespace-pre-line text-[0.95rem]">{i.message}</p>
              <div className="flex flex-wrap items-center gap-2">
                <a href={`mailto:${encodeURIComponent(i.email)}?subject=${encodeURIComponent('Re: your inquiry')}`} className="btn">Reply by email</a>
                <span className="text-sm text-ink-soft">{i.email}</span>
                <div className="ml-auto flex gap-2">
                  {i.status === 'new' && (
                    <form action={markInquiry}><input type="hidden" name="id" value={i.id} /><input type="hidden" name="status" value="read" /><button type="submit" className="btn-quiet">Mark read</button></form>
                  )}
                  <form action={markInquiry}><input type="hidden" name="id" value={i.id} /><input type="hidden" name="status" value="archived" /><button type="submit" className="btn-quiet">Archive</button></form>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
