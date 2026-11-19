DROP INDEX referral_leads_joined_workspace;
DROP INDEX referral_leads_consent;
DROP INDEX profile_pages_published_by;
DROP INDEX media_assets_created_by;
DROP INDEX invitations_invited_by;
DROP INDEX invitations_accepted_by;
DROP INDEX creator_profiles_adult_attested_by;
DROP INDEX creator_partnerships_created_by;
DROP INDEX creator_metric_snapshots_content;
DROP INDEX creator_inquiries_consent;
DROP INDEX creator_channels_revoked_by;
DROP INDEX creator_channels_connected_by;

ALTER FUNCTION social_link_kinds_valid(jsonb) RESET search_path;
