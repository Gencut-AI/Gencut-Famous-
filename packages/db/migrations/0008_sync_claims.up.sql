-- 0008_sync_claims: a scheduled run claims a channel before reading it, so
-- runs that overlap (every 15 minutes, plus on-demand reads) never read the
-- same channel twice. Cleared when the read finishes; a claim older than
-- 10 minutes counts as abandoned.
ALTER TABLE creator_channels ADD COLUMN sync_claimed_at timestamptz;
CREATE INDEX creator_channels_sync_due ON creator_channels (last_synced_at NULLS FIRST)
  WHERE platform = 'instagram' AND revoked_at IS NULL;
