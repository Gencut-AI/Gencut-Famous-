-- 0001_core: accounts, team access, audit log, consent records and model-call
-- log for GenCut for Creators.
--
-- Every row of creator data carries workspace_id: one workspace is one creator.
-- The app server connects directly with a server-only connection string and
-- authorizes in the service layer; RLS with no policies keeps Supabase's
-- public Data API out of every table (see docs/decisions.md D-003).

CREATE TABLE workspaces (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL CHECK (length(trim(name)) > 0),
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Mirrors Supabase auth.users.id.
CREATE TABLE users (
  id          uuid PRIMARY KEY,
  email       text NOT NULL UNIQUE,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- owner = the creator; manager = someone the creator authorized.
CREATE TABLE memberships (
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role         text NOT NULL CHECK (role IN ('owner', 'manager')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, user_id)
);
CREATE UNIQUE INDEX memberships_one_owner ON memberships (workspace_id) WHERE role = 'owner';
CREATE INDEX memberships_user ON memberships (user_id);

-- Manager invitations: the owner shares a one-time link; only its hash is stored.
CREATE TABLE invitations (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  email        text NOT NULL CHECK (email = lower(email) AND length(email) <= 254),
  role         text NOT NULL DEFAULT 'manager' CHECK (role = 'manager'),
  token_hash   text NOT NULL UNIQUE,
  invited_by   uuid NOT NULL REFERENCES users(id),
  expires_at   timestamptz NOT NULL,
  accepted_at  timestamptz,
  accepted_by  uuid REFERENCES users(id),
  revoked_at   timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CHECK ((accepted_at IS NULL) = (accepted_by IS NULL))
);
CREATE INDEX invitations_workspace ON invitations (workspace_id, created_at DESC);

-- Append-only audit log.
CREATE TABLE audit_events (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  workspace_id  uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  actor_type    text NOT NULL CHECK (actor_type IN ('user', 'system', 'agent', 'executor')),
  actor_id      text,
  via           text NOT NULL CHECK (via IN ('web', 'whatsapp', 'worker', 'api')),
  entity_type   text NOT NULL CHECK (entity_type IN (
                  'workspace', 'membership', 'invitation', 'creator_profile', 'media_asset',
                  'channel', 'profile_page', 'inquiry', 'consent')),
  entity_id     text NOT NULL,
  action        text NOT NULL,
  from_state    text,
  to_state      text,
  detail        jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_events_workspace ON audit_events (workspace_id, occurred_at DESC);
CREATE INDEX audit_events_entity ON audit_events (entity_type, entity_id, occurred_at);

CREATE FUNCTION audit_events_append_only() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN
  RAISE EXCEPTION 'audit_events is append-only' USING ERRCODE = 'insufficient_privilege';
END;
$$;
CREATE TRIGGER audit_events_no_update
  BEFORE UPDATE OR DELETE ON audit_events
  FOR EACH ROW WHEN (pg_trigger_depth() = 0)
  EXECUTE FUNCTION audit_events_append_only();

-- Consent given by people who contact a creator (e.g. the inquiry form):
-- the exact text they agreed to, its version, and when.
CREATE TABLE consents (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id     uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  channel          text NOT NULL CHECK (channel IN ('email')),
  address          text NOT NULL CHECK (length(address) <= 254),
  purpose          text NOT NULL CHECK (purpose IN ('inquiry_reply')),
  disclosure_text  text NOT NULL,
  disclosure_version text NOT NULL,
  obtained_at      timestamptz NOT NULL DEFAULT now(),
  revoked_at       timestamptz
);
CREATE INDEX consents_lookup ON consents (workspace_id, channel, lower(address));

-- Every model call: provider, model, tokens, cost, latency, outcome. Never the prompt text.
CREATE TABLE model_runs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  role            text NOT NULL CHECK (role IN ('reasoning', 'creative', 'fast')),
  purpose         text NOT NULL,
  prompt_version  text NOT NULL,
  provider        text NOT NULL,
  model           text NOT NULL,
  input_tokens    integer NOT NULL DEFAULT 0,
  output_tokens   integer NOT NULL DEFAULT 0,
  cache_read_tokens integer NOT NULL DEFAULT 0,
  cost_usd        numeric(12, 6) NOT NULL DEFAULT 0,
  latency_ms      integer NOT NULL DEFAULT 0,
  status          text NOT NULL CHECK (status IN ('succeeded', 'failed')),
  error           text,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX model_runs_workspace ON model_runs (workspace_id, created_at DESC);

ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE model_runs ENABLE ROW LEVEL SECURITY;
