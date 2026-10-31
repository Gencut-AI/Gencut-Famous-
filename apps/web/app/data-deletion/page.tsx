import { deletionRequestStatus } from '@gencut/services';
import type { Metadata } from 'next';
import { db } from '../../lib/db.ts';
import { LegalPage } from '../_legal/legal-page.tsx';

export const metadata: Metadata = { title: 'Data deletion' };
export const dynamic = 'force-dynamic';

export default async function DataDeletionPage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const { code } = await searchParams;
  const status = code && process.env.DATABASE_URL ? await deletionRequestStatus(db(), code) : null;
  return (
    <LegalPage title="Data deletion">
      {code && (
        <p role="status" className="rounded-xl bg-lilac p-4">
          {status ? `Request ${code}: completed ${status.completedAt.toUTCString()}. ${status.channelsDeleted} connected account${status.channelsDeleted === 1 ? '' : 's'} and everything read from ${status.channelsDeleted === 1 ? 'it' : 'them'} were deleted.` : `We have no deletion request with the code ${code}.`}
        </p>
      )}
      <h2>Creators</h2>
      <ul>
        <li>To stop GenCut reading an account: Channels → Disconnect. We delete the access token at once.</li>
        <li>To erase what we read from it: Channels → Disconnected accounts → Delete data.</li>
        <li>To delete your whole workspace: email privacy@gencut.ai from your sign-in address.</li>
      </ul>
      <h2>Through Instagram</h2>
      <p>If you remove GenCut in Instagram (Settings → Website permissions → Apps and websites) or ask Meta to delete your data, Meta notifies us and we erase everything we read from that account. Meta gives you a confirmation code you can look up on this page.</p>
      <h2>People who sent an inquiry</h2>
      <p>Email privacy@gencut.ai with the address you used and the creator you contacted; we will delete your message and consent record.</p>
    </LegalPage>
  );
}
