-- 0002_creator_profiles: the creator's brand profile, self-reported
-- partnerships, and brand images (logo, profile photo, content examples).
-- Only public_name and handle are required; the rest is filled in over time.
-- Lists mirror packages/core (creators/profile.ts); schema tests compare them.

CREATE TABLE creator_profiles (
  workspace_id       uuid PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
  public_name        text NOT NULL CHECK (length(trim(public_name)) BETWEEN 1 AND 80),
  handle             text NOT NULL UNIQUE CHECK (handle ~ '^[a-z0-9][a-z0-9._]{1,28}[a-z0-9]$' AND handle !~ '[._]{2}'),
  legal_name         text CHECK (length(legal_name) <= 120),
  bio                text CHECK (length(bio) <= 600),
  niches             text[] NOT NULL DEFAULT '{}' CHECK (niches <@ ARRAY[
                       'beauty', 'business', 'comedy', 'education', 'entertainment', 'family', 'fashion', 'finance',
                       'fitness', 'food', 'gaming', 'health', 'home', 'lifestyle', 'music', 'outdoors', 'pets',
                       'photography', 'real_estate', 'sports', 'tech', 'travel', 'wellness', 'other']::text[]
                       AND cardinality(niches) <= 5),
  target_audience    text CHECK (length(target_audience) <= 400),
  audience_notes     text CHECK (length(audience_notes) <= 600),
  brand_message      text CHECK (length(brand_message) <= 400),
  brand_values       text[] NOT NULL DEFAULT '{}' CHECK (cardinality(brand_values) <= 8),
  tone               text CHECK (tone IN ('warm', 'playful', 'bold', 'expert', 'calm', 'luxurious', 'raw')),
  tone_notes         text CHECK (length(tone_notes) <= 400),
  colors             text[] NOT NULL DEFAULT '{}' CHECK (cardinality(colors) <= 6),
  fonts              text[] NOT NULL DEFAULT '{}' CHECK (cardinality(fonts) <= 3),
  goals              text CHECK (length(goals) <= 600),
  growth_target      text CHECK (length(growth_target) <= 200),
  partnership_kinds  text[] NOT NULL DEFAULT '{}' CHECK (partnership_kinds <@ ARRAY[
                       'sponsored_posts', 'ambassadorships', 'affiliate', 'events', 'product_seeding', 'licensing']::text[]),
  brands_wanted      text[] NOT NULL DEFAULT '{}' CHECK (cardinality(brands_wanted) <= 30),
  brands_avoided     text[] NOT NULL DEFAULT '{}' CHECK (cardinality(brands_avoided) <= 30),
  -- Private: [{ "deliverable": text, "priceUsd": integer }]. Never shown publicly.
  rate_card          jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(rate_card) = 'array'),
  -- M1 is for adults only (docs/decisions.md D-006).
  adult_attested_at  timestamptz NOT NULL,
  adult_attested_by  uuid NOT NULL REFERENCES users(id),
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

-- Partnerships the creator enters themselves. Always shown as self-reported;
-- GenCut has no way to verify them in this version.
CREATE TABLE creator_partnerships (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  brand_name    text NOT NULL CHECK (length(trim(brand_name)) BETWEEN 1 AND 80),
  description   text CHECK (length(description) <= 280),
  period        text CHECK (length(period) <= 40),
  url           text CHECK (url ~ '^https://' AND length(url) <= 500),
  source        text NOT NULL DEFAULT 'self_reported' CHECK (source = 'self_reported'),
  created_by    uuid REFERENCES users(id),
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX creator_partnerships_workspace ON creator_partnerships (workspace_id, created_at);

-- Brand images stored in Postgres (≤ 5 MB each); reached only through the media service.
CREATE TABLE media_assets (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  kind          text NOT NULL CHECK (kind IN ('logo', 'profile_photo', 'content_example')),
  content_type  text NOT NULL CHECK (content_type IN ('image/png', 'image/jpeg', 'image/webp')),
  bytes         bytea NOT NULL,
  byte_size     integer NOT NULL CHECK (byte_size > 0 AND byte_size <= 5242880 AND byte_size = octet_length(bytes)),
  caption       text CHECK (length(caption) <= 200),
  created_by    uuid REFERENCES users(id),
  replaced_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX media_assets_one_current ON media_assets (workspace_id, kind)
  WHERE replaced_at IS NULL AND kind IN ('logo', 'profile_photo');
CREATE INDEX media_assets_workspace ON media_assets (workspace_id, kind, created_at DESC);

ALTER TABLE creator_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE creator_partnerships ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_assets ENABLE ROW LEVEL SECURITY;
