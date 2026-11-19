-- 0007_beta_hardening: fixes from the Supabase advisors before the beta.
--  * Pin the search_path of the social-link CHECK function (security advisor
--    0011), like every other function in this schema.
--  * Index the foreign keys that had no covering index (performance advisor
--    0001), so deleting a user or a consent does not scan whole tables.

ALTER FUNCTION social_link_kinds_valid(jsonb) SET search_path = pg_catalog;

CREATE INDEX creator_channels_connected_by ON creator_channels (connected_by);
CREATE INDEX creator_channels_revoked_by ON creator_channels (revoked_by);
CREATE INDEX creator_inquiries_consent ON creator_inquiries (consent_id);
CREATE INDEX creator_metric_snapshots_content ON creator_metric_snapshots (content_id);
CREATE INDEX creator_partnerships_created_by ON creator_partnerships (created_by);
CREATE INDEX creator_profiles_adult_attested_by ON creator_profiles (adult_attested_by);
CREATE INDEX invitations_accepted_by ON invitations (accepted_by);
CREATE INDEX invitations_invited_by ON invitations (invited_by);
CREATE INDEX media_assets_created_by ON media_assets (created_by);
CREATE INDEX profile_pages_published_by ON profile_pages (published_by);
CREATE INDEX referral_leads_consent ON referral_leads (consent_id);
CREATE INDEX referral_leads_joined_workspace ON referral_leads (joined_workspace_id);
