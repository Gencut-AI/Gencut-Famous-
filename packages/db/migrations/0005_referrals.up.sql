-- 0005_referrals: referral links a creator posts on social media, the visits
-- and leads they bring, and which new creators signed up through them.

-- One code per workspace, set from the handle at creation and never changed,
-- so links already posted keep working after a handle change.
CREATE TABLE referral_codes (
  workspace_id  uuid PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
  code          text NOT NULL UNIQUE CHECK (code ~ '^[a-z0-9][a-z0-9._]{1,28}[a-z0-9]$' AND code !~ '[._]{2}'),
  active        boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Join-page visits, once per visitor per day (same one-way hash as profile visits).
CREATE TABLE referral_visits (
  id                     bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  referrer_workspace_id  uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  visited_on             date NOT NULL,
  src                    text CHECK (src ~ '^[a-z0-9_-]{2,24}$'),
  visitor_hash           text NOT NULL CHECK (length(visitor_hash) = 64),
  created_at             timestamptz NOT NULL DEFAULT now(),
  UNIQUE (referrer_workspace_id, visited_on, visitor_hash)
);
CREATE INDEX referral_visits_referrer ON referral_visits (referrer_workspace_id, visited_on DESC);

-- People who left their details on a join page. The referrer sees name, handle,
-- role and whether they joined; only GenCut staff see the email (consent says so).
CREATE TABLE referral_leads (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_workspace_id  uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name                   text NOT NULL CHECK (length(trim(name)) BETWEEN 2 AND 120),
  email                  text NOT NULL CHECK (email = lower(email) AND length(email) <= 254),
  social_handle          text CHECK (length(social_handle) <= 60),
  role                   text NOT NULL CHECK (role IN ('influencer', 'content_creator', 'public_figure', 'business', 'other')),
  consent_id             uuid NOT NULL REFERENCES consents(id),
  src                    text CHECK (src ~ '^[a-z0-9_-]{2,24}$'),
  submitter_hash         text NOT NULL CHECK (length(submitter_hash) = 64),
  joined_workspace_id    uuid REFERENCES workspaces(id) ON DELETE SET NULL,
  created_at             timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX referral_leads_referrer ON referral_leads (referrer_workspace_id, created_at DESC);
CREATE INDEX referral_leads_email ON referral_leads (email);
CREATE INDEX referral_leads_submitter ON referral_leads (submitter_hash, created_at);

-- Which creator's link a new workspace came through.
ALTER TABLE workspaces ADD COLUMN referred_by_workspace_id uuid REFERENCES workspaces(id) ON DELETE SET NULL;
ALTER TABLE workspaces ADD COLUMN referred_at timestamptz;
ALTER TABLE workspaces ADD CONSTRAINT workspaces_referral_pair CHECK ((referred_by_workspace_id IS NULL) = (referred_at IS NULL));
ALTER TABLE workspaces ADD CONSTRAINT workspaces_not_self_referred CHECK (referred_by_workspace_id IS DISTINCT FROM id);
CREATE INDEX workspaces_referred_by ON workspaces (referred_by_workspace_id) WHERE referred_by_workspace_id IS NOT NULL;

ALTER TABLE consents DROP CONSTRAINT consents_purpose_check;
ALTER TABLE consents ADD CONSTRAINT consents_purpose_check CHECK (purpose IN ('inquiry_reply', 'referral_followup'));

ALTER TABLE audit_events DROP CONSTRAINT audit_events_entity_type_check;
ALTER TABLE audit_events ADD CONSTRAINT audit_events_entity_type_check CHECK (entity_type IN (
  'workspace', 'membership', 'invitation', 'creator_profile', 'media_asset',
  'channel', 'profile_page', 'inquiry', 'consent', 'referral'));

-- Codes for creators who existed before referrals.
INSERT INTO referral_codes (workspace_id, code)
SELECT workspace_id, handle FROM creator_profiles ON CONFLICT DO NOTHING;

ALTER TABLE referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_leads ENABLE ROW LEVEL SECURITY;
