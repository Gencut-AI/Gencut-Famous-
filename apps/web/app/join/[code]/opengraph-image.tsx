import { getJoinPage } from '@gencut/services';
import { ImageResponse } from 'next/og';
import { db } from '../../../lib/db.ts';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'Invitation to GenCut Famous';

/** Link preview card for a creator's invite link, in GenCut colors. */
export default async function OpenGraphImage({ params }: { params: Promise<{ code: string }> }) {
  const p = await getJoinPage(db(), decodeURIComponent((await params).code));
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: 'linear-gradient(135deg, #f3efff 0%, #e4d9ff 100%)', padding: 72, color: '#1b1035' }}>
        <div style={{ width: 120, height: 12, borderRadius: 6, background: '#5b2be0' }} />
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 40, color: '#5d5279' }}>{p ? `${p.publicName} (@${p.handle}) invited you to` : 'You are invited to'}</div>
          <div style={{ fontSize: 104, fontWeight: 700, letterSpacing: -2, marginTop: 8 }}>GenCut Famous</div>
          <div style={{ fontSize: 40, marginTop: 24 }}>Your brand, your real numbers and a media kit brands trust.</div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', fontSize: 30, color: '#5d5279' }}>
          <div style={{ display: 'flex' }}>Free to start</div>
          <div style={{ display: 'flex', color: '#5b2be0', fontWeight: 700 }}>GenCut Famous</div>
        </div>
      </div>
    ),
    size,
  );
}
