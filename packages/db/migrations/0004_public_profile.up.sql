-- 0004_public_profile: the creator's public media kit (gencut.ai/@handle),
-- privacy-preserving visit counts, and inquiries sent through it.

CREATE TABLE profile_pages (
  workspace_id        uuid PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
  published           boolean NOT NULL DEFAULT false,
  published_at        timestamptz,
  published_by        uuid REFERENCES users(id),
  headline            text CHECK (length(headline) <= 120),
  work_with_me        text CHECK (length(work_with_me) <= 600),
  show_inquiry_form   boolean NOT NULL DEFAULT true,
  -- Metrics the creator chose to show; only verified readings appear.
  shown_metrics       text[] NOT NULL DEFAULT '{followers}' CHECK (shown_metrics <@ ARRAY['followers', 'posts', 'views', 'reach', 'interactions']::text[]),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CHECK (NOT published OR (published_at IS NOT NULL AND published_by IS NOT NULL))
);

-- A visit is counted once per visitor per day. visitor_hash is an HMAC of the
-- network address and browser with a server secret and the day: it cannot be
-- reversed or linked across days. No address or browser string is stored.
CREATE TABLE profile_visits (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  workspace_id    uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  visited_on      date NOT NULL,
  src             text CHECK (src ~ '^[a-z0-9_-]{2,24}$'),
  referrer_host   text CHECK (length(referrer_host) <= 120),
  visitor_hash    text NOT NULL CHECK (length(visitor_hash) = 64),
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, visited_on, visitor_hash)
);
CREATE INDEX profile_visits_workspace ON profile_visits (workspace_id, visited_on DESC);

CREATE TABLE creator_inquiries (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  kind            text NOT NULL CHECK (kind IN ('brand_partnership', 'press', 'collaboration', 'speaking', 'other')),
  name            text NOT NULL CHECK (length(trim(name)) BETWEEN 2 AND 120),
  email           text NOT NULL CHECK (length(email) <= 254),
  organization    text CHECK (length(organization) <= 120),
  message         text NOT NULL CHECK (length(trim(message)) BETWEEN 10 AND 2000),
  consent_id      uuid NOT NULL REFERENCES consents(id),
  src             text CHECK (src ~ '^[a-z0-9_-]{2,24}$'),
  submitter_hash  text NOT NULL CHECK (length(submitter_hash) = 64),
  status          text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'read', 'archived')),
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX creator_inquiries_workspace ON creator_inquiries (workspace_id, created_at DESC);
CREATE INDEX creator_inquiries_submitter ON creator_inquiries (submitter_hash, created_at);

ALTER TABLE profile_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE creator_inquiries ENABLE ROW LEVEL SECURITY;
