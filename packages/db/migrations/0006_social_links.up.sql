-- 0006_social_links: links the creator pastes to their own profiles elsewhere
-- (Instagram, TikTok, YouTube, a website). Links only: no figures come from
-- them. Shape: [{ "kind": text, "url": text, "label": text }], validated in
-- packages/core (creators/social-links.ts); the kinds are checked here too.

ALTER TABLE creator_profiles
  ADD COLUMN social_links jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(social_links) = 'array' AND jsonb_array_length(social_links) <= 10);

CREATE FUNCTION social_link_kinds_valid(links jsonb) RETURNS boolean
LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(bool_and(
    jsonb_typeof(l) = 'object'
    AND l->>'kind' IN ('instagram', 'youtube', 'tiktok', 'facebook', 'threads', 'linkedin', 'x', 'website')
    AND l->>'url' LIKE 'https://%'
    AND length(l->>'url') <= 300
    AND length(l->>'label') BETWEEN 1 AND 120
  ), true)
  FROM jsonb_array_elements(links) AS l
$$;

ALTER TABLE creator_profiles
  ADD CONSTRAINT creator_profiles_social_links_valid CHECK (social_link_kinds_valid(social_links));
