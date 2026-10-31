import { CONNECTION_STATE_LABELS, type ConnectionState } from '@gencut/core';

const TONE: Record<ConnectionState, string> = {
  connected: 'bg-lilac text-royal-deep',
  partially_connected: 'bg-[#fff1d6] text-[#7a4b00]',
  pending_approval: 'bg-[#fff1d6] text-[#7a4b00]',
  expired: 'bg-[#ffe3ee] text-[#9c1747]',
  revoked: 'bg-white/70 text-ink-soft ring-1 ring-line',
  unsupported: 'bg-[#ffe3ee] text-[#9c1747]',
  error: 'bg-[#ffe3ee] text-[#9c1747]',
};

export function StateBadge({ state }: { state: ConnectionState }) {
  return <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${TONE[state]}`}>{CONNECTION_STATE_LABELS[state]}</span>;
}
