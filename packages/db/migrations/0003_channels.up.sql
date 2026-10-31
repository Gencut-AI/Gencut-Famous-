-- 0003_channels: connected social accounts, their encrypted credentials, the
-- creator's content as the platform lists it, and dated metric snapshots.
-- Lists mirror packages/core (platforms.ts, metrics/registry.ts).

CREATE TABLE creator_channels (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id         uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  platform             text NOT NULL CHECK (platform IN ('instagram', 'youtube', 'tiktok', 'facebook', 'threads', 'linkedin', 'x')),
  external_account_id  text NOT NULL CHECK (length(external_account_id) BETWEEN 1 AND 100),
  username             text NOT NULL CHECK (length(username) BETWEEN 1 AND 100),
  display_name         text CHECK (length(display_name) <= 200),
  account_type         text,
  profile_picture_url  text,
  granted_scopes       text[] NOT NULL DEFAULT '{}',
  connected_by         uuid NOT NULL REFERENCES users(id),
  connected_at         timestamptz NOT NULL DEFAULT now(),
  last_synced_at       timestamptz,
  last_sync_status     text CHECK (last_sync_status IN ('ok', 'partial', 'failed')),
  last_sync_error      text CHECK (length(last_sync_error) <= 500),
  -- A failure only the creator can fix (token refused, permission removed).
  auth_error           text CHECK (length(auth_error) <= 500),
  revoked_at           timestamptz,
  revoked_by           uuid REFERENCES users(id),
  updated_at           timestamptz NOT NULL DEFAULT now()
);
-- One active connection per platform account, across all workspaces.
CREATE UNIQUE INDEX creator_channels_active_account ON creator_channels (platform, external_account_id) WHERE revoked_at IS NULL;
CREATE INDEX creator_channels_workspace ON creator_channels (workspace_id, platform) WHERE revoked_at IS NULL;

-- AES-256-GCM ciphertext of the token. Deleted on disconnect. Only the
-- connectors module decrypts it; it never reaches a browser or a log.
CREATE TABLE channel_credentials (
  channel_id         uuid PRIMARY KEY REFERENCES creator_channels(id) ON DELETE CASCADE,
  key_id             text NOT NULL CHECK (key_id ~ '^[a-z0-9_-]{1,20}$'),
  nonce              bytea NOT NULL CHECK (octet_length(nonce) = 12),
  ciphertext         bytea NOT NULL,
  access_expires_at  timestamptz,
  issued_at          timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

-- The creator's posts as the platform lists them. Shown on the public
-- profile only when the creator picks them (shown_on_profile).
CREATE TABLE creator_content (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  channel_id        uuid NOT NULL REFERENCES creator_channels(id) ON DELETE CASCADE,
  platform          text NOT NULL,
  external_id       text NOT NULL,
  permalink         text CHECK (permalink ~ '^https://'),
  media_type        text,
  product_type      text,
  caption_excerpt   text CHECK (length(caption_excerpt) <= 300),
  thumbnail_url     text,
  published_at      timestamptz,
  shown_on_profile  boolean NOT NULL DEFAULT false,
  retrieved_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (channel_id, external_id)
);
CREATE INDEX creator_content_workspace ON creator_content (workspace_id, published_at DESC);

-- One reading of one metric. Missing data is stored as unavailable with a
-- NULL value, never as zero. One row per channel, item, metric, period kind
-- and day: a re-sync the same day updates the reading.
CREATE TABLE creator_metric_snapshots (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  workspace_id     uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  channel_id       uuid NOT NULL REFERENCES creator_channels(id) ON DELETE CASCADE,
  content_id       uuid REFERENCES creator_content(id) ON DELETE CASCADE,
  metric           text NOT NULL CHECK (metric IN (
                     'followers', 'following', 'posts', 'reach', 'views', 'accounts_engaged', 'interactions',
                     'likes', 'comments', 'shares', 'saves', 'profile_visits', 'inquiries')),
  -- instant: a count at retrieval; day / week: a platform total for [period_start, period_end); lifetime: since a post was published.
  period_kind      text NOT NULL CHECK (period_kind IN ('instant', 'day', 'week', 'lifetime')),
  period_start     timestamptz,
  period_end       timestamptz,
  as_of            date NOT NULL,
  value            numeric,
  availability     text NOT NULL CHECK (availability IN ('available', 'unavailable', 'below_threshold', 'not_supported', 'error')),
  retrieved_at     timestamptz NOT NULL,
  source_endpoint  text NOT NULL,
  api_version      text NOT NULL,
  CHECK ((availability = 'available') = (value IS NOT NULL)),
  CHECK ((period_kind IN ('day', 'week')) = (period_start IS NOT NULL AND period_end IS NOT NULL AND period_start < period_end))
);
CREATE UNIQUE INDEX creator_metric_snapshots_unique ON creator_metric_snapshots
  (channel_id, coalesce(content_id, '00000000-0000-0000-0000-000000000000'::uuid), metric, period_kind, as_of);
CREATE INDEX creator_metric_snapshots_workspace ON creator_metric_snapshots (workspace_id, metric, as_of DESC);

-- Data-deletion requests that arrive from a platform (Meta's callback). Holds
-- no personal data: the code the person can look up, and what was erased.
CREATE TABLE deletion_requests (
  confirmation_code  text PRIMARY KEY CHECK (confirmation_code ~ '^[A-Za-z0-9_-]{8,40}$'),
  platform           text NOT NULL,
  channels_deleted   integer NOT NULL CHECK (channels_deleted >= 0),
  requested_at       timestamptz NOT NULL DEFAULT now(),
  completed_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE creator_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE deletion_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE creator_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE creator_metric_snapshots ENABLE ROW LEVEL SECURITY;
