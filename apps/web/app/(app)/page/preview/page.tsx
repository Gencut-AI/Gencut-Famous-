import { getProfilePreview } from '@gencut/services';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '../../../../lib/db.ts';
import { requireSession } from '../../../../lib/session.ts';
import { ProfileView } from '../../../p/[handle]/profile-view.tsx';

export const metadata: Metadata = { title: 'Preview', robots: { index: false } };

export default async function PreviewPage() {
  const { ctx, workspace } = await requireSession();
  const p = await getProfilePreview(db(), ctx, workspace.workspaceId);
  if (!p) notFound();
  return (
    <div className="-mx-5 -my-8 sm:-mx-10">
      <div className="sticky top-[57px] z-[5] flex items-center justify-between gap-3 bg-[#fff4d6] px-5 py-2 text-sm text-[#7a5300] sm:px-10">
        <span>Preview — this is what visitors will see.</span>
        <Link href="/page" className="font-semibold">Back to settings</Link>
      </div>
      <ProfileView p={p} preview />
    </div>
  );
}
