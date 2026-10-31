import { CONNECTION_STATE_LABELS, type ConnectionState } from '@gencut/core';

const TONE: Record<ConnectionState, string> = {
  connected: 'bg-glass text-bay-deep',
  partially_connected: 'bg-[#fff4d6] text-[#7a5300]',
  pending_approval: 'bg-[#fff4d6] text-[#7a5300]',
  expired: 'bg-[#fde7ec] text-[#7d1830]',
  revoked: 'bg-paper text-ink-soft ring-1 ring-glass-deep',
  unsupported: 'bg-[#fde7ec] text-[#7d1830]',
  error: 'bg-[#fde7ec] text-[#7d1830]',
};

export function StateBadge({ state }: { state: ConnectionState }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${TONE[state]}`}>{CONNECTION_STATE_LABELS[state]}</span>;
}
