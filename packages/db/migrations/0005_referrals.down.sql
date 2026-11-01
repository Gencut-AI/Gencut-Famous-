DROP TABLE IF EXISTS referral_leads, referral_visits, referral_codes CASCADE;
ALTER TABLE workspaces DROP CONSTRAINT IF EXISTS workspaces_not_self_referred;
ALTER TABLE workspaces DROP CONSTRAINT IF EXISTS workspaces_referral_pair;
ALTER TABLE workspaces DROP COLUMN IF EXISTS referred_at;
ALTER TABLE workspaces DROP COLUMN IF EXISTS referred_by_workspace_id;
DELETE FROM consents WHERE purpose = 'referral_followup';
ALTER TABLE consents DROP CONSTRAINT consents_purpose_check;
ALTER TABLE consents ADD CONSTRAINT consents_purpose_check CHECK (purpose IN ('inquiry_reply'));
ALTER TABLE audit_events DROP CONSTRAINT audit_events_entity_type_check;
ALTER TABLE audit_events ADD CONSTRAINT audit_events_entity_type_check CHECK (entity_type IN (
  'workspace', 'membership', 'invitation', 'creator_profile', 'media_asset',
  'channel', 'profile_page', 'inquiry', 'consent'));
