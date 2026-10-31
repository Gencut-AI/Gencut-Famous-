import { getPublishedProfile } from '@gencut/services';
import { ImageResponse } from 'next/og';
import { db } from '../../../lib/db.ts';
import { compact } from '../../../lib/format.ts';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'Creator media kit';

/** Link preview card: name, handle, headline and the first verified follower count, in GenCut colors. */
export default async function OpenGraphImage({ params }: { params: Promise<{ handle: string }> }) {
  const p = await getPublishedProfile(db(), decodeURIComponent((await params).handle));
  const followers = p?.metrics.find((m) => m.metric === 'followers' && m.value !== null);
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: 'linear-gradient(135deg, #f3efff 0%, #e4d9ff 100%)', padding: 72, color: '#1b1035' }}>
        <div style={{ width: 120, height: 12, borderRadius: 6, background: '#5b2be0' }} />
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 88, fontWeight: 700, letterSpacing: -2 }}>{p?.publicName ?? 'GenCut Famous'}</div>
          <div style={{ fontSize: 36, color: '#5d5279', marginTop: 8 }}>{p ? `@${p.handle}` : ''}</div>
          {p?.headline ? <div style={{ fontSize: 40, marginTop: 28 }}>{p.headline.slice(0, 90)}</div> : null}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', fontSize: 30, color: '#5d5279' }}>
          <div style={{ display: 'flex' }}>{followers?.value != null ? `${compact(followers.value)} followers, verified via ${followers.source === 'instagram' ? 'Instagram' : followers.source}` : 'Media kit'}</div>
          <div style={{ display: 'flex', color: '#5b2be0', fontWeight: 700 }}>GenCut Famous</div>
        </div>
      </div>
    ),
    size,
  );
}
