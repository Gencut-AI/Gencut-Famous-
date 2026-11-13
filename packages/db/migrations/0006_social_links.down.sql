ALTER TABLE creator_profiles DROP CONSTRAINT IF EXISTS creator_profiles_social_links_valid;
DROP FUNCTION IF EXISTS social_link_kinds_valid(jsonb);
ALTER TABLE creator_profiles DROP COLUMN IF EXISTS social_links;
